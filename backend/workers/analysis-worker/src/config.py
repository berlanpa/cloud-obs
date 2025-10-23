import os
from pydantic import BaseModel


class Config(BaseModel):
    # Redis
    redis_url: str = os.getenv('REDIS_URL', 'redis://localhost:6379')

    # LiveKit
    livekit_url: str = os.getenv('LIVEKIT_URL', 'ws://localhost:7880')
    livekit_api_key: str = os.getenv('LIVEKIT_API_KEY', 'devkey')
    livekit_api_secret: str = os.getenv('LIVEKIT_API_SECRET', 'secret')

    # OpenAI
    openai_api_key: str = os.getenv('OPENAI_API_KEY', '')
    openai_model: str = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')

    # Frame sampling (analyze 1 frame every N seconds per camera)
    frame_sample_interval: float = float(os.getenv('FRAME_SAMPLE_INTERVAL', '3.0'))

    # Logging
    log_level: str = os.getenv('LOG_LEVEL', 'INFO')


config = Config()
