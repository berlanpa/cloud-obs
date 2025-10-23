# 🚀 Quick Start - Local AI (CPU-Only, No API Keys!)

## ✅ What Changed

**You now have 100% local AI processing - no OpenAI API needed!**

- ✅ Uses YOLO11 for object detection
- ✅ Uses LLaVA for scene understanding
- ✅ Uses Whisper for speech recognition
- ✅ ByteTrack for object tracking
- ✅ Runs on CPU (no GPU required!)
- ✅ **Zero ongoing costs**

## 📦 First-Time Setup (One Time Only)

### 1. Start the System

```bash
cd /Users/nadavshanun/Downloads/AI-OBS

# Build and start all services
docker-compose build
docker-compose up -d
```

**⏱ First Run Note:**
- The analysis worker will download AI models (~10GB total)
- This happens automatically on first start
- Takes 10-20 minutes depending on your internet
- Models are cached - future starts are instant!

### 2. Monitor the Download Progress

```bash
# Watch the logs
docker-compose logs -f analysis-worker
```

You'll see:
```
Downloading YOLO11 model...
Downloading LLaVA model (7GB)...
Downloading Whisper model...
✓ All models loaded successfully!
```

### 3. Access the Web UI

Once models are loaded, open:
```
http://localhost:3101
```

## 📱 Connect Your Phone as a Camera

### Option 1: Simple URL

On your phone, go to:
```
http://YOUR_MAC_IP:3000/camera.html?id=cam-1
```

Replace `YOUR_MAC_IP` with your Mac's local IP:
```bash
# Find your Mac's IP address
ifconfig | grep "inet " | grep -v 127.0.0.1
```

### Option 2: QR Code (Coming Next!)

We're adding a QR code generator in Phase 2 - just scan and go!

## 🎥 Camera IDs

- `?id=cam-1` - Camera 1
- `?id=cam-2` - Camera 2
- `?id=cam-3` - Camera 3
- `?id=cam-4` - Camera 4
- `?id=cam-5` - Camera 5

Use different devices (phones, laptops) for each camera.

## ⚙️ Performance on CPU

| Component | Latency (CPU) | Latency (GPU) |
|-----------|---------------|---------------|
| YOLO11 | ~200-300ms | ~5-10ms |
| LLaVA | ~2-3s | ~600ms |
| Whisper | ~500ms | ~100ms |
| **Total** | ~3-4s | ~1.5s |

**CPU is fine for 5 cameras!** The system is designed to work well even with slower inference.

## 🛠 Troubleshooting

### Models Won't Download

```bash
# Check internet connection
ping huggingface.co

# Restart analysis worker
docker-compose restart analysis-worker
```

### Out of Memory

If you have <16GB RAM, use smaller models:

Edit `.env`:
```bash
WHISPER_MODEL=tiny.en  # Instead of base.en
VLM_LOAD_4BIT=true     # Already enabled
```

### Container Won't Start

```bash
# View logs
docker-compose logs analysis-worker

# Rebuild if needed
docker-compose build --no-cache analysis-worker
docker-compose up -d
```

## 🎉 You're Ready!

Once the analysis worker logs show:
```
✓ All models loaded successfully!
✓ Connected to Redis
✓ Connected to LiveKit
✓ Starting analysis loop
```

**Your AI auto-director is running!** 🎬

---

## Next: Phase 2 - Easy Phone Camera Setup

We're adding:
- ✅ QR code generator in the web UI
- ✅ Improved camera.html with flip camera button
- ✅ Camera preview in main UI

Stay tuned! 🚀
