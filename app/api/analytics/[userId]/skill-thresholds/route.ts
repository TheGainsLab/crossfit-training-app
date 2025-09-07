import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const body = await request.json()
    const { skillName, scheduleForMonth } = body as { skillName: string; scheduleForMonth?: string }

    if (!userId || !skillName) {
      return NextResponse.json({ error: 'Missing userId or skillName' }, { status: 400 })
    }

    // Ensure per-user thresholds table exists (documented expectation)
    // Table: user_skill_thresholds(user_id int, skill_name text, multiplier numeric, updated_at timestamptz)
    // Insert or bump multiplier by 10%
    const { data: existing } = await supabase
      .from('user_skill_thresholds')
      .select('multiplier')
      .eq('user_id', parseInt(userId))
      .eq('skill_name', skillName)
      .single()

    const newMultiplier = existing?.multiplier ? Number(existing.multiplier) * 1.1 : 1.1

    const { error: upsertError } = await supabase
      .from('user_skill_thresholds')
      .upsert({
        user_id: parseInt(userId),
        skill_name: skillName,
        multiplier: newMultiplier,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,skill_name' })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, multiplier: newMultiplier })
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    const { data, error } = await supabase
      .from('user_skill_thresholds')
      .select('skill_name, multiplier')
      .eq('user_id', parseInt(userId))

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, thresholds: data || [] })
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

