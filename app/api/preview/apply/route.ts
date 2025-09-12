import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { week, day } = await req.json()
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    const supabase = createClient(supabaseUrl, serviceKey)

    // Resolve user
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

    const { data: prog } = await supabase
      .from('programs')
      .select('id')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()
    const programId = prog?.id
    if (!programId) return NextResponse.json({ success: false, error: 'Program not found' }, { status: 404 })

    const { error } = await supabase
      .from('modified_workouts')
      .update({ is_preview: false, applied_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('program_id', programId)
      .eq('week', week)
      .eq('day', day)

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 500 })
  }
}

