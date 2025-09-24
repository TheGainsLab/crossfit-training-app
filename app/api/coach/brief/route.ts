import { NextResponse } from 'next/server'
import type { CoachingBriefV1, Units, Ability, BlockName, TimeDomain, MetconLevel } from '@/lib/coach/schemas'

export async function POST(_req: Request) {
  // Stub: return a minimal Brief v1 shape with placeholders
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const brief: CoachingBriefV1 = {
    version: 'v1',
    metadata: { userId: 0, window: { startISO: start.toISOString(), endISO: end.toISOString() }, units: 'Imperial (lbs)' as Units },
    profile: { ability: 'Intermediate' as Ability, goals: [], constraints: [], equipment: [] },
    intake: { skills: [], oneRMs: [], conditioning_benchmarks: {} },
    logs_summary: [],
    metcons_summary: { completions: 0, time_domain_mix: [], avg_percentile: null, best_scores: [], equipment_mix: [] },
    upcoming_program: [],
    adherence: { planned_sessions: 0, completed_sessions: 0, pct: 0, by_week: [] },
    trends: { volume_by_week: [], avg_rpe_by_week: [], quality_by_week: [] },
    allowed_entities: {
      blocks: ['SKILLS','TECHNICAL WORK','STRENGTH AND POWER','ACCESSORIES','METCONS'] as BlockName[],
      movements: [],
      time_domains: ['1-5','5-10','10-15','15-20','20+'] as TimeDomain[],
      equipment: ['Barbell','Dumbbells'],
      levels: ['Open','Quarterfinals','Regionals','Games'] as MetconLevel[]
    },
    citations: ['profile','logs_summary','metcons_summary','upcoming_program','adherence','trends']
  }
  return NextResponse.json({ success: true, brief })
}

