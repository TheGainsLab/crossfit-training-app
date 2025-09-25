'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function AnalyticsTechnicalPage() {
  const searchParams = useSearchParams()
  const range = searchParams.get('range') || 'last_30_days'
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
        const qs = new URLSearchParams()
        qs.set('range', range)
        qs.set('block', 'TECHNICAL WORK')
        const res = await fetch(`/api/analytics/strength?${qs.toString()}`, { headers })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load technical work analytics')
        setSummary(json.summary)
      } catch (e) {
        setSummary({ error: 'Failed to load' })
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [range])

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
            await fetch('/api/coach/propose', { method: 'POST', headers, body: JSON.stringify({ brief: briefJson.brief, message: 'Explain technical work patterns and recommend adjustments.' }) })
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
            await fetch('/api/coach/propose', { method: 'POST', headers, body: JSON.stringify({ brief: briefJson.brief, message: 'Propose technical work changes (sets/reps) without moving blocks.' }) })
          } catch {}
        }}>Recommend</button>
      </div>
      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <>
          <div className="text-sm text-gray-700">Technical Work movements (block: {summary?.block || 'TECHNICAL WORK'})</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(summary?.movements || []).map((m: any) => (
              <div key={m.exercise_name} className="p-3 border rounded bg-white">
                <div className="font-medium text-gray-900 mb-1">{m.exercise_name}</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Sessions</span><span className="font-medium">{m.session_count}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Avg RPE</span><span className="font-medium">{m.avg_rpe ?? '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Max weight</span><span className="font-medium">{m.max_weight || 0} lbs</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Avg top-set</span><span className="font-medium">{m.avg_top_set_weight || 0} lbs</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Total reps</span><span className="font-medium">{m.total_reps || 0}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Total volume</span><span className="font-medium">{m.total_volume?.toLocaleString?.() || 0}</span></div>
                </div>
                {m.last_session && (
                  <div className="mt-2 text-xs text-gray-600">Last: {new Date(m.last_session.logged_at).toLocaleDateString()} — {m.last_session.weight || 0} lbs × {m.last_session.reps || 0}</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

