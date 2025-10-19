// ML Weight Predictor Integration
// This module handles loading and using the trained ML model for weight prediction

export interface WorkoutFeatures {
  movement_type: string;
  total_reps: number;
  largest_single_set: number;
  time_cap_seconds: number;
  time_domain: string;
  format: string;
  total_weighted_movements: number;
  has_other_barbell: number;
  competition_level: string;
}

export interface WeightPrediction {
  male_weight: number;
  female_weight: number;
}

export interface MLResponse {
  male_weight: number;
  female_weight: number;
  model_used: boolean;
  features: WorkoutFeatures;
}

class MLWeightPredictor {
  private apiBaseUrl: string;
  private isHealthy: boolean = false;

  constructor(apiBaseUrl: string = 'http://localhost:5001') {
    this.apiBaseUrl = apiBaseUrl;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/health`);
      const data = await response.json();
      this.isHealthy = data.status === 'healthy' && data.model_loaded;
      return this.isHealthy;
    } catch (error) {
      console.warn('ML API health check failed:', error);
      this.isHealthy = false;
      return false;
    }
  }

  // Extract features from a generated workout
  extractFeatures(workout: any): WorkoutFeatures {
    const exercises = workout.exercises || [];
    
    // Determine movement type based on exercises
    const movementType = this.determineMovementType(exercises);
    
    // Calculate total reps
    const totalReps = exercises.reduce((sum: number, ex: any) => {
      if (typeof ex.reps === 'string') {
        // Handle rep schemes like "21-15-9"
        const repNumbers = ex.reps.split('-').map((r: string) => parseInt(r.trim()));
        return sum + repNumbers.reduce((a: number, b: number) => a + b, 0);
      }
      return sum + (ex.reps || 0);
    }, 0);

    // Find largest single set
    const largestSingleSet = exercises.reduce((max: number, ex: any) => {
      if (typeof ex.reps === 'string') {
        const repNumbers = ex.reps.split('-').map((r: string) => parseInt(r.trim()));
        return Math.max(max, ...repNumbers);
      }
      return Math.max(max, ex.reps || 0);
    }, 0);

    // Count weighted movements
    const weightedMovements = exercises.filter((ex: any) => 
      ex.weight || ex.weight_male_lbs || ex.weight_female_lbs
    ).length;

    // Check for other barbell exercises
    const hasOtherBarbell = exercises.some((ex: any) => 
      this.isBarbellExercise(ex.name) && ex.name !== exercises[0]?.name
    ) ? 1 : 0;

    return {
      movement_type: movementType,
      total_reps: totalReps,
      largest_single_set: largestSingleSet,
      time_cap_seconds: workout.time_cap_seconds || 600,
      time_domain: workout.time_domain || '5:00 - 10:00',
      format: workout.format || 'For Time',
      total_weighted_movements: weightedMovements,
      has_other_barbell: hasOtherBarbell,
      competition_level: 'Open' // Default to Open level
    };
  }

  private determineMovementType(exercises: any[]): string {
    const exerciseNames = exercises.map(ex => ex.name.toLowerCase());
    
    // Olympic lifts
    if (exerciseNames.some(name => 
      name.includes('snatch') || name.includes('clean') || name.includes('jerk')
    )) {
      return 'olympic';
    }
    
    // Squat movements
    if (exerciseNames.some(name => 
      name.includes('squat') || name.includes('thruster') || name.includes('overhead squat')
    )) {
      return 'squat';
    }
    
    // Strength movements
    if (exerciseNames.some(name => 
      name.includes('deadlift') || name.includes('bench press')
    )) {
      return 'strength';
    }
    
    // Dumbbell movements
    if (exerciseNames.some(name => 
      name.includes('dumbbell')
    )) {
      return 'dumbbell';
    }
    
    // Pressing movements
    if (exerciseNames.some(name => 
      name.includes('press') || name.includes('push')
    )) {
      return 'pressing';
    }
    
    return 'other';
  }

  private isBarbellExercise(exerciseName: string): boolean {
    const barbellExercises = [
      'Snatch', 'Deadlifts', 'Overhead Squats', 'Thrusters', 'Power Cleans', 
      'Clean and Jerks', 'Squat Cleans', 'Squat Snatch', 'Power Snatch'
    ];
    return barbellExercises.includes(exerciseName);
  }

  // Predict weights using ML API
  async predictWeights(features: WorkoutFeatures): Promise<WeightPrediction> {
    try {
      // Check API health first
      if (!this.isHealthy) {
        await this.checkHealth();
      }

      if (!this.isHealthy) {
        console.warn('ML API not available, using fallback prediction');
        return this.fallbackPrediction(features);
      }

      // Call ML API
      const response = await fetch(`${this.apiBaseUrl}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(features)
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data: MLResponse = await response.json();
      
      return {
        male_weight: data.male_weight,
        female_weight: data.female_weight
      };

    } catch (error) {
      console.warn('ML prediction failed, using fallback:', error);
      return this.fallbackPrediction(features);
    }
  }

  // Batch prediction for multiple workouts (useful for training blocks)
  async predictBatch(featuresArray: WorkoutFeatures[]): Promise<WeightPrediction[]> {
    try {
      if (!this.isHealthy) {
        await this.checkHealth();
      }

      if (!this.isHealthy) {
        console.warn('ML API not available, using fallback predictions');
        return featuresArray.map(features => this.fallbackPrediction(features));
      }

      const response = await fetch(`${this.apiBaseUrl}/predict/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workouts: featuresArray })
      });

      if (!response.ok) {
        throw new Error(`Batch API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      return data.results.map((result: any) => ({
        male_weight: result.male_weight,
        female_weight: result.female_weight
      }));

    } catch (error) {
      console.warn('ML batch prediction failed, using fallback:', error);
      return featuresArray.map(features => this.fallbackPrediction(features));
    }
  }

  // Fallback prediction using heuristics
  private fallbackPrediction(features: WorkoutFeatures): WeightPrediction {
    const baseWeights = this.getBaseWeights(features.movement_type);
    const repAdjustment = this.calculateRepAdjustment(features.total_reps, features.largest_single_set);
    const competitionMultiplier = this.getCompetitionMultiplier(features.competition_level);
    
    const maleWeight = Math.round(baseWeights.male * repAdjustment * competitionMultiplier);
    const femaleWeight = Math.round(baseWeights.female * repAdjustment * competitionMultiplier);

    return {
      male_weight: maleWeight,
      female_weight: femaleWeight
    };
  }

  private getBaseWeights(movementType: string): { male: number; female: number } {
    const weights = {
      olympic: { male: 135, female: 95 },
      squat: { male: 115, female: 75 },
      strength: { male: 185, female: 125 },
      dumbbell: { male: 50, female: 35 },
      pressing: { male: 95, female: 65 },
      other: { male: 100, female: 70 }
    };
    return weights[movementType as keyof typeof weights] || weights.other;
  }

  private calculateRepAdjustment(totalReps: number, largestSet: number): number {
    // Higher reps = lighter weights
    if (totalReps > 100) return 0.7;
    if (totalReps > 50) return 0.8;
    if (totalReps > 25) return 0.9;
    if (totalReps > 10) return 1.0;
    return 1.1; // Low reps = heavier weights
  }

  private getCompetitionMultiplier(competitionLevel: string): number {
    const multipliers = {
      'Open': 1.0,
      'Quarterfinals': 1.1,
      'Semifinals': 1.2
    };
    return multipliers[competitionLevel as keyof typeof multipliers] || 1.0;
  }
}

export const mlPredictor = new MLWeightPredictor();