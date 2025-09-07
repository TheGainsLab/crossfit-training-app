import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server not configured (Supabase env missing)' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const { programId, week, day, calories, low, high } = await request.json()
    if (!programId || week == null || day == null || typeof calories !== 'number') {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Try to update program_workouts.daily_calories if column exists
    let updatedDaily = false
    try {
      const { error: updateErr } = await supabase
        .from('program_workouts')
        .update({ daily_calories: calories })
        .eq('program_id', programId)
        .eq('week', week)
        .eq('day', day)
      if (!updateErr) updatedDaily = true
    } catch (_) {
      // Ignore; may be missing column/table
    }

    // Always append audit log entry
    const { error: auditErr } = await supabase
      .from('workout_calories')
      .insert({ program_id: programId, week, day, calories, low, high, source: 'ai' })
    if (auditErr) {
      return NextResponse.json({ error: auditErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, updatedDaily })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

