import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from PIL import Image
import numpy as np
from typing import Dict, List
from loguru import logger
import time


class VLMAnalyzer:
    """Vision-Language Model for scene understanding using Moondream or similar."""

    def __init__(self, model_name: str = 'vikhyatk/moondream2'):
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.model_name = model_name

        try:
            logger.info(f"Loading VLM model: {model_name}")
            self.model = AutoModelForCausalLM.from_pretrained(
                model_name,
                trust_remote_code=True,
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                low_cpu_mem_usage=True
            ).to(self.device)

            self.tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                trust_remote_code=True
            )

            self.model.eval()
            logger.info(f"VLM loaded successfully on {self.device}")
        except Exception as e:
            logger.error(f"Failed to load VLM: {e}")
            self.model = None
            self.tokenizer = None

    def analyze(self, frame: np.ndarray, yolo_results: Dict) -> Dict:
        """
        Analyze frame with VLM to get caption and semantic tags.

        Args:
            frame: RGB frame as numpy array
            yolo_results: YOLO detection results for context

        Returns:
            Dictionary with caption, tags, and confidence
        """
        if self.model is None:
            return {
                'caption': '',
                'tags': [],
                'confidence': 0.0
            }

        try:
            start_time = time.time()

            # Convert frame to PIL Image
            image = Image.fromarray(frame)

            # Create context-aware prompt based on YOLO detections
            detected_objects = list(yolo_results.get('object_counts', {}).keys())
            object_context = ', '.join(detected_objects[:5]) if detected_objects else 'scene'

            # Moondream2 specific inference
            prompt = f"Describe this scene in one short sentence focusing on the main subject and action. Objects detected: {object_context}"

            # Encode image
            image_embeds = self.model.encode_image(image)

            # Generate caption
            caption = self.model.answer_question(
                image_embeds,
                prompt,
                self.tokenizer,
                max_new_tokens=40
            )

            # Extract tags from caption and YOLO results
            tags = self._extract_tags(caption, yolo_results)

            # Simple confidence based on caption length and coherence
            confidence = min(1.0, len(caption.split()) / 15.0)

            latency = (time.time() - start_time) * 1000
            logger.debug(f"VLM inference: {latency:.1f}ms - {caption}")

            return {
                'caption': caption,
                'tags': tags,
                'confidence': confidence,
                'latency_ms': latency
            }

        except Exception as e:
            logger.error(f"VLM analysis failed: {e}")
            return {
                'caption': '',
                'tags': [],
                'confidence': 0.0
            }

    def _extract_tags(self, caption: str, yolo_results: Dict) -> List[str]:
        """Extract semantic tags from caption and detections."""
        tags = []

        caption_lower = caption.lower()

        # Action tags
        if any(word in caption_lower for word in ['pointing', 'gesturing', 'waving']):
            tags.append('gesture')
        if any(word in caption_lower for word in ['speaking', 'talking', 'presenting']):
            tags.append('speaking')
        if 'crowd' in caption_lower or 'audience' in caption_lower:
            tags.append('audience')

        # Framing tags
        person_count = yolo_results.get('object_counts', {}).get('person', 0)
        if person_count == 1:
            tags.append('close-up')
        elif person_count > 3:
            tags.append('wide-shot')

        # Object-based tags
        if yolo_results.get('face_conf_max', 0) > 0.7:
            tags.append('face-visible')

        if yolo_results.get('motion_score', 0) > 0.5:
            tags.append('high-motion')

        return tags

    def batch_analyze(self, frames_with_yolo: List[tuple]) -> List[Dict]:
        """
        Batch analysis for multiple frames.

        Args:
            frames_with_yolo: List of (frame, yolo_results) tuples

        Returns:
            List of VLM results
        """
        # For now, process sequentially
        # TODO: Implement true batching if model supports it
        results = []
        for frame, yolo_results in frames_with_yolo:
            result = self.analyze(frame, yolo_results)
            results.append(result)

        return results
