// lib/ai/context-builder.ts
// Build a comprehensive ContextFeatures object for AI reasoning
// NOTE: This is a first pass that focuses on the most impactful signals.

import { buildContextHash } from '@/lib/ai/decision-policy'
import { normalizeExerciseToFamily } from '@/lib/ai/families'

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
  lastNLogs: Array<{ date: string; block: 'SKILLS'|'STRENGTH AND POWER'|'METCONS'; exercise?: string; rpe?: number; quality?: number; result?: string; sets?: number; reps?: number; weight_time?: number }>

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

  // Optional extended fields
  sessionsPerWeek?: number
  ratios?: {
    limiters?: string[]
    key?: { frontSquatBackSquat?: number; overheadSquatBackSquat?: number }
    technicalFocus?: string
  }
  performanceRisks?: string[]

  // Manifests for unbounded history (counts and ranges)
  manifests?: {
    performanceLogs?: { count: number; earliest?: string; latest?: string }
    metcons?: { count: number; earliest?: string; latest?: string }
    oneRms?: { count: number; earliest?: string; latest?: string }
  }

  // Families/groupings (exercise taxonomy)
  families?: {
    recentByFamily?: Record<string, { sessions: number; avgRpe?: number; avgQuality?: number }>
    skillsByFamily?: Record<string, { count: number; highestLevel?: 'DontHave'|'Beginner'|'Intermediate'|'Advanced' }>
    planByFamily?: Record<string, number>
  }

  // Optional: extracted at API level for current question
  mentionedExerciseFamily?: string | null
}

export async function buildContextFeatures(supabase: SupabaseClientLike, userId: number): Promise<ContextFeatures> {
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // Use optimized views wherever possible; fetch a bounded slice of performance_logs for light aggregates
  const [ucp, urp, ulo, uss, ums, perfLogsRes, ratiosRes] = await Promise.all([
    supabase.from('user_complete_profile').select('*').eq('user_id', userId).single(),
    supabase.from('user_recent_performance').select('*').eq('user_id', userId).single(),
    supabase.from('user_latest_one_rms').select('*').eq('user_id', userId).single(),
    supabase.from('user_skills_summary').select('*').eq('user_id', userId).single(),
    supabase.from('user_metcon_summary').select('*').eq('user_id', userId).single(),
    supabase.from('performance_logs').select('block, exercise_name, rpe, completion_quality, result, logged_at, sets, reps, weight_time').eq('user_id', userId).order('logged_at', { ascending: false }).limit(500),
    supabase.from('latest_user_ratios').select('*').eq('user_id', userId).maybeSingle?.() ?? supabase.from('latest_user_ratios').select('*').eq('user_id', userId).single()
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
    .slice(0, 100)
    .map(l => ({
      date: l.logged_at,
      block: l.block,
      exercise: l.exercise_name || undefined,
      rpe: typeof l.rpe === 'number' ? l.rpe : undefined,
      quality: typeof l.completion_quality === 'number' ? l.completion_quality : undefined,
      result: l.result || undefined,
      sets: typeof (l as any).sets === 'number' ? Number((l as any).sets) : undefined,
      reps: typeof (l as any).reps === 'number' ? Number((l as any).reps) : undefined,
      weight_time: typeof (l as any).weight_time === 'number' ? Number((l as any).weight_time) : undefined
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
    sessionsPerWeek: Number(urp?.data?.sessions_per_week ?? 0) || undefined,
    ratios: buildRatios(ratiosRes?.data),
    performanceRisks: buildPerformanceRisks(rpePatterns, completionQuality, Number(urp?.data?.sessions_per_week ?? 0)) ,
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
    },
    families: {
      recentByFamily: groupRecentByFamily(logs),
      skillsByFamily: groupSkillsByFamily(skillsProfileArr),
      planByFamily: undefined
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

// ================= Unified optimized context system (classification + cached builders) =================

// In-memory cache for this server instance (unified)
const contextCache = new Map<string, { data: any; timestamp: number; ttl: number }>()

export interface OptimizedContext {
  userId: number
  contextType: 'educational' | 'basic' | 'performance' | 'historical'
  data: any
  buildTime: number
  cacheHit: boolean
  queriesExecuted: number
  optimization: string
}

export interface QuestionClassification {
  type: 'educational' | 'basic' | 'performance' | 'historical'
  confidence: number
  requiresDatabase: boolean
  estimatedQueries: number
  querySpecific?: any
}

export class OptimizedContextBuilder {
  constructor(private supabase: SupabaseClientLike) {}

  async buildContext(
    userId: number,
    contextType: 'basic' | 'performance' | 'historical',
    querySpecific?: any
  ): Promise<OptimizedContext> {
    const startTime = Date.now()
    const cacheKey = this.buildCacheKey(userId, contextType, querySpecific)

    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return {
        userId,
        contextType,
        data: cached,
        buildTime: Date.now() - startTime,
        cacheHit: true,
        queriesExecuted: 0,
        optimization: 'Memory cache hit'
      }
    }

    let contextData: any
    let queriesExecuted = 0
    let optimization = ''

    switch (contextType) {
      case 'basic':
        contextData = await this.buildBasicContextOptimized(userId)
        queriesExecuted = 1
        optimization = 'Single view query (user_complete_profile)'
        break
      case 'performance':
        contextData = await this.buildPerformanceContextOptimized(userId)
        queriesExecuted = 2
        optimization = 'Two optimized view queries'
        break
      case 'historical':
        contextData = await this.buildHistoricalContextOptimized(userId, querySpecific)
        queriesExecuted = 3
        optimization = 'Targeted historical queries with views'
        break
      default:
        throw new Error(`Unknown context type: ${contextType}`)
    }

    this.setInCache(cacheKey, contextData, this.getTTL(contextType))

    return {
      userId,
      contextType,
      data: contextData,
      buildTime: Date.now() - startTime,
      cacheHit: false,
      queriesExecuted,
      optimization
    }
  }

  private async buildBasicContextOptimized(userId: number) {
    const { data, error } = await this.supabase
      .from('user_complete_profile')
      .select('*')
      .eq('user_id', userId)
      .single()
    if (error) throw error

    return {
      userId,
      identity: {
        name: data.name,
        abilityLevel: data.ability_level,
        bodyWeight: data.body_weight,
        units: data.units,
        joinDate: data.join_date,
        gender: data.gender,
        subscriptionTier: data.subscription_tier,
        subscriptionStatus: data.subscription_status
      },
      preferences: {
        trainingDaysPerWeek: data.training_days_per_week,
        primaryGoals: data.three_month_goals || data.monthly_primary_goal,
        avoidedExercises: data.avoided_exercises || [],
        preferredMetconExercises: data.preferred_metcon_exercises || [],
        primaryStrengthLifts: data.primary_strength_lifts || [],
        emphasizedStrengthLifts: data.emphasized_strength_lifts || []
      },
      equipment: {
        available: data.available_equipment || []
      },
      program: {
        currentId: data.current_program_id,
        weeksGenerated: data.weeks_generated,
        generatedAt: data.program_generated_at
      }
    }
  }

  private async buildPerformanceContextOptimized(userId: number) {
    const [basicContext, performanceData] = await Promise.all([
      this.buildBasicContextOptimized(userId),
      this.supabase
        .from('user_recent_performance')
        .select('*')
        .eq('user_id', userId)
        .single()
    ])

    const perfData = performanceData.data
    const fatigueSignals: string[] = []
    if (perfData?.avg_rpe_14d && perfData.avg_rpe_14d > 7.5) fatigueSignals.push('High RPE trend (>7.5/10)')
    if (perfData?.avg_quality_14d && perfData.avg_quality_14d < 2.5) fatigueSignals.push('Quality declining (<2.5/4)')
    if (perfData?.sessions_14d && perfData.sessions_14d < 3) fatigueSignals.push('Low training frequency')

    const rpe14d = perfData?.avg_rpe_14d || 0
    const rpe30d = perfData?.avg_rpe_30d || 0
    if (rpe14d > rpe30d + 0.5) fatigueSignals.push('RPE increasing over time')

    return {
      ...basicContext,
      recentPerformance: {
        sessions14d: perfData?.sessions_14d || 0,
        sessions30d: perfData?.sessions_30d || 0,
        avgRpe14d: perfData?.avg_rpe_14d ? Number(perfData.avg_rpe_14d.toFixed(1)) : 0,
        avgQuality14d: perfData?.avg_quality_14d ? Number(perfData.avg_quality_14d.toFixed(1)) : 0,
        avgRpe30d: perfData?.avg_rpe_30d ? Number(perfData.avg_rpe_30d.toFixed(1)) : 0,
        avgQuality30d: perfData?.avg_quality_30d ? Number(perfData.avg_quality_30d.toFixed(1)) : 0,
        sessionsPerWeek: perfData?.sessions_per_week || 0,
        lastSession: perfData?.last_session_date,
        totalSessionsAllTime: perfData?.total_sessions_all_time || 0,
        fatigueSignals
      },
      blockDistribution: {
        skills: perfData?.skills_sessions_30d || 0,
        strength: perfData?.strength_sessions_30d || 0,
        metcons: perfData?.metcons_sessions_30d || 0
      }
    }
  }

  private async buildHistoricalContextOptimized(userId: number, querySpecific: any) {
    const [performanceContext, historicalData] = await Promise.all([
      this.buildPerformanceContextOptimized(userId),
      this.buildSpecificHistoricalData(userId, querySpecific)
    ])
    return { ...performanceContext, historical: historicalData }
  }

  private async buildSpecificHistoricalData(userId: number, querySpecific: any) {
    const { type, filters } = querySpecific || { type: 'general', filters: {} }
    switch (type) {
      case 'metcon_history':
        return this.getMetconHistory(userId, filters)
      case 'strength_progression':
        return this.getStrengthProgression(userId, filters)
      case 'skills_practice':
        return this.getSkillsPractice(userId, filters)
      default:
        return this.getRecentLogs(userId, filters)
    }
  }

  private async getMetconHistory(userId: number, filters: any) {
    const { data: programs } = await this.supabase
      .from('programs')
      .select('id')
      .eq('user_id', userId)
    const programIds = (programs || []).map((p: any) => p.id)
    if (!programIds.length) {
      return { type: 'metcon_history', results: [], summary: { totalCompleted: 0, avgPercentile: 0, trend: 'no_data' } }
    }
    const { data } = await this.supabase
      .from('program_metcons')
      .select('metcon_id, week, day, user_score, percentile, performance_tier, completed_at')
      .in('program_id', programIds)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(filters.limit || 20)

    const recent5 = (data || []).slice(0, 5) as Array<{ percentile?: number }>
    const earlier5 = (data || []).slice(5, 10) as Array<{ percentile?: number }>
    let trend = 'stable'
    if (recent5.length >= 3 && earlier5.length >= 3) {
      const avg = (arr: Array<{ percentile?: number }>) => arr.reduce((s, m) => s + (m.percentile || 0), 0) / arr.length
      const rAvg = avg(recent5)
      const eAvg = avg(earlier5)
      if (rAvg > eAvg + 10) trend = 'improving'
      else if (rAvg < eAvg - 10) trend = 'declining'
    }
    return {
      type: 'metcon_history',
      results: data || [],
      summary: {
        totalCompleted: (data || []).length,
        avgPercentile: (data && data.length) ? Number(((data.reduce((s: number, m: any) => s + (m.percentile || 0), 0) / data.length)).toFixed(1)) : 0,
        trend
      }
    }
  }

  private async getStrengthProgression(userId: number, filters: any) {
    let query = this.supabase
      .from('user_one_rms')
      .select('exercise_name, one_rm, recorded_at')
      .eq('user_id', userId)
    if (filters.exercise) query = query.eq('exercise_name', filters.exercise)
    const { data } = await query.order('recorded_at', { ascending: false }).limit(filters.limit || 50)

    const map = new Map<string, any[]>()
    for (const r of ((data || []) as Array<{ exercise_name: string }>)) {
      const key = r.exercise_name
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r as any)
    }
    const progressionAnalysis = Array.from(map.entries()).map(([exercise, rows]) => {
      if (rows.length < 2) return { exercise, trend: 'insufficient_data' }
      const latest = Number((rows[0] as any).one_rm)
      const prev = Number((rows[1] as any).one_rm)
      if (!Number.isFinite(latest) || !Number.isFinite(prev) || prev === 0) return { exercise, trend: 'insufficient_data' }
      const changePct = ((latest - prev) / prev) * 100
      return { exercise, trend: changePct > 5 ? 'improving' : changePct < -2 ? 'declining' : 'stable', changePercent: Number(changePct.toFixed(1)), latest, previous: prev }
    })

    return {
      type: 'strength_progression',
      results: data || [],
      progressionAnalysis,
      summary: {
        totalRecords: (data || []).length,
        exercises: [...new Set(((data || []) as Array<{ exercise_name: string }>).map(d => d.exercise_name))],
        improvingCount: progressionAnalysis.filter(p => p.trend === 'improving').length
      }
    }
  }

  private async getSkillsPractice(userId: number, filters: any) {
    let query = this.supabase
      .from('performance_logs')
      .select('exercise_name, completion_quality, rpe, logged_at')
      .eq('user_id', userId)
      .eq('block', 'SKILLS')
    if (filters.exercise) query = query.eq('exercise_name', filters.exercise)
    const { data } = await query.order('logged_at', { ascending: false }).limit(filters.limit || 100)

    const skillsMap = new Map<string, any[]>()
    for (const s of ((data || []) as Array<{ exercise_name: string }>)) {
      const name = s.exercise_name
      if (!skillsMap.has(name)) skillsMap.set(name, [])
      skillsMap.get(name)!.push(s as any)
    }
    const skillsAnalysis = Array.from(skillsMap.entries()).map(([skill, sessions]) => {
      const qSessions = sessions.filter((s: any) => s.completion_quality !== null && s.completion_quality !== undefined)
      const avgQ = qSessions.length ? qSessions.reduce((sum: number, s: any) => sum + Number(s.completion_quality), 0) / qSessions.length : 0
      const recent = qSessions.slice(0, 5)
      const earlier = qSessions.slice(5, 10)
      let trend = 'stable'
      if (recent.length >= 3 && earlier.length >= 3) {
        const avg = (arr: any[]) => arr.reduce((s: number, r: any) => s + Number(r.completion_quality), 0) / arr.length
        const rAvg = avg(recent)
        const eAvg = avg(earlier)
        if (rAvg > eAvg + 0.3) trend = 'improving'
        else if (rAvg < eAvg - 0.3) trend = 'declining'
      }
      return { skill, sessionsCount: sessions.length, avgQuality: Number(avgQ.toFixed(1)), trend, needsWork: avgQ < 2.5 && sessions.length >= 3 }
    })

    return {
      type: 'skills_practice',
      results: data || [],
      skillsAnalysis,
      summary: {
        totalSessions: (data || []).length,
        uniqueSkills: [...new Set(((data || []) as Array<{ exercise_name: string }>).map(d => d.exercise_name))].length,
        skillsNeedingWork: skillsAnalysis.filter(s => s.needsWork).length
      }
    }
  }

  private async getRecentLogs(userId: number, filters: any) {
    const { data } = await this.supabase
      .from('performance_logs')
      .select('exercise_name, rpe, completion_quality, logged_at, block')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(filters.limit || 50)
    return {
      type: 'recent_logs',
      results: data || [],
      summary: { totalSessions: (data || []).length, blocks: [...new Set(((data || []) as Array<{ block: string }>).map(d => d.block))] }
    }
  }

  // cache
  private buildCacheKey(userId: number, contextType: string, querySpecific?: any): string {
    const specific = querySpecific ? stableStringify(querySpecific) : ''
    return `${userId}:${contextType}:${specific}`
  }
  private getFromCache(key: string): any | null {
    const cached = contextCache.get(key)
    if (!cached) return null
    const now = Date.now()
    if (now > cached.timestamp + cached.ttl) {
      contextCache.delete(key)
      return null
    }
    return cached.data
  }
  private setInCache(key: string, data: any, ttlMs: number): void {
    if (contextCache.size > 200) {
      const firstKey = contextCache.keys().next().value as string | undefined
      if (firstKey !== undefined) contextCache.delete(firstKey)
    }
    contextCache.set(key, { data, timestamp: Date.now(), ttl: ttlMs })
  }
  private getTTL(contextType: string): number {
    switch (contextType) {
      case 'basic': return 4 * 60 * 60 * 1000
      case 'performance': return 30 * 60 * 1000
      case 'historical': return 60 * 60 * 1000
      default: return 60 * 60 * 1000
    }
  }
  cleanExpiredCache(): void {
    const now = Date.now()
    for (const [key, cached] of contextCache.entries()) {
      if (now > cached.timestamp + cached.ttl) contextCache.delete(key)
    }
  }
}

function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

export function classifyQuestionAdvanced(message: string): QuestionClassification {
  const normalized = (message || '').toLowerCase().trim()

  // Strength-focused queries should use performance context
  const strengthTerms = /(strength|1rm|personal\s*record|pr\b|squat|deadlift|bench|press|clean|snatch|jerk)/i
  if (strengthTerms.test(normalized)) {
    return { type: 'performance', confidence: 0.9, requiresDatabase: true, estimatedQueries: 2 }
  }
  if (isEducationalQuestion(normalized)) {
    return { type: 'educational', confidence: 0.9, requiresDatabase: false, estimatedQueries: 0 }
  }
  if (isHistoricalQuery(normalized)) {
    const historyType = determineHistoryType(normalized)
    const filters = extractFilters(normalized)
    return { type: 'historical', confidence: 0.8, requiresDatabase: true, estimatedQueries: 3, querySpecific: { type: historyType, filters } }
  }
  if (isPerformanceQuestion(normalized)) {
    return { type: 'performance', confidence: 0.8, requiresDatabase: true, estimatedQueries: 2 }
  }
  return { type: 'basic', confidence: 0.7, requiresDatabase: true, estimatedQueries: 1 }
}

function isEducationalQuestion(text: string): boolean {
  const educational: RegExp[] = [
    /what are (good|best|some).*(exercise|drill|movement|stretch|food|supplement)/,
    /how (to|do you).*(perform|do|execute|improve).*(squat|deadlift|press|clean|snatch)/,
    /what is.*(proper form|correct technique|best way|recommended)/,
    /how much (protein|water|sleep|rest|time)/,
    /when should (i|you).*(eat|train|rest|sleep)/,
    /is it better to.*(do|perform|eat|train)/
  ]
  return educational.some((p: RegExp) => p.test(text)) && !['my', 'i have', 'my recent', 'my last', 'my current'].some((p: string) => text.includes(p))
}
function isHistoricalQuery(text: string): boolean {
  return /\b(last \d+|past \d+|history|progression|trend|my scores|show me my|how have i|how did i)\b/.test(text)
}
function isPerformanceQuestion(text: string): boolean {
  return /\b(should i|can i add|how am i|ready for|deload|fatigue|recover|capacity)\b/.test(text)
}
function determineHistoryType(message: string): string {
  if (/metcon|workout|wod/i.test(message)) return 'metcon_history'
  if (/skill|practice|movement/i.test(message)) return 'skills_practice'
  return 'strength_progression'
}
function extractFilters(message: string): any {
  const filters: any = {}
  const numberMatch = message.match(/last (\d+)|past (\d+)/i)
  if (numberMatch) {
    const numStr: string = (numberMatch[1] ?? numberMatch[2]) as string
    filters.limit = parseInt(numStr, 10)
  }
  const exercises: string[] = ['squat', 'deadlift', 'press', 'snatch', 'clean', 'jerk', 'pull-up']
  for (const ex of exercises) { if (message.includes(ex)) { filters.exercise = ex; break } }
  const equipment: string[] = ['barbell', 'dumbbell', 'kettlebell', 'bodyweight']
  for (const eq of equipment) { if (message.includes(eq)) { filters.equipment = eq; break } }
  return filters
}

// Cache utilities exports
export function getPerformanceMetrics() {
  // @ts-ignore Node only
  const mem = (globalThis as any).process?.memoryUsage ? (globalThis as any).process.memoryUsage() : null
  return { cacheSize: contextCache.size, cacheKeys: Array.from(contextCache.keys()), memoryUsage: mem }
}
export function clearCache() { contextCache.clear() }
export function getCacheStats() {
  const stats = { totalEntries: contextCache.size, entriesByType: {} as Record<string, number>, oldestEntry: null as string | null, newestEntry: null as string | null }
  let oldestTime = Date.now()
  let newestTime = 0
  for (const [key, cached] of contextCache.entries()) {
    const type = key.split(':')[1]
    stats.entriesByType[type] = (stats.entriesByType[type] || 0) + 1
    if (cached.timestamp < oldestTime) { oldestTime = cached.timestamp; stats.oldestEntry = key }
    if (cached.timestamp > newestTime) { newestTime = cached.timestamp; stats.newestEntry = key }
  }
  return stats
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

function groupRecentByFamily(logs: Array<{ exercise_name?: string; rpe?: number; completion_quality?: number }>): Record<string, { sessions: number; avgRpe?: number; avgQuality?: number }> {
  const map: Record<string, { n: number; rpeSum: number; rpeN: number; qSum: number; qN: number }> = {}
  for (const l of logs) {
    const fam = normalizeExerciseToFamily((l as any).exercise_name || '')
    if (!fam) continue
    if (!map[fam]) map[fam] = { n: 0, rpeSum: 0, rpeN: 0, qSum: 0, qN: 0 }
    map[fam].n += 1
    const r = Number((l as any).rpe)
    if (Number.isFinite(r)) { map[fam].rpeSum += r; map[fam].rpeN += 1 }
    const q = Number((l as any).completion_quality)
    if (Number.isFinite(q)) { map[fam].qSum += q; map[fam].qN += 1 }
  }
  const out: Record<string, { sessions: number; avgRpe?: number; avgQuality?: number }> = {}
  for (const fam of Object.keys(map)) {
    const s = map[fam]
    out[fam] = {
      sessions: s.n,
      avgRpe: s.rpeN ? Number((s.rpeSum / s.rpeN).toFixed(2)) : undefined,
      avgQuality: s.qN ? Number((s.qSum / s.qN).toFixed(2)) : undefined
    }
  }
  return out
}

function groupSkillsByFamily(skillsProfileArr: Array<{ skillName: string; skillLevel: 'DontHave'|'Beginner'|'Intermediate'|'Advanced' }>): Record<string, { count: number; highestLevel?: 'DontHave'|'Beginner'|'Intermediate'|'Advanced' }> {
  const rank = { 'DontHave': 0, 'Beginner': 1, 'Intermediate': 2, 'Advanced': 3 } as const
  const out: Record<string, { count: number; highestLevel?: 'DontHave'|'Beginner'|'Intermediate'|'Advanced' }> = {}
  for (const s of skillsProfileArr) {
    const fam = normalizeExerciseToFamily(s.skillName)
    if (!fam) continue
    if (!out[fam]) out[fam] = { count: 0, highestLevel: undefined }
    out[fam].count += 1
    const current = out[fam].highestLevel
    if (!current || rank[s.skillLevel] > rank[current]) out[fam].highestLevel = s.skillLevel
  }
  return out
}

// Note: program_workouts is intentionally not used; upcoming plan summaries are omitted

function buildRatios(row: any | null | undefined) {
  if (!row) return undefined
  const limiters: string[] = []
  if (row.needs_upper_back) limiters.push('upper_back')
  if (row.needs_posterior_chain) limiters.push('posterior_chain')
  if (row.needs_leg_strength) limiters.push('leg_strength')
  if (row.needs_upper_body_pulling) limiters.push('upper_body_pulling')
  return {
    limiters: limiters.length ? limiters : undefined,
    key: {
      frontSquatBackSquat: asNumOrUndef(row.front_squat_back_squat),
      overheadSquatBackSquat: asNumOrUndef(row.overhead_squat_back_squat)
    },
    technicalFocus: row.back_squat_technical_focus || undefined
  }
}

function buildPerformanceRisks(rpe: any, quality: any, sessionsPerWeek: number): string[] | undefined {
  const risks: string[] = []
  const rpe30 = Number(rpe?.d30)
  const q30 = Number(quality?.d30)
  if (Number.isFinite(rpe30) && rpe30 > 8.5) risks.push('high_fatigue')
  if (Number.isFinite(q30) && q30 < 2.5) risks.push('declining_quality')
  if (Number.isFinite(sessionsPerWeek) && sessionsPerWeek > 7) risks.push('high_frequency')
  return risks.length ? risks : undefined
}

function asNumOrUndef(v: any): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

