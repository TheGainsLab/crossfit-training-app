import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

async function handle(req: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) return NextResponse.json({ success: false, error: 'Server not configured' }, { status: 500 })
    const supabase = createClient(supabaseUrl, serviceKey)

    // Resolve userId from Authorization header
    let userId: number | null = null
    try {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
      let token = authHeader?.replace('Bearer ', '') || ''
      if (!token) {
        // Fallback: Supabase cookie via next/headers
        try {
          const c = cookies()
          const cv = c.get('sb-access-token')?.value
          if (cv) token = cv
        } catch {}
      }
      if (token) {
        const { data: authUser } = await createClient(supabaseUrl, serviceKey).auth.getUser(token)
        const auth_id = authUser?.user?.id
        if (auth_id) {
          const { data: u } = await supabase.from('users').select('id').eq('auth_id', auth_id).single()
          if (u?.id) userId = u.id
        }
      }
    } catch {}
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    // Fast path: select brief JSON from ai_master_brief_v1
    const { data: row, error } = await supabase
      .from('ai_master_brief_v1')
      .select('brief')
      .eq('user_id', userId)
      .single()

    if (error) {
      // Fallback to an empty shell to keep the client functional
      const fallback = {
        version: 'v1',
        metadata: { userId, window: { startISO: new Date(Date.now() - 56*24*3600*1000).toISOString(), endISO: new Date().toISOString() }, units: 'Imperial (lbs)' },
        profile: { ability: 'Intermediate', goals: [], constraints: [], equipment: [] },
        intake: { skills: [], oneRMs: [], oneRMsNamed: {}, strength_ratios: {}, conditioning_benchmarks: {} },
        metcons_summary: {},
        upcoming_program: [],
        adherence: { planned_sessions: 0, completed_sessions: 0, pct: 0, by_week: [] },
        trends: { volume_by_week: [], avg_rpe_by_week: [], quality_by_week: [] },
        allowed_entities: { blocks: ['SKILLS','TECHNICAL WORK','STRENGTH AND POWER','ACCESSORIES','METCONS'], movements: [], time_domains: ['1-5','5-10','10-15','15-20','20+'], equipment: ['Barbell','Dumbbells'], levels: ['Open','Quarterfinals','Regionals','Games'] },
        citations: []
      }
      return NextResponse.json({ success: true, brief: fallback })
    }

    const brief = (row as any)?.brief || null
    return NextResponse.json({ success: true, brief })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 500 })
  }
}

export async function POST(req: Request) { return handle(req) }
export async function GET(req: Request) { return handle(req) }

