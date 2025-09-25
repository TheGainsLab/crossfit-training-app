'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function AnalyticsSkillsPage() {
  const searchParams = useSearchParams()
  const range = searchParams.get('range') || 'last_30_days'
  const daysMap: Record<string, number> = {
    last_30_days: 30,
    last_60_days: 60,
    last_90_days: 90,
    all_time: 3650
  }
  const days = daysMap[range] || 30
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 border rounded bg-white">
              <div className="text-xs text-gray-600">Skills practiced</div>
              <div className="text-2xl font-semibold">{(summary?.summary || []).length}</div>
            </div>
            <div className="p-3 border rounded bg-white">
              <div className="text-xs text-gray-600">Total sessions</div>
              <div className="text-2xl font-semibold">{sessions.length}</div>
            </div>
            <div className="p-3 border rounded bg-white">
              <div className="text-xs text-gray-600">Avg RPE (skills)</div>
              <div className="text-2xl font-semibold">{(() => {
                const list = sessions.filter((r: any) => typeof r.rpe === 'number')
                if (!list.length) return 0
                const s = list.reduce((acc: number, r: any) => acc + Number(r.rpe || 0), 0)
                return Math.round((s / list.length) * 10) / 10
              })()}</div>
            </div>
          </div>

          <div className="p-4 border rounded bg-white">
            <div className="text-sm text-gray-700 mb-2">Top skills (by sessions)</div>
            <ul className="text-sm list-disc list-inside">
              {[...(summary?.summary || [])]
                .sort((a: any, b: any) => (b.count || 0) - (a.count || 0))
                .slice(0, 15)
                .map((sk: any) => (
                  <li key={sk.name}>{sk.name} — {sk.count} sessions, RPE {Math.round((sk.avgRPE || 0) * 10) / 10}, Quality {Math.round((sk.avgQuality || 0) * 10) / 10}</li>
                ))}
            </ul>
          </div>

          <div className="p-4 border rounded bg-white">
            <div className="text-sm text-gray-700 mb-2">Recent sessions</div>
            <ul className="divide-y">
              {sessions.slice(0, 30).map((s: any, i: number) => (
                <li key={i} className="py-2 text-sm flex items-center justify-between">
                  <span className="text-gray-800">{s.exercise_name}</span>
                  <span className="text-gray-600">{new Date(s.logged_at).toLocaleDateString()} • {s.sets || 1} × {s.reps || 0} • RPE {s.rpe ?? '—'} • Q {s.quality ?? '—'}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

