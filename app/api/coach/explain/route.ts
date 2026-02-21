import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

async function handle(req: Request) {
  try {
    const isJson = (req.headers.get('content-type')||'').includes('application/json')
    let message = '' as any
    let domain = '' as any
    let range = '' as any
    if (isJson) {
      const body = await req.json()
      message = body?.message
      domain = body?.domain
      range = body?.range
    } else {
      const url = new URL(req.url)
      message = url.searchParams.get('message') || ''
      domain = url.searchParams.get('domain') || ''
      range = url.searchParams.get('range') || ''
    }

    // Resolve auth and userId and fetch master brief from view
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) return NextResponse.json({ success: false, error: 'Server not configured' }, { status: 500 })
    const supabase = createClient(supabaseUrl, serviceKey)

    let userId: number | null = null
    try {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
      let token = authHeader?.replace('Bearer ', '') || ''
      if (!token) {
        try {
          const c = await cookies()
          const cv = c.get('sb-access-token')?.value
          if (cv) token = cv
        } catch {}
      }
      if (!token) {
        try {
          const url = new URL(req.url)
          const qp = url.searchParams.get('token')
          if (qp) token = qp
        } catch {}
      }
      if (token) {
        const { data: authUser } = await createClient(supabaseUrl, serviceKey).auth.getUser(token)
        const auth_id = authUser?.user?.id
        if (auth_id) {
          const { data: u } = await supabase.from('users').select('id').eq('auth_id', auth_id).single()
          if (u?.id) userId = u.id
        }
      }
    } catch {}
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { data: row } = await supabase.from('ai_master_brief_v1').select('brief').eq('user_id', userId).single()
    const masterBrief = (row as any)?.brief || {}

    // Filter brief to domain-specific data (best-effort)
    const d = String(domain || '').toLowerCase()
    const filtered = JSON.parse(JSON.stringify(masterBrief))
    try {
      // Upcoming program: keep only blocks for the domain
      const blockMap: Record<string, string> = {
        skills: 'SKILLS',
        strength: 'STRENGTH AND POWER',
        technical: 'TECHNICAL WORK',
        accessories: 'ACCESSORIES',
        metcons: 'METCONS'
      }
      const wantBlock = blockMap[d]
      if (wantBlock && Array.isArray(filtered?.upcoming_program)) {
        filtered.upcoming_program = filtered.upcoming_program.map((day: any) => ({
          ...day,
          blocks: Array.isArray(day?.blocks) ? day.blocks.filter((b: any) => {
            const name = String(b?.block || b?.blockName || '')
            if (d === 'metcons') return name === 'METCONS'
            return name === wantBlock
          }) : []
        }))
      }
      // Remove cross-domain summaries (best-effort based on key names)
      const top = filtered || {}
      const removeIf = (key: string, patterns: string[]) => patterns.some(p => key.toLowerCase().includes(p))
      const domainKeep: Record<string, string[]> = {
        skills: ['skill'],
        strength: ['strength'],
        technical: ['technical'],
        accessories: ['accessor'],
        metcons: ['metcon']
      }
      const keepPats = domainKeep[d] || []
      Object.keys(top).forEach((k) => {
        const kl = k.toLowerCase()
        if (['profile','upcoming_program','goals','preferences','adherence','trends','metadata','intake','allowed_entities','citations'].includes(kl)) return
        // if key clearly belongs to another domain, drop it
        const otherPats = ['skill','strength','technical','accessor','metcon'].filter(p => !keepPats.includes(p))
        if (removeIf(k, otherPats)) delete top[k]
      })
    } catch {}

    // Optional range re-assembly for the active domain (dynamic recompute)
    const r = String(range || '').toLowerCase()
    const now = Date.now()
    const daysMap: Record<string, number> = {
      'last_7_days': 7,
      'last_14_days': 14,
      'last_30_days': 30,
      'last_60_days': 60,
      'last_90_days': 90
    }
    const sinceDays = daysMap[r]
    const sinceISO = sinceDays ? new Date(now - sinceDays * 24 * 60 * 60 * 1000).toISOString() : null
    if (sinceISO) {
      try {
        if (d === 'skills') {
          const { data: rows } = await supabase
            .from('performance_logs')
            .select('logged_at, exercise_name, rpe, completion_quality, sets, reps')
            .eq('user_id', userId)
            .eq('block', 'SKILLS')
            .gte('logged_at', sinceISO)
          const bySkill: Record<string, any[]> = {}
          ;(rows || []).forEach((r: any) => {
            const k = r.exercise_name || 'Unknown'
            if (!bySkill[k]) bySkill[k] = []
            bySkill[k].push(r)
          })
          const out = Object.entries(bySkill).map(([skill_name, arr]) => {
            const daySet = new Set<string>()
            let rpeSum = 0, rpeN = 0, qSum = 0, qN = 0, setsSum = 0, repsSum = 0
            let lastDate = ''
            arr.forEach((x: any) => {
              const dstr = String(x.logged_at).slice(0,10)
              daySet.add(dstr)
              if (typeof x.rpe === 'number') { rpeSum += x.rpe; rpeN++ }
              if (typeof x.completion_quality === 'number') { qSum += x.completion_quality; qN++ }
              const setsN = Number(String(x.sets||'').replace(/[^0-9]/g,'')) || 1
              const m = String(x.reps||'').match(/(\d+)\s*[-–]\s*(\d+)/)
              const repsN = m ? Number(m[2]) : (Number(String(x.reps||'').replace(/[^0-9]/g,'')) || 0)
              setsSum += setsN
              repsSum += setsN * repsN
              if (!lastDate || String(x.logged_at) > lastDate) lastDate = String(x.logged_at)
            })
            return {
              user_id: userId,
              skill_name,
              distinct_days_in_range: daySet.size,
              avg_rpe: rpeN ? Math.round((rpeSum/rpeN)*100)/100 : 0,
              avg_quality: qN ? Math.round((qSum/qN)*100)/100 : 0,
              total_sets: setsSum,
              total_reps: repsSum,
              last_date: lastDate ? new Date(lastDate).toISOString() : null
            }
          })
          ;(filtered as any).skills_summary = out
        } else if (d === 'strength' || d === 'technical' || d === 'accessories') {
          const blockName = d === 'strength' ? 'STRENGTH AND POWER' : (d === 'technical' ? 'TECHNICAL WORK' : 'ACCESSORIES')
          const [{ data: userRow }, { data: rows }] = await Promise.all([
            supabase.from('users').select('units').eq('id', userId).single(),
            supabase
              .from('performance_logs')
              .select('logged_at, exercise_name, rpe, completion_quality, sets, reps, weight_time')
              .eq('user_id', userId)
              .eq('block', blockName)
              .gte('logged_at', sinceISO)
          ])
          const metricUnits = (userRow?.units||'').toLowerCase().includes('kg')
          const byEx: Record<string, any[]> = {}
          ;(rows || []).forEach((r: any) => {
            const k = r.exercise_name || 'Unknown'
            if (!byEx[k]) byEx[k] = []
            byEx[k].push(r)
          })
          const out = Object.entries(byEx).map(([exercise_name, arr]) => {
            const daySet = new Set<string>()
            let rpeSum = 0, rpeN = 0, qSum = 0, qN = 0, setsSum = 0, repsSum = 0
            let lastAt = ''
            const dayMax: Record<string, number> = {}
            let maxWeight = 0, volume = 0
            arr.forEach((x: any) => {
              const dstr = String(x.logged_at).slice(0,10)
              daySet.add(dstr)
              if (typeof x.rpe === 'number') { rpeSum += x.rpe; rpeN++ }
              if (typeof x.completion_quality === 'number') { qSum += x.completion_quality; qN++ }
              const setsN = Number(String(x.sets||'').replace(/[^0-9]/g,'')) || 1
              const m = String(x.reps||'').match(/(\d+)\s*[-–]\s*(\d+)/)
              const repsN = m ? Number(m[2]) : (Number(String(x.reps||'').replace(/[^0-9]/g,'')) || 0)
              const rawW = (() => { const s = String(x.weight_time||''); if (s.includes(':')) return 0; const num = Number(s.replace(/[^0-9\.]/g,'')) || 0; return num })()
              if (rawW > maxWeight) maxWeight = rawW
              dayMax[dstr] = Math.max(dayMax[dstr]||0, rawW)
              setsSum += setsN
              repsSum += setsN * repsN
              volume += (setsN * repsN) * rawW
              if (!lastAt || String(x.logged_at) > lastAt) lastAt = String(x.logged_at)
            })
            const avgTop = (() => { const arr = Object.values(dayMax); if (!arr.length) return 0; const s = arr.reduce((a,b)=>a+b,0); return Math.round((s/arr.length)*100)/100 })()
            const unitLabel = metricUnits ? 'kg' : 'lbs'
            return {
              user_id: userId,
              exercise_name,
              distinct_days_in_range: daySet.size,
              avg_rpe: rpeN ? Math.round((rpeSum/rpeN)*100)/100 : 0,
              avg_quality: qN ? Math.round((qSum/qN)*100)/100 : 0,
              [`max_weight_${unitLabel}`]: maxWeight,
              [`avg_top_set_weight_${unitLabel}`]: avgTop,
              total_sets: setsSum,
              total_reps: repsSum,
              [`total_volume_${unitLabel}`]: Math.round(volume*100)/100,
              last_session_at: lastAt || null
            }
          })
          if (d === 'strength') (filtered as any).strength_summary = out
          else if (d === 'technical') (filtered as any).technical_summary = out
          else (filtered as any).accessories_summary = out
        } else if (d === 'metcons') {
          const { data: pm } = await supabase
            .from('program_metcons')
            .select('percentile, completed_at, programs!inner(user_id)')
            .gte('completed_at', sinceISO)
            .eq('programs.user_id', userId)
          let completions = 0, pctSum = 0, pctN = 0
          ;(pm || []).forEach((r: any) => {
            if (r.completed_at) completions++
            if (typeof r.percentile === 'number') { pctSum += r.percentile; pctN++ }
          })
          ;(filtered as any).metcons_summary = {
            completions,
            avg_percentile: pctN ? Math.round((pctSum/pctN)*100)/100 : null
          }
        }
      } catch {}
    }

    const apiKey = process.env.CLAUDE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ success: true, explanation: 'No AI key configured. Insights unavailable.' })
    }

    // Domain-aware, goal-connected narrative prompt
    const system = `You are an expert CrossFit coach.

Task: Provide a concise, domain-aware narrative explanation of the athlete's current analytics view using the Coaching Brief (JSON) and the context message. Connect (1) goals/preferences and profile → (2) training done in the selected range → (3) what is scheduled in the upcoming week.

Global rules (Explain only):
- Keep it short and actionable. Output 1 sentence summary + 3–5 bullet insights.
- Each bullet should cite a concrete signal with units where possible (e.g., distinct sessions, avg RPE/quality, time-domain mix, avg percentile).
- Explicitly relate insights back to the athlete's goals/preferences from the brief.
- Reference next week's plan (upcoming 7 uncompleted days in the brief): highlight 1–2 opportunities or risks (coverage vs goals, overloads, missing skills).
- Do NOT propose specific plan changes; no Plan Diff here.
- Use ONLY numbers explicitly present in the JSON brief. Do NOT estimate, extrapolate, or invent values.
- 1RM mentions: only cite lifts that exist in intake.oneRMsNamed and their exact values. If a value is 0 or missing, do not mention it.
- Ratios: only cite intake.strength_ratios{value/target/flag}; if absent, avoid numeric claims.
- Weekly/session counts: only cite counts that are explicit for this domain (e.g., distinct_days_in_range for SKILLS, or domain-specific per-week sessions if provided). Do NOT turn generic "volume" into a session count.

Domain-specific guidance (choose based on CONTEXT):
- If SKILLS: ONLY reference SKILLS block movements from the brief. Focus on distinct days per skill, avg RPE/quality, recency, and next-week SKILLS coverage vs. goals (e.g., strict pulling). Do NOT mention movements that appear only under TECHNICAL WORK or ACCESSORIES.
- If STRENGTH AND POWER: ONLY reference STRENGTH AND POWER block movements; discuss sessions/volume trend (if available), top lifts, avg RPE; check next-week coverage vs. goals.
- If TECHNICAL WORK: ONLY reference TECHNICAL WORK movements; emphasize technique exposures and recency; check next-week coverage.
- If ACCESSORIES: ONLY reference ACCESSORIES; highlight balance and exposures; check next-week coverage.
- If METCONS: ONLY reference metcon data; highlight completions, time-domain/equipment/level mix, avg percentile; check next-week alignment.

Output JSON ONLY with:
{ "summary": string, "bullets": string[], "focus_next_week": string[] }
Where focus_next_week are 1–3 narrative pointers (not plan changes) that link history to the upcoming week.`;

    const userContent = `CONTEXT (must include domain and range; limit insights to that domain ONLY):\n${String(message || '').slice(0, 600)}\n\nCOACHING BRIEF (JSON, domain-filtered):\n${JSON.stringify(filtered).slice(0, 14000)}\n\nReturn ONLY JSON with keys: summary (string), bullets (string[]), focus_next_week (string[]).`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_COACH_MODEL || 'claude-3-5-haiku-20241022',
        max_tokens: 600,
        temperature: 0.2,
        system,
        messages: [ { role: 'user', content: userContent } ]
      })
    })

    if (!res.ok) {
      return NextResponse.json({ success: true, summary: '', bullets: [], rationale: `llm_error_${res.status}` })
    }
    const data = await res.json()
    const raw = data?.content?.[0]?.text || ''
    const clean = raw.replace(/```json\n?|```/g, '').trim()
    let parsed: any
    try { parsed = JSON.parse(clean) } catch { parsed = { summary: clean, bullets: [], focus_next_week: [] } }
    const summary: string = typeof parsed?.summary === 'string' ? parsed.summary : ''
    const bullets: string[] = Array.isArray(parsed?.bullets) ? parsed.bullets.filter((b: any) => typeof b === 'string') : []
    const focus_next_week: string[] = Array.isArray(parsed?.focus_next_week) ? parsed.focus_next_week.filter((b: any) => typeof b === 'string') : []
    return NextResponse.json({ success: true, summary, bullets, focus_next_week })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 400 })
  }
}

export async function POST(req: Request) { return handle(req) }
export async function GET(req: Request) { return handle(req) }

