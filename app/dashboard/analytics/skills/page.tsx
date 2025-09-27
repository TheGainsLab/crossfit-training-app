'use client'

import { useEffect, useState } from 'react'
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
                return (
                  <button
                    key={sk.name}
                    className="p-3 border rounded bg-white text-left hover:bg-gray-50"
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
                      <div className="flex justify-between"><span className="text-gray-600">Last</span><span className="font-medium">{lastDate || '—'}</span></div>
                    </div>
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
        <div className="text-sm space-y-3">
          {detailRows.length === 0 ? (
            <div className="text-gray-500">No entries for this range.</div>
          ) : (
            (() => {
              const byDate = new Map<string, any[]>()
              for (const r of detailRows) {
                const d = r.training_date
                if (!byDate.has(d)) byDate.set(d, [])
                byDate.get(d)!.push(r)
              }
              const dates = Array.from(byDate.keys()).sort((a,b)=> (a<b?1:-1))
              return (
                <div>
                  {dates.map(date => (
                    <div key={date} className="mb-2">
                      <div className="font-medium">{date}</div>
                      <ul className="list-disc list-inside">
                        {(byDate.get(date) || []).map((r, idx) => (
                          <li key={idx}>
                            {r.exercise_name} — {r.reps || ''} {r.sets || ''} {r.weight_time || ''}
                            {r.rpe !== null && r.rpe !== undefined ? ` — RPE ${r.rpe}` : ''}
                            {r.completion_quality !== null && r.completion_quality !== undefined ? ` — Q ${r.completion_quality}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )
            })()
          )}
        </div>
      </CoachDrawer>
    </div>
  )
}

