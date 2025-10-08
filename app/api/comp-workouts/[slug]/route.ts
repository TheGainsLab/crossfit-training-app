import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(_req: NextRequest, { params }: any) {
  const supabaseUrl = process.env.SUPABASE_URL || (process.env.NEXT_PUBLIC_SUPABASE_URL as string)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }
  const sb = createClient(supabaseUrl, serviceKey)

  const { data: workout, error: werr } = await sb
    .from('comp_workouts')
    .select('id, slug, name, format, time_domain, time_cap_seconds, score_metric, tasks, notes, max_weight_male_kg, max_weight_female_kg, max_weight_male_lbs, max_weight_female_lbs, event_id')
    .eq('slug', params.slug)
    .single()
  if (werr || !workout) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: event }, { data: equipment }, { data: stats }] = await Promise.all([
    sb.from('comp_events').select('year, name, level').eq('id', workout.event_id).single(),
    sb.from('workout_equipment').select('equipment').eq('workout_id', workout.id),
    sb.from('workout_stats').select('*').eq('workout_id', workout.id),
  ])

  const male = (stats || []).find((s: any) => s.gender === 'male') || null
  const female = (stats || []).find((s: any) => s.gender === 'female') || null

  return NextResponse.json({
    workout: {
      ...workout,
      event,
      equipment: (equipment || []).map((e: any) => e.equipment),
      stats: { male, female }
    }
  })
}

