# AI-Native Cloud OBS - Integrated System

A complete AI-powered auto-director system that intelligently switches between camera feeds using YOLO object detection, Vision-Language Models (VLM), Whisper ASR, and generates live narration via Piper TTS.

## 🏗️ Architecture

This integrated system consists of:

- **Frontend** (`/frontend`): Next.js React application with LiveKit integration
- **Backend** (`/backend`): AI-powered auto-director with multiple microservices

### Frontend Structure
- **Dashboard Tab**: Real-time monitoring of AI analysis and switching decisions
- **Live Tab**: Live output display with AI-directed camera switching
- **View Tab**: Current LiveKit video conference interface

### Backend Services
- **API Gateway** (Port 3000): REST API & WebSocket for UI
- **Decision Service** (Port 3001): Switching logic & decision engine
- **TTS Orchestrator** (Port 3002): Narration & Piper TTS integration
- **Program Producer** (Port 3003): Program feed management
- **Analysis Worker**: YOLO + VLM + Whisper processing
- **Redis**: Pub/sub messaging
- **PostgreSQL**: Configuration storage
- **ClickHouse**: Telemetry & analytics

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- pnpm (will be installed automatically)
- NVIDIA GPU (optional, for AI processing)

### 1. Start the System

```bash
# Make the startup script executable and run it
chmod +x start.sh
./start.sh
```

This will:
1. Install all dependencies
2. Start backend services with Docker
3. Start frontend development server
4. Open the application at http://localhost:3001

### 2. Access the Application

- **Main Application**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **Camera App**: http://localhost:3000/camera
- **Monitoring**: http://localhost:9090 (Prometheus)

## 📱 Using the Application

### Dashboard Tab
- Real-time camera scores and AI analysis
- System configuration and status
- Recent switching decisions
- Live narration feed

### Live Tab
- Live program output display
- AI-directed camera switching
- Current top camera scores
- Auto/Manual mode toggle

### View Tab
- Traditional LiveKit video conference interface
- Camera controls and settings
- Participant management

## 🎥 Connecting Cameras

### Option 1: Use the Camera App
1. Open http://localhost:3000/camera on your phone/device
2. Allow camera access
3. The camera will automatically connect to the system

### Option 2: Use OBS Studio
1. Install OBS with LiveKit plugin
2. Get a camera token: `POST http://localhost:3000/token`
3. Configure OBS to publish to LiveKit

### Option 3: Use LiveKit CLI
```bash
# Install LiveKit CLI
npm install -g @livekit/cli

# Publish test video
livekit-cli publish \
  --url ws://localhost:7880 \
  --api-key devkey \
  --api-secret secret \
  --identity cam-1 \
  --room main \
  --video path/to/video.mp4
```

## ⚙️ Configuration

### Backend Configuration
Edit `backend/.env` to adjust:
- AI model settings (YOLO, VLM, Whisper)
- Switching policy parameters
- Camera configuration
- Database connections

### Frontend Configuration
The frontend automatically connects to the backend at `http://localhost:3000`.

## 🔧 Development

### Running Individual Services

**Backend Services:**
```bash
cd backend
docker-compose up -d  # Start all services
docker-compose logs -f  # View logs
```

**Frontend Development:**
```bash
cd frontend
pnpm dev
```

**Individual Backend Service:**
```bash
cd backend/services/api-gateway
pnpm install
pnpm dev
```

### Project Structure
```
live/
├── frontend/                 # Next.js React application
│   ├── app/
│   │   ├── main/            # Main application with tabs
│   │   └── custom/          # LiveKit video conference
│   ├── lib/
│   │   ├── Dashboard.tsx    # Dashboard tab component
│   │   ├── Live.tsx         # Live tab component
│   │   ├── backend-api.ts   # Backend API client
│   │   └── backend-types.ts # TypeScript types
│   └── package.json
├── backend/                  # AI-powered backend services
│   ├── services/            # Microservices
│   ├── workers/             # AI analysis workers
│   ├── shared/              # Shared types
│   └── docker-compose.yml
└── start.sh                 # Integrated startup script
```

## 🎯 Features

### AI-Powered Analysis
- **YOLO Object Detection**: Real-time object and face detection
- **Vision-Language Model**: Scene understanding and captioning
- **Whisper ASR**: Speech recognition and keyword extraction
- **Intelligent Ranking**: Multi-factor camera scoring system

### Real-time Switching
- **Smart Decisions**: AI-driven camera switching based on multiple factors
- **Hysteresis Control**: Prevents rapid switching
- **Cooldown Management**: Prevents revisiting cameras too quickly
- **Manual Override**: Switch to manual mode when needed

### Live Narration
- **Context-Aware**: Generates commentary based on current scene
- **Piper TTS**: Fast, local text-to-speech synthesis
- **Safety Filters**: PII and profanity detection
- **Configurable Style**: Neutral, energetic, or calm narration

### Monitoring & Analytics
- **Real-time Metrics**: Camera scores, switching decisions, latency
- **Prometheus Integration**: Comprehensive metrics collection
- **Grafana Dashboards**: Visual analytics and monitoring
- **WebSocket Events**: Real-time updates to frontend

## 🐛 Troubleshooting

### Backend Not Starting
```bash
# Check Docker status
docker ps

# View backend logs
cd backend
docker-compose logs -f

# Restart services
docker-compose restart
```

### Frontend Connection Issues
- Ensure backend is running on port 3000
- Check browser console for errors
- Verify WebSocket connection in Network tab

### Camera Not Detected
- Check camera permissions
- Verify camera is publishing to correct room
- Check LiveKit connection status

### High Latency
- Use smaller AI models (yolov8n, whisper tiny)
- Reduce VLM interval in configuration
- Check GPU availability for AI processing

## 📊 Performance Tuning

### GPU Optimization
```bash
# Enable TensorRT for YOLO
export YOLO_USE_TENSORRT=true

# Use FP16 for faster inference
export USE_FP16=true
```

### Model Configuration
```bash
# Use smaller models for faster processing
YOLO_MODEL=yolov8n
WHISPER_MODEL=tiny
VLM_INTERVAL_MS=1000
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Credits

Built with:
- [LiveKit](https://livekit.io) - WebRTC infrastructure
- [Ultralytics YOLO](https://github.com/ultralytics/ultralytics) - Object detection
- [Moondream](https://github.com/vikhyat/moondream) - Vision-Language Model
- [Faster-Whisper](https://github.com/guillaumekln/faster-whisper) - Speech recognition
- [Piper](https://github.com/rhasspy/piper) - Text-to-speech
- [Next.js](https://nextjs.org) - Web framework

---

**Created by Pablo Berlanga Boemare** - AI-Native Cloud OBS Integration
