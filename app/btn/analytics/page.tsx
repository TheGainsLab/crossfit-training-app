'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
        {/* Navigation */}
        <div className="mb-6 flex items-center justify-end">
          <div className="flex items-center gap-3">
            <Link 
              href="/profile" 
              className="inline-flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </Link>
            
            <Link 
              href="/btn" 
              className="inline-flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generator
            </Link>

            <Link 
              href="/btn/history" 
              className="inline-flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              History
            </Link>
          </div>
        </div>

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

