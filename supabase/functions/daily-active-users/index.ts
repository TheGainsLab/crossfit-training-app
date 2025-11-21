// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, serviceKey)

serve(async () => {
  try {
    // Rolling 24h window (UTC)
    const windowEnd = new Date()
    const windowStart = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000)
    const windowStartISO = windowStart.toISOString()
    const windowEndISO = windowEnd.toISOString()

    // 1) Per‑exercise logs: used for sessions + tasks
    const { data: perf, error: perfErr } = await supabase
      .from('performance_logs')
      .select('user_id, program_id, week, day, logged_at')
      .gte('logged_at', windowStartISO)
      .lt('logged_at', windowEndISO)

    if (perfErr) {
      console.error('❌ performance_logs error:', perfErr)
      return new Response(
        JSON.stringify({ success: false, error: 'performance_logs error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 2) MetCon completions (via programs to get user + subscription info)
    const { data: metcons, error: metErr } = await supabase
      .from('program_metcons')
      .select(`
        program_id,
        completed_at,
        programs!inner(
          user_id,
          program_number
        )
      `)
      .gte('completed_at', windowStartISO)
      .lt('completed_at', windowEndISO)

    if (metErr) {
      console.error('❌ program_metcons error:', metErr)
      return new Response(
        JSON.stringify({ success: false, error: 'program_metcons error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    type Summary = {
      userId: number
      sessions: Set<string>
      tasks: number
      metcons: number
      primaryProgramId?: number
      subscriptionTier?: string
      programMonth?: number
      firstActivityAt?: Date
      lastActivityAt?: Date
    }

    const summaries = new Map<number, Summary>()

    const getSummary = (userId: number): Summary => {
      let s = summaries.get(userId)
      if (!s) {
        s = {
          userId,
          sessions: new Set(),
          tasks: 0,
          metcons: 0,
        }
        summaries.set(userId, s)
      }
      return s
    }

    // Aggregate from performance_logs
    for (const row of perf ?? []) {
      const userId = row.user_id as number
      if (!userId) continue
      const s = getSummary(userId)

      const key = `${row.program_id}-${row.week}-${row.day}`
      s.sessions.add(key)
      s.tasks += 1

      const ts = new Date(row.logged_at as string)
      if (!s.firstActivityAt || ts < s.firstActivityAt) s.firstActivityAt = ts
      if (!s.lastActivityAt || ts > s.lastActivityAt) s.lastActivityAt = ts
    }

    // Aggregate from program_metcons
    for (const row of metcons ?? []) {
      const program = (row as any).programs
      if (!program) continue

      const userId = program.user_id as number
      if (!userId) continue
      const s = getSummary(userId)

      s.metcons += 1

      // For now, treat the latest program seen in the window as primary
      s.primaryProgramId = row.program_id as number
      const programNumber = (program.program_number as number | null) ?? null
      s.programMonth = programNumber ?? undefined

      const ts = new Date(row.completed_at as string)
      if (!s.firstActivityAt || ts < s.firstActivityAt) s.firstActivityAt = ts
      if (!s.lastActivityAt || ts > s.lastActivityAt) s.lastActivityAt = ts
    }

    // Enrich summaries with subscription_tier from users table
    const userIds = Array.from(summaries.keys())
    if (userIds.length > 0) {
      const { data: userRows, error: userErr } = await supabase
        .from('users')
        .select('id, subscription_tier')
        .in('id', userIds)

      if (userErr) {
        console.error('❌ users lookup error:', userErr)
      } else {
        const tierByUserId = new Map<number, string | null>()
        for (const row of userRows ?? []) {
          tierByUserId.set(row.id as number, row.subscription_tier as string | null)
        }

        for (const [userId, summary] of summaries.entries()) {
          if (tierByUserId.has(userId)) {
            summary.subscriptionTier = tierByUserId.get(userId) ?? undefined
          }
        }
      }
    }

    // Build rows only for users who actually trained in the window
    const payload = Array.from(summaries.values())
      .filter((s) => s.sessions.size > 0 || s.tasks > 0 || s.metcons > 0)
      .map((s) => ({
        user_id: s.userId,
        window_start: windowStartISO,
        window_end: windowEndISO,
        sessions_completed: s.sessions.size,
        tasks_completed: s.tasks,
        metcons_completed: s.metcons,
        primary_program_id: s.primaryProgramId ?? null,
        subscription_tier: s.subscriptionTier ?? null,
        program_month: s.programMonth ?? null,
        first_activity_at: s.firstActivityAt?.toISOString() ?? null,
        last_activity_at: s.lastActivityAt?.toISOString() ?? null,
      }))

    if (payload.length > 0) {
      const { error: insertErr } = await supabase
        .from('daily_active_users')
        .insert(payload)

      if (insertErr) {
        console.error('❌ insert daily_active_users error:', insertErr)
        return new Response(
          JSON.stringify({ success: false, error: 'insert error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ success: true, activeUsers: payload.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('❌ daily-active-users unexpected error:', e)
    return new Response(
      JSON.stringify({ success: false, error: String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})


