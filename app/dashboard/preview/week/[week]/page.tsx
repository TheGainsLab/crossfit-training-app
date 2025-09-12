'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'

export default function WeekPreviewPage({ params }: { params: Promise<{ week: string }> }) {
  const { week } = use(params)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [data, setData] = useState<any>(null)
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

  const applyDay = async (day: number) => {
    const { createClient } = await import('@/lib/supabase/client')
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    const token = session?.access_token || ''
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    await fetch(`/api/preview/apply`, { method: 'POST', headers, body: JSON.stringify({ week: Number(week), day }) })
    location.reload()
  }
  const revertDay = async (day: number) => {
    const { createClient } = await import('@/lib/supabase/client')
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    const token = session?.access_token || ''
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    await fetch(`/api/preview/revert`, { method: 'POST', headers, body: JSON.stringify({ week: Number(week), day }) })
    location.reload()
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Week {week} Preview</h1>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">Back to Dashboard</Link>
        </div>

        <div className="space-y-6">
          {(data?.days || []).map((d: any) => (
            <div key={d.day} className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-lg font-semibold text-gray-900">Day {d.day} • {d.mainLift || '—'}</div>
                <div className="flex gap-2">
                  {d.hasPreview ? (
                    <>
                      <button onClick={() => applyDay(d.day)} className="px-3 py-1 bg-green-600 text-white rounded">Apply</button>
                      <button onClick={() => revertDay(d.day)} className="px-3 py-1 border rounded">Revert</button>
                    </>
                  ) : (
                    <span className="text-sm text-gray-500">No changes</span>
                  )}
                </div>
              </div>
              {/* Simple diff list */}
              {d.diff && d.diff.length > 0 ? (
                <ul className="list-disc pl-6 text-sm text-gray-700">
                  {d.diff.map((line: string, i: number) => (<li key={i}>{line}</li>))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">No differences from original</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

