import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  try {
    const { userId, jobType, payload, dedupeKey, scheduledFor } = await request.json()
    if (!userId || !jobType) {
      return NextResponse.json({ error: 'userId and jobType required' }, { status: 400 })
    }

    // If dedupeKey provided, try insert with conflict ignore
    let insertPayload: any = {
      user_id: Number(userId),
      job_type: String(jobType),
      payload: payload || {},
      status: 'pending',
      scheduled_for: scheduledFor || null
    }
    if (dedupeKey) insertPayload.dedupe_key = String(dedupeKey)

    const { error } = await supabase
      .from('ai_jobs')
      .insert(insertPayload)
      .select('id')
      .single()

    // If unique violation due to dedupe, treat as success
    if (error && (error as any).code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

