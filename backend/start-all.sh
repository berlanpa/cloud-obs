#!/bin/bash

echo "Starting AI-OBS System..."

# Pull latest images
docker-compose pull

# Build local services
docker-compose build

# Start infrastructure first
echo "Starting infrastructure (Redis, Postgres, ClickHouse, LiveKit)..."
docker-compose up -d redis postgres clickhouse livekit-server

# Wait for infrastructure
echo "Waiting for services to be ready..."
sleep 10

# Start AI services
echo "Starting AI analysis worker..."
docker-compose up -d analysis-worker

sleep 5

# Start decision pipeline
echo "Starting decision pipeline..."
docker-compose up -d decision-service tts-orchestrator piper-tts

sleep 3

# Start frontend
echo "Starting API gateway and Web UI..."
docker-compose up -d api-gateway web-obs

echo ""
echo "✓ All services started!"
echo ""
echo "Access points:"
echo "  - Web UI:        http://localhost:3100"
echo "  - Camera App:    http://YOUR_IP:3000/camera?id=cam-1"
echo "  - API Gateway:   http://localhost:3000"
echo "  - LiveKit:       http://localhost:7880"
echo ""
echo "Connect cameras by opening camera app on phones:"
echo "  Phone 1: http://YOUR_IP:3000/camera?id=cam-1"
echo "  Phone 2: http://YOUR_IP:3000/camera?id=cam-2"
echo "  Phone 3: http://YOUR_IP:3000/camera?id=cam-3"
echo "  Phone 4: http://YOUR_IP:3000/camera?id=cam-4"
echo "  Phone 5: http://YOUR_IP:3000/camera?id=cam-5"
echo ""
echo "View logs: docker-compose logs -f"
