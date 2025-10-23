# CPU-only base image (works on Mac/Linux/Windows without GPU)
FROM ubuntu:22.04

# Install Python and system dependencies
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3-pip \
    ffmpeg \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    git \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python packages
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Pre-download AI models (optional - can download at runtime instead)
# Uncomment these lines to pre-cache models in Docker image:
# RUN python3 -c "from ultralytics import YOLO; YOLO('yolo11n.pt')"
# RUN python3 -c "from faster_whisper import WhisperModel; WhisperModel('base.en')"
# Note: LLaVA (7GB) downloads on first run - too large to pre-cache

# Use enhanced worker with local AI models (no OpenAI API needed!)
CMD ["python3", "src/main_enhanced.py"]
