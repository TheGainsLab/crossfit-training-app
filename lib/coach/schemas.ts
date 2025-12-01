// lib/coach/schemas.ts
// Versioned contracts for Coaching Brief and Plan Diff (v1)

export type Units = 'Metric (kg)' | 'Imperial (lbs)'
export type Ability = 'Beginner' | 'Intermediate' | 'Advanced'
export type BlockName = 'SKILLS' | 'TECHNICAL WORK' | 'STRENGTH AND POWER' | 'ACCESSORIES' | 'METCONS' | 'ENGINE'
export type TimeDomain = '1-5' | '5-10' | '10-15' | '15-20' | '20+'
export type MetconLevel = 'Open' | 'Quarterfinals' | 'Regionals' | 'Games'

export interface CoachingBriefV1 {
  version: 'v1'
  metadata: { userId: number; window: { startISO: string; endISO: string }; units: Units }
  profile: { ability: Ability; goals: string[]; constraints: string[]; equipment: string[] }
  intake: {
    skills: string[]
    oneRMs: number[]
    oneRMsNamed?: Record<string, number>
    strength_ratios?: Record<string, { value: number; target: number; flag: 'below_target' | 'above_target' }>
    conditioning_benchmarks: Record<string, unknown>
  }
  logs_summary: Array<{
    weekISO: string
    sessions: number
    block_mix: Record<BlockName, number>
    top_movements: Array<{ name: string; freq: number; avg_rpe: number }>
    avg_rpe: number
    volume: number
  }>
  metcons_summary: {
    completions: number
    time_domain_mix: Array<{ range: TimeDomain; count: number }>
    avg_percentile: number | null
    best_scores: Array<{ workout_id: string; percentile: number | null }>
    equipment_mix: Array<{ equipment: string; count: number }>
  }
  upcoming_program: Array<{
    dateISO: string
    week: number
    day: number
    blocks: Array<{
      block: BlockName
      subOrder?: number
      exercises: Array<{ name: string; sets?: number | string; reps?: number | string; weightTime?: string; notes?: string }>
      metcon?: { workout_id: string; format: string; time_range: string; level?: MetconLevel; required_equipment?: string[] }
    }>
  }>
  adherence: { planned_sessions: number; completed_sessions: number; pct: number; by_week: Array<{ weekISO: string; planned: number; completed: number }> }
  trends: { volume_by_week: Array<{ weekISO: string; volume: number }>; avg_rpe_by_week: Array<{ weekISO: string; avg_rpe: number }>; quality_by_week: Array<{ weekISO: string; avg_quality: number }> }
  allowed_entities: { blocks: BlockName[]; movements: string[]; time_domains: TimeDomain[]; equipment: string[]; levels: MetconLevel[] }
  citations: string[]
}

// Plan Diff v1
export type PlanOpType = 'replace_exercise' | 'add_exercise_in_block' | 'remove_exercise_in_block' | 'adjust_exercise_prescription' | 'swap_metcon'

export interface TargetLocator {
  program_id?: number
  week: number
  day: number // 1..7
  block: BlockName
  subOrder?: number
  index?: number // exercise index within block's exercises (if applicable)
}

export interface Prescription {
  name: string
  sets: number | number[]
  reps: number | number[]
  rest_sec?: number
  intensity?: { rpe?: number; percent_1rm?: number; load_text?: string }
  tempo?: string
}

export interface ChangeReplaceExercise { type: 'replace_exercise'; target: TargetLocator; old_name: string; new_name: string; rationale: string }
export interface ChangeAddExercise { type: 'add_exercise_in_block'; target: TargetLocator; new: Prescription; rationale: string }
export interface ChangeRemoveExercise { type: 'remove_exercise_in_block'; target: TargetLocator; name: string; rationale: string }
export interface ChangeAdjustPrescription {
  type: 'adjust_exercise_prescription'
  target: TargetLocator & { name: string }
  sets?: number | number[]
  reps?: number | number[]
  rest_sec?: number
  intensity?: { rpe?: number; percent_1rm?: number; load_text?: string }
  tempo?: string
  rationale: string
}
export interface ChangeSwapMetcon {
  type: 'swap_metcon'
  target: TargetLocator & { block: 'METCONS' }
  select: { time_domain?: TimeDomain; equipment?: string[]; level?: MetconLevel }
  rationale: string
}

export type PlanChangeV1 = ChangeReplaceExercise | ChangeAddExercise | ChangeRemoveExercise | ChangeAdjustPrescription | ChangeSwapMetcon

export interface PlanDiffV1 {
  version: 'v1'
  changes: PlanChangeV1[]
}

// Lightweight runtime guards (not full validation; stubs for now)
export function isCoachingBriefV1(obj: any): obj is CoachingBriefV1 {
  return obj && obj.version === 'v1' && typeof obj === 'object' && !!obj.metadata && !!obj.profile
}

export function isPlanDiffV1(obj: any): obj is PlanDiffV1 {
  return obj && obj.version === 'v1' && Array.isArray(obj.changes)
}

