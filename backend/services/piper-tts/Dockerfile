FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY services/piper-tts/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create models directory
RUN mkdir -p /app/models

# Download Piper voice model files
RUN echo "Downloading Piper en_US-lessac-medium voice model..." && \
    wget -q https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx \
         -O /app/models/en_US-lessac-medium.onnx && \
    wget -q https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json \
         -O /app/models/en_US-lessac-medium.onnx.json && \
    echo "✓ Voice model downloaded successfully"

# Copy application
COPY services/piper-tts/src ./src

EXPOSE 5001

CMD ["python", "src/main.py"]
