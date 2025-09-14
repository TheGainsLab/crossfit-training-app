import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const supabase = createClient(supabaseUrl, serviceKey)

    // Auth: map bearer to user_id
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    const { data: authUser } = await createClient(supabaseUrl, serviceKey).auth.getUser(token)
    const auth_id = authUser?.user?.id
    if (!auth_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userRow, error: uerr } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', auth_id)
      .single()
    if (uerr || !userRow?.id) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const userId = userRow.id as number

    // Date window: last 90 days for KPIs
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const compute = unstable_cache(async () => {
      const { data: logs } = await supabase
        .from('performance_logs')
        .select('id, logged_at, block_name')
        .eq('user_id', userId)
        .gte('logged_at', since)

      const trainingDays = new Set<string>()
      const blockCounts: Record<string, number> = {}
      let totalExercises = 0
      for (const row of logs || []) {
        const dayKey = row.logged_at ? new Date(row.logged_at).toISOString().slice(0, 10) : ''
        if (dayKey) trainingDays.add(dayKey)
        const block = (row as any).block_name || 'UNKNOWN'
        blockCounts[block] = (blockCounts[block] || 0) + 1
        totalExercises++
      }

      const fitnessScore = Math.min(100, Math.round((totalExercises / Math.max(1, trainingDays.size * 12)) * 100))
      const distributionByBlock = Object.keys(blockCounts).map(k => ({ block: k, count: blockCounts[k] }))
      return { fitnessScore, trainingDays: trainingDays.size, totalExercises, distributionByBlock }
    }, [`global-analytics:${userId}`], { revalidate: 300 })

    const cached = await compute()

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          fitnessScore: cached.fitnessScore,
          trainingDays: cached.trainingDays,
          totalExercises: cached.totalExercises
        },
        distributionByBlock: cached.distributionByBlock
      },
      metadata: { since }
    }, {
      // Basic cache headers; can be refined or tag-based invalidation added
      headers: {
        'Cache-Control': 's-maxage=300, stale-while-revalidate=60'
      }
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 })
  }
}

