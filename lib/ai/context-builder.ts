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

  oly?: {
    snatch: { sessions: number; avgRpe?: number; avgQuality?: number; latestOneRm?: number }
    cleanJerk: { sessions: number; avgRpe?: number; avgQuality?: number; latestOneRm?: number }
    proxies?: {
      overheadSquat?: { sessions: number; avgRpe?: number; avgQuality?: number }
      snatchBalance?: { sessions: number; avgRpe?: number; avgQuality?: number }
      frontSquat?: { sessions: number; avgRpe?: number; avgQuality?: number }
    }
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

  // Use optimized views wherever possible; fetch a bounded slice of performance_logs for light aggregates
  const [ucp, urp, ulo, uss, ums, perfLogsRes] = await Promise.all([
    supabase.from('user_complete_profile').select('*').eq('user_id', userId).single(),
    supabase.from('user_recent_performance').select('*').eq('user_id', userId).single(),
    supabase.from('user_latest_one_rms').select('*').eq('user_id', userId).single(),
    supabase.from('user_skills_summary').select('*').eq('user_id', userId).single(),
    supabase.from('user_metcon_summary').select('*').eq('user_id', userId).single(),
    supabase.from('performance_logs').select('block, exercise_name, rpe, completion_quality, result, logged_at').eq('user_id', userId).order('logged_at', { ascending: false }).limit(400)
  ])

  const identity = {
    name: ucp?.data?.name,
    abilityLevel: ucp?.data?.ability_level,
    units: ucp?.data?.units,
    bodyWeight: ucp?.data?.body_weight ? Number(ucp.data.body_weight) : undefined,
    joinDate: ucp?.data?.join_date
  }

  const preferences = {
    trainingDaysPerWeek: ucp?.data?.training_days_per_week || undefined,
    selectedGoals: (ucp?.data?.three_month_goals as any) || [],
    metconTimeFocus: [],
    primaryStrengthLifts: (ucp?.data?.primary_strength_lifts as any) || [],
    emphasizedStrengthLifts: (ucp?.data?.emphasized_strength_lifts as any) || [],
    aiAutoApplyLowRisk: undefined
  }

  const equipment = ((ucp?.data?.available_equipment as any[]) || []).filter(Boolean)

  // Transform latest 1RMs view object -> array
  const oneRMsLatest: Array<{ exercise: string; value: number; recordedAt: string }> = []
  if (ulo?.data?.latest_one_rms) {
    const entries = ulo.data.latest_one_rms as Record<string, { value: number; recorded_at: string }>
    for (const exercise of Object.keys(entries)) {
      const rec = entries[exercise]
      const v = Number(rec?.value)
      if (Number.isFinite(v)) {
        oneRMsLatest.push({ exercise, value: v, recordedAt: rec?.recorded_at })
      }
    }
    oneRMsLatest.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
  }
  const oneRMsBestEver = computeBestEver(oneRMsLatest)

  const logs = (perfLogsRes?.data || []) as Array<any>

  // Use view-derived block counts for last 30d; fallback to simple counts if view missing
  const blockCounts = {
    'SKILLS': Number(urp?.data?.skills_sessions_30d || 0),
    'STRENGTH AND POWER': Number(urp?.data?.strength_sessions_30d || 0),
    'METCONS': Number(urp?.data?.metcons_sessions_30d || 0)
  } as Record<'SKILLS'|'STRENGTH AND POWER'|'METCONS', number>

  const rpePatterns = windowAverages(logs, 'rpe')
  const completionQuality = windowAverages(logs, 'completion_quality')

  const lastNLogs = logs
    .slice(0, 20)
    .map(l => ({
      date: l.logged_at,
      block: l.block,
      exercise: l.exercise_name || undefined,
      rpe: typeof l.rpe === 'number' ? l.rpe : undefined,
      quality: typeof l.completion_quality === 'number' ? l.completion_quality : undefined,
      result: l.result || undefined
    }))

  // Metcons recent via view
  const recentMet = (ums?.data?.recent_metcons as any[]) || []
  const metconsLast = recentMet.map((r: any) => ({ metconId: r.metcon_id, completedAt: r.completed_at, percentile: r.percentile }))
  const timeDomainExposure: Record<'0-6'|'8-12'|'14-20'|'20+', number> = { '0-6': 0, '8-12': 0, '14-20': 0, '20+': 0 }

  // Skills profile from view; practiced from recent logs only (bounded)
  const skillsProfileArr: Array<{ skillName: string; skillLevel: 'DontHave'|'Beginner'|'Intermediate'|'Advanced' }> = []
  if (uss?.data?.skills_profile) {
    const prof = uss.data.skills_profile as Record<string, { level: string }>
    for (const skillName of Object.keys(prof)) {
      const level = normalizeSkillLevel((prof[skillName] as any)?.level || '') as any
      skillsProfileArr.push({ skillName, skillLevel: level })
    }
  }

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
      profile: skillsProfileArr,
      practiced: computeSkillsPracticed(logs)
    },
    program: { currentProgramId: ucp?.data?.current_program_id, generatedAt: ucp?.data?.program_generated_at },
    metcons: { last: metconsLast, timeDomainExposure },
    oly: computeOlyAggregates(logs, oneRMsLatest),
    blockCounts,
    contextHash: '',
    manifests: {
      performanceLogs: {
        count: Number(urp?.data?.total_sessions_all_time || logs.length || 0),
        earliest: undefined,
        latest: urp?.data?.last_session_date || undefined
      },
      metcons: {
        count: Number(ums?.data?.total_metcons_completed || 0),
        earliest: undefined,
        latest: ums?.data?.last_metcon_date || undefined
      },
      oneRms: {
        count: Number(ulo?.data?.total_one_rms || 0),
        earliest: undefined,
        latest: ulo?.data?.last_one_rm_date || undefined
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

function computeOlyAggregates(
  logs: Array<{ block: string; exercise_name?: string; rpe?: number; completion_quality?: number }>,
  oneRmsLatest: Array<{ exercise: string; value: number }>
) {
  const agg = (names: string[]) => {
    let n = 0, rpeSum = 0, rpeN = 0, qSum = 0, qN = 0
    for (const l of logs) {
      const ex = (l as any).exercise_name || ''
      if (!ex) continue
      if (names.some(name => ex.toLowerCase().includes(name))) {
        n++
        const rpe = Number((l as any).rpe)
        if (Number.isFinite(rpe)) { rpeSum += rpe; rpeN++ }
        const q = Number((l as any).completion_quality)
        if (Number.isFinite(q)) { qSum += q; qN++ }
      }
    }
    return { sessions: n, avgRpe: rpeN ? Number((rpeSum / rpeN).toFixed(2)) : undefined, avgQuality: qN ? Number((qSum / qN).toFixed(2)) : undefined }
  }

  const latest = (exerciseLike: string) => {
    for (const r of oneRmsLatest) {
      if (r.exercise.toLowerCase().includes(exerciseLike)) return r.value
    }
    return undefined
  }

  return {
    snatch: { ...agg(['snatch']), latestOneRm: latest('snatch') },
    cleanJerk: { ...agg(['clean and jerk', 'clean & jerk', 'c&j', 'clean', 'jerk']), latestOneRm: latest('clean') || latest('jerk') },
    proxies: {
      overheadSquat: agg(['overhead squat']),
      snatchBalance: agg(['snatch balance']),
      frontSquat: agg(['front squat'])
    }
  }
}

