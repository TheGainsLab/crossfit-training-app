'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import BTNExerciseHeatMap from '../components/BTNExerciseHeatMap'

export default function BTNAnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/auth/signin')
        return
      }

      // Check BTN subscription access
      const response = await fetch('/api/btn/check-access')
      if (response.ok) {
        const data = await response.json()
        if (data.hasAccess) {
          setHasAccess(true)
        } else {
          router.push('/btn') // Redirect to paywall
        }
      } else {
        router.push('/btn')
      }
    } catch (error) {
      console.error('Error checking access:', error)
      router.push('/btn')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FE5858]"></div>
      </div>
    )
  }

  if (!hasAccess) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-5">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Analytics</h1>
          <p className="text-gray-600">Track your performance across exercises and time domains</p>
        </div>

        {/* Analytics Content */}
        <BTNExerciseHeatMap />
      </div>
    </div>
  )
}

