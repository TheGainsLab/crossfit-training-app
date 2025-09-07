import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { programId, week, day, calories } = await request.json()
    if (!programId || !week || !day || typeof calories !== 'number') {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Expect a column daily_calories on program_workouts or a separate table workout_calories
    const { data: pw } = await supabase
      .from('program_workouts')
      .select('id')
      .eq('program_id', programId)
      .eq('week', week)
      .eq('day', day)
      .single()

    if (pw) {
      const { error } = await supabase
        .from('program_workouts')
        .update({ daily_calories: calories, updated_at: new Date().toISOString() })
        .eq('id', pw.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // Fallback: upsert into workout_calories table
    const { error: upsertErr } = await supabase
      .from('workout_calories')
      .upsert({ program_id: programId, week, day, calories, updated_at: new Date().toISOString() }, { onConflict: 'program_id,week,day' })
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

