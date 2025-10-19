from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import json
import os
from typing import Dict, Any, List, Tuple
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend integration

class WorkoutWeightPredictor:
    def __init__(self, model_path: str):
        """Load the trained model from pickle file"""
        self.model_path = model_path
        self.model_data = None
        self.load_model()
    
    def load_model(self):
        """Load or reload the model"""
        try:
            if os.path.exists(self.model_path):
                with open(self.model_path, 'rb') as f:
                    self.model_data = pickle.load(f)
                logger.info(f"✓ Model loaded from {self.model_path}")
            else:
                logger.warning(f"Model file not found: {self.model_path}")
                self.model_data = None
        except Exception as e:
            logger.error(f"❌ Error loading model: {e}")
            self.model_data = None
    
    def predict_weights(self, features: Dict[str, Any]) -> Tuple[float, float]:
        """Predict male and female weights based on workout features"""
        if not self.model_data:
            logger.warning("Model not loaded, using fallback prediction")
            return self._fallback_prediction(features)
        
        try:
            # Extract features in the same order as training
            feature_vector = self._extract_feature_vector(features)
            
            # Handle different model structures
            if isinstance(self.model_data, dict):
                # If model_data is a dictionary with separate models
                if 'male_model' in self.model_data and 'female_model' in self.model_data:
                    male_pred = self.model_data['male_model'].predict([feature_vector])[0]
                    female_pred = self.model_data['female_model'].predict([feature_vector])[0]
                else:
                    # If it's a single model, use it for both predictions
                    pred = self.model_data.predict([feature_vector])[0]
                    male_pred = pred
                    female_pred = pred * 0.7  # Rough female scaling
            else:
                # If model_data is a single model object
                pred = self.model_data.predict([feature_vector])[0]
                male_pred = pred
                female_pred = pred * 0.7  # Rough female scaling
            
            return float(male_pred), float(female_pred)
        except Exception as e:
            logger.error(f"❌ Prediction error: {e}")
            return self._fallback_prediction(features)
    
    def predict(self, features: Dict[str, Any]) -> Tuple[float, float]:
        """Alias for predict_weights for backward compatibility"""
        return self.predict_weights(features)
    
    def _extract_feature_vector(self, features: Dict[str, Any]) -> List[float]:
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

# Initialize predictor
MODEL_PATH = os.getenv('MODEL_PATH', 'workout_weight_predictor.pkl')
predictor = WorkoutWeightPredictor(MODEL_PATH)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': predictor.model_data is not None,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/predict', methods=['POST'])
def predict_single():
    """Predict weights for a single workout"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['movement_type', 'total_reps', 'largest_single_set']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Make prediction
        male_weight, female_weight = predictor.predict_weights(data)
        
        return jsonify({
            'male_weight': round(male_weight),
            'female_weight': round(female_weight),
            'model_used': predictor.model_data is not None,
            'features': data
        })
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """Predict weights for multiple workouts (for training blocks)"""
    try:
        data = request.get_json()
        
        if not data or 'workouts' not in data:
            return jsonify({'error': 'No workouts array provided'}), 400
        
        workouts = data['workouts']
        if not isinstance(workouts, list):
            return jsonify({'error': 'Workouts must be an array'}), 400
        
        results = []
        for i, workout in enumerate(workouts):
            try:
                male_weight, female_weight = predictor.predict_weights(workout)
                results.append({
                    'index': i,
                    'male_weight': round(male_weight),
                    'female_weight': round(female_weight),
                    'model_used': predictor.model_data is not None,
                    'features': workout
                })
            except Exception as e:
                logger.error(f"Error processing workout {i}: {e}")
                results.append({
                    'index': i,
                    'error': str(e),
                    'model_used': False
                })
        
        return jsonify({
            'results': results,
            'total_processed': len(results),
            'successful': len([r for r in results if 'error' not in r])
        })
        
    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/model/reload', methods=['POST'])
def reload_model():
    """Reload the model (useful for model updates)"""
    try:
        predictor.load_model()
        return jsonify({
            'status': 'success',
            'model_loaded': predictor.model_data is not None,
            'model_path': MODEL_PATH
        })
    except Exception as e:
        logger.error(f"Model reload error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/model/info', methods=['GET'])
def model_info():
    """Get information about the loaded model"""
    if not predictor.model_data:
        return jsonify({
            'model_loaded': False,
            'model_path': MODEL_PATH,
            'error': 'Model not loaded'
        })
    
    return jsonify({
        'model_loaded': True,
        'model_path': MODEL_PATH,
        'model_type': type(predictor.model_data).__name__,
        'features': [
            'movement_type', 'total_reps', 'largest_single_set', 
            'time_cap_seconds', 'time_domain', 'format',
            'total_weighted_movements', 'has_other_barbell', 'competition_level'
        ]
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting ML Weight Prediction API on port {port}")
    logger.info(f"Model path: {MODEL_PATH}")
    logger.info(f"Model loaded: {predictor.model_data is not None}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
