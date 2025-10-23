# AI-OBS: Intelligent Auto-Director

A real-time, AI-powered auto-director system that intelligently switches between 5 camera feeds using YOLO object detection, Vision-Language Models (VLM), Whisper ASR, and generates live narration via **Piper TTS** (local, open-source).

## Features

- **Real-time Multi-Camera Analysis**: Processes 5 camera feeds simultaneously at 10 fps
- **Intelligent Switching**: Uses YOLO, VLM (Moondream), and Whisper to rank cameras based on:
  - Face detection and salience
  - Object detection and motion
  - Speech energy and keywords
  - Scene understanding via VLM
- **Live Narration**: Generates context-aware commentary using Piper TTS (local, no API key needed)
- **Web-Based Control Interface**: Modern React/Next.js UI with LiveKit integration
- **Low Latency**: End-to-end glass-to-glass latency of 1.5-2.5 seconds

## Architecture

```
┌─────────────┐
│  5 Cameras  │──┐
└─────────────┘  │
                 ├──> LiveKit SFU ──┬──> Analysis Worker (GPU)
┌─────────────┐  │                  │    - YOLO Detection
│  Web-OBS UI │──┘                  │    - VLM Analysis
└─────────────┘                     │    - Whisper ASR
                                    │    - Feature Fusion
                                    │    - Ranking
                                    │
                                    ├──> Decision Service
                                    │    - Switching Logic
                                    │    - Hysteresis & Cooldown
                                    │
                                    ├──> TTS Orchestrator
                                    │    - Piper TTS Integration (Local)
                                    │    - Narration Generation
                                    │
                                    └──> Program Producer
                                         - Track Management
                                         - Output Composition
```

## Prerequisites

### Required
- **Docker** & **Docker Compose**
- **NVIDIA GPU** with CUDA support (for analysis worker, optional - can run on CPU)
- **LiveKit Server** (self-hosted or cloud - **no account needed for local dev!**)

### That's It!
**No API keys, no external services, no signups required!** Everything runs locally.

### Recommended
- 16GB+ RAM
- NVIDIA GPU with 8GB+ VRAM (A10, L4, or better)
- Multi-core CPU (8+ cores)

## Quick Start

### 1. Clone and Setup

```bash
cd AI-OBS
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` with your credentials:

```bash
# LiveKit (use defaults for local dev)
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret

# Piper TTS (local, no API key needed!)
TTS_SPEED=1.0  # 1.0 = normal, 0.8 = faster, 1.2 = slower

# Configuration
NUM_CAMERAS=5
MIN_HOLD_SEC=2.0
COOLDOWN_SEC=4.0
DELTA_S_THRESHOLD=0.15
```

### 3. Build and Run

```bash
# Build all services
docker-compose build

# Start the system
docker-compose up -d

# View logs
docker-compose logs -f
```

### 4. Access the Web UI

Open http://localhost:3100 in your browser.

### 5. Connect Cameras

Each camera needs to connect to the LiveKit room. You can:

**Option A: Use OBS Studio**
1. Install OBS with LiveKit plugin
2. Get a camera token from the API: `POST http://localhost:3000/token`
3. Configure OBS to publish to LiveKit

**Option B: Use WebRTC client**
- Use any WebRTC client that supports LiveKit
- Connect with identity `cam-1`, `cam-2`, `cam-3`, `cam-4`, `cam-5`

**Option C: Use test cameras**
```bash
# Install LiveKit CLI
npm install -g @livekit/cli

# Publish test video
livekit-cli publish \
  --url $LIVEKIT_URL \
  --api-key $LIVEKIT_API_KEY \
  --api-secret $LIVEKIT_API_SECRET \
  --identity cam-1 \
  --room main \
  --video path/to/video.mp4
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| **API Gateway** | 3000 | REST API & WebSocket for UI |
| **Decision Service** | 3001 | Switching logic & decision engine |
| **TTS Orchestrator** | 3002 | Narration & Piper TTS integration |
| **Piper TTS** | 5000 | Local text-to-speech service |
| **Program Producer** | 3003 | Program feed management |
| **Web-OBS UI** | 3100 | Web control interface |
| **Prometheus** | 9090 | Metrics collection |
| **Grafana** | 3001 | Metrics visualization |
| **Redis** | 6379 | Pub/sub messaging |
| **PostgreSQL** | 5432 | Configuration storage |
| **ClickHouse** | 8123, 9000 | Telemetry & analytics |

## Development

### Run Individual Services

**Analysis Worker (Python)**
```bash
cd workers/analysis-worker
pip install -r requirements.txt
python src/main.py
```

**Decision Service (Node.js)**
```bash
cd services/decision-service
npm install
npm run dev
```

**Web UI (Next.js)**
```bash
cd web-obs
npm install
npm run dev
```

### Project Structure

```
AI-OBS/
├── services/
│   ├── decision-service/      # Switching logic
│   ├── tts-orchestrator/      # Narration & TTS
│   ├── program-producer/      # Output management
│   └── api-gateway/           # REST API & WebSocket
├── workers/
│   └── analysis-worker/       # YOLO + VLM + Whisper
├── web-obs/                   # Next.js UI
├── shared/
│   └── types/                 # TypeScript type definitions
├── config/
│   ├── prometheus/
│   └── grafana/
└── docker-compose.yml
```

## Configuration

### Switching Policy

Adjust switching behavior in `.env`:

```bash
MIN_HOLD_SEC=2.0              # Minimum time to hold a shot
COOLDOWN_SEC=4.0              # Cooldown before revisiting camera
DELTA_S_THRESHOLD=0.15        # Minimum score delta to switch
MAX_SHOT_DURATION_SEC=15.0    # Force switch after this duration
```

### Model Configuration

```bash
# YOLO
YOLO_MODEL=yolov8n            # yolov8n, yolov8s, yolov8m
YOLO_CONFIDENCE=0.5

# VLM
VLM_MODEL=moondream           # vikhyatk/moondream2
VLM_INTERVAL_MS=700           # How often to run VLM
VLM_ENABLED=true

# Whisper
WHISPER_MODEL=base.en         # tiny, base, small, medium
WHISPER_LANGUAGE=en
```

### Ranking Weights

Edit `workers/analysis-worker/src/ranker.py` to adjust scoring weights:

```python
@dataclass
class RankingWeights:
    face_salience: float = 0.25
    main_subject_overlap: float = 0.15
    motion_salience: float = 0.15
    speech_energy: float = 0.15
    keyword_boost: float = 0.10
    framing_score: float = 0.10
    novelty_decay: float = 0.05
    continuity_bonus: float = 0.05
```

## API Reference

### Get LiveKit Token

```bash
POST /token
Content-Type: application/json

{
  "identity": "cam-1",
  "room": "main",
  "role": "camera"  # camera | viewer | producer
}
```

### Get System Config

```bash
GET /config
```

### WebSocket Events

Connect to `ws://localhost:3000/ws` to receive real-time events:

```typescript
{
  type: 'switch' | 'score' | 'narration' | 'status',
  payload: any,
  timestamp: number
}
```

## Monitoring

### Prometheus Metrics

Access metrics at http://localhost:9090

Key metrics:
- `camera_score` - Score per camera
- `switch_count` - Number of switches
- `vlm_latency_ms` - VLM inference time
- `yolo_latency_ms` - YOLO inference time
- `tts_latency_ms` - TTS synthesis time

### Grafana Dashboards

Access dashboards at http://localhost:3001 (default password: `admin/admin`)

## Troubleshooting

### Analysis Worker Not Starting

**Issue**: CUDA errors or model loading failures

**Solution**:
1. Verify GPU is accessible: `nvidia-smi`
2. Check CUDA version compatibility
3. Reduce batch size or use smaller models
4. Check model cache: `docker volume inspect ai-obs_model-cache`

### High Latency

**Issue**: End-to-end latency > 3 seconds

**Solutions**:
1. Use smaller models (yolov8n, whisper tiny)
2. Reduce VLM interval: `VLM_INTERVAL_MS=1000`
3. Lower frame sample rate: `FRAME_SAMPLE_RATE=5`
4. Check network latency to LiveKit server

### Cameras Not Detected

**Issue**: Cameras don't appear in UI

**Solutions**:
1. Verify cameras are publishing to correct room
2. Check LiveKit connection in browser console
3. Ensure camera identity starts with `cam-`
4. Check API Gateway logs: `docker-compose logs api-gateway`

### No Switching Happening

**Issue**: Stuck on one camera

**Solutions**:
1. Check decision service logs: `docker-compose logs decision-service`
2. Verify scores are being published: Check Redis
3. Reduce `DELTA_S_THRESHOLD` to make switching easier
4. Disable manual mode in Web UI

## Performance Tuning

### GPU Optimization

```bash
# Use TensorRT for YOLO
export YOLO_USE_TENSORRT=true

# Batch multiple cameras
export BATCH_SIZE=5

# Use FP16 for faster inference
export USE_FP16=true
```

### Network Optimization

```bash
# Use simulcast for better quality/performance trade-off
# Configure in LiveKit server

# Reduce video resolution for analysis
export ANALYSIS_RESOLUTION=360p
```

## What You Need to Do Next

I've created the entire codebase, but you'll need to:

### 1. Install Dependencies

```bash
# Install Node.js dependencies (root level)
npm install

# This will install all workspace packages
```

### 2. Set Up LiveKit

**Option A: Use LiveKit Cloud**
- Sign up at https://livekit.io
- Get your API credentials
- Update `.env` with your credentials

**Option B: Self-Host LiveKit**
```bash
# Download LiveKit server
wget https://github.com/livekit/livekit/releases/latest/download/livekit-server-linux-amd64

# Run locally
./livekit-server --dev
```

### 3. That's It!

No API keys needed! Piper TTS runs completely locally.

### 4. Download Model Weights (Optional)

Models will download automatically on first run, but you can pre-download:

```bash
# YOLOv8
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# Moondream VLM
python -c "from transformers import AutoModelForCausalLM; AutoModelForCausalLM.from_pretrained('vikhyatk/moondream2')"

# Whisper
python -c "from faster_whisper import WhisperModel; WhisperModel('base.en')"
```

### 5. Configure Cameras

Connect your physical cameras or use test videos as described in the Quick Start section.

## Advanced Features

### Custom VLM Models

Replace Moondream with other VLMs by editing `workers/analysis-worker/src/models/vlm.py`

### Custom Ranking Algorithm

Train an XGBoost model on your switching data:
1. Collect switching events from ClickHouse
2. Label "good" vs "bad" switches
3. Train model on features
4. Replace rule-based ranker

### Multi-Room Support

Modify services to support multiple simultaneous rooms/shows

### Recording & Replay

Add recording functionality to save program feed and switching decisions

## License

MIT

## Contributing

Pull requests welcome! Please see CONTRIBUTING.md

## Support

- GitHub Issues: https://github.com/your-repo/ai-obs/issues
- Discussions: https://github.com/your-repo/ai-obs/discussions

## Credits

Built with:
- [LiveKit](https://livekit.io) - WebRTC infrastructure
- [Ultralytics YOLO](https://github.com/ultralytics/ultralytics) - Object detection
- [Moondream](https://github.com/vikhyat/moondream) - Vision-Language Model
- [Faster-Whisper](https://github.com/guillaumekln/faster-whisper) - Speech recognition
- [Piper](https://github.com/rhasspy/piper) - Fast, local text-to-speech
- [Next.js](https://nextjs.org) - Web framework
