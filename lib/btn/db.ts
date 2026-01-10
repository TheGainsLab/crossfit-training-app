// BTN Database Service - fetches exercise configuration from the database
import { createClient } from '@/lib/supabase/client';

// Display name mappings: database name → display name
// Used to show user-friendly names in the UI while using actual database names for queries
const DISPLAY_NAME_MAP: { [dbName: string]: string } = {
  'Rowing': 'Rowing Calories',
  'Bike Erg': 'Bike Calories',
  'Ski Erg': 'Ski Calories',
  'Pull-ups (kipping or butterfly)': 'Pull-ups'
};

// Reverse mapping: display name → database name
const DB_NAME_MAP: { [displayName: string]: string } = Object.fromEntries(
  Object.entries(DISPLAY_NAME_MAP).map(([db, display]) => [display, db])
);

/**
 * Convert database exercise name to display name
 */
export function toDisplayName(dbName: string): string {
  return DISPLAY_NAME_MAP[dbName] || dbName;
}

/**
 * Convert display name back to database name
 */
export function toDbName(displayName: string): string {
  return DB_NAME_MAP[displayName] || displayName;
}

// Type for BTN exercise data from database
export interface BTNExercise {
  name: string;
  required_equipment: string[] | null;
  btn_work_rate: number;
  btn_max_reps_per_round: number;
  btn_rep_options: number[];
  btn_difficulty_tier: 'highSkill' | 'highVolume' | 'moderate' | 'lowSkill';
  btn_weight_degradation_rate: number | null;
}

// Cached exercise data
let cachedExercises: BTNExercise[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all BTN-eligible exercises from the database
 * Results are cached for 5 minutes to avoid repeated queries
 */
export async function fetchBTNExercises(): Promise<BTNExercise[]> {
  // Return cached data if still valid
  if (cachedExercises && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedExercises;
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from('exercises')
    .select(`
      name,
      required_equipment,
      btn_work_rate,
      btn_max_reps_per_round,
      btn_rep_options,
      btn_difficulty_tier,
      btn_weight_degradation_rate
    `)
    .eq('can_be_btn', true)
    .not('btn_work_rate', 'is', null);

  if (error) {
    console.error('Error fetching BTN exercises:', error);
    throw new Error(`Failed to fetch BTN exercises: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.warn('No BTN exercises found in database');
    return [];
  }

  // Cache the results
  cachedExercises = data as BTNExercise[];
  cacheTimestamp = Date.now();

  console.log(`✅ Loaded ${cachedExercises.length} BTN exercises from database`);
  return cachedExercises;
}

/**
 * Clear the exercise cache (useful for testing or after updates)
 */
export function clearBTNExerciseCache(): void {
  cachedExercises = null;
  cacheTimestamp = 0;
}

/**
 * Build exercise data maps from fetched exercises
 * These match the structure previously used in utils.ts
 */
export function buildExerciseMaps(exercises: BTNExercise[]) {
  const exerciseDatabase: string[] = [];
  const exerciseEquipment: { [key: string]: string[] } = {};
  const exerciseRates: { [key: string]: number } = {};
  const maxRepsPerRound: { [key: string]: number } = {};
  const allRepOptions: { [key: string]: number[] } = {};
  const exerciseDifficultyTiers: {
    highSkill: string[];
    highVolume: string[];
    moderate: string[];
    lowSkill: string[];
  } = {
    highSkill: [],
    highVolume: [],
    moderate: [],
    lowSkill: []
  };
  const weightDegradationRates: { [key: string]: number } = {};

  for (const exercise of exercises) {
    // Use display name for all internal references
    const displayName = toDisplayName(exercise.name);

    // Exercise name list
    exerciseDatabase.push(displayName);

    // Equipment mapping
    exerciseEquipment[displayName] = exercise.required_equipment || [];

    // Work rate (reps per minute)
    exerciseRates[displayName] = exercise.btn_work_rate;

    // Max reps per round
    maxRepsPerRound[displayName] = exercise.btn_max_reps_per_round;

    // Valid rep options
    allRepOptions[displayName] = exercise.btn_rep_options;

    // Difficulty tier
    if (exercise.btn_difficulty_tier) {
      exerciseDifficultyTiers[exercise.btn_difficulty_tier].push(displayName);
    }

    // Weight degradation rate (for barbell exercises)
    if (exercise.btn_weight_degradation_rate !== null) {
      weightDegradationRates[displayName] = exercise.btn_weight_degradation_rate;
    }
  }

  return {
    exerciseDatabase,
    exerciseEquipment,
    exerciseRates,
    maxRepsPerRound,
    allRepOptions,
    exerciseDifficultyTiers,
    weightDegradationRates
  };
}

// Type for the built exercise maps
export type BTNExerciseMaps = ReturnType<typeof buildExerciseMaps>;

// Type for forbidden pair from database
export interface ForbiddenPair {
  exercise_1: string;
  exercise_2: string;
}

// Cached forbidden pairs
let cachedForbiddenPairs: [string, string][] | null = null;
let forbiddenPairsCacheTimestamp: number = 0;

/**
 * Fetch forbidden exercise pairs from the database
 * Results are cached for 5 minutes to avoid repeated queries
 */
export async function fetchForbiddenPairs(): Promise<[string, string][]> {
  // Return cached data if still valid
  if (cachedForbiddenPairs && Date.now() - forbiddenPairsCacheTimestamp < CACHE_TTL) {
    return cachedForbiddenPairs;
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from('btn_forbidden_pairs')
    .select('exercise_1, exercise_2');

  if (error) {
    console.error('Error fetching forbidden pairs:', error);
    throw new Error(`Failed to fetch forbidden pairs: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.warn('No forbidden pairs found in database');
    return [];
  }

  // Convert to tuple format and apply display name mapping
  cachedForbiddenPairs = data.map((pair: ForbiddenPair) => [
    toDisplayName(pair.exercise_1),
    toDisplayName(pair.exercise_2)
  ] as [string, string]);

  forbiddenPairsCacheTimestamp = Date.now();

  console.log(`✅ Loaded ${cachedForbiddenPairs.length} forbidden pairs from database`);
  return cachedForbiddenPairs;
}

/**
 * Clear the forbidden pairs cache (useful for testing or after updates)
 */
export function clearForbiddenPairsCache(): void {
  cachedForbiddenPairs = null;
  forbiddenPairsCacheTimestamp = 0;
}
