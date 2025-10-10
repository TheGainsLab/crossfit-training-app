import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const supabaseUrl = process.env.SUPABASE_URL || (process.env.NEXT_PUBLIC_SUPABASE_URL as string)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }
  const sb = createClient(supabaseUrl, serviceKey)

  const q = url.searchParams.get('q') || ''
  const level = url.searchParams.get('level') || undefined
  const format = url.searchParams.get('format') || undefined
  const timeDomain = url.searchParams.get('timeDomain') || undefined
  const timeRange = url.searchParams.get('timeRange') || undefined
  const equipmentCsv = url.searchParams.get('equipment') || ''
  const equipment = equipmentCsv ? equipmentCsv.split(',').map(s => s.trim()).filter(Boolean) : []
  const minTimeCap = url.searchParams.get('minTimeCap')
  const maxTimeCap = url.searchParams.get('maxTimeCap')
  const maleKgGte = url.searchParams.get('maleKgGte')
  const maleKgLte = url.searchParams.get('maleKgLte')
  const femaleKgGte = url.searchParams.get('femaleKgGte')
  const femaleKgLte = url.searchParams.get('femaleKgLte')
  const gender = (url.searchParams.get('gender') as 'male' | 'female' | null) || null
  const sort = url.searchParams.get('sort') || 'newest'
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50)
  const offset = parseInt(url.searchParams.get('offset') || '0', 10)

  let query = sb.from('workout_search_v1').select('*', { count: 'exact' })

  if (q) query = query.ilike('name', `%${q}%`)
  if (level) query = query.eq('event_level', level)
  if (format) query = query.eq('format', format)
  if (timeDomain) query = query.eq('time_domain', timeDomain)
  if (timeRange) {
    // Apply numeric bounds to include rows regardless of time_range null/populated
    const applyBounds = (min?: number, max?: number) => {
      if (typeof min === 'number') query = query.gt('time_cap_seconds', min)
      if (typeof max === 'number') query = query.lte('time_cap_seconds', max)
    }
    switch (timeRange) {
      case '1:00–5:00':
        applyBounds(undefined, 300)
        break
      case '5:00–10:00':
        applyBounds(300, 600)
        break
      case '10:00–15:00':
        applyBounds(600, 900)
        break
      case '15:00–20:00':
        applyBounds(900, 1200)
        break
      case '20:00+':
        applyBounds(1200, undefined)
        break
      default:
        break
    }
  }
  if (equipment.length) query = query.overlaps('equipment', equipment)
  if (minTimeCap) query = query.gte('time_cap_seconds', Number(minTimeCap))
  if (maxTimeCap) query = query.lte('time_cap_seconds', Number(maxTimeCap))
  if (maleKgGte) query = query.gte('max_weight_male_kg', Number(maleKgGte))
  if (maleKgLte) query = query.lte('max_weight_male_kg', Number(maleKgLte))
  if (femaleKgGte) query = query.gte('max_weight_female_kg', Number(femaleKgGte))
  if (femaleKgLte) query = query.lte('max_weight_female_kg', Number(femaleKgLte))

  switch (sort) {
    case 'name':
      query = query.order('name', { ascending: true })
      break
    case 'popularity':
      if (gender === 'female') {
        query = query.order('attempts_female', { ascending: false, nullsFirst: false })
      } else {
        query = query.order('attempts_male', { ascending: false, nullsFirst: false })
      }
      break
    case 'newest':
    default:
      query = query.order('event_year', { ascending: false }).order('name', { ascending: true })
      break
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = (data || []).map(row => {
    if (gender === 'female') {
      return {
        ...row,
        top: (row as any).top_female,
        p90: (row as any).p90_female,
        median: (row as any).median_female,
        attempts: (row as any).attempts_female,
        display_top: (row as any).display_top_female,
        display_p90: (row as any).display_p90_female,
        display_median: (row as any).display_median_female,
      }
    }
    if (gender === 'male') {
      return {
        ...row,
        top: (row as any).top_male,
        p90: (row as any).p90_male,
        median: (row as any).median_male,
        attempts: (row as any).attempts_male,
        display_top: (row as any).display_top_male,
        display_p90: (row as any).display_p90_male,
        display_median: (row as any).display_median_male,
      }
    }
    return row
  })

  return NextResponse.json({ items, count, limit, offset })
}

