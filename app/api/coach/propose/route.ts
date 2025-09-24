import { NextResponse } from 'next/server'
import { isCoachingBriefV1, type PlanDiffV1 } from '@/lib/coach/schemas'

export async function POST(req: Request) {
  try {
    const { brief, message } = await req.json()
    if (!isCoachingBriefV1(brief)) {
      return NextResponse.json({ success: false, error: 'Invalid brief' }, { status: 400 })
    }
    // Read-only LLM call stub: for now return an empty diff but structure supports future integration
    const diff: PlanDiffV1 = { version: 'v1', changes: [] }
    return NextResponse.json({ success: true, diff, rationale: 'stub' })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 400 })
  }
}

