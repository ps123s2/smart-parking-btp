#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Change to the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "🚗 Starting Smart Parking AI System"
echo "=========================================="

# Trap SIGINT and SIGTERM to kill background jobs when exiting
cleanup() {
    echo ""
    echo "🛑 Shutting down backend and frontend..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Activate Python virtual environment
if [ -d ".venv" ]; then
    echo "📦 Activating Python virtual environment (.venv)..."
    source .venv/bin/activate
else
    echo "⚠️ Warning: .venv directory not found. Using system python."
fi

# 2. Start Backend (runs Flask API on port 5000 + Firebase feeder)
echo "🚀 Starting Backend (server.py) on http://localhost:5000..."
python server.py &
BACKEND_PID=$!

# Allow backend 2 seconds to initialize
sleep 2

# 3. Start Frontend (Expo)
echo "📱 Starting Frontend (Expo)..."
cd "$PROJECT_ROOT/smart-parking-app"

# Start Expo in the foreground so you can scan QR code or press w/a/i
npx expo start

