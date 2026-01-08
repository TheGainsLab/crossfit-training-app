import { Workout, PerformancePrediction, GeneratedWorkout, Exercise, UserProfile } from './types';
import { calculateBenchmarkScores } from './benchmarks';
import { fetchBTNExercises, buildExerciseMaps, BTNExerciseMaps } from './db';

// Module-level state for exercise data (populated from database)
let _exerciseDataInitialized = false;
let _exerciseDatabase: string[] = [];
let _exerciseEquipment: { [key: string]: string[] } = {};
let _exerciseRates: { [key: string]: number } = {};
let _maxRepsPerRound: { [key: string]: number } = {};
let _allRepOptions: { [key: string]: number[] } = {};
let _exerciseDifficultyTiers: { highSkill: string[]; highVolume: string[]; moderate: string[]; lowSkill: string[] } = {
  highSkill: [], highVolume: [], moderate: [], lowSkill: []
};
let _weightDegradationRates: { [key: string]: number } = {};

/**
 * Initialize BTN exercise data from database
 * This must be called before generating workouts
 */
async function initializeBTNExerciseData(): Promise<void> {
  if (_exerciseDataInitialized) return;

  try {
    const exercises = await fetchBTNExercises();
    const maps = buildExerciseMaps(exercises);

    _exerciseDatabase = maps.exerciseDatabase;
    _exerciseEquipment = maps.exerciseEquipment;
    _exerciseRates = maps.exerciseRates;
    _maxRepsPerRound = maps.maxRepsPerRound;
    _allRepOptions = maps.allRepOptions;
    _exerciseDifficultyTiers = maps.exerciseDifficultyTiers;
    _weightDegradationRates = maps.weightDegradationRates;
    _exerciseDataInitialized = true;

    console.log(`✅ BTN exercise data initialized: ${_exerciseDatabase.length} exercises`);
  } catch (error) {
    console.error('❌ Failed to initialize BTN exercise data from database:', error);
    throw error;
  }
}

// Export for use in page.tsx filtering
export function getExerciseEquipment(): { [key: string]: string[] } {
  return _exerciseEquipment;
}

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

// Exercise difficulty tiers - now loaded from database via _exerciseDifficultyTiers
// Kept as reference for pattern restrictions logic

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

// Exercise rates - now loaded from database via _exerciseRates

// === DECAY MODEL CONSTANTS ===
// Derived from empirical pacing factors: 0.9 decay per round matches observed data
// Round 1: 100%, Round 5: 66%, Round 10: 39%
const DECAY_FACTOR = 0.9;

// Max reps per round - now loaded from database via _maxRepsPerRound
// All valid rep options - now loaded from database via _allRepOptions

// === DECAY MODEL FUNCTIONS ===

/**
 * Calculate time for a single round at a given round number (1-indexed)
 * Accounts for decay (fatigue) as rounds progress
 */
function calculateRoundTime(
  exercises: { name: string; reps: number; weight?: string }[],
  roundNum: number,
  userProfile?: UserProfile
): number {
  const decayMultiplier = Math.pow(DECAY_FACTOR, roundNum - 1);
  let time = 0;

  for (const exercise of exercises) {
    const baseRate = _exerciseRates[exercise.name] || 10.0;
    const weight = exercise.weight ? parseFloat(exercise.weight) : undefined;
    const weightMultiplier = weight && isBarbellExercise(exercise.name)
      ? getBarbellWeightMultiplier(exercise.name, weight, userProfile)
      : 1.0;

    // Effective rate = base × weight adjustment × decay
    const effectiveRate = baseRate * weightMultiplier * decayMultiplier;
    time += exercise.reps / effectiveRate;
  }

  return time;
}

/**
 * Calculate total time for R rounds with decay
 */
function calculateTotalTimeWithDecay(
  exercises: { name: string; reps: number; weight?: string }[],
  rounds: number,
  userProfile?: UserProfile
): number {
  let total = 0;
  for (let r = 1; r <= rounds; r++) {
    total += calculateRoundTime(exercises, r, userProfile);
  }
  return total;
}

/**
 * Calculate time for a For Time pattern (e.g., 21-15-9)
 * Each set in the pattern is treated as a "round" for decay purposes
 */
function calculatePatternTime(
  exerciseNames: string[],
  pattern: number[],
  userProfile?: UserProfile,
  weights?: { [key: string]: string }
): number {
  let total = 0;

  for (let setIdx = 0; setIdx < pattern.length; setIdx++) {
    const reps = pattern[setIdx];
    const decayMultiplier = Math.pow(DECAY_FACTOR, setIdx);

    for (const name of exerciseNames) {
      const baseRate = _exerciseRates[name] || 10.0;
      const weight = weights?.[name] ? parseFloat(weights[name]) : undefined;
      const weightMultiplier = weight && isBarbellExercise(name)
        ? getBarbellWeightMultiplier(name, weight, userProfile)
        : 1.0;

      const effectiveRate = baseRate * weightMultiplier * decayMultiplier;
      total += reps / effectiveRate;
    }
  }

  return total;
}

/**
 * Find how many complete rounds fit in an AMRAP time
 */
function calculateAmrapRounds(
  exercises: { name: string; reps: number; weight?: string }[],
  amrapTime: number,
  userProfile?: UserProfile
): { fullRounds: number; partialReps: number } {
  let cumulative = 0;
  let r = 0;

  while (true) {
    r++;
    const roundTime = calculateRoundTime(exercises, r, userProfile);

    if (cumulative + roundTime > amrapTime) {
      // Calculate partial round
      const remainingTime = amrapTime - cumulative;
      const partialFraction = remainingTime / roundTime;
      const totalRepsInRound = exercises.reduce((sum, ex) => sum + ex.reps, 0);
      const partialReps = Math.floor(partialFraction * totalRepsInRound);

      return { fullRounds: r - 1, partialReps };
    }

    cumulative += roundTime;

    // Safety: cap at 20 rounds to prevent infinite loop
    if (r >= 20) {
      return { fullRounds: r, partialReps: 0 };
    }
  }
}

/**
 * Get valid rep options for an exercise (under cap)
 */
function getValidRepOptions(exerciseName: string): number[] {
  const options = _allRepOptions[exerciseName] || [5, 10, 15, 20];
  const cap = _maxRepsPerRound[exerciseName] || 30;
  return options.filter(r => r <= cap);
}

/**
 * Search for valid round/rep combinations that hit a target time range
 * This is the core of the new algorithm
 */
function findValidWorkoutCombinations(
  exerciseNames: string[],
  targetMin: number,
  targetMax: number,
  roundOptions: number[],
  userProfile?: UserProfile,
  weights?: { [key: string]: string }
): { rounds: number; exercises: { name: string; reps: number; weight?: string }[]; duration: number }[] {
  const results: { rounds: number; exercises: { name: string; reps: number; weight?: string }[]; duration: number }[] = [];

  // Get rep options for each exercise
  const repOptionsPerExercise = exerciseNames.map(name => getValidRepOptions(name));

  // For efficiency, limit search space by picking representative options
  // Use ~5 options per exercise, spread across the range
  const limitedOptions = repOptionsPerExercise.map(opts => {
    if (opts.length <= 5) return opts;
    // Pick evenly spaced options
    const step = Math.floor(opts.length / 5);
    return [opts[0], opts[step], opts[step * 2], opts[step * 3], opts[opts.length - 1]];
  });

  // Search through combinations
  for (const rounds of roundOptions) {
    // Generate all combinations of reps
    const searchCombos = (depth: number, current: number[]): void => {
      if (depth === exerciseNames.length) {
        // Build exercise array with reps
        const exercises = exerciseNames.map((name, i) => ({
          name,
          reps: current[i],
          weight: weights?.[name]
        }));

        // Calculate duration with decay model
        const duration = calculateTotalTimeWithDecay(exercises, rounds, userProfile);

        // Check if in target range
        if (duration >= targetMin && duration <= targetMax) {
          results.push({ rounds, exercises: [...exercises], duration });
        }
        return;
      }

      for (const reps of limitedOptions[depth]) {
        current.push(reps);
        searchCombos(depth + 1, current);
        current.pop();
      }
    };

    searchCombos(0, []);
  }

  return results;
}

/**
 * Pick the best combination from valid options
 * Prefers: middle of time range, balanced reps across exercises
 */
function selectBestCombination(
  combinations: { rounds: number; exercises: { name: string; reps: number; weight?: string }[]; duration: number }[],
  targetMin: number,
  targetMax: number
): { rounds: number; exercises: { name: string; reps: number; weight?: string }[]; duration: number } | null {
  if (combinations.length === 0) return null;

  const targetMid = (targetMin + targetMax) / 2;

  // Score each combination
  const scored = combinations.map(combo => {
    // Prefer duration close to middle of range
    const durationScore = 1 - Math.abs(combo.duration - targetMid) / (targetMax - targetMin);

    // Prefer balanced reps (low variance)
    const reps = combo.exercises.map(e => e.reps);
    const avgReps = reps.reduce((a, b) => a + b, 0) / reps.length;
    const variance = reps.reduce((sum, r) => sum + Math.pow(r - avgReps, 2), 0) / reps.length;
    const balanceScore = 1 / (1 + variance / 100);

    return {
      combo,
      score: durationScore * 0.7 + balanceScore * 0.3
    };
  });

  // Sort by score and pick best, with some randomness among top options
  scored.sort((a, b) => b.score - a.score);

  // Pick randomly from top 3 (or fewer if less available)
  const topN = Math.min(3, scored.length);
  const pick = Math.floor(Math.random() * topN);

  return scored[pick].combo;
}

function getAllowedPatternsForExercises(exercises: string[]): string[] {
  let mostRestrictiveTier = 'lowSkill';
  
  for (const exercise of exercises) {
    if (_exerciseDifficultyTiers.highSkill.includes(exercise)) {
      mostRestrictiveTier = 'highSkill';
      break;
    } else if (_exerciseDifficultyTiers.highVolume.includes(exercise) && mostRestrictiveTier !== 'highSkill') {
      mostRestrictiveTier = 'highVolume';
    } else if (_exerciseDifficultyTiers.moderate.includes(exercise) && mostRestrictiveTier === 'lowSkill') {
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

export async function generateTestWorkouts(selectedDomainRanges?: string[], userProfile?: UserProfile, requiredEquipment?: string[]): Promise<GeneratedWorkout[]> {
  // Initialize exercise data from database
  await initializeBTNExerciseData();

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
  let availableExercises = [..._exerciseDatabase];
  
  if (userProfile) {
    console.log('🔍 Filtering exercises by user profile...');
    
    // Filter by equipment
    availableExercises = availableExercises.filter(exercise => {
      const required = _exerciseEquipment[exercise] || [];
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
    
    console.log(`✅ Available exercises after filtering: ${availableExercises.length}/${_exerciseDatabase.length}`);
    
    // Ensure we have minimum exercises for generation
    if (availableExercises.length < 10) {
      console.warn('⚠️ Too few exercises available after filtering, using all exercises');
      availableExercises = [..._exerciseDatabase];
    }
  }
  
  // Generate 5 workouts with domain selection logic:
  // 1. Generate at least 1 from each selected domain
  // 2. Fill remainder randomly from selected domains
  const selectedCount = timeDomains.length;
  const guaranteedWorkouts = Math.min(selectedCount, 5);
  
  // First pass: Generate 1 workout from each selected domain (up to 5)
  // Uses retry logic to ensure workouts match their target domain
  for (let i = 0; i < guaranteedWorkouts; i++) {
    const domain = timeDomains[i];

    // Retry logic to ensure workout lands in target domain
    let attempts = 0;
    const maxAttempts = 30;
    let workout: GeneratedWorkout | null = null;

    while (attempts < maxAttempts && !workout) {
      attempts++;

      // For 1-5 min domain: AMRAP not allowed (must be 6+ min)
      const formats = domain.maxDuration < 6
        ? ['For Time', 'Rounds For Time']  // No AMRAP for sprint domain
        : allFormats;

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
        // Defensive: ensure pattern was set
        if (!pattern) {
          console.error('❌ CRITICAL: Pattern not set for For Time workout!');
          pattern = '15-12-9'; // Fallback
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
      const result = generateExercisesForTimeDomain(targetDurationHint || domain.minDuration, format, rounds, pattern, amrapTime, availableExercises, userProfile, requiredEquipment);
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

      // Check if workout landed in target domain AND meets exercise requirements
      // STRICT: Only accept workouts that match the selected domain
      const meetsExerciseRequirement = exercises.length >= 2 &&
        !(actualTimeDomain === '15:00 - 20:00' && exercises.length < 3) &&
        !(actualTimeDomain === '20:00+' && exercises.length < 3);

      if (actualTimeDomain === domain.range && meetsExerciseRequirement) {
        console.log(`✅ Creating workout ${workouts.length + 1}: format=${format}, pattern=${pattern || 'NONE'}, domain=${actualTimeDomain}`);
        workout = {
          name: `Workout ${workouts.length + 1}`,
          duration: calculatedDuration,
          format: format,
          amrapTime: amrapTime,
          rounds: rounds,
          timeDomain: actualTimeDomain,
          exercises: exercises,
          pattern: format === 'For Time' ? pattern : undefined
        };

        // Calculate benchmark scores
        const benchmarks = calculateBenchmarkScores(workout, userProfile);
        workout.medianScore = benchmarks.medianScore;
        workout.excellentScore = benchmarks.excellentScore;
      }
    }

    if (workout) {
      workouts.push(workout);
    } else {
      console.warn(`⚠️ Could not generate workout matching domain ${domain.range} after ${maxAttempts} attempts`);
    }
  }
  
  // Second pass: Fill remainder randomly from selected domains (if < 5 domains selected)
  const remainingCount = 5 - workouts.length;
  for (let i = 0; i < remainingCount; i++) {
    const targetDomain = timeDomains[Math.floor(Math.random() * timeDomains.length)];
    
    // Retry logic to ensure workout lands in target domain
    let attempts = 0;
    const maxAttempts = 30;  // More attempts to ensure domain match
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
        // Defensive: ensure pattern was set
        if (!pattern) {
          console.error('❌ CRITICAL (2nd loop): Pattern not set for For Time workout!');
          pattern = '15-12-9'; // Fallback
        }
        console.log(`🎯 (2nd loop) Selected pattern for For Time: ${pattern}`);
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
      
      const result = generateExercisesForTimeDomain(targetDurationHint || targetDomain.minDuration, format, rounds, pattern, amrapTime, availableExercises, userProfile, requiredEquipment);
      const exercises = result.exercises;
      
      if (result.rounds !== undefined) {
        rounds = result.rounds;
      }
        
      if (pattern) {
        console.log(`🎯 (2nd loop) For Time workout - Pattern: ${pattern}`);
        const patternReps = pattern.split('-').map(Number);
        const totalPatternReps = patternReps.reduce((sum, reps) => sum + reps, 0);
        exercises.forEach((exercise) => {
          exercise.reps = totalPatternReps;
        });
      } else if (format === 'For Time') {
        console.log(`⚠️ (2nd loop) For Time workout without pattern!`);
      }

      const calculatedDuration = calculateWorkoutDuration(exercises, format, rounds, amrapTime, pattern, userProfile);
      const actualTimeDomain = getTimeDomainRange(calculatedDuration);

      // Check if workout landed in target domain AND meets exercise requirements
      // STRICT: Only accept workouts that match the selected domain
      const meetsExerciseRequirement = exercises.length >= 2 &&
        !(actualTimeDomain === '15:00 - 20:00' && exercises.length < 3) &&
        !(actualTimeDomain === '20:00+' && exercises.length < 3);

      if (actualTimeDomain === targetDomain.range && meetsExerciseRequirement) {
        console.log(`✅ (2nd loop) Creating workout: format=${format}, pattern=${pattern || 'NONE'}`);
        workout = {
          name: `Workout ${workouts.length + 1}`,
          duration: calculatedDuration,
          format: format,
          amrapTime: amrapTime,
          rounds: rounds,
          timeDomain: actualTimeDomain,
          exercises: exercises,
          pattern: format === 'For Time' ? pattern : undefined  // Explicit: only For Time has pattern
        };
        
        // Calculate benchmark scores
        const benchmarks = calculateBenchmarkScores(workout, userProfile);
        workout.medianScore = benchmarks.medianScore;
        workout.excellentScore = benchmarks.excellentScore;
      }
    }
    
    if (workout) {
      workouts.push(workout);
    } else {
      console.warn(`⚠️ Could not generate workout matching domain ${targetDomain.range} after ${maxAttempts} attempts`);
    }
  }

  return workouts;
}

function generateExercisesForTimeDomain(targetDuration: number, format: string, rounds?: number, pattern?: string, amrapTime?: number, availableExercises?: string[], userProfile?: UserProfile, requiredEquipment?: string[]): { exercises: Exercise[], rounds?: number } {
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
  let candidateExercises = availableExercises ? [...availableExercises] : [..._exerciseDatabase];
  
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
  
  // Apply required equipment filter (e.g., require Barbell in all workouts)
  if (requiredEquipment && requiredEquipment.length > 0) {
    const hasRequiredEquipment = requiredEquipment.some(eq => {
      if (eq === 'Barbell') {
        return filteredExercises.some(ex => isBarbellExercise(ex));
      }
      // For other equipment types, check exerciseEquipment mapping
      return filteredExercises.some(ex => {
        const exEquipment = _exerciseEquipment[ex] || [];
        return exEquipment.includes(eq);
      });
    });
    
    if (!hasRequiredEquipment) {
      // Need to add an exercise with required equipment
      // Try to replace the last exercise, or add if we have room
      let added = false;
      
      if (requiredEquipment.includes('Barbell')) {
        // Get all barbell exercises that are available
        const barbellCandidates = candidateExercises.filter(ex => isBarbellExercise(ex));
        
        // Try to find a barbell exercise that fits
        for (const barbell of barbellCandidates) {
          if (filteredExercises.includes(barbell)) continue; // Already in workout
          
          // Try replacing the last exercise
          const testExercises = filteredExercises.length > 0 
            ? [...filteredExercises.slice(0, -1), barbell]
            : [barbell];
          
          const testFiltered = filterExercisesForConsistency(testExercises);
          const testFinal = filterForbiddenPairs(testFiltered);
          
          if (testFinal.length === testExercises.length && testFinal.includes(barbell)) {
            if (filteredExercises.length > 0) {
              filteredExercises.pop();
            }
            filteredExercises.push(barbell);
            added = true;
            break;
          }
        }
        
        // If we couldn't replace, try adding (if we have room)
        if (!added && filteredExercises.length < numExercises) {
          for (const barbell of barbellCandidates) {
            if (filteredExercises.includes(barbell)) continue;
            
            const testExercises = [...filteredExercises, barbell];
            const testFiltered = filterExercisesForConsistency(testExercises);
            const testFinal = filterForbiddenPairs(testFiltered);
            
            if (testFinal.length === testExercises.length && testFinal.includes(barbell)) {
              filteredExercises.push(barbell);
              added = true;
              break;
            }
          }
        }
      }
      
      // If still no required equipment, log a warning but continue
      if (!added) {
        console.warn(`⚠️ Could not add required equipment (${requiredEquipment.join(', ')}) to workout`);
      }
    }
  }
    
  // Generate weights
    const barbellExercises = filteredExercises.filter(ex => isBarbellExercise(ex));
    const dumbbellExercises = filteredExercises.filter(ex => ex.includes('Dumbbell'));
    
  const barbellWeight = barbellExercises.length > 0 ? generateWeightForExercise(barbellExercises[0], userProfile) : undefined;
  const dumbbellWeight = dumbbellExercises.length > 0 ? generateWeightForExercise(dumbbellExercises[0], userProfile) : undefined;

  // Build weights map for search function
  const weightsMap: { [key: string]: string } = {};
  filteredExercises.forEach(name => {
    if (isBarbellExercise(name) && barbellWeight) {
      weightsMap[name] = barbellWeight;
    } else if (name.includes('Dumbbell') && dumbbellWeight) {
      weightsMap[name] = dumbbellWeight;
    }
  });

  // Generate exercises with reps using NEW SEARCH-BASED ALGORITHM
  const exerciseReps: { name: string; reps: number }[] = [];

  if (format === 'AMRAP') {
    // AMRAP: Find rep combinations that give good round counts for the fixed time
    const actualAmrapTime = amrapTime || targetDuration;

    // Determine target round range based on duration
    let targetRoundsMin: number, targetRoundsMax: number;
    if (actualAmrapTime <= 5) {
      targetRoundsMin = 3; targetRoundsMax = 5;
    } else if (actualAmrapTime <= 10) {
      targetRoundsMin = 4; targetRoundsMax = 7;
    } else if (actualAmrapTime <= 15) {
      targetRoundsMin = 5; targetRoundsMax = 9;
    } else {
      targetRoundsMin = 6; targetRoundsMax = 12;
    }

    // Search for rep combinations that yield rounds in target range
    // We invert the problem: find reps such that calculateAmrapRounds gives good results
    const repOptionsPerExercise = filteredExercises.map(name => getValidRepOptions(name));

    // Limit search space
    const limitedOptions = repOptionsPerExercise.map(opts => {
      if (opts.length <= 5) return opts;
      const step = Math.floor(opts.length / 5);
      return [opts[0], opts[step], opts[step * 2], opts[step * 3], opts[opts.length - 1]];
    });

    // Search for best rep combination
    let bestCombo: { name: string; reps: number }[] | null = null;
    let bestScore = -Infinity;

    const searchAmrapCombos = (depth: number, current: number[]): void => {
      if (depth === filteredExercises.length) {
        const testExercises = filteredExercises.map((name, i) => ({
          name,
          reps: current[i],
          weight: weightsMap[name]
        }));

        const { fullRounds } = calculateAmrapRounds(testExercises, actualAmrapTime, userProfile);

        // Score: prefer rounds in target range, penalize outside
        let score = 0;
        if (fullRounds >= targetRoundsMin && fullRounds <= targetRoundsMax) {
          score = 100 - Math.abs(fullRounds - (targetRoundsMin + targetRoundsMax) / 2);
        } else if (fullRounds < targetRoundsMin) {
          score = 50 - (targetRoundsMin - fullRounds) * 10;
        } else {
          score = 50 - (fullRounds - targetRoundsMax) * 10;
        }

        // Add some randomness to avoid always picking same combo
        score += Math.random() * 5;

        if (score > bestScore) {
          bestScore = score;
          bestCombo = testExercises.map(e => ({ name: e.name, reps: e.reps }));
        }
        return;
      }

      for (const reps of limitedOptions[depth]) {
        current.push(reps);
        searchAmrapCombos(depth + 1, current);
        current.pop();
      }
    };

    searchAmrapCombos(0, []);

    if (bestCombo) {
      exerciseReps.push(...bestCombo);
    } else {
      // Fallback: use middle rep options
      filteredExercises.forEach(name => {
        const opts = getValidRepOptions(name);
        exerciseReps.push({ name, reps: opts[Math.floor(opts.length / 2)] });
      });
    }

  } else if (format === 'Rounds For Time') {
    // Rounds For Time: Search for (rounds, reps) that hit target duration range
    // Target duration is a hint - we search for combos in a range around it
    const targetMin = Math.max(targetDuration - 2, 3);
    const targetMax = targetDuration + 3;

    // Determine round options based on duration
    let roundOptions: number[];
    if (targetDuration <= 5) {
      roundOptions = [2, 3];
    } else if (targetDuration <= 10) {
      roundOptions = [3, 4, 5];
    } else if (targetDuration <= 15) {
      roundOptions = [4, 5, 6];
    } else if (targetDuration <= 20) {
      roundOptions = [4, 5, 6, 7];
    } else {
      roundOptions = [5, 6, 7, 8];
    }

    // Search for valid combinations
    const combinations = findValidWorkoutCombinations(
      filteredExercises,
      targetMin,
      targetMax,
      roundOptions,
      userProfile,
      weightsMap
    );

    // Select best combination
    const selected = selectBestCombination(combinations, targetMin, targetMax);

    if (selected) {
      rounds = selected.rounds;
      selected.exercises.forEach(ex => {
        exerciseReps.push({ name: ex.name, reps: ex.reps });
      });
    } else {
      // Fallback: use middle options with middle round count
      rounds = roundOptions[Math.floor(roundOptions.length / 2)];
      filteredExercises.forEach(name => {
        const opts = getValidRepOptions(name);
        exerciseReps.push({ name, reps: opts[Math.floor(opts.length / 2)] });
      });
    }

  } else {
    // For Time with pattern: pattern determines reps, just return exercises
    // Reps will be set by the pattern in the calling function
    filteredExercises.forEach(name => {
      exerciseReps.push({ name, reps: 0 }); // Placeholder, will be overwritten by pattern
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
  const baseRate = _exerciseRates[exerciseName] || 10.0;
  
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
    'Kettlebell Snatch': {
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
    'Deadlift': barbellTimeDomainOptions,
    'Overhead Squat': barbellTimeDomainOptions,
    'Thrusters': barbellTimeDomainOptions,
    'Power Clean': barbellTimeDomainOptions,
    'Clean and Jerk': barbellTimeDomainOptions,
    'Squat Cleans': barbellTimeDomainOptions,
    'Squat Snatch': barbellTimeDomainOptions,
    'Power Snatch': barbellTimeDomainOptions,
    'Dumbbell Thrusters': barbellTimeDomainOptions,
    'Dumbbell Clean and Jerk': barbellTimeDomainOptions,
  };

  const isBarbellExerciseForReps = ['Snatch', 'Deadlift', 'Overhead Squat', 'Thrusters', 'Dumbbell Thrusters', 'Power Clean', 'Clean and Jerk', 'Dumbbell Clean and Jerk', 'Squat Cleans', 'Squat Snatch', 'Power Snatch'].includes(exerciseName);
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
  const isKettlebellSnatch = exerciseName === 'Kettlebell Snatch';
  const isBikeCalories = exerciseName === 'Bike Calories';
  const isSkiCalories = exerciseName === 'Ski Calories';
  const isBarMuscleUps = exerciseName === 'Bar Muscle Ups';
  const isPushups = exerciseName === 'Push-ups';

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
  const hasDumbbell = exerciseTypes.some(exercise => isDumbbellExercise(exercise));
  const hasKettlebell = exerciseTypes.some(exercise => isKettlebellExercise(exercise));

  if (hasBarbell) {
    const barbellExercises = exerciseTypes.filter(exercise => isBarbellExercise(exercise));
    if (barbellExercises.length > 1) {
      const firstBarbell = barbellExercises[0];
      return exerciseTypes.filter(exercise => !isBarbellExercise(exercise) || exercise === firstBarbell);
    }
  }

  if (hasDumbbell) {
    const dumbbellExercises = exerciseTypes.filter(exercise => isDumbbellExercise(exercise));
    if (dumbbellExercises.length > 1) {
      const firstDumbbell = dumbbellExercises[0];
      return exerciseTypes.filter(exercise => !isDumbbellExercise(exercise) || exercise === firstDumbbell);
    }
  }

  if (hasBarbell && hasDumbbell) {
    return exerciseTypes.filter(exercise => !isDumbbellExercise(exercise));
  }

  if (hasBarbell && hasKettlebell) {
    return exerciseTypes.filter(exercise => !isKettlebellExercise(exercise));
  }

  if (hasDumbbell && hasKettlebell) {
    return exerciseTypes.filter(exercise => !isKettlebellExercise(exercise));
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
    ['Bar Muscle Ups', 'Chest to Bar Pull-ups'],
    ['Ring Muscle Ups', 'Bar Muscle Ups'],
    ['Chest to Bar Pull-ups', 'Toes to Bar'],
    ['Push-ups', 'Burpees'],
    ['Toes to Bar', 'Ring Muscle Ups'],
    ['Toes to Bar', 'Legless Rope Climbs']
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
        // Only apply clustered rep if it's valid for this exercise
        const validOptions = _allRepOptions[exercise.name] || [5, 10, 15, 20];
        if (validOptions.includes(mode)) {
          exercise.reps = mode;
        }
        // Otherwise keep the original valid rep count
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
  // Use equipment data from database instead of hardcoded list
  const equipment = _exerciseEquipment[exerciseName];
  return equipment ? equipment.includes('Barbell') : false;
}

function isDumbbellExercise(exerciseName: string): boolean {
  const equipment = _exerciseEquipment[exerciseName];
  return equipment ? equipment.includes('Dumbbells') : false;
}

function isKettlebellExercise(exerciseName: string): boolean {
  const equipment = _exerciseEquipment[exerciseName];
  return equipment ? equipment.includes('Kettlebells') : false;
}

function calculateWorkoutDuration(exercises: Exercise[], format: string, rounds?: number, amrapTime?: number, pattern?: string, userProfile?: UserProfile): number {
  if (format === 'AMRAP' && amrapTime) {
    return amrapTime;
  }

  if (format === 'For Time' && pattern) {
    // Use decay model for pattern workouts
    const patternNums = pattern.split('-').map(Number);
    const exerciseNames = exercises.map(e => e.name);
    const weights: { [key: string]: string } = {};
    exercises.forEach(e => {
      if (e.weight) weights[e.name] = e.weight;
    });
    return calculatePatternTime(exerciseNames, patternNums, userProfile, weights);
  }

  if (format === 'Rounds For Time' && rounds) {
    // Use decay model for rounds-based workouts
    const exercisesWithWeight = exercises.map(e => ({
      name: e.name,
      reps: e.reps,
      weight: e.weight
    }));
    return calculateTotalTimeWithDecay(exercisesWithWeight, rounds, userProfile);
  }

  // Fallback: single round calculation without decay
  let totalTime = 0;
  exercises.forEach(exercise => {
    const baseRate = _exerciseRates[exercise.name] || 10.0;
    totalTime += exercise.reps / baseRate;
  });
  return totalTime;
}

function generateWeightForExercise(exerciseName: string, userProfile?: UserProfile): string {
  // Get standard weight options for this exercise
  let weightPairs: string[] = [];

  if (exerciseName.includes('Dumbbell')) {
    weightPairs = ['50/35'];
  } else if (['Deadlift', 'Deadlifts'].includes(exerciseName)) {
    weightPairs = ['135/95', '185/135', '225/155', '275/185', '315/205'];
  } else if ((exerciseName.includes('Clean') || exerciseName.includes('Jerk')) && !exerciseName.includes('Dumbbell')) {
    weightPairs = ['75/55', '95/65', '115/75', '135/95', '165/115', '185/135', '225/155', '275/185', '315/205'];
  } else if (exerciseName.includes('Snatch') && !exerciseName.includes('Dumbbell')) {
    weightPairs = ['75/55', '95/65', '115/75', '135/95', '165/115', '185/135', '225/155'];
  } else if (['Thrusters', 'Overhead Squat', 'Overhead Squats'].includes(exerciseName)) {
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
  if (['Power Clean', 'Squat Cleans', 'Clean and Jerk'].includes(exerciseName)) {
    return oneRMs['Clean and Jerk'] || null;
  }

  // Thrusters (70% of Clean & Jerk)
  if (exerciseName === 'Thrusters') {
    const cleanAndJerk = oneRMs['Clean and Jerk'];
    return cleanAndJerk ? cleanAndJerk * 0.7 : null;
  }

  // Overhead Squat
  if (exerciseName === 'Overhead Squat') {
    return oneRMs['Overhead Squat'] || null;
  }

  // Deadlift
  if (exerciseName === 'Deadlift') {
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

  // Get movement-specific degradation rate from database
  // Falls back to default of 0.8 (medium degradation) if not in database
  const degradationRate = _weightDegradationRates[exerciseName] ?? 0.8;

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
  const baseRate = _exerciseRates[exerciseName] || 10.0;
  
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
