import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: 'Server config error' }, { status: 500 })
    const supabase = createClient(supabaseUrl, serviceKey)

    // Auth → user_id
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    const { data: authUser } = await createClient(supabaseUrl, serviceKey).auth.getUser(token)
    const auth_id = authUser?.user?.id
    if (!auth_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: userRow } = await supabase.from('users').select('id').eq('auth_id', auth_id).single()
    if (!userRow?.id) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const userId = userRow.id as number

    const url = new URL(request.url)
    const mode = (url.searchParams.get('mode') || 'summary').toLowerCase()
    const days = parseInt(url.searchParams.get('days') || '90')
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    if (mode === 'summary') {
      // Minimal fields only, last N days
      const { data: logs } = await supabase
        .from('performance_logs')
        .select('exercise_name, rpe, quality, logged_at')
        .eq('user_id', userId)
        .eq('block_name', 'SKILLS')
        .gte('logged_at', since)

      const bySkill: Record<string, { count: number; avgRPE: number; avgQuality: number }> = {}
      for (const row of logs || []) {
        const name = (row as any).exercise_name || 'Unknown'
        const rpe = Number((row as any).rpe) || 0
        const q = Number((row as any).quality) || 0
        if (!bySkill[name]) bySkill[name] = { count: 0, avgRPE: 0, avgQuality: 0 }
        const s = bySkill[name]
        s.avgRPE = (s.avgRPE * s.count + rpe) / (s.count + 1)
        s.avgQuality = (s.avgQuality * s.count + q) / (s.count + 1)
        s.count += 1
      }

      const summary = Object.keys(bySkill).map(n => ({ name: n, ...bySkill[n] }))
      return NextResponse.json({ success: true, data: { summary }, metadata: { days, mode } }, {
        headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=60' }
      })
    }

    // detail: limited recent sessions per skill
    const { data: recent } = await supabase
      .from('performance_logs')
      .select('exercise_name, rpe, quality, sets, reps, notes, logged_at')
      .eq('user_id', userId)
      .eq('block_name', 'SKILLS')
      .gte('logged_at', since)
      .order('logged_at', { ascending: false })
      .limit(300)

    return NextResponse.json({ success: true, data: { sessions: recent || [] }, metadata: { days, mode } }, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=60' }
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 })
  }
}

