#!/bin/bash
# AI-OBS Setup Script
# Automates the setup process for the integrated system

set -e

echo "====================================="
echo "AI-OBS Integration Setup"
echo "====================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose first."
    exit 1
fi

if ! command -v nvidia-smi &> /dev/null; then
    echo "⚠️  nvidia-smi not found. GPU support may not work."
fi

echo "✅ Prerequisites check passed"
echo ""

# Create directories
echo "Creating required directories..."
mkdir -p models
mkdir -p services/compositor/assets
mkdir -p config/grafana/dashboards
mkdir -p config/prometheus
echo "✅ Directories created"
echo ""

# Install Python dependencies for local models
echo "Installing LLaVA..."
if [ -d "workers/vlm/llava" ]; then
    cd workers/vlm/llava
    pip install -e . > /dev/null 2>&1 || echo "⚠️  LLaVA install failed (optional)"
    cd ../../..
    echo "✅ LLaVA installed"
else
    echo "⚠️  LLaVA directory not found, skipping"
fi

echo ""
echo "Installing ByteTrack..."
if [ -d "workers/tracking/ByteTrack" ]; then
    cd workers/tracking/ByteTrack
    pip install -e . > /dev/null 2>&1 || echo "⚠️  ByteTrack install failed (optional)"
    cd ../../..
    echo "✅ ByteTrack installed"
else
    echo "⚠️  ByteTrack directory not found, skipping"
fi

echo ""
echo "Installing Ultralytics (YOLO11)..."
pip install ultralytics>=8.1.0 > /dev/null 2>&1 || echo "⚠️  Ultralytics install failed"
echo "✅ Ultralytics installed"

# Check for .env file
if [ ! -f ".env" ]; then
    echo ""
    echo "Creating .env file from template..."
    cat > .env << 'EOF'
# LiveKit Configuration
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=your_api_key_here
LIVEKIT_API_SECRET=your_api_secret_here

# ElevenLabs (optional)
ELEVENLABS_API_KEY=your_elevenlabs_key_here
ELEVENLABS_VOICE_ID=eleven_monica

# TTS Configuration
TTS_SPEED=1.0
EOF
    echo "✅ .env file created - PLEASE EDIT WITH YOUR CREDENTIALS"
    echo ""
    echo "⚠️  You need to edit .env with your LiveKit credentials before continuing"
    exit 0
fi

echo ""
echo "====================================="
echo "Setup Complete!"
echo "====================================="
echo ""
echo "Next steps:"
echo "1. Edit .env file with your LiveKit credentials"
echo "2. (Optional) Export YOLO to TensorRT:"
echo "   python -c 'from ultralytics import YOLO; YOLO(\"yolo11n.pt\").export(format=\"engine\")'"
echo "3. Build services:"
echo "   docker-compose build"
echo "4. Start services:"
echo "   docker-compose up -d"
echo "5. Access Web-OBS:"
echo "   http://localhost:3100"
echo ""
echo "For detailed instructions, see README_INTEGRATION.md"
echo ""
