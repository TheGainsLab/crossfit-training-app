import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function mapRange(range: string | null): { sinceISO: string | null } {
  const now = Date.now()
  const days = (r: string) => new Date(now - parseInt(r) * 24 * 60 * 60 * 1000).toISOString()
  switch ((range || '').toLowerCase()) {
    case 'last_60_days': return { sinceISO: days('60') }
    case 'last_90_days': return { sinceISO: days('90') }
    case 'all_time': return { sinceISO: null }
    case 'last_30_days':
    default:
      return { sinceISO: days('30') }
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
    const range = searchParams.get('range')
    const block = searchParams.get('block') // optional filter
    const { sinceISO } = mapRange(range)

    // Fetch logs
    let q = supabase
      .from('performance_logs')
      .select('exercise_name, rpe, logged_at, block')
      .eq('user_id', userId)
    if (sinceISO) q = q.gte('logged_at', sinceISO) as any
    if (block) q = q.eq('block', block) as any
    const { data: rows, error } = await q
    if (error) throw error

    // Aggregate by exercise_name
    const agg: Record<string, { count: number; rpeSum: number; rpeN: number; blockSet: Set<string> }> = {}
    ;(rows || []).forEach((r: any) => {
      const name = r.exercise_name || 'Unknown'
      if (!agg[name]) agg[name] = { count: 0, rpeSum: 0, rpeN: 0, blockSet: new Set<string>() }
      agg[name].count += 1
      if (typeof r.rpe === 'number') { agg[name].rpeSum += r.rpe; agg[name].rpeN += 1 }
      if (r.block) agg[name].blockSet.add(r.block)
    })
    const movements = Object.entries(agg)
      .map(([exercise_name, v]) => ({ exercise_name, count: v.count, avg_rpe: v.rpeN ? Math.round((v.rpeSum / v.rpeN) * 100) / 100 : null }))
      .sort((a, b) => b.count - a.count)

    // Block mix
    const blockMix: Record<string, number> = {}
    ;(rows || []).forEach((r: any) => {
      const b = r.block || 'Unknown'; blockMix[b] = (blockMix[b] || 0) + 1
    })

    return NextResponse.json({ success: true, summary: { movements: movements.slice(0, 20), block_mix: blockMix } })
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
    const days = parseInt(url.searchParams.get('days') || '180')
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    if (mode === 'summary') {
      const compute = unstable_cache(async () => {
        const { data: latest } = await supabase
          .from('user_one_rms')
          .select('exercise_name, one_rm, recorded_at')
          .eq('user_id', userId)
          .order('recorded_at', { ascending: false })
          .limit(100)
        return latest || []
      }, [`strength-analytics:${userId}:${days}:summary`], { revalidate: 300, tags: [`strength-analytics:${userId}`] })
      const oneRMs = await compute()
      return NextResponse.json({ success: true, data: { oneRMs }, metadata: { days, mode } }, {
        headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' }
      })
    }

    const computeDetail = unstable_cache(async () => {
      const { data: logs } = await supabase
        .from('performance_logs')
        .select('exercise_name, weight, reps, sets, rpe, logged_at')
        .eq('user_id', userId)
        .eq('block_name', 'STRENGTH AND POWER')
        .gte('logged_at', since)
        .order('logged_at', { ascending: false })
        .limit(500)
      return logs || []
    }, [`strength-analytics:${userId}:${days}:detail`], { revalidate: 120, tags: [`strength-analytics:${userId}`] })

    const sessions = await computeDetail()
    return NextResponse.json({ success: true, data: { sessions }, metadata: { days, mode } }, {
      headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=60' }
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 })
  }
}

