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
    const days = parseInt(url.searchParams.get('days') || '90')
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    if (mode === 'summary') {
      const { data: heat } = await supabase
        .rpc('get_metcon_heatmap', { p_user_id: userId, p_since: since })
      // If RPC not present, fallback to basic counts
      if (!heat) {
        const { data: rows } = await supabase
          .from('performance_logs')
          .select('workout_id, percentile, logged_at')
          .eq('user_id', userId)
          .eq('block_name', 'METCONS')
          .gte('logged_at', since)
        return NextResponse.json({ success: true, data: { heatmap: rows || [] }, metadata: { days, mode } }, {
          headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' }
        })
      }
      return NextResponse.json({ success: true, data: { heatmap: heat }, metadata: { days, mode } }, {
        headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' }
      })
    }

    const { data: recents } = await supabase
      .from('performance_logs')
      .select('workout_id, workout_name, time_sec, rounds, reps, percentile, logged_at')
      .eq('user_id', userId)
      .eq('block_name', 'METCONS')
      .gte('logged_at', since)
      .order('logged_at', { ascending: false })
      .limit(200)

    return NextResponse.json({ success: true, data: { workouts: recents || [] }, metadata: { days, mode } }, {
      headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=60' }
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 })
  }
}

