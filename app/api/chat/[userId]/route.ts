// /app/api/chat/[userId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAITrainingAssistantForUser } from '@/lib/ai/ai-training-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { message, conversation_id } = await request.json();

    // Require user Authorization header (JWT) to bind RLS for RPC calls
    const authHeader = request.headers.get('authorization') || ''
    const userToken = authHeader.replace(/^Bearer\s+/i, '')
    if (!userToken) {
      return NextResponse.json({ success: false, error: 'Missing Authorization header' }, { status: 401 })
    }

    // Same auth pattern as your working A1-A9 APIs
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Per-request user-bound client (RLS-on)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${userToken}` } } });

    // Verify user has active subscription (same as A1-A9)
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', parseInt(userId))
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
    }

    // Ensure a conversation exists (create if missing)
    let conversationId = conversation_id as number | null
    if (!conversationId) {
      const title = String((message || '').slice(0, 40) || 'New conversation')
      const { data: newConv, error: convErr } = await supabase
        .from('chat_conversations')
        .insert({ user_id: parseInt(userId), title, is_active: true })
        .select('id')
        .single()
      if (!convErr && newConv?.id) {
        conversationId = newConv.id
      }
    }

    // Optionally persist the user message for history
    if (conversationId) {
      await supabase
        .from('chat_messages')
        .insert({ conversation_id: conversationId, role: 'user', content: message, created_at: new Date().toISOString() })
    }

    // Get conversation history
    const { data: conversationHistory } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId || -1)
      .order('created_at', { ascending: true })
      .limit(20);

    // In-route AI assistant bound to the user's Supabase client
    const actionName = request.headers.get('x-action-name') || null
    const domain = (request.headers.get('x-domain') || '').toLowerCase() || null
    const pattern = request.headers.get('x-pattern') || null
    const range = request.headers.get('x-range') || null
    const block = request.headers.get('x-block') || null
    const filterRpe = request.headers.get('x-filter-rpe') || null // e.g., gte:8 | lte:5
    const filterQuality = request.headers.get('x-filter-quality') || null // e.g., gte:3 | lte:2
    const mode = request.headers.get('x-mode') || null // sessions | by_block | total_reps | avg_rpe | table
    const limit = request.headers.get('x-limit') || null // 10 | 20 | 50
    const sort = request.headers.get('x-sort') || null // newest | oldest
    // Metcons-specific filters
    const timeDomain = request.headers.get('x-timedomain') || request.headers.get('x-time-domain') || null
    const equipment = request.headers.get('x-equipment') || null
    const level = request.headers.get('x-level') || null
    if (actionName) {
      console.log('[CHAT][action]', { userId: parseInt(userId), actionName, domain, range, block, filterRpe, filterQuality, mode, limit, sort, pattern, timeDomain, equipment, level })
    }
    // Deterministic, view-backed answers only (no LLM SQL; no chips path)
    let assistantData: { response: string, context?: any }
    const lowerMsg = String(message || '').toLowerCase()
    const isMetconIntent = /(metcon|wod|percentile|time\s*domain|workout id|equipment|level)/.test(lowerMsg)
    const isStrengthIntent = /(strength|squat|deadlift|bench|press|snatch|clean|jerk|lift|max|weight)/.test(lowerMsg)
    const isSkillsIntent = /(skill|skills|handstand|pull[- ]?up|muscle\s*up|double unders|du|pistol)/.test(lowerMsg)
    const intentDomain = isMetconIntent ? 'metcons' : (isSkillsIntent ? 'skills' : (isStrengthIntent ? 'strength' : 'overview'))

    async function answerFromViews() {
      const blocks: Array<{ purpose: string; data: any[] }> = []
      if (intentDomain === 'metcons') {
        // Summary
        const { data: ms } = await supabase.from('ai_metcons_summary_v1').select('completions, avg_percentile').single()
        if (ms) blocks.push({ purpose: 'Metcons summary', data: [ms] })
        // By time domain (aggregate client-side from heatmap rows)
        const { data: hm } = await supabase.from('ai_metcon_heatmap_v1').select('time_range')
        if (Array.isArray(hm)) {
          const freq: Record<string, number> = {}
          hm.forEach((r: any) => { const key = r?.time_range || 'Unknown'; freq[key] = (freq[key]||0)+1 })
          const rows = Object.entries(freq).map(([time_range, count]) => ({ time_range, count }))
          blocks.push({ purpose: 'Completions by time range (last 56 days)', data: rows })
        }
      } else if (intentDomain === 'skills') {
        const { data } = await supabase.from('ai_skills_summary_v1').select('skill_name, distinct_days_in_range, avg_rpe, avg_quality, total_sets, total_reps, last_date').order('distinct_days_in_range', { ascending: false }).limit(20)
        blocks.push({ purpose: 'Skills exposures (last 56 days)', data: Array.isArray(data) ? data : [] })
      } else if (intentDomain === 'strength') {
        const { data } = await supabase.from('ai_strength_summary_v1').select('exercise_name, distinct_days_in_range, avg_rpe, avg_quality, max_weight_lbs, avg_top_set_weight_lbs, total_sets, total_reps, total_volume_lbs, last_session_at').order('distinct_days_in_range', { ascending: false }).limit(20)
        blocks.push({ purpose: 'Strength exposures (last 56 days)', data: Array.isArray(data) ? data : [] })
      } else {
        // Overview: small headline summaries and quick pointers
        const [{ data: ms }, { data: ss }, { data: ks }] = await Promise.all([
          supabase.from('ai_metcons_summary_v1').select('completions, avg_percentile').single(),
          supabase.from('ai_strength_summary_v1').select('exercise_name, distinct_days_in_range').order('distinct_days_in_range', { ascending: false }).limit(5),
          supabase.from('ai_skills_summary_v1').select('skill_name, distinct_days_in_range').order('distinct_days_in_range', { ascending: false }).limit(5),
        ])
        if (ms) blocks.push({ purpose: 'Metcons summary', data: [ms] })
        blocks.push({ purpose: 'Top strength movements (last 56 days)', data: Array.isArray(ss) ? ss : [] })
        blocks.push({ purpose: 'Top skills (last 56 days)', data: Array.isArray(ks) ? ks : [] })
      }
      return { response: JSON.stringify(blocks) }
    }

    assistantData = await answerFromViews()

    // Store assistant message and update conversation timestamp
    if (conversationId) {
      await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantData.response,
          created_at: new Date().toISOString()
        })
      await supabase
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId)
    }

    return NextResponse.json({
      success: true,
      response: assistantData.response,
      conversation_id: conversationId,
      responseType: 'program_guidance',
      coachAlertGenerated: false,
      context: assistantData.context || null
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process chat message'
    }, { status: 500 });
  }
}
// --- Deterministic chip SQL builder ---
function sanitizeLimit(raw: string | null): number {
  const n = Math.max(10, Math.min(50, parseInt(String(raw || ''), 10) || 30))
  return n
}

function buildChipSql(args: {
  userId: number,
  domain: string | null,
  mode: string | null,
  range: string | null,
  block: string | null,
  filterRpe: string | null,
  filterQuality: string | null,
  sort: string | null,
  limit: string | null,
  pattern: string | null,
  timeDomain?: string | null,
  equipment?: string | null,
  level?: string | null,
}): string {
  const {
    userId, domain, mode, range, block, filterRpe, filterQuality, sort, limit, pattern, timeDomain, equipment, level
  } = args
  const d = (domain || 'logs').toLowerCase()
  if (d === 'metcons') {
    const where: string[] = [`p.user_id = ${userId}`, `pm.completed_at IS NOT NULL`]
    if (range === 'last_7_days') where.push(`pm.completed_at >= now() - interval '7 days'`)
    else if (range === 'last_14_days') where.push(`pm.completed_at >= now() - interval '14 days'`)
    else if (range === 'last_30_days') where.push(`pm.completed_at >= now() - interval '30 days'`)
    else if (range === 'this_week') where.push(`pm.completed_at >= date_trunc('week', current_date)`)
    // Pattern on tasks
    const patt = (pattern || '').trim()
    if (patt) {
      const terms = patt.split(',').map(t => t.trim()).filter(Boolean)
      if (terms.length) {
        const ors = terms.map(t => `m.tasks::text ILIKE '${t.replace(/'/g, "''")}'`).join(' OR ')
        where.push(`(${ors})`)
      }
    }
    // Time domain mapping
    const tdRaw = (timeDomain || '').trim()
    if (tdRaw) {
      const tds = tdRaw.split(',').map(t => t.trim()).filter(Boolean)
      const mapped: string[] = []
      tds.forEach(t => {
        if (t === '20+') { mapped.push(`'20-30'`, `'30+'`) } else { mapped.push(`'${t.replace(/'/g, "''")}'`) }
      })
      if (mapped.length) where.push(`m.time_range IN (${mapped.join(', ')})`)
    }
    // Equipment (ANY(required_equipment))
    const eqRaw = (equipment || '').trim()
    if (eqRaw) {
      const eqs = eqRaw.split(',').map(e => e.trim()).filter(Boolean)
      if (eqs.length) {
        const ors = eqs.map(e => `'${e.replace(/'/g, "''")}' = ANY(m.required_equipment)`).join(' OR ')
        where.push(`(${ors})`)
      }
    }
    // Level
    const lvl = (level || '').trim()
    if (lvl) where.push(`m.level = '${lvl.replace(/'/g, "''")}'`)
    const whereSql = `WHERE ${where.join(' AND ')}`
    const order = (sort || '').toLowerCase() === 'oldest' ? 'ASC' : 'DESC'
    const lim = sanitizeLimit(limit)
    const m = (mode || 'completions').toLowerCase()
    if (m === 'by_time_domain') {
      return `SELECT COALESCE(m.time_range,'Unknown') AS time_range, COUNT(*) AS count
FROM program_metcons pm
JOIN programs p ON pm.program_id = p.id
LEFT JOIN metcons m ON m.id = pm.metcon_id
${whereSql}
GROUP BY 1
ORDER BY count DESC
LIMIT ${lim}`
    }
    if (m === 'avg_percentile') {
      return `SELECT ROUND(AVG(pm.percentile), 2) AS avg_percentile
FROM program_metcons pm
JOIN programs p ON pm.program_id = p.id
LEFT JOIN metcons m ON m.id = pm.metcon_id
${whereSql} AND pm.percentile IS NOT NULL`
    }
    if (m === 'best_scores') {
      return `SELECT DATE(pm.completed_at) AS completed_date, m.format, m.time_range, pm.user_score, pm.percentile
FROM program_metcons pm
JOIN programs p ON pm.program_id = p.id
LEFT JOIN metcons m ON m.id = pm.metcon_id
${whereSql} AND pm.percentile IS NOT NULL
ORDER BY pm.percentile DESC NULLS LAST
LIMIT ${lim}`
    }
    // completions/sessions
    return `SELECT DATE(pm.completed_at) AS completed_date, pm.week, pm.day, m.format, m.time_range, pm.user_score, pm.percentile, m.tasks
FROM program_metcons pm
JOIN programs p ON pm.program_id = p.id
LEFT JOIN metcons m ON m.id = pm.metcon_id
${whereSql}
ORDER BY completed_date ${order}
LIMIT ${lim}`
  }

  // Logs domain
  const where: string[] = [`user_id = ${userId}`]
  // Name patterns: comma-separated -> OR ILIKE
  const patt = (pattern || '').trim()
  if (patt) {
    const terms = patt.split(',').map(t => t.trim()).filter(Boolean)
    if (terms.length) {
      const ors = terms.map(t => `exercise_name ILIKE '${t.replace(/'/g, "''")}'`).join(' OR ')
      where.push(`(${ors})`)
    }
  }
  // Range
  if (range === 'last_7_days') where.push(`logged_at >= now() - interval '7 days'`)
  else if (range === 'last_14_days') where.push(`logged_at >= now() - interval '14 days'`)
  else if (range === 'last_30_days') where.push(`logged_at >= now() - interval '30 days'`)
  else if (range === 'this_week') where.push(`logged_at >= date_trunc('week', current_date)`)

  // Block
  const blockUp = (block || '').toUpperCase()
  if (['SKILLS','TECHNICAL WORK','STRENGTH AND POWER','ACCESSORIES','METCONS'].includes(blockUp)) {
    where.push(`block = '${blockUp}'`)
  }

  // RPE / Quality
  const rpe = (filterRpe || '').toLowerCase()
  if (rpe === 'gte:8') where.push('rpe >= 8')
  else if (rpe === 'lte:5') where.push('rpe <= 5')

  const qual = (filterQuality || '').toLowerCase()
  if (qual === 'gte:3') where.push('completion_quality >= 3')
  else if (qual === 'lte:2') where.push('completion_quality <= 2')

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const order = (sort || '').toLowerCase() === 'oldest' ? 'ASC' : 'DESC'
  const lim = sanitizeLimit(limit)

  const m = (mode || '').toLowerCase()
  if (m === 'by_block') {
    return `SELECT block, COUNT(*) AS entries_with_block
FROM performance_logs
${whereSql}
GROUP BY block
ORDER BY entries_with_block DESC
LIMIT ${lim}`
  }
  if (m === 'sessions') {
    return `SELECT DATE(logged_at) AS training_date, exercise_name, sets, reps, weight_time, result
FROM performance_logs
${whereSql}
ORDER BY training_date ${order}
LIMIT ${lim}`
  }
  if (m === 'total_reps') {
    return `SELECT exercise_name, SUM(NULLIF(regexp_replace(reps, '[^0-9]', '', 'g'), '')::int) AS total_reps
FROM performance_logs
${whereSql}
GROUP BY exercise_name
ORDER BY total_reps DESC
LIMIT ${lim}`
  }
  if (m === 'avg_rpe') {
    return `SELECT exercise_name, ROUND(AVG(rpe), 2) AS avg_rpe
FROM performance_logs
${whereSql}${whereSql ? ' AND' : ' WHERE'} rpe IS NOT NULL
GROUP BY exercise_name
ORDER BY avg_rpe DESC
LIMIT ${lim}`
  }
  if (m === 'table' || m === 'list') {
    return `SELECT DATE(logged_at) AS training_date, exercise_name, sets, reps, weight_time, result, rpe, completion_quality
FROM performance_logs
${whereSql}
ORDER BY logged_at ${order}
LIMIT ${lim}`
  }
  // Default: count entries
  return `SELECT COUNT(*) AS count
FROM performance_logs
${whereSql}`
}

function describePurpose(mode: string | null, pattern: string | null, block: string | null): string {
  const patt = (pattern || '').trim()
  const b = (block || '').trim()
  const m = (mode || '').toLowerCase()
  const scope = [patt ? `pattern=${patt}` : null, b ? `block=${b}` : null].filter(Boolean).join(', ')
  if (m === 'by_block') return `Entries by block ${scope ? '(' + scope + ')' : ''}`
  if (m === 'sessions') return `Sessions (distinct days) ${scope ? '(' + scope + ')' : ''}`
  if (m === 'total_reps') return `Total reps per exercise ${scope ? '(' + scope + ')' : ''}`
  if (m === 'avg_rpe') return `Average RPE per exercise ${scope ? '(' + scope + ')' : ''}`
  if (m === 'table' || m === 'list') return `Entries list ${scope ? '(' + scope + ')' : ''}`
  return `Count entries ${scope ? '(' + scope + ')' : ''}`
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 })
    }
    return NextResponse.json({ success: true, status: 'ok', userId })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
  }
}

// Minimal user context helper for coaching personalization (name, level, units)
async function getBasicUserContextInternal(userSb: any, userId: number) {
  try {
    const { data } = await userSb
      .from('user_complete_profile')
      .select('name, ability_level, units, current_program_id')
      .eq('user_id', userId)
      .single()
    return {
      name: data?.name || 'Athlete',
      ability_level: data?.ability_level || 'Unknown',
      units: data?.units || 'Unknown',
      current_program_id: data?.current_program_id || null,
    }
  } catch {
    return { name: 'Athlete', ability_level: 'Unknown', units: 'Unknown', current_program_id: null }
  }
}

// Helper function (copied from your original)
function generateConversationTitle(firstMessage: string): string {
  const message = firstMessage.toLowerCase();
  
  if (message.includes('squat')) return 'Squat Discussion';
  if (message.includes('deadlift')) return 'Deadlift Questions';
  if (message.includes('program') || message.includes('workout')) return 'Program Questions';
  if (message.includes('nutrition') || message.includes('diet')) return 'Nutrition Chat';
  if (message.includes('recovery') || message.includes('rest')) return 'Recovery Discussion';
  if (message.includes('injury') || message.includes('pain')) return 'Injury Concern';
  
  const words = firstMessage.split(' ').slice(0, 3).join(' ');
  return words.length > 20 ? words.substring(0, 20) + '...' : words;
}

// Simple on-topic classifier (broad, fitness-first)
function isOnTopic(text: string): boolean {
  const allow = [
    'train', 'training', 'workout', 'program', 'cycle', 'block', 'week', 'day',
    'strength', 'power', 'endurance', 'cardio', 'aerobic', 'anaerobic', 'vo2', 'zone 2',
    'hypertrophy', 'mobility', 'flexibility', 'technique', 'form', 'injury', 'pain', 'rehab', 'physical therapy', 'physio',
    'recovery', 'sleep', 'stress', 'hrv', 'rest', 'deload', 'rpe', 'volume', 'intensity', 'sets', 'reps', 'tempo',
    'nutrition', 'diet', 'macros', 'protein', 'carbs', 'fat', 'calorie', 'calories', 'hydration', 'electrolyte', 'supplement', 'creatine', 'caffeine',
    'body weight', 'bodyweight', 'weight loss', 'gain', 'cut', 'bulk', 'exercise', 'exercises', 'movement', 'movements',
    'run', 'rowing', 'bike', 'erg', 'metcon', 'wod', 'crossfit', 'olympic', 'olympic lift', 'oly', 'weightlifting', 'lifting', 'snatch', 'clean', 'jerk', 'squat', 'deadlift', 'press', 'pull-up', 'ring',
    'goal', 'progression', 'plateau', '1rm', 'one rep max', 'percentage'
  ]
  // Broaden matching for skills-related intents
  const extra = ['skill', 'skills', 'practice', 'practiced', 'accessory', 'accessories']

  for (const token of [...allow, ...extra]) {
    if (text.includes(token)) return true
  }
  return false
}

// Extract a simple exercise history intent; returns canonical exercise term or null
function extractExerciseHistoryIntent(text: string): string | null {
  const t = text.toLowerCase()
  const wantsHistory = /(history|logs|log|trend|progress|sessions|recent)/.test(t)
  if (!wantsHistory) return null
  const exercises = [
    'snatch', 'clean and jerk', 'clean', 'jerk', 'back squat', 'front squat', 'squat',
    'deadlift', 'bench press', 'strict press', 'press', 'pull-up', 'pull ups', 'ring muscle up', 'bar muscle up'
  ]
  for (const ex of exercises) {
    if (t.includes(ex)) return ex
  }
  return null
}

// Render metcon tasks JSON into readable lines
function formatMetconTasks(tasks: any): string {
  try {
    if (!tasks) return ''
    const arr = Array.isArray(tasks) ? tasks : (typeof tasks === 'string' ? JSON.parse(tasks) : [])
    if (!Array.isArray(arr)) return ''
    const lines: string[] = []
    for (const t of arr) {
      if (!t || typeof t !== 'object') continue
      const kind = t.kind || t.type || ''
      const title = t.title || t.name || ''
      const reps = t.reps || t.rounds || t.count || ''
      const details = t.details || t.description || t.movements || ''
      const movementList = Array.isArray(details) ? details.join(', ') : (typeof details === 'string' ? details : '')
      const duration = t.time || t.duration || ''
      const parts = [kind, title, reps, duration].filter(Boolean).join(' ')
      const line = parts ? `${parts}${movementList ? ': ' + movementList : ''}` : movementList
      if (line) lines.push(line)
    }
    return lines.length ? lines.join(' | ') : ''
  } catch {
    return ''
  }
}
