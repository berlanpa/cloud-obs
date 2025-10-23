#!/usr/bin/env python3
"""
Piper TTS Service - Fast, local text-to-speech using Piper.
"""
import io
import os
import wave
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from piper import PiperVoice

app = FastAPI(title="Piper TTS Service")

# Load Piper voice model
MODEL_PATH = Path("/app/models/en_US-lessac-medium.onnx")
voice: Optional[PiperVoice] = None


@app.on_event("startup")
async def load_model():
    """Load Piper voice model on startup."""
    global voice
    try:
        voice = PiperVoice.load(MODEL_PATH)
        print(f"✓ Piper voice model loaded: {MODEL_PATH}")
    except Exception as e:
        print(f"✗ Failed to load Piper model: {e}")
        raise


class TTSRequest(BaseModel):
    text: str
    speaker_id: Optional[int] = None
    length_scale: Optional[float] = 1.0  # Speed (1.0 = normal, <1.0 = faster)
    noise_scale: Optional[float] = 0.667
    noise_w: Optional[float] = 0.8


class TTSResponse(BaseModel):
    success: bool
    audio_length_seconds: float
    sample_rate: int
    message: Optional[str] = None


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "model_loaded": voice is not None,
        "model_path": str(MODEL_PATH)
    }


@app.post("/synthesize")
async def synthesize(request: TTSRequest) -> Response:
    """
    Synthesize speech from text.

    Returns raw PCM audio (16-bit, mono).
    """
    if not voice:
        raise HTTPException(status_code=503, detail="Voice model not loaded")

    if not request.text or len(request.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        # Synthesize audio
        audio_buffer = io.BytesIO()

        # Piper outputs raw PCM data
        with wave.open(audio_buffer, 'wb') as wav_file:
            # Set WAV parameters (16kHz, 16-bit, mono)
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(voice.config.sample_rate)

            # Synthesize and write
            voice.synthesize(
                request.text,
                wav_file,
                speaker_id=request.speaker_id,
                length_scale=request.length_scale,
                noise_scale=request.noise_scale,
                noise_w=request.noise_w
            )

        # Get audio data
        audio_data = audio_buffer.getvalue()

        # Calculate duration
        sample_rate = voice.config.sample_rate
        num_samples = (len(audio_data) - 44) // 2  # Subtract WAV header, 2 bytes per sample
        duration = num_samples / sample_rate

        print(f"✓ Synthesized: '{request.text[:50]}...' ({duration:.2f}s)")

        # Return WAV file
        return Response(
            content=audio_data,
            media_type="audio/wav",
            headers={
                "X-Audio-Duration": str(duration),
                "X-Sample-Rate": str(sample_rate)
            }
        )

    except Exception as e:
        print(f"✗ Synthesis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")


@app.post("/synthesize/info")
async def synthesize_info(request: TTSRequest) -> TTSResponse:
    """
    Get synthesis info without returning audio (for testing).
    """
    if not voice:
        raise HTTPException(status_code=503, detail="Voice model not loaded")

    try:
        # Synthesize to buffer
        audio_buffer = io.BytesIO()

        with wave.open(audio_buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(voice.config.sample_rate)

            voice.synthesize(
                request.text,
                wav_file,
                speaker_id=request.speaker_id,
                length_scale=request.length_scale,
                noise_scale=request.noise_scale,
                noise_w=request.noise_w
            )

        audio_data = audio_buffer.getvalue()
        sample_rate = voice.config.sample_rate
        num_samples = (len(audio_data) - 44) // 2
        duration = num_samples / sample_rate

        return TTSResponse(
            success=True,
            audio_length_seconds=duration,
            sample_rate=sample_rate,
            message=f"Successfully synthesized {len(request.text)} characters"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5001")),
        log_level="info"
    )
