// BTN Database Service - fetches exercise configuration from the database
import { createClient } from '@/lib/supabase/client';

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
    // Exercise name list
    exerciseDatabase.push(exercise.name);

    // Equipment mapping
    exerciseEquipment[exercise.name] = exercise.required_equipment || [];

    // Work rate (reps per minute)
    exerciseRates[exercise.name] = exercise.btn_work_rate;

    // Max reps per round
    maxRepsPerRound[exercise.name] = exercise.btn_max_reps_per_round;

    // Valid rep options
    allRepOptions[exercise.name] = exercise.btn_rep_options;

    // Difficulty tier
    if (exercise.btn_difficulty_tier) {
      exerciseDifficultyTiers[exercise.btn_difficulty_tier].push(exercise.name);
    }

    // Weight degradation rate (for barbell exercises)
    if (exercise.btn_weight_degradation_rate !== null) {
      weightDegradationRates[exercise.name] = exercise.btn_weight_degradation_rate;
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
