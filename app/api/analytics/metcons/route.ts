import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function mapRange(range: string | null): string {
  switch ((range || '').toLowerCase()) {
    case 'last_60_days': return "pm.completed_at >= now() - interval '60 days'"
    case 'last_90_days': return "pm.completed_at >= now() - interval '90 days'"
    case 'all_time': return ''
    case 'last_30_days':
    default:
      return "pm.completed_at >= now() - interval '30 days'"
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) return NextResponse.json({ success: false, error: 'Server not configured' }, { status: 500 })
    const supabase = createClient(supabaseUrl, serviceKey)

    // Resolve userId from Authorization header
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
    const range = searchParams.get('range')
    const timeDomain = searchParams.get('timeDomain') // csv
    const equipment = searchParams.get('equipment') // csv
    const level = searchParams.get('level')

    // Get latest program for user
    const { data: prog } = await supabase.from('programs').select('id').eq('user_id', userId).order('id', { ascending: false }).limit(1)
    const programId = prog?.[0]?.id
    if (!programId) return NextResponse.json({ success: true, summary: { completions: 0, time_domain_mix: [], avg_percentile: null, best_scores: [], equipment_mix: [] }, heatmap: [] })

    // Build filter SQL fragments
    const tdList = (timeDomain || '').split(',').map(s => s.trim()).filter(Boolean)
    const eqList = (equipment || '').split(',').map(s => s.trim()).filter(Boolean)
    const whereParts: string[] = [ `pm.program_id = ${programId}`, `pm.completed_at IS NOT NULL` ]
    const rangeSql = mapRange(range)
    if (rangeSql) whereParts.push(rangeSql)
    if (level) whereParts.push(`m.level = '${level.replace(/'/g, "''")}'`)

    // We'll fetch rows then filter equipment client-side for ANY() easily by JS
    const { data: rows, error } = await supabase
      .from('program_metcons as pm')
      .select('week, day, percentile, completed_at, metcons!inner(id, workout_id, time_range, required_equipment, level)')
      .filter('program_id', 'eq', programId)
    if (error) throw error

    const filtered = (rows || []).filter((r: any) => {
      // Range
      if (rangeSql) {
        const dt = new Date(r.completed_at)
        const now = new Date()
        const diffDays = (now.getTime() - dt.getTime()) / (1000*60*60*24)
        if (range === 'last_60_days' && diffDays > 60) return false
        if (range === 'last_90_days' && diffDays > 90) return false
        if (!range || range === 'last_30_days') { if (diffDays > 30) return false }
      }
      // Time domain
      if (tdList.length && !tdList.includes(r.metcons?.time_range)) return false
      // Equipment ANY
      if (eqList.length) {
        const reqEq = Array.isArray(r.metcons?.required_equipment) ? r.metcons.required_equipment : []
        const hasAny = eqList.some(e => reqEq.includes(e))
        if (!hasAny) return false
      }
      // Level
      if (level && r.metcons?.level !== level) return false
      return true
    })

    // Summary
    const completions = filtered.length
    let pctSum = 0, pctN = 0
    const tdFreq: Record<string, number> = {}
    const eqFreq: Record<string, number> = {}
    const best: Array<{ workout_id: string; percentile: number | null }> = []
    filtered.forEach((r: any) => {
      if (typeof r.percentile === 'number') { pctSum += r.percentile; pctN++ }
      const tr = r.metcons?.time_range || 'Unknown'
      tdFreq[tr] = (tdFreq[tr] || 0) + 1
      const reqEq = Array.isArray(r.metcons?.required_equipment) ? r.metcons.required_equipment : []
      reqEq.forEach((e: string) => { if (e) eqFreq[e] = (eqFreq[e] || 0) + 1 })
      if (r.metcons?.workout_id) best.push({ workout_id: r.metcons.workout_id, percentile: r.percentile ?? null })
    })
    const avg_percentile = pctN ? Math.round((pctSum / pctN) * 100) / 100 : null

    // Heatmap by time_range x week
    const heatKey: Record<string, { time_range: string; week: number; count: number; pctSum: number; pctN: number }> = {}
    filtered.forEach((r: any) => {
      const key = `${r.metcons?.time_range || 'Unknown'}:${r.week}`
      if (!heatKey[key]) heatKey[key] = { time_range: r.metcons?.time_range || 'Unknown', week: r.week, count: 0, pctSum: 0, pctN: 0 }
      heatKey[key].count += 1
      if (typeof r.percentile === 'number') { heatKey[key].pctSum += r.percentile; heatKey[key].pctN += 1 }
    })
    const heatmap = Object.values(heatKey).map(h => ({ time_range: h.time_range, week: h.week, count: h.count, avg_percentile: h.pctN ? Math.round((h.pctSum/h.pctN)*100)/100 : null }))

    return NextResponse.json({
      success: true,
      summary: {
        completions,
        avg_percentile,
        time_domain_mix: Object.entries(tdFreq).map(([range, count]) => ({ range, count })),
        equipment_mix: Object.entries(eqFreq).map(([equipment, count]) => ({ equipment, count })),
        best_scores: best.sort((a,b)=> (b.percentile||0)-(a.percentile||0)).slice(0, 10)
      },
      heatmap
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
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
      const compute = unstable_cache(async () => {
        const { data: heat } = await supabase
          .rpc('get_metcon_heatmap', { p_user_id: userId, p_since: since })
        if (heat) return heat
        const { data: rows } = await supabase
          .from('performance_logs')
          .select('workout_id, percentile, logged_at')
          .eq('user_id', userId)
          .eq('block_name', 'METCONS')
          .gte('logged_at', since)
        return rows || []
      }, [`metcons-analytics:${userId}:${days}:summary`], { revalidate: 300, tags: [`metcons-analytics:${userId}`] })
      const heatmap = await compute()
      return NextResponse.json({ success: true, data: { heatmap }, metadata: { days, mode } }, { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } })
    }

    const computeDetail = unstable_cache(async () => {
      const { data: recents } = await supabase
        .from('performance_logs')
        .select('workout_id, workout_name, time_sec, rounds, reps, percentile, logged_at')
        .eq('user_id', userId)
        .eq('block_name', 'METCONS')
        .gte('logged_at', since)
        .order('logged_at', { ascending: false })
        .limit(200)
      return recents || []
    }, [`metcons-analytics:${userId}:${days}:detail`], { revalidate: 120, tags: [`metcons-analytics:${userId}`] })

    const workouts = await computeDetail()
    return NextResponse.json({ success: true, data: { workouts }, metadata: { days, mode } }, {
      headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=60' }
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 })
  }
}

