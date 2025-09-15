import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { runDecisionPolicy, buildContextHash, type ContextFeatures, type PolicyConfig } from '@/lib/ai/decision-policy'

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

    const days = 90
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const threshold = 10

    const compute = unstable_cache(async () => {
      // Count per block in last N days
      const countFor = async (block: string) => {
        const { count } = await supabase
          .from('performance_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('block', block)
          .gte('logged_at', since)
        return count || 0
      }

      const [skillsCount, strengthCount, metconsCount] = await Promise.all([
        countFor('SKILLS'),
        countFor('STRENGTH AND POWER'),
        countFor('METCONS')
      ])

      const blockStatus = {
        skills: { count: skillsCount, threshold, status: skillsCount >= threshold ? 'ready' : 'insufficient_context' },
        strength: { count: strengthCount, threshold, status: strengthCount >= threshold ? 'ready' : 'insufficient_context' },
        metcons: { count: metconsCount, threshold, status: metconsCount >= threshold ? 'ready' : 'insufficient_context' }
      }

      // Decision policy for structured actions (only passes counts for now)
      // Enrich features with latest 1RMs, preferences, and equipment
      const recentOneRMsArr: Array<{ exercise: string; value: number; recorded_at: string }> = []
      {
        const { data: oneRMs } = await supabase
          .from('user_one_rms')
          .select('exercise_name, one_rm, recorded_at')
          .eq('user_id', userId)
          .order('recorded_at', { ascending: false })
          .limit(100)
        const seen = new Set<string>()
        for (const r of (oneRMs || [])) {
          if (!seen.has(r.exercise_name)) {
            recentOneRMsArr.push({ exercise: r.exercise_name as any, value: Number(r.one_rm), recorded_at: (r.recorded_at as any) || '' })
            seen.add(r.exercise_name)
          }
        }
      }
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('training_days_per_week, selected_goals, metcon_time_focus, primary_strength_lifts, emphasized_strength_lifts')
        .eq('user_id', userId)
        .single()
      const { data: equip } = await supabase
        .from('user_equipment')
        .select('equipment_name')
        .eq('user_id', userId)

      const features: ContextFeatures = {
        userId,
        sinceIso: since,
        blockCounts: { 'SKILLS': skillsCount, 'STRENGTH AND POWER': strengthCount, 'METCONS': metconsCount },
        recentOneRMs: recentOneRMsArr,
        preferences: prefs || {},
        equipment: (equip || []).map((e: any) => e.equipment_name)
      }
      const cfg: PolicyConfig = { sessionGatePerBlock: threshold }
      const decision = runDecisionPolicy(features, cfg)
      const insights = decision.insights
      const context_hash = buildContextHash(features)

      // Keep a minimal predictions object for UI compatibility
      const predictions = {}

      return { blockStatus, insights, predictions, since, context_hash }
    }, [`insights-analytics:${userId}:${days}`], { revalidate: 300, tags: [`insights-analytics:${userId}`] })

    const result = await compute()
    return NextResponse.json({ success: true, data: { ...result } }, { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 })
  }
}

