import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET: read current intensity_bias for a day (returns { bias })
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const programId = parseInt(searchParams.get('programId') || '')
    const week = parseInt(searchParams.get('week') || '')
    const day = parseInt(searchParams.get('day') || '')

    if (!programId || !week || !day) {
      return NextResponse.json({ error: 'Missing programId, week or day' }, { status: 400 })
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error } = await supabase
      .from('program_workouts')
      .select('intensity_bias')
      .eq('program_id', programId)
      .eq('week', week)
      .eq('day', day)
      .limit(1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const bias = (data && data.length > 0 && typeof data[0].intensity_bias === 'number') ? data[0].intensity_bias : 0
    return NextResponse.json({ success: true, bias })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

// POST: update intensity_bias for a day with clamping and deload guard
// Body: { programId: number, week: number, day: number, delta?: number, bias?: number }
export async function POST(request: NextRequest) {
  try {
    const { programId, week, day, delta, bias } = await request.json()
    if (!programId || !week || !day) {
      return NextResponse.json({ error: 'Missing programId, week or day' }, { status: 400 })
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Read current bias and deload flag
    const { data: dayRows, error: readErr } = await supabase
      .from('program_workouts')
      .select('intensity_bias, is_deload')
      .eq('program_id', programId)
      .eq('week', week)
      .eq('day', day)
      .limit(1)

    if (readErr) {
      return NextResponse.json({ error: readErr.message }, { status: 500 })
    }

    const current = (dayRows && dayRows.length > 0 && typeof dayRows[0].intensity_bias === 'number') ? dayRows[0].intensity_bias : 0
    const isDeload = !!(dayRows && dayRows.length > 0 && dayRows[0].is_deload)

    // Compute new bias
    let requested = typeof bias === 'number' ? bias : current + (typeof delta === 'number' ? delta : 0)
    // Clamp to [-2, 2]
    let clamped = Math.max(-2, Math.min(2, Math.round(requested)))
    // Deload guard: never above baseline on deload
    if (isDeload) clamped = Math.min(0, clamped)

    // Update all rows for that day so downstream joins are consistent
    const { error: updErr } = await supabase
      .from('program_workouts')
      .update({ intensity_bias: clamped, updated_at: new Date().toISOString() })
      .eq('program_id', programId)
      .eq('week', week)
      .eq('day', day)

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, bias: clamped, isDeload })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

