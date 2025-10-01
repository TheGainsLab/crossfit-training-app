'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import CoachDrawer from '@/components/CoachDrawer'
import PlanDiffViewer from '@/components/PlanDiffViewer'

export default function AnalyticsSkillsPage() {
  const searchParams = useSearchParams()
  const range = searchParams.get('range') || 'all_time'
  const daysMap: Record<string, number> = {
    all_time: 3650,
    last_30_days: 30,
    last_60_days: 60,
    last_90_days: 90
  }
  const days = daysMap[range] || 30
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [openCoach, setOpenCoach] = useState(false)
  const [coachContent, setCoachContent] = useState<React.ReactNode>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTitle, setDetailTitle] = useState<string>('')
  const [detailRows, setDetailRows] = useState<any[]>([])

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

        const [sumRes, detRes] = await Promise.all([
          fetch(`/api/analytics/skills?mode=summary&days=${days}`, { headers }),
          fetch(`/api/analytics/skills?mode=detail&days=${days}`, { headers })
        ])
        const sumJson = await sumRes.json()
        const detJson = await detRes.json()
        if (!sumRes.ok || !sumJson.success) throw new Error(sumJson.error || 'Failed to load skills summary')
        if (!detRes.ok || !detJson.success) throw new Error(detJson.error || 'Failed to load skills detail')
        setSummary(sumJson.data)
        setSessions(detJson.data.sessions || [])
      } catch (e) {
        setSummary({ summary: [] })
        setSessions([])
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [days])

  const metricsBySkill = useMemo(() => {
    const map: Record<string, { totalReps: number; last?: any }> = {}
    for (const row of sessions) {
      const name = (row as any)?.exercise_name || 'Unknown'
      if (!map[name]) map[name] = { totalReps: 0 }
      const repsNum = Number((row as any)?.reps) || 0
      map[name].totalReps += repsNum
      const ts = (row as any)?.logged_at ? Date.parse((row as any).logged_at) : 0
      const lastTs = map[name].last?.logged_at ? Date.parse(map[name].last.logged_at) : 0
      if (ts && ts > lastTs) map[name].last = row
    }
    return map
  }, [sessions])

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs mb-2">
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
                const msg = `Explain skills for range=${range} (block=SKILLS).`
                const res = await fetch('/api/coach/explain', { method: 'POST', headers, body: JSON.stringify({ brief: briefJson.brief, message: msg, domain: 'skills' }) })
                const json = await res.json().catch(() => ({ success: false }))
                setCoachContent(
                  <div className="space-y-2 text-sm">
                    {json?.summary && <div className="text-gray-800 font-medium">{json.summary}</div>}
                    <ul className="list-disc list-inside text-gray-800">
                      {(json?.bullets || []).map((b: string, i: number) => (<li key={i}>{b}</li>))}
                    </ul>
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
                const msg = `Recommend skill plan tweaks for range=${range} (block=SKILLS).`
                const res = await fetch('/api/coach/propose', { method: 'POST', headers, body: JSON.stringify({ brief: briefJson.brief, message: msg }) })
                const json = await res.json().catch(() => ({ success: false, diff: { version: 'v1', changes: [] } }))
                setCoachContent(
                  <div className="space-y-2 text-sm">
                    {json?.rationale && (
                      <div className="px-2 py-1 rounded border bg-yellow-50 text-yellow-800 text-xs">{json.rationale === 'no_upcoming_days_or_week1' ? 'No uncompleted days in current week (or week 1).' : json.rationale === 'guardrail_filtered' ? 'All proposals were filtered by safety caps.' : json.rationale === 'model_empty' ? 'No changes suggested by the model.' : json.rationale}</div>
                    )}
                    <PlanDiffViewer data={json} />
                  </div>
                )
                setOpenCoach(true)
              } catch {}
            }}>Recommend</button>
          </div>
          <div className="text-sm text-gray-700">Skills movements (block: SKILLS)</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...(summary?.summary || [])]
              .sort((a: any, b: any) => (b.count || 0) - (a.count || 0))
              .map((sk: any) => {
                const lastDate = sk.lastDate ? new Date(sk.lastDate).toLocaleDateString() : null
                const metrics = metricsBySkill[sk.name] || { totalReps: 0 }
                return (
                  <button
                    key={sk.name}
                    className="p-3 border rounded bg-slate-blue text-left hover:opacity-90"
                    onClick={async () => {
                      try {
                        const { createClient } = await import('@/lib/supabase/client')
                        const sb = createClient()
                        const { data: { session } } = await sb.auth.getSession()
                        const token = session?.access_token || ''
                        const headers: Record<string, string> = {}
                        if (token) headers['Authorization'] = `Bearer ${token}`
                        const qs = new URLSearchParams()
                        qs.set('exercise', sk.name)
                        qs.set('block', 'SKILLS')
                        qs.set('range', range)
                        const res = await fetch(`/api/analytics/strength/detail?${qs.toString()}`, { headers })
                        const json = await res.json()
                        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load detail')
                        setDetailTitle(sk.name)
                        setDetailRows(json.rows || [])
                        setDetailOpen(true)
                      } catch {}
                    }}
                  >
                    <div className="font-medium text-gray-900 mb-1 text-center">{sk.name}</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-600">Sessions</span><span className="font-medium">{sk.count || 0}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Avg RPE</span><span className="font-medium">{Math.round((sk.avgRPE || 0) * 10) / 10}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Avg Quality</span><span className="font-medium">{Math.round((sk.avgQuality || 0) * 10) / 10}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Total reps</span><span className="font-medium">{metrics.totalReps || 0}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Last</span><span className="font-medium">{lastDate || '—'}</span></div>
                    </div>
                    {metrics.last && (
                      <div className="mt-2 text-xs text-gray-600">Last: {new Date(metrics.last.logged_at).toLocaleDateString()} — {(metrics.last.sets || 0)} × {(metrics.last.reps || 0)}</div>
                    )}
                  </button>
                )
              })}
          </div>
          
        </>
      )}
      <CoachDrawer open={openCoach} title="Coach" onClose={() => setOpenCoach(false)}>
        {coachContent}
      </CoachDrawer>
      <CoachDrawer open={detailOpen} title={`Session history: ${detailTitle}`} onClose={() => setDetailOpen(false)}>
        <div className="text-sm">
          {detailRows.length === 0 ? (
            <div className="text-gray-500">No entries for this range.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="p-2 border-b">Date</th>
                    <th className="p-2 border-b">Exercise</th>
                    <th className="p-2 border-b">Sets</th>
                    <th className="p-2 border-b">Reps</th>
                    <th className="p-2 border-b">Weight/Time</th>
                    <th className="p-2 border-b">RPE</th>
                    <th className="p-2 border-b">Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {[...detailRows]
                    .sort((a: any, b: any) => (a.training_date < b.training_date ? 1 : -1))
                    .map((r: any, i: number) => (
                      <tr key={i} className="odd:bg-white even:bg-gray-50">
                        <td className="p-2 border-b whitespace-nowrap">{r.training_date}</td>
                        <td className="p-2 border-b">{r.exercise_name}</td>
                        <td className="p-2 border-b">{r.sets ?? ''}</td>
                        <td className="p-2 border-b">{r.reps ?? ''}</td>
                        <td className="p-2 border-b">{r.weight_time ?? ''}</td>
                        <td className="p-2 border-b">{r.rpe ?? ''}</td>
                        <td className="p-2 border-b">{r.completion_quality ?? ''}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CoachDrawer>
    </div>
  )
}

