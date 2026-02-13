export type Sex = 'male' | 'female';
export type Unit = 'lb' | 'kg';

export type StrengthThresholds = {
  beginner: number;
  intermediate: number;
  advanced: number;
  elite: number;
};

export type LiftKey = 'backSquat' | 'deadlift' | 'benchPress';

export const THRESHOLDS: Record<Sex, Record<LiftKey, StrengthThresholds>> = {
  male: {
    backSquat: { beginner: 1.0, intermediate: 1.4, advanced: 1.8, elite: 2.4 },
    deadlift: { beginner: 1.3, intermediate: 1.6, advanced: 2.2, elite: 2.7 },
    benchPress: { beginner: 0.8, intermediate: 1.1, advanced: 1.4, elite: 1.7 },
  },
  female: {
    backSquat: { beginner: 0.9, intermediate: 1.2, advanced: 1.5, elite: 1.9 },
    deadlift: { beginner: 1.1, intermediate: 1.3, advanced: 1.7, elite: 2.1 },
    benchPress: { beginner: 0.6, intermediate: 0.8, advanced: 1.0, elite: 1.3 },
  },
};

export type Category = 'Below Beginner' | 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite';

export function categorizeStrength(ratio: number, t: StrengthThresholds): Category {
  if (ratio >= t.elite) return 'Elite';
  if (ratio >= t.advanced) return 'Advanced';
  if (ratio >= t.intermediate) return 'Intermediate';
  if (ratio >= t.beginner) return 'Beginner';
  return 'Below Beginner';
}

export function getNextLevelTarget(
  ratio: number,
  t: StrengthThresholds,
  bodyweight: number
): { level: Exclude<Category, 'Below Beginner'>; weight: number } | null {
  if (ratio >= t.elite) return null;

  let nextThreshold: number;
  let nextLevel: Exclude<Category, 'Below Beginner'>;

  if (ratio < t.beginner) {
    nextThreshold = t.beginner;
    nextLevel = 'Beginner';
  } else if (ratio < t.intermediate) {
    nextThreshold = t.intermediate;
    nextLevel = 'Intermediate';
  } else if (ratio < t.advanced) {
    nextThreshold = t.advanced;
    nextLevel = 'Advanced';
  } else {
    nextThreshold = t.elite;
    nextLevel = 'Elite';
  }

  const targetWeight = Math.round(nextThreshold * bodyweight);
  return { level: nextLevel, weight: targetWeight };
}

export type AnalyzeInput = {
  sex: Sex;
  unit: Unit;
  bodyweight: number;
  lifts: {
    backSquat: number;
    deadlift: number;
    benchPress: number;
  };
};

export type AnalyzeOutputPerLift = {
  ratio: number;
  category: Category;
  nextTarget: { level: Exclude<Category, 'Below Beginner'>; weight: number } | null;
};

export type AnalyzeOutput = Record<LiftKey, AnalyzeOutputPerLift>;

export function analyzeStrength(input: AnalyzeInput): AnalyzeOutput {
  const { sex, bodyweight, lifts } = input;
  const sexThresholds = THRESHOLDS[sex];

  const result = {} as AnalyzeOutput;
  (Object.keys(lifts) as LiftKey[]).forEach((liftKey) => {
    const oneRepMax = lifts[liftKey] ?? 0;
    const ratio = bodyweight > 0 ? oneRepMax / bodyweight : 0;
    const thresholds = sexThresholds[liftKey];
    const category = categorizeStrength(ratio, thresholds);
    const nextTarget = getNextLevelTarget(ratio, thresholds, bodyweight);
    result[liftKey] = { ratio, category, nextTarget };
  });

  return result;
}
