import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request, context: any) {
  try {
    const week = parseInt(context?.params?.week)
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    const supabase = createClient(supabaseUrl, serviceKey)

    // Identify user via auth header if present
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    let userId: number | null = null
    try {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
      const token = authHeader?.replace('Bearer ', '') || ''
      if (token) {
        // Prefer admin auth to decode JWT reliably in server
        const { data: authUser } = await createClient(supabaseUrl, serviceKey).auth.getUser(token)
        const auth_id = authUser?.user?.id
        if (auth_id) {
          const { data: u } = await supabase.from('users').select('id').eq('auth_id', auth_id).single()
          if (u?.id) userId = u.id
        }
      }
    } catch {}
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    // Get latest program for user
    const { data: prog } = await supabase
      .from('programs')
      .select('id, program_data')
      .eq('user_id', userId)
      .order('id', { ascending: false })
      .limit(1)
      .single()
    const programId = prog?.id
    if (!programId) return NextResponse.json({ success: true, days: [] })

    // Original scaffold for the target week
    const { data: originals, error: originalsErr } = await supabase
      .from('program_workouts')
      .select('week, day, block, exercise_name')
      .eq('program_id', programId)
      .eq('week', week)
      .order('day')
    if (originalsErr) {
      return NextResponse.json({ success: false, error: originalsErr.message }, { status: 500 })
    }

    // Previews
    // For first iteration, preview page shows original only. Keep the previews fetch commented for later.
    // const { data: previews } = await supabase
    //   .from('modified_workouts')
    //   .select('week, day, modified_program, is_preview')
    //   .eq('user_id', userId)
    //   .eq('program_id', programId)
    //   .eq('week', week)

    // Shape days and diffs (simple line diffs by exercise names)
    const daysMap: Record<number, any> = {}
    ;(originals || []).forEach((r) => {
      daysMap[r.day] = daysMap[r.day] || { day: r.day, original: {}, diff: [], hasPreview: false }
      daysMap[r.day].original[r.block] = daysMap[r.day].original[r.block] || []
      daysMap[r.day].original[r.block].push(r.exercise_name)
    })
    // (Diffs omitted for initial read-only preview)

    // Also attach a normalized list of blocks per day
    const days = Object.values(daysMap).sort((a: any, b: any) => a.day - b.day).map((d: any) => ({
      ...d,
      blocks: Object.keys(d.original || {})
    }))
    return NextResponse.json({ success: true, programId, week, days })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 500 })
  }
}

