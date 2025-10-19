# 🚀 Flask API Setup Guide

## Quick Start (3 Steps)

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Add Your Model File
Place `workout_weight_predictor.pkl` in the project root directory.

### 3. Start the Servers

**Terminal 1 - Start ML API:**
```bash
python ml_api.py
```

**Terminal 2 - Start React App:**
```bash
npm run dev
```

## 🧪 Testing the Integration

### Test 1: Check ML API Health
```bash
curl http://localhost:5000/health
```
Should return: `{"status": "healthy", "model_loaded": true}`

### Test 2: Test ML Prediction
```bash
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "movement_type": "olympic",
    "total_reps": 45,
    "largest_single_set": 21,
    "time_cap_seconds": 600,
    "time_domain": "5:00 - 10:00",
    "format": "For Time",
    "total_weighted_movements": 1,
    "has_other_barbell": 0,
    "competition_level": "Open"
  }'
```

### Test 3: Use in React App
1. Open http://localhost:5173
2. Check "Use ML-Enhanced Weight Prediction"
3. Click "Generate Test Workouts"
4. Check browser console for ML prediction logs

## 🔧 API Endpoints

- `GET /health` - Check API and model status
- `POST /predict` - Predict weights for single workout
- `POST /predict/batch` - Predict weights for multiple workouts
- `GET /model/info` - Get model information
- `POST /model/reload` - Reload the model

## 🎯 For Training Blocks Integration

The Flask API is perfect for larger apps because:

### **Batch Processing**
```javascript
// Send multiple workouts at once
const response = await fetch('http://localhost:5000/predict/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workouts: [
      { movement_type: 'olympic', total_reps: 45, ... },
      { movement_type: 'squat', total_reps: 30, ... },
      { movement_type: 'strength', total_reps: 20, ... }
    ]
  })
});
```

### **Microservice Architecture**
- Runs independently on any port
- Can serve multiple frontend apps
- Easy to deploy to cloud platforms
- Supports horizontal scaling

### **Production Ready**
- Built-in error handling
- Health checks and monitoring
- CORS enabled for web integration
- Logging and debugging support

## 🚨 Troubleshooting

### Model Not Loading
- Check file path: `workout_weight_predictor.pkl`
- Verify Python dependencies: `pip install -r requirements.txt`
- Check API logs for error messages

### API Connection Failed
- Ensure Flask API is running on port 5000
- Check firewall settings
- Verify CORS is enabled

### Fallback Predictions
- If ML fails, the system automatically uses heuristic predictions
- Check browser console for fallback warnings
- ML predictions will resume when API is available

## 🔄 Development Workflow

1. **Start ML API**: `python ml_api.py`
2. **Start React App**: `npm run dev`
3. **Test Integration**: Use the checkbox in the UI
4. **Monitor Logs**: Check both terminal outputs
5. **Update Model**: Use `/model/reload` endpoint

The Flask API approach scales perfectly for your larger training block application!


