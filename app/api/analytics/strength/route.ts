import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: 'Server config error' }, { status: 500 })
    const supabase = createClient(supabaseUrl, serviceKey)

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
    const days = parseInt(url.searchParams.get('days') || '180')
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    if (mode === 'summary') {
      const { data: latest } = await supabase
        .from('user_one_rms')
        .select('exercise_name, one_rm, recorded_at')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false })
        .limit(100)
      return NextResponse.json({ success: true, data: { oneRMs: latest || [] }, metadata: { days, mode } }, {
        headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' }
      })
    }

    const { data: logs } = await supabase
      .from('performance_logs')
      .select('exercise_name, weight, reps, sets, rpe, logged_at')
      .eq('user_id', userId)
      .eq('block_name', 'STRENGTH AND POWER')
      .gte('logged_at', since)
      .order('logged_at', { ascending: false })
      .limit(500)

    return NextResponse.json({ success: true, data: { sessions: logs || [] }, metadata: { days, mode } }, {
      headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=60' }
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 })
  }
}

