import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildActionSignature, type ProposedAction } from '@/lib/ai/decision-policy'

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Map auth to users.id
    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: authData } = await supabaseAuthed.auth.getUser()
    const authId = authData?.user?.id
    if (!authId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: userRow } = await supabaseService.from('users').select('id').eq('auth_id', authId).single()
    if (!userRow?.id) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const userId = userRow.id as number

    const body = await request.json()
    const action: ProposedAction = body?.action
    const context_hash: string | undefined = body?.context_hash
    if (!action || !action.kind || !action.block || !action.objective) {
      return NextResponse.json({ error: 'Invalid action payload' }, { status: 400 })
    }

    const signature = buildActionSignature(action)
    const dedupeKey = `preview_action:${userId}:${signature}`

    // Insert job (ignore duplicate dedupe)
    const { error: insErr } = await supabaseService
      .from('ai_jobs')
      .insert({
        user_id: userId,
        job_type: 'preview_action',
        payload: { action, context_hash },
        dedupe_key: dedupeKey,
        status: 'pending'
      })

    // If unique violation, treat as success
    if (insErr && (insErr as any).code !== '23505') {
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

