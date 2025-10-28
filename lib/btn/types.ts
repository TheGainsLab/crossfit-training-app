export interface Exercise {
  name: string;
  reps: number;
  weight?: string;
}

export type WorkoutFormat = 'AMRAP' | 'For Time' | 'Rounds For Time';

export interface Workout {
  name: string;
  format: WorkoutFormat;
  amrapTime?: number;
  rounds?: number;
  exercises: Exercise[];
}

export interface PerformancePrediction {
  timeDomain: string;
  format: string;
  totalReps: number;
  perRound: number;
  prediction: string;
  limitingExercise: string;
  workoutRate: number;
  rpmFactor: number;
}

export interface GeneratedWorkout extends Workout {
  duration: number;
  timeDomain: string;
  pattern?: string; // For For Time workouts
  medianScore?: string; // 50th percentile benchmark
  excellentScore?: string; // 90th percentile benchmark
}

export interface UserProfile {
  equipment: string[];
  gender: string;
  units: string;
  skills: { [exerciseName: string]: string };
  oneRMs: { [exerciseName: string]: number };
}
