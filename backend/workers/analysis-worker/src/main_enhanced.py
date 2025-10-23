"""
Enhanced analysis worker with YOLOv11, LLaVA, ByteTrack, and batched Whisper.
Main orchestrator for multi-camera AI analysis.
"""

import asyncio
import numpy as np
import redis
import json
from typing import Dict, List, Optional
from loguru import logger
from pydantic_settings import BaseSettings
import time

# Import all enhanced models
from models.yolo_detector_v11 import YOLODetectorV11
from models.llava_vlm import LLaVAAnalyzer
from models.whisper_asr_enhanced import WhisperASREnhanced
from models.byte_tracker_wrapper import ByteTrackWrapper
from ranker_enhanced import CameraRankerEnhanced, RankingWeights


class Config(BaseSettings):
    """Configuration from environment variables."""

    # Redis
    redis_url: str = "redis://localhost:6379"
    scores_channel: str = "scores.stream"

    # LiveKit
    livekit_url: str = "ws://localhost:7880"
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    room_name: str = "ai-obs-demo"

    # Models
    yolo_model: str = "yolo11n"
    yolo_use_tensorrt: bool = True
    yolo_engine_path: Optional[str] = "/models/yolo11n.engine"

    vlm_model: str = "liuhaotian/llava-v1.5-7b"
    vlm_load_4bit: bool = True

    whisper_model: str = "turbo"
    whisper_use_batched: bool = True
    whisper_batch_size: int = 8

    # Tracking
    bytetrack_enabled: bool = True
    track_thresh: float = 0.5

    # Ranking
    ranking_method: str = "rule-based"  # or "xgboost"
    xgboost_model_path: Optional[str] = None

    # Processing
    num_cameras: int = 5
    frame_sample_rate: int = 10  # FPS
    vlm_interval_ms: int = 700

    class Config:
        env_file = ".env"


class AnalysisWorkerEnhanced:
    """
    Enhanced analysis worker orchestrating all AI models.

    Processes 5 camera feeds in real-time with:
    - YOLOv11 object detection (batch processing)
    - LLaVA vision-language understanding
    - Faster-Whisper speech recognition
    - ByteTrack object tracking
    - ML/rule-based camera ranking
    """

    def __init__(self, config: Config):
        self.config = config

        # Initialize Redis
        self.redis_client = redis.from_url(config.redis_url)
        logger.info(f"Connected to Redis: {config.redis_url}")

        # Initialize models
        logger.info("Initializing AI models...")

        # YOLO detector
        self.yolo = YOLODetectorV11(
            model_name=config.yolo_model,
            use_tensorrt=config.yolo_use_tensorrt,
            engine_path=config.yolo_engine_path
        )

        # VLM analyzer
        self.vlm = LLaVAAnalyzer(
            model_path=config.vlm_model,
            load_4bit=config.vlm_load_4bit
        )

        # Whisper ASR
        self.whisper = WhisperASREnhanced(
            model_name=config.whisper_model,
            use_batched=config.whisper_use_batched,
            batch_size=config.whisper_batch_size
        )

        # ByteTrack (optional)
        if config.bytetrack_enabled:
            self.tracker = ByteTrackWrapper(
                track_thresh=config.track_thresh,
                frame_rate=config.frame_sample_rate
            )
        else:
            self.tracker = None

        # Camera ranker
        self.ranker = CameraRankerEnhanced(
            xgboost_model_path=config.xgboost_model_path,
            use_xgboost=(config.ranking_method == "xgboost")
        )

        # State tracking
        self.last_vlm_time: Dict[str, float] = {}
        self.frame_count = 0

        logger.info("Analysis worker initialized successfully!")

    async def analyze_cameras(
        self,
        camera_frames: Dict[str, np.ndarray],
        camera_audio: Dict[str, np.ndarray],
        timestamps: Dict[str, float]
    ) -> List[Dict]:
        """
        Analyze all camera feeds in batch.

        Args:
            camera_frames: Dict of cam_id -> RGB frame (H,W,3)
            camera_audio: Dict of cam_id -> audio samples
            timestamps: Dict of cam_id -> timestamp

        Returns:
            List of camera scores and features
        """
        start_time = time.time()

        # 1. Batch YOLO detection on all frames
        yolo_batch = [
            (frame, cam_id, timestamps[cam_id])
            for cam_id, frame in camera_frames.items()
        ]
        yolo_results_list = self.yolo.batch_detect(yolo_batch)

        # Map results back to camera IDs
        yolo_results = {
            cam_id: result
            for cam_id, result in zip(camera_frames.keys(), yolo_results_list)
        }

        # 2. ByteTrack updates (per camera)
        tracking_results = {}
        if self.tracker:
            for cam_id, yolo_result in yolo_results.items():
                frame = camera_frames[cam_id]
                img_info = (frame.shape[0], frame.shape[1])
                img_size = (frame.shape[0], frame.shape[1])

                tracking_result = self.tracker.update(
                    cam_id,
                    yolo_result,
                    img_info,
                    img_size
                )
                tracking_results[cam_id] = tracking_result

        # 3. VLM analysis (selective - only every 700ms per camera)
        vlm_results = {}
        current_time = time.time()

        for cam_id in camera_frames.keys():
            # Check if enough time has passed since last VLM run
            last_vlm = self.last_vlm_time.get(cam_id, 0)
            if (current_time - last_vlm) * 1000 >= self.config.vlm_interval_ms:
                # Run VLM
                frame = camera_frames[cam_id]
                yolo_result = yolo_results[cam_id]

                vlm_result = self.vlm.analyze(frame, yolo_result)
                vlm_results[cam_id] = vlm_result

                self.last_vlm_time[cam_id] = current_time
            else:
                # Reuse previous VLM result or skip
                vlm_results[cam_id] = None

        # 4. Whisper transcription (per camera)
        whisper_results = {}
        for cam_id, audio in camera_audio.items():
            if audio is not None and len(audio) > 0:
                whisper_result = self.whisper.transcribe_chunk(audio, cam_id)
                whisper_results[cam_id] = whisper_result
            else:
                whisper_results[cam_id] = {
                    'text': '',
                    'keywords': [],
                    'energy_db': -80.0,
                    'speech_present': False
                }

        # 5. Compute scores for all cameras
        scores = []
        for cam_id in camera_frames.keys():
            score_result = self.ranker.compute_score(
                cam_id=cam_id,
                yolo_results=yolo_results[cam_id],
                whisper_results=whisper_results[cam_id],
                vlm_results=vlm_results.get(cam_id),
                tracking_results=tracking_results.get(cam_id)
            )

            scores.append(score_result)

        # Publish scores to Redis
        for score in scores:
            self._publish_score(score)

        total_time = (time.time() - start_time) * 1000
        logger.info(
            f"Analyzed {len(camera_frames)} cameras in {total_time:.1f}ms "
            f"(avg: {total_time/len(camera_frames):.1f}ms/cam)"
        )

        self.frame_count += 1

        return scores

    def _publish_score(self, score: Dict):
        """Publish camera score to Redis."""
        try:
            message = {
                'type': 'SCORE',
                'payload': {
                    'cam_id': score['cam_id'],
                    'timestamp': score['timestamp'],
                    'score': score['score'],
                    'features': score['features'],
                    'reason': score['reason'],
                    'method': score.get('method', 'rule-based'),
                    'vlm_tags': score.get('vlm_tags', []),
                    'vlm_caption': score.get('vlm_caption', '')
                }
            }

            self.redis_client.publish(
                self.config.scores_channel,
                json.dumps(message)
            )

        except Exception as e:
            logger.error(f"Failed to publish score: {e}")

    def update_active_camera(self, cam_id: str):
        """Update ranker with currently active camera."""
        tracking_result = None

        # Get main subject ID from tracker if available
        main_subject_id = None
        if self.tracker:
            # This would come from the decision service feedback
            pass

        self.ranker.update_active_camera(cam_id, main_subject_id)

    async def run(self):
        """Main run loop (placeholder for LiveKit integration)."""
        logger.info("Analysis worker ready. Waiting for camera feeds...")

        # TODO: Connect to LiveKit room and subscribe to camera tracks
        # TODO: Process frames at configured sample rate
        # TODO: Handle audio streams

        # For now, this is a placeholder
        # Real implementation would:
        # 1. Connect to LiveKit room
        # 2. Subscribe to all 5 camera video/audio tracks
        # 3. Sample frames at 10 FPS
        # 4. Call analyze_cameras() with batched frames
        # 5. Publish results to Redis

        while True:
            await asyncio.sleep(1)
            # Placeholder - real implementation would process LiveKit frames


async def main():
    """Main entry point."""
    logger.info("Starting Enhanced Analysis Worker...")

    config = Config()

    worker = AnalysisWorkerEnhanced(config)

    # Run main loop
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
