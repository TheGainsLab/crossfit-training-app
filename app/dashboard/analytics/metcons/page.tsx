'use client'

import React, { useEffect, useState } from 'react'
import MetconHeatmap from '@/components/MetconHeatmap'
import CoachDrawer from '@/components/CoachDrawer'

export default function AnalyticsMetconsPage() {
  const [selection, setSelection] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<any>(null)
  const [heatmapData, setHeatmapData] = useState<any | null>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [openCoach, setOpenCoach] = useState(false)
  const [coachContent, setCoachContent] = useState<React.ReactNode>(null)
  const timeDomains = ['1-5','5-10','10-15','15-20','20+']
  const toggle = (td: string) => setSelection(prev => prev.includes(td) ? prev.filter(x => x!==td) : [...prev, td])

  // Resolve internal userId once
  useEffect(() => {
    const resolveUser = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const sb = createClient()
        const { data: { user } } = await sb.auth.getUser()
        if (!user) return
        const { data, error } = await sb.from('users').select('id').eq('auth_id', user.id).single()
        if (!error && data?.id) setUserId(data.id)
      } catch {}
    }
    resolveUser()
  }, [])

  // Load legacy heatmap directly (simple, proven), filters later
  useEffect(() => {
    const run = async () => {
      if (!userId) return
      setLoading(true)
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const sb = createClient()
        const { data: { session } } = await sb.auth.getSession()
        const token = session?.access_token || ''
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`
        const oldRes = await fetch(`/api/analytics/${userId}/exercise-heatmap`, { headers })
        const oldJson = await oldRes.json()
        if (oldRes.ok && oldJson.success) {
          setHeatmapData(oldJson.data)
          setSummary({ completions: oldJson.data.totalCompletedWorkouts, avg_percentile: oldJson.data.globalFitnessScore, time_domain_mix: [] })
        } else {
          throw new Error(oldJson.error || 'Failed to load')
        }
      } catch (e) {
        setSummary({ error: 'Failed to load' })
        setHeatmapData(null)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [userId])

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
            const msg = `Explain metcons for current filters: timeDomains=${selection.join(',') || 'all'}.`
            const res = await fetch('/api/coach/propose', { method: 'POST', headers, body: JSON.stringify({ brief: briefJson.brief, message: msg }) })
            const json = await res.json().catch(() => ({}))
            setCoachContent(
              <div className="space-y-3 text-sm">
                <div className="text-gray-800">Coach explanation for Metcons.</div>
                <pre className="text-xs bg-gray-50 border rounded p-2 whitespace-pre-wrap overflow-x-auto">{JSON.stringify(json, null, 2)}</pre>
              </div>
            )
            setOpenCoach(true)
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
            const msg = `Recommend metcon plan tweaks for current filters: timeDomains=${selection.join(',') || 'all'}.`
            const res = await fetch('/api/coach/propose', { method: 'POST', headers, body: JSON.stringify({ brief: briefJson.brief, message: msg }) })
            const json = await res.json().catch(() => ({}))
            setCoachContent(
              <div className="space-y-3 text-sm">
                <div className="text-gray-800">Coach recommendations for Metcons.</div>
                <pre className="text-xs bg-gray-50 border rounded p-2 whitespace-pre-wrap overflow-x-auto">{JSON.stringify(json, null, 2)}</pre>
              </div>
            )
            setOpenCoach(true)
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
      <CoachDrawer open={openCoach} title="Coach" onClose={() => setOpenCoach(false)}>
        {coachContent}
      </CoachDrawer>
    </div>
  )
}


