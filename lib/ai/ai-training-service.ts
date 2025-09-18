// lib/ai/ai-training-service.ts
// Single-LLM flow: generate SQL → fetch via RPC with user JWT → synthesize response

import { SupabaseClient, createClient } from '@supabase/supabase-js'
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
      const queryPlan = await this.callClaude(queryPrompt)
      const queries = this.extractQueries(queryPlan)
      const executions = await this.executeQueries(req.userId, queries)
      const queryTime = Date.now() - qStart

      const coachingPrompt = this.buildCoachingPrompt(req, executions)
      const rStart = Date.now()
      const coaching = await this.callClaude(coachingPrompt)
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
    return `You generate minimal SQL (1-5 queries) to answer the question using the user's own data.
Rules: single SELECT per query; include WHERE user_id = ${req.userId}; add ORDER BY (date DESC) and LIMIT (10-30).
Return strictly JSON: { "queries": [ { "purpose": "...", "sql": "..." } ] }

QUESTION: "${req.userQuestion}"
USER: ${req.userContext?.name || 'Athlete'} (${req.userContext?.ability_level || 'Unknown'}, ${req.userContext?.units || 'Unknown'})
`
  }

  private buildCoachingPrompt(req: TrainingAssistantRequest, results: QueryExecution[]): string {
    const data = results.map((r, i) => `Dataset ${i + 1} (${r.purpose}) rows=${r.rowCount}: ${JSON.stringify(r.result.slice(0, 3))}`).join('\n')
    const recent = (req.conversationHistory || []).slice(-3).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')
    return `You are a precise coach. Answer using ONLY the data below.

QUESTION: "${req.userQuestion}"
USER: ${req.userContext?.name || 'Athlete'} (${req.userContext?.ability_level || 'Unknown'}, ${req.userContext?.units || 'Unknown'})

DATA:\n${data || 'none'}
${recent ? `\nRECENT:\n${recent}` : ''}

Output:
1) Direct answer
2) Key observations with exact numbers
3) 1-3 actionable next steps (volume/intensity/time-domain)
4) Sources (list datasets used)
`
  }

  private extractQueries(responseText: string): string[] {
    const text = responseText.replace(/```json\s*|```/g, '').trim()
    const parsed = JSON.parse(text)
    if (!parsed || !Array.isArray(parsed.queries)) throw new Error('Invalid query JSON')
    const out: string[] = []
    for (const q of parsed.queries.slice(0, 5)) {
      if (!q?.sql || typeof q.sql !== 'string') continue
      const purpose = (q?.purpose && typeof q.purpose === 'string') ? q.purpose : 'Database query'
      out.push(`-- Purpose: ${purpose}\n${q.sql.trim()}`)
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

  private async callClaude(prompt: string): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.claudeApiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', max_tokens: 2000, temperature: 0.2, messages: [{ role: 'user', content: prompt }] })
    })
    if (!res.ok) throw new Error(`Claude API error ${res.status}`)
    const data = await res.json()
    return data.content?.[0]?.text || ''
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

