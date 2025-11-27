'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AnalyticsOverviewPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const isEngineParam = searchParams.get('engine') === 'true'

  useEffect(() => {
    const checkAndRedirect = async () => {
      // Check if engine parameter is present
      if (isEngineParam) {
        // Redirect to Engine analytics
        router.replace('/engine?view=analytics')
        return
      }

      // Also check if user is an Engine user
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userData } = await supabase
          .from('users')
          .select('subscription_tier')
          .eq('auth_id', user.id)
          .single()

        if (userData?.subscription_tier === 'ENGINE') {
          router.replace('/engine?view=analytics')
        }
      } catch (err) {
        console.warn('Failed to check subscription tier:', err)
      }
    }

    checkAndRedirect()
  }, [isEngineParam, router])

  // Show loading while checking/redirecting
  if (isEngineParam) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FE5858] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Engine Analytics...</p>
        </div>
      </div>
    )
  }

  // Default message for non-Engine users
  return (
    <div className="space-y-4">
      <p className="text-gray-600">
        Select an analytics category above to view detailed metrics.
      </p>
    </div>
  )
}

