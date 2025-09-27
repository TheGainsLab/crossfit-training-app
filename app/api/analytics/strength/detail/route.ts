import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function mapRange(range: string | null): { sinceISO: string | null } {
  const now = Date.now()
  const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString()
  switch ((range || '').toLowerCase()) {
    case 'last_7_days': return { sinceISO: days(7) }
    case 'last_14_days': return { sinceISO: days(14) }
    case 'last_60_days': return { sinceISO: days(60) }
    case 'last_90_days': return { sinceISO: days(90) }
    case 'all_time': return { sinceISO: null }
    case 'last_30_days':
    default:
      return { sinceISO: days(30) }
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) return NextResponse.json({ success: false, error: 'Server not configured' }, { status: 500 })
    const supabase = createClient(supabaseUrl, serviceKey)

    // Resolve user
    let userId: number | null = null
    try {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
      const token = authHeader?.replace('Bearer ', '') || ''
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

    const { searchParams } = new URL(req.url)
    const exercise = searchParams.get('exercise')
    const block = (searchParams.get('block') || 'STRENGTH AND POWER').toUpperCase()
    const range = searchParams.get('range')
    if (!exercise) return NextResponse.json({ success: false, error: 'Missing exercise' }, { status: 400 })
    const { sinceISO } = mapRange(range)

    // Query per-session entries
    let q = supabase
      .from('performance_logs')
      .select('logged_at, exercise_name, sets, reps, weight_time, rpe, completion_quality')
      .eq('user_id', userId)
      .eq('block', block)
      .ilike('exercise_name', exercise)
      .order('logged_at', { ascending: false })
      .limit(100)
    if (sinceISO) q = q.gte('logged_at', sinceISO) as any

    const { data: rows, error } = await q
    if (error) throw error

    const out = (rows || []).map((r: any) => ({
      training_date: String(r.logged_at).slice(0, 10),
      exercise_name: r.exercise_name,
      sets: r.sets,
      reps: r.reps,
      weight_time: r.weight_time,
      rpe: r.rpe,
      completion_quality: r.completion_quality,
    }))

    return NextResponse.json({ success: true, rows: out })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 500 })
  }
}

