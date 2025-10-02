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
    const mode = (searchParams.get('mode') || '').toLowerCase()
    const startWeekParam = searchParams.get('startWeek')
    const endWeekParam = searchParams.get('endWeek')

    // Get latest program for user
    const { data: prog } = await supabase.from('programs').select('id').eq('user_id', userId).order('id', { ascending: false }).limit(1)
    const programId = prog?.[0]?.id
    if (!programId) return NextResponse.json({ success: true, summary: { completions: 0, time_domain_mix: [], avg_percentile: null, best_scores: [], equipment_mix: [] }, heatmap: [], plan: [] })

    // New: exact plan rows for latest program (week/day/time_range)
    if (mode === 'plan') {
      const startWeek = startWeekParam ? parseInt(startWeekParam) : 1
      const endWeek = endWeekParam ? parseInt(endWeekParam) : (startWeek + 3)
      // Step 1: get program metcon rows for the window
      const { data: pmRows, error: pmErr } = await supabase
        .from('program_metcons')
        .select('week, day, metcon_id')
        .eq('program_id', programId)
        .gte('week', startWeek)
        .lte('week', endWeek)
        .order('week', { ascending: true })
        .order('day', { ascending: true })
      if (pmErr) throw pmErr
      const metconIds = Array.from(new Set((pmRows || []).map((r: any) => r.metcon_id).filter(Boolean)))
      let idToTimeRange: Record<string, string | null> = {}
      if (metconIds.length > 0) {
        const { data: mRows, error: mErr } = await supabase
          .from('metcons')
          .select('id, time_range')
          .in('id', metconIds as any)
        if (mErr) throw mErr
        idToTimeRange = Object.fromEntries((mRows || []).map((m: any) => [String(m.id), m.time_range || null]))
      }
      // Step 2: fallback plan view for any missing week/day
      let upRows: any[] | null = null
      try {
        const { data: up } = await supabase
          .from('ai_upcoming_program_v1')
          .select('week, day, metcon')
          .eq('program_id', programId)
          .gte('week', startWeek)
          .lte('week', endWeek)
        upRows = up || []
      } catch {}
      const upKeyToTR: Record<string, string | null> = {}
      ;(upRows || []).forEach((r: any) => {
        const key = `${r.week}-${r.day}`
        const tr = r?.metcon?.time_range ?? r?.metcon?.timeRange ?? null
        upKeyToTR[key] = tr || null
      })
      // Step 3: fallback to program JSON (programs.program_data)
      let jsonKeyToTR: Record<string, string | null> = {}
      let jsonKeyToWorkoutId: Record<string, string | null> = {}
      const jsonWorkoutIds: Set<string> = new Set()
      try {
        const { data: progRow } = await supabase
          .from('programs')
          .select('program_data')
          .eq('id', programId)
          .single()
        const pd: any = progRow?.program_data
        const weeks: any[] = Array.isArray(pd?.weeks) ? pd.weeks : []
        weeks.forEach((wObj: any) => {
          const wk = Number(wObj?.week) || 0
          const days: any[] = Array.isArray(wObj?.days) ? wObj.days : []
          days.forEach((dObj: any) => {
            const dy = Number(dObj?.day) || 0
            const blocks: any[] = Array.isArray(dObj?.blocks) ? dObj.blocks : []
            let tr: string | null = null
            let wid: string | null = null
            // 1) Prefer day-level metconData to match day page source
            const dayMetcon = (dObj?.metconData || dObj?.metcon || null) as any
            if (dayMetcon) {
              const dWid = (dayMetcon?.workoutId || dayMetcon?.workout_id || null) as string | null
              const dTR  = (dayMetcon?.timeRange || dayMetcon?.time_range || null) as string | null
              if (dWid) { wid = String(dWid); jsonWorkoutIds.add(wid) }
              if (dTR)  { tr = dTR }
            }
            // 2) Fallback to blocks-level metconData if day-level missing
            if (!tr || !wid) {
              for (const b of blocks) {
                const candidateTR = (b?.metconData?.timeRange || b?.metcon?.time_range || null) as string | null
                const candidateWID = (b?.metconData?.workoutId || b?.metcon?.workout_id || null) as string | null
                if (!wid && candidateWID) {
                  wid = String(candidateWID)
                  jsonWorkoutIds.add(wid)
                }
                if (!tr && candidateTR) { tr = candidateTR }
              }
            }
            if (wk >= startWeek && wk <= endWeek && dy >= 1 && dy <= 5) {
              jsonKeyToTR[`${wk}-${dy}`] = tr || null
              jsonKeyToWorkoutId[`${wk}-${dy}`] = wid || null
            }
          })
        })
      } catch {}

      // Resolve missing time ranges via metcons lookup by workout_id from JSON
      let workoutIdToTR: Record<string, string | null> = {}
      if (jsonWorkoutIds.size > 0) {
        try {
          const { data: mByWid } = await supabase
            .from('metcons')
            .select('workout_id, time_range')
            .in('workout_id', Array.from(jsonWorkoutIds))
          if (Array.isArray(mByWid)) {
            workoutIdToTR = Object.fromEntries(mByWid.map((m: any) => [String(m.workout_id), m.time_range || null]))
          }
        } catch {}
      }
      // Build a complete 20-day window (weeks startWeek..endWeek, days 1..5)
      const windowRows: Array<{ week: number; day: number; time_range: string | null }> = []
      for (let w = endWeek; w >= startWeek; w--) {
        for (let d = 1; d <= 5; d++) {
          const r = (pmRows || []).find((x: any) => Number(x.week) === w && Number(x.day) === d)
          const trFromPM = r ? (idToTimeRange[String(r.metcon_id)] || null) : null
          const trFromUP = upKeyToTR[`${w}-${d}`] ?? null
          const trFromJSON = jsonKeyToTR[`${w}-${d}`] ?? null
          const wid = jsonKeyToWorkoutId[`${w}-${d}`] || null
          const trFromWID = wid ? (workoutIdToTR[wid] || null) : null
          const tr = trFromPM ?? trFromUP ?? trFromJSON ?? trFromWID
          windowRows.push({ week: w, day: d, time_range: tr })
        }
      }
      return NextResponse.json({ success: true, plan: windowRows, window: { startWeek, endWeek } })
    }

    // Debug: return only program_metcons -> metcons.time_range mapping for the window
    if (mode === 'plan_pm') {
      const startWeek = startWeekParam ? parseInt(startWeekParam) : 1
      const endWeek = endWeekParam ? parseInt(endWeekParam) : (startWeek + 3)

      const { data: pmRows, error: pmErr } = await supabase
        .from('program_metcons')
        .select('week, day, metcon_id')
        .eq('program_id', programId)
        .gte('week', startWeek)
        .lte('week', endWeek)
        .order('week', { ascending: true })
        .order('day', { ascending: true })
      if (pmErr) throw pmErr

      const metconIds = Array.from(new Set((pmRows || []).map((r: any) => r.metcon_id).filter(Boolean)))
      let idToTimeRange: Record<string, string | null> = {}
      if (metconIds.length > 0) {
        const { data: mRows, error: mErr } = await supabase
          .from('metcons')
          .select('id, time_range')
          .in('id', metconIds as any)
        if (mErr) throw mErr
        idToTimeRange = Object.fromEntries((mRows || []).map((m: any) => [String(m.id), m.time_range || null]))
      }

      const pmKeyToTR: Record<string, string | null> = {}
      ;(pmRows || []).forEach((r: any) => {
        const key = `${r.week}-${r.day}`
        pmKeyToTR[key] = idToTimeRange[String(r.metcon_id)] || null
      })

      const daily: Array<{ week: number; day: number; from_pm: boolean; time_range: string | null }> = []
      for (let w = startWeek; w <= endWeek; w++) {
        for (let d = 1; d <= 5; d++) {
          const tr = pmKeyToTR[`${w}-${d}`] ?? null
          daily.push({ week: w, day: d, from_pm: tr !== null, time_range: tr })
        }
      }

      return NextResponse.json({ success: true, window: { startWeek, endWeek }, pm_count: (pmRows || []).length, daily })
    }

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

 