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
    const system = `You are an expert CrossFit coach. You will receive a compact Coaching Brief (JSON) summarizing the athlete's profile, recent training, metcons, and upcoming plan.\n\nGoal: Propose at most 8 precise program edits as a Plan Diff (v1).\n\nHARD RULES (must follow):\n- Output JSON ONLY. NO prose, NO code fences.\n- Output MUST match Plan Diff v1: { "+version+": "v1", "changes": [ ... ] }\n- Allowed ops ONLY: replace_exercise, add_exercise_in_block, remove_exercise_in_block, adjust_exercise_prescription, swap_metcon.\n- Same day & same block only; do NOT add/remove blocks; do NOT move exercises across blocks; do NOT move sessions.\n- Time scope: Only target the CURRENT program week (from upcoming program in the brief). NEVER target week 1.\n- Rest: do NOT set rest_sec. Leave rest decisions to the user.\n- Intensity: do NOT set percent_1rm. If intensity is needed, specify actual weight using the 'weightTime' field (lbs).\n- STRENGTH AND POWER: at most TWO different lifts per day. Adding a strength exercise creates a new subOrder in the same block.\n- SKILLS: at most THREE skills per day.\n- ACCESSORIES: at most THREE accessories per day.\n- METCONS: do NOT edit tasks/sets/reps; only swap_metcon (time_domain/equipment/level).\n- Enforce enums & ranges: blocks, time domains, level; sets 1-10; reps 1-30 (or array); RPE<=9 for volume work.\n- Weekly volume ramp limit: keep proposals modest; avoid >20% increases.\n- Cite rationale briefly in each change.\n- Max 8 changes total.\n\n`;

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

    // Deterministic post-filtering to enforce business rules
    try {
      const briefObj = brief as any
      // Determine current week from upcoming program (first uncompleted day)
      const firstUpcoming = Array.isArray(briefObj?.upcomingProgram) ? briefObj.upcomingProgram[0] : null
      const currentWeek: number | null = firstUpcoming?.week ?? null

      const filtered = (diff.changes || []).filter((c: any) => {
        const blk = String(c?.target?.block || '')
        const week = Number(c?.target?.week ?? currentWeek ?? 0)
        // time scope
        if (!currentWeek || week !== currentWeek || week === 1) return false
        return true
      }).map((c: any) => {
        // Strip disallowed fields
        if (c.rest_sec) delete c.rest_sec
        if (c.intensity?.percent_1rm) delete c.intensity.percent_1rm
        if (c.new) {
          if (c.new.rest_sec) delete c.new.rest_sec
          if (c.new.intensity?.percent_1rm) delete c.new.intensity.percent_1rm
        }
        return c
      })

      // Per-day block caps using upcoming program as baseline
      const byDayBlockCounts: Record<string, { skills: number; accessories: number; strengthDistinct: Set<string> }> = {}
      const initCountsFor = (week: number, day: number) => {
        const key = `${week}-${day}`
        if (byDayBlockCounts[key]) return byDayBlockCounts[key]
        const dayData = (briefObj?.upcomingProgram || []).find((d: any) => d.week === week && d.day === day)
        const counts = { skills: 0, accessories: 0, strengthDistinct: new Set<string>() }
        if (dayData?.blocks) {
          for (const b of dayData.blocks) {
            const blockName = String(b.block || b.blockName || '')
            if (blockName === 'SKILLS') counts.skills = (b.exercises || []).length
            if (blockName === 'ACCESSORIES') counts.accessories = (b.exercises || []).length
            if (blockName === 'STRENGTH AND POWER') {
              for (const ex of (b.exercises || [])) counts.strengthDistinct.add(String(ex.name || ''))
            }
          }
        }
        byDayBlockCounts[key] = counts
        return counts
      }

      const enforced: PlanDiffV1['changes'] = []
      for (const c of filtered) {
        const week = c?.target?.week ?? currentWeek
        const day = c?.target?.day
        const block = String(c?.target?.block || '')
        if (!week || !day) continue
        const counts = initCountsFor(week, day)
        if (block === 'SKILLS' && c.type === 'add_exercise_in_block') {
          if (counts.skills >= 3) continue
          counts.skills += 1
        }
        if (block === 'ACCESSORIES' && c.type === 'add_exercise_in_block') {
          if (counts.accessories >= 3) continue
          counts.accessories += 1
        }
        if (block === 'STRENGTH AND POWER' && c.type === 'add_exercise_in_block') {
          const name = String(c?.new?.name || '')
          const distinct = counts.strengthDistinct
          if (!name) continue
          const baseCount = distinct.size
          if (!distinct.has(name) && baseCount >= 2) continue
          distinct.add(name)
        }
        enforced.push(c)
      }

      diff.changes = enforced
    } catch {}

    return NextResponse.json({ success: true, diff })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 400 })
  }
}

