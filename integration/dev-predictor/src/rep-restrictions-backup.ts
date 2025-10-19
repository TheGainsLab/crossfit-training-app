/**
 * REP RESTRICTIONS BACKUP FILE
 * 
 * This file contains the complete rep restrictions configuration for all 21 exercises.
 * If the main calculateRepsForTimeDomain function gets overwritten, use this as a reference
 * to restore the rep restrictions logic.
 * 
 * Last Updated: January 2025
 */

export const REP_RESTRICTIONS_BACKUP = {
  // Barbell and Dumbbell Exercises
  barbellRepOptions: [3, 5, 6, 10, 12, 15, 18, 20, 25, 30],
  barbellExercises: [
    'Snatch', 'Deadlifts', 'Overhead Squats', 'Thrusters', 
    'Dumbbell Thrusters', 'Power Cleans', 'Clean and Jerks', 'Dumbbell Clean and Jerk'
  ],

  // Double Unders
  doubleUndersRepOptions: [15, 20, 25, 30, 35, 40, 50, 60, 75, 100],
  doubleUndersExercises: ['Double Unders'],

  // Wall Balls
  wallBallsRepOptions: [10, 12, 15, 18, 20, 24, 25, 30, 35, 36, 40, 50, 60, 75],
  wallBallsExercises: ['Wall Balls'],

  // Box Exercises
  boxRepOptions: [3, 5, 10, 12, 15, 18, 20, 24, 25, 30],
  boxExercises: ['Burpee Box Jump Overs', 'Box Jumps', 'Box Jump Overs'],

  // Toes to Bar
  toesToBarRepOptions: [3, 5, 6, 9, 10, 12, 15, 18, 20, 24, 25, 30],
  toesToBarExercises: ['Toes to Bar'],

  // Rowing Calories
  rowingCaloriesRepOptions: [10, 12, 15, 18, 21, 24, 25, 30, 35, 40, 50, 60, 75, 100],
  rowingCaloriesExercises: ['Rowing Calories'],

  // Pull-ups
  pullupsRepOptions: [3, 5, 6, 9, 10, 12, 15, 18, 20, 24, 25, 30],
  pullupsExercises: ['Chest to Bar Pull-ups', 'Pull-ups'],

  // Alternating Dumbbell Snatches
  alternatingDumbbellSnatchesRepOptions: [10, 12, 15, 18, 20, 25, 30, 40, 50, 60],
  alternatingDumbbellSnatchesExercises: ['Alternating Dumbbell Snatches'],

  // Handstand Push-ups
  handstandPushupsRepOptions: [3, 5, 6, 9, 10, 12, 15, 18, 20, 24, 25, 30],
  handstandPushupsExercises: ['Handstand Push-ups'],

  // Burpees
  burpeesRepOptions: [3, 5, 6, 9, 10, 12, 15, 18, 20, 24, 25, 30],
  burpeesExercises: ['Burpees'],

  // Ring Muscle Ups
  ringMuscleUpsRepOptions: [3, 5, 6, 9, 10, 12, 15, 18, 20, 24, 25, 30],
  ringMuscleUpsExercises: ['Ring Muscle Ups']
};

export const FORBIDDEN_PAIRS_BACKUP = [
  ['Pull-ups', 'Chest to Bar Pull-ups'],
  ['Burpee Box Jump Overs', 'Box Jump Overs'], 
  ['Box Jump Overs', 'Box Jumps'],
  ['Burpee Box Jump Overs', 'Box Jumps'],
  ['Burpees', 'Burpee Box Jump Overs']
];

/**
 * RESTORATION INSTRUCTIONS:
 * 
 * If calculateRepsForTimeDomain function gets overwritten:
 * 
 * 1. Copy the rep options arrays from this file
 * 2. Copy the exercise identification logic (isBarbellExerciseForReps, etc.)
 * 3. Copy the AMRAP and Rounds For Time calculation logic
 * 4. Ensure the "closest allowed rep count" algorithm is preserved
 * 5. Test with a few workout generations to verify functionality
 * 
 * The function should:
 * - Calculate total reps using baseRate * targetDuration * 0.3
 * - Estimate rounds for AMRAP (duration/1.5 to duration/2.2)
 * - Divide total reps by rounds to get per-round amounts
 * - Apply rep restrictions using the "closest allowed" algorithm
 * - Return realistic rep counts for all exercise types
 */
