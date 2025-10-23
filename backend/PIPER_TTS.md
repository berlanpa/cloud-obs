# Piper TTS - Local Text-to-Speech

AI-OBS now uses **Piper TTS**, a fast, local, open-source text-to-speech engine. **No API keys or external services required!**

## What is Piper?

[Piper](https://github.com/rhasspy/piper) is a neural text-to-speech system that:
- ✅ Runs **completely locally** (no cloud, no API keys)
- ✅ Fast synthesis (< 200ms for typical narration)
- ✅ High quality, natural-sounding voices
- ✅ Lightweight models (25-50MB)
- ✅ Multi-language support
- ✅ Open source (MIT license)

## Default Voice

The system uses **en_US-lessac-medium** by default:
- **Quality**: High quality, clear American English
- **Speed**: ~150ms synthesis time
- **Size**: 42MB
- **Speaker**: Female voice, professional narrator tone

## How It Works

```
TTS Orchestrator → Piper Service → WAV Audio
   (generates text)   (synthesizes)   (to LiveKit)
```

The Piper service runs in its own Docker container and is accessed via HTTP API by the TTS orchestrator.

## Configuration

### Speed Control

Control narration speed in `.env`:

```bash
TTS_SPEED=1.0   # Normal speed (default)
TTS_SPEED=0.8   # 20% faster (for quick cuts)
TTS_SPEED=1.2   # 20% slower (more dramatic)
```

### Voice Selection

To use a different voice:

1. **Browse available voices**: https://github.com/rhasspy/piper/blob/master/VOICES.md

2. **Update Dockerfile** (`services/piper-tts/Dockerfile`):

```dockerfile
# Replace these lines with your chosen voice
RUN wget -q https://github.com/rhasspy/piper/releases/download/v1.2.0/YOUR_VOICE.onnx && \
    wget -q https://github.com/rhasspy/piper/releases/download/v1.2.0/YOUR_VOICE.onnx.json
```

3. **Update main.py** to point to new model:

```python
MODEL_PATH = Path("/app/models/YOUR_VOICE.onnx")
```

4. **Rebuild**:
```bash
docker-compose build piper-tts
docker-compose up -d piper-tts
```

### Popular Voice Alternatives

| Voice | Language | Gender | Quality | Size |
|-------|----------|--------|---------|------|
| `en_US-lessac-medium` | English (US) | F | High | 42MB |
| `en_US-ryan-high` | English (US) | M | Very High | 116MB |
| `en_GB-alan-medium` | English (UK) | M | High | 42MB |
| `en_US-libritts-high` | English (US) | Multiple | Very High | 100MB |

## API Endpoints

The Piper service exposes:

### POST /synthesize
Synthesize speech and get WAV audio:

```bash
curl -X POST http://localhost:5000/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "Switching to camera 3"}' \
  --output audio.wav
```

### POST /synthesize/info
Get synthesis info without audio:

```bash
curl -X POST http://localhost:5000/synthesize/info \
  -H "Content-Type: application/json" \
  -d '{"text": "Test narration", "length_scale": 1.0}'
```

Response:
```json
{
  "success": true,
  "audio_length_seconds": 1.2,
  "sample_rate": 22050,
  "message": "Successfully synthesized 14 characters"
}
```

### GET /health
Check service health:

```bash
curl http://localhost:5000/health
```

## Advanced Parameters

When calling the Piper API, you can fine-tune synthesis:

```json
{
  "text": "Your narration text",
  "length_scale": 1.0,    // Speed: <1.0 = faster, >1.0 = slower
  "noise_scale": 0.667,   // Variance in pronunciation (0.0-1.0)
  "noise_w": 0.8          // Variance in prosody (0.0-1.0)
}
```

## Performance

Typical synthesis times on different hardware:

| Hardware | Time for 10 words |
|----------|-------------------|
| Modern CPU (8 cores) | ~150ms |
| Older CPU (4 cores) | ~300ms |
| Raspberry Pi 4 | ~800ms |

All well within the 600ms latency budget!

## Advantages over ElevenLabs

| Feature | Piper TTS | ElevenLabs |
|---------|-----------|------------|
| **Cost** | Free | $5-330/month |
| **Privacy** | 100% local | Cloud-based |
| **Latency** | 100-200ms | 200-500ms |
| **Internet** | Not required | Required |
| **API Limits** | None | Rate limited |
| **Customization** | Full control | Limited |

## Troubleshooting

### Piper service won't start

```bash
# Check logs
docker-compose logs piper-tts

# Verify model downloaded
docker-compose exec piper-tts ls -lh /app/models/
```

### Audio sounds robotic

Try adjusting parameters:
- Lower `noise_scale` to 0.4 for cleaner speech
- Increase `noise_w` to 0.9 for more natural prosody

### Slow synthesis

- Use a smaller model (e.g., `low` instead of `medium`)
- Check CPU isn't overloaded
- Consider GPU acceleration (advanced)

## Multi-Language Support

Piper supports 30+ languages! Examples:

```bash
# Spanish
wget https://github.com/rhasspy/piper/releases/download/v1.2.0/es_ES-sharvard-medium.onnx

# French
wget https://github.com/rhasspy/piper/releases/download/v1.2.0/fr_FR-siwis-medium.onnx

# German
wget https://github.com/rhasspy/piper/releases/download/v1.2.0/de_DE-thorsten-medium.onnx
```

Update the Dockerfile and you're good to go!

## Why We Chose Piper

1. **Zero Dependencies**: No API keys, accounts, or external services
2. **Low Latency**: Fast enough for real-time narration
3. **Quality**: Sounds professional and natural
4. **Open Source**: MIT licensed, community-driven
5. **Flexible**: Easy to customize voices and parameters

Enjoy your self-hosted, AI-powered narration! 🎙️
