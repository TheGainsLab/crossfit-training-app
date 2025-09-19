// lib/ai/ai-training-service.ts
// Single-LLM flow: generate SQL → fetch via RPC with user JWT → synthesize response

import { SupabaseClient, createClient } from '@supabase/supabase-js'
import conceptualSchema from '@/lib/ai/schema/conceptual-schema.json'
import databaseSchema from '@/lib/ai/schema/database-schema.json'
import crypto from 'crypto'

export interface TrainingAssistantRequest {
  userQuestion: string
  userId: number
  conversationHistory?: Array<{ role: string; content: string }>
  userContext?: { name?: string; ability_level?: string; units?: string; current_program_id?: number }
}

export interface QueryExecution {
  sql: string
  purpose: string
  result: any[]
  rowCount: number
  executionTime: number
  cacheHit?: boolean
  error?: string
  errorClass?: string
}

export interface TrainingAssistantResponse {
  response: string
  queriesExecuted: QueryExecution[]
  performance: { totalTime: number; queryTime: number; responseTime: number; totalTokens: number; cacheHitRate: number }
  metadata: { queriesMade: number; totalRows: number; hasErrors: boolean; errorClasses: string[] }
}

type CacheEntry = { data: any[]; timestamp: number; ttl: number; sql: string }
const queryCache = new Map<string, CacheEntry>()

// Build schema allowlist for simple SQL identifier validation
type TableColumns = Record<string, Set<string>>
const tableToColumns: TableColumns = (() => {
  try {
    const map: TableColumns = {}
    const rows: Array<{ table_name: string; column_name: string }> = (databaseSchema as any)?.tables || []
    for (const r of rows) {
      const t = (r.table_name || '').toLowerCase()
      const c = (r.column_name || '').toLowerCase()
      if (!t || !c) continue
      if (!map[t]) map[t] = new Set<string>()
      map[t].add(c)
    }
    return map
  } catch {
    return {}
  }
})()
const allowedTables = new Set<string>(Object.keys(tableToColumns))

function getCacheKey(userId: number, sql: string): string {
  const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase()
  return crypto.createHash('md5').update(`user:${userId}|${normalized}`).digest('hex')
}

function getCachedResult(userId: number, sql: string): any[] | null {
  const k = getCacheKey(userId, sql)
  const e = queryCache.get(k)
  if (!e) return null
  if (Date.now() > e.timestamp + e.ttl) { queryCache.delete(k); return null }
  return e.data
}

function setCachedResult(userId: number, sql: string, data: any[], ttlMs = 60_000) {
  const k = getCacheKey(userId, sql)
  queryCache.set(k, { data, timestamp: Date.now(), ttl: ttlMs, sql })
}

setInterval(() => {
  const now = Date.now()
  for (const [k, e] of queryCache.entries()) { if (now > e.timestamp + e.ttl) queryCache.delete(k) }
}, 300_000)

function normalizeSql(sql: string): string {
  let s = sql.replace(/^--\s*Purpose:.*$/mi, '').trim().replace(/\s+/g, ' ')
  if (!/\border\s+by\b/i.test(s)) s += ' order by logged_at desc'
  if (!/\blimit\s+\d+\b/i.test(s)) s += ' limit 30'
  s = s.replace(/\blimit\s+(\d+)\b/i, (_m, n) => `limit ${Math.min(parseInt(n, 10) || 30, 50)}`)
  return s
}

function extractPurpose(sql: string): string {
  const m = sql.match(/^--\s*Purpose:\s*(.+)$/mi)
  return m?.[1]?.trim() || 'Database query'
}

function classifyError(err: any): string {
  const msg = String(err?.message || err || '')
  const l = msg.toLowerCase()
  if (l.includes('timeout') || l.includes('query_canceled')) return 'TIMEOUT'
  if (l.includes('only select') || l.includes('single select') || l.includes('not allowed')) return 'VALIDATION_ERROR'
  if (l.includes('permission') || l.includes('access')) return 'PERMISSION_ERROR'
  if (l.includes('sleep') || l.includes('pg_catalog') || l.includes('disallowed')) return 'SERVER_SECURITY_VIOLATION'
  if (l.includes('claude') || l.includes('anthropic')) return 'LLM_API_ERROR'
  return 'UNKNOWN_ERROR'
}

export class AITrainingAssistant {
  private supabase: SupabaseClient
  private claudeApiKey: string

  constructor(claudeApiKey: string, supabase: SupabaseClient) {
    this.claudeApiKey = claudeApiKey
    this.supabase = supabase
  }

  async generateResponse(req: TrainingAssistantRequest): Promise<TrainingAssistantResponse> {
    const t0 = Date.now()
    try {
      const queryPrompt = this.buildQueryPrompt(req)
      const qStart = Date.now()
      // Use Sonnet (or configured planner model) for query planning, fallback to Haiku
      let queryPlan: string
      try {
        queryPlan = await this.callClaudeWithModel(process.env.CLAUDE_PLANNER_MODEL || 'claude-3-5-sonnet-20241022', queryPrompt, 0.2)
      } catch (_e) {
        queryPlan = await this.callClaudeWithModel(process.env.CLAUDE_COACH_MODEL || 'claude-3-5-haiku-20241022', queryPrompt, 0.2)
      }
      console.debug('[AI][queryPlan]', queryPlan?.slice(0, 800))
      const queries = this.extractQueries(queryPlan)
      console.debug('[AI][queries]', queries)
      const executions = await this.executeQueries(req.userId, queries)
      const queryTime = Date.now() - qStart
      console.debug('[AI][executions]', executions.map(e => ({ purpose: e.purpose, rows: e.rowCount })))

      const coachingPrompt = this.buildCoachingPrompt(req, executions)
      const rStart = Date.now()
      const coaching = await this.callClaudeWithModel(process.env.CLAUDE_COACH_MODEL || 'claude-3-5-haiku-20241022', coachingPrompt, 0.3)
      const responseTime = Date.now() - rStart

      const totalTime = Date.now() - t0
      const cacheHits = executions.filter(e => e.cacheHit).length
      const cacheHitRate = executions.length ? cacheHits / executions.length : 0
      const errorClasses = [...new Set(executions.filter(e => e.errorClass).map(e => e.errorClass!))]

      const withSources = this.appendSources(coaching, executions)

      return {
        response: withSources,
        queriesExecuted: executions,
        performance: { totalTime, queryTime, responseTime, totalTokens: this.estimateTokens(queryPrompt + coachingPrompt + queryPlan + coaching), cacheHitRate },
        metadata: { queriesMade: executions.length, totalRows: executions.reduce((s, e) => s + e.rowCount, 0), hasErrors: executions.some(e => !!e.error), errorClasses }
      }
    } catch (err) {
      return {
        response: `I’m having trouble accessing your training data right now. ${String((err as any)?.message || '')}`,
        queriesExecuted: [],
        performance: { totalTime: Date.now() - t0, queryTime: 0, responseTime: 0, totalTokens: 0, cacheHitRate: 0 },
        metadata: { queriesMade: 0, totalRows: 0, hasErrors: true, errorClasses: [classifyError(err)] }
      }
    }
  }

  private buildQueryPrompt(req: TrainingAssistantRequest): string {
    const schemaGuidance = this.buildSchemaGuidance(req.userQuestion)
    return `You are a database query specialist for a fitness application. Generate the MINIMAL set of SQL queries (1-3) to retrieve data needed to answer the user's question.

STRICT OUTPUT CONTRACT:
- OUTPUT JSON ONLY (no prose, no code fences)
- EXACT SHAPE:
{
  "queries": [
    { "purpose": "...", "sql": "SELECT ... WHERE user_id = ${req.userId} ... LIMIT X" }
  ]
}

HARD RULES:
1) Every query MUST include: WHERE user_id = ${req.userId}
2) Use single SELECT per query
3) LIMIT 10-30 rows; ORDER BY relevant date DESC when applicable
4) Only include columns that exist
5) Prefer recent data and focused scopes
6) Safe numeric parsing: For text numeric fields (e.g., reps), only cast after validating with a numeric-only regex (e.g., column ~ '^[0-9]+$'). Exclude NULL/empty/non-numeric rows from aggregates.

USER QUESTION: "${req.userQuestion}"
USER: ${req.userContext?.name || 'Athlete'} (${req.userContext?.ability_level || 'Unknown'}, ${req.userContext?.units || 'Unknown'})

SCHEMA GUIDANCE:
${schemaGuidance}

COMMON PATTERNS (examples):
- Highest quality skills →
  SELECT exercise_name, AVG(completion_quality) AS avg_quality, COUNT(*) AS sessions
  FROM performance_logs
  WHERE user_id = ${req.userId} AND block = 'SKILLS' AND completion_quality IS NOT NULL
    AND logged_at >= NOW() - INTERVAL '90 days'
  GROUP BY exercise_name
  HAVING COUNT(*) >= 3
  ORDER BY avg_quality DESC
  LIMIT 10

- Top skills by total reps →
  SELECT exercise_name, SUM(reps::int) AS total_reps
  FROM performance_logs
  WHERE user_id = ${req.userId}
    AND block = 'SKILLS'
    AND reps IS NOT NULL
    AND reps ~ '^[0-9]+$'
  GROUP BY exercise_name
  ORDER BY total_reps DESC
  LIMIT 2

- Recent metcon results →
  SELECT pm.metcon_id, pm.user_score, pm.percentile, pm.performance_tier, pm.completed_at, pm.week, pm.day
  FROM program_metcons pm
  JOIN programs p ON p.id = pm.program_id
  WHERE p.user_id = ${req.userId} AND pm.completed_at IS NOT NULL
  ORDER BY pm.completed_at DESC
  LIMIT 20

- Olympic lifting overview → join recent SKILLS and STRENGTH blocks by exercise family or use user_latest_one_rms for latest 1RMs

Generate only the JSON object described above.`
  }

  private buildCoachingPrompt(req: TrainingAssistantRequest, results: QueryExecution[]): string {
    const data = results
      .map((r, i) => `Dataset ${i + 1} (${r.purpose}) rows=${r.rowCount}: ${JSON.stringify(r.result.slice(0, 3))}`)
      .join('\n')
    const recent = (req.conversationHistory || [])
      .slice(-3)
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n')

    // Build allowlist of entities from returned datasets (exercises and metcon identifiers)
    const allowedExerciseSet = new Set<string>()
    const allowedMetconIds = new Set<string>()
    const allowedFields = new Set<string>()
    for (const exec of results) {
      const rows = Array.isArray(exec.result) ? exec.result : []
      for (const row of rows) {
        const ex = (row?.exercise_name || row?.skill_name || row?.movement || row?.exercise || '').toString().trim()
        if (ex) allowedExerciseSet.add(ex)
        if (row?.metcon_id !== undefined && row?.metcon_id !== null) allowedMetconIds.add(String(row.metcon_id))
        // Collect common fields that can be referenced safely in prose
        for (const key of Object.keys(row || {})) {
          allowedFields.add(key)
        }
      }
    }
    const allowedExercises = Array.from(allowedExerciseSet)
    const allowedEntitiesText = `EXERCISES: ${allowedExercises.join(', ') || '(none)'} | METCON_IDS: ${Array.from(allowedMetconIds).join(', ') || '(none)'} | FIELDS: ${Array.from(allowedFields).slice(0, 30).join(', ')}`

    return `You are an expert CrossFit coach analyzing a user's training data. Provide specific, actionable coaching advice based on their actual performance patterns.
IMPORTANT HARD CONSTRAINTS:
- Only mention entities that appear in ALLOWED_ENTITIES below. If something was not returned in the datasets, do not reference it.
- If the datasets contain zero rows relevant to the user's question, reply with exactly: "no data".

USER: "${req.userQuestion}"
USER CONTEXT: ${req.userContext?.name || 'Athlete'} (${req.userContext?.ability_level || 'Unknown'} level, ${req.userContext?.units || 'Unknown'} units)

ALLOWED_ENTITIES: ${allowedEntitiesText}

AVAILABLE DATA:
${data || 'none'}
${recent ? `\nRECENT CONVERSATION:\n${recent}` : ''}

COACHING GUIDELINES:
1) Be specific: reference actual numbers, dates, and trends from the data
2) Explain patterns (e.g., rising RPE + declining quality = overreaching)
3) Give 1-3 concrete next steps (volume/intensity/time-domain)
4) Stay in scope: only what the data supports, and only use ALLOWED_ENTITIES

INTERPRETATION GUIDE (reminder):
- RPE 1-6: easy; 7-8: solid; 9-10: limit
- Quality 4 excellent; 3 good; 2 breakdown; 1 struggling

RESPONSE STRUCTURE (no invented examples):
1) Direct answer
2) Key observations (with exact numbers)
3) Actionable recommendations
4) Sources (datasets used)
`
  }

  private extractQueries(responseText: string): string[] {
    // Strip common wrappers
    let text = (responseText || '').replace(/```json\s*|```/g, '').trim()
    let parsed: any = null
    try {
      parsed = JSON.parse(text)
    } catch {
      // Fallback: attempt to locate first JSON object in the string
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        try { parsed = JSON.parse(match[0]) } catch {}
      }
    }
    if (!parsed || !Array.isArray(parsed.queries)) {
      // Safe default: no queries (coach prompt will reflect 'none')
      return []
    }
    const out: string[] = []
    for (const q of parsed.queries.slice(0, 5)) {
      if (!q?.sql || typeof q.sql !== 'string') continue
      const sql = q.sql.trim()
      // Enforce required predicates
      if (!/where\s+.*user_id\s*=\s*\d+/i.test(sql)) continue
      // Validate identifiers (very light check)
      const fromMatch = sql.match(/from\s+([a-zA-Z0-9_]+)(?:\s+as\s+([a-zA-Z0-9_]+)|\s+([a-zA-Z0-9_]+))?/i)
      if (fromMatch) {
        const table = (fromMatch[1] || '').toLowerCase()
        if (!allowedTables.has(table)) continue
      }
      const purpose = (q?.purpose && typeof q.purpose === 'string') ? q.purpose : 'Database query'
      out.push(`-- Purpose: ${purpose}\n${sql}`)
    }
    if (!out.length) throw new Error('No valid queries')
    return out
  }

  private async executeQueries(userId: number, queries: string[]): Promise<QueryExecution[]> {
    const results: QueryExecution[] = []
    let queriesRun = 0
    for (const raw of queries) {
      if (queriesRun >= 5) break
      const t = Date.now()
      const purpose = extractPurpose(raw)
      const sql = normalizeSql(raw)
      try {
        const cached = getCachedResult(userId, sql)
        if (cached) {
          results.push({ sql, purpose, result: cached, rowCount: cached.length, executionTime: Date.now() - t, cacheHit: true })
          queriesRun++
          continue
        }
        const { data, error } = await this.supabase.rpc('execute_user_query', { query_sql: sql, requesting_user_id: userId })
        if (error) throw error
        const rows = Array.isArray(data) ? data : []
        setCachedResult(userId, sql, rows, 60_000)
        results.push({ sql, purpose, result: rows, rowCount: rows.length, executionTime: Date.now() - t, cacheHit: false })
        queriesRun++
      } catch (err) {
        results.push({ sql, purpose, result: [], rowCount: 0, executionTime: Date.now() - t, cacheHit: false, error: String((err as any)?.message || err), errorClass: classifyError(err) })
      }
    }
    return results
  }

  private appendSources(text: string, results: QueryExecution[]): string {
    const lines = results.map((r, i) => `- ${r.purpose}: ${r.rowCount} rows (q${i + 1})`)
    return `${text}\n\nSources:\n${lines.join('\n')}`
  }

  private async callClaudeWithModel(model: string, prompt: string, temperature = 0.2): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.claudeApiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 2000, temperature, messages: [{ role: 'user', content: prompt }] })
    })
    if (!res.ok) throw new Error(`Claude API error ${res.status}`)
    const data = await res.json()
    return data.content?.[0]?.text || ''
  }

  private buildSchemaGuidance(userQuestion: string): string {
    const lower = (userQuestion || '').toLowerCase()
    let targeted = ''
    if (/(performance|workout|exercise)/.test(lower)) {
      targeted += `\n**performance_logs**: block, exercise_name, rpe, completion_quality, logged_at (use WHERE user_id, ORDER BY logged_at DESC)`
    }
    if (/(metcon|metcons|conditioning)/.test(lower)) {
      targeted += `\n**program_metcons** (PRIMARY): metcon completions and percentiles; join programs to filter by user_id; use completed_at DESC`
      targeted += `\n**performance_logs** (SECONDARY tasks): block task entries; not authoritative for metcon summary`
      targeted += `\n**user_metcon_summary**: total_metcons_completed, recent_metcons JSON summary`
    }
    if (/(strength|1rm|max|pr)/.test(lower)) {
      targeted += `\n**user_latest_one_rms**: latest one_rm values by exercise (use WHERE user_id)`
    }
    if (/(tired|recovery|rest|overtraining)/.test(lower)) {
      targeted += `\n**user_recent_performance**: avg_rpe, avg_quality, sessions, trends (use WHERE user_id)`
    }
    if (/(program|plan|schedule|today)/.test(lower)) {
      targeted += `\n**program_workouts**: week, day, main_lift, is_deload (filter by current program if applicable)`
    }
    const concept = this.truncateForPrompt(JSON.stringify(conceptualSchema))
    const full = this.truncateForPrompt(JSON.stringify(databaseSchema))
    return `${targeted || '\n(Use recent, relevant tables)'}\n\nCONCEPTUAL SCHEMA (summary):\n${concept}\n\nDATABASE SCHEMA (summary):\n${full}`
  }

  private truncateForPrompt(s: string, max = 1200): string {
    if (!s) return ''
    return s.length > max ? s.slice(0, max) + '... (truncated)' : s
  }

  private estimateTokens(s: string): number { return Math.ceil((s || '').length / 4) }
}

export function createAITrainingAssistantForUser(supabase: SupabaseClient): AITrainingAssistant {
  const claudeApiKey = process.env.CLAUDE_API_KEY
  if (!claudeApiKey) throw new Error('CLAUDE_API_KEY missing')
  return new AITrainingAssistant(claudeApiKey, supabase)
}

// Optional cache invalidation hook: call on writes impacting analytics
export function invalidateCacheOnDataWrite(userId: number, tableName: string) {
  for (const [key, entry] of queryCache.entries()) {
    if (!key.startsWith(crypto.createHash('md5').update(`user:${userId}`).digest('hex'))) continue
    if (!tableName) { queryCache.delete(key); continue }
    if (entry.sql.toLowerCase().includes(tableName.toLowerCase())) queryCache.delete(key)
  }
}

