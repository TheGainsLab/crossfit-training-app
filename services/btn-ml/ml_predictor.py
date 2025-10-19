# Python script to serve ML predictions
# This script loads your trained model and provides a simple API

import pickle
import json
import sys
from typing import Dict, Any, Tuple

class WorkoutWeightPredictor:
    def __init__(self, model_path: str):
        """Load the trained model from pickle file"""
        try:
            with open(model_path, 'rb') as f:
                self.model_data = pickle.load(f)
            print(f"✓ Model loaded from {model_path}")
        except Exception as e:
            print(f"❌ Error loading model: {e}")
            self.model_data = None
    
    def predict_weights(self, features: Dict[str, Any]) -> Tuple[float, float]:
        """Predict male and female weights based on workout features"""
        if not self.model_data:
            # Fallback to heuristic if model not loaded
            return self._fallback_prediction(features)
        
        try:
            # Extract features in the same order as training
            feature_vector = self._extract_feature_vector(features)
            
            # Make predictions (assuming your model has separate male/female models)
            male_pred = self.model_data['male_model'].predict([feature_vector])[0]
            female_pred = self.model_data['female_model'].predict([feature_vector])[0]
            
            return float(male_pred), float(female_pred)
        except Exception as e:
            print(f"❌ Prediction error: {e}")
            return self._fallback_prediction(features)
    
    def _extract_feature_vector(self, features: Dict[str, Any]) -> list:
        """Convert features to the format expected by the model"""
        # Map movement types to numbers
        movement_map = {
            'olympic': 0, 'squat': 1, 'strength': 2, 
            'dumbbell': 3, 'pressing': 4, 'other': 5
        }
        
        # Map competition levels to numbers
        comp_map = {'Open': 0, 'Quarterfinals': 1, 'Semifinals': 2}
        
        # Map time domains to numbers
        time_map = {
            '1:00 - 5:00': 0, '5:00 - 10:00': 1, '10:00 - 15:00': 2,
            '15:00 - 20:00': 3, '20:00+': 4
        }
        
        # Map formats to numbers
        format_map = {'For Time': 0, 'AMRAP': 1, 'Rounds For Time': 2, 'Ladder': 3}
        
        return [
            movement_map.get(features.get('movement_type', 'other'), 5),
            features.get('total_reps', 0),
            features.get('largest_single_set', 0),
            features.get('time_cap_seconds', 600),
            time_map.get(features.get('time_domain', '5:00 - 10:00'), 1),
            format_map.get(features.get('format', 'For Time'), 0),
            features.get('total_weighted_movements', 1),
            features.get('has_other_barbell', 0),
            comp_map.get(features.get('competition_level', 'Open'), 0)
        ]
    
    def _fallback_prediction(self, features: Dict[str, Any]) -> Tuple[float, float]:
        """Fallback prediction using simple heuristics"""
        movement_type = features.get('movement_type', 'other')
        total_reps = features.get('total_reps', 25)
        
        # Base weights by movement type
        base_weights = {
            'olympic': (135, 95),
            'squat': (115, 75),
            'strength': (185, 125),
            'dumbbell': (50, 35),
            'pressing': (95, 65),
            'other': (100, 70)
        }
        
        male_base, female_base = base_weights.get(movement_type, (100, 70))
        
        # Adjust for rep count
        if total_reps > 100:
            multiplier = 0.7
        elif total_reps > 50:
            multiplier = 0.8
        elif total_reps > 25:
            multiplier = 0.9
        else:
            multiplier = 1.0
        
        return male_base * multiplier, female_base * multiplier

def main():
    """Simple command-line interface for testing"""
    if len(sys.argv) < 2:
        print("Usage: python ml_predictor.py <model_path>")
        sys.exit(1)
    
    model_path = sys.argv[1]
    predictor = WorkoutWeightPredictor(model_path)
    
    # Example usage
    example_features = {
        'movement_type': 'olympic',
        'total_reps': 45,
        'largest_single_set': 21,
        'time_cap_seconds': 600,
        'time_domain': '5:00 - 10:00',
        'format': 'For Time',
        'total_weighted_movements': 1,
        'has_other_barbell': 0,
        'competition_level': 'Open'
    }
    
    male_weight, female_weight = predictor.predict_weights(example_features)
    print(f"Predicted weights: {male_weight:.0f}/{female_weight:.0f} lbs")

if __name__ == "__main__":
    main()


