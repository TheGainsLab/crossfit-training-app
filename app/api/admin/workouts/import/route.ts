import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function isAdminEmail(email: string | null | undefined): boolean {
  const allow = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!allow.length) return true
  if (!email) return false
  return allow.includes(email)
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || (process.env.NEXT_PUBLIC_SUPABASE_URL as string)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    const sb = createClient(supabaseUrl, serviceKey)

    // Basic admin gating via bearer token -> user email check
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || ''
    if (token) {
      const { data: authUser } = await createClient(supabaseUrl, serviceKey).auth.getUser(token)
      const email = authUser?.user?.email || null
      if (!isAdminEmail(email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    } else {
      if (!isAdminEmail(null)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const workouts: any[] = Array.isArray(body?.workouts) ? body.workouts : []
    const stats: any[] = Array.isArray(body?.stats) ? body.stats : []
    const truncate = Boolean(body?.truncate)

    if (truncate) {
      await sb.from('staging.workouts').delete().neq('slug', '')
      await sb.from('staging.stats').delete().neq('workout_slug', '')
    }

    // Insert staging.workouts
    if (workouts.length) {
      const { error } = await sb.from('staging.workouts').insert(workouts)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }
    // Insert staging.stats
    if (stats.length) {
      const { error } = await sb.from('staging.stats').insert(stats)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Run importer
    const { error: ierr } = await sb.rpc('import_workouts_from_staging')
    if (ierr) return NextResponse.json({ error: ierr.message }, { status: 400 })

    return NextResponse.json({ success: true, inserted_workouts: workouts.length, inserted_stats: stats.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 400 })
  }
}

