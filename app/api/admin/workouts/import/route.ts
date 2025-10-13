import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function isAdminEmail(email: string | null | undefined): boolean {
  const allow = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!allow.length) return true
  if (!email) return false
  return allow.includes(email)
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || (process.env.NEXT_PUBLIC_SUPABASE_URL as string)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    const sb = createClient(supabaseUrl, serviceKey)

    // Basic admin gating via bearer token -> user email check
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || ''
    if (token) {
      const { data: authUser } = await createClient(supabaseUrl, serviceKey).auth.getUser(token)
      const email = authUser?.user?.email || null
      if (!isAdminEmail(email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    } else {
      if (!isAdminEmail(null)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const workouts: any[] = Array.isArray(body?.workouts) ? body.workouts : []
    const stats: any[] = Array.isArray(body?.stats) ? body.stats : []
    const truncate = Boolean(body?.truncate)

    const fmtLevel = (s: any) => String(s||'').trim()
    const fmtFormat = (s: any) => String(s||'').trim()
    const fmtMetric = (s: any) => String(s||'').trim().toLowerCase()
    const toInt = (v: any) => {
      const s = typeof v === 'string' ? v.replace(/,/g, '') : v
      const n = Number(s)
      return Number.isFinite(n) ? Math.trunc(n) : null
    }
    const toNum = (v: any) => {
      const s = typeof v === 'string' ? v.replace(/,/g, '') : v
      const n = Number(s)
      return Number.isFinite(n) ? n : null
    }
    const deriveRange = (sec: number | null): string | null => {
      if (!sec) return null
      if (sec <= 300) return '1:00–5:00'
      if (sec <= 600) return '5:00–10:00'
      if (sec <= 900) return '10:00–15:00'
      if (sec <= 1200) return '15:00–20:00'
      return '20:00+'
    }
    const normalizeEquipment = (raw: string): string => {
      const s = raw.toLowerCase()
      if (s.includes('pull') && (s.includes('bar') || s.includes('rig'))) return 'Pullup Bar or Rig'
      if (s.includes('barbell')) return 'Barbell'
      if (s.includes('axle')) return 'Axle Bar'
      if (s.includes('dumbbell')) return 'Dumbbells'
      if (s.includes('wall ball') || s.includes('med ball')) return 'Wall Ball'
      if (s.includes('kettlebell')) return 'Kettlebell'
      if (s.includes('row')) return 'Row Erg'
      if (s.includes('bike')) return 'Bike Erg'
      if (s.includes('ski')) return 'Ski Erg'
      if (s.includes('jump rope') || s.includes('double')) return 'Jump Rope'
      if (s.includes('rope climb') || (s.includes('rope') && s.includes('climb'))) return 'Climbing Rope'
      if (s.includes('box')) return 'Plyo Box'
      if (s.includes('ghd') || s.includes('glute-ham') || s.includes('glute ham')) return 'GHD'
      if (s.includes('ring')) return 'Rings'
      if (s.includes('sandbag')) return 'Sandbag'
      if (s.includes('sled')) return 'Sled'
      return 'Other'
    }

    if (truncate) {
      // No-op for direct import
    }

    // Upsert events and workouts
    const slugToWorkoutId: Record<string, string> = {}
    const slugToMetric: Record<string, string> = {}
    for (const w of workouts) {
      const slug = String(w.slug || '').trim()
      if (!slug) return NextResponse.json({ error: 'Missing slug', stage: 'validate' }, { status: 400 })
      const year = toInt(w.event_year)
      const event_name = String(w.event_name || '').trim()
      const event_level = fmtLevel(w.event_level)
      const name = String(w.name || '').trim()
      const format = fmtFormat(w.format)
      const score_metric = fmtMetric(w.score_metric)
      const time_cap_seconds = toInt(w.time_cap_seconds)
      const time_domain = (String(w.time_domain||'').trim() || null) as any
      const time_range = (String(w.time_range||'').trim() || deriveRange(time_cap_seconds)) as any
      const notes = (w.notes ?? null) as any
      const tasks_json = (() => { try { return w.tasks_json ? JSON.parse(String(w.tasks_json)) : null } catch { return null } })()
      const male_lbs = toNum(w.max_weight_male_lbs)
      const female_lbs = toNum(w.max_weight_female_lbs)
      const male_kg = toNum(w.max_weight_male_kg) ?? (male_lbs ? Math.round((male_lbs/2.20462)*100)/100 : null)
      const female_kg = toNum(w.max_weight_female_kg) ?? (female_lbs ? Math.round((female_lbs/2.20462)*100)/100 : null)

      // 1) event id
      const { data: ev } = await sb
        .from('comp_events')
        .select('id')
        .eq('year', year)
        .eq('name', event_name)
        .eq('level', event_level)
        .maybeSingle()
      let event_id = ev?.id as string | undefined
      if (!event_id) {
        const { data: ins, error } = await sb
          .from('comp_events')
          .insert({ year, name: event_name, level: event_level } as any)
          .select('id')
          .single()
        if (error) return NextResponse.json({ error: error.message, stage: 'upsert_event', slug }, { status: 400 })
        event_id = ins.id
      }

      // 2) workout upsert by slug
      const base = {
        event_id,
        slug,
        name,
        format,
        time_domain: time_domain || null,
        time_range: time_range || null,
        time_cap_seconds: time_cap_seconds || null,
        score_metric,
        tasks: tasks_json,
        notes,
        max_weight_male_kg: male_kg,
        max_weight_female_kg: female_kg,
        max_weight_male_lbs: male_lbs,
        max_weight_female_lbs: female_lbs
      } as any
      const { data: wsel } = await sb.from('comp_workouts').select('id, score_metric').eq('slug', slug).maybeSingle()
      let workout_id = wsel?.id as string | undefined
      if (!workout_id) {
        const { data: insW, error: werr } = await sb.from('comp_workouts').insert(base).select('id, score_metric').single()
        if (werr) return NextResponse.json({ error: werr.message, stage: 'insert_workout', slug }, { status: 400 })
        workout_id = insW.id
        slugToMetric[slug] = String(insW.score_metric || score_metric)
      } else {
        const { error: uerr } = await sb.from('comp_workouts').update(base).eq('id', workout_id)
        if (uerr) return NextResponse.json({ error: uerr.message, stage: 'update_workout', slug }, { status: 400 })
        slugToMetric[slug] = String(wsel?.score_metric || score_metric)
      }
      slugToWorkoutId[slug] = workout_id!

      // 3) equipment
      const eqCsv = String(w.equipment_csv || '').trim()
      if (eqCsv) {
        const parts = eqCsv.split(',').map(s => s.trim()).filter(Boolean)
        for (const p of parts) {
          const eq = normalizeEquipment(p)
          const { error: eqErr } = await sb.from('workout_equipment').upsert({ workout_id, equipment: eq } as any, { onConflict: 'workout_id,equipment' })
          if (eqErr) return NextResponse.json({ error: eqErr.message, stage: 'upsert_equipment', slug, equipment: eq }, { status: 400 })
        }
      }
    }

    // Upsert stats
    const parseTimeToSeconds = (val: any): number | null => {
      if (val == null) return null
      if (typeof val === 'number') return val
      const str = String(val).trim()
      if (!str) return null
      if (/^\d+(\.\d+)?$/.test(str)) return Number(str)
      const parts = str.split(':').map(p => p.trim())
      if (parts.length < 2 || parts.some(p => p === '')) return null
      const nums = parts.map(p => Number(p))
      if (nums.some(n => !Number.isFinite(n))) return null
      let seconds = 0
      if (nums.length === 2) seconds = nums[0] * 60 + nums[1]
      else if (nums.length === 3) seconds = nums[0] * 3600 + nums[1] * 60 + nums[2]
      else return null
      return seconds
    }
    for (const s of stats) {
      const slug = String(s.workout_slug || '').trim()
      const workout_id = slugToWorkoutId[slug]
      if (!workout_id) return NextResponse.json({ error: `Unknown workout_slug ${slug}`, stage: 'stats_lookup' }, { status: 400 })
      const gender = String(s.gender || '').toLowerCase() as 'male'|'female'
      const metric = slugToMetric[slug]
      const top_value = metric === 'time' ? (parseTimeToSeconds(s.top_value) ?? toNum(s.top_value)) : toNum(s.top_value)
      const p90_value = metric === 'time' ? (parseTimeToSeconds(s.p90_value) ?? toNum(s.p90_value)) : toNum(s.p90_value)
      const median_value = metric === 'time' ? (parseTimeToSeconds(s.median_value) ?? toNum(s.median_value)) : toNum(s.median_value)
      const attempts_count = toInt(s.attempts_count)
      if (!attempts_count || attempts_count <= 0) {
        return NextResponse.json({ error: 'attempts_count must be a positive integer', stage: 'validate_stats', slug, gender, value: s.attempts_count }, { status: 400 })
      }
      const pct_time_capped = toNum(s.pct_time_capped)
      const display_top = s.display_top ?? (metric === 'time' && typeof s.top_value === 'string' && s.top_value.includes(':') ? s.top_value : null)
      const display_p90 = s.display_p90 ?? (metric === 'time' && typeof s.p90_value === 'string' && s.p90_value.includes(':') ? s.p90_value : null)
      const display_median = s.display_median ?? (metric === 'time' && typeof s.median_value === 'string' && s.median_value.includes(':') ? s.median_value : null)

      const row = { workout_id, gender, top_value, p90_value, median_value, attempts_count, pct_time_capped, display_top, display_p90, display_median } as any
      const { error: serr } = await sb.from('workout_stats').upsert(row, { onConflict: 'workout_id,gender' })
      if (serr) return NextResponse.json({ error: serr.message, stage: 'upsert_stats', slug, gender }, { status: 400 })
    }

    return NextResponse.json({ success: true, inserted_workouts: workouts.length, inserted_stats: stats.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 400 })
  }
}

