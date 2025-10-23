#!/bin/bash

echo "AI-OBS System Health Check"
echo "=========================="
echo ""

check_service() {
  local name=$1
  local url=$2

  if curl -sf "$url" > /dev/null 2>&1; then
    echo "✓ $name"
  else
    echo "✗ $name (not responding)"
  fi
}

# Check services
check_service "LiveKit Server    " "http://localhost:7880"
check_service "API Gateway       " "http://localhost:3000/health"
check_service "Decision Service  " "http://localhost:3001/health"
check_service "TTS Orchestrator  " "http://localhost:3002/health"
check_service "Piper TTS         " "http://localhost:5000/health"
check_service "Web UI            " "http://localhost:3100"
check_service "Prometheus        " "http://localhost:9090/-/healthy"

echo ""
echo "Docker Containers:"
docker-compose ps --format "table {{.Service}}\t{{.Status}}"

echo ""
echo "LiveKit Participants:"
# This requires livekit-cli, skip if not installed
if command -v livekit-cli &> /dev/null; then
  livekit-cli list-participants --url ws://localhost:7880 \
    --api-key devkey --api-secret secret --room main 2>/dev/null || echo "No room active yet"
else
  echo "(Install livekit-cli to see participants)"
fi
