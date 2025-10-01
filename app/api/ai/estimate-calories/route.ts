// app/api/ai/estimate-calories/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export async function OPTIONS() {
  return new NextResponse('ok', { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const { userId, programId, week, day } = await request.json()

    const authHeader = request.headers.get('authorization') || ''
    const userToken = authHeader.replace(/^Bearer\s+/i, '')
    if (!userToken) {
      return NextResponse.json({ success: false, error: 'Missing Authorization header' }, { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500, headers: corsHeaders })
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: `Bearer ${userToken}` } } })

    // 1) Fetch minimal user profile (gender/body_weight/units)
    const { data: userRow } = await supabase
      .from('users')
      .select('gender, body_weight, units')
      .eq('id', userId)
      .maybeSingle()

    const gender = (userRow as any)?.gender || null
    const bodyWeight = typeof (userRow as any)?.body_weight === 'number' ? (userRow as any)?.body_weight : null
    const units = String((userRow as any)?.units || '')
    const metricUnits = units.toLowerCase().includes('kg')

    // 2) Fetch performance log entries for the specific day (scoped by programId/week/day)
    const { data: logs } = await supabase
      .from('performance_logs')
      .select('block, exercise_name, sets, reps, weight_time, rpe, completion_quality, logged_at')
      .eq('user_id', userId)
      .eq('program_id', programId)
      .eq('week', week)
      .eq('day', day)

    const entries = Array.isArray(logs) ? logs : []

    // 3) Build compact aggregates
    const distinctExercises = new Set<string>()
    let totalSets = 0
    let totalReps = 0
    let volumeLbs = 0
    let rpeSum = 0
    let rpeN = 0
    let qSum = 0
    let qN = 0
    let hasMetcon = false

    for (const row of entries) {
      const block = String((row as any)?.block || '')
      const ex = String((row as any)?.exercise_name || '')
      if (ex) distinctExercises.add(ex)
      if (block === 'METCONS') hasMetcon = true

      const setsN = Number(String((row as any)?.sets || '').replace(/[^0-9]/g, '')) || 1
      const repsStr = String((row as any)?.reps || '')
      const range = repsStr.match(/(\d+)\s*[-–]\s*(\d+)/)
      const repsN = range ? Number(range[2]) : (Number(repsStr.replace(/[^0-9]/g, '')) || 0)

      totalSets += setsN
      totalReps += setsN * repsN

      // weight_time may be weight text or time (e.g., mm:ss). Treat times as 0 weight
      const rawW = (() => {
        const s = String((row as any)?.weight_time || '')
        if (!s || s.includes(':')) return 0
        const num = Number(s.replace(/[^0-9.]/g, '')) || 0
        return num
      })()
      const wLbs = metricUnits ? Math.round(rawW * 2.20462 * 100) / 100 : rawW
      volumeLbs += setsN * (repsN || 1) * wLbs

      const rpe = (row as any)?.rpe
      if (typeof rpe === 'number') { rpeSum += rpe; rpeN++ }
      const q = (row as any)?.completion_quality
      if (typeof q === 'number') { qSum += q; qN++ }
    }

    const avgRpe = rpeN ? Math.round((rpeSum / rpeN) * 100) / 100 : null
    const avgQuality = qN ? Math.round((qSum / qN) * 100) / 100 : null

    // 4) Prepare compact summary payload (limit entries to 100 for safety)
    const trimmedEntries = entries.slice(0, 100).map((r: any) => ({
      block: r.block,
      exercise: r.exercise_name,
      sets: typeof r.sets === 'number' ? r.sets : String(r.sets || null),
      reps: typeof r.reps === 'number' ? String(r.reps) : String(r.reps || null),
      weight_lbs: (() => {
        const s = String(r.weight_time || '')
        if (!s || s.includes(':')) return null
        const num = Number(s.replace(/[^0-9.]/g, '')) || 0
        return metricUnits ? Math.round(num * 2.20462 * 100) / 100 : num
      })(),
      rpe: typeof r.rpe === 'number' ? r.rpe : null,
      quality: typeof r.completion_quality === 'number' ? r.completion_quality : null
    }))

    const summary = {
      user: {
        sex: gender || null,
        weight_lbs: typeof bodyWeight === 'number' ? (metricUnits ? Math.round(bodyWeight * 2.20462 * 100) / 100 : bodyWeight) : null,
        units: 'lbs'
      },
      session: {
        program_id: programId,
        week,
        day,
        has_metcon: hasMetcon
      },
      aggregates: {
        distinct_exercises: distinctExercises.size,
        total_sets: totalSets,
        total_reps: totalReps,
        volume_lbs: Math.round(volumeLbs * 100) / 100,
        avg_rpe: avgRpe,
        avg_quality: avgQuality
      },
      entries: trimmedEntries
    }

    // 5) Try LLM finalizer with strict JSON output; fallback to deterministic estimate
    let low: number | null = null
    let high: number | null = null

    const apiKey = process.env.CLAUDE_API_KEY
    if (apiKey) {
      try {
        const system = `Return ONLY JSON with two integers in kcal: { "low": int, "high": int }.
No prose, no code fences, no additional keys.
Guidelines: Typical CrossFit sessions are roughly 200–1000 kcal. Use body weight and intensity/volume to scale.
Enforce: low >= 100, high > low, high <= 2000.`

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: process.env.CLAUDE_COACH_MODEL || 'claude-3-5-haiku-20241022',
            max_tokens: 200,
            temperature: 0.2,
            system,
            messages: [ { role: 'user', content: `SESSION SUMMARY:\n${JSON.stringify(summary)}` } ]
          })
        })
        if (res.ok) {
          const data = await res.json()
          const raw = (data?.content?.[0]?.text || '').replace(/```json\n?|```/g, '').trim()
          try {
            const parsed = JSON.parse(raw)
            if (typeof parsed?.low === 'number' && typeof parsed?.high === 'number') {
              low = parsed.low
              high = parsed.high
            }
          } catch {}
        }
      } catch {}
    }

    // Deterministic fallback if LLM missing or failed
    if (low == null || high == null) {
      const weightFactor = (() => {
        const w = summary.user.weight_lbs || 180
        return Math.max(0.7, Math.min(1.5, w / 180))
      })()
      const intensityFactor = (() => {
        const r = summary.aggregates.avg_rpe || 7
        return Math.max(0.8, Math.min(1.3, 0.8 + (r - 6) * 0.1))
      })()
      const base = summary.session.has_metcon ? 350 : 250
      const volumeFactor = Math.max(0.8, Math.min(1.4, (summary.aggregates.total_reps || 0) / 120 || 1))
      const mid = base * weightFactor * intensityFactor * volumeFactor
      const band = Math.max(40, Math.min(180, mid * 0.2))
      low = Math.max(100, Math.round(mid - band))
      high = Math.min(2000, Math.max(low + 1, Math.round(mid + band)))
    }

    const average = Math.round(((low as number) + (high as number)) / 2)
    return NextResponse.json({ success: true, low, high, average }, { headers: corsHeaders })
  } catch (error) {
    console.error('Estimate calories API error:', error)
    const msg = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: msg }, { status: 500, headers: corsHeaders })
  }
}

