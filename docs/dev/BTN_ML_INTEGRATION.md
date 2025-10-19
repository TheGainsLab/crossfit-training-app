# ML-Enhanced Workout Generator

This project now includes machine learning integration for more accurate weight predictions in CrossFit workouts.

## ML Model Integration

### What the ML Model Does
The trained model predicts appropriate weights for exercises based on:
- **Movement Type**: Olympic lifts, squats, strength movements, etc.
- **Rep Schemes**: Total reps and largest single set
- **Time Domain**: Workout duration ranges
- **Format**: For Time, AMRAP, Rounds For Time, Ladder
- **Competition Level**: Open, Quarterfinals, Semifinals

### Model Performance
- **Male Model**: R² = 0.673, MAE = 36.7 lbs
- **Female Model**: R² = 0.655, MAE = 25.2 lbs
- **Key Features**: Movement type (54.5%), largest single set (18.2%), competition level (6.5%)

## Setup Instructions

### 1. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. Add Your Model File
Place your `workout_weight_predictor.pkl` file in the project root directory.

### 3. Test the Model
```bash
python ml_predictor.py workout_weight_predictor.pkl
```

### 4. Use in the App
1. Check the "Use ML-Enhanced Weight Prediction" checkbox
2. Click "Generate Test Workouts"
3. The app will use ML predictions for more accurate weights

## How It Works

### Feature Extraction
The system extracts these features from each workout:
1. **movement_type**: Categorized exercise type
2. **total_reps**: Sum of all repetitions
3. **largest_single_set**: Biggest unbroken set
4. **time_cap_seconds**: Workout time limit
5. **time_domain**: Duration range category
6. **format**: Workout format type
7. **total_weighted_movements**: Count of weighted exercises
8. **has_other_barbell**: Whether multiple barbell exercises exist
9. **competition_level**: Competition tier

### Prediction Process
1. Generate workout using existing logic
2. Extract features from the workout
3. Feed features to ML model
4. Get male/female weight predictions
5. Apply predictions to weighted exercises

### Fallback System
If the ML model fails to load or predict:
- Uses heuristic-based weight prediction
- Maintains workout generation functionality
- Logs errors for debugging

## Integration Architecture

```
React App (TypeScript)
    ↓
ML Predictor Module (TypeScript)
    ↓
Python ML Script (Python)
    ↓
Pickle Model File
```

The TypeScript ML predictor module provides a clean interface while the Python script handles the actual model loading and prediction.

## Benefits

1. **More Accurate Weights**: Based on real CrossFit competition data
2. **Context-Aware**: Considers workout characteristics
3. **Competition-Level Appropriate**: Adjusts for Open vs Semifinals
4. **Fallback Safe**: Gracefully handles model failures
5. **Easy Integration**: Simple checkbox toggle in UI

## Future Enhancements

- Real-time model updates
- User-specific weight adjustments
- Exercise difficulty scoring
- Workout complexity prediction
- Performance time estimation


