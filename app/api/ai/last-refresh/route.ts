import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const supabaseService = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')

    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve authenticated user
    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: authData } = await supabaseAuthed.auth.getUser()
    const authId = authData?.user?.id
    if (!authId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Map to numeric users.id
    const { data: userRow, error: userErr } = await supabaseService
      .from('users')
      .select('id')
      .eq('auth_id', authId)
      .single()
    if (userErr || !userRow?.id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const userId = userRow.id as number

    // Fetch most recent context_refresh job
    const { data: jobs, error: jobsErr } = await supabaseService
      .from('ai_jobs')
      .select('id, created_at, status, job_type, payload')
      .eq('user_id', userId)
      .eq('job_type', 'context_refresh')
      .order('created_at', { ascending: false })
      .limit(1)

    if (jobsErr) {
      return NextResponse.json({ error: jobsErr.message }, { status: 500 })
    }

    const last = Array.isArray(jobs) && jobs.length > 0 ? jobs[0] as any : null
    if (!last) {
      return NextResponse.json({ lastRefreshAt: null, status: 'none', changeSummary: [] })
    }

    const changeSummary = (last.payload && last.payload.change_summary) || []
    return NextResponse.json({
      lastRefreshAt: last.created_at,
      status: last.status,
      changeSummary
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

