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

    // Build originals directly from programs.program_data JSON (source of truth)
    const daysMap: Record<number, any> = {}
    try {
      const programData: any = prog?.program_data || {}
      const weeksArr: any[] = Array.isArray(programData.weeks) ? programData.weeks : []
      const targetWeek = weeksArr.find((w: any) => Number(w?.week) === Number(week))
      const daysArr: any[] = Array.isArray(targetWeek?.days) ? targetWeek.days : []

      for (const d of daysArr) {
        const dayNum = Number(d?.day)
        if (!dayNum) continue
        const blocks: any[] = Array.isArray(d?.blocks) ? d.blocks : []
        const dayObj = (daysMap[dayNum] = daysMap[dayNum] || { day: dayNum, original: {}, diff: [], hasPreview: false })
        for (const b of blocks) {
          const blockName = b?.blockName || b?.block || 'UNKNOWN'
          if (!dayObj.original[blockName]) dayObj.original[blockName] = []
          const exercises: any[] = Array.isArray(b?.exercises) ? b.exercises : []
          for (const ex of exercises) {
            const name = ex?.name || ex?.exercise_name || ''
            if (name) dayObj.original[blockName].push(name)
          }
        }
      }
    } catch (e) {
      // fall through with empty daysMap
    }

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

