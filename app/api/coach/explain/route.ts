import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { brief, message } = await req.json()
    if (!brief) return NextResponse.json({ success: false, error: 'Invalid brief' }, { status: 400 })

    const apiKey = process.env.CLAUDE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ success: true, explanation: 'No AI key configured. Insights unavailable.' })
    }

    const system = `You are an expert CrossFit coach. Provide a concise narrative explanation of the athlete's current analytics view using the provided Coaching Brief (JSON) and context message.

Rules:
- Keep it short and actionable (3–5 bullets max), plain language.
- Reference concrete signals from the brief (e.g., volume trends, RPE, block mix, metcon percentile) if relevant.
- Do NOT propose specific plan changes here. This is explanation only.
- Output JSON ONLY with the following shape:
  { "summary": string, "bullets": string[] }
`;

    const userContent = `CONTEXT:\n${String(message || '').slice(0, 600)}\n\nCOACHING BRIEF (JSON):\n${JSON.stringify(brief).slice(0, 14000)}\n\nReturn ONLY JSON with keys: summary (string) and bullets (string[]).`;

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
    try { parsed = JSON.parse(clean) } catch { parsed = { summary: clean, bullets: [] } }
    const summary: string = typeof parsed?.summary === 'string' ? parsed.summary : ''
    const bullets: string[] = Array.isArray(parsed?.bullets) ? parsed.bullets.filter((b: any) => typeof b === 'string') : []
    return NextResponse.json({ success: true, summary, bullets })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 400 })
  }
}

