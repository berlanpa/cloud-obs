#!/bin/bash

# AI-Native Cloud OBS - Integrated Startup Script
# This script starts both the backend and frontend services

echo "🚀 Starting AI-Native Cloud OBS..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Installing pnpm..."
    npm install -g pnpm
fi

echo "📦 Installing dependencies..."

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
if [ ! -d "node_modules" ]; then
    pnpm install
fi

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    pnpm install
fi

echo "🐳 Starting backend services with Docker..."
cd ../backend

# Start backend services
docker-compose up -d

echo "⏳ Waiting for backend services to start..."
sleep 10

echo "🌐 Starting frontend development server..."
cd ../frontend

# Start frontend in background
pnpm dev &

# Get the PID of the frontend process
FRONTEND_PID=$!

echo ""
echo "✅ AI-Native Cloud OBS is starting up!"
echo ""
echo "📊 Backend Services:"
echo "   - API Gateway: http://localhost:3000"
echo "   - Web-OBS UI: http://localhost:3100"
echo "   - Prometheus: http://localhost:9090"
echo "   - Grafana: http://localhost:3001"
echo ""
echo "🎥 Frontend Application:"
echo "   - Main App: http://localhost:3001"
echo ""
echo "📱 Camera Connection:"
echo "   - Camera App: http://localhost:3000/camera"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $FRONTEND_PID 2>/dev/null
    cd ../backend
    docker-compose down
    echo "✅ All services stopped."
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for frontend process
wait $FRONTEND_PID
