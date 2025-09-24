import { NextResponse } from 'next/server'
import { isCoachingBriefV1, isPlanDiffV1, type PlanDiffV1 } from '@/lib/coach/schemas'

export async function POST(req: Request) {
  try {
    const { brief, message } = await req.json()
    if (!isCoachingBriefV1(brief)) {
      return NextResponse.json({ success: false, error: 'Invalid brief' }, { status: 400 })
    }
    const apiKey = process.env.CLAUDE_API_KEY
    if (!apiKey) {
      // If no key configured, return empty diff gracefully
      const empty: PlanDiffV1 = { version: 'v1', changes: [] }
      return NextResponse.json({ success: true, diff: empty, rationale: 'no_api_key' })
    }

    // Build strict prompt
    const system = `You are an expert CrossFit coach. You will receive a compact Coaching Brief (JSON) summarizing the athlete's profile, recent training, metcons, and upcoming plan.\n\nGoal: Propose at most 8 precise program edits as a Plan Diff (v1).\n\nHARD RULES (must follow):\n- Output JSON ONLY. NO prose, NO code fences.\n- Output MUST match Plan Diff v1: { "+version+": "v1", "changes": [ ... ] }\n- Allowed ops ONLY: replace_exercise, add_exercise_in_block, remove_exercise_in_block, adjust_exercise_prescription, swap_metcon.\n- Same day & same block only; do NOT add/remove blocks; do NOT move exercises across blocks; do NOT move sessions.\n- STRENGTH AND POWER: one lift per sub-instance. Adding a strength exercise creates a new subOrder in the same block.\n- METCONS: do NOT edit tasks/sets/reps; only swap_metcon (time_domain/equipment/level).\n- Enforce enums & ranges: blocks, time domains, level; sets 1-10; reps 1-30 (or array); rest 30-300s; RPE<=9 (volume); percent_1rm<=0.9.\n- Weekly volume ramp limit: keep your proposals modest; avoid exceeding roughly 10-20% increase.\n- Cite rationale briefly in each change.\n- Max 8 changes total.\n\n`;

    const planSchemaHint = `Plan Diff v1 example (shape only):\n{\n  "version": "v1",\n  "changes": [\n    {"type":"replace_exercise","target":{"week":3,"day":2,"block":"TECHNICAL WORK","index":0},"old_name":"Hang Power Clean","new_name":"Clean Pull","rationale":"reduce technical fatigue"},\n    {"type":"add_exercise_in_block","target":{"week":3,"day":1,"block":"SKILLS"},"new":{"name":"Strict Pull-up","sets":4,"reps":6,"rest_sec":90,"intensity":{"rpe":7}},"rationale":"pulling focus"},\n    {"type":"adjust_exercise_prescription","target":{"week":2,"day":4,"block":"STRENGTH AND POWER","name":"Back Squat"},"sets":5,"reps":3,"intensity":{"percent_1rm":0.8},"rest_sec":120,"rationale":"moderate strength emphasis"},\n    {"type":"swap_metcon","target":{"week":2,"day":5,"block":"METCONS"},"select":{"time_domain":"10-15","equipment":["Barbell"],"level":"Open"},"rationale":"align with equipment and aerobic focus"}\n  ]\n}`;

    const userContent = `USER REQUEST:\n${String(message || '').slice(0, 600)}\n\nCOACHING BRIEF (JSON):\n${JSON.stringify(brief).slice(0, 14000)}\n\nReturn ONLY valid Plan Diff v1 JSON.`

    // Call Claude (Messages API)
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_COACH_MODEL || 'claude-3-5-haiku-20241022',
        max_tokens: 1200,
        temperature: 0.2,
        system,
        messages: [
          { role: 'user', content: planSchemaHint + '\n\n' + userContent }
        ]
      })
    })

    if (!res.ok) {
      const empty: PlanDiffV1 = { version: 'v1', changes: [] }
      return NextResponse.json({ success: true, diff: empty, rationale: `llm_error_${res.status}` })
    }
    const data = await res.json()
    const raw = data?.content?.[0]?.text || ''
    // Strip fences if present
    const clean = raw.replace(/```json\n?|```/g, '').trim()
    let parsed: any
    try {
      parsed = JSON.parse(clean)
    } catch {
      const empty: PlanDiffV1 = { version: 'v1', changes: [] }
      return NextResponse.json({ success: true, diff: empty, rationale: 'parse_error' })
    }

    // Basic schema guard
    const diff: PlanDiffV1 = isPlanDiffV1(parsed) ? parsed : { version: 'v1', changes: [] }
    // Limit size
    if (Array.isArray(diff.changes) && diff.changes.length > 8) {
      diff.changes = diff.changes.slice(0, 8)
    }

    return NextResponse.json({ success: true, diff })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 400 })
  }
}

