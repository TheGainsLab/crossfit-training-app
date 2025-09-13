import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params
    const body = await request.json()
    const { skillName, scheduleForMonth } = body as { skillName: string; scheduleForMonth?: string }

    if (!userId || !skillName) {
      return NextResponse.json({ error: 'Missing userId or skillName' }, { status: 400 })
    }

    const userIdNum = parseInt(userId, 10)
    if (!Number.isFinite(userIdNum)) {
      return NextResponse.json({ error: 'Invalid userId' }, { status: 400 })
    }

    // Read existing multiplier (avoid relying on unique index for upsert)
    const { data: rows, error: selError } = await supabase
      .from('user_skill_thresholds')
      .select('multiplier')
      .eq('user_id', userIdNum)
      .eq('skill_name', skillName)
      .limit(1)

    if (selError) {
      console.error('skill-thresholds select error:', selError)
      return NextResponse.json({ error: selError.message }, { status: 500 })
    }

    const existingMultiplier = Array.isArray(rows) && rows.length > 0 ? Number(rows[0].multiplier) : null
    const newMultiplier = existingMultiplier ? existingMultiplier * 1.1 : 1.1

    if (existingMultiplier !== null) {
      const { error: updErr } = await supabase
        .from('user_skill_thresholds')
        .update({ multiplier: newMultiplier, updated_at: new Date().toISOString() })
        .eq('user_id', userIdNum)
        .eq('skill_name', skillName)
      if (updErr) {
        console.error('skill-thresholds update error:', updErr)
        return NextResponse.json({ error: updErr.message }, { status: 500 })
      }
    } else {
      const { error: insErr } = await supabase
        .from('user_skill_thresholds')
        .insert({
          user_id: userIdNum,
          skill_name: skillName,
          multiplier: newMultiplier,
          updated_at: new Date().toISOString()
        })
      if (insErr) {
        console.error('skill-thresholds insert error:', insErr)
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, multiplier: newMultiplier })
  } catch (error) {
    console.error('skill-thresholds POST error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    const { data, error } = await supabase
      .from('user_skill_thresholds')
      .select('skill_name, multiplier')
      .eq('user_id', parseInt(userId))

    if (error) {
      console.error('skill-thresholds GET error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, thresholds: data || [] })
  } catch (error) {
    console.error('skill-thresholds GET catch error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

