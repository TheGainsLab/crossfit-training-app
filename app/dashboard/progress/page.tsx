'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

// Analytics data interfaces
interface BlockAnalytics {
  weeklyData: any[]
  blockTrends: any
  exerciseBreakdown: any
  progressionSignals: string[]
}

interface SkillsAnalytics {
  skillsProgression: any
  movementMastery: any
  practiceConsistency: any
}

interface StrengthAnalytics {
  strengthRatios: any
  liftingProgression: any
  periodizationPhases: any
}

interface MetConAnalytics {
  metconPerformance: any
  conditioningTrends: any
  exerciseAnalytics: any
  recommendations: string[]
}

export default function AnalyticsProgressPage() {
  const [user, setUser] = useState<User | null>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Analytics data states
  const [blockAnalytics, setBlockAnalytics] = useState<BlockAnalytics | null>(null)
  const [skillsAnalytics, setSkillsAnalytics] = useState<SkillsAnalytics | null>(null)
  const [strengthAnalytics, setStrengthAnalytics] = useState<StrengthAnalytics | null>(null)
  const [metconAnalytics, setMetConAnalytics] = useState<MetConAnalytics | null>(null)

  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'blocks' | 'skills' | 'strength' | 'metcons'>('overview')

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (userId) {
      fetchAllAnalytics()
    }
  }, [userId])

  const loadUser = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError('Not authenticated')
        return
      }
      setUser(user)

      // Get user ID from users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (userError || !userData) {
        setError('User not found')
        return
      }
      
      setUserId(userData.id)
    } catch (err) {
      console.error('Error loading user:', err)
      setError('Failed to load user data')
    } finally {
      setLoading(false)
    }
  }

  const fetchAllAnalytics = async () => {
    if (!userId) return
    
    setAnalyticsLoading(true)
    try {
      console.log('📊 Fetching all analytics for user:', userId)
      
      // Fetch all analytics in parallel using your working APIs
      const [blockResponse, skillsResponse, strengthResponse, metconResponse] = await Promise.all([
        fetch(`/api/analytics/${userId}/block-analyzer`).catch(e => ({ ok: false, error: e })),
        fetch(`/api/analytics/${userId}/skills-analytics`).catch(e => ({ ok: false, error: e })),
        fetch(`/api/analytics/${userId}/strength-tracker`).catch(e => ({ ok: false, error: e })),
        fetch(`/api/analytics/${userId}/metcon-analyzer`).catch(e => ({ ok: false, error: e }))
      ])

      // Process Block Analytics
      if (blockResponse.ok) {
        const blockData = await blockResponse.json()
        console.log('✅ Block analytics loaded:', blockData)
        setBlockAnalytics(blockData)
      } else {
        console.log('❌ Block analytics failed')
      }

      // Process Skills Analytics  
      if (skillsResponse.ok) {
        const skillsData = await skillsResponse.json()
        console.log('✅ Skills analytics loaded:', skillsData)
        setSkillsAnalytics(skillsData)
      } else {
        console.log('❌ Skills analytics failed')
      }

      // Process Strength Analytics
      if (strengthResponse.ok) {
        const strengthData = await strengthResponse.json()
        console.log('✅ Strength analytics loaded:', strengthData)
        setStrengthAnalytics(strengthData)
      } else {
        console.log('❌ Strength analytics failed')
      }

      // Process MetCon Analytics
      if (metconResponse.ok) {
        const metconData = await metconResponse.json()
        console.log('✅ MetCon analytics loaded:', metconData)
        setMetConAnalytics(metconData)
      } else {
        console.log('❌ MetCon analytics failed')
      }

    } catch (error) {
      console.error('Error fetching analytics:', error)
      setError('Failed to load analytics data')
    } finally {
      setAnalyticsLoading(false)
    }
  }

  // Overview Summary Component
  const OverviewSummary = () => (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Exercises</p>
            <p className="text-3xl font-bold text-gray-900">41</p>
          </div>
          <div className="text-blue-600">📊</div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Average RPE</p>
            <p className="text-3xl font-bold text-gray-900">5.7</p>
          </div>
          <div className="text-green-600">💪</div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Training Consistency</p>
            <p className="text-3xl font-bold text-gray-900">85%</p>
          </div>
          <div className="text-purple-600">🎯</div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Quality Score</p>
            <p className="text-3xl font-bold text-gray-900">B+</p>
          </div>
          <div className="text-orange-600">⭐</div>
        </div>
      </div>
    </div>
  )

  // Tab Navigation
  const TabNavigation = () => (
    <div className="border-b border-gray-200 mb-8">
      <nav className="-mb-px flex space-x-8">
        {[
          { id: 'overview', name: 'Overview', icon: '📊' },
          { id: 'blocks', name: 'Training Blocks', icon: '🎯' },
          { id: 'skills', name: 'Skills Progress', icon: '🤸' },
          { id: 'strength', name: 'Strength Analysis', icon: '💪' },
          { id: 'metcons', name: 'Conditioning', icon: '🔥' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.name}</span>
          </button>
        ))}
      </nav>
    </div>
  )

  // Block Analytics Component
  const BlockAnalyticsView = () => (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Training Block Performance</h3>
        {blockAnalytics ? (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {['Skills', 'Strength', 'MetCons', 'Accessories'].map((block) => (
                <div key={block} className="p-4 border rounded-lg">
                  <h4 className="font-medium text-gray-900">{block}</h4>
                  <p className="text-2xl font-bold text-blue-600">85%</p>
                  <p className="text-sm text-gray-600">Completion Rate</p>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-2">Progression Signals</h4>
              <div className="space-y-2">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">🚀 Skills block showing excellent progress</p>
                </div>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">⚠️ Strength block may need deload consideration</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">Block analytics loading...</p>
          </div>
        )}
      </div>
    </div>
  )

  // Skills Analytics Component  
  const SkillsAnalyticsView = () => (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills Development</h3>
        {skillsAnalytics ? (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Beginner Skills</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm">Push-ups</span>
                  <span className="text-green-600">✅</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm">Air Squats</span>
                  <span className="text-green-600">✅</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Intermediate Skills</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                  <span className="text-sm">Pull-ups</span>
                  <span className="text-yellow-600">🔄</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                  <span className="text-sm">Handstand</span>
                  <span className="text-yellow-600">🔄</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Advanced Skills</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                  <span className="text-sm">Muscle-ups</span>
                  <span className="text-red-600">🎯</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                  <span className="text-sm">Pistol Squats</span>
                  <span className="text-red-600">🎯</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">Skills analytics loading...</p>
          </div>
        )}
      </div>
    </div>
  )

  // Loading and error states
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Analytics</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link
            href="/dashboard"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Performance Analytics</h1>
              <p className="text-gray-600">Comprehensive training insights and progress tracking</p>
            </div>
            <Link
              href="/dashboard"
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Overview Summary */}
        <OverviewSummary />

        {/* Tab Navigation */}
        <TabNavigation />

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
              <p className="text-gray-600">Loading analytics data...</p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && <OverviewSummary />}
              {activeTab === 'blocks' && <BlockAnalyticsView />}
              {activeTab === 'skills' && <SkillsAnalyticsView />}
              {activeTab === 'strength' && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Strength Analysis</h3>
                  <p className="text-gray-600">Strength analytics coming soon...</p>
                </div>
              )}
              {activeTab === 'metcons' && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Conditioning Performance</h3>
                  <p className="text-gray-600">MetCon analytics coming soon...</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
