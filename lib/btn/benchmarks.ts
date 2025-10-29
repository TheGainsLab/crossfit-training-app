import { GeneratedWorkout, Exercise, UserProfile } from './types';
import { getAdjustedWorkRate, getExerciseWeight } from './utils';

// Performance tier multipliers for benchmark calculation
export const PERFORMANCE_FACTORS = {
  median: 1.00,      // 50th percentile (sustainable pace)
  excellent: 1.30    // 90th percentile (elite pace)
};

// Exercise rate database (reps per minute for different exercises)
const exerciseRates: { [key: string]: number } = {
  'Double Unders': 60.00,
  'Wall Balls': 20.00,
  'Snatch': 12.00,
  'Rowing Calories': 18.00,
  'Chest to Bar Pull-ups': 18.00,
  'Pull-ups': 18.00,
  'Alternating Dumbbell Snatches': 20.79,
  'Handstand Push-ups': 15.00,
  'Deadlifts': 12.00,
  'Overhead Squats': 15.00,
  'Thrusters': 12.00,
  'Dumbbell Thrusters': 15.42,
  'Burpees': 15.00,
  'Toes to Bar': 18.00,
  'Power Cleans': 15.00,
  'Burpee Box Jump Overs': 12.00,
  'Box Jumps': 21.21,
  'Box Jump Overs': 18.75,
  'Clean and Jerks': 12.00,
  'Dumbbell Clean and Jerk': 15.00,
  'Ring Muscle Ups': 9.00,
  'Rope Climbs': 6.00,
  'Legless Rope Climbs': 4.50,
  'GHD Sit-ups': 24.00,
  'Kettlebell Swings': 30.00,
  'Kettlebell Snatches': 21.00,
  'Bike Calories': 18.00,
  'Ski Calories': 15.00,
  'Squat Cleans': 12.00,
  'Squat Snatch': 9.00,
  'Power Snatch': 15.00,
  'Bar Muscle Ups': 7.50,
  'Dumbbell Box Step-Ups': 18.00,
  'Push-ups': 30.00,
  'Strict Pull-ups': 12.00
};

/**
 * Calculate benchmark scores (50th and 90th percentile) for a generated workout
 * Uses work rates and performance factors to predict expected performance
 */
export function calculateBenchmarkScores(workout: GeneratedWorkout, userProfile?: UserProfile): { medianScore: string, excellentScore: string } {
  const { format, exercises, amrapTime, rounds, duration } = workout;
  
  // Estimate duration for rep factor calculation
  const estimatedDuration = duration || amrapTime || (rounds ? 12 : 8);
  
  if (format === 'AMRAP' && amrapTime) {
    // AMRAP: Calculate expected rounds + reps at different paces
    return calculateAMRAPBenchmarks(exercises, amrapTime, userProfile);
  } else if (format === 'For Time' || format === 'Rounds For Time') {
    // For Time / Rounds For Time: Calculate expected completion times
    return calculateForTimeBenchmarks(exercises, rounds || 1, estimatedDuration, userProfile);
  }
  
  // Fallback
  return { medianScore: '--', excellentScore: '--' };
}

function calculateAMRAPBenchmarks(exercises: Exercise[], duration: number, userProfile?: UserProfile): { medianScore: string, excellentScore: string } {
  // Calculate time per round at median pace
  let medianTimePerRound = 0;
  let excellentTimePerRound = 0;
  
  exercises.forEach(exercise => {
    const weight = getExerciseWeight(exercise);
    const adjustedBaseRate = getAdjustedWorkRate(exercise.name, weight, duration, userProfile);
    const medianRate = adjustedBaseRate * PERFORMANCE_FACTORS.median;
    const excellentRate = adjustedBaseRate * PERFORMANCE_FACTORS.excellent;
    
    // Time to complete this exercise's reps
    medianTimePerRound += exercise.reps / medianRate;
    excellentTimePerRound += exercise.reps / excellentRate;
  });
  
  // Calculate expected rounds
  const medianRounds = Math.floor(duration / medianTimePerRound);
  const excellentRounds = Math.floor(duration / excellentTimePerRound);
  
  // Calculate partial reps for the incomplete round
  const medianRemaining = duration - (medianRounds * medianTimePerRound);
  const excellentRemaining = duration - (excellentRounds * excellentTimePerRound);
  
  let medianPartialReps = 0;
  let excellentPartialReps = 0;
  let medianRemainingTime = medianRemaining;
  let excellentRemainingTime = excellentRemaining;
  
  // Calculate how many reps into the next round at median pace
  for (const exercise of exercises) {
    const weight = getExerciseWeight(exercise);
    const adjustedBaseRate = getAdjustedWorkRate(exercise.name, weight, duration, userProfile);
    const medianRate = adjustedBaseRate * PERFORMANCE_FACTORS.median;
    const timeForExercise = exercise.reps / medianRate;
    
    if (medianRemainingTime >= timeForExercise) {
      medianPartialReps += exercise.reps;
      medianRemainingTime -= timeForExercise;
    } else {
      medianPartialReps += Math.floor(medianRate * medianRemainingTime);
      break;
    }
  }
  
  // Calculate how many reps into the next round at excellent pace
  for (const exercise of exercises) {
    const weight = getExerciseWeight(exercise);
    const adjustedBaseRate = getAdjustedWorkRate(exercise.name, weight, duration, userProfile);
    const excellentRate = adjustedBaseRate * PERFORMANCE_FACTORS.excellent;
    const timeForExercise = exercise.reps / excellentRate;
    
    if (excellentRemainingTime >= timeForExercise) {
      excellentPartialReps += exercise.reps;
      excellentRemainingTime -= timeForExercise;
    } else {
      excellentPartialReps += Math.floor(excellentRate * excellentRemainingTime);
      break;
    }
  }
  
  return {
    medianScore: `${medianRounds}+${medianPartialReps}`,
    excellentScore: `${excellentRounds}+${excellentPartialReps}`
  };
}

function calculateForTimeBenchmarks(exercises: Exercise[], rounds: number, estimatedDuration: number, userProfile?: UserProfile): { medianScore: string, excellentScore: string } {
  // Calculate total time at median pace
  let medianTime = 0;
  let excellentTime = 0;
  
  exercises.forEach(exercise => {
    const weight = getExerciseWeight(exercise);
    const adjustedBaseRate = getAdjustedWorkRate(exercise.name, weight, estimatedDuration, userProfile);
    const medianRate = adjustedBaseRate * PERFORMANCE_FACTORS.median;
    const excellentRate = adjustedBaseRate * PERFORMANCE_FACTORS.excellent;
    
    // Time per round for this exercise
    const medianTimePerRound = exercise.reps / medianRate;
    const excellentTimePerRound = exercise.reps / excellentRate;
    
    medianTime += medianTimePerRound * rounds;
    excellentTime += excellentTimePerRound * rounds;
  });
  
  // Format as MM:SS
  const formatTime = (totalMinutes: number): string => {
    const minutes = Math.floor(totalMinutes);
    const seconds = Math.round((totalMinutes - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  return {
    medianScore: formatTime(medianTime),
    excellentScore: formatTime(excellentTime)
  };
}
