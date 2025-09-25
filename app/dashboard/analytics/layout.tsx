'use client'

import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useMemo, Suspense } from 'react'

function RangeChips() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const range = (params.get('range') || 'last_30_days').toLowerCase()
  const setRange = (r: string) => {
    const q = new URLSearchParams(params as any)
    q.set('range', r)
    router.replace(`${pathname}?${q.toString()}`)
  }
  const ranges = ['last_30_days','last_60_days','last_90_days','all_time']
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">Range:</span>
      {ranges.map(r => (
        <button key={r} onClick={() => setRange(r)} className={`px-2 py-1 rounded border text-xs ${range===r ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`}>{r.replace(/_/g,' ')}</button>
      ))}
    </div>
  )
}

function AnalyticsSubnav() {
  const pathname = usePathname()
  const tabs = useMemo(() => ([
    { href: '/dashboard/analytics', label: 'Overview' },
    { href: '/dashboard/analytics/skills', label: 'Skills' },
    { href: '/dashboard/analytics/strength', label: 'Strength' },
    { href: '/dashboard/analytics/technical', label: 'Technical Work' },
    { href: '/dashboard/analytics/accessories', label: 'Accessories' },
    { href: '/dashboard/analytics/metcons', label: 'Metcons' }
  ]), [])
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex gap-2">
        {tabs.map(t => {
          const active = pathname === t.href
          return (
            <Link key={t.href} href={t.href} className={`px-3 py-1.5 rounded border text-sm ${active ? 'bg-white border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>{t.label}</Link>
          )
        })}
      </div>
      <Suspense fallback={<div className="text-xs text-gray-400">Loading filters…</div>}>
        <RangeChips />
      </Suspense>
    </div>
  )
}

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">Back to Dashboard</Link>
        </div>
        <AnalyticsSubnav />
        <div className="bg-white border rounded p-4">
          <Suspense fallback={<div className="text-sm text-gray-500">Loading analytics...</div>}>
            {children}
          </Suspense>
        </div>
      </div>
    </div>
  )
}

