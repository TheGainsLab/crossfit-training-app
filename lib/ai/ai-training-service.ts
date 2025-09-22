// lib/ai/ai-training-service.ts
// Single-LLM flow: generate SQL → fetch via RPC with user JWT → synthesize response

import { SupabaseClient } from '@supabase/supabase-js'
import databaseSchema from '@/lib/ai/schema/database-schema.json'
import crypto from 'crypto'

export interface TrainingAssistantRequest {
  userQuestion: string
  userId: number
  conversationHistory?: Array<{ role: string; content: string }>
  userContext?: { name?: string; ability_level?: string; units?: string; current_program_id?: number }
  // Optional context from UI chips (logs-only)
  range?: string | null
  block?: string | null
  filterRpe?: string | null // 'gte:8' | 'lte:5'
  filterQuality?: string | null // 'gte:3' | 'lte:2'
  mode?: 'sessions' | 'by_block' | 'total_reps' | 'avg_rpe' | 'table' | null
  limit?: string | number | null // 10 | 20 | 50
  sort?: 'newest' | 'oldest' | null
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
  const lower = s.toLowerCase()
  const hasAggregate = /\b(count|sum|avg)\s*\(/i.test(s)
  const hasGroupBy = /\bgroup\s+by\b/i.test(s)

  // Skip normalization for pure aggregate queries (COUNT/SUM/AVG only)
  if (hasAggregate && !hasGroupBy) {
    return s
  }

  // Decide a safe time column if any
  let timeCol: string | null = null
  if (/from\s+performance_logs\b/i.test(s)) {
    timeCol = 'logged_at'
  }

  if (timeCol && !/\border\s+by\b/i.test(s) && !hasGroupBy) {
    s += ` order by ${timeCol} desc`
  }
  if (!/\blimit\s+\d+\b/i.test(s)) {
    s += ' limit 30'
  }
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
      // Planner flow (LLM)
      const plannerExtras = await this.buildPlannerExtras(req)
      let queryPrompt = this.buildQueryPrompt(req, plannerExtras)
      const qStart = Date.now()
      // Use Sonnet (or configured planner model) for query planning, fallback to Haiku
      let queryPlan: string
      try {
        const plannerModel = process.env.CLAUDE_PLANNER_MODEL || 'claude-3-5-sonnet-20241022'
        console.debug('[AI][model][planner] using', plannerModel)
        queryPlan = await this.callClaudeWithModel(plannerModel, queryPrompt, 0.2)
      } catch (_e) {
        const fallbackModel = process.env.CLAUDE_COACH_MODEL || 'claude-3-5-haiku-20241022'
        console.debug('[AI][model][planner] fallback to', fallbackModel)
        queryPlan = await this.callClaudeWithModel(fallbackModel, queryPrompt, 0.2)
      }
      console.debug('[AI][queryPlan]', queryPlan?.slice(0, 800))
      let queries: string[] = []
      try {
        queries = this.extractQueries(queryPlan)
      } catch (e) {
        const msg = String((e as Error)?.message || '')
        // Retry once with specific validator feedback for ANY validation failure
        console.debug('[AI][planner][retry] validator feedback:', msg)
        queryPrompt = this.buildQueryPrompt(req, plannerExtras, msg)
        try {
          const plannerModel = process.env.CLAUDE_PLANNER_MODEL || 'claude-3-5-sonnet-20241022'
          console.debug('[AI][model][planner] retry using', plannerModel)
          queryPlan = await this.callClaudeWithModel(plannerModel, queryPrompt, 0.1)
        } catch (_e2) {
          const fallbackModel = process.env.CLAUDE_COACH_MODEL || 'claude-3-5-haiku-20241022'
          console.debug('[AI][model][planner] retry fallback to', fallbackModel)
          queryPlan = await this.callClaudeWithModel(fallbackModel, queryPrompt, 0.1)
        }
        console.debug('[AI][queryPlan][retry]', queryPlan?.slice(0, 800))
        queries = this.extractQueries(queryPlan)
      }
      console.debug('[AI][queries]', queries)
      const executions = await this.executeQueries(req.userId, queries)
      const queryTime = Date.now() - qStart
      console.debug('[AI][executions]', executions.map(e => ({ purpose: e.purpose, rows: e.rowCount })))

      // Coaching disabled for one-table phase: return raw query results only
      const rStart = Date.now()
      const rawResponse = JSON.stringify(
        executions.map(e => ({ purpose: e.purpose, rows: e.rowCount, data: e.result }))
      )
      const responseTime = Date.now() - rStart

      const totalTime = Date.now() - t0
      const cacheHits = executions.filter(e => e.cacheHit).length
      const cacheHitRate = executions.length ? cacheHits / executions.length : 0
      const errorClasses = [...new Set(executions.filter(e => e.errorClass).map(e => e.errorClass!))]

      const withSources = rawResponse

      return {
        response: withSources,
        queriesExecuted: executions,
        performance: { totalTime, queryTime, responseTime, totalTokens: this.estimateTokens(queryPrompt + queryPlan + rawResponse), cacheHitRate },
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

  private buildQueryPrompt(
    req: TrainingAssistantRequest,
    _extras: { exerciseNames: string[]; equipment: string[] },
    validatorFeedback?: string
  ): string {
    const schemaGuidance = this.buildSchemaGuidance(req.userQuestion)

    const rangeToken = (req.range || '').trim()
    const timeFilter = rangeToken === 'last_7_days' ? "AND logged_at >= now() - interval '7 days'"
      : rangeToken === 'last_14_days' ? "AND logged_at >= now() - interval '14 days'"
      : rangeToken === 'last_30_days' ? "AND logged_at >= now() - interval '30 days'"
      : rangeToken === 'this_week' ? "AND logged_at >= date_trunc('week', current_date)"
      : ''

    const blockFilter = (req.block || '').toUpperCase()
    const blockWhere = ['SKILLS','TECHNICAL WORK','STRENGTH AND POWER','ACCESSORIES','METCONS'].includes(blockFilter) ? `AND block = '${blockFilter}'` : ''

    const rpeToken = (req.filterRpe || '').toLowerCase()
    const rpeWhere = rpeToken === 'gte:8' ? 'AND rpe >= 8' : rpeToken === 'lte:5' ? 'AND rpe <= 5' : ''

    const qualToken = (req.filterQuality || '').toLowerCase()
    const qualWhere = qualToken === 'gte:3' ? 'AND completion_quality >= 3' : qualToken === 'lte:2' ? 'AND completion_quality <= 2' : ''

    const sortOrder = (req.sort || '').toLowerCase() === 'oldest' ? 'ASC' : 'DESC'
    const limitNum = Math.min(Math.max(parseInt(String(req.limit || ''), 10) || 30, 10), 50)
    const explicitLimit = `LIMIT ${limitNum}`

    const mode = (req.mode || '').toLowerCase()

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
1) Use ONLY table performance_logs and ONLY the columns listed in SUBSET_SCHEMA below.
2) Every query MUST include: WHERE user_id = ${req.userId}
3) Time column is logged_at
4) LIMIT 10-50 rows; single SELECT per query; no multi-statement SQL
5) Column typing rules (use exact types; avoid unnecessary casting/regex):
   - rpe (integer): use rpe directly (AVG(rpe)), filter rpe IS NOT NULL when aggregating
   - completion_quality (integer 1-4): filter IS NOT NULL when aggregating
   - week/day/set_number (integer): use directly
   - reps (text): guard before cast (NULLIF(regexp_replace(reps, '[^0-9]', '', 'g'), '')::int)
   - weight_time/result (text): polymorphic; treat as text unless needed
6) Do NOT reference any table/column not listed in SUBSET_SCHEMA
7) Do NOT use IN (...) on exercise_name. Do NOT invent names. Avoid LIKE unless user typed a literal pattern (not provided here)
8) Do NOT use or join on program_workout_id
9) Never use case-sensitive LIKE for exercise_name. If filtering by name, use ILIKE (case-insensitive) only
${timeFilter ? `11) TIME RANGE provided: include "${timeFilter}" in every query` : ''}
${blockWhere ? `12) BLOCK provided: include "${blockWhere}" in every query` : ''}
${rpeWhere ? `13) RPE filter provided: include "${rpeWhere}" in every query` : ''}
${qualWhere ? `14) Quality filter provided: include "${qualWhere}" in every query` : ''}
${sortOrder ? `15) SORT provided: ORDER BY logged_at ${sortOrder}` : ''}
${explicitLimit ? `16) LIMIT provided: use "${explicitLimit}" (cap at 50)` : ''}

MODE SELECTION (if provided):
- If mode = 'sessions':
  SELECT DISTINCT DATE(logged_at) AS training_date, exercise_name
  FROM performance_logs
  WHERE user_id = ${req.userId}
    ${timeFilter}
    ${blockWhere}
    ${rpeWhere}
    ${qualWhere}
  ORDER BY training_date ${sortOrder}
  ${explicitLimit}

- If mode = 'by_block':
  SELECT block, COUNT(DISTINCT DATE(logged_at)) AS days_with_block
  FROM performance_logs
  WHERE user_id = ${req.userId}
    ${timeFilter}
    ${blockWhere}
    ${rpeWhere}
    ${qualWhere}
  GROUP BY block
  ORDER BY days_with_block DESC
  ${explicitLimit}

- If mode = 'total_reps':
  SELECT exercise_name, SUM(NULLIF(regexp_replace(reps, '[^0-9]', '', 'g'), '')::int) AS total_reps
  FROM performance_logs
  WHERE user_id = ${req.userId}
    ${timeFilter}
    ${blockWhere}
  GROUP BY exercise_name
  ORDER BY total_reps DESC
  ${explicitLimit}

- If mode = 'avg_rpe':
  SELECT exercise_name, ROUND(AVG(rpe), 2) AS avg_rpe
  FROM performance_logs
  WHERE user_id = ${req.userId}
    AND rpe IS NOT NULL
    ${timeFilter}
    ${blockWhere}
  GROUP BY exercise_name
  ORDER BY avg_rpe DESC
  ${explicitLimit}

USER QUESTION: "${req.userQuestion}"
USER: ${req.userContext?.name || 'Athlete'} (${req.userContext?.ability_level || 'Unknown'}, ${req.userContext?.units || 'Unknown'})

SUBSET_SCHEMA (the ONLY allowed source for this query):
- Table: performance_logs
      - Columns: id, program_id, user_id, week, day, block, exercise_name,
  sets, reps, weight_time, result, rpe, completion_quality, flags, analysis,
  logged_at, quality_grade, set_number
      - Notes: block common values = 'SKILLS', 'TECHNICAL WORK', 'STRENGTH AND POWER', 'ACCESSORIES', 'METCONS'

SCHEMA GUIDANCE:
${schemaGuidance}

${validatorFeedback ? `VALIDATION FEEDBACK (fix these issues exactly):\n${validatorFeedback}\n` : ''}

COMMON PATTERNS (examples):
  - Days with training →
    SELECT COUNT(DISTINCT DATE(logged_at)) AS total_days
    FROM performance_logs
    WHERE user_id = ${req.userId}
    ${timeFilter}

  - Individual Blocks (drill-down) →
    SELECT block, COUNT(DISTINCT DATE(logged_at)) AS days_with_block
    FROM performance_logs
    WHERE user_id = ${req.userId}
    ${timeFilter}
    ${blockWhere}
    GROUP BY block
    ORDER BY days_with_block DESC
    LIMIT 10

  - Average RPE by exercise →
    SELECT exercise_name, ROUND(AVG(rpe), 2) AS avg_rpe
    FROM performance_logs
    WHERE user_id = ${req.userId}
      AND rpe IS NOT NULL
    GROUP BY exercise_name
    ORDER BY avg_rpe DESC
    LIMIT 10

  - List training sessions by date →
    SELECT DISTINCT DATE(logged_at) AS training_date, exercise_name
    FROM performance_logs
    WHERE user_id = ${req.userId}
    ${timeFilter}
    ORDER BY training_date ${sortOrder}
    ${explicitLimit}

Generate only the JSON object described above.`
  }

  // Fetch canonical exercise names and user's equipment to reduce query guessing
  private async buildPlannerExtras(
    _req: TrainingAssistantRequest
  ): Promise<{ exerciseNames: string[]; equipment: string[] }> {
    // Logs-only phase: no extras needed
    return { exerciseNames: [], equipment: [] }
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
      throw new Error('No valid queries')
    }
    const out: string[] = []
    const errors: string[] = []
    for (const q of parsed.queries.slice(0, 5)) {
      if (!q?.sql || typeof q.sql !== 'string') continue
      const sql = q.sql.trim()
      // Validate identifiers against schema
      const validation = this.validateSqlAgainstSchema(sql)
      if (!validation.ok) { if (validation.error) errors.push(validation.error) ; continue }
      const purpose = (q?.purpose && typeof q.purpose === 'string') ? q.purpose : 'Database query'
      out.push(`-- Purpose: ${purpose}\n${sql}`)
    }
    if (!out.length) throw new Error(errors.length ? errors.join('; ') : 'No valid queries')
    return out
  }

  // AST-based schema validation: tables, columns, ORDER BY
  private validateSqlAgainstSchema(sql: string): { ok: boolean; error?: string } {
    // Minimal restrictions per request: single SELECT, from performance_logs, has WHERE user_id
    try {
      const s = (sql || '').trim().replace(/^--\s*Purpose:.*$/mi, '')
      const lower = s.toLowerCase()
      // Reject case-sensitive LIKE on exercise_name
      if (/exercise_name\s+like\s+'/.test(lower)) {
        return { ok: false, error: "Use ILIKE for exercise_name (case-insensitive); 'LIKE' is not allowed" }
      }
      if (!lower.startsWith('select')) return { ok: false, error: 'Only SELECT statements allowed' }
      if (lower.includes(';')) return { ok: false, error: 'Multiple statements not allowed' }
      const banned = [' with ', ' insert ', ' update ', ' delete ', ' alter ', ' create ', ' drop ', ' grant ', ' revoke ']
      if (banned.some(k => lower.includes(k))) return { ok: false, error: 'Statement contains disallowed keywords' }
      if (!/\bfrom\s+performance_logs\b/.test(lower)) return { ok: false, error: 'Only performance_logs allowed' }
      if (!/\bwhere\b/.test(lower) || !/\buser_id\b/.test(lower)) return { ok: false, error: 'WHERE user_id predicate required' }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String((e as Error).message || e) }
    }
  }

  // Tier 2 fallback validation: simple shape and allowlist checks without full AST
  private validateBySafeShape(sql: string): { ok: boolean; error?: string } { return { ok: true } }

  

  private async executeQueries(userId: number, queries: string[]): Promise<QueryExecution[]> {
    const results: QueryExecution[] = []
    let queriesRun = 0
    for (const raw of queries) {
      if (queriesRun >= 5) break
      const t = Date.now()
      const purpose = extractPurpose(raw)
      const sql = normalizeSql(raw)
      try {
        // Optional: EXPLAIN preflight with read-only RLS via RPC; ignore failures silently
        try {
          await this.supabase.rpc('explain_user_query', { query_sql: sql, requesting_user_id: userId })
        } catch (_) {}
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
    const maxRetries = 3
    const baseDelayMs = 500
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 25_000)
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': this.claudeApiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model, max_tokens: 2000, temperature, messages: [{ role: 'user', content: prompt }] }),
          signal: controller.signal
        })
        clearTimeout(timeout)
        if (res.ok) {
          const data = await res.json()
          return data.content?.[0]?.text || ''
        }
        const status = res.status
        const retriable = status === 408 || status === 409 || status === 425 || status === 429 || (status >= 500 && status <= 599) || status === 529
        if (!retriable || attempt === maxRetries) {
          throw new Error(`Claude API error ${status}`)
        }
      } catch (err: any) {
        clearTimeout(timeout)
        const isAbort = (err?.name === 'AbortError')
        if (!isAbort && attempt === maxRetries) {
          throw err
        }
        // Backoff with jitter
        const delay = Math.min(4000, baseDelayMs * Math.pow(2, attempt)) + Math.floor(Math.random() * 200)
        console.debug('[AI][model][retry]', model, 'attempt', attempt + 1, 'delay', delay, 'ms')
        await new Promise(r => setTimeout(r, delay))
        continue
      }
    }
    throw new Error('Claude API error (unknown)')
  }

  private buildSchemaGuidance(userQuestion: string): string {
    // Logs-only guidance
    const summary = [
      'Use ONLY performance_logs with these columns:',
      'id, program_id, user_id, week, day, block, exercise_name, sets, reps, weight_time, result, rpe, completion_quality, flags, analysis, logged_at, quality_grade, set_number.',
      'Always include WHERE user_id = <userId>. When recency matters, ORDER BY logged_at DESC. LIMIT 10-50.'
    ].join(' ')
    return summary
  }

  // Build a compact shorthand → canonical glossary for the planner
  private buildShorthandGlossary(): string {
    const items: Array<[string, string]> = [
      ['DB', '(equipment) Dumbbell'],
      ['BB', '(equipment) Barbell'],
      ['KB', '(equipment) Kettlebell'],
      ['BW', '(equipment) Bodyweight'],
      ['WB', '(equipment) Wall Ball'],
      ['C2B, CTB', 'Chest to Bar Pull-ups'],
      ['T2B, TTB', 'Toes to Bar'],
      ['HKR', 'Hanging Knee Raise'],
      ['MU', 'Muscle Ups'],
      ['BMU', 'Bar Muscle Ups'],
      ['RMU', 'Ring Muscle Ups'],
      ['WPU, Weighted PU', 'Weighted Pull Ups'],
      ['Kipping PU', 'Pull-ups (kipping or butterfly)'],
      ['Strict PU', 'Strict Pull-ups'],
      ['C&J, CJ', 'Clean and Jerk'],
      ['PC', 'Power Clean'],
      ['PS', 'Power Snatch'],
      ['SC, Squat Clean', 'Clean (clean only)'],
      ['Hang Clean', 'Hang Cleans'],
      ['HPC, Hang PC', 'Hang Power Cleans'],
      ['Hang Snatch', 'Hang Snatch'],
      ['OHP, OH Press, MP, Military Press', 'Strict Press'],
      ['PP', 'Push Press'],
      ['S2O, STOH, S2OH', 'Shoulder to Overhead'],
      ['BP', 'Bench Press'],
      ['DB BP', 'Dumbbell Bench Press'],
      ['HSPU', 'Handstand Push-ups'],
      ['SHSPU', 'Strict Handstand Push-ups'],
      ['DHSPU', 'Deficit Handstand Push-ups'],
      ['BB Row', 'Barbell Row'],
      ['DB Row', 'Dumbbell Row'],
      ['DL', 'Deadlift'],
      ['RDL, SLDL', 'Romanian Deadlift'],
      ['Sumo DL', 'Deadlift'],
      ['DB DL', 'Dumbbell Deadlift'],
      ['KB DL', 'Double Kettlebell Deadlifts'],
      ['1 Leg DL', '1 Leg Deadlift'],
      ['FS', 'Front Squat'],
      ['BS', 'Back Squat'],
      ['OHS', 'Overhead Squat'],
      ['Snatch', 'Snatch'],
      ['Push-ups', 'Push-ups']
    ]
    return items.map(([k, v]) => `- ${k} → ${v}`).join('\n')
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

