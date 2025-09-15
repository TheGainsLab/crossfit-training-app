import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'

// Service client for writes
const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
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

    // Rate-limit: 1 per 24h for user-forced context refresh
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentJobs, error: jobsErr } = await supabaseService
      .from('ai_jobs')
      .select('id, created_at, job_type, payload')
      .eq('user_id', userId)
      .eq('job_type', 'context_refresh')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })

    if (!jobsErr && Array.isArray(recentJobs)) {
      const forced = recentJobs.find(j => {
        try {
          const reason = (j as any)?.payload?.reason
          return reason && reason.user_forced === true
        } catch { return false }
      }) as any
      if (forced) {
        const next = new Date(new Date(forced.created_at).getTime() + 24 * 60 * 60 * 1000)
        return NextResponse.json({ error: 'Rate limit exceeded', nextAvailableAt: next.toISOString() }, { status: 429 })
      }
    }

    // Mark pending and enqueue job
    await supabaseService
      .from('users')
      .update({ program_generation_pending: true, updated_at: new Date().toISOString() })
      .eq('id', userId)

    const ymdd = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const dedupeKey = `context_refresh:forced:${userId}:${ymdd}`
    const { error: insErr } = await supabaseService
      .from('ai_jobs')
      .insert({
        user_id: userId,
        job_type: 'context_refresh',
        payload: { reason: { user_forced: true } },
        dedupe_key: dedupeKey,
        status: 'pending'
      })

    if (insErr && (insErr as any).code !== '23505') {
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    try {
      revalidateTag(`global-analytics:${userId}`)
      revalidateTag(`skills-analytics:${userId}`)
      revalidateTag(`strength-analytics:${userId}`)
      revalidateTag(`metcons-analytics:${userId}`)
    } catch {}

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

