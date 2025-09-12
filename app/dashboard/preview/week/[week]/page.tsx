'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'

export default function WeekPreviewPage({ params }: { params: Promise<{ week: string }> }) {
  const { week } = use(params)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [data, setData] = useState<any>(null)
  const [blockFilter, setBlockFilter] = useState<string>('All')
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
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">Back to Dashboard</Link>
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
            <div key={d.day} className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-lg font-semibold text-gray-900">Day {d.day}</div>
              </div>

              {/* Original blocks preview with filter */}
              {d.original ? (
                <div className="space-y-4">
                  {Object.keys(d.original)
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
                    ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No data for this day</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

