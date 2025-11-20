import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const debug: any = { stage: 'start' }
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ success: false, error: 'Server not configured (Supabase env missing)', debug }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const payload = await request.json()
    const { programId, week, day, calories, low, high } = payload
    debug.payload = { programId, week, day, calories, hasLow: low != null, hasHigh: high != null }
    if (!programId || week == null || day == null || typeof calories !== 'number') {
      return NextResponse.json({ success: false, error: 'Missing fields', debug }, { status: 400 })
    }

    // program_workouts table removed - skip daily_calories update
    const updatedDaily = false
    debug.updateDaily = { ok: false, error: 'program_workouts table removed' }

    // Always append audit log entry
    const { error: auditErr } = await supabase
      .from('workout_calories')
      .insert({ program_id: programId, week, day, calories, low, high, source: 'ai' })
    debug.audit = auditErr ? { ok: false, error: auditErr.message } : { ok: true }
    if (auditErr) return NextResponse.json({ success: false, error: auditErr.message, debug }, { status: 500 })

    return NextResponse.json({ success: true, updatedDaily, debug })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 })
  }
}

