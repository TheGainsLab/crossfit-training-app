// lib/ai/decision-policy.ts
// Shared decision layer scaffolding: context hash, action signatures, and simple rule outputs

export type BlockName = 'SKILLS' | 'STRENGTH AND POWER' | 'METCONS'

export interface ContextFeatures {
  userId: number
  sinceIso?: string
  blockCounts?: Record<BlockName, number>
  // Minimal placeholders; expand with trends/percentiles/1RMs later
  recentOneRMs?: Array<{ exercise: string; value: number; recorded_at: string }>
  preferences?: Record<string, any>
  equipment?: string[]
}

export interface ProposedAction {
  kind: 'metcon_time_domain' | 'skills_practice' | 'strength_micro_nudge'
  block: BlockName
  objective: string
  params: Record<string, any>
  targetWindow?: { weekOffset: number }
  rationale: string
}

export function buildContextHash(features: ContextFeatures): string {
  const stable = JSON.stringify({
    blockCounts: features.blockCounts || {},
    r1: (features.recentOneRMs || []).map(r => ({ e: r.exercise, v: r.value })).slice(0, 10),
    prefs: features.preferences || {},
    eq: (features.equipment || []).slice(0, 20).sort(),
  })
  // Simple hash (FNV-like); replace with crypto.subtle if needed
  let h = 2166136261 >>> 0
  for (let i = 0; i < stable.length; i++) {
    h ^= stable.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ('00000000' + (h >>> 0).toString(16)).slice(-8)
}

export function buildActionSignature(action: ProposedAction): string {
  const base = `${action.kind}:${action.block}:${action.objective}`
  const p = action.params || {}
  const extras = Object.keys(p).sort().map(k => `${k}=${String(p[k])}`).join(',')
  return extras ? `${base}:${extras}` : base
}

export interface DecisionOutput {
  insights: {
    skills: Array<{ message: string; action?: ProposedAction }>
    strength: Array<{ message: string; action?: ProposedAction }>
    metcons: Array<{ message: string; action?: ProposedAction }>
  }
}

export interface PolicyConfig {
  sessionGatePerBlock: number // e.g., 10
}

export function runDecisionPolicy(features: ContextFeatures, cfg: PolicyConfig): DecisionOutput {
  const counts = features.blockCounts || { 'SKILLS': 0, 'STRENGTH AND POWER': 0, 'METCONS': 0 }

  const insights = { skills: [] as any[], strength: [] as any[], metcons: [] as any[] }

  // Skills
  if ((counts['SKILLS'] || 0) >= cfg.sessionGatePerBlock) {
    insights.skills.push({
      message: 'Increase practice for weakest skills',
      action: {
        kind: 'skills_practice',
        block: 'SKILLS',
        objective: 'add_practice_slot',
        params: { count: 1 },
        targetWindow: { weekOffset: 1 },
        rationale: 'Baseline achieved; add focused practice while staying in volume band'
      }
    })
  }

  // Strength
  if ((counts['STRENGTH AND POWER'] || 0) >= cfg.sessionGatePerBlock) {
    insights.strength.push({
      message: 'Progress intensity slightly on primary lifts',
      action: {
        kind: 'strength_micro_nudge',
        block: 'STRENGTH AND POWER',
        objective: 'increase_top_set',
        params: { deltaPct: 2.5 },
        targetWindow: { weekOffset: 1 },
        rationale: 'Small, safe nudge within band based on recent consistency'
      }
    })
  }

  // MetCons
  if ((counts['METCONS'] || 0) >= cfg.sessionGatePerBlock) {
    insights.metcons.push({
      message: 'Focus on 8–12 min time domain — Target 2 workouts next week',
      action: {
        kind: 'metcon_time_domain',
        block: 'METCONS',
        objective: 'target_time_domain',
        params: { timeDomain: '8-12', count: 2 },
        targetWindow: { weekOffset: 1 },
        rationale: 'Balance time-domain exposure to improve percentile in 8–12 min band'
      }
    })
  }

  return { insights }
}

