#!/bin/bash

# CrossFit Workout Predictor - ML Integration Startup Script

echo "🚀 Starting CrossFit Workout Predictor with ML Integration"
echo "=========================================================="

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if model file exists
if [ ! -f "workout_weight_predictor.pkl" ]; then
    echo "⚠️  Warning: workout_weight_predictor.pkl not found"
    echo "   The ML API will use fallback predictions"
    echo "   Place your trained model file in the project root to enable ML predictions"
fi

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip3 install -r requirements.txt

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Start Flask API in background
echo "🐍 Starting ML API server..."
python3 ml_api.py &
ML_API_PID=$!

# Wait a moment for the API to start
sleep 3

# Check if ML API is running
if curl -s http://localhost:5000/health > /dev/null; then
    echo "✅ ML API server started successfully"
else
    echo "⚠️  ML API server may not be running properly"
fi

# Start React development server
echo "⚛️  Starting React development server..."
npm run dev &
REACT_PID=$!

echo ""
echo "🎉 Both servers are starting up!"
echo ""
echo "📊 ML API: http://localhost:5000"
echo "   - Health check: http://localhost:5000/health"
echo "   - Model info: http://localhost:5000/model/info"
echo ""
echo "🌐 React App: http://localhost:5173"
echo ""
echo "💡 Tips:"
echo "   - Check 'Use ML-Enhanced Weight Prediction' in the app"
echo "   - Place your workout_weight_predictor.pkl file in the project root"
echo "   - Check the browser console for ML prediction logs"
echo ""
echo "🛑 To stop both servers: Ctrl+C"

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $ML_API_PID 2>/dev/null
    kill $REACT_PID 2>/dev/null
    echo "✅ Servers stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait


