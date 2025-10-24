import { Workout, PerformancePrediction, GeneratedWorkout, Exercise } from './types';
import { exerciseDatabase } from './data';

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
const specialPatternRestrictions: { [key: string]: string[] } = {
  'Rope Climbs': ['10-8-6-4-2'],
  'Legless Rope Climbs': [],
  'Wall Balls': ['50-40-30-20-10', '40-30-20-10'],
  'Double Unders': ['50-40-30-20-10', '40-30-20-10'],
  'Rowing Calories': ['21-15-9', '15-12-9-6-3', '27-21-15-9', '33-27-21-15-9', '50-40-30-20-10', '40-30-20-10'],
  'Bike Calories': ['21-15-9', '15-12-9-6-3', '27-21-15-9', '33-27-21-15-9', '50-40-30-20-10', '40-30-20-10'],
  'Ski Calories': ['21-15-9', '15-12-9-6-3', '27-21-15-9', '33-27-21-15-9', '50-40-30-20-10', '40-30-20-10']
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

function getAllowedPatternsForExercises(exercises: string[]): string[] {
  let mostRestrictiveTier = 'lowSkill';
  
  for (const exercise of exercises) {
    if (exerciseDifficultyTiers.highSkill.includes(exercise)) {
      mostRestrictiveTier = 'highSkill';
      break;
    } else if (exerciseDifficultyTiers.highVolume.includes(exercise) && mostRestrictiveTier !== 'highSkill') {
      mostRestrictiveTier = 'highVolume';
    } else if (exerciseDifficultyTiers.moderate.includes(exercise) && mostRestrictiveTier === 'lowSkill') {
      mostRestrictiveTier = 'moderate';
    }
  }
  
  let allowedPatterns = patternRestrictions[mostRestrictiveTier as keyof typeof patternRestrictions];
  
  for (const exercise of exercises) {
    if (specialPatternRestrictions[exercise]) {
      const specialPatterns = specialPatternRestrictions[exercise];
      allowedPatterns = allowedPatterns.filter(pattern => specialPatterns.includes(pattern));
    }
  }
  
  return allowedPatterns;
}

export function generateTestWorkouts(): GeneratedWorkout[] {
  const workouts: GeneratedWorkout[] = [];
  
  const timeDomains = [
    { range: '1:00 - 5:00', targetDuration: 3 },
    { range: '5:00 - 10:00', targetDuration: 7 },
    { range: '10:00 - 15:00', targetDuration: 12 },
    { range: '15:00 - 20:00', targetDuration: 17 },
    { range: '20:00+', targetDuration: 25 }
  ];
  
  const formats = ['For Time', 'AMRAP', 'Rounds For Time'];
  
  timeDomains.forEach((domain, domainIndex) => {
    for (let i = 0; i < 2; i++) {
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
        // Rounds For Time - scale by time domain
        // Sprint workouts should have fewer rounds (higher intensity per round)
        if (domain.range === '1:00 - 5:00') {
          rounds = Math.floor(Math.random() * 3) + 1;  // 1-3 rounds
        } else if (domain.range === '5:00 - 10:00') {
          rounds = Math.floor(Math.random() * 3) + 3;  // 3-5 rounds
        } else if (domain.range === '10:00 - 15:00') {
          rounds = Math.floor(Math.random() * 3) + 5;  // 5-7 rounds
        } else if (domain.range === '15:00 - 20:00') {
          rounds = Math.floor(Math.random() * 4) + 6;  // 6-9 rounds
        } else {
          rounds = Math.floor(Math.random() * 5) + 8;  // 8-12 rounds
        }
        amrapTime = undefined;
      }
      
      let pattern: string | undefined;
      if (format === 'For Time') {
        const allPatterns = ['21-15-9', '15-12-9', '12-9-6', '10-8-6-4-2', '15-12-9-6-3', '27-21-15-9', '33-27-21-15-9', '50-40-30-20-10', '40-30-20-10'];
        
        let numExercises: number;
        if (domain.targetDuration <= 10) {
          numExercises = Math.floor(Math.random() * 2) + 2;
        } else {
          numExercises = Math.floor(Math.random() * 3) + 2;
        }
        numExercises = Math.max(numExercises, 2);
        numExercises = Math.min(numExercises, 4);
        
        if (numExercises === 2) {
          pattern = allPatterns[Math.floor(Math.random() * allPatterns.length)];
        } else {
          const shorterPatterns = allPatterns.filter(p => 
            !['50-40-30-20-10', '40-30-20-10', '33-27-21-15-9', '27-21-15-9'].includes(p)
          );
          pattern = shorterPatterns[Math.floor(Math.random() * shorterPatterns.length)];
        }
      }
      
      const exercises = generateExercisesForTimeDomain(domain.targetDuration, format, rounds, pattern);
        
      if (pattern) {
        const patternReps = pattern.split('-').map(Number);
        exercises.forEach((exercise) => {
          const targetReps = patternReps[0];
          const baseReps = calculateRepsForTimeDomain(exercise.name, 5, 'AMRAP', 1, 1);
          const scaleFactor = targetReps / baseReps;
          const scaledReps = Math.round(baseReps * scaleFactor);
          const finalReps = calculateRepsForTimeDomain(exercise.name, Math.max(scaledReps, 1), 'AMRAP', 1, 1);
          exercise.reps = finalReps;
        });
      }
      
      let calculatedDuration = calculateWorkoutDuration(exercises, format, rounds, amrapTime, pattern);
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
    const numExercises = Math.floor(Math.random() * 2) + 2;
    
    const patternCompatibleExercises = exerciseDatabase.filter(exercise => {
      if (exercise === 'Legless Rope Climbs') return false;
      if (!pattern) return true;
      
      const allowedPatterns = getAllowedPatternsForExercises([exercise]);
      return allowedPatterns.includes(pattern);
    });
    
    const shuffledExercises = [...patternCompatibleExercises].sort(() => Math.random() - 0.5);
    const filteredExercises: string[] = [];
    
    for (const candidate of shuffledExercises) {
      if (filteredExercises.length >= numExercises) break;
      
      const testExercises = [...filteredExercises, candidate];
      const testFiltered = filterExercisesForConsistency(testExercises);
      const testFinal = filterForbiddenPairs(testFiltered);
      
      if (testFinal.length === testExercises.length && testFinal.includes(candidate)) {
        filteredExercises.push(candidate);
      }
    }
    
    if (filteredExercises.length === 4) {
      const cardioExercises = ['Rowing Calories', 'Bike Calories', 'Ski Calories'];
      const hasCardio = filteredExercises.some(ex => cardioExercises.includes(ex));
      
      if (!hasCardio) {
        filteredExercises.pop();
        
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
    
    const barbellExercises = filteredExercises.filter(ex => isBarbellExercise(ex));
    const dumbbellExercises = filteredExercises.filter(ex => ex.includes('Dumbbell'));
    
    const barbellWeight = barbellExercises.length > 0 ? generateWeightForExercise(barbellExercises[0]) : undefined;
    const dumbbellWeight = dumbbellExercises.length > 0 ? generateWeightForExercise(dumbbellExercises[0]) : undefined;
    
    filteredExercises.forEach(exerciseName => {
      let weight: string | undefined;
      if (exerciseName.includes('Dumbbell')) {
        weight = dumbbellWeight;
      } else if (isBarbellExercise(exerciseName)) {
        weight = barbellWeight;
      }
      
      exercises.push({
        name: exerciseName,
        reps: 0,
        weight
      });
    });
    
    return exercises;
  }
  
  let numExercises: number;
  if (targetDuration <= 10) {
    numExercises = Math.floor(Math.random() * 2) + 2;
  } else {
    numExercises = Math.floor(Math.random() * 3) + 2;
  }
  
  numExercises = Math.max(numExercises, 2);
  numExercises = Math.min(numExercises, 4);
  
  const shuffledExercises = [...exerciseDatabase].sort(() => Math.random() - 0.5);
  const filteredExercises: string[] = [];
  
  for (const candidate of shuffledExercises) {
    if (filteredExercises.length >= numExercises) break;
    
    const testExercises = [...filteredExercises, candidate];
    const testFiltered = filterExercisesForConsistency(testExercises);
    const testFinal = filterForbiddenPairs(testFiltered);
    
    if (testFinal.length === testExercises.length && testFinal.includes(candidate)) {
      filteredExercises.push(candidate);
    }
  }
  
  if (filteredExercises.length === 4) {
    const cardioExercises = ['Rowing Calories', 'Bike Calories', 'Ski Calories'];
    const hasCardio = filteredExercises.some(ex => cardioExercises.includes(ex));
    
    if (!hasCardio) {
      filteredExercises.pop();
      
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
  
  const barbellExercises = filteredExercises.filter(ex => isBarbellExercise(ex));
  const dumbbellExercises = filteredExercises.filter(ex => ex.includes('Dumbbell'));
  
  const barbellWeight = barbellExercises.length > 0 ? generateWeightForExercise(barbellExercises[0]) : undefined;
  const dumbbellWeight = dumbbellExercises.length > 0 ? generateWeightForExercise(dumbbellExercises[0]) : undefined;
  
  const exerciseReps: { name: string; reps: number }[] = [];
  filteredExercises.forEach(exerciseName => {
    const reps = calculateRepsForTimeDomain(exerciseName, targetDuration, format, rounds, filteredExercises.length);
    exerciseReps.push({ name: exerciseName, reps });
  });
  
  if (format === 'AMRAP' || format === 'Rounds For Time') {
    clusterReps(exerciseReps);
  }
  
  exerciseReps.forEach(({ name, reps }) => {
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

function calculateRepsForTimeDomain(exerciseName: string, targetDuration: number, format: string, rounds?: number, numExercises: number = 3): number {
  const baseRate = exerciseRates[exerciseName] || 10.0;
  
  // Domain-specific rep factors
  // Note: Exercise rates are already realistic sustainable rates from actual workout data
  // These factors account for pacing strategy by workout length
  let repFactor;
  if (targetDuration <= 5) {
    repFactor = 1.0;   // Sprint: Full sustainable rate (all-out effort)
  } else if (targetDuration <= 10) {
    repFactor = 0.85;  // Short: 85% (some pacing needed)
  } else if (targetDuration <= 15) {
    repFactor = 0.75;  // Medium: 75% (steady pace)
  } else if (targetDuration <= 20) {
    repFactor = 0.65;  // Long: 65% (conservative pacing)
  } else {
    repFactor = 0.55;  // Extended: 55% (grind pace)
  }
  
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
  const isBarMuscleUps = exerciseName === 'Bar Muscle Ups';
  const isDumbbellBoxStepUps = exerciseName === 'Dumbbell Box Step-Ups';
  const isPushups = exerciseName === 'Push-ups';
  const isStrictPullups = exerciseName === 'Strict Pull-ups';
  
  if (format === 'AMRAP') {
    const totalTargetReps = Math.floor(baseRate * targetDuration * repFactor);
    
    let estimatedRounds: number;
    if (targetDuration <= 5) {
      estimatedRounds = Math.max(Math.floor(targetDuration / 1.5), 2);
    } else if (targetDuration <= 10) {
      estimatedRounds = Math.max(Math.floor(targetDuration / 1.8), 3);
    } else if (targetDuration <= 15) {
      estimatedRounds = Math.max(Math.floor(targetDuration / 2.0), 4);
    } else {
      estimatedRounds = Math.max(Math.floor(targetDuration / 2.2), 5);
    }
    
    const repsPerRound = Math.floor(totalTargetReps / estimatedRounds);
    
    if (isBarbellExerciseForReps) {
      return barbellRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isDoubleUnders) {
      return doubleUndersRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isWallBalls) {
      return wallBallsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isBoxExercise) {
      return boxRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isToesToBar) {
      return toesToBarRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isRowingCalories) {
      return rowingCaloriesRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isPullups) {
      return pullupsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isAlternatingDumbbellSnatches) {
      return alternatingDumbbellSnatchesRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isHandstandPushups) {
      return handstandPushupsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isBurpees) {
      return burpeesRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isRingMuscleUps) {
      return ringMuscleUpsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isRopeClimbs) {
      return ropeClimbsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isLeglessRopeClimbs) {
      return leglessRopeClimbsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isGhdSitups) {
      return ghdSitupsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isKettlebellSwings) {
      return kettlebellSwingsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isKettlebellSnatches) {
      return kettlebellSnatchesRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isBikeCalories) {
      return bikeCaloriesRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isSkiCalories) {
      return skiCaloriesRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isBarMuscleUps) {
      return ringMuscleUpsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isDumbbellBoxStepUps) {
      return barbellRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isPushups) {
      return handstandPushupsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isStrictPullups) {
      return ringMuscleUpsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    }
    
    return Math.max(repsPerRound, 1);
  } else if (format === 'Rounds For Time' && rounds) {
    const totalTargetReps = Math.floor(baseRate * targetDuration * repFactor);
    const repsPerRound = Math.floor(totalTargetReps / rounds);
    
    if (isBarbellExerciseForReps) {
      return barbellRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isDoubleUnders) {
      return doubleUndersRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    } else if (isWallBalls) {
      return wallBallsRepOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
      );
    }
    
    return Math.max(repsPerRound, 1);
  } else {
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

function filterExercisesForConsistency(exerciseTypes: string[]): string[] {
  const hasBarbell = exerciseTypes.some(exercise => isBarbellExercise(exercise));
  const hasDumbbell = exerciseTypes.some(exercise => exercise.includes('Dumbbell'));
  const hasKettlebell = exerciseTypes.some(exercise => exercise.includes('Kettlebell'));
  
  if (hasBarbell) {
    const barbellExercises = exerciseTypes.filter(exercise => isBarbellExercise(exercise));
    if (barbellExercises.length > 1) {
      const firstBarbell = barbellExercises[0];
      return exerciseTypes.filter(exercise => !isBarbellExercise(exercise) || exercise === firstBarbell);
    }
  }
  
  if (hasBarbell && hasDumbbell) {
    return exerciseTypes.filter(exercise => !exercise.includes('Dumbbell'));
  }
  
  if (hasBarbell && hasKettlebell) {
    return exerciseTypes.filter(exercise => !exercise.includes('Kettlebell'));
  }
  
  if (hasDumbbell && hasKettlebell) {
    return exerciseTypes.filter(exercise => !exercise.includes('Kettlebell'));
  }
  
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
    ['Rowing Calories', 'Bike Calories'],
    ['Rowing Calories', 'Ski Calories'],
    ['Bike Calories', 'Ski Calories']
  ];
  
  let filteredExercises = [...exerciseTypes];
  
  forbiddenPairs.forEach(pair => {
    const [exercise1, exercise2] = pair;
    if (filteredExercises.includes(exercise1) && filteredExercises.includes(exercise2)) {
      filteredExercises = filteredExercises.filter(ex => ex !== exercise2);
    }
  });
  
  return filteredExercises;
}

function clusterReps(exerciseReps: { name: string; reps: number }[]): void {
  if (exerciseReps.length < 2) return;
  
  const clusters: { name: string; reps: number }[][] = [];
  const processed = new Set<number>();
  
  for (let i = 0; i < exerciseReps.length; i++) {
    if (processed.has(i)) continue;
    
    const cluster = [exerciseReps[i]];
    processed.add(i);
    
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
  
  clusters.forEach(cluster => {
    if (cluster.length >= 2) {
      const repCounts = cluster.map(ex => ex.reps);
      const mode = getMode(repCounts);
      
      cluster.forEach(exercise => {
        exercise.reps = mode;
      });
    }
  });
}

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

function isBarbellExercise(exerciseName: string): boolean {
  const barbellExercises = [
    'Deadlifts', 'Thrusters', 'Overhead Squats', 'Clean and Jerks', 'Power Cleans', 'Snatch',
    'Squat Cleans', 'Squat Snatch', 'Power Snatch'
  ];
  
  return barbellExercises.some(exercise => 
    exerciseName.includes(exercise) || exerciseName === exercise
  );
}

function calculateWorkoutDuration(exercises: Exercise[], format: string, rounds?: number, amrapTime?: number, pattern?: string): number {
  if (format === 'AMRAP' && amrapTime) {
    return amrapTime;
  }
  
  if (format === 'For Time' && pattern) {
    const patternReps = pattern.split('-').map(Number);
    const totalRepsPerRound = patternReps.reduce((sum, reps) => sum + reps, 0);
    const totalReps = totalRepsPerRound * exercises.length;
    
    let limitingRate = Infinity;
    exercises.forEach(exercise => {
      const rate = exerciseRates[exercise.name] || 10.0;
      if (rate < limitingRate) {
        limitingRate = rate;
      }
    });
    
    return totalReps / limitingRate;
  }
  
  const totalRepsPerRound = exercises.reduce((sum, exercise) => sum + exercise.reps, 0);
  
  let limitingRate = Infinity;
  exercises.forEach(exercise => {
    const rate = exerciseRates[exercise.name] || 10.0;
    if (rate < limitingRate) {
      limitingRate = rate;
    }
  });
  
  if (format === 'Rounds For Time' && rounds) {
    const totalReps = totalRepsPerRound * rounds;
    return totalReps / limitingRate;
  } else {
    return totalRepsPerRound / limitingRate;
  }
}

function generateWeightForExercise(exerciseName: string): string {
  if (exerciseName.includes('Dumbbell')) {
    return '50/35';
  }
  
  if (['Deadlifts', 'Back Squat', 'Front Squat'].includes(exerciseName)) {
    const weightPairs = ['135/95', '185/135', '225/155', '275/185', '315/205'];
    return weightPairs[Math.floor(Math.random() * weightPairs.length)];
  }
  
  if ((exerciseName.includes('Clean') || exerciseName.includes('Jerk') || exerciseName === 'Clean & Jerks') && !exerciseName.includes('Dumbbell')) {
    const weightPairs = ['75/55', '95/65', '115/75', '135/95', '165/115', '185/135', '225/155', '275/185', '315/205'];
    return weightPairs[Math.floor(Math.random() * weightPairs.length)];
  }
  
  if (exerciseName.includes('Snatch') && !exerciseName.includes('Dumbbell')) {
    const weightPairs = ['75/55', '95/65', '115/75', '135/95', '165/115', '185/135', '225/155'];
    return weightPairs[Math.floor(Math.random() * weightPairs.length)];
  }
  
  if (['Thrusters', 'Overhead Squats'].includes(exerciseName)) {
    const weightPairs = ['75/55', '95/65', '115/75', '135/95', '165/115', '185/135', '225/155'];
    return weightPairs[Math.floor(Math.random() * weightPairs.length)];
  }
  
  return '';
}
