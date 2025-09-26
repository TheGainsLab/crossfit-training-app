import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { brief, message, domain } = await req.json()
    if (!brief) return NextResponse.json({ success: false, error: 'Invalid brief' }, { status: 400 })

    // Filter brief to domain-specific data (best-effort)
    const d = String(domain || '').toLowerCase()
    const filtered = JSON.parse(JSON.stringify(brief))
    try {
      // Upcoming program: keep only blocks for the domain
      const blockMap: Record<string, string> = {
        skills: 'SKILLS',
        strength: 'STRENGTH AND POWER',
        technical: 'TECHNICAL WORK',
        accessories: 'ACCESSORIES',
        metcons: 'METCONS'
      }
      const wantBlock = blockMap[d]
      if (wantBlock && Array.isArray(filtered?.upcomingProgram)) {
        filtered.upcomingProgram = filtered.upcomingProgram.map((day: any) => ({
          ...day,
          blocks: Array.isArray(day?.blocks) ? day.blocks.filter((b: any) => {
            const name = String(b?.block || b?.blockName || '')
            if (d === 'metcons') return name === 'METCONS'
            return name === wantBlock
          }) : []
        }))
      }
      // Remove cross-domain summaries (best-effort based on key names)
      const top = filtered || {}
      const removeIf = (key: string, patterns: string[]) => patterns.some(p => key.toLowerCase().includes(p))
      const domainKeep: Record<string, string[]> = {
        skills: ['skill'],
        strength: ['strength'],
        technical: ['technical'],
        accessories: ['accessor'],
        metcons: ['metcon']
      }
      const keepPats = domainKeep[d] || []
      Object.keys(top).forEach((k) => {
        const kl = k.toLowerCase()
        if (['profile','upcomingprogram','goals','preferences','adherence','trends'].includes(kl)) return
        // if key clearly belongs to another domain, drop it
        const otherPats = ['skill','strength','technical','accessor','metcon'].filter(p => !keepPats.includes(p))
        if (removeIf(k, otherPats)) delete top[k]
      })
    } catch {}

    const apiKey = process.env.CLAUDE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ success: true, explanation: 'No AI key configured. Insights unavailable.' })
    }

    // Domain-aware, goal-connected narrative prompt
    const system = `You are an expert CrossFit coach.

Task: Provide a concise, domain-aware narrative explanation of the athlete's current analytics view using the Coaching Brief (JSON) and the context message. Connect (1) goals/preferences and profile → (2) training done in the selected range → (3) what is scheduled in the upcoming week.

Global rules (Explain only):
- Keep it short and actionable. Output 1 sentence summary + 3–5 bullet insights.
- Each bullet should cite a concrete signal with units where possible (e.g., distinct sessions, avg RPE/quality, time-domain mix, avg percentile).
- Explicitly relate insights back to the athlete's goals/preferences from the brief.
- Reference next week's plan (upcoming 7 uncompleted days in the brief): highlight 1–2 opportunities or risks (coverage vs goals, overloads, missing skills).
- Do NOT propose specific plan changes; no Plan Diff here.
- Use ONLY numbers explicitly present in the JSON brief. Do NOT estimate, extrapolate, or invent values.
- 1RM mentions: only cite lifts that exist in intake.oneRMsNamed and their exact values. If a value is 0 or missing, do not mention it.
- Ratios: only cite intake.strength_ratios{value/target/flag}; if absent, avoid numeric claims.
- Weekly/session counts: only cite counts that are explicit for this domain (e.g., distinct_days_in_range for SKILLS, or domain-specific per-week sessions if provided). Do NOT turn generic "volume" into a session count.

Domain-specific guidance (choose based on CONTEXT):
- If SKILLS: ONLY reference SKILLS block movements from the brief. Focus on distinct days per skill, avg RPE/quality, recency, and next-week SKILLS coverage vs. goals (e.g., strict pulling). Do NOT mention movements that appear only under TECHNICAL WORK or ACCESSORIES.
- If STRENGTH AND POWER: ONLY reference STRENGTH AND POWER block movements; discuss sessions/volume trend (if available), top lifts, avg RPE; check next-week coverage vs. goals.
- If TECHNICAL WORK: ONLY reference TECHNICAL WORK movements; emphasize technique exposures and recency; check next-week coverage.
- If ACCESSORIES: ONLY reference ACCESSORIES; highlight balance and exposures; check next-week coverage.
- If METCONS: ONLY reference metcon data; highlight completions, time-domain/equipment/level mix, avg percentile; check next-week alignment.

Output JSON ONLY with:
{ "summary": string, "bullets": string[], "focus_next_week": string[] }
Where focus_next_week are 1–3 narrative pointers (not plan changes) that link history to the upcoming week.`;

    const userContent = `CONTEXT (must include domain and range; limit insights to that domain ONLY):\n${String(message || '').slice(0, 600)}\n\nCOACHING BRIEF (JSON, domain-filtered):\n${JSON.stringify(filtered).slice(0, 14000)}\n\nReturn ONLY JSON with keys: summary (string), bullets (string[]), focus_next_week (string[]).`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_COACH_MODEL || 'claude-3-5-haiku-20241022',
        max_tokens: 600,
        temperature: 0.2,
        system,
        messages: [ { role: 'user', content: userContent } ]
      })
    })

    if (!res.ok) {
      return NextResponse.json({ success: true, summary: '', bullets: [], rationale: `llm_error_${res.status}` })
    }
    const data = await res.json()
    const raw = data?.content?.[0]?.text || ''
    const clean = raw.replace(/```json\n?|```/g, '').trim()
    let parsed: any
    try { parsed = JSON.parse(clean) } catch { parsed = { summary: clean, bullets: [], focus_next_week: [] } }
    const summary: string = typeof parsed?.summary === 'string' ? parsed.summary : ''
    const bullets: string[] = Array.isArray(parsed?.bullets) ? parsed.bullets.filter((b: any) => typeof b === 'string') : []
    const focus_next_week: string[] = Array.isArray(parsed?.focus_next_week) ? parsed.focus_next_week.filter((b: any) => typeof b === 'string') : []
    return NextResponse.json({ success: true, summary, bullets, focus_next_week })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 400 })
  }
}

