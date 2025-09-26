import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { brief, message } = await req.json()
    if (!brief) return NextResponse.json({ success: false, error: 'Invalid brief' }, { status: 400 })

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

Domain-specific guidance (choose based on context message):
- If SKILLS: focus on distinct days per skill, avg RPE/quality, recency, and next-week skills coverage vs. goals (e.g., strict pulling).
- If STRENGTH AND POWER or TECHNICAL WORK: use total sessions/volume trend (if available), top movements, avg RPE; check next-week lift/technique coverage vs. recent trend and goals.
- If ACCESSORIES: highlight support movement balance and exposure; check next-week accessory coverage for weak links.
- If METCONS: highlight completions, time-domain/equipment/level mix, avg percentile; check next-week alignment to desired time-domains/equipment/level.

Output JSON ONLY with:
{ "summary": string, "bullets": string[], "focus_next_week": string[] }
Where focus_next_week are 1–3 narrative pointers (not plan changes) that link history to the upcoming week.`;

    const userContent = `CONTEXT (include domain and range):\n${String(message || '').slice(0, 600)}\n\nCOACHING BRIEF (JSON):\n${JSON.stringify(brief).slice(0, 14000)}\n\nReturn ONLY JSON with keys: summary (string), bullets (string[]), focus_next_week (string[]).`;

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

