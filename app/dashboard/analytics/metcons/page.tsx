'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import MetconHeatmap from '@/components/MetconHeatmap'
import CoachDrawer from '@/components/CoachDrawer'
import PlanDiffViewer from '@/components/PlanDiffViewer'

export default function AnalyticsMetconsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initial = useMemo(() => (searchParams.get('time') || ''), [searchParams])
  const [selection, setSelection] = useState<string[]>(() => initial ? initial.split(',').filter(Boolean) : [])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<any>(null)
  const [heatmapData, setHeatmapData] = useState<any | null>(null)
  const [baselineHeatmap, setBaselineHeatmap] = useState<any | null>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [openCoach, setOpenCoach] = useState(false)
  const [coachContent, setCoachContent] = useState<React.ReactNode>(null)
  const timeDomains = ['1-5','5-10','10-15','15-20','20+']
  
  // Range filter state
  const range = (searchParams.get('range') || 'all_time').toLowerCase()
  const setRange = (r: string) => {
    const q = new URLSearchParams(searchParams as any)
    q.set('range', r)
    router.replace(`?${q.toString()}`)
  }
  const ranges = ['all_time','last_30_days','last_60_days','last_90_days']
  const sortByOrder = (arr: string[]) => {
    const order: Record<string, number> = { '1-5': 1, '5-10': 2, '10-15': 3, '15-20': 4, '20+': 5 }
    return [...arr].sort((a, b) => (order[a] || 99) - (order[b] || 99))
  }
  const toggle = (td: string) => setSelection(prev => {
    if (prev.includes(td)) return prev.filter(x => x !== td)
    if (prev.length >= 2) return sortByOrder([prev[1], td]) // keep last + new, then sort
    return sortByOrder([...prev, td])
  })

  // Sync selection to URL (?time=a,b)
  useEffect(() => {
    const params = new URLSearchParams(searchParams as any)
    if (selection.length) params.set('time', selection.join(','))
    else params.delete('time')
    router.replace(`?${params.toString()}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection])

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

  // Load legacy heatmap directly (simple, proven), with optional equipment filter
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
          setBaselineHeatmap(oldJson.data)
          const equip = (searchParams.get('equip') || '').toLowerCase()
          if (equip && (equip === 'barbell' || equip === 'gymnastics')) {
            const res2 = await fetch(`/api/analytics/${userId}/exercise-heatmap?equip=${equip}`, { headers })
            const js2 = await res2.json()
            if (res2.ok && js2.success) {
              setHeatmapData(js2.data)
              setSummary({ completions: js2.data.totalCompletedWorkouts, avg_percentile: js2.data.globalFitnessScore, time_domain_mix: [] })
            } else {
              setHeatmapData(oldJson.data)
              setSummary({ completions: oldJson.data.totalCompletedWorkouts, avg_percentile: oldJson.data.globalFitnessScore, time_domain_mix: [] })
            }
          } else {
            setHeatmapData(oldJson.data)
            setSummary({ completions: oldJson.data.totalCompletedWorkouts, avg_percentile: oldJson.data.globalFitnessScore, time_domain_mix: [] })
          }
        } else {
          throw new Error(oldJson.error || 'Failed to load')
        }
      } catch (e) {
        setSummary({ error: 'Failed to load' })
        setHeatmapData(null)
        setBaselineHeatmap(null)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [userId, searchParams])

  return (
    <div className="space-y-4">
      {/* Range filter - moved from layout to be with heat map controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 pb-3 border-b border-gray-200">
        <span className="text-xs whitespace-nowrap" style={{ color: '#282B34' }}>Time Range:</span>
        <div className="flex flex-wrap gap-2">
          {ranges.map(r => (
            <button 
              key={r} 
              onClick={() => setRange(r)} 
              className={`px-3 py-2 sm:px-2 sm:py-1 rounded border text-xs min-h-[44px] sm:min-h-0 flex items-center justify-center ${range===r ? 'border-coral' : ''}`}
              style={{ backgroundColor: '#DAE2EA', color: '#282B34', borderColor: range===r ? '#FE5858' : '#282B34' }}
            >
              {r.replace(/_/g,' ')}
            </button>
          ))}
        </div>
      </div>
      
      {/* Time Domain filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <span className="text-xs whitespace-nowrap" style={{ color: '#282B34' }}>Time Domain:</span>
        <div className="flex flex-wrap gap-2">
          {timeDomains.map(td => (
            <button 
              key={td} 
              onClick={() => toggle(td)} 
              className={`px-2 py-1 rounded border text-xs ${selection.includes(td) ? 'border-coral' : ''}`}
              style={{ backgroundColor: '#DAE2EA', color: '#282B34', borderColor: selection.includes(td) ? '#FE5858' : '#282B34' }}
            >
              {td}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs pt-3 border-t border-gray-200">
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
            const res = await fetch('/api/coach/explain', { method: 'POST', headers, body: JSON.stringify({ brief: briefJson.brief, message: msg, domain: 'metcons' }) })
            const json = await res.json().catch(() => ({ success: false }))
            setCoachContent(
              <div className="space-y-2 text-sm">
                {json?.summary && <div className="text-gray-800 font-medium">{json.summary}</div>}
                <ul className="list-disc list-inside text-gray-800">
                  {(json?.bullets || []).map((b: string, i: number) => (<li key={i}>{b}</li>))}
                </ul>
                {Array.isArray(json?.focus_next_week) && json.focus_next_week.length > 0 && (
                  <div className="pt-1">
                    <div className="text-xs text-gray-600 font-medium">Focus next week</div>
                    <ul className="list-disc list-inside text-gray-700">
                      {json.focus_next_week.map((b: string, i: number) => (<li key={i} className="text-xs">{b}</li>))}
                    </ul>
                  </div>
                )}
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
            setCoachContent(<PlanDiffViewer data={json} />)
            setOpenCoach(true)
          } catch {}
        }}>Recommend</button>
      </div>
      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <>
          {(() => {
            const equip = (searchParams.get('equip') || '').toLowerCase()
            if (equip && baselineHeatmap) {
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Filtered ({equip})</div>
                    <MetconHeatmap data={heatmapData} visibleTimeDomains={selection} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">All equipment</div>
                    <MetconHeatmap data={baselineHeatmap} visibleTimeDomains={selection} />
                  </div>
                </div>
              )
            }
            return heatmapData ? <MetconHeatmap data={heatmapData} visibleTimeDomains={selection} /> : <div className="text-sm text-gray-500">No heat map data</div>
          })()}
          {selection.length === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              {sortByOrder(selection).map((td) => {
                // compute domain summary from legacy heatmap cells
                const cells = (heatmapData?.heatmapCells || []).filter((c: any) => {
                  if (td === '20+') return c.time_range === '20:00–30:00' || c.time_range === '30:00+'
                  return c.time_range?.startsWith(td.replace('-', ':00–'))
                })
                const completions = cells.reduce((s: number, c: any) => s + (c.session_count || 0), 0)
                const avg = (() => {
                  const totalSessions = completions
                  if (!totalSessions) return null
                  const w = cells.reduce((s: number, c: any) => s + (c.avg_percentile || 0) * (c.session_count || 0), 0)
                  return Math.round((w / totalSessions) * 10) / 10
                })()
                return (
                  <div key={td} className="p-3 border rounded bg-white">
                    <div className="text-xs text-gray-500 mb-1">Time domain</div>
                    <div className="text-lg font-semibold mb-2">{td}</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-600">Completions</span><span className="font-medium">{completions}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Avg percentile</span><span className="font-medium">{avg ?? '—'}</span></div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <div className="p-3 border rounded bg-gray-50">
              <div className="text-xs text-gray-600">Completions</div>
              <div className="text-xl font-semibold">{summary?.completions ?? '—'}</div>
            </div>
            <div className="p-3 border rounded bg-gray-50">
              <div className="text-xs text-gray-600">Avg percentile</div>
              <div className="text-xl font-semibold">{summary?.avg_percentile ?? '—'}</div>
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


