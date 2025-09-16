// lib/ai/context-builder.ts
// Build a comprehensive ContextFeatures object for AI reasoning
// NOTE: This is a first pass that focuses on the most impactful signals.

import { buildContextHash } from '@/lib/ai/decision-policy'

type SupabaseClientLike = any

export interface ContextFeatures {
  userId: number
  sinceIso: string
  identity: { name?: string; abilityLevel?: string; units?: 'kg'|'lb'; bodyWeight?: number; joinDate?: string }
  preferences: {
    trainingDaysPerWeek?: number
    selectedGoals?: string[]
    metconTimeFocus?: string[]
    primaryStrengthLifts?: string[]
    emphasizedStrengthLifts?: string[]
    aiAutoApplyLowRisk?: boolean
  }
  equipment: string[]

  oneRMs: {
    latest: Array<{ exercise: string; value: number; recordedAt: string }>
    bestEver?: Record<string, number>
  }
  rpePatterns: { d7?: number; d30?: number; d90?: number; trend?: 'up'|'down'|'flat' }
  completionQuality: { d7?: number; d30?: number; d90?: number }
  lastNLogs: Array<{ date: string; block: 'SKILLS'|'STRENGTH AND POWER'|'METCONS'; exercise?: string; rpe?: number; quality?: number; result?: string }>

  skills: {
    profile: Array<{ skillName: string; skillLevel: 'DontHave'|'Beginner'|'Intermediate'|'Advanced' }>
    practiced: Array<{ name: string; count: number; avgQuality?: number }>
  }

  program: {
    currentProgramId?: number
    generatedAt?: string
  }

  metcons: {
    last: Array<{ metconId: number; completedAt: string; percentile?: number; timeDomain?: string; tasksText?: string }>
    timeDomainExposure?: Record<'0-6'|'8-12'|'14-20'|'20+', number>
  }

  blockCounts: Record<'SKILLS'|'STRENGTH AND POWER'|'METCONS', number>
  contextHash: string

  // Manifests for unbounded history (counts and ranges)
  manifests?: {
    performanceLogs?: { count: number; earliest?: string; latest?: string }
    metcons?: { count: number; earliest?: string; latest?: string }
    oneRms?: { count: number; earliest?: string; latest?: string }
  }
}

export async function buildContextFeatures(supabase: SupabaseClientLike, userId: number): Promise<ContextFeatures> {
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [users, userPrefs, userEquip, userSkills, oneRms, perfLogs, program, progMet] = await Promise.all([
    supabase.from('users').select('name, ability_level, body_weight, units, created_at').eq('id', userId).single(),
    supabase.from('user_preferences').select('training_days_per_week, selected_goals, metcon_time_focus, primary_strength_lifts, emphasized_strength_lifts, ai_auto_apply_low_risk').eq('user_id', userId).single(),
    supabase.from('user_equipment').select('equipment_name').eq('user_id', userId),
    supabase.from('user_skills').select('skill_name, skill_level').eq('user_id', userId),
    supabase.from('user_one_rms').select('exercise_name, one_rm, recorded_at').eq('user_id', userId).order('recorded_at', { ascending: false }),
    supabase.from('performance_logs').select('block, exercise_name, rpe, completion_quality, result, logged_at').eq('user_id', userId),
    supabase.from('programs').select('id, generated_at').eq('user_id', userId).order('generated_at', { ascending: false }).limit(1).single(),
    supabase.from('program_metcons').select('metcon_id, percentile, completed_at, programs!inner(user_id)').eq('programs.user_id', userId).not('completed_at', 'is', null).order('completed_at', { ascending: false })
  ])

  const identity = {
    name: users?.data?.name,
    abilityLevel: users?.data?.ability_level,
    units: users?.data?.units,
    bodyWeight: users?.data?.body_weight ? Number(users.data.body_weight) : undefined,
    joinDate: users?.data?.created_at
  }

  const preferences = {
    trainingDaysPerWeek: userPrefs?.data?.training_days_per_week || undefined,
    selectedGoals: userPrefs?.data?.selected_goals || [],
    metconTimeFocus: userPrefs?.data?.metcon_time_focus || [],
    primaryStrengthLifts: userPrefs?.data?.primary_strength_lifts || [],
    emphasizedStrengthLifts: userPrefs?.data?.emphasized_strength_lifts || [],
    aiAutoApplyLowRisk: Boolean(userPrefs?.data?.ai_auto_apply_low_risk)
  }

  const equipment = (userEquip?.data || []).map((e: any) => e.equipment_name).filter(Boolean)

  const oneRMsLatest = dedupeLatestOneRms(oneRms?.data || [])
  const oneRMsBestEver = computeBestEver(oneRMsLatest)

  const logs = (perfLogs?.data || []) as Array<any>
  const blockCounts = { 'SKILLS': 0, 'STRENGTH AND POWER': 0, 'METCONS': 0 } as Record<'SKILLS'|'STRENGTH AND POWER'|'METCONS', number>
  for (const p of logs) {
    if (blockCounts[p.block as keyof typeof blockCounts] !== undefined) blockCounts[p.block as keyof typeof blockCounts] += 1
  }

  const rpePatterns = windowAverages(logs, 'rpe')
  const completionQuality = windowAverages(logs, 'completion_quality')

  const lastNLogs = logs
    .slice()
    .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())
    .slice(0, 20)
    .map(l => ({
      date: l.logged_at,
      block: l.block,
      exercise: l.exercise_name || undefined,
      rpe: typeof l.rpe === 'number' ? l.rpe : undefined,
      quality: typeof l.completion_quality === 'number' ? l.completion_quality : undefined,
      result: l.result || undefined
    }))

  // MetCon exposure (use simple derivation from last entries)
  const metRows = (progMet?.data || []) as any[]
  const metconsLast = metRows.map(r => ({ metconId: r.metcon_id, completedAt: r.completed_at, percentile: r.percentile }))
  const timeDomainExposure: Record<'0-6'|'8-12'|'14-20'|'20+', number> = { '0-6': 0, '8-12': 0, '14-20': 0, '20+': 0 }
  // Unknown time domains here; leave exposure neutral for now

  const features: ContextFeatures = {
    userId,
    sinceIso: since90,
    identity,
    preferences,
    equipment,
    oneRMs: { latest: oneRMsLatest, bestEver: oneRMsBestEver },
    rpePatterns,
    completionQuality,
    lastNLogs,
    skills: {
      profile: (userSkills?.data || []).map((s: any) => ({ skillName: s.skill_name, skillLevel: normalizeSkillLevel(s.skill_level) as any }))
        .filter((s: any) => !!s.skillName),
      practiced: computeSkillsPracticed(logs)
    },
    program: { currentProgramId: program?.data?.id, generatedAt: program?.data?.generated_at },
    metcons: { last: metconsLast, timeDomainExposure },
    blockCounts,
    contextHash: '',
    manifests: {
      performanceLogs: {
        count: logs.length,
        earliest: logs.length ? String(logs.reduce((a, b) => new Date(a.logged_at) < new Date(b.logged_at) ? a : b).logged_at) : undefined,
        latest: logs.length ? String(logs.reduce((a, b) => new Date(a.logged_at) > new Date(b.logged_at) ? a : b).logged_at) : undefined
      },
      metcons: {
        count: metRows.length,
        earliest: metRows.length ? String(metRows[metRows.length - 1].completed_at) : undefined,
        latest: metRows.length ? String(metRows[0].completed_at) : undefined
      },
      oneRms: {
        count: (oneRms?.data || []).length,
        earliest: (oneRms?.data || []).length ? String((oneRms!.data as any[])[(oneRms!.data as any[]).length - 1].recorded_at) : undefined,
        latest: (oneRms?.data || []).length ? String((oneRms!.data as any[])[0].recorded_at) : undefined
      }
    }
  }

  // Build short hash expected by decision layer
  const recentOneRMsMini = features.oneRMs.latest.map(r => ({ exercise: r.exercise, value: r.value, recorded_at: r.recordedAt }))
  features.contextHash = buildContextHash({
    userId,
    blockCounts: features.blockCounts,
    recentOneRMs: recentOneRMsMini,
    preferences: features.preferences as any,
    equipment: features.equipment
  } as any)

  return features
}

function dedupeLatestOneRms(rows: Array<{ exercise_name: string; one_rm: any; recorded_at: string }>) {
  const seen = new Set<string>()
  const out: Array<{ exercise: string; value: number; recordedAt: string }> = []
  for (const r of rows) {
    if (seen.has(r.exercise_name)) continue
    seen.add(r.exercise_name)
    const v = Number(r.one_rm)
    if (!Number.isFinite(v)) continue
    out.push({ exercise: r.exercise_name, value: v, recordedAt: r.recorded_at })
  }
  return out
}

function computeBestEver(latest: Array<{ exercise: string; value: number }>) {
  const best: Record<string, number> = {}
  for (const r of latest) {
    best[r.exercise] = Math.max(best[r.exercise] || 0, r.value)
  }
  return best
}

function windowAverages(logs: any[], field: 'rpe'|'completion_quality') {
  const now = Date.now()
  const ranges = [7, 30, 90]
  const res: any = {}
  for (const d of ranges) {
    const since = now - d * 24 * 60 * 60 * 1000
    const vals: number[] = []
    for (const l of logs) {
      const t = new Date(l.logged_at).getTime()
      if (t >= since && typeof l[field] === 'number') vals.push(Number(l[field]))
    }
    if (vals.length) res[`d${d}`] = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
  }
  if (res.d30 !== undefined && res.d90 !== undefined) {
    if (res.d30 > res.d90 + 0.3) res.trend = 'up'
    else if (res.d30 < res.d90 - 0.3) res.trend = 'down'
    else res.trend = 'flat'
  }
  return res
}

function computeSkillsPracticed(logs: any[]) {
  const map: Record<string, { count: number; qsum: number; qn: number }> = {}
  for (const l of logs) {
    if (l.block !== 'SKILLS') continue
    const name = l.exercise_name
    if (!name) continue
    if (!map[name]) map[name] = { count: 0, qsum: 0, qn: 0 }
    map[name].count += 1
    const q = Number(l.completion_quality)
    if (Number.isFinite(q)) { map[name].qsum += q; map[name].qn += 1 }
  }
  return Object.entries(map).map(([name, s]) => ({ name, count: s.count, avgQuality: s.qn ? Number((s.qsum / s.qn).toFixed(2)) : undefined }))
}

function normalizeSkillLevel(level: string): 'DontHave'|'Beginner'|'Intermediate'|'Advanced' {
  const t = (level || '').toLowerCase()
  if (t.includes('dont') || t.includes("don't")) return 'DontHave'
  if (t.includes('begin')) return 'Beginner'
  if (t.includes('inter')) return 'Intermediate'
  return 'Advanced'
}

