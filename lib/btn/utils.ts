import { Workout, PerformancePrediction, GeneratedWorkout, Exercise, UserProfile } from './types';
import { exerciseDatabase, exerciseEquipment } from './data';
import { calculateBenchmarkScores } from './benchmarks';

// Format-specific rule sets
const formatRules = {
  'For Time': {
    maxExercises: 3,
    minExercises: 2,
    patternRestrictions: true,
    cardioRequired: false, // Can't have 4 exercises, so this rule doesn't apply
    equipmentConsistency: true,
    forbiddenPairs: true,
    clustering: false
  },
  'AMRAP': {
    maxExercises: 4,
    minExercises: 2,
    patternRestrictions: false,
    cardioRequired: true, // If 4 exercises, force cardio inclusion
    equipmentConsistency: true,
    forbiddenPairs: true,
    clustering: true
  },
  'Rounds For Time': {
    maxExercises: 4,
    minExercises: 2,
    patternRestrictions: false,
    cardioRequired: true, // If 4 exercises, force cardio inclusion
    equipmentConsistency: true,
    forbiddenPairs: true,
    clustering: true
  }
};

// Exercise difficulty tiers for pattern compatibility
const exerciseDifficultyTiers = {
  highSkill: ['Snatch', 'Ring Muscle Ups', 'Handstand Push-ups', 'Rope Climbs', 'Legless Rope Climbs', 'Bar Muscle Ups'],
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

export function generateTestWorkouts(selectedDomainRanges?: string[], userProfile?: UserProfile): GeneratedWorkout[] {
  const workouts: GeneratedWorkout[] = [];
  
  const allTimeDomains = [
    { range: '1:00 - 5:00', minDuration: 1, maxDuration: 5 },
    { range: '5:00 - 10:00', minDuration: 5, maxDuration: 10 },
    { range: '10:00 - 15:00', minDuration: 10, maxDuration: 15 },
    { range: '15:00 - 20:00', minDuration: 15, maxDuration: 20 },
    { range: '20:00+', minDuration: 20, maxDuration: 25 }
  ];
  
  const allFormats = ['For Time', 'AMRAP', 'Rounds For Time'];
  
  // Filter to selected domains, or use all if none selected
  const timeDomains = selectedDomainRanges && selectedDomainRanges.length > 0
    ? allTimeDomains.filter(td => selectedDomainRanges.includes(td.range))
    : allTimeDomains;
  
  // Filter available exercises based on user profile
  let availableExercises = [...exerciseDatabase];
  
  if (userProfile) {
    console.log('🔍 Filtering exercises by user profile...');
    
    // Filter by equipment
    availableExercises = availableExercises.filter(exercise => {
      const required = exerciseEquipment[exercise] || [];
      if (required.length === 0) return true; // Bodyweight exercises
      
      // User must have ALL required equipment
      const hasAll = required.every(eq => userProfile.equipment.includes(eq));
      if (!hasAll) {
        console.log(`❌ ${exercise} excluded (missing equipment: ${required.filter(eq => !userProfile.equipment.includes(eq)).join(', ')})`);
      }
      return hasAll;
    });
    
    // Filter by skills
    availableExercises = availableExercises.filter(exercise => {
      const skillLevel = userProfile.skills[exercise];
      
      // If skill not tracked, include it (e.g., barbell movements)
      if (!skillLevel) return true;
      
      // Exclude if "Don't have it"
      if (skillLevel === "Don't have it") {
        console.log(`❌ ${exercise} excluded (skill marked as "Don't have it")`);
        return false;
      }
      
      return true;
    });
    
    console.log(`✅ Available exercises after filtering: ${availableExercises.length}/${exerciseDatabase.length}`);
    
    // Ensure we have minimum exercises for generation
    if (availableExercises.length < 10) {
      console.warn('⚠️ Too few exercises available after filtering, using all exercises');
      availableExercises = [...exerciseDatabase];
    }
  }
  
  // Generate 5 workouts with domain selection logic:
  // 1. Generate at least 1 from each selected domain
  // 2. Fill remainder randomly from selected domains
  const selectedCount = timeDomains.length;
  const guaranteedWorkouts = Math.min(selectedCount, 5);
  
  // First pass: Generate 1 workout from each selected domain (up to 5)
  for (let i = 0; i < guaranteedWorkouts; i++) {
    const domain = timeDomains[i];
    
    // For 1-5 min domain: AMRAP not allowed (must be 6+ min)
    const formats = domain.maxDuration < 6 
      ? ['For Time', 'Rounds For Time']  // No AMRAP for sprint domain
      : allFormats;
    
    {
      const format = formats[Math.floor(Math.random() * formats.length)] as 'For Time' | 'AMRAP' | 'Rounds For Time';
      
      let amrapTime: number | undefined;
      let rounds: number | undefined;
      let pattern: string | undefined;
      let targetDurationHint: number | undefined;
      
      if (format === 'For Time') {
        // For Time: Pick pattern, then calculate duration from work
        const allPatterns = ['21-15-9', '15-12-9', '12-9-6', '10-8-6-4-2', '15-12-9-6-3', '27-21-15-9', '33-27-21-15-9', '50-40-30-20-10', '40-30-20-10'];
        
        // Select pattern based on time domain (for variety)
        if (domain.maxDuration <= 10) {
          // Short workouts: lower volume patterns
          const shortPatterns = ['21-15-9', '15-12-9', '12-9-6', '10-8-6-4-2'];
          pattern = shortPatterns[Math.floor(Math.random() * shortPatterns.length)];
        } else {
          // Longer workouts: any pattern except the highest volume
          const moderatePatterns = allPatterns.filter(p => 
            !['50-40-30-20-10', '40-30-20-10'].includes(p)
          );
          pattern = moderatePatterns[Math.floor(Math.random() * moderatePatterns.length)];
        }
        amrapTime = undefined;
        rounds = undefined;
        targetDurationHint = undefined; // No target for For Time
      } else if (format === 'AMRAP') {
        // AMRAP: Pick duration from domain range - this IS the workout duration
        amrapTime = Math.floor(Math.random() * (domain.maxDuration - domain.minDuration + 1)) + domain.minDuration;
        rounds = undefined;
        pattern = undefined;
        targetDurationHint = amrapTime;
      } else {
        // Rounds For Time: Use domain hint for round calculation, then calculate actual duration
        targetDurationHint = Math.floor(Math.random() * (domain.maxDuration - domain.minDuration + 1)) + domain.minDuration;
        rounds = undefined;  // Will be calculated based on exercises
        amrapTime = undefined;
        pattern = undefined;
      }
      
      // Generate exercises (targetDurationHint is only used for Rounds For Time round calculation)
      const result = generateExercisesForTimeDomain(targetDurationHint || domain.minDuration, format, rounds, pattern, amrapTime, availableExercises, userProfile);
      const exercises = result.exercises;
      
      // Update rounds if calculated dynamically
      if (result.rounds !== undefined) {
        rounds = result.rounds;
      }
        
      // For "For Time": set each exercise to the total pattern reps
      if (pattern) {
        const patternReps = pattern.split('-').map(Number);
        const totalPatternReps = patternReps.reduce((sum, reps) => sum + reps, 0);
        exercises.forEach((exercise) => {
          exercise.reps = totalPatternReps;
        });
      }
      
      // Calculate ACTUAL duration from the work
      const calculatedDuration = calculateWorkoutDuration(exercises, format, rounds, amrapTime, pattern, userProfile);
      
      // Classify into time domain based on CALCULATED duration
      const actualTimeDomain = getTimeDomainRange(calculatedDuration);
      
      // Only add workout if it has at least 2 exercises AND meets time domain requirements
      const meetsMinimumExerciseRequirement = exercises.length >= 2 && 
        !(actualTimeDomain === '15:00 - 20:00' && exercises.length < 3) &&
        !(actualTimeDomain === '20:00+' && exercises.length < 3);
      
      if (meetsMinimumExerciseRequirement) {
        const workout: GeneratedWorkout = {
          name: `Workout ${i + 1}`,
          duration: calculatedDuration,  // Use calculated duration, not random target
          format,
          amrapTime,
          rounds,
          timeDomain: actualTimeDomain,  // Use actual classification
          exercises,
          pattern
        };
        
        // Calculate benchmark scores
        const benchmarks = calculateBenchmarkScores(workout, userProfile);
        workout.medianScore = benchmarks.medianScore;
        workout.excellentScore = benchmarks.excellentScore;
        
        workouts.push(workout);
      }
    }
  }
  
  // Second pass: Fill remainder randomly from selected domains (if < 5 domains selected)
  const remainingCount = 5 - workouts.length;
  for (let i = 0; i < remainingCount; i++) {
    const targetDomain = timeDomains[Math.floor(Math.random() * timeDomains.length)];
    
    // Retry logic to ensure workout lands in target domain
    let attempts = 0;
    const maxAttempts = 10;
    let workout: GeneratedWorkout | null = null;
    
    while (attempts < maxAttempts && !workout) {
      attempts++;
      
      // For 1-5 min domain: AMRAP not allowed (must be 6+ min)
      const formats = targetDomain.maxDuration < 6 
        ? ['For Time', 'Rounds For Time']  // No AMRAP for sprint domain
        : allFormats;
      
      const format = formats[Math.floor(Math.random() * formats.length)] as 'For Time' | 'AMRAP' | 'Rounds For Time';
      
      let amrapTime: number | undefined;
      let rounds: number | undefined;
      let pattern: string | undefined;
      let targetDurationHint: number | undefined;
      
      if (format === 'For Time') {
        const allPatterns = ['21-15-9', '15-12-9', '12-9-6', '10-8-6-4-2', '15-12-9-6-3', '27-21-15-9', '33-27-21-15-9', '50-40-30-20-10', '40-30-20-10'];
        
        if (targetDomain.maxDuration <= 10) {
          const shortPatterns = ['21-15-9', '15-12-9', '12-9-6', '10-8-6-4-2'];
          pattern = shortPatterns[Math.floor(Math.random() * shortPatterns.length)];
        } else {
          const moderatePatterns = allPatterns.filter(p => 
            !['50-40-30-20-10', '40-30-20-10'].includes(p)
          );
          pattern = moderatePatterns[Math.floor(Math.random() * moderatePatterns.length)];
        }
        amrapTime = undefined;
        rounds = undefined;
        targetDurationHint = undefined;
      } else if (format === 'AMRAP') {
        amrapTime = Math.floor(Math.random() * (targetDomain.maxDuration - targetDomain.minDuration + 1)) + targetDomain.minDuration;
        rounds = undefined;
        pattern = undefined;
        targetDurationHint = amrapTime;
        } else {
        targetDurationHint = Math.floor(Math.random() * (targetDomain.maxDuration - targetDomain.minDuration + 1)) + targetDomain.minDuration;
        rounds = undefined;
        amrapTime = undefined;
        pattern = undefined;
      }
      
      const result = generateExercisesForTimeDomain(targetDurationHint || targetDomain.minDuration, format, rounds, pattern, amrapTime, availableExercises, userProfile);
      const exercises = result.exercises;
      
      if (result.rounds !== undefined) {
        rounds = result.rounds;
      }
        
      if (pattern) {
        const patternReps = pattern.split('-').map(Number);
        const totalPatternReps = patternReps.reduce((sum, reps) => sum + reps, 0);
        exercises.forEach((exercise) => {
          exercise.reps = totalPatternReps;
        });
      }
      
      const calculatedDuration = calculateWorkoutDuration(exercises, format, rounds, amrapTime, pattern, userProfile);
      const actualTimeDomain = getTimeDomainRange(calculatedDuration);
      
      // Check if workout landed in target domain AND meets exercise requirements (or accept if max attempts reached)
      const meetsExerciseRequirement = exercises.length >= 2 && 
        !(actualTimeDomain === '15:00 - 20:00' && exercises.length < 3) &&
        !(actualTimeDomain === '20:00+' && exercises.length < 3);
      
      if ((actualTimeDomain === targetDomain.range && meetsExerciseRequirement) || attempts >= maxAttempts) {
        workout = {
          name: `Workout ${workouts.length + 1}`,
        duration: calculatedDuration,
        format,
        amrapTime,
        rounds,
          timeDomain: actualTimeDomain,
        exercises,
        pattern
      };
        
        // Calculate benchmark scores
        const benchmarks = calculateBenchmarkScores(workout, userProfile);
        workout.medianScore = benchmarks.medianScore;
        workout.excellentScore = benchmarks.excellentScore;
      }
    }
    
    if (workout) {
      workouts.push(workout);
    }
  }

  return workouts;
}

function generateExercisesForTimeDomain(targetDuration: number, format: string, rounds?: number, pattern?: string, amrapTime?: number, availableExercises?: string[], userProfile?: UserProfile): { exercises: Exercise[], rounds?: number } {
  const exercises: Exercise[] = [];
  const rules = formatRules[format as keyof typeof formatRules];
  if (!rules) {
    throw new Error(`Unknown format: ${format}`);
  }
  
  // Determine number of exercises based on format rules
  let numExercises: number;
  if (format === 'For Time') {
    numExercises = Math.floor(Math.random() * (rules.maxExercises - rules.minExercises + 1)) + rules.minExercises;
  } else {
    // AMRAP and Rounds For Time: based on time domain
    if (targetDuration <= 10) {
      numExercises = Math.floor(Math.random() * 2) + 2; // 2-3 exercises
    } else if (targetDuration <= 15) {
      numExercises = Math.floor(Math.random() * (rules.maxExercises - rules.minExercises + 1)) + rules.minExercises; // 2-4 exercises
    } else {
      // 15+ min workouts must have 3-4 exercises
      numExercises = Math.floor(Math.random() * 2) + 3; // 3-4 exercises
    }
  }

  // Use provided available exercises or default to all exercises
  let candidateExercises = availableExercises ? [...availableExercises] : [...exerciseDatabase];
  
  // Apply pattern restrictions for For Time format
  if (rules.patternRestrictions && pattern) {
    candidateExercises = candidateExercises.filter(exercise => {
      const allowedPatterns = getAllowedPatternsForExercises([exercise]);
      return allowedPatterns.includes(pattern);
    });
  }
    
  // Shuffle and select exercises
  const shuffledExercises = candidateExercises.sort(() => Math.random() - 0.5);
    const filteredExercises: string[] = [];
  const triedExercises = new Set<string>();
  
  // Keep trying until we have the right number of exercises
  while (filteredExercises.length < numExercises && triedExercises.size < shuffledExercises.length) {
    const remainingCandidates = shuffledExercises.filter(ex => !triedExercises.has(ex) && !filteredExercises.includes(ex));
    
    if (remainingCandidates.length === 0) break; // No more candidates to try
    
    let foundExercise = false;
    
    for (const candidate of remainingCandidates) {
      triedExercises.add(candidate);
      
      const testExercises = [...filteredExercises, candidate];
      
      // Apply global rules (equipment consistency and forbidden pairs)
      const testFiltered = filterExercisesForConsistency(testExercises);
      const testFinal = filterForbiddenPairs(testFiltered);
      
      // If the candidate passes all checks, add it
      if (testFinal.length === testExercises.length && testFinal.includes(candidate)) {
        filteredExercises.push(candidate);
        foundExercise = true;
        break; // Found a good exercise, move on to next slot
      }
    }
    
    // If we couldn't find a valid exercise for this slot, we're done
    if (!foundExercise) break;
  }
  
  // Apply cardio requirement for formats that support it
  if (rules.cardioRequired && filteredExercises.length === 4) {
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
    
  // Generate weights
    const barbellExercises = filteredExercises.filter(ex => isBarbellExercise(ex));
    const dumbbellExercises = filteredExercises.filter(ex => ex.includes('Dumbbell'));
    
  const barbellWeight = barbellExercises.length > 0 ? generateWeightForExercise(barbellExercises[0], userProfile) : undefined;
  const dumbbellWeight = dumbbellExercises.length > 0 ? generateWeightForExercise(dumbbellExercises[0], userProfile) : undefined;
  
  // For Rounds For Time: Calculate rounds based on actual exercises and their work rates
  if (format === 'Rounds For Time' && !rounds) {
    // Calculate rep factor based on time domain
    let repFactor;
    if (targetDuration <= 5) {
      repFactor = 1.0;
    } else if (targetDuration <= 10) {
      repFactor = 0.85;
    } else if (targetDuration <= 15) {
      repFactor = 0.75;
    } else if (targetDuration <= 20) {
      repFactor = 0.65;
    } else {
      repFactor = 0.55;
    }
    
    // Calculate estimated time per round based on actual exercises with adjusted rates
    let estimatedTimePerRound = 0;
    filteredExercises.forEach(exerciseName => {
      // Get weight for this exercise (barbell or dumbbell)
      let weight: number | undefined;
      if (isBarbellExercise(exerciseName) && barbellWeight) {
        weight = parseFloat(barbellWeight);
      } else if (exerciseName.includes('Dumbbell') && dumbbellWeight) {
        weight = parseFloat(dumbbellWeight);
      }
      
      const adjustedRate = getAdjustedWorkRate(exerciseName, weight, targetDuration, userProfile);
      // Estimate reasonable reps per exercise per round
      const estimatedRepsPerExercise = Math.floor(adjustedRate * targetDuration / filteredExercises.length / 4); // Divide by 4 as rough round estimate
      const timeForThisExercise = estimatedRepsPerExercise / adjustedRate;
      estimatedTimePerRound += timeForThisExercise;
    });
    
    // Calculate rounds based on duration and estimated time per round
    rounds = Math.max(Math.floor(targetDuration / estimatedTimePerRound), 2);
    
    // Ensure reasonable round counts by time domain
    if (targetDuration <= 5) {
      rounds = Math.max(Math.min(rounds, 3), 2);  // 2-3 rounds for sprint
    } else if (targetDuration <= 10) {
      rounds = Math.max(Math.min(rounds, 5), 3);  // 3-5 rounds for short
  } else {
      rounds = Math.max(Math.min(rounds, 7), 4);  // 4-7 rounds for medium+
    }
  }
  
  // Generate exercises with reps
  const exerciseReps: { name: string; reps: number }[] = [];
  
  if (format === 'AMRAP') {
    // AMRAP: Calculate each exercise individually with dynamic divisor
    const actualAmrapTime = amrapTime || targetDuration;
    
    // Calculate rep factor based on time domain
    let repFactor;
    if (actualAmrapTime <= 5) {
      repFactor = 1.0;
    } else if (actualAmrapTime <= 10) {
      repFactor = 0.85;
    } else if (actualAmrapTime <= 15) {
      repFactor = 0.75;
    } else if (actualAmrapTime <= 20) {
      repFactor = 0.65;
    } else {
      repFactor = 0.55;
    }
    
    // Calculate target rounds based on time domain and actual exercise difficulty
    // These divisors represent target time-per-round for different durations
    let targetTimePerRound: number;
    if (actualAmrapTime <= 5) {
      targetTimePerRound = 1.5;  // Sprint: ~90 seconds per round
    } else if (actualAmrapTime <= 10) {
      targetTimePerRound = 1.8;  // Short: ~108 seconds per round
    } else if (actualAmrapTime <= 15) {
      targetTimePerRound = 2.0;  // Medium: ~2 minutes per round
    } else {
      targetTimePerRound = 2.2;  // Extended: ~132 seconds per round
    }
    
    const estimatedRounds = Math.max(Math.floor(actualAmrapTime / targetTimePerRound), 2);
    
    // Calculate reps for each exercise individually using adjusted rates
    filteredExercises.forEach(exerciseName => {
      // Get weight for this exercise
      let weight: number | undefined;
      if (isBarbellExercise(exerciseName) && barbellWeight) {
        weight = parseFloat(barbellWeight);
      } else if (exerciseName.includes('Dumbbell') && dumbbellWeight) {
        weight = parseFloat(dumbbellWeight);
      }
      
      const adjustedRate = getAdjustedWorkRate(exerciseName, weight, actualAmrapTime, userProfile);
      const exerciseTotalReps = Math.floor(adjustedRate * actualAmrapTime);
      const exerciseRepsPerRound = Math.floor(exerciseTotalReps / estimatedRounds);
      const exerciseRepsPerExercise = Math.floor(exerciseRepsPerRound / filteredExercises.length);
      
      // Find closest match from rep options
      const reps = calculateRepsForTimeDomain(exerciseName, exerciseRepsPerExercise, format, rounds, filteredExercises.length, amrapTime);
      exerciseReps.push({ name: exerciseName, reps });
    });
  } else if (format === 'Rounds For Time' && rounds) {
    // Rounds For Time: Calculate each exercise individually with dynamic divisor
    // Calculate rep factor based on time domain
    let repFactor;
    if (targetDuration <= 5) {
      repFactor = 1.0;
    } else if (targetDuration <= 10) {
      repFactor = 0.85;
    } else if (targetDuration <= 15) {
      repFactor = 0.75;
    } else if (targetDuration <= 20) {
      repFactor = 0.65;
    } else {
      repFactor = 0.55;
    }
    
    // Calculate dynamic divisor based on actual exercises with adjusted rates
    let totalTimePerRound = 0;
    filteredExercises.forEach(exerciseName => {
      // Get weight for this exercise
      let weight: number | undefined;
      if (isBarbellExercise(exerciseName) && barbellWeight) {
        weight = parseFloat(barbellWeight);
      } else if (exerciseName.includes('Dumbbell') && dumbbellWeight) {
        weight = parseFloat(dumbbellWeight);
      }
      
      const adjustedRate = getAdjustedWorkRate(exerciseName, weight, targetDuration, userProfile);
      const estimatedRepsPerExercise = Math.floor(adjustedRate * targetDuration / filteredExercises.length);
      const timeForThisExercise = estimatedRepsPerExercise / adjustedRate;
      totalTimePerRound += timeForThisExercise;
    });
    
    const dynamicDivisor = totalTimePerRound;
    const estimatedRounds = Math.max(Math.floor(targetDuration / dynamicDivisor), 2);
    
    // Calculate reps for each exercise individually using adjusted rates
  filteredExercises.forEach(exerciseName => {
      // Get weight for this exercise
      let weight: number | undefined;
      if (isBarbellExercise(exerciseName) && barbellWeight) {
        weight = parseFloat(barbellWeight);
      } else if (exerciseName.includes('Dumbbell') && dumbbellWeight) {
        weight = parseFloat(dumbbellWeight);
      }
      
      const adjustedRate = getAdjustedWorkRate(exerciseName, weight, targetDuration, userProfile);
      const exerciseTotalReps = Math.floor(adjustedRate * targetDuration);
      const exerciseRepsPerRound = Math.floor(exerciseTotalReps / estimatedRounds);
      const exerciseRepsPerExercise = Math.floor(exerciseRepsPerRound / filteredExercises.length);
      
      // Find closest match from rep options
      const reps = calculateRepsForTimeDomain(exerciseName, exerciseRepsPerExercise, format, rounds, filteredExercises.length, amrapTime);
    exerciseReps.push({ name: exerciseName, reps });
  });
  } else {
    // Other formats: use existing logic
    filteredExercises.forEach(exerciseName => {
      const reps = calculateRepsForTimeDomain(exerciseName, targetDuration, format, rounds, filteredExercises.length, amrapTime);
      exerciseReps.push({ name: exerciseName, reps });
    });
  }
  
  // Apply clustering for formats that support it
  if (rules.clustering) {
    clusterReps(exerciseReps);
  }
  
  // Create final exercise objects
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
  
  // Sort exercises by rep count (ascending), except for 4-exercise workouts with cardio
  if (format === 'AMRAP' || format === 'Rounds For Time') {
    const cardioExercises = ['Rowing Calories', 'Bike Calories', 'Ski Calories'];
    const isCardio = (name: string) => cardioExercises.includes(name);
    
    if (exercises.length === 4 && exercises.some(ex => isCardio(ex.name))) {
      // Separate cardio and non-cardio exercises
      const nonCardioExercises = exercises.filter(ex => !isCardio(ex.name));
      const cardioExs = exercises.filter(ex => isCardio(ex.name));
      
      // Sort non-cardio by reps (ascending)
      nonCardioExercises.sort((a, b) => a.reps - b.reps);
      
      // Return combined array with cardio at the end
      return { exercises: [...nonCardioExercises, ...cardioExs], rounds };
    } else {
      // Sort all exercises by reps (ascending)
      exercises.sort((a, b) => a.reps - b.reps);
    }
  }
  
  return { exercises, rounds };
}

function calculateRepsForTimeDomain(exerciseName: string, targetDuration: number, format: string, rounds?: number, numExercises: number = 3, amrapTime?: number): number {
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
  
  // Barbell exercises - same options for all time domains
  const barbellRepOptions = [3, 5, 10, 12, 15, 20, 25, 30];
  const barbellTimeDomainOptions = {
    5: barbellRepOptions,
    10: barbellRepOptions,
    15: barbellRepOptions,
    20: barbellRepOptions,
    25: barbellRepOptions,
  };
  
  // Time-domain-specific rep options (organized by 1-5, 5-10, 10-15, 15-20, 20+)
  const timeDomainRepOptions: { [key: string]: { [key: number]: number[] } } = {
    'Rowing Calories': {
      5: [10, 12],
      10: [10, 12, 15, 18],
      15: [15, 21, 25, 30],
      20: [20, 24, 30, 35, 40],
      25: [30, 35, 40, 50],
    },
    'Bike Calories': {
      5: [10, 12],
      10: [10, 12, 15, 18],
      15: [15, 21, 25, 30],
      20: [20, 24, 30, 35, 40],
      25: [30, 35, 40, 50],
    },
    'Ski Calories': {
      5: [10, 12],
      10: [10, 12, 15, 18],
      15: [15, 21, 25, 30],
      20: [20, 24, 30, 35, 40],
      25: [30, 35, 40, 50],
    },
    'Pull-ups': {
      5: [5, 7, 9, 10],
      10: [7, 9, 10, 12, 15],
      15: [10, 12, 15, 18, 20],
      20: [12, 15, 18, 20, 24],
      25: [15, 20, 24, 30],
    },
    'Chest to Bar Pull-ups': {
      5: [5, 7, 9, 10],
      10: [7, 9, 10, 12, 15],
      15: [10, 12, 15, 18, 20],
      20: [12, 15, 18, 20, 24],
      25: [15, 20, 24, 30],
    },
    'Toes to Bar': {
      5: [5, 7, 9, 10],
      10: [7, 9, 10, 12, 15],
      15: [10, 12, 15, 18, 20],
      20: [12, 15, 18, 20, 24],
      25: [15, 20, 24, 30],
    },
    'Bar Muscle Ups': {
      5: [3, 5, 7],
      10: [3, 5, 7],
      15: [7, 9, 10, 12],
      20: [7, 9, 10, 12, 15, 18],
      25: [10, 12, 15, 18, 20],
    },
    'Strict Pull-ups': {
      5: [3, 5],
      10: [3, 5, 7],
      15: [5, 7, 9, 10],
      20: [7, 9, 10, 12],
      25: [7, 9, 10, 12],
    },
    'Ring Muscle Ups': {
      5: [3, 5, 7],
      10: [3, 5, 7],
      15: [7, 9, 10, 12],
      20: [7, 9, 10, 12, 15, 18],
      25: [10, 12, 15, 18, 20],
    },
    'Handstand Push-ups': {
      5: [5, 7, 9, 10],
      10: [7, 9, 10, 12],
      15: [10, 12, 15, 18],
      20: [12, 15, 20, 24],
      25: [15, 18, 20, 24, 25, 30],
    },
    'Burpees': {
      5: [5, 7, 9, 10],
      10: [7, 9, 10, 12],
      15: [10, 12, 15, 18],
      20: [12, 15, 20, 24],
      25: [15, 18, 20, 24, 25, 30],
    },
    'Push-ups': {
      5: [5, 7, 9, 10],
      10: [7, 9, 10, 12],
      15: [10, 12, 15, 18],
      20: [12, 15, 20, 24],
      25: [15, 18, 20, 24, 25, 30],
    },
    'Double Unders': {
      5: [15, 20, 25, 30],
      10: [25, 30, 35],
      15: [30, 35, 40, 50],
      20: [35, 40, 50, 60],
      25: [40, 50, 60, 75, 100],
    },
    'GHD Sit-ups': {
      5: [7, 9, 10],
      10: [10, 12, 15],
      15: [10, 15, 18, 25],
      20: [20, 24, 25, 30],
      25: [20, 24, 25, 30, 40],
    },
    'Rope Climbs': {
      5: [2, 3],
      10: [2, 3],
      15: [2, 3, 5],
      20: [2, 3, 5],
      25: [2, 3, 5],
    },
    'Legless Rope Climbs': {
      5: [1],
      10: [1, 2],
      15: [1, 2, 3],
      20: [1, 2, 3],
      25: [1, 2, 3],
    },
    'Wall Balls': {
      5: [10, 12, 15],
      10: [10, 12, 15, 18, 20],
      15: [18, 20, 24, 30],
      20: [20, 24, 30, 35],
      25: [20, 30, 35, 40, 50],
    },
    'Kettlebell Swings': {
      5: [10, 12, 15],
      10: [10, 12, 15, 18, 20],
      15: [18, 20, 24, 30],
      20: [20, 24, 30, 35],
      25: [20, 30, 35, 40, 50],
    },
    'Kettlebell Snatches': {
      5: [10, 12, 15],
      10: [10, 12, 15, 18, 20],
      15: [18, 20, 24, 30],
      20: [20, 24, 30, 35],
      25: [20, 30, 35, 40, 50],
    },
    'Alternating Dumbbell Snatches': {
      5: [6, 8, 10],
      10: [10, 12, 18],
      15: [12, 18, 20, 24, 30],
      20: [20, 24, 30, 40],
      25: [24, 30, 36, 40, 50],
    },
    'Box Jumps': {
      5: [5, 7, 9],
      10: [7, 9, 10, 12],
      15: [10, 12, 15],
      20: [12, 15, 18, 20],
      25: [15, 18, 24, 30],
    },
    'Box Jump Overs': {
      5: [5, 7, 9],
      10: [7, 9, 10, 12],
      15: [10, 12, 15],
      20: [12, 15, 18, 20],
      25: [15, 18, 24, 30],
    },
    'Burpee Box Jump Overs': {
      5: [5, 7, 9],
      10: [7, 9, 10, 12],
      15: [10, 12, 15],
      20: [12, 15, 18, 20],
      25: [15, 18, 24, 30],
    },
    // Barbell exercises - same options for all time domains
    'Snatch': barbellTimeDomainOptions,
    'Deadlifts': barbellTimeDomainOptions,
    'Overhead Squats': barbellTimeDomainOptions,
    'Thrusters': barbellTimeDomainOptions,
    'Power Cleans': barbellTimeDomainOptions,
    'Clean and Jerks': barbellTimeDomainOptions,
    'Squat Cleans': barbellTimeDomainOptions,
    'Squat Snatch': barbellTimeDomainOptions,
    'Power Snatch': barbellTimeDomainOptions,
    'Dumbbell Thrusters': barbellTimeDomainOptions,
    'Dumbbell Clean and Jerk': barbellTimeDomainOptions,
    'Dumbbell Box Step-Ups': barbellTimeDomainOptions,
  };
  
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
    // AMRAP format: targetDuration is actually the pre-calculated reps per exercise
    // from the dynamic divisor logic in generateExercisesForTimeDomain
    // This is just snapping to clean numbers
    const repsPerExercise = targetDuration;
    
    // Determine time domain key (5=1-5min, 10=5-10min, 15=10-15min, 20=15-20min, 25=20+min)
    let timeDomainKey = 5;
    if (amrapTime && amrapTime <= 5) timeDomainKey = 5;
    else if (amrapTime && amrapTime <= 10) timeDomainKey = 10;
    else if (amrapTime && amrapTime <= 15) timeDomainKey = 15;
    else if (amrapTime && amrapTime <= 20) timeDomainKey = 20;
    else timeDomainKey = 25;
    
    // Get time-domain-specific rep options if available
    const timeDomainOptions = timeDomainRepOptions[exerciseName]?.[timeDomainKey];
    
    if (timeDomainOptions) {
      return timeDomainOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerExercise) < Math.abs(prev - repsPerExercise) ? curr : prev
      );
    }
    
    // Fallback for any exercises not in the time-domain table
    return Math.max(repsPerExercise, 1);
  } else if (format === 'Rounds For Time' && rounds) {
    const totalTargetReps = Math.floor(baseRate * targetDuration * repFactor);
    const repsPerRound = Math.floor(totalTargetReps / rounds);
    
    // NEW LOGIC: Divide by number of exercises for realistic per-exercise reps
    const repsPerExercise = Math.floor(repsPerRound / numExercises);
    
    // Determine time domain key (5=1-5min, 10=5-10min, 15=10-15min, 20=15-20min, 25=20+min)
    let timeDomainKey = 5;
    if (targetDuration <= 5) timeDomainKey = 5;
    else if (targetDuration <= 10) timeDomainKey = 10;
    else if (targetDuration <= 15) timeDomainKey = 15;
    else if (targetDuration <= 20) timeDomainKey = 20;
    else timeDomainKey = 25;
    
    // Get time-domain-specific rep options if available
    const timeDomainOptions = timeDomainRepOptions[exerciseName]?.[timeDomainKey];
    
    if (timeDomainOptions) {
      return timeDomainOptions.reduce((prev, curr) => 
        Math.abs(curr - repsPerExercise) < Math.abs(prev - repsPerExercise) ? curr : prev
      );
    }
    
    // Fallback for any exercises not in the time-domain table
    return Math.max(repsPerExercise, 1);
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
  
  if (hasDumbbell) {
    const dumbbellExercises = exerciseTypes.filter(exercise => exercise.includes('Dumbbell'));
    if (dumbbellExercises.length > 1) {
      const firstDumbbell = dumbbellExercises[0];
      return exerciseTypes.filter(exercise => !exercise.includes('Dumbbell') || exercise === firstDumbbell);
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
    ['Bike Calories', 'Ski Calories'],
    ['Ring Muscle Ups', 'Chest to Bar Pull-ups'],
    ['Legless Rope Climbs', 'Chest to Bar Pull-ups'],
    ['Box Jump Overs', 'Dumbbell Box Step-Ups'],
    ['Ring Muscle Ups', 'Strict Pull-ups'],
    ['Bar Muscle Ups', 'Chest to Bar Pull-ups'],
    ['Ring Muscle Ups', 'Bar Muscle Ups'],
    ['Chest to Bar Pull-ups', 'Toes to Bar'],
    ['Push-ups', 'Burpees'],
    ['Strict Pull-ups', 'Pull-ups'],
    ['Strict Pull-ups', 'Chest to Bar Pull-ups'],
    ['Strict Pull-ups', 'Bar Muscle Ups'],
    ['Strict Pull-ups', 'Rope Climbs'],
    ['Strict Pull-ups', 'Legless Rope Climbs']
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

function calculateWorkoutDuration(exercises: Exercise[], format: string, rounds?: number, amrapTime?: number, pattern?: string, userProfile?: UserProfile): number {
  if (format === 'AMRAP' && amrapTime) {
    return amrapTime;
  }
  
  // Estimate duration for rep factor calculation (use actual if available, otherwise estimate from exercises)
  const estimatedDuration = amrapTime || (rounds ? 12 : 8); // Rough estimate if not available
  
  if (format === 'For Time' && pattern) {
    const patternReps = pattern.split('-').map(Number);
    const totalRepsPerRound = patternReps.reduce((sum, reps) => sum + reps, 0);
    const totalReps = totalRepsPerRound * exercises.length;
    
    // Calculate each exercise separately at its adjusted rate
    let totalTime = 0;
    exercises.forEach(exercise => {
      const weight = getExerciseWeight(exercise);
      // Use estimated duration for rep factor calculation
      const adjustedRate = getAdjustedWorkRate(exercise.name, weight, estimatedDuration, userProfile);
      const timeForThisExercise = exercise.reps / adjustedRate;
      totalTime += timeForThisExercise;
    });
    
    return totalTime;
  }
  
  // Calculate each exercise separately at its adjusted rate
  let totalTimePerRound = 0;
  exercises.forEach(exercise => {
    const weight = getExerciseWeight(exercise);
    // Use estimated duration for rep factor calculation
    const adjustedRate = getAdjustedWorkRate(exercise.name, weight, estimatedDuration, userProfile);
    const timeForThisExercise = exercise.reps / adjustedRate;
    totalTimePerRound += timeForThisExercise;
  });
  
  if (format === 'Rounds For Time' && rounds) {
    return totalTimePerRound * rounds;
  } else {
    return totalTimePerRound;
  }
}

function generateWeightForExercise(exerciseName: string, userProfile?: UserProfile): string {
  // Get standard weight options for this exercise
  let weightPairs: string[] = [];
  
  if (exerciseName.includes('Dumbbell')) {
    weightPairs = ['50/35'];
  } else if (['Deadlifts'].includes(exerciseName)) {
    weightPairs = ['135/95', '185/135', '225/155', '275/185', '315/205'];
  } else if ((exerciseName.includes('Clean') || exerciseName.includes('Jerk') || exerciseName === 'Clean and Jerks') && !exerciseName.includes('Dumbbell')) {
    weightPairs = ['75/55', '95/65', '115/75', '135/95', '165/115', '185/135', '225/155', '275/185', '315/205'];
  } else if (exerciseName.includes('Snatch') && !exerciseName.includes('Dumbbell')) {
    weightPairs = ['75/55', '95/65', '115/75', '135/95', '165/115', '185/135', '225/155'];
  } else if (['Thrusters', 'Overhead Squats'].includes(exerciseName)) {
    weightPairs = ['75/55', '95/65', '115/75', '135/95', '165/115', '185/135', '225/155'];
  } else {  
    return '';
  }

  // If user profile provided, apply personalization
  if (userProfile && weightPairs.length > 0) {
    // Get relevant 1RM for this exercise
    const oneRM = getRelevantOneRM(exerciseName, userProfile.oneRMs);
    
    if (oneRM) {
      // Calculate 80% cap
      const cap = oneRM * 0.8;
      
      // Filter weight pairs to those within cap
      const validPairs = weightPairs.filter(pair => {
        const [male, female] = pair.split('/').map(Number);
        const userWeight = userProfile.gender === 'Female' ? female : male;
        return userWeight <= cap;
      });
      
      // If we have valid options, pick random from them
      if (validPairs.length > 0) {
        const selectedPair = validPairs[Math.floor(Math.random() * validPairs.length)];
        
        // Return gender-specific weight (single value, not pair)
        const [male, female] = selectedPair.split('/').map(Number);
        const weight = userProfile.gender === 'Female' ? female : male;
        
        return `${weight}`;
      } else {
        // Cap is below all standard weights - use minimum
        const minPair = weightPairs[0];
        const [male, female] = minPair.split('/').map(Number);
        const weight = userProfile.gender === 'Female' ? female : male;
        
        console.warn(`⚠️ ${exerciseName}: 80% of 1RM (${cap}#) is below minimum weight (${weight}#), using minimum`);
        return `${weight}`;
      }
    }
    
    // No 1RM available, but still apply gender parsing
    const randomPair = weightPairs[Math.floor(Math.random() * weightPairs.length)];
    const [male, female] = randomPair.split('/').map(Number);
    const weight = userProfile.gender === 'Female' ? female : male;
    return `${weight}`;
  }
  
  // No user profile - return standard pair format
  return weightPairs[Math.floor(Math.random() * weightPairs.length)];
}

// Helper: Get relevant 1RM for an exercise
function getRelevantOneRM(exerciseName: string, oneRMs: { [key: string]: number }): number | null {
  // Snatch family
  if (['Snatch', 'Power Snatch', 'Squat Snatch'].includes(exerciseName)) {
    return oneRMs['Snatch'] || null;
  }
  
  // Clean family (use Clean and Jerk 1RM)
  if (['Power Clean', 'Squat Clean', 'Clean and Jerks', 'Squat Cleans', 'Power Cleans'].includes(exerciseName)) {
    return oneRMs['Clean and Jerk'] || null;
  }
  
  // Thrusters (70% of Clean & Jerk)
  if (exerciseName === 'Thrusters') {
    const cleanAndJerk = oneRMs['Clean and Jerk'];
    return cleanAndJerk ? cleanAndJerk * 0.7 : null;
  }
  
  // Overhead Squat
  if (['Overhead Squats', 'Overhead Squat'].includes(exerciseName)) {
    return oneRMs['Overhead Squat'] || null;
  }
  
  // Deadlift
  if (exerciseName === 'Deadlifts') {
    return oneRMs['Deadlift'] || null;
  }
  
  return null;
}

// Get weight-adjusted work rate multiplier for barbell exercises
function getBarbellWeightMultiplier(exerciseName: string, weight: number, userProfile?: UserProfile): number {
  if (!userProfile || !isBarbellExercise(exerciseName)) {
    return 1.0; // No adjustment without profile or for non-barbell exercises
  }
  
  const oneRM = getRelevantOneRM(exerciseName, userProfile.oneRMs);
  if (!oneRM || oneRM === 0) {
    return 1.0; // No adjustment without 1RM data
  }
  
  // Max allowed weight (80% cap)
  const maxWeight = oneRM * 0.8;
  const effectiveWeight = Math.min(weight, maxWeight);
  
  // Intensity as % of max allowed (0.0 to 1.0)
  const intensity = effectiveWeight / maxWeight;
  
  // Get movement-specific degradation rate
  let degradationRate: number;
  if (['Deadlifts', 'Power Cleans', 'Power Snatch'].includes(exerciseName)) {
    degradationRate = 0.7;  // Mild degradation
  } else if (['Clean and Jerks', 'Snatch', 'Thrusters'].includes(exerciseName)) {
    degradationRate = 0.8;  // Medium degradation
  } else if (['Squat Cleans', 'Squat Snatch', 'Overhead Squats'].includes(exerciseName)) {
    degradationRate = 1.0;  // Highest degradation
  } else {
    degradationRate = 0.8;  // Default to medium
  }
  
  // Calculate speed multiplier
  // At 50% of max: 1.0x, at 100% of max (cap): multiplier based on degradation rate
  if (intensity <= 0.5) {
    return 1.0;
  } else {
    return 1.0 - ((intensity - 0.5) * degradationRate);
  }
}

// Get final adjusted work rate (base rate × weight multiplier × time repFactor)
export function getAdjustedWorkRate(
  exerciseName: string,
  weight: number | undefined,
  targetDuration: number,
  userProfile?: UserProfile
): number {
  const baseRate = exerciseRates[exerciseName] || 10.0;
  
  // Apply weight-based multiplier (for barbell exercises)
  let weightMultiplier = 1.0;
  if (weight !== undefined && isBarbellExercise(exerciseName)) {
    const weightNum = typeof weight === 'string' ? parseFloat(weight) : weight;
    if (!isNaN(weightNum)) {
      weightMultiplier = getBarbellWeightMultiplier(exerciseName, weightNum, userProfile);
    }
  }
  
  // Apply time-domain rep factor
  let repFactor = 1.0;
  if (targetDuration <= 5) {
    repFactor = 1.0;
  } else if (targetDuration <= 10) {
    repFactor = 0.85;
  } else if (targetDuration <= 15) {
    repFactor = 0.75;
  } else if (targetDuration <= 20) {
    repFactor = 0.65;
  } else {
    repFactor = 0.55;
  }
  
  return baseRate * weightMultiplier * repFactor;
}

// Helper: Extract weight number from exercise or weight string
export function getExerciseWeight(exercise: Exercise): number | undefined {
  if (exercise.weight) {
    const weightNum = parseFloat(exercise.weight);
    return isNaN(weightNum) ? undefined : weightNum;
  }
  return undefined;
}
