'use client'

import { useEffect, useState } from 'react'
import MetconHeatmap from '@/components/MetconHeatmap'

export default function AnalyticsMetconsPage() {
  const [selection, setSelection] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<any>(null)
  const [heatmapData, setHeatmapData] = useState<any | null>(null)
  const timeDomains = ['1-5','5-10','10-15','15-20','20+']
  const toggle = (td: string) => setSelection(prev => prev.includes(td) ? prev.filter(x => x!==td) : [...prev, td])

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
        const q = new URLSearchParams()
        if (selection.length) q.set('timeDomain', selection.join(','))
        const res = await fetch(`/api/analytics/metcons?${q.toString()}`, { headers })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load metcons analytics')
        // Fallback to old heatmap if new endpoint returns nothing
        if (!json.summary && !json.heatmap) {
          const { data: { session } } = await sb.auth.getSession()
          const token2 = session?.access_token || ''
          const headers2: Record<string, string> = {}
          if (token2) headers2['Authorization'] = `Bearer ${token2}`
          const userRes = await fetch('/api/auth/get-user-id', { headers: headers2 }).catch(() => null)
          const userJson = userRes && (await userRes.json().catch(() => null))
          const userId = userJson?.userId || null
          if (userId) {
            const oldRes = await fetch(`/api/analytics/${userId}/exercise-heatmap`, { headers: headers2 })
            const oldJson = await oldRes.json()
            if (oldRes.ok && oldJson.success) {
              setHeatmapData(oldJson.data)
              setSummary({ completions: oldJson.data.totalCompletedWorkouts, avg_percentile: oldJson.data.globalFitnessScore, time_domain_mix: [] })
              return
            }
          }
        }
        setSummary(json.summary)
        setHeatmapData({
          // Normalize to MetconHeatmap component shape if possible
          exercises: [],
          timeDomains: Array.from(new Set((json.heatmap || []).map((h: any) => h.time_range))).sort(),
          heatmapCells: [],
          exerciseAverages: [],
          globalFitnessScore: json.summary?.avg_percentile || 0,
          totalCompletedWorkouts: json.summary?.completions || 0
        })
      } catch (e) {
        setSummary({ error: 'Failed to load' })
        setHeatmapData(null)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [selection])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600">Time Domain:</span>
        {timeDomains.map(td => (
          <button key={td} onClick={() => toggle(td)} className={`px-2 py-1 rounded border ${selection.includes(td) ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`}>{td}</button>
        ))}
      </div>
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
            await fetch('/api/coach/propose', { method: 'POST', headers, body: JSON.stringify({ brief: briefJson.brief, message: `Explain and recommend adjustments for metcons (time domains: ${selection.join(', ') || 'all'})` }) })
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
            await fetch('/api/coach/propose', { method: 'POST', headers, body: JSON.stringify({ brief: briefJson.brief, message: `Recommend metcon plan adjustments focusing on time domains: ${selection.join(', ') || 'all'}` }) })
          } catch {}
        }}>Recommend</button>
      </div>
      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <>
          {heatmapData ? <MetconHeatmap data={heatmapData} /> : <div className="text-sm text-gray-500">No heat map data</div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            <div className="p-3 border rounded bg-gray-50">
              <div className="text-xs text-gray-600">Completions</div>
              <div className="text-xl font-semibold">{summary?.completions ?? '—'}</div>
            </div>
            <div className="p-3 border rounded bg-gray-50">
              <div className="text-xs text-gray-600">Avg percentile</div>
              <div className="text-xl font-semibold">{summary?.avg_percentile ?? '—'}</div>
            </div>
            <div className="p-3 border rounded bg-gray-50">
              <div className="text-xs text-gray-600">Top time domains</div>
              <div className="text-sm">{(summary?.time_domain_mix || []).slice(0,3).map((t:any)=>`${t.range}:${t.count}`).join(', ') || '—'}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}


