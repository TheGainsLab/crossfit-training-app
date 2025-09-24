'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'

export default function WeekPreviewPage({ params }: { params: Promise<{ week: string }> }) {
  const { week } = use(params)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [data, setData] = useState<any>(null)
  const [blockFilter, setBlockFilter] = useState<string>('All')
  const [showCoach, setShowCoach] = useState(false)
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachBrief, setCoachBrief] = useState<any>(null)
  const [showBriefJson, setShowBriefJson] = useState(false)
  const [proposeMsg, setProposeMsg] = useState('')
  const [proposeLoading, setProposeLoading] = useState(false)
  const [planDiff, setPlanDiff] = useState<any>(null)
  // No jwt state; we resolve a fresh token before each API call to avoid races

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        const { createClient } = await import('@/lib/supabase/client')
        const sb = createClient()
        const { data: { session } } = await sb.auth.getSession()
        const token = session?.access_token || ''
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`
        const res = await fetch(`/api/preview/week/${week}`, { headers })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load preview')
        setData(json)
      } catch (e: any) {
        setError(e?.message || 'Failed to load preview')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [week])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-700">Loading preview…</div>
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>

  const blockNames = ['All', 'SKILLS', 'TECHNICAL WORK', 'STRENGTH AND POWER', 'ACCESSORIES', 'METCONS']

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Week {week} Preview</h1>
          <div className="flex items-center gap-3">
            <button onClick={async () => {
              try {
                setShowCoach(true)
                setCoachLoading(true)
                const { createClient } = await import('@/lib/supabase/client')
                const sb = createClient()
                const { data: { session } } = await sb.auth.getSession()
                const token = session?.access_token || ''
                const headers: Record<string, string> = { 'Content-Type': 'application/json' }
                if (token) headers['Authorization'] = `Bearer ${token}`
                const res = await fetch('/api/coach/brief', { method: 'POST', headers, body: JSON.stringify({}) })
                const json = await res.json()
                if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load coach brief')
                setCoachBrief(json.brief)
              } catch (e: any) {
                setCoachBrief({ error: e?.message || 'Failed to load coach brief' })
              } finally {
                setCoachLoading(false)
              }
            }} className="px-3 py-1.5 rounded-md border text-gray-700 hover:bg-gray-50">Coach</button>
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">Back to Dashboard</Link>
          </div>
        </div>

        {/* Block Filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          {blockNames.map((bn) => (
            <button
              key={bn}
              onClick={() => setBlockFilter(bn)}
              className={`px-3 py-1 rounded border text-sm ${blockFilter === bn ? 'bg-coral text-white border-coral' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              {bn === 'All' ? 'All Blocks' : bn}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {(data?.days || []).map((d: any) => (
            <div key={d.day} className="bg-slate-blue rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-lg font-semibold text-coral">Day {d.day}</div>
              </div>

              {/* Original blocks preview with filter */}
              {d.original ? (
                <div className="space-y-4">
                  {/* Per-instance rendering preserves duplicate Strength blocks */}
                  {(d.instances as any[] | undefined)?.length ? (
                    (d.instances as any[])
                      .filter((inst) => blockFilter === 'All' || inst.blockName === blockFilter)
                      .map((inst, i) => (
                        <div key={`${inst.blockName}-${i}`}>
                          <div className="font-semibold text-gray-800 mb-1">{inst.label || inst.blockName}</div>
                          <ul className="list-disc pl-6 text-sm text-gray-700">
                            {(inst.names as string[]).map((name: string, idx: number) => (
                              <li key={`${inst.blockName}-${i}-${idx}`}>{name}</li>
                            ))}
                          </ul>
                        </div>
                      ))
                  ) : (
                    Object.keys(d.original)
                      .filter((blk) => blockFilter === 'All' || blk === blockFilter)
                      .map((blk) => (
                        <div key={blk}>
                          <div className="font-semibold text-gray-800 mb-1">{blk}</div>
                          <ul className="list-disc pl-6 text-sm text-gray-700">
                            {(d.original[blk] as string[]).map((name: string, idx: number) => (
                              <li key={`${blk}-${idx}`}>{name}</li>
                            ))}
                          </ul>
                        </div>
                      ))
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No data for this day</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Coach slide-over (simple panel) */}
      {showCoach && (
        <div className="fixed inset-0 bg-black/30 flex justify-end">
          <div className="w-full max-w-md h-full bg-white shadow-xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold">Coach</div>
              <button onClick={() => setShowCoach(false)} className="text-gray-600 hover:text-gray-900">✕</button>
            </div>
            {coachLoading ? (
              <div className="text-gray-600">Loading brief…</div>
            ) : coachBrief?.error ? (
              <div className="text-red-600 text-sm">{coachBrief.error}</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">Coaching Brief</div>
                  <button className="text-xs px-2 py-1 rounded border bg-gray-50 hover:bg-gray-100" onClick={() => setShowBriefJson(v => !v)}>{showBriefJson ? 'Hide JSON' : 'View JSON'}</button>
                </div>
                {showBriefJson && (
                  <pre className="text-xs bg-gray-50 border rounded p-2 whitespace-pre-wrap">{JSON.stringify(coachBrief, null, 2)}</pre>
                )}

                <section>
                  <div className="font-semibold mb-1">Profile</div>
                  <div className="text-sm text-gray-700">Ability: {coachBrief?.profile?.ability || '—'}</div>
                  <div className="text-sm text-gray-700">Units: {coachBrief?.metadata?.units || '—'}</div>
                  <div className="text-sm text-gray-700">Equipment: {(coachBrief?.profile?.equipment || []).join(', ') || '—'}</div>
                </section>

                <section>
                  <div className="font-semibold mb-1">Strength Benchmarks (1RM)</div>
                  {(() => {
                    const names = ['Snatch','Power Snatch','Clean and Jerk','Power Clean','Clean (Only)','Jerk (Only)','Back Squat','Front Squat','Overhead Squat','Deadlift','Bench Press','Push Press','Strict Press','Weighted Pullup']
                    const vals = coachBrief?.intake?.oneRMs || []
                    return (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {names.map((n, i) => (
                          <div key={n} className="flex items-center justify-between bg-gray-50 border rounded px-2 py-1"><span className="text-gray-700">{n}</span><span className="font-medium">{vals[i] || 0}</span></div>
                        ))}
                      </div>
                    )
                  })()}
                  <div className="mt-3 font-semibold mb-1">Conditioning Benchmarks</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(coachBrief?.intake?.conditioning_benchmarks || {}).map(([k, v]: any) => (
                      <div key={k} className="flex items-center justify-between bg-gray-50 border rounded px-2 py-1"><span className="text-gray-700">{k}</span><span className="font-medium">{String(v)}</span></div>
                    ))}
                  </div>
                </section>

                <section>
                  <div className="font-semibold mb-1">Recent Training (by week)</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-2 border-b">Week</th>
                          <th className="text-left p-2 border-b">Sessions</th>
                          <th className="text-left p-2 border-b">Avg RPE</th>
                          <th className="text-left p-2 border-b">Entries</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(coachBrief?.logs_summary || []).slice(0, 6).map((w: any) => (
                          <tr key={w.weekISO} className="odd:bg-white even:bg-gray-50">
                            <td className="p-2 border-b">{w.weekISO}</td>
                            <td className="p-2 border-b">{w.sessions}</td>
                            <td className="p-2 border-b">{w.avg_rpe}</td>
                            <td className="p-2 border-b">{w.volume}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section>
                  <div className="font-semibold mb-1">MetCons</div>
                  <div className="text-sm text-gray-700">Completions: {coachBrief?.metcons_summary?.completions || 0}</div>
                  <div className="text-sm text-gray-700">Avg Percentile: {coachBrief?.metcons_summary?.avg_percentile ?? '—'}</div>
                  <div className="mt-2 text-sm">
                    <div className="text-gray-600 mb-1">Time domains</div>
                    <div className="flex flex-wrap gap-2">
                      {(coachBrief?.metcons_summary?.time_domain_mix || []).map((td: any) => (
                        <span key={td.range} className="px-2 py-1 rounded border bg-gray-50">{td.range}: {td.count}</span>
                      ))}
                    </div>
                  </div>
                </section>

                <section>
                  <div className="font-semibold mb-1">Upcoming Program (next days)</div>
                  <div className="space-y-2 text-sm">
                    {(coachBrief?.upcoming_program || []).slice(0, 7).map((d: any, i: number) => (
                      <div key={i} className="bg-gray-50 border rounded p-2">
                        <div className="font-medium">Week {d.week}, Day {d.day}</div>
                        <ul className="list-disc list-inside">
                          {(d.blocks || []).map((b: any, j: number) => (
                            <li key={`${i}-${j}`}>{b.subOrder ? `${b.block} (${b.subOrder})` : b.block}: {(b.exercises || []).map((e: any) => e.name).filter(Boolean).join(', ')}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Propose updates */}
                <section>
                  <div className="font-semibold mb-2">Propose updates</div>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 border rounded px-2 py-1 text-sm"
                      value={proposeMsg}
                      onChange={(e) => setProposeMsg(e.target.value)}
                      placeholder="e.g., Increase pull-ups to 2x/week and add a 10–15 min metcon on Friday"
                    />
                    <button
                      disabled={!proposeMsg || proposeLoading}
                      onClick={async () => {
                        if (!coachBrief) return
                        try {
                          setProposeLoading(true)
                          setPlanDiff(null)
                          const { createClient } = await import('@/lib/supabase/client')
                          const sb = createClient()
                          const { data: { session } } = await sb.auth.getSession()
                          const token = session?.access_token || ''
                          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
                          if (token) headers['Authorization'] = `Bearer ${token}`
                          const res = await fetch('/api/coach/propose', { method: 'POST', headers, body: JSON.stringify({ brief: coachBrief, message: proposeMsg }) })
                          const json = await res.json()
                          if (!res.ok || !json.success) throw new Error(json.error || 'Failed to propose')
                          setPlanDiff(json.diff)
                        } catch (e: any) {
                          setPlanDiff({ error: e?.message || 'Propose failed' })
                        } finally {
                          setProposeLoading(false)
                        }
                      }}
                      className={`px-3 py-1.5 rounded border text-sm ${proposeMsg && !proposeLoading ? 'text-gray-700 hover:bg-gray-50' : 'text-gray-400 cursor-not-allowed'}`}
                    >
                      {proposeLoading ? 'Proposing…' : 'Propose'}
                    </button>
                  </div>
                  {planDiff && (
                    <div className="mt-3 text-xs bg-gray-50 border rounded p-2 whitespace-pre-wrap">{JSON.stringify(planDiff, null, 2)}</div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

