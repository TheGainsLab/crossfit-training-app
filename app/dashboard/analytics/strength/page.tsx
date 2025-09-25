'use client'

import { useEffect, useState } from 'react'

export default function AnalyticsStrengthPage() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const sb = createClient()
        const { data: { session } } = await sb.auth.getSession()
        const token = session?.access_token || ''
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`
        const res = await fetch('/api/analytics/strength', { headers })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load strength analytics')
        setSummary(json.summary)
      } catch (e) {
        setSummary({ error: 'Failed to load' })
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs">
        <button className="px-2 py-1 rounded border bg-gray-50 hover:bg-gray-100" onClick={async () => {
          try {
            const { createClient } = await import('@/lib/supabase/client')
            const sb = createClient()
            const { data: { session } } = await sb.auth.getSession()
            const token = session?.access_token || ''
            const headers: Record<string, string> = { 'Content-Type': 'application/json' }
            if (token) headers['Authorization'] = `Bearer ${token}`
            const coachBriefRes = await fetch('/api/coach/brief', { method: 'POST', headers, body: JSON.stringify({}) })
            const briefJson = await coachBriefRes.json()
            if (!coachBriefRes.ok || !briefJson.success) throw new Error('Failed to load brief')
            await fetch('/api/coach/propose', { method: 'POST', headers, body: JSON.stringify({ brief: briefJson.brief, message: 'Explain strength patterns and recommend safe adjustments.' }) })
          } catch {}
        }}>Explain</button>
        <button className="px-2 py-1 rounded border bg-gray-50 hover:bg-gray-100" onClick={async () => {
          try {
            const { createClient } = await import('@/lib/supabase/client')
            const sb = createClient()
            const { data: { session } } = await sb.auth.getSession()
            const token = session?.access_token || ''
            const headers: Record<string, string> = { 'Content-Type': 'application/json' }
            if (token) headers['Authorization'] = `Bearer ${token}`
            const coachBriefRes = await fetch('/api/coach/brief', { method: 'POST', headers, body: JSON.stringify({}) })
            const briefJson = await coachBriefRes.json()
            if (!coachBriefRes.ok || !briefJson.success) throw new Error('Failed to load brief')
            await fetch('/api/coach/propose', { method: 'POST', headers, body: JSON.stringify({ brief: briefJson.brief, message: 'Propose incremental strength changes (sets/reps) without moving blocks.' }) })
          } catch {}
        }}>Recommend</button>
      </div>
      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <>
          <div className="text-sm text-gray-700">Top movements (by entries)</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 border rounded bg-gray-50">
              <div className="text-xs text-gray-600 mb-1">Movement frequency</div>
              <ul className="text-sm list-disc list-inside">
                {(summary?.movements || []).slice(0, 10).map((m: any) => (
                  <li key={m.exercise_name}>{m.exercise_name} — {m.count}</li>
                ))}
              </ul>
            </div>
            <div className="p-3 border rounded bg-gray-50">
              <div className="text-xs text-gray-600 mb-1">Avg RPE by movement</div>
              <ul className="text-sm list-disc list-inside">
                {(summary?.movements || []).slice(0, 10).map((m: any) => (
                  <li key={m.exercise_name}>{m.exercise_name} — {m.avg_rpe ?? '—'}</li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  )
}


