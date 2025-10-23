#!/bin/bash

# AI-Native Cloud OBS - Stop Script
# This script stops all running services

echo "🛑 Stopping AI-Native Cloud OBS..."

# Stop backend Docker services
echo "Stopping backend services..."
cd backend
docker-compose down

# Kill any running frontend processes
echo "Stopping frontend processes..."
pkill -f "next dev" 2>/dev/null || true

echo "✅ All services stopped."
echo ""
echo "To start again, run: ./start.sh"
