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
      if (authHeader && anon) {
        const authClient = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } })
        const { data: au } = await authClient.auth.getUser()
        const auth_id = au?.user?.id
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
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()
    const programId = prog?.id
    if (!programId) return NextResponse.json({ success: true, days: [] })

    // Original scaffold for the target week
    const { data: originals } = await supabase
      .from('program_workouts')
      .select('week, day, block, exercise_name, main_lift, is_deload')
      .eq('program_id', programId)
      .eq('week', week)
      .order('day')

    // Previews
    const { data: previews } = await supabase
      .from('modified_workouts')
      .select('week, day, modified_program, is_preview')
      .eq('user_id', userId)
      .eq('program_id', programId)
      .eq('week', week)

    // Shape days and diffs (simple line diffs by exercise names)
    const daysMap: Record<number, any> = {}
    ;(originals || []).forEach((r) => {
      daysMap[r.day] = daysMap[r.day] || { day: r.day, mainLift: r.main_lift, original: {}, diff: [], hasPreview: false }
      daysMap[r.day].original[r.block] = daysMap[r.day].original[r.block] || []
      daysMap[r.day].original[r.block].push(r.exercise_name)
      daysMap[r.day].isDeload = r.is_deload
    })
    ;(previews || []).forEach((p) => {
      const day = p.day as number
      daysMap[day] = daysMap[day] || { day, original: {}, diff: [] }
      daysMap[day].hasPreview = !!p.is_preview
      try {
        const blocks = (p.modified_program?.blocks || []) as Array<{ blockName: string, exercises: Array<{ name: string }> }>
        const originalBlocks = daysMap[day].original || {}
        blocks.forEach((b) => {
          const orig = new Set((originalBlocks[b.blockName] || []) as string[])
          const after = (b.exercises || []).map(e => e.name)
          after.forEach(n => { if (!orig.has(n)) daysMap[day].diff.push(`+ ${b.blockName}: ${n}`) })
          orig.forEach((n: string) => { if (!after.includes(n)) daysMap[day].diff.push(`- ${b.blockName}: ${n}`) })
        })
      } catch {}
    })

    const days = Object.values(daysMap).sort((a: any, b: any) => a.day - b.day)
    return NextResponse.json({ success: true, programId, week, days })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 500 })
  }
}

