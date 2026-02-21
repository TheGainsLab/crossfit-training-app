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

    // Fetch user's unit preference for labeling output
    const { data: userPref } = await supabase.from('users').select('units').eq('id', userId).single()
    const units = userPref?.units || 'Imperial (lbs)'

    const { searchParams } = new URL(req.url)
    const range = searchParams.get('range')
    const block = searchParams.get('block') || 'STRENGTH AND POWER'
    const { sinceISO } = mapRange(range)

    // Fetch logs with strength fields
    let q = supabase
      .from('performance_logs')
      .select('exercise_name, rpe, logged_at, block, sets, reps, weight_time')
      .eq('user_id', userId)
    if (sinceISO) q = q.gte('logged_at', sinceISO) as any
    if (block) q = q.eq('block', block) as any
    const { data: rows, error } = await q
    if (error) throw error

    // Deterministic parsers — return raw value in user's native units (no lbs conversion)
    const toNumber = (s: any): number => {
      if (s === null || s === undefined) return 0
      const str = String(s).trim()
      if (!str) return 0
      if (/\d+:\d{2}/.test(str)) return 0 // looks like time, not weight
      const match = str.match(/([0-9]+(?:\.[0-9]+)?)/)
      if (!match) return 0
      return parseFloat(match[1])
    }
    const parseIntSafe = (s: any): number => {
      if (s === null || s === undefined) return 0
      const str = String(s).trim()
      if (!str) return 0
      // handle ranges like 8-10: take higher deterministically
      const range = str.match(/(\d+)\s*[-–]\s*(\d+)/)
      if (range) return parseInt(range[2], 10)
      const single = str.match(/(\d{1,3})/)
      return single ? parseInt(single[1], 10) : 0
    }

    type MovementAgg = {
      rpeSum: number
      rpeN: number
      maxWeight: number
      totalReps: number
      totalVolume: number
      byDateTopWeight: Record<string, number>
      lastDate: string | null
      lastWeight: number
      lastReps: number
    }

    const agg: Record<string, MovementAgg> = {}
    ;(rows || []).forEach((r: any) => {
      const name = r.exercise_name || 'Unknown'
      if (!agg[name]) {
        agg[name] = {
          rpeSum: 0,
          rpeN: 0,
          maxWeight: 0,
          totalReps: 0,
          totalVolume: 0,
          byDateTopWeight: {},
          lastDate: null,
          lastWeight: 0,
          lastReps: 0,
        }
      }
      const a = agg[name]
      if (typeof r.rpe === 'number') { a.rpeSum += r.rpe; a.rpeN += 1 }
      const weight = toNumber(r.weight_time)
      const setsNum = parseIntSafe(r.sets) || 1
      const repsNum = parseIntSafe(r.reps)
      a.maxWeight = Math.max(a.maxWeight, weight)
      a.totalReps += (setsNum * repsNum)
      if (weight > 0 && repsNum > 0 && setsNum > 0) {
        a.totalVolume += weight * repsNum * setsNum
      }
      const d = r.logged_at ? new Date(r.logged_at) : null
      if (d) {
        const key = d.toISOString().slice(0,10)
        a.byDateTopWeight[key] = Math.max(a.byDateTopWeight[key] || 0, weight)
        if (!a.lastDate || d > new Date(a.lastDate)) {
          a.lastDate = d.toISOString()
          a.lastWeight = weight
          a.lastReps = repsNum
        }
      }
    })

    const movements = Object.entries(agg).map(([exercise_name, v]) => {
      const dates = Object.keys(v.byDateTopWeight)
      const avgTopSetWeight = dates.length
        ? Math.round((dates.reduce((s, k) => s + v.byDateTopWeight[k], 0) / dates.length) * 100) / 100
        : 0
      return {
        exercise_name,
        session_count: dates.length,
        avg_rpe: v.rpeN ? Math.round((v.rpeSum / v.rpeN) * 100) / 100 : null,
        max_weight: v.maxWeight,
        avg_top_set_weight: avgTopSetWeight,
        total_reps: v.totalReps,
        total_volume: Math.round(v.totalVolume),
        last_session: v.lastDate ? { logged_at: v.lastDate, weight: v.lastWeight, reps: v.lastReps } : null
      }
    })

    // Optional sort and limit
    const sort = (searchParams.get('sort') || 'total_volume').toLowerCase()
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '20', 10)))
    const sorters: Record<string, (a: any, b: any) => number> = {
      total_volume: (a, b) => (b.total_volume || 0) - (a.total_volume || 0),
      max_weight: (a, b) => (b.max_weight || 0) - (a.max_weight || 0),
      sessions: (a, b) => (b.session_count || 0) - (a.session_count || 0),
      avg_rpe: (a, b) => (b.avg_rpe || 0) - (a.avg_rpe || 0),
    }
    const sorter = sorters[sort] || sorters.total_volume
    movements.sort(sorter)

    return NextResponse.json({ success: true, summary: { block, units, movements: movements.slice(0, limit) } })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 500 })
  }
}

 
