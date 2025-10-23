"""
LLaVA Vision-Language Model for advanced scene understanding.
Replaces Moondream with superior quality and structured output.
"""

import torch
import numpy as np
from PIL import Image
from typing import Dict, List, Optional, Tuple
from loguru import logger
import time
import json
import re

# LLaVA imports
try:
    import sys
    sys.path.append('/Users/nadavshanun/Downloads/AI-OBS/workers/vlm/llava')

    from llava.model.builder import load_pretrained_model
    from llava.mm_utils import get_model_name_from_path, process_images, tokenizer_image_token
    from llava.constants import IMAGE_TOKEN_INDEX, DEFAULT_IMAGE_TOKEN
    from llava.conversation import conv_templates
    LLAVA_AVAILABLE = True
except ImportError as e:
    logger.warning(f"LLaVA not available: {e}")
    LLAVA_AVAILABLE = False


class LLaVAAnalyzer:
    """
    Vision-Language Model using LLaVA-1.5-7B for scene understanding.

    Features:
    - 600-700ms latency with 4-bit quantization
    - Structured JSON output for camera ranking
    - Rich semantic understanding
    - Batch processing support
    """

    def __init__(
        self,
        model_path: str = "liuhaotian/llava-v1.5-7b",
        load_4bit: bool = True,
        use_flash_attn: bool = True
    ):
        """
        Initialize LLaVA model.

        Args:
            model_path: HuggingFace model ID or local path
            load_4bit: Use 4-bit quantization for speed (recommended)
            use_flash_attn: Use Flash Attention 2 for speedup
        """
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.model_path = model_path
        self.model = None
        self.tokenizer = None
        self.image_processor = None
        self.context_len = None

        if not LLAVA_AVAILABLE:
            logger.error("LLaVA dependencies not available, VLM disabled")
            return

        try:
            logger.info(f"Loading LLaVA model: {model_path} (4-bit: {load_4bit})")
            start_time = time.time()

            model_name = get_model_name_from_path(model_path)

            self.tokenizer, self.model, self.image_processor, self.context_len = load_pretrained_model(
                model_path=model_path,
                model_base=None,
                model_name=model_name,
                load_8bit=False,
                load_4bit=load_4bit,
                device_map="auto",
                use_flash_attn=use_flash_attn
            )

            self.model.eval()

            load_time = time.time() - start_time
            logger.info(f"LLaVA loaded successfully on {self.device} in {load_time:.1f}s")

        except Exception as e:
            logger.error(f"Failed to load LLaVA: {e}")
            self.model = None

    def analyze(self, frame: np.ndarray, yolo_results: Dict) -> Dict:
        """
        Analyze frame with LLaVA to get structured scene understanding.

        Args:
            frame: RGB frame as numpy array
            yolo_results: YOLO detection results for context

        Returns:
            Dictionary with caption, tags, scores, and metadata
        """
        if self.model is None:
            return self._fallback_response()

        try:
            start_time = time.time()

            # Convert to PIL Image
            image = Image.fromarray(frame)

            # Create optimized prompt for camera ranking
            prompt = self._create_ranking_prompt(yolo_results)

            # Process image
            image_tensor = process_images([image], self.image_processor, self.model.config)
            image_tensor = image_tensor.to(self.device, dtype=torch.float16)
            image_sizes = [image.size]

            # Prepare conversation
            conv_mode = "llava_v1"  # For LLaVA-1.5
            conv = conv_templates[conv_mode].copy()

            full_prompt = DEFAULT_IMAGE_TOKEN + "\n" + prompt
            conv.append_message(conv.roles[0], full_prompt)
            conv.append_message(conv.roles[1], None)
            prompt_text = conv.get_prompt()

            # Tokenize
            input_ids = tokenizer_image_token(
                prompt_text,
                self.tokenizer,
                IMAGE_TOKEN_INDEX,
                return_tensors='pt'
            ).unsqueeze(0).to(self.device)

            # Generate
            with torch.inference_mode():
                output_ids = self.model.generate(
                    input_ids,
                    images=image_tensor,
                    image_sizes=image_sizes,
                    do_sample=False,  # Deterministic for consistency
                    temperature=0.2,
                    top_p=0.9,
                    max_new_tokens=100,  # Short responses
                    use_cache=True
                )

            # Decode
            response = self.tokenizer.batch_decode(
                output_ids,
                skip_special_tokens=True
            )[0].strip()

            # Parse structured output
            parsed = self._parse_response(response, yolo_results)

            latency = (time.time() - start_time) * 1000
            logger.debug(f"LLaVA inference: {latency:.1f}ms - {parsed.get('scene_type', 'unknown')}")

            parsed['latency_ms'] = latency
            return parsed

        except Exception as e:
            logger.error(f"LLaVA analysis failed: {e}", exc_info=True)
            return self._fallback_response()

    def _create_ranking_prompt(self, yolo_results: Dict) -> str:
        """Create optimized prompt for camera ranking."""
        detected_objects = list(yolo_results.get('object_counts', {}).keys())
        object_str = ', '.join(detected_objects[:5]) if detected_objects else 'unknown'

        prompt = f"""Analyze this camera frame for a live director system. Objects detected: {object_str}.

Provide:
1. Scene type (indoor/outdoor/stage/sports/office)
2. Main subjects (people/speaker/audience/vehicle/object)
3. Activity level (static/moderate/dynamic)
4. Focus quality (blurry/acceptable/sharp)
5. Interest score (1-5, where 5 is most interesting)

Respond in JSON format:
{{
    "scene_type": "...",
    "main_subjects": ["..."],
    "activity_level": "...",
    "focus_quality": "...",
    "interest_score": X
}}"""

        return prompt

    def _parse_response(self, response: str, yolo_results: Dict) -> Dict:
        """Parse LLaVA response into structured format."""
        # Try to extract JSON
        try:
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())

                # Extract tags from structured data
                tags = self._extract_tags(data, yolo_results)

                # Build caption from structured data
                scene = data.get('scene_type', 'unknown')
                subjects = data.get('main_subjects', [])
                activity = data.get('activity_level', 'unknown')

                if isinstance(subjects, list):
                    subject_str = ', '.join(subjects[:2])
                else:
                    subject_str = str(subjects)

                caption = f"{scene} scene with {subject_str}, {activity} activity"

                return {
                    'caption': caption,
                    'tags': tags,
                    'confidence': 0.9,
                    'scene_type': scene,
                    'main_subjects': subjects if isinstance(subjects, list) else [subjects],
                    'activity_level': activity,
                    'focus_quality': data.get('focus_quality', 'acceptable'),
                    'interest_score': int(data.get('interest_score', 3)),
                    'raw_response': response
                }

        except json.JSONDecodeError:
            logger.warning(f"Failed to parse JSON from LLaVA: {response[:100]}")

        # Fallback: extract tags from text
        tags = self._extract_tags_from_text(response, yolo_results)

        return {
            'caption': response[:200],  # Truncate long responses
            'tags': tags,
            'confidence': 0.7,
            'scene_type': 'unknown',
            'main_subjects': [],
            'activity_level': 'unknown',
            'focus_quality': 'acceptable',
            'interest_score': 3,
            'raw_response': response
        }

    def _extract_tags(self, data: Dict, yolo_results: Dict) -> List[str]:
        """Extract semantic tags from structured data."""
        tags = []

        # Scene type tags
        scene_type = data.get('scene_type', '').lower()
        if scene_type:
            tags.append(scene_type)

        # Activity tags
        activity = data.get('activity_level', '').lower()
        if 'dynamic' in activity:
            tags.append('high-motion')
        elif 'static' in activity:
            tags.append('static')

        # Focus quality
        focus = data.get('focus_quality', '').lower()
        if 'sharp' in focus:
            tags.append('sharp')
        elif 'blurry' in focus:
            tags.append('blurry')

        # Main subjects
        subjects = data.get('main_subjects', [])
        if isinstance(subjects, list):
            for subject in subjects[:3]:
                if isinstance(subject, str):
                    tags.append(subject.lower())

        # Interest-based tags
        interest = data.get('interest_score', 3)
        if interest >= 4:
            tags.append('high-interest')
        elif interest <= 2:
            tags.append('low-interest')

        # Add YOLO-based tags
        if yolo_results.get('face_conf_max', 0) > 0.7:
            tags.append('face-visible')

        if yolo_results.get('total_objects', 0) > 5:
            tags.append('crowded')

        return tags

    def _extract_tags_from_text(self, text: str, yolo_results: Dict) -> List[str]:
        """Extract tags from unstructured text response."""
        tags = []
        text_lower = text.lower()

        # Scene types
        if any(word in text_lower for word in ['indoor', 'inside', 'room']):
            tags.append('indoor')
        if any(word in text_lower for word in ['outdoor', 'outside', 'field']):
            tags.append('outdoor')

        # Activity
        if any(word in text_lower for word in ['speaking', 'talking', 'presenting']):
            tags.append('speaking')
        if any(word in text_lower for word in ['moving', 'walking', 'running', 'active']):
            tags.append('high-motion')
        if any(word in text_lower for word in ['standing', 'sitting', 'still']):
            tags.append('static')

        # Subjects
        if 'person' in text_lower or 'people' in text_lower:
            tags.append('people')
        if 'audience' in text_lower or 'crowd' in text_lower:
            tags.append('audience')

        # Add YOLO-based tags
        if yolo_results.get('face_conf_max', 0) > 0.7:
            tags.append('face-visible')

        return tags

    def _fallback_response(self) -> Dict:
        """Return empty response when model unavailable."""
        return {
            'caption': '',
            'tags': [],
            'confidence': 0.0,
            'scene_type': 'unknown',
            'main_subjects': [],
            'activity_level': 'unknown',
            'focus_quality': 'unknown',
            'interest_score': 3,
            'latency_ms': 0
        }

    def batch_analyze(
        self,
        frames_with_yolo: List[Tuple[np.ndarray, Dict]]
    ) -> List[Dict]:
        """
        Batch analysis for multiple frames.

        Note: Current implementation processes sequentially.
        True batching would require significant LLaVA modifications.

        Args:
            frames_with_yolo: List of (frame, yolo_results) tuples

        Returns:
            List of VLM results
        """
        results = []
        for frame, yolo_results in frames_with_yolo:
            result = self.analyze(frame, yolo_results)
            results.append(result)

        return results
