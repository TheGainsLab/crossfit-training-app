'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import CoachDrawer from '@/components/CoachDrawer'
import PlanDiffViewer from '@/components/PlanDiffViewer'

export default function AnalyticsAccessoriesPage() {
  const searchParams = useSearchParams()
  const range = searchParams.get('range') || 'all_time'
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<any>(null)
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
        const qs = new URLSearchParams()
        qs.set('range', range)
        qs.set('block', 'ACCESSORIES')
        const res = await fetch(`/api/analytics/strength?${qs.toString()}`, { headers })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load accessories analytics')
        setSummary(json.summary)
      } catch (e) {
        setSummary({ error: 'Failed to load' })
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [range])

  const getQualityGrade = (quality: number | string | null | undefined): string => {
    const num = Number(quality)
    if (isNaN(num)) return quality?.toString() || ''
    if (num >= 3.01 && num <= 4) return 'A'
    if (num >= 2.01 && num <= 3) return 'B'
    if (num >= 1.01 && num <= 2) return 'C'
    if (num <= 1.0) return 'D'
    return quality?.toString() || ''
  }

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
            const res = await fetch('/api/coach/explain', { method: 'POST', headers, body: JSON.stringify({ brief: briefJson.brief, message: `Explain accessories for range=${range} (block=ACCESSORIES).`, domain: 'accessories' }) })
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
        }}>EXPL<span style={{ color: '#FE5858' }}>AI</span>N</button>
      </div>
      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(summary?.movements || []).map((m: any) => (
              <button
                key={m.exercise_name}
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
                    qs.set('exercise', m.exercise_name)
                    qs.set('block', summary?.block || 'ACCESSORIES')
                    qs.set('range', range)
                    const res = await fetch(`/api/analytics/strength/detail?${qs.toString()}`, { headers })
                    const json = await res.json()
                    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load detail')
                    setDetailTitle(m.exercise_name)
                    setDetailRows(json.rows || [])
                    setDetailOpen(true)
                  } catch {}
                }}
              >
                <div className="font-medium text-gray-900 mb-1 text-center">{m.exercise_name} ({m.session_count})</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Avg RPE</span><span className="font-medium">{m.avg_rpe ?? '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Max weight</span><span className="font-medium">{m.max_weight || 0} lbs</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Avg top-set</span><span className="font-medium">{m.avg_top_set_weight || 0} lbs</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Total reps</span><span className="font-medium">{m.total_reps || 0}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Total volume</span><span className="font-medium">{m.total_volume?.toLocaleString?.() || 0}</span></div>
                </div>
                {m.last_session && (
                  <div className="mt-2 text-xs text-gray-600">Last: {new Date(m.last_session.logged_at).toLocaleDateString()} — {m.last_session.weight || 0} lbs × {m.last_session.reps || 0}</div>
                )}
              </button>
            ))}
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
                    <th className="p-2 border-b text-center">Sets</th>
                    <th className="p-2 border-b text-center">Reps</th>
                    <th className="p-2 border-b text-center">Wt/Time</th>
                    <th className="p-2 border-b text-center">RPE</th>
                    <th className="p-2 border-b text-center">Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {[...detailRows]
                    .sort((a: any, b: any) => (a.training_date < b.training_date ? 1 : -1))
                    .map((r: any, i: number) => (
                      <tr key={i} className="odd:bg-white even:bg-gray-50">
                        <td className="p-2 border-b whitespace-nowrap">{r.training_date}</td>
                        <td className="p-2 border-b">{r.exercise_name}</td>
                        <td className="p-2 border-b text-center">{r.sets ?? ''}</td>
                        <td className="p-2 border-b text-center">{r.reps ?? ''}</td>
                        <td className="p-2 border-b text-center">{r.weight_time ?? ''}</td>
                        <td className="p-2 border-b text-center">{r.rpe ?? ''}</td>
                        <td className="p-2 border-b text-center">{getQualityGrade(r.completion_quality)}</td>
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

