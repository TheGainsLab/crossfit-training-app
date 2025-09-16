// lib/ai/optimized-context-system.ts
// Optimized context system using SQL views + in-memory cache

// Using a lightweight type alias to avoid TS type resolution errors in server builds
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// In-memory cache for this server instance
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
  constructor(private supabase: SupabaseClient) {}

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
    // Use programs -> program_metcons path
    const { data: programs } = await this.supabase
      .from('programs')
      .select('id')
      .eq('user_id', userId)
    const programIds = (programs || []).map(p => p.id)
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

    const recent5 = (data || []).slice(0, 5)
    const earlier5 = (data || []).slice(5, 10)
    let trend = 'stable'
    if (recent5.length >= 3 && earlier5.length >= 3) {
      const avg = (arr: any[]) => arr.reduce((s, m) => s + (m.percentile || 0), 0) / arr.length
      const rAvg = avg(recent5)
      const eAvg = avg(earlier5)
      if (rAvg > eAvg + 10) trend = 'improving'
      else if (rAvg < eAvg - 10) trend = 'declining'
    }
    return {
      type: 'metcon_history',
      results: data || [],
      summary: {
        totalCompleted: data?.length || 0,
        avgPercentile: (data && data.length) ? Number(((data.reduce((s, m) => s + (m.percentile || 0), 0) / data.length)).toFixed(1)) : 0,
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
    for (const r of (data || [])) {
      const key = (r as any).exercise_name
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    const progressionAnalysis = Array.from(map.entries()).map(([exercise, rows]) => {
      if (rows.length < 2) return { exercise, trend: 'insufficient_data' }
      const latest = Number((rows[0] as any).one_rm)
      const prev = Number((rows[1] as any).one_rm)
      if (!Number.isFinite(latest) || !Number.isFinite(prev) || prev === 0) return { exercise, trend: 'insufficient_data' }
      const changePct = ((latest - prev) / prev) * 100
      return {
        exercise,
        trend: changePct > 5 ? 'improving' : changePct < -2 ? 'declining' : 'stable',
        changePercent: Number(changePct.toFixed(1)),
        latest,
        previous: prev
      }
    })

    return {
      type: 'strength_progression',
      results: data || [],
      progressionAnalysis,
      summary: {
        totalRecords: data?.length || 0,
        exercises: [...new Set((data || []).map(d => (d as any).exercise_name))],
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
    for (const s of (data || [])) {
      const name = (s as any).exercise_name
      if (!skillsMap.has(name)) skillsMap.set(name, [])
      skillsMap.get(name)!.push(s)
    }
    const skillsAnalysis = Array.from(skillsMap.entries()).map(([skill, sessions]) => {
      const qSessions = sessions.filter(s => (s as any).completion_quality !== null && (s as any).completion_quality !== undefined)
      const avgQ = qSessions.length ? qSessions.reduce((sum, s) => sum + Number((s as any).completion_quality), 0) / qSessions.length : 0
      const recent = qSessions.slice(0, 5)
      const earlier = qSessions.slice(5, 10)
      let trend = 'stable'
      if (recent.length >= 3 && earlier.length >= 3) {
        const avg = (arr: any[]) => arr.reduce((s, r) => s + Number((r as any).completion_quality), 0) / arr.length
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
        uniqueSkills: [...new Set((data || []).map(d => (d as any).exercise_name))].length,
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
      summary: { totalSessions: (data || []).length, blocks: [...new Set((data || []).map(d => (d as any).block))] }
    }
  }

  // Cache management
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
      const firstKey = contextCache.keys().next().value
      contextCache.delete(firstKey)
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

// Stable stringify for cache keys
function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

// Classification
export function classifyQuestionAdvanced(message: string): QuestionClassification {
  const normalized = (message || '').toLowerCase().trim()
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
  const educational = [
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

// Cache utilities
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

