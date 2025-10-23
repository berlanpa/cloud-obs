#!/usr/bin/env python3
"""
Simplified analysis worker using OpenAI Vision API.
Processes camera feeds and publishes scores for automatic switching.
"""
import asyncio
import json
import base64
import io
import time
import sys
from typing import Optional, Dict
from PIL import Image
import numpy as np
from loguru import logger
from redis.asyncio import Redis
from livekit import rtc
from openai import AsyncOpenAI

from config import config


class AnalysisWorker:
    """Main worker that analyzes camera feeds using OpenAI Vision API."""

    def __init__(self):
        self.redis: Optional[Redis] = None
        self.openai_client = AsyncOpenAI(api_key=config.openai_api_key)

        # Frame buffers per camera (stores latest frame)
        self.frame_buffers: Dict[str, np.ndarray] = {}

        # Timing for frame sampling
        self.last_analysis_time: Dict[str, float] = {}

        # LiveKit room
        self.room: Optional[rtc.Room] = None

        logger.info("✓ Analysis Worker initialized with OpenAI Vision API")

    async def connect_redis(self):
        """Connect to Redis."""
        self.redis = Redis.from_url(config.redis_url, decode_responses=True)
        logger.info(f"✓ Connected to Redis: {config.redis_url}")

    async def _generate_token(self) -> str:
        """Generate LiveKit access token for analysis worker."""
        from livekit import api

        # Updated to use the new LiveKit Python SDK API
        token = api.AccessToken(
            config.livekit_api_key,
            config.livekit_api_secret
        ) \
            .with_identity('analysis-worker') \
            .with_name('AI Analysis Worker') \
            .with_metadata(json.dumps({'role': 'analyzer'})) \
            .with_grants(api.VideoGrants(
                room_join=True,
                room='main',
                can_publish=False,
                can_subscribe=True,
                can_publish_data=True,
                hidden=True
            ))

        return token.to_jwt()

    async def connect_livekit(self):
        """Connect to LiveKit room as a hidden participant."""
        logger.info(f"Connecting to LiveKit: {config.livekit_url}")

        token = await self._generate_token()
        self.room = rtc.Room()

        @self.room.on("track_subscribed")
        def on_track_subscribed(track: rtc.Track, publication: rtc.TrackPublication, participant: rtc.RemoteParticipant):
            logger.info(f"✓ Subscribed to {track.kind} track from {participant.identity}")

            if isinstance(track, rtc.VideoTrack):
                asyncio.create_task(self._process_video_track(track, participant.identity))

        @self.room.on("disconnected")
        def on_disconnected():
            logger.warning("Disconnected from LiveKit, attempting reconnect...")
            asyncio.create_task(self._reconnect_livekit())

        await self.room.connect(config.livekit_url, token)
        logger.info(f"✓ Connected to LiveKit room: main")

    async def _reconnect_livekit(self):
        """Attempt to reconnect to LiveKit with exponential backoff."""
        max_attempts = 5
        attempt = 0
        while attempt < max_attempts:
            try:
                await asyncio.sleep(2 ** attempt)
                await self.connect_livekit()
                logger.info("✓ Reconnected to LiveKit")
                return
            except Exception as e:
                attempt += 1
                logger.error(f"Reconnect attempt {attempt}/{max_attempts} failed: {e}")

        logger.critical("Failed to reconnect to LiveKit after max attempts")

    async def _process_video_track(self, track: rtc.VideoTrack, cam_id: str):
        """Process incoming video track - just store the latest frame."""
        logger.info(f"Processing video track for camera: {cam_id}")

        async for frame in track:
            try:
                # Convert frame to numpy array
                img = self._frame_to_numpy(frame)

                # Store in buffer (just keep latest frame)
                self.frame_buffers[cam_id] = img

            except Exception as e:
                logger.error(f"Error processing video frame from {cam_id}: {e}")

    def _frame_to_numpy(self, frame: rtc.VideoFrame) -> np.ndarray:
        """Convert LiveKit VideoFrame to numpy array using PyAV."""
        import av

        # Create PyAV VideoFrame from buffer
        av_frame = av.VideoFrame(frame.width, frame.height, 'yuv420p')

        # Copy plane data
        for i, plane in enumerate(frame.data.planes):
            av_frame.planes[i].update(bytes(plane))

        # Convert to RGB and get numpy array
        rgb_frame = av_frame.to_rgb()
        img = rgb_frame.to_ndarray()

        return img

    def _numpy_to_base64_jpeg(self, img: np.ndarray, quality: int = 85) -> str:
        """Convert numpy array to base64-encoded JPEG string."""
        # Convert to PIL Image
        pil_img = Image.fromarray(img)

        # Resize to save costs (512x512 is plenty for scene analysis)
        pil_img.thumbnail((512, 512), Image.Resampling.LANCZOS)

        # Encode as JPEG
        buffer = io.BytesIO()
        pil_img.save(buffer, format='JPEG', quality=quality)

        # Convert to base64
        img_bytes = buffer.getvalue()
        img_base64 = base64.b64encode(img_bytes).decode('utf-8')

        return img_base64

    async def analyze_frame_with_openai(self, img: np.ndarray, cam_id: str) -> Dict:
        """
        Analyze a single frame using OpenAI Vision API.
        Returns a score and reasoning.
        """
        try:
            # Convert frame to base64
            img_base64 = self._numpy_to_base64_jpeg(img)

            # Create the prompt
            prompt = """Analyze this video frame for a live broadcast camera switching system.

Rate the frame's interestingness for TV broadcast on a scale of 0-100, where:
- 0-20: Empty, boring, or unusable (no people, static background)
- 21-40: Low interest (static scene, people far away or inactive)
- 41-60: Moderate interest (people visible but not engaged)
- 61-80: Good interest (people engaged, speaking, or in action)
- 81-100: High interest (dynamic action, multiple engaged people, important moment)

Consider:
- Number of people visible and their engagement level
- Someone speaking or presenting
- Interesting actions, movements, or interactions
- Visual composition quality
- Facial expressions and gestures

Respond ONLY with valid JSON in this exact format:
{"score": <number 0-100>, "reason": "<brief explanation>", "people_count": <number>}"""

            # Call OpenAI API
            response = await self.openai_client.chat.completions.create(
                model=config.openai_model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{img_base64}",
                                    "detail": "low"  # Use low detail to save costs
                                }
                            }
                        ]
                    }
                ],
                max_tokens=150,
                temperature=0.3,
            )

            # Parse response
            result_text = response.choices[0].message.content.strip()

            # Try to parse as JSON
            try:
                result = json.loads(result_text)
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse OpenAI response as JSON: {result_text}")
                # Fallback: extract score if possible
                result = {"score": 50, "reason": "parsing error", "people_count": 0}

            logger.debug(f"{cam_id}: score={result.get('score', 0)}, reason={result.get('reason', 'N/A')}")

            return result

        except Exception as e:
            logger.error(f"Error calling OpenAI API for {cam_id}: {e}")
            return {"score": 0, "reason": f"API error: {str(e)}", "people_count": 0}

    async def analyze_loop(self):
        """Main analysis loop that processes buffered frames."""
        logger.info("✓ Starting analysis loop")

        while True:
            try:
                current_time = time.time()

                # Process all cameras with buffered frames
                for cam_id, frame in list(self.frame_buffers.items()):
                    # Check if we should analyze this camera (throttle based on sample interval)
                    if cam_id in self.last_analysis_time:
                        time_since_last = current_time - self.last_analysis_time[cam_id]
                        if time_since_last < config.frame_sample_interval:
                            continue

                    # Analyze this frame
                    await self._analyze_camera(cam_id, frame, current_time)
                    self.last_analysis_time[cam_id] = current_time

                # Sleep briefly
                await asyncio.sleep(0.5)

            except Exception as e:
                logger.error(f"Error in analysis loop: {e}")
                await asyncio.sleep(1.0)

    async def _analyze_camera(self, cam_id: str, frame: np.ndarray, current_time: float):
        """Analyze a single camera frame using OpenAI."""
        try:
            # Call OpenAI Vision API
            result = await self.analyze_frame_with_openai(frame, cam_id)

            # Create score payload
            score_data = {
                'cam_id': cam_id,
                'timestamp': current_time,
                'score': result.get('score', 0) / 100.0,  # Normalize to 0-1
                'reason': result.get('reason', ''),
                'people_count': result.get('people_count', 0),
                'features': {
                    'raw_score': result.get('score', 0),
                }
            }

            # Publish to Redis
            await self._publish_score(score_data)

        except Exception as e:
            logger.error(f"Error analyzing camera {cam_id}: {e}")

    async def _publish_score(self, score_data: Dict):
        """Publish score to Redis."""
        if not self.redis:
            return

        try:
            message = {
                'type': 'SCORE',
                'payload': score_data
            }

            await self.redis.publish('scores.stream', json.dumps(message))
            logger.info(f"📊 {score_data['cam_id']}: score={score_data['score']:.2f} - {score_data['reason'][:50]}")

        except Exception as e:
            logger.error(f"Error publishing score: {e}")

    async def run(self):
        """Run the worker."""
        await self.connect_redis()
        await self.connect_livekit()

        # Start analysis loop
        await self.analyze_loop()


async def main():
    """Main entry point."""
    logger.remove()
    logger.add(
        sys.stderr,
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <level>{message}</level>",
        level=config.log_level
    )

    logger.info("=" * 60)
    logger.info("AI-OBS Analysis Worker (OpenAI Vision API)")
    logger.info("=" * 60)

    worker = AnalysisWorker()

    try:
        await worker.run()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        raise


if __name__ == '__main__':
    asyncio.run(main())
