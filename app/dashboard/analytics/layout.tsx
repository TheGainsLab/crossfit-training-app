'use client'

import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useMemo, Suspense, useEffect, useState } from 'react'

function RangeChips() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const range = (params.get('range') || 'all_time').toLowerCase()
  const setRange = (r: string) => {
    const q = new URLSearchParams(params as any)
    q.set('range', r)
    router.replace(`${pathname}?${q.toString()}`)
  }
  const ranges = ['all_time','last_30_days','last_60_days','last_90_days']
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
      <span className="text-xs text-gray-500 whitespace-nowrap">Range:</span>
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
  )
}

function AnalyticsSubnav() {
  const pathname = usePathname()
  const [isAppliedPower, setIsAppliedPower] = useState(false)
  const [isEngine, setIsEngine] = useState(false)
  
  // Check if user is Applied Power or Engine to filter tabs
  useEffect(() => {
    const checkSubscriptionTier = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const sb = createClient()
        const { data: { user } } = await sb.auth.getUser()
        if (!user) return
        const { data: userData } = await sb
          .from('users')
          .select('subscription_tier')
          .eq('auth_id', user.id)
          .single()
        if (userData?.subscription_tier === 'APPLIED_POWER') {
          setIsAppliedPower(true)
        }
        if (userData?.subscription_tier === 'ENGINE') {
          setIsEngine(true)
        }
      } catch (err) {
        console.warn('Failed to check subscription tier:', err)
      }
    }
    checkSubscriptionTier()
  }, [])
  
  const allTabs = useMemo(() => ([
    { href: '/dashboard/analytics/skills', label: 'Skills' },
    { href: '/dashboard/analytics/strength', label: 'Strength' },
    { href: '/dashboard/analytics/technical', label: 'Technical Work' },
    { href: '/dashboard/analytics/accessories', label: 'Accessories' },
    { href: '/dashboard/analytics/metcons', label: 'Metcons' },
    { href: '/engine?view=analytics', label: 'Engine Analytics' }
  ]), [])
  
  // Filter tabs based on subscription tier
  const tabs = useMemo(() => {
    if (isEngine) {
      // Engine users only see Engine analytics link
      return [
        { href: '/engine?view=analytics', label: 'Engine Analytics' }
      ]
    }
    if (isAppliedPower) {
      // Applied Power: filter out Skills, Metcons, and Engine Analytics
      return allTabs.filter(tab => 
        tab.href !== '/dashboard/analytics/skills' && 
        tab.href !== '/dashboard/analytics/metcons' &&
        tab.href !== '/engine?view=analytics'
      )
    }
    // Premium users see all tabs including Engine Analytics
    return allTabs
  }, [isAppliedPower, isEngine, allTabs])
  
  // Hide range filters on metcons page - they're moved into the heat map area
  const isMetconsPage = pathname === '/dashboard/analytics/metcons'
  
  return (
    <div className="flex flex-col gap-4 mb-4">
      {/* Category tabs - wrap on mobile with larger tap targets */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => {
          const active = pathname === t.href
          return (
            <Link 
              key={t.href} 
              href={t.href} 
              className={`px-4 py-3 sm:px-3 sm:py-1.5 rounded border text-sm min-h-[44px] sm:min-h-0 flex items-center justify-center ${active ? 'border-coral' : ''}`}
              style={{ backgroundColor: '#DAE2EA', color: '#282B34', borderColor: active ? '#FE5858' : '#282B34' }}
            >
              {t.label}
            </Link>
          )
        })}
      </div>
      {/* Range filters - hidden on metcons page, shown on other analytics pages */}
      {!isMetconsPage && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-4" style={{ borderTop: '1px solid #F8FBFE' }}>
          <Suspense fallback={<div className="text-xs text-gray-400">Loading filters…</div>}>
            <RangeChips />
          </Suspense>
        </div>
      )}
    </div>
  )
}

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header - stack on mobile */}
        {/* Trigger redeploy */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <Link 
            href="/dashboard" 
            className="px-4 py-2 rounded text-sm sm:text-base font-medium transition-colors self-start sm:self-auto"
            style={{ backgroundColor: '#FE5858', color: '#F8FBFE' }}
          >
            ← Back to Dashboard
          </Link>
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

