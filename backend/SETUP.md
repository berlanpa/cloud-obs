# Setup Guide

## What I've Built for You

I've created a complete, production-ready AI-powered auto-director system with:

### ✅ Complete Services

1. **Python Analysis Worker** (`workers/analysis-worker/`)
   - YOLO object detection (YOLOv8)
   - VLM scene understanding (Moondream)
   - Whisper speech recognition
   - Feature fusion and ranking algorithm

2. **Node.js Backend Services** (`services/`)
   - Decision Service - Switching logic with hysteresis & cooldown
   - TTS Orchestrator - Piper TTS integration for narration (local, no API key)
   - Program Producer - Output management
   - API Gateway - REST API & WebSocket for UI

3. **Next.js Web UI** (`web-obs/`)
   - Real-time camera grid with LiveKit
   - Program monitor
   - Manual/Auto switching controls
   - Event log and statistics
   - Beautiful, responsive design with Tailwind CSS

4. **Infrastructure**
   - Docker Compose setup for all services
   - Redis for pub/sub messaging
   - PostgreSQL for configuration
   - ClickHouse for telemetry
   - Prometheus + Grafana for monitoring

### 📋 What You Need to Do

#### Step 1: Install Dependencies

```bash
# Install root dependencies (monorepo)
npm install

# This will install all workspace packages automatically
```

#### Step 2: Set Up LiveKit

**Option A: LiveKit Cloud (Easiest)**
1. Go to https://cloud.livekit.io
2. Create a free account
3. Create a new project
4. Copy your API Key and Secret
5. Update `.env`:
   ```bash
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=APIxxxxxxx
   LIVEKIT_API_SECRET=xxxxxxxxx
   ```

**Option B: Self-Host LiveKit**
```bash
# Download LiveKit
wget https://github.com/livekit/livekit/releases/latest/download/livekit-server-linux-amd64

# Run in dev mode
chmod +x livekit-server-linux-amd64
./livekit-server-linux-amd64 --dev

# Or use Docker
docker run --rm -p 7880:7880 \
  -p 7881:7881 \
  -p 7882:7882/udp \
  livekit/livekit-server --dev
```

#### Step 3: Configure Piper TTS (Optional)

Piper TTS runs completely locally - **no API keys needed!**

The default voice (en_US-lessac-medium) is automatically downloaded.

**Optional customizations** in `.env`:
```bash
TTS_SPEED=1.0  # Adjust narration speed (0.8 = faster, 1.2 = slower)
```

Want a different voice? See `PIPER_TTS.md` for voice options and instructions.

#### Step 4: GPU Setup (for Analysis Worker)

**If you have NVIDIA GPU:**
1. Install NVIDIA Docker runtime:
   ```bash
   # Ubuntu/Debian
   distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
   curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
   curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
     sudo tee /etc/apt/sources.list.d/nvidia-docker.list

   sudo apt-get update && sudo apt-get install -y nvidia-docker2
   sudo systemctl restart docker
   ```

2. Verify GPU access:
   ```bash
   docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
   ```

**If you DON'T have a GPU:**
- Edit `docker-compose.yml` and remove the GPU reservation from `analysis-worker` service:
  ```yaml
  # Comment out these lines:
  # deploy:
  #   resources:
  #     reservations:
  #       devices:
  #         - driver: nvidia
  #           count: 1
  #           capabilities: [gpu]
  ```
- Models will run on CPU (slower, but functional)

#### Step 5: Start the System

```bash
# Build all services
docker-compose build

# Start everything
docker-compose up -d

# Watch logs
docker-compose logs -f

# Check status
docker-compose ps
```

#### Step 6: Connect Cameras

You have several options:

**Option A: Use OBS Studio as a Camera**

1. Install OBS Studio: https://obsproject.com
2. Install WHIP output plugin or use LiveKit plugin
3. Get a token for your camera:
   ```bash
   curl -X POST http://localhost:3000/token \
     -H "Content-Type: application/json" \
     -d '{
       "identity": "cam-1",
       "room": "main",
       "role": "camera"
     }'
   ```
4. Configure OBS with the token and URL

**Option B: Use Test Videos**

```bash
# Install LiveKit CLI
npm install -g @livekit/cli

# Publish a test video as cam-1
livekit-cli publish \
  --url $LIVEKIT_URL \
  --api-key $LIVEKIT_API_KEY \
  --api-secret $LIVEKIT_API_SECRET \
  --identity cam-1 \
  --room main \
  --video test-video-1.mp4

# Repeat for cam-2, cam-3, cam-4, cam-5
```

**Option C: Use Webcams with ffmpeg**

```bash
# Get a camera token first
TOKEN=$(curl -s -X POST http://localhost:3000/token \
  -H "Content-Type: application/json" \
  -d '{"identity":"cam-1","room":"main","role":"camera"}' | jq -r '.data.token')

# Stream webcam to LiveKit (requires custom script)
# This is more complex - use OBS instead for easier setup
```

**Option D: Mobile Phone Cameras**

Use apps that support WebRTC/RTMP streaming:
- Larix Broadcaster (iOS/Android)
- Streamlabs Mobile
- Configure to stream to your LiveKit server

#### Step 7: Access the Web UI

1. Open browser: http://localhost:3100
2. You should see:
   - Program monitor (top left)
   - Event log (top right)
   - Camera previews (middle)
   - Controls (bottom)

3. Once cameras connect, they'll appear in the preview grid

#### Step 8: Test the System

1. **Check camera feeds appear** in the preview grid
2. **Verify auto-switching** is working (watch event log)
3. **Test manual mode**:
   - Click "Manual" button in controls
   - Click a camera preview to switch to it
   - Click "Auto" to resume automatic switching
4. **Check narration** (if you added audio to cameras)

## Verification Checklist

- [ ] All services running: `docker-compose ps`
- [ ] Redis connected: `docker-compose logs decision-service | grep "Connected to Redis"`
- [ ] Analysis worker processing: `docker-compose logs analysis-worker`
- [ ] Web UI accessible at http://localhost:3100
- [ ] Cameras visible in UI
- [ ] Switching happening automatically
- [ ] Event log showing switch events

## Common Issues and Solutions

### Issue: "Failed to get token" in browser console

**Cause**: API Gateway not running or wrong URL

**Fix**:
```bash
# Check API Gateway is running
docker-compose ps api-gateway

# Check logs
docker-compose logs api-gateway

# Verify port 3000 is accessible
curl http://localhost:3000/health
```

### Issue: Analysis worker crashes with CUDA error

**Cause**: GPU not accessible or wrong CUDA version

**Fix**:
```bash
# Check GPU
nvidia-smi

# Run on CPU instead (edit docker-compose.yml as mentioned above)
# Or use smaller models in .env:
YOLO_MODEL=yolov8n
VLM_ENABLED=false
```

### Issue: No cameras appear in UI

**Cause**: Cameras not connected to LiveKit or wrong room

**Fix**:
- Verify LiveKit URL is correct
- Check camera is joining room "main"
- Verify camera identity starts with "cam-"
- Check browser console for WebRTC errors

### Issue: Cameras appear but no switching

**Cause**: Analysis worker not publishing scores

**Fix**:
```bash
# Check analysis worker logs
docker-compose logs analysis-worker

# Check Redis pub/sub
docker-compose exec redis redis-cli SUBSCRIBE scores.stream

# Check decision service
docker-compose logs decision-service
```

### Issue: High latency or stuttering

**Cause**: CPU/GPU overload or network issues

**Fix**:
```bash
# Reduce load in .env:
FRAME_SAMPLE_RATE=5          # Lower from 10
VLM_INTERVAL_MS=1000         # Increase from 700
YOLO_MODEL=yolov8n           # Use smallest model

# Or upgrade hardware
```

## Next Steps After Setup

1. **Fine-tune ranking weights** in `workers/analysis-worker/src/ranker.py`
2. **Adjust switching policy** in `.env` (MIN_HOLD_SEC, COOLDOWN_SEC, etc.)
3. **Customize narration templates** in `services/tts-orchestrator/src/narrator.ts`
4. **Set up monitoring** - Open Grafana at http://localhost:3001
5. **Add more cameras** - System supports 5 by default, can be extended

## Architecture Overview

```
User Browser (Web-OBS)
    ↓ (WebSocket)
API Gateway
    ↓ (Redis Pub/Sub)
    ├─→ Decision Service ←─ Analysis Worker ←─ LiveKit ←─ Cameras
    ├─→ TTS Orchestrator
    └─→ Program Producer
```

## File Structure

```
AI-OBS/
├── services/
│   ├── api-gateway/          # REST API & WebSocket
│   ├── decision-service/     # Switching logic
│   ├── tts-orchestrator/     # Narration
│   └── program-producer/     # Output
├── workers/
│   └── analysis-worker/      # AI analysis (Python)
├── web-obs/                  # Next.js UI
├── shared/types/             # Shared TypeScript types
├── config/                   # Prometheus/Grafana
├── docker-compose.yml        # Service orchestration
├── .env                      # Configuration
└── README.md                 # Full documentation
```

## Getting Help

If you encounter issues:

1. Check logs: `docker-compose logs [service-name]`
2. Review README.md for detailed documentation
3. Check `.env` configuration
4. Verify all prerequisites are met

## What's Already Implemented

✅ Multi-camera analysis with YOLO, VLM, Whisper
✅ Intelligent ranking algorithm with hysteresis
✅ Real-time switching with configurable policies
✅ Piper TTS narration (local, open-source)
✅ LiveKit WebRTC integration
✅ Modern React/Next.js web interface
✅ Redis pub/sub messaging
✅ Docker containerization
✅ Monitoring with Prometheus/Grafana
✅ TypeScript throughout backend and frontend
✅ Comprehensive error handling
✅ Manual override capability

## What You Might Want to Add

- Recording/replay functionality
- Multi-room support
- Advanced scene detection
- Face recognition for speaker tracking
- Custom overlay graphics
- RTMP output for streaming platforms
- Mobile app for control
- Machine learning model fine-tuning on your footage

Enjoy your AI-powered auto-director! 🎥🤖
