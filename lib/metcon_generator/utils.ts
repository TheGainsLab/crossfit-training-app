import { Workout, PerformancePrediction, GeneratedWorkout, Exercise } from './types';
import { exerciseDatabase } from '../btn/data';

/**
 * BACKUP: Complete Rep Restrictions for All 21 Exercises
 * 
 * If calculateRepsForTimeDomain function gets overwritten, restore these restrictions:
 * 
 * Barbell/Dumbbell (3,5,6,10,12,15,18,20,25,30): Snatch, Deadlifts, Overhead Squats, Thrusters, 
 * Dumbbell Thrusters, Power Cleans, Clean and Jerks, Dumbbell Clean and Jerk
 * 
 * Double Unders (15,20,25,30,35,40,50,60,75,100)
 * Wall Balls (10,12,15,18,20,24,25,30,35,36,40,50,60,75)
 * Box Exercises (3,5,10,12,15,18,20,24,25,30): Burpee Box Jump Overs, Box Jumps, Box Jump Overs
 * Toes to Bar (3,5,6,9,10,12,15,18,20,24,25,30)
 * Rowing Calories (10,12,15,18,21,24,25,30,35,40,50,60,75,100)
 * Pull-ups (3,5,6,9,10,12,15,18,20,24,25,30): Chest to Bar Pull-ups, Pull-ups
 * Alternating Dumbbell Snatches (10,12,15,18,20,25,30,40,50,60)
 * Handstand Push-ups (3,5,6,9,10,12,15,18,20,24,25,30)
 * Burpees (3,5,6,9,10,12,15,18,20,24,25,30)
 * Ring Muscle Ups (3,5,6,9,10,12,15,18,20,24,25,30)
 * 
 * Forbidden Pairs: ['Pull-ups', 'Chest to Bar Pull-ups'], ['Burpee Box Jump Overs', 'Box Jump Overs'], 
 * ['Box Jump Overs', 'Box Jumps'], ['Burpee Box Jump Overs', 'Box Jumps'], ['Burpees', 'Burpee Box Jump Overs'],
 * ['Rope Climbs', 'Legless Rope Climbs'], ['Rope Climbs', 'Ring Muscle Ups'],
 * ['Legless Rope Climbs', 'Ring Muscle Ups'], ['GHD Sit-ups', 'Toes to Bar'], ['Kettlebell exercises', 'Barbell/Dumbbell exercises']
 * 
 * Universal Restrictions: Only one barbell exercise per workout (no barbell-to-barbell forbidden pairs needed)
 */

// Exercise difficulty tiers for pattern compatibility
const exerciseDifficultyTiers = {
  highSkill: ['Snatch', 'Ring Muscle Ups', 'Handstand Push-ups', 'Rope Climbs', 'Legless Rope Climbs', 'Squat Snatch', 'Bar Muscle Ups'],
  highVolume: ['Double Unders', 'Wall Balls'],
  moderate: ['Deadlifts', 'Burpees', 'Pull-ups', 'Chest to Bar Pull-ups', 'Toes to Bar', 'Overhead Squats', 'Thrusters', 'Power Cleans', 'Clean and Jerks', 'GHD Sit-ups', 'Squat Cleans', 'Power Snatch', 'Push-ups', 'Strict Pull-ups'],
  lowSkill: ['Box Jumps', 'Box Jump Overs', 'Burpee Box Jump Overs', 'Alternating Dumbbell Snatches', 'Dumbbell Thrusters', 'Dumbbell Clean and Jerk', 'Rowing Calories', 'Kettlebell Swings', 'Kettlebell Snatches', 'Bike Calories', 'Ski Calories', 'Dumbbell Box Step-Ups']
};

// Pattern restrictions by exercise difficulty tier
const patternRestrictions = {
  highSkill: ['21-15-9', '15-12-9', '12-9-6'],
  highVolume: ['21-15-9', '15-12-9', '12-9-6', '10-8-6-4-2', '15-12-9-6-3'],
  moderate: ['21-15-9', '15-12-9', '12-9-6', '10-8-6-4-2', '15-12-9-6-3'],
  lowSkill: ['21-15-9', '15-12-9', '12-9-6', '10-8-6-4-2', '15-12-9-6-3', '27-21-15-9', '33-27-21-15-9', '50-40-30-20-10', '40-30-20-10']
};

// Special pattern restrictions for specific exercises
const specialPatternRestrictions = {
  'Rope Climbs': ['10-8-6-4-2'], // Only allow 10-8-6-4-2 pattern
  'Legless Rope Climbs': ['21-15-9', '15-12-9', '12-9-6', '10-8-6-4-2', '15-12-9-6-3', '12-9-6-3', '27-21-15-9', '33-27-21-15-9', '50-40-30-20-10', '40-30-20-10'], // Exclude ALL For Time patterns
  'Wall Balls': ['50-40-30-20-10', '40-30-20-10'], // Only allow high-volume patterns
  'Double Unders': ['50-40-30-20-10', '40-30-20-10'], // Only allow high-volume patterns
  'Rowing Calories': ['21-15-9', '15-12-9-6-3', '27-21-15-9', '33-27-21-15-9', '50-40-30-20-10', '40-30-20-10'], // Exclude 10-8-6-4-2, 15-12-9, 12-9-6
  'Bike Calories': ['21-15-9', '15-12-9-6-3', '27-21-15-9', '33-27-21-15-9', '50-40-30-20-10', '40-30-20-10'], // Exclude 10-8-6-4-2, 15-12-9, 12-9-6
  'Ski Calories': ['21-15-9', '15-12-9-6-3', '27-21-15-9', '33-27-21-15-9', '50-40-30-20-10', '40-30-20-10'] // Exclude 10-8-6-4-2, 15-12-9, 12-9-6
};

// Helper function to check if exercises work with a specific pattern
function exercisesWorkWithPattern(exercises: string[], pattern: string): boolean {
  const allowedPatterns = getAllowedPatternsForExercises(exercises);
  return allowedPatterns.includes(pattern);
}

// Helper function to check if exercises have valid patterns
function hasValidPatterns(exercises: string[]): boolean {
  const allowedPatterns = getAllowedPatternsForExercises(exercises);
  return allowedPatterns.length > 0;
}

// Helper function to get allowed patterns for a set of exercises
function getAllowedPatternsForExercises(exercises: string[]): string[] {
  // Find the most restrictive tier among the exercises
  let mostRestrictiveTier = 'lowSkill';
  
  for (const exercise of exercises) {
    if (exerciseDifficultyTiers.highSkill.includes(exercise)) {
      mostRestrictiveTier = 'highSkill';
      break; // High skill is the most restrictive
    } else if (exerciseDifficultyTiers.highVolume.includes(exercise) && mostRestrictiveTier !== 'highSkill') {
      mostRestrictiveTier = 'highVolume';
    } else if (exerciseDifficultyTiers.moderate.includes(exercise) && mostRestrictiveTier === 'lowSkill') {
      mostRestrictiveTier = 'moderate';
    }
  }
  
  // Get base patterns for the most restrictive tier
  let allowedPatterns = patternRestrictions[mostRestrictiveTier as keyof typeof patternRestrictions];
  
  // Apply special restrictions - exercises with special restrictions override tier restrictions
  for (const exercise of exercises) {
    if (specialPatternRestrictions[exercise as keyof typeof specialPatternRestrictions]) {
      const specialPatterns = specialPatternRestrictions[exercise as keyof typeof specialPatternRestrictions];
      // Only keep patterns that are allowed for this exercise
      allowedPatterns = allowedPatterns.filter(pattern => specialPatterns.includes(pattern));
    }
  }
  
  return allowedPatterns;
}

// Exercise rate database (reps per minute for different exercises) - Empirical data
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
  'Thrusters': 15.00,
  'Dumbbell Thrusters': 15.00,
  'Burpees': 12.00,
  'Toes to Bar': 15.00,
  'Power Cleans': 15.00,
  'Burpee Box Jump Overs': 12.00,
  'Box Jumps': 15.00,
  'Box Jump Overs': 15.00,
  'Clean and Jerks': 12.00,
  'Dumbbell Clean and Jerk': 12.00,
  'Ring Muscle Ups': 7.00,
  'Rope Climbs': 5.00,
  'Legless Rope Climbs': 3.00,
  'GHD Sit-ups': 15.00,
  'Kettlebell Swings': 20.79,
  'Kettlebell Snatches': 18.00,
  'Bike Calories': 18.00,
  'Ski Calories': 18.00,
  'Squat Cleans': 12.00,
  'Squat Snatch': 12.00,
  'Power Snatch': 15.00,
  'Bar Muscle Ups': 7.00,
  'Dumbbell Box Step-Ups': 15.00,
  'Push-ups': 20.00,
  'Strict Pull-ups': 7.00
};

export function calculatePerformancePrediction(workout: Workout): PerformancePrediction {
  const totalReps = workout.exercises.reduce((sum, exercise) => sum + exercise.reps, 0);
  
  // Calculate limiting exercise (slowest rate)
  let limitingExercise = '';
  let slowestRate = Infinity;
  
  workout.exercises.forEach(exercise => {
    const rate = exerciseRates[exercise.name] || 10.0; // default rate
    if (rate < slowestRate) {
      slowestRate = rate;
      limitingExercise = `${exercise.name} (${rate} rate)`;
    }
  });

  // Calculate workout rate based on format
  let workoutRate = slowestRate;
  let timeDomain = '';
  let format = workout.format;

  if (workout.format === 'AMRAP' && workout.amrapTime) {
    workoutRate = totalReps / workout.amrapTime;
    timeDomain = `${workout.amrapTime - 5}-${workout.amrapTime + 5} min`;
  } else if (workout.format === 'For Time') {
    const estimatedTime = totalReps / slowestRate;
    if (estimatedTime <= 5) {
      timeDomain = '1:00 - 5:00';
    } else if (estimatedTime <= 10) {
      timeDomain = '5:00 - 10:00';
    } else if (estimatedTime <= 15) {
      timeDomain = '10:00 - 15:00';
    } else if (estimatedTime <= 20) {
      timeDomain = '15:00 - 20:00';
    } else {
      timeDomain = '20:00+';
    }
  } else {
    timeDomain = '15:00 - 20:00';
  }

  // Generate predictions based on workout rate
  const prediction = generatePrediction(workoutRate, workout);

  return {
    timeDomain,
    format,
    totalReps,
    perRound: totalReps,
    prediction,
    limitingExercise,
    workoutRate: Math.round(workoutRate * 10) / 10,
    rpmFactor: 1
  };
}

function generatePrediction(rate: number, workout: Workout): string {
  if (workout.format === 'AMRAP' && workout.amrapTime) {
    const rounds = Math.floor((rate * workout.amrapTime) / workout.exercises.reduce((sum, ex) => sum + ex.reps, 0));
    const extraReps = Math.floor((rate * workout.amrapTime) % workout.exercises.reduce((sum, ex) => sum + ex.reps, 0));
    return `${rounds}+${extraReps}`;
  } else {
    const timeMinutes = Math.floor(workout.exercises.reduce((sum, ex) => sum + ex.reps, 0) / rate);
    const timeSeconds = Math.floor(((workout.exercises.reduce((sum, ex) => sum + ex.reps, 0) / rate) % 1) * 60);
    return `${timeMinutes}:${timeSeconds.toString().padStart(2, '0')}`;
  }
}

export function generateTestWorkouts(): GeneratedWorkout[] {
  const workouts: GeneratedWorkout[] = [];
  
  // Define time domains and target durations
  const timeDomains = [
    { range: '1:00 - 5:00', targetDuration: 3 },
    { range: '5:00 - 10:00', targetDuration: 7 },
    { range: '10:00 - 15:00', targetDuration: 12 },
    { range: '15:00 - 20:00', targetDuration: 17 },
    { range: '20:00+', targetDuration: 25 }
  ];
  
  const formats = ['For Time', 'AMRAP', 'Rounds For Time'];
  
  // Generate 2 workouts for each time domain
  timeDomains.forEach((domain, domainIndex) => {
    for (let i = 0; i < 2; i++) {
      // Random format
      const format = formats[Math.floor(Math.random() * formats.length)] as 'For Time' | 'AMRAP' | 'Rounds For Time';
      
      let amrapTime: number | undefined;
      let rounds: number | undefined;
      
      if (format === 'For Time') {
        // For Time: no duration parameter
        amrapTime = undefined;
        rounds = undefined;
      } else if (format === 'AMRAP') {
        // AMRAP: random duration within time domain range, capped at 5-20 minutes
        let minTime, maxTime;
        if (domain.range === '1:00 - 5:00') {
          minTime = 5; maxTime = 5; // Cap at minimum 5 minutes
        } else if (domain.range === '5:00 - 10:00') {
          minTime = 5; maxTime = 10;
        } else if (domain.range === '10:00 - 15:00') {
          minTime = 10; maxTime = 15;
        } else if (domain.range === '15:00 - 20:00') {
          minTime = 15; maxTime = 20;
        } else { // '20:00+'
          minTime = 15; maxTime = 20; // Cap at maximum 20 minutes
        }
        amrapTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
        rounds = undefined;
      } else { // Rounds For Time
        // Rounds For Time: random rounds between 2-8
        rounds = Math.floor(Math.random() * 7) + 2;
        amrapTime = undefined;
      }
      
      // Step 3: Select pattern FIRST (for For Time workouts)
      let pattern: string | undefined;
      if (format === 'For Time') {
        // Select pattern first, then exercises will be filtered to work with this pattern
        const allPatterns = ['21-15-9', '15-12-9', '12-9-6', '10-8-6-4-2', '15-12-9-6-3', '27-21-15-9', '33-27-21-15-9', '50-40-30-20-10', '40-30-20-10'];
        
        // Determine exercise count first (needed for pattern selection)
        let numExercises: number;
        if (domain.targetDuration <= 10) {
          numExercises = Math.floor(Math.random() * 2) + 2; // 2-3 exercises
        } else {
          numExercises = Math.floor(Math.random() * 3) + 2; // 2-4 exercises
        }
        numExercises = Math.max(numExercises, 2);
        numExercises = Math.min(numExercises, 4); // Cap at 4 exercises maximum
        
        if (numExercises === 2) {
          // 2 exercises: can use any pattern
          pattern = allPatterns[Math.floor(Math.random() * allPatterns.length)];
        } else {
          // 3+ exercises: exclude longer patterns (unless high-volume exercises are present)
          const shorterPatterns = allPatterns.filter(p => 
            !['50-40-30-20-10', '40-30-20-10', '33-27-21-15-9', '27-21-15-9'].includes(p)
          );
          pattern = shorterPatterns[Math.floor(Math.random() * shorterPatterns.length)];
        }
      }
      
      // Step 4: Generate exercises that work with the selected pattern (if For Time)
      const exercises = generateExercisesForTimeDomain(domain.targetDuration, format, rounds, pattern);
        
        // Apply pattern to exercises (override the 0 reps)
        if (pattern) {
          const patternReps = pattern.split('-').map(Number);
          exercises.forEach((exercise, index) => {
            // Get the target reps from the pattern
            const targetReps = patternReps[index % patternReps.length];
            
            // Use the existing rep calculation function to get a reasonable base
            const baseReps = calculateRepsForTimeDomain(exercise.name, 5, 'AMRAP', 1, 1);
            
            // Scale the base reps to match the pattern proportionally
            const scaleFactor = targetReps / baseReps;
            const scaledReps = Math.round(baseReps * scaleFactor);
            
            // Use the existing function again to find the closest allowed rep count
            const finalReps = calculateRepsForTimeDomain(exercise.name, Math.max(scaledReps, 1), 'AMRAP', 1, 1);
            
            exercise.reps = finalReps;
          });
        }
      
      // Calculate actual completion time based on exercises and format
      let calculatedDuration = calculateWorkoutDuration(exercises, format, rounds, amrapTime, pattern);
      
      // Enforce maximum duration constraint: maximum 25 minutes
      const maxDuration = 25;
      if (calculatedDuration > maxDuration) {
        calculatedDuration = maxDuration;
      }
      
      const workout: GeneratedWorkout = {
        name: `Workout ${domainIndex * 2 + i + 1}`,
        duration: calculatedDuration,
        format,
        amrapTime,
        rounds,
        timeDomain: getTimeDomainRange(calculatedDuration),
        exercises,
        pattern
      };
      workouts.push(workout);
    }
  });

  return workouts;
}

function generateExercisesForTimeDomain(targetDuration: number, format: string, rounds?: number, pattern?: string): Exercise[] {
  const exercises: Exercise[] = [];
  
  if (format === 'For Time') {
    // For Time workouts: 2-3 exercises
    const numExercises = Math.floor(Math.random() * 2) + 2; // 2-3 exercises
    
    // Step 1: Pre-filter exercises by pattern compatibility
    const patternCompatibleExercises = exerciseDatabase.filter(exercise => {
      if (exercise === 'Legless Rope Climbs') return false; // Exclude for For Time
      if (!pattern) return true; // No pattern restriction for non-For Time
      
      const allowedPatterns = getAllowedPatternsForExercises([exercise]);
      return allowedPatterns.includes(pattern);
    });
    
    // Step 2: Build workout incrementally from pattern-compatible exercises
    const shuffledExercises = [...patternCompatibleExercises].sort(() => Math.random() - 0.5);
    const filteredExercises: string[] = [];
    
    // Add exercises one by one, ensuring each new exercise is compatible with all existing ones
    for (const candidate of shuffledExercises) {
      if (filteredExercises.length >= numExercises) break;
      
      // Test if adding this candidate maintains compatibility (pattern already pre-filtered)
      const testExercises = [...filteredExercises, candidate];
      const testFiltered = filterExercisesForConsistency(testExercises);
      const testFinal = filterForbiddenPairs(testFiltered);
      
      // If all exercises survive the filtering, add the candidate
      if (testFinal.length === testExercises.length && testFinal.includes(candidate)) {
        filteredExercises.push(candidate);
      }
    }
    
    // Rule: If workout has 4 exercises, one must be cardio (Bike, Row, or Ski Calories)
    if (filteredExercises.length === 4) {
      const cardioExercises = ['Rowing Calories', 'Bike Calories', 'Ski Calories'];
      const hasCardio = filteredExercises.some(ex => cardioExercises.includes(ex));
      
      if (!hasCardio) {
        // Remove one exercise and add a cardio exercise
        filteredExercises.pop(); // Remove last exercise
        
        // Find a cardio exercise that works with the remaining exercises
        const cardioCandidates = cardioExercises.filter(cardio => {
          const testExercises = [...filteredExercises, cardio];
          const testFiltered = filterExercisesForConsistency(testExercises);
          const testFinal = filterForbiddenPairs(testFiltered);
          return testFinal.length === testExercises.length && testFinal.includes(cardio);
        });
        
        if (cardioCandidates.length > 0) {
          filteredExercises.push(cardioCandidates[0]);
        }
      }
    }
    
    // Generate consistent weights for barbell and dumbbell exercises
    const barbellExercises = filteredExercises.filter(ex => isBarbellExercise(ex));
    const dumbbellExercises = filteredExercises.filter(ex => ex.includes('Dumbbell'));
    
    // Generate one weight for all barbell exercises, one for all dumbbell exercises
    const barbellWeight = barbellExercises.length > 0 ? generateWeightForExercise(barbellExercises[0]) : undefined;
    const dumbbellWeight = dumbbellExercises.length > 0 ? generateWeightForExercise(dumbbellExercises[0]) : undefined;
    
    // Generate exercises (no individual reps for For Time - pattern will be used)
    filteredExercises.forEach(exerciseName => {
      // Assign consistent weights based on exercise type
      let weight: string | undefined;
      if (exerciseName.includes('Dumbbell')) {
        weight = dumbbellWeight;
      } else if (isBarbellExercise(exerciseName)) {
        weight = barbellWeight;
      }
      
      exercises.push({
        name: exerciseName,
        reps: 0, // Pattern will override this
        weight
      });
    });
    
    return exercises;
  }
  
  // For AMRAP and Rounds For Time, use proper selection logic
  let numExercises: number;
  if (targetDuration <= 10) {
    // 1-5 or 5-10 minutes: 2-3 exercises
    numExercises = Math.floor(Math.random() * 2) + 2; // 2-3 exercises
  } else {
    // 10-15, 15-20, or 20+ minutes: 2-4 exercises
    numExercises = Math.floor(Math.random() * 3) + 2; // 2-4 exercises
  }
  
  // Ensure we have at least 2 exercises
  numExercises = Math.max(numExercises, 2);
  numExercises = Math.min(numExercises, 4); // Cap at 4 exercises maximum
  
  // Build workout incrementally, checking compatibility at each step
  const shuffledExercises = [...exerciseDatabase].sort(() => Math.random() - 0.5);
  const filteredExercises: string[] = [];
  
  // Add exercises one by one, ensuring each new exercise is compatible with all existing ones
  for (const candidate of shuffledExercises) {
    if (filteredExercises.length >= numExercises) break;
    
    // Test if adding this candidate maintains compatibility (no pattern check for AMRAP/Rounds)
    const testExercises = [...filteredExercises, candidate];
    const testFiltered = filterExercisesForConsistency(testExercises);
    const testFinal = filterForbiddenPairs(testFiltered);
    
    // If all exercises survive the filtering, add the candidate
    if (testFinal.length === testExercises.length && testFinal.includes(candidate)) {
      filteredExercises.push(candidate);
    }
  }
  
  // Rule: If workout has 4 exercises, one must be cardio (Bike, Row, or Ski Calories)
  if (filteredExercises.length === 4) {
    const cardioExercises = ['Rowing Calories', 'Bike Calories', 'Ski Calories'];
    const hasCardio = filteredExercises.some(ex => cardioExercises.includes(ex));
    
    if (!hasCardio) {
      // Remove one exercise and add a cardio exercise
      filteredExercises.pop(); // Remove last exercise
      
      // Find a cardio exercise that works with the remaining exercises
      const cardioCandidates = cardioExercises.filter(cardio => {
        const testExercises = [...filteredExercises, cardio];
        const testFiltered = filterExercisesForConsistency(testExercises);
        const testFinal = filterForbiddenPairs(testFiltered);
        return testFinal.length === testExercises.length && testFinal.includes(cardio);
      });
      
      if (cardioCandidates.length > 0) {
        filteredExercises.push(cardioCandidates[0]);
      }
    }
  }
  
  // Generate consistent weights for barbell and dumbbell exercises
  const barbellExercises = filteredExercises.filter(ex => isBarbellExercise(ex));
  const dumbbellExercises = filteredExercises.filter(ex => ex.includes('Dumbbell'));
  
  // Generate one weight for all barbell exercises, one for all dumbbell exercises
  const barbellWeight = barbellExercises.length > 0 ? generateWeightForExercise(barbellExercises[0]) : undefined;
  const dumbbellWeight = dumbbellExercises.length > 0 ? generateWeightForExercise(dumbbellExercises[0]) : undefined;
  
  // Calculate reps for all exercises first
  const exerciseReps: { name: string; reps: number }[] = [];
  filteredExercises.forEach(exerciseName => {
    const reps = calculateRepsForTimeDomain(exerciseName, targetDuration, format, rounds, filteredExercises.length);
    exerciseReps.push({ name: exerciseName, reps });
  });
  
  // Apply clustering for AMRAP and Rounds For Time formats
  if (format === 'AMRAP' || format === 'Rounds For Time') {
    clusterReps(exerciseReps);
  }
  
  // Generate exercises with clustered reps
  exerciseReps.forEach(({ name, reps }) => {
    // Assign consistent weights based on exercise type
    let weight: string | undefined;
    if (name.includes('Dumbbell')) {
      weight = dumbbellWeight;
    } else if (isBarbellExercise(name)) {
      weight = barbellWeight;
    }
    
    exercises.push({
      name,
      reps,
      weight
    });
  });
  
  return exercises;
}

/**
 * CRITICAL FUNCTION - DO NOT OVERWRITE WITHOUT PRESERVING REP RESTRICTIONS
 * 
 * This function calculates realistic rep counts for AMRAP and Rounds For Time workouts
 * by applying specific rep restrictions to each exercise type. All 21 exercises have
 * predefined allowed rep counts that prevent unrealistic workout generation.
 * 
 * Key Features:
 * - AMRAP: Calculates total reps, estimates rounds, divides for per-round amounts
 * - Rounds For Time: Calculates total reps, divides by specified rounds
 * - Rep Restrictions: All exercises have specific allowed rep ranges
 * - For Time: Uses simple calculation (patterns handled elsewhere)
 * 
 * Last Updated: [Current Date] - Contains complete rep restrictions for all exercises
 */
function calculateRepsForTimeDomain(exerciseName: string, targetDuration: number, format: string, rounds?: number, numExercises: number = 3): number {
  const baseRate = exerciseRates[exerciseName] || 10.0;
  
  // Define allowed rep counts for different exercise types in AMRAP and Rounds For Time
  const barbellRepOptions = [3, 5, 6, 10, 12, 15, 18, 20, 25, 30];
  const doubleUndersRepOptions = [15, 20, 25, 30, 35, 40, 50, 60, 75, 100];
  const wallBallsRepOptions = [10, 12, 15, 18, 20, 24, 25, 30, 35, 36, 40, 50, 60, 75];
  const boxRepOptions = [3, 5, 10, 12, 15, 18, 20, 24, 25, 30];
  const toesToBarRepOptions = [3, 5, 6, 9, 10, 12, 15, 18, 20, 24, 25, 30];
  const rowingCaloriesRepOptions = [10, 12, 15, 18, 21, 24, 25, 30, 35, 40, 50, 60, 75, 100];
  const pullupsRepOptions = [3, 5, 6, 9, 10, 12, 15, 18, 20, 24, 25, 30];
  const alternatingDumbbellSnatchesRepOptions = [10, 12, 15, 18, 20, 25, 30, 40, 50, 60];
  const handstandPushupsRepOptions = [3, 5, 6, 9, 10, 12, 15, 18, 20, 24, 25, 30];
  const burpeesRepOptions = [3, 5, 6, 9, 10, 12, 15, 18, 20, 24, 25, 30];
  const ringMuscleUpsRepOptions = [3, 5, 6, 9, 10, 12, 15, 18, 20, 24, 25, 30];
  const ropeClimbsRepOptions = [2, 3, 5];
  const leglessRopeClimbsRepOptions = [1, 2, 3];
  const ghdSitupsRepOptions = [3, 5, 6, 9, 10, 12, 15, 18, 20, 24, 25, 30];
  const kettlebellSwingsRepOptions = [10, 12, 15, 18, 20, 25, 30, 40, 50, 60];
  const kettlebellSnatchesRepOptions = [10, 12, 15, 18, 20, 25, 30, 40, 50, 60];
  const bikeCaloriesRepOptions = [10, 12, 15, 18, 21, 24, 25, 30, 35, 40, 50, 60, 75, 100];
  const skiCaloriesRepOptions = [10, 12, 15, 18, 21, 24, 25, 30, 35, 40, 50, 60, 75, 100];
  
  const isBarbellExerciseForReps = ['Snatch', 'Deadlifts', 'Overhead Squats', 'Thrusters', 'Dumbbell Thrusters', 'Power Cleans', 'Clean and Jerks', 'Dumbbell Clean and Jerk', 'Squat Cleans', 'Squat Snatch', 'Power Snatch', 'Dumbbell Box Step-Ups'].includes(exerciseName);
  const isDoubleUnders = exerciseName === 'Double Unders';
  const isWallBalls = exerciseName === 'Wall Balls';
  const isBoxExercise = ['Burpee Box Jump Overs', 'Box Jumps', 'Box Jump Overs'].includes(exerciseName);
  const isToesToBar = exerciseName === 'Toes to Bar';
  const isRowingCalories = exerciseName === 'Rowing Calories';
  const isPullups = ['Chest to Bar Pull-ups', 'Pull-ups'].includes(exerciseName);
  const isAlternatingDumbbellSnatches = exerciseName === 'Alternating Dumbbell Snatches';
  const isHandstandPushups = exerciseName === 'Handstand Push-ups';
  const isBurpees = exerciseName === 'Burpees';
  const isRingMuscleUps = exerciseName === 'Ring Muscle Ups';
  const isRopeClimbs = exerciseName === 'Rope Climbs';
  const isLeglessRopeClimbs = exerciseName === 'Legless Rope Climbs';
  const isGhdSitups = exerciseName === 'GHD Sit-ups';
  const isKettlebellSwings = exerciseName === 'Kettlebell Swings';
  const isKettlebellSnatches = exerciseName === 'Kettlebell Snatches';
  const isBikeCalories = exerciseName === 'Bike Calories';
  const isSkiCalories = exerciseName === 'Ski Calories';
  const isSquatCleans = exerciseName === 'Squat Cleans';
  const isSquatSnatch = exerciseName === 'Squat Snatch';
  const isPowerSnatch = exerciseName === 'Power Snatch';
  const isBarMuscleUps = exerciseName === 'Bar Muscle Ups';
  const isDumbbellBoxStepUps = exerciseName === 'Dumbbell Box Step-Ups';
  const isPushups = exerciseName === 'Push-ups';
  const isStrictPullups = exerciseName === 'Strict Pull-ups';
  
  if (format === 'AMRAP') {
    // For AMRAP, calculate total reps for the entire duration, then estimate rounds
    const totalTargetReps = Math.floor(baseRate * targetDuration * 0.3);
    
    // Estimate how many rounds can be completed in the time domain
    // Use a conservative estimate: assume each round takes 1-2 minutes depending on duration
    let estimatedRounds: number;
    if (targetDuration <= 5) {
      estimatedRounds = Math.max(Math.floor(targetDuration / 1.5), 2); // 1-2 rounds for short AMRAPs
    } else if (targetDuration <= 10) {
      estimatedRounds = Math.max(Math.floor(targetDuration / 1.8), 3); // 2-3 rounds for medium AMRAPs
    } else if (targetDuration <= 15) {
      estimatedRounds = Math.max(Math.floor(targetDuration / 2.0), 4); // 3-4 rounds for longer AMRAPs
    } else {
      estimatedRounds = Math.max(Math.floor(targetDuration / 2.2), 5); // 4+ rounds for very long AMRAPs
    }
    
    // Calculate reps per round
    const repsPerRound = Math.floor(totalTargetReps / estimatedRounds);
    
    if (isBarbellExerciseForReps) {
      // Find the closest allowed rep count for per-round reps
      const closestReps = barbellRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isDoubleUnders) {
      // Find the closest allowed rep count for Double Unders per-round
      const closestReps = doubleUndersRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isWallBalls) {
      // Find the closest allowed rep count for Wall Balls per-round
      const closestReps = wallBallsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isBoxExercise) {
      // Find the closest allowed rep count for Box exercises per-round
      const closestReps = boxRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isToesToBar) {
      // Find the closest allowed rep count for Toes to Bar per-round
      const closestReps = toesToBarRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isRowingCalories) {
      // Find the closest allowed rep count for Rowing Calories per-round
      const closestReps = rowingCaloriesRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isPullups) {
      // Find the closest allowed rep count for Pull-ups per-round
      const closestReps = pullupsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isAlternatingDumbbellSnatches) {
      // Find the closest allowed rep count for Alternating Dumbbell Snatches per-round
      const closestReps = alternatingDumbbellSnatchesRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isHandstandPushups) {
      // Find the closest allowed rep count for Handstand Push-ups per-round
      const closestReps = handstandPushupsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isBurpees) {
      // Find the closest allowed rep count for Burpees per-round
      const closestReps = burpeesRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isRingMuscleUps) {
      // Find the closest allowed rep count for Ring Muscle Ups per-round
      const closestReps = ringMuscleUpsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isRopeClimbs) {
      // Find the closest allowed rep count for Rope Climbs per-round
      const closestReps = ropeClimbsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isLeglessRopeClimbs) {
      // Find the closest allowed rep count for Legless Rope Climbs per-round
      const closestReps = leglessRopeClimbsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isGhdSitups) {
      // Find the closest allowed rep count for GHD Sit-ups per-round
      const closestReps = ghdSitupsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isKettlebellSwings) {
      // Find the closest allowed rep count for Kettlebell Swings per-round
      const closestReps = kettlebellSwingsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isKettlebellSnatches) {
      // Find the closest allowed rep count for Kettlebell Snatches per-round
      const closestReps = kettlebellSnatchesRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isBikeCalories) {
      // Find the closest allowed rep count for Bike Calories per-round
      const closestReps = bikeCaloriesRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isSkiCalories) {
      // Find the closest allowed rep count for Ski Calories per-round
      const closestReps = skiCaloriesRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isBarMuscleUps) {
      // Find the closest allowed rep count for Bar Muscle Ups per-round
      const closestReps = ringMuscleUpsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isDumbbellBoxStepUps) {
      // Find the closest allowed rep count for Dumbbell Box Step-Ups per-round
      const closestReps = barbellRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isPushups) {
      // Find the closest allowed rep count for Push-ups per-round
      const closestReps = handstandPushupsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isStrictPullups) {
      // Find the closest allowed rep count for Strict Pull-ups per-round
      const closestReps = ringMuscleUpsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    }
    
    return Math.max(repsPerRound, 1);
  } else if (format === 'Rounds For Time' && rounds) {
    // For Rounds For Time, calculate total reps for the entire duration, then divide by rounds
    const totalTargetReps = Math.floor(baseRate * targetDuration * 0.3);
    const repsPerRound = Math.floor(totalTargetReps / rounds);
    
    if (isBarbellExerciseForReps) {
      // Find the closest allowed rep count
      const closestReps = barbellRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isDoubleUnders) {
      // Find the closest allowed rep count for Double Unders
      const closestReps = doubleUndersRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isWallBalls) {
      // Find the closest allowed rep count for Wall Balls
      const closestReps = wallBallsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isBoxExercise) {
      // Find the closest allowed rep count for Box exercises
      const closestReps = boxRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isToesToBar) {
      // Find the closest allowed rep count for Toes to Bar
      const closestReps = toesToBarRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isRowingCalories) {
      // Find the closest allowed rep count for Rowing Calories
      const closestReps = rowingCaloriesRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isPullups) {
      // Find the closest allowed rep count for Pull-ups
      const closestReps = pullupsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isAlternatingDumbbellSnatches) {
      // Find the closest allowed rep count for Alternating Dumbbell Snatches
      const closestReps = alternatingDumbbellSnatchesRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isHandstandPushups) {
      // Find the closest allowed rep count for Handstand Push-ups
      const closestReps = handstandPushupsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isBurpees) {
      // Find the closest allowed rep count for Burpees
      const closestReps = burpeesRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isRingMuscleUps) {
      // Find the closest allowed rep count for Ring Muscle Ups
      const closestReps = ringMuscleUpsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isRopeClimbs) {
      // Find the closest allowed rep count for Rope Climbs
      const closestReps = ropeClimbsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isLeglessRopeClimbs) {
      // Find the closest allowed rep count for Legless Rope Climbs
      const closestReps = leglessRopeClimbsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isGhdSitups) {
      // Find the closest allowed rep count for GHD Sit-ups
      const closestReps = ghdSitupsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isKettlebellSwings) {
      // Find the closest allowed rep count for Kettlebell Swings
      const closestReps = kettlebellSwingsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isKettlebellSnatches) {
      // Find the closest allowed rep count for Kettlebell Snatches
      const closestReps = kettlebellSnatchesRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isBikeCalories) {
      // Find the closest allowed rep count for Bike Calories
      const closestReps = bikeCaloriesRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isSkiCalories) {
      // Find the closest allowed rep count for Ski Calories
      const closestReps = skiCaloriesRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isBarMuscleUps) {
      // Find the closest allowed rep count for Bar Muscle Ups
      const closestReps = ringMuscleUpsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isDumbbellBoxStepUps) {
      // Find the closest allowed rep count for Dumbbell Box Step-Ups
      const closestReps = barbellRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isPushups) {
      // Find the closest allowed rep count for Push-ups
      const closestReps = handstandPushupsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    } else if (isStrictPullups) {
      // Find the closest allowed rep count for Strict Pull-ups
      const closestReps = ringMuscleUpsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
      return closestReps;
    }
    
    return Math.max(repsPerRound, 1);
  } else {
    // For Time: calculate reps that would take target duration divided by number of exercises
    const targetReps = Math.floor(baseRate * targetDuration / numExercises);
    return Math.max(targetReps, 1);
  }
}

function getTimeDomainRange(duration: number): string {
  if (duration <= 5) return '1:00 - 5:00';
  if (duration <= 10) return '5:00 - 10:00';
  if (duration <= 15) return '10:00 - 15:00';
  if (duration <= 20) return '15:00 - 20:00';
  return '20:00+';
}


// Helper function to find exercises compatible with a given exercise
function findCompatibleExercises(exercise: string, availableExercises: string[]): string[] {
  const compatibleExercises: string[] = [];
  
  for (const candidate of availableExercises) {
    if (candidate === exercise) continue; // Skip the same exercise
    
    // Test if this candidate is compatible
    const testExercises = [exercise, candidate];
    const testFiltered = filterExercisesForConsistency(testExercises);
    const testFinal = filterForbiddenPairs(testFiltered);
    
    // If both exercises survive the filtering, they're compatible
    if (testFinal.length === 2 && testFinal.includes(exercise) && testFinal.includes(candidate)) {
      compatibleExercises.push(candidate);
    }
  }
  
  return compatibleExercises;
}

function filterExercisesForConsistency(exerciseTypes: string[]): string[] {
  const hasBarbell = exerciseTypes.some(exercise => isBarbellExercise(exercise));
  const hasDumbbell = exerciseTypes.some(exercise => exercise.includes('Dumbbell'));
  const hasKettlebell = exerciseTypes.some(exercise => exercise.includes('Kettlebell'));
  
  // Debug logging for all equipment filtering
  console.log(`🔧 Equipment filtering for: [${exerciseTypes.join(', ')}]`);
  console.log(`   - Has Barbell: ${hasBarbell}`);
  console.log(`   - Has Dumbbell: ${hasDumbbell}`);
  console.log(`   - Has Kettlebell: ${hasKettlebell}`);
  
  // Universal barbell restriction: only one barbell exercise per workout
  if (hasBarbell) {
    const barbellExercises = exerciseTypes.filter(exercise => isBarbellExercise(exercise));
    if (barbellExercises.length > 1) {
      // Keep only the first barbell exercise, remove the rest
      const firstBarbell = barbellExercises[0];
      console.log(`   - Multiple barbells detected, keeping only: ${firstBarbell}`);
      return exerciseTypes.filter(exercise => !isBarbellExercise(exercise) || exercise === firstBarbell);
    }
  }
  
  // Equipment restrictions: cannot mix different equipment types
  if (hasBarbell && hasDumbbell) {
    // Prioritize barbell and remove dumbbell exercises
    console.log(`   - ⚠️ EQUIPMENT VIOLATION: Barbell + Dumbbell detected!`);
    console.log(`   - Removing dumbbell exercises due to barbell presence`);
    return exerciseTypes.filter(exercise => !exercise.includes('Dumbbell'));
  }
  
  if (hasBarbell && hasKettlebell) {
    // Prioritize barbell and remove kettlebell exercises
    return exerciseTypes.filter(exercise => !exercise.includes('Kettlebell'));
  }
  
  if (hasDumbbell && hasKettlebell) {
    // Prioritize dumbbell and remove kettlebell exercises
    return exerciseTypes.filter(exercise => !exercise.includes('Kettlebell'));
  }
  
  // All other combinations are allowed
  return exerciseTypes;
}

function filterForbiddenPairs(exerciseTypes: string[]): string[] {
  const forbiddenPairs = [
    ['Pull-ups', 'Chest to Bar Pull-ups'],
    ['Pull-ups', 'Toes to Bar'],
    ['Pull-ups', 'Ring Muscle Ups'],
    ['Handstand Push-ups', 'Push-ups'],
    ['Burpee Box Jump Overs', 'Box Jump Overs'], 
    ['Box Jump Overs', 'Box Jumps'],
    ['Burpee Box Jump Overs', 'Box Jumps'],
    ['Burpees', 'Burpee Box Jump Overs'],
    ['Rope Climbs', 'Legless Rope Climbs'],
    ['Rope Climbs', 'Ring Muscle Ups'],
    ['Rope Climbs', 'Toes to Bar'],
    ['Rope Climbs', 'Pull-ups'],
    ['Rope Climbs', 'Chest to Bar Pull-ups'],
    ['Legless Rope Climbs', 'Ring Muscle Ups'],
    ['GHD Sit-ups', 'Toes to Bar'],
    ['Kettlebell Swings', 'Alternating Dumbbell Snatches'],
    ['Kettlebell Swings', 'Dumbbell Thrusters'],
    ['Kettlebell Swings', 'Dumbbell Clean and Jerk'],
    ['Kettlebell Swings', 'Snatch'],
    ['Kettlebell Swings', 'Deadlifts'],
    ['Kettlebell Swings', 'Overhead Squats'],
    ['Kettlebell Swings', 'Thrusters'],
    ['Kettlebell Swings', 'Power Cleans'],
    ['Kettlebell Swings', 'Clean and Jerks'],
    ['Kettlebell Snatches', 'Alternating Dumbbell Snatches'],
    ['Kettlebell Snatches', 'Dumbbell Thrusters'],
    ['Kettlebell Snatches', 'Dumbbell Clean and Jerk'],
    ['Kettlebell Snatches', 'Snatch'],
    ['Kettlebell Snatches', 'Deadlifts'],
    ['Kettlebell Snatches', 'Overhead Squats'],
    ['Kettlebell Snatches', 'Thrusters'],
    ['Kettlebell Snatches', 'Power Cleans'],
    ['Kettlebell Snatches', 'Clean and Jerks'],
    ['Kettlebell Swings', 'Squat Cleans'],
    ['Kettlebell Swings', 'Squat Snatch'],
    ['Kettlebell Snatches', 'Squat Cleans'],
    ['Kettlebell Snatches', 'Squat Snatch'],
    ['Kettlebell Swings', 'Power Snatch'],
    ['Kettlebell Snatches', 'Power Snatch'],
    ['Kettlebell Swings', 'Bar Muscle Ups'],
    ['Kettlebell Snatches', 'Bar Muscle Ups'],
    ['Bar Muscle Ups', 'Rope Climbs'],
    ['Bar Muscle Ups', 'Legless Rope Climbs'],
    ['Bar Muscle Ups', 'Ring Muscle Ups'],
    ['Bar Muscle Ups', 'Ring Dips'],
    ['Ring Muscle Ups', 'Toes to Bar'],
    ['Ring Muscle Ups', 'Chest to Bar Pull-ups'],
    ['Bar Muscle Ups', 'Toes to Bar'],
    ['Bar Muscle Ups', 'Pull-ups'],
    ['Bar Muscle Ups', 'Chest to Bar Pull-ups'],
    ['Kettlebell Swings', 'Dumbbell Box Step-Ups'],
    ['Kettlebell Snatches', 'Dumbbell Box Step-Ups'],
    ['Strict Pull-ups', 'Rope Climbs'],
    ['Strict Pull-ups', 'Legless Rope Climbs'],
    ['Strict Pull-ups', 'Ring Muscle Ups'],
    ['Strict Pull-ups', 'Bar Muscle Ups'],
    ['Strict Pull-ups', 'Toes to Bar'],
    ['Strict Pull-ups', 'Chest to Bar Pull-ups'],
    ['Legless Rope Climbs', 'Chest to Bar Pull-ups'],
    ['Legless Rope Climbs', 'Pull-ups'],
    ['Legless Rope Climbs', 'Toes to Bar'],
    // Dumbbell exercise restrictions (only one per workout)
    ['Dumbbell Thrusters', 'Alternating Dumbbell Snatches'],
    ['Dumbbell Thrusters', 'Dumbbell Clean and Jerk'],
    ['Dumbbell Thrusters', 'Dumbbell Box Step-Ups'],
    ['Alternating Dumbbell Snatches', 'Dumbbell Clean and Jerk'],
    ['Alternating Dumbbell Snatches', 'Dumbbell Box Step-Ups'],
    ['Dumbbell Clean and Jerk', 'Dumbbell Box Step-Ups'],
    // Box exercise restrictions (only one per workout)
    ['Box Jumps', 'Box Jump Overs'],
    ['Box Jumps', 'Burpee Box Jump Overs'],
    ['Box Jumps', 'Dumbbell Box Step-Ups'],
    ['Box Jump Overs', 'Burpee Box Jump Overs'],
    ['Box Jump Overs', 'Dumbbell Box Step-Ups'],
    ['Burpee Box Jump Overs', 'Dumbbell Box Step-Ups'],
    // Cardio calorie restrictions (only one per workout)
    ['Rowing Calories', 'Bike Calories'],
    ['Rowing Calories', 'Ski Calories'],
    ['Bike Calories', 'Ski Calories']
  ];
  
  let filteredExercises = [...exerciseTypes];
  
  // Check for forbidden pairs and remove one exercise from each pair
  forbiddenPairs.forEach(pair => {
    const [exercise1, exercise2] = pair;
    if (filteredExercises.includes(exercise1) && filteredExercises.includes(exercise2)) {
      // Remove the second exercise from the pair (arbitrary choice)
      filteredExercises = filteredExercises.filter(ex => ex !== exercise2);
    }
  });
  
  return filteredExercises;
}

/**
 * Clusters exercises with similar rep counts (±2 threshold) to simplify workout tracking
 * Works with simple { name, reps } objects for AMRAP and Rounds For Time formats
 */
function clusterReps(exerciseReps: { name: string; reps: number }[]): void {
  if (exerciseReps.length < 2) return;
  
  // Group exercises by similar rep counts (±2 threshold)
  const clusters: { name: string; reps: number }[][] = [];
  const processed = new Set<number>();
  
  for (let i = 0; i < exerciseReps.length; i++) {
    if (processed.has(i)) continue;
    
    const cluster = [exerciseReps[i]];
    processed.add(i);
    
    // Find all exercises within ±2 reps of this one
    for (let j = i + 1; j < exerciseReps.length; j++) {
      if (processed.has(j)) continue;
      
      const repDiff = Math.abs(exerciseReps[i].reps - exerciseReps[j].reps);
      if (repDiff <= 2) {
        cluster.push(exerciseReps[j]);
        processed.add(j);
      }
    }
    
    clusters.push(cluster);
  }
  
  // For each cluster with 2+ exercises, assign the same rep count to all
  clusters.forEach(cluster => {
    if (cluster.length >= 2) {
      // Use the most common rep count
      const repCounts = cluster.map(ex => ex.reps);
      const mode = getMode(repCounts);
      
      cluster.forEach(exercise => {
        exercise.reps = mode;
      });
    }
  });
}

/**
 * Helper function to find the mode (most common value) in an array
 */
function getMode(numbers: number[]): number {
  const frequency: { [key: number]: number } = {};
  let maxFreq = 0;
  let mode = numbers[0];
  
  numbers.forEach(num => {
    frequency[num] = (frequency[num] || 0) + 1;
    if (frequency[num] > maxFreq) {
      maxFreq = frequency[num];
      mode = num;
    }
  });
  
  return mode;
}


function determineWorkoutEquipmentType(exerciseTypes: string[]): 'barbell' | 'dumbbell' | 'bodyweight' {
  const hasBarbell = exerciseTypes.some(exercise => isBarbellExercise(exercise));
  const hasDumbbell = exerciseTypes.some(exercise => exercise.includes('Dumbbell'));
  
  // If both barbell and dumbbell are present, prioritize barbell
  if (hasBarbell && hasDumbbell) {
    return 'barbell';
  } else if (hasBarbell) {
    return 'barbell';
  } else if (hasDumbbell) {
    return 'dumbbell';
  } else {
    return 'bodyweight';
  }
}

function isBarbellExercise(exerciseName: string): boolean {
  const barbellExercises = [
    'Deadlifts', 'Thrusters', 'Overhead Squats', 'Clean and Jerks', 'Power Cleans', 'Snatch',
    'Squat Cleans', 'Squat Snatch', 'Power Snatch'
  ];
  
  const isBarbell = barbellExercises.some(exercise => 
    exerciseName.includes(exercise) || exerciseName === exercise
  );
  
  // Debug logging for barbell detection
  if (exerciseName.includes('Overhead') || exerciseName.includes('Clean') || exerciseName.includes('Power')) {
    console.log(`isBarbellExercise(${exerciseName}): ${isBarbell}`);
  }
  
  return isBarbell;
}

function generateRepsForExercise(exerciseName: string, duration: number): number {
  const baseRate = exerciseRates[exerciseName] || 10.0;
  const reps = Math.floor(baseRate * duration * 0.1); // Scale down for workout generation
  return Math.max(reps, 1);
}

function calculateWorkoutDuration(exercises: Exercise[], format: string, rounds?: number, amrapTime?: number, pattern?: string): number {
  if (format === 'AMRAP' && amrapTime) {
    // For AMRAP, duration is the amrapTime
    return amrapTime;
  }
  
  if (format === 'For Time' && pattern) {
    // For For Time with pattern, calculate based on pattern
    const patternReps = pattern.split('-').map(Number);
    const totalRounds = patternReps.length;
    const totalRepsPerRound = patternReps.reduce((sum, reps) => sum + reps, 0);
    const totalReps = totalRepsPerRound * exercises.length; // Each exercise follows the pattern
    
    // Find limiting exercise (slowest rate)
    let limitingRate = Infinity;
    exercises.forEach(exercise => {
      const rate = exerciseRates[exercise.name] || 10.0;
      if (rate < limitingRate) {
        limitingRate = rate;
      }
    });
    
    return totalReps / limitingRate;
  }
  
  // For Rounds For Time, calculate based on exercise rates
  const totalRepsPerRound = exercises.reduce((sum, exercise) => sum + exercise.reps, 0);
  
  // Find limiting exercise (slowest rate)
  let limitingRate = Infinity;
  exercises.forEach(exercise => {
    const rate = exerciseRates[exercise.name] || 10.0; // default rate
    if (rate < limitingRate) {
      limitingRate = rate;
    }
  });
  
  if (format === 'Rounds For Time' && rounds) {
    // Total reps = reps per round × number of rounds
    const totalReps = totalRepsPerRound * rounds;
    return totalReps / limitingRate;
  } else {
    // For Time without pattern: just one round
    return totalRepsPerRound / limitingRate;
  }
}


function generateWeightForExercise(exerciseName: string): string {
  // Any Dumbbell Exercises (check this FIRST to catch dumbbell exercises before other checks)
  if (exerciseName.includes('Dumbbell')) {
    return '50/35'; // Fixed weight for all dumbbell exercises
  }
  
  // Deadlift, Back Squat, Front Squat
  if (['Deadlifts', 'Back Squat', 'Front Squat'].includes(exerciseName)) {
    const weightPairs = ['135/95', '185/135', '225/155', '275/185', '315/205'];
    return weightPairs[Math.floor(Math.random() * weightPairs.length)];
  }
  
  // Any Clean or Jerk (but NOT dumbbell exercises)
  if ((exerciseName.includes('Clean') || exerciseName.includes('Jerk') || exerciseName === 'Clean & Jerks') && !exerciseName.includes('Dumbbell')) {
    const weightPairs = ['75/55', '95/65', '115/75', '135/95', '165/115', '185/135', '225/155', '275/185', '315/205'];
    return weightPairs[Math.floor(Math.random() * weightPairs.length)];
  }
  
  // Any Snatch (but NOT dumbbell exercises)
  if (exerciseName.includes('Snatch') && !exerciseName.includes('Dumbbell')) {
    const weightPairs = ['75/55', '95/65', '115/75', '135/95', '165/115', '185/135', '225/155'];
    return weightPairs[Math.floor(Math.random() * weightPairs.length)];
  }
  
  // Thrusters and Overhead Squats
  if (['Thrusters', 'Overhead Squats'].includes(exerciseName)) {
    const weightPairs = ['75/55', '95/65', '115/75', '135/95', '165/115', '185/135', '225/155'];
    return weightPairs[Math.floor(Math.random() * weightPairs.length)];
  }
  
  // All other exercises (bodyweight, cardio, etc.) - no weight
  return undefined;
}

// Enhanced workout generation with ML weight prediction
export async function generateMLEnhancedWorkouts(): Promise<GeneratedWorkout[]> {
  const workouts: GeneratedWorkout[] = [];
  
  // Define time domains and target durations
  const timeDomains = [
    { range: '1:00 - 5:00', targetDuration: 3 },
    { range: '5:00 - 10:00', targetDuration: 7 },
    { range: '10:00 - 15:00', targetDuration: 12 },
    { range: '15:00 - 20:00', targetDuration: 17 },
    { range: '20:00+', targetDuration: 25 }
  ];
  
  const formats = ['For Time', 'AMRAP', 'Rounds For Time'];
  
  // Generate 2 workouts for each time domain
  for (const [domainIndex, domain] of timeDomains.entries()) {
    for (let i = 0; i < 2; i++) {
      // Random format
      const format = formats[Math.floor(Math.random() * formats.length)] as 'For Time' | 'AMRAP' | 'Rounds For Time';
      
      let amrapTime: number | undefined;
      let rounds: number | undefined;
      
      if (format === 'For Time') {
        amrapTime = undefined;
        rounds = undefined;
      } else if (format === 'AMRAP') {
        let minTime, maxTime;
        if (domain.range === '1:00 - 5:00') {
          minTime = 5; maxTime = 5;
        } else if (domain.range === '5:00 - 10:00') {
          minTime = 5; maxTime = 10;
        } else if (domain.range === '10:00 - 15:00') {
          minTime = 10; maxTime = 15;
        } else if (domain.range === '15:00 - 20:00') {
          minTime = 15; maxTime = 20;
        } else {
          minTime = 15; maxTime = 20;
        }
        amrapTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
        rounds = undefined;
      } else {
        rounds = Math.floor(Math.random() * 7) + 2;
        amrapTime = undefined;
      }
      
      // Step 3: Select pattern FIRST (for For Time workouts)
      let pattern: string | undefined;
      if (format === 'For Time') {
        // Select pattern first, then exercises will be filtered to work with this pattern
        const allPatterns = ['21-15-9', '15-12-9', '12-9-6', '10-8-6-4-2', '15-12-9-6-3', '27-21-15-9', '33-27-21-15-9', '50-40-30-20-10', '40-30-20-10'];
        
        // Determine exercise count first (needed for pattern selection)
        let numExercises: number;
        if (domain.targetDuration <= 10) {
          numExercises = Math.floor(Math.random() * 2) + 2; // 2-3 exercises
        } else {
          numExercises = Math.floor(Math.random() * 3) + 2; // 2-4 exercises
        }
        numExercises = Math.max(numExercises, 2);
        numExercises = Math.min(numExercises, 4); // Cap at 4 exercises maximum
        
        if (numExercises === 2) {
          // 2 exercises: can use any pattern
          pattern = allPatterns[Math.floor(Math.random() * allPatterns.length)];
        } else {
          // 3+ exercises: exclude longer patterns (unless high-volume exercises are present)
          const shorterPatterns = allPatterns.filter(p => 
            !['50-40-30-20-10', '40-30-20-10', '33-27-21-15-9', '27-21-15-9'].includes(p)
          );
          pattern = shorterPatterns[Math.floor(Math.random() * shorterPatterns.length)];
        }
      }
      
      // Step 4: Generate exercises that work with the selected pattern (if For Time)
      const exercises = generateExercisesForTimeDomain(domain.targetDuration, format, rounds, pattern);
        
        // Apply pattern to exercises (override the 0 reps)
        if (pattern) {
          const patternReps = pattern.split('-').map(Number);
          exercises.forEach((exercise, index) => {
            // Get the target reps from the pattern
            const targetReps = patternReps[index % patternReps.length];
            
            // Use the existing rep calculation function to get a reasonable base
            const baseReps = calculateRepsForTimeDomain(exercise.name, 5, 'AMRAP', 1, 1);
            
            // Scale the base reps to match the pattern proportionally
            const scaleFactor = targetReps / baseReps;
            const scaledReps = Math.round(baseReps * scaleFactor);
            
            // Use the existing function again to find the closest allowed rep count
            const finalReps = calculateRepsForTimeDomain(exercise.name, Math.max(scaledReps, 1), 'AMRAP', 1, 1);
            
            exercise.reps = finalReps;
          });
        }
      }
      
      // Calculate actual completion time
      let calculatedDuration = calculateWorkoutDuration(exercises, format, rounds, amrapTime, pattern);
      
      // Enforce duration constraints: minimum 4 minutes, maximum 25 minutes
      const minDuration = 4;
      const maxDuration = 25;
      if (calculatedDuration < minDuration) {
        calculatedDuration = minDuration;
      } else if (calculatedDuration > maxDuration) {
        calculatedDuration = maxDuration;
      }
      
      // Apply ML weight predictions to exercises
      const mlEnhancedExercises = await applyMLWeightPredictions(exercises, {
        format,
        timeDomain: domain.range,
        timeCapSeconds: calculatedDuration * 60,
        competitionLevel: 'Open'
      });
      
      const workout: GeneratedWorkout = {
        name: `ML Enhanced Workout ${domainIndex * 2 + i + 1}`,
        duration: calculatedDuration,
        format,
        amrapTime,
        rounds,
        timeDomain: getTimeDomainRange(calculatedDuration),
        exercises: mlEnhancedExercises,
        pattern
      };
      workouts.push(workout);
    }
  
  return workouts;
}

// Apply ML weight predictions to exercises
async function applyMLWeightPredictions(exercises: Exercise[], workoutContext: any): Promise<Exercise[]> {
  try {
    console.log('🤖 Attempting ML weight prediction for exercises:', exercises.map(e => e.name));
    
    // Import the ML predictor
    const { mlPredictor } = await import('./mlPredictor');
    
    // Check if ML API is healthy
    const isHealthy = await mlPredictor.checkHealth();
    if (!isHealthy) {
      console.warn('⚠️ ML API is not healthy, using original weights');
      return exercises;
    }
    
    console.log('✅ ML API is healthy, proceeding with predictions');
    
    // Filter to only weighted exercises that need ML predictions
    const weightedExercises = exercises.filter(exercise => 
      exercise.weight || isBarbellExercise(exercise.name) || exercise.name.includes('Dumbbell')
    );
    
    if (weightedExercises.length === 0) {
      console.log('📝 No weighted exercises found, skipping ML predictions');
      return exercises;
    }
    
    console.log(`🎯 Applying ML to ${weightedExercises.length} weighted exercises`);
    
    const enhancedExercises = await Promise.all(exercises.map(async (exercise) => {
      // Only apply ML to weighted exercises
      if (!exercise.weight && !isBarbellExercise(exercise.name) && !exercise.name.includes('Dumbbell')) {
        return exercise;
      }
      
      // Create workout context for ML prediction with ALL exercises for context
      const workoutForML = {
        exercises: exercises, // Use all exercises for better context
        format: workoutContext.format,
        time_domain: workoutContext.timeDomain,
        time_cap_seconds: workoutContext.timeCapSeconds,
        competition_level: workoutContext.competitionLevel
      };
      
      // Extract features and predict weights
      const features = mlPredictor.extractFeatures(workoutForML);
      const prediction = await mlPredictor.predictWeights(features);
      
      // Apply ML prediction to the exercise
      const mlWeight = `${prediction.male_weight}/${prediction.female_weight}`;
      
      console.log(`🎯 ML prediction for ${exercise.name}: ${exercise.weight} → ${mlWeight}`);
      
      return {
        ...exercise,
        weight: mlWeight
      };
    }));
    
    return enhancedExercises;
  } catch (error) {
    console.warn('❌ ML prediction failed, using original weights:', error);
    return exercises;
  }
}
