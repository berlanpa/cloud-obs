import numpy as np
from faster_whisper import WhisperModel
from typing import List, Dict, Optional
from loguru import logger
import time
from collections import deque


class WhisperASR:
    """Streaming ASR using Faster-Whisper with keyword detection."""

    def __init__(self, model_name: str = 'base.en', language: str = 'en', keywords: List[str] = None):
        self.model_name = model_name
        self.language = language
        self.keywords = set(keywords or [])

        # Initialize model
        device = 'cuda' if self._check_cuda() else 'cpu'
        compute_type = 'float16' if device == 'cuda' else 'int8'

        logger.info(f"Loading Whisper model: {model_name} on {device}")
        self.model = WhisperModel(
            model_name,
            device=device,
            compute_type=compute_type
        )

        # Audio buffer for streaming (stores last N seconds)
        self.audio_buffers: Dict[str, deque] = {}
        self.buffer_duration = 3.0  # seconds

        logger.info("Whisper ASR initialized")

    def _check_cuda(self) -> bool:
        try:
            import torch
            return torch.cuda.is_available()
        except:
            return False

    def transcribe_chunk(self, audio: np.ndarray, cam_id: str, sample_rate: int = 16000) -> Dict:
        """
        Transcribe audio chunk with keyword detection.

        Args:
            audio: Audio samples as float32 numpy array
            cam_id: Camera ID for buffer management
            sample_rate: Audio sample rate (default 16kHz)

        Returns:
            Dictionary with transcript, keywords, and features
        """
        if cam_id not in self.audio_buffers:
            self.audio_buffers[cam_id] = deque(maxlen=int(self.buffer_duration * sample_rate))

        # Add to buffer
        self.audio_buffers[cam_id].extend(audio)

        # Only transcribe if we have enough audio
        if len(self.audio_buffers[cam_id]) < sample_rate * 0.5:  # At least 0.5 seconds
            return {
                'text': '',
                'keywords': [],
                'energy_db': self._calculate_energy(audio),
                'speech_present': False
            }

        try:
            start_time = time.time()

            # Convert buffer to numpy array
            audio_array = np.array(list(self.audio_buffers[cam_id]), dtype=np.float32)

            # Transcribe
            segments, info = self.model.transcribe(
                audio_array,
                language=self.language,
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                    threshold=0.5
                )
            )

            # Collect segments
            text_segments = []
            detected_keywords = []

            for segment in segments:
                text = segment.text.strip()
                text_segments.append(text)

                # Check for keywords
                text_lower = text.lower()
                for keyword in self.keywords:
                    if keyword.lower() in text_lower:
                        detected_keywords.append(keyword)

            full_text = ' '.join(text_segments)
            energy_db = self._calculate_energy(audio)

            latency = (time.time() - start_time) * 1000

            logger.debug(f"Whisper transcription ({cam_id}): {latency:.1f}ms - '{full_text[:50]}'")

            return {
                'text': full_text,
                'keywords': list(set(detected_keywords)),
                'energy_db': energy_db,
                'speech_present': len(full_text) > 0,
                'latency_ms': latency,
                'confidence': info.language_probability if hasattr(info, 'language_probability') else 0.9
            }

        except Exception as e:
            logger.error(f"Whisper transcription failed for {cam_id}: {e}")
            return {
                'text': '',
                'keywords': [],
                'energy_db': self._calculate_energy(audio),
                'speech_present': False
            }

    def _calculate_energy(self, audio: np.ndarray) -> float:
        """Calculate RMS energy in dB."""
        if len(audio) == 0:
            return -80.0

        rms = np.sqrt(np.mean(audio ** 2))
        if rms < 1e-10:
            return -80.0

        db = 20 * np.log10(rms)
        return float(db)

    def clear_buffer(self, cam_id: str):
        """Clear audio buffer for a camera."""
        if cam_id in self.audio_buffers:
            self.audio_buffers[cam_id].clear()
