'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import CoachDrawer from '@/components/CoachDrawer'

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
          <div className="text-sm text-gray-700">Skills movements (block: SKILLS)</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...(summary?.summary || [])]
              .sort((a: any, b: any) => (b.count || 0) - (a.count || 0))
              .map((sk: any) => {
                const last = sessions.find((s: any) => s.exercise_name === sk.name)
                const lastDate = last ? new Date(last.logged_at).toLocaleDateString() : null
                return (
                  <div key={sk.name} className="p-3 border rounded bg-white">
                    <div className="font-medium text-gray-900 mb-1 text-center">{sk.name}</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-600">Sessions</span><span className="font-medium">{sk.count || 0}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Avg RPE</span><span className="font-medium">{Math.round((sk.avgRPE || 0) * 10) / 10}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Avg Quality</span><span className="font-medium">{Math.round((sk.avgQuality || 0) * 10) / 10}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Last</span><span className="font-medium">{lastDate || '—'}</span></div>
                    </div>
                  </div>
                )
              })}
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700" onClick={async () => {
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
                const res = await fetch('/api/coach/propose', { method: 'POST', headers, body: JSON.stringify({ brief: briefJson.brief, message: msg }) })
                const json = await res.json().catch(() => ({}))
                setCoachContent(
                  <div className="space-y-3 text-sm">
                    <div className="text-gray-800">Coach explanation for Skills ({range}).</div>
                    <pre className="text-xs bg-gray-50 border rounded p-2 whitespace-pre-wrap overflow-x-auto">{JSON.stringify(json, null, 2)}</pre>
                  </div>
                )
                setOpenCoach(true)
              } catch {}
            }}>Explain</button>
            <button className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700" onClick={async () => {
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
                const json = await res.json().catch(() => ({}))
                setCoachContent(
                  <div className="space-y-3 text-sm">
                    <div className="text-gray-800">Coach recommendations for Skills ({range}).</div>
                    <pre className="text-xs bg-gray-50 border rounded p-2 whitespace-pre-wrap overflow-x-auto">{JSON.stringify(json, null, 2)}</pre>
                  </div>
                )
                setOpenCoach(true)
              } catch {}
            }}>Recommend</button>
          </div>
        </>
      )}
      <CoachDrawer open={openCoach} title="Coach" onClose={() => setOpenCoach(false)}>
        {coachContent}
      </CoachDrawer>
    </div>
  )
}

