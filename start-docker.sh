#!/bin/bash

echo "========================================"
echo "  Voice AI Platform - Docker Startup"
echo "========================================"
echo ""

# Check if Docker is running
if ! docker --version &> /dev/null; then
    echo "[ERROR] Docker is not running!"
    echo "Please start Docker and try again."
    exit 1
fi

echo "[OK] Docker is running"
echo ""

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo "[WARNING] backend/.env file not found!"
    echo ""
    echo "Creating from template..."
    cp .env.example backend/.env
    echo ""
    echo "[ACTION REQUIRED] Please edit backend/.env with your API keys:"
    echo "- GEMINI_API_KEY"
    echo "- DEEPGRAM_API_KEY"
    echo "- ELEVENLABS_API_KEY"
    echo ""
    echo "Then run this script again."
    exit 0
fi

echo "[OK] Environment file found"
echo ""

echo "Starting services..."
echo "This may take 2-3 minutes on first run (downloading images)"
echo ""

docker-compose up -d

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Failed to start services!"
    echo "Run: docker-compose logs"
    exit 1
fi

echo ""
echo "========================================"
echo "  Services Starting..."
echo "========================================"
echo ""
echo "Waiting for services to be healthy (30 seconds)..."
sleep 30

echo ""
echo "Checking service health..."
docker-compose ps

echo ""
echo "========================================"
echo "  Access Your Application"
echo "========================================"
echo ""
echo "Frontend:  http://localhost:3000"
echo "Backend:   http://localhost:5000"
echo "MongoDB:   localhost:27017"
echo "ChromaDB:  http://localhost:8000"
echo ""
echo "To view logs:    docker-compose logs -f"
echo "To stop:         docker-compose down"
echo ""
echo "========================================"
