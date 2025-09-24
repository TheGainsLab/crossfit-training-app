import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { CoachingBriefV1, Units, Ability, BlockName, TimeDomain, MetconLevel } from '@/lib/coach/schemas'

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
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

    // Window: last 56 days
    const now = new Date()
    const startWindow = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000)
    const startISO = startWindow.toISOString()
    const endISO = now.toISOString()

    // Profile & intake
    const [{ data: userRow }, { data: equipmentRows }, { data: oneRmsRows }] = await Promise.all([
      supabase.from('users').select('ability_level, units, conditioning_benchmarks').eq('id', userId).single(),
      supabase.from('user_equipment').select('equipment_name').eq('user_id', userId),
      supabase.from('latest_user_one_rms').select('one_rm_index, one_rm').eq('user_id', userId).order('one_rm_index')
    ])

    const units: Units = (userRow?.units && userRow.units.includes('kg')) ? 'Metric (kg)' : 'Imperial (lbs)'
    const ability: Ability = (['Beginner','Intermediate','Advanced'].includes(userRow?.ability_level)) ? userRow?.ability_level as Ability : 'Intermediate'
    const equipment = (equipmentRows || []).map((e: any) => e.equipment_name)
    const oneRMs: number[] = (() => {
      const arr = Array(14).fill(0)
      ;(oneRmsRows || []).forEach((r: any) => { if (r.one_rm_index >= 0 && r.one_rm_index < 14) arr[r.one_rm_index] = r.one_rm })
      return arr
    })()

    // Performance logs (last 56 days)
    const { data: logs } = await supabase
      .from('performance_logs')
      .select('logged_at, block, exercise_name, rpe, completion_quality')
      .eq('user_id', userId)
      .gte('logged_at', startISO)
      .lte('logged_at', endISO)
      .order('logged_at', { ascending: false })

    // Group logs by weekISO
    function weekStartISO(d: Date) {
      const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
      const day = dt.getUTCDay() || 7
      if (day !== 1) dt.setUTCDate(dt.getUTCDate() - (day - 1))
      return dt.toISOString().slice(0, 10)
    }
    const logsByWeek = new Map<string, any[]>()
    ;(logs || []).forEach((row: any) => {
      const dt = new Date(row.logged_at)
      const wk = weekStartISO(dt)
      if (!logsByWeek.has(wk)) logsByWeek.set(wk, [])
      logsByWeek.get(wk)!.push(row)
    })
    const logs_summary = Array.from(logsByWeek.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 8).map(([weekISO, rows]) => {
      const block_mix: Record<BlockName, number> = {
        'SKILLS': 0, 'TECHNICAL WORK': 0, 'STRENGTH AND POWER': 0, 'ACCESSORIES': 0, 'METCONS': 0
      }
      const rpeVals: number[] = []
      const qualityVals: number[] = []
      const freq: Record<string, number> = {}
      const dateSet = new Set<string>()
      rows.forEach((r: any) => {
        const blk = (r.block || '').toUpperCase()
        if (block_mix[blk as BlockName] !== undefined) block_mix[blk as BlockName]++
        if (typeof r.rpe === 'number') rpeVals.push(r.rpe)
        if (typeof r.completion_quality === 'number') qualityVals.push(r.completion_quality)
        if (r.exercise_name) freq[r.exercise_name] = (freq[r.exercise_name] || 0) + 1
        if (r.logged_at) dateSet.add(String(r.logged_at).slice(0, 10))
      })
      const top_movements = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n]) => ({ name, freq: n as number, avg_rpe: Math.round((rpeVals.reduce((s, v) => s + v, 0) / Math.max(1, rpeVals.length)) * 10) / 10 }))
      const sessions = dateSet.size
      const avg_rpe = Math.round((rpeVals.reduce((s, v) => s + v, 0) / Math.max(1, rpeVals.length)) * 10) / 10
      const volume = rows.length
      return { weekISO, sessions, block_mix, top_movements, avg_rpe, volume }
    })

    // Metcons summary (completed)
    const { data: programRows } = await supabase.from('programs').select('id').eq('user_id', userId).order('id', { ascending: false }).limit(1)
    const programId = programRows?.[0]?.id || null
    let metcons_summary = { completions: 0, time_domain_mix: [] as Array<{ range: TimeDomain; count: number }>, avg_percentile: null as number | null, best_scores: [] as Array<{ workout_id: string; percentile: number | null }>, equipment_mix: [] as Array<{ equipment: string; count: number }> }
    if (programId) {
      const { data: pm } = await supabase.from('program_metcons').select('metcon_id, percentile, completed_at').eq('program_id', programId).not('completed_at', 'is', null)
      const metconIds = Array.from(new Set((pm || []).map((r: any) => r.metcon_id).filter(Boolean)))
      const { data: mets } = metconIds.length ? await supabase.from('metcons').select('id, workout_id, time_range, required_equipment, level').in('id', metconIds) : { data: [] }
      const idToMet = new Map<number, any>()
      ;(mets || []).forEach((m: any) => idToMet.set(m.id, m))
      const tdFreq: Record<string, number> = {}
      const equipFreq: Record<string, number> = {}
      const best: Array<{ workout_id: string; percentile: number | null }> = []
      let pctSum = 0, pctN = 0
      ;(pm || []).forEach((r: any) => {
        const m = idToMet.get(r.metcon_id)
        if (m?.time_range) tdFreq[m.time_range] = (tdFreq[m.time_range] || 0) + 1
        if (Array.isArray(m?.required_equipment)) {
          m.required_equipment.forEach((eq: string) => { if (eq) equipFreq[eq] = (equipFreq[eq] || 0) + 1 })
        }
        if (typeof r.percentile === 'number') { pctSum += r.percentile; pctN++ }
        if (m?.workout_id) best.push({ workout_id: m.workout_id, percentile: r.percentile ?? null })
      })
      metcons_summary.completions = (pm || []).length
      metcons_summary.time_domain_mix = Object.entries(tdFreq).map(([range, count]) => ({ range: (range as TimeDomain), count: count as number }))
      metcons_summary.avg_percentile = pctN ? Math.round((pctSum / pctN) * 100) / 100 : null
      metcons_summary.best_scores = best.sort((a, b) => (b.percentile || 0) - (a.percentile || 0)).slice(0, 10)
      metcons_summary.equipment_mix = Object.entries(equipFreq).map(([equipment, count]) => ({ equipment, count: count as number }))
    }

    // Upcoming program (first 14 day entries from program_data)
    let upcoming_program: CoachingBriefV1['upcoming_program'] = []
    if (programId) {
      const { data: prog } = await supabase.from('programs').select('program_data').eq('id', programId).single()
      const programData: any = prog?.program_data || {}
      const weeksArr: any[] = Array.isArray(programData.weeks) ? programData.weeks : []
      const daysOut: any[] = []
      for (const w of weeksArr) {
        const days = Array.isArray(w?.days) ? w.days : []
        for (const d of days) {
          daysOut.push({ week: Number(w?.week) || 0, day: Number(d?.day) || 0, dayData: d })
          if (daysOut.length >= 14) break
        }
        if (daysOut.length >= 14) break
      }
      upcoming_program = daysOut.map((x: any) => ({
        dateISO: '',
        week: x.week,
        day: x.day,
        blocks: (Array.isArray(x.dayData?.blocks) ? x.dayData.blocks : []).map((b: any) => ({
          block: (b?.blockName || b?.block || 'SKILLS') as BlockName,
          subOrder: typeof b?.subOrder === 'number' ? b.subOrder : undefined,
          exercises: (Array.isArray(b?.exercises) ? b.exercises : []).map((ex: any) => ({ name: ex?.name || '', sets: ex?.sets, reps: ex?.reps, weightTime: ex?.weightTime, notes: ex?.notes })),
          metcon: b?.metconData ? { workout_id: b.metconData.workoutId, format: b.metconData.workoutFormat, time_range: b.metconData.timeRange, level: (b.metconData.level || undefined) } : undefined
        }))
      }))
    }

    // Adherence & trends (simple series from logs)
    const volume_by_week = logs_summary.map(l => ({ weekISO: l.weekISO, volume: l.volume }))
    const avg_rpe_by_week = logs_summary.map(l => ({ weekISO: l.weekISO, avg_rpe: l.avg_rpe }))
    const quality_by_week = Array.from(logsByWeek.entries()).map(([wk, rows]) => ({ weekISO: wk, avg_quality: Math.round(((rows as any[]).reduce((s, r) => s + (r.completion_quality || 0), 0) / Math.max(1, (rows as any[]).length)) * 100) / 100 }))
    const planned_sessions = upcoming_program.length // days as sessions
    const completed_sessions = Array.from(new Set((logs || []).map((r: any) => String(r.logged_at).slice(0, 10)))).length
    const pct = planned_sessions ? Math.round((Math.min(completed_sessions, planned_sessions) / planned_sessions) * 100) : 0

    const brief: CoachingBriefV1 = {
      version: 'v1',
      metadata: { userId, window: { startISO, endISO }, units },
      profile: { ability, goals: [], constraints: [], equipment },
      intake: { skills: [], oneRMs, conditioning_benchmarks: userRow?.conditioning_benchmarks || {} },
      logs_summary,
      metcons_summary,
      upcoming_program,
      adherence: { planned_sessions, completed_sessions, pct, by_week: [] },
      trends: { volume_by_week, avg_rpe_by_week, quality_by_week },
      allowed_entities: {
        blocks: ['SKILLS','TECHNICAL WORK','STRENGTH AND POWER','ACCESSORIES','METCONS'],
        movements: Array.from(new Set((logs || []).map((r: any) => r.exercise_name).filter(Boolean))).slice(0, 50),
        time_domains: ['1-5','5-10','10-15','15-20','20+'],
        equipment: ['Barbell','Dumbbells'],
        levels: ['Open','Quarterfinals','Regionals','Games']
      },
      citations: ['profile','logs_summary','metcons_summary','upcoming_program','adherence','trends']
    }

    return NextResponse.json({ success: true, brief })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 500 })
  }
}

