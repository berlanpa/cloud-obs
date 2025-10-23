# Quick Start Guide

Get AI-OBS running in 5 steps:

## 1. Configure Environment

```bash
cp .env.example .env
```

**For local dev, the defaults work!** No API keys needed.

Optional: Edit `.env` to customize LiveKit URL or TTS speed

## 2. Install Dependencies

```bash
npm install
```

## 3. Start Services

```bash
docker-compose up -d
```

## 4. Connect Cameras

Use OBS Studio, test videos, or any WebRTC client to connect 5 cameras with identities:
- `cam-1`
- `cam-2`
- `cam-3`
- `cam-4`
- `cam-5`

To room: `main`

Get camera tokens:
```bash
curl -X POST http://localhost:3000/token \
  -H "Content-Type: application/json" \
  -d '{"identity":"cam-1","room":"main","role":"camera"}'
```

## 5. Open Web UI

http://localhost:3100

## Services Overview

| Service | URL | Purpose |
|---------|-----|---------|
| Web UI | http://localhost:3100 | Control interface |
| API | http://localhost:3000 | REST & WebSocket |
| Prometheus | http://localhost:9090 | Metrics |
| Grafana | http://localhost:3001 | Dashboards |

## Key Commands

```bash
# View logs
docker-compose logs -f

# Restart a service
docker-compose restart decision-service

# Stop everything
docker-compose down

# Rebuild after changes
docker-compose build
```

## Troubleshooting

**No cameras?**
- Check LiveKit credentials in `.env`
- Verify cameras are publishing to room "main"
- Check browser console for errors

**No switching?**
- Check: `docker-compose logs decision-service`
- Verify analysis worker is running
- Reduce DELTA_S_THRESHOLD in `.env`

**High latency?**
- Use smaller models (yolov8n)
- Reduce FRAME_SAMPLE_RATE
- Disable VLM: `VLM_ENABLED=false`

For detailed setup, see SETUP.md
For full documentation, see README.md
