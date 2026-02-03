'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import engineDatabaseService from '@/lib/engine/databaseService';
import Dashboard from './components/Dashboard';
import TrainingDayComponent from './components/TrainingDayComponent';
import Analytics from './components/Analytics';

interface SubscriptionStatus {
  hasAccess: boolean
  subscriptionData?: {
    status: string
    plan: string
    current_period_end: string
  }
}

type EngineView = 'dashboard' | 'trainingday' | 'analytics'

export default function EnginePage() {
  const [loading, setLoading] = useState(true)
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({ hasAccess: false })
  const [checkingOut, setCheckingOut] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [currentView, setCurrentView] = useState<EngineView>('dashboard')
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Check for view and day parameters in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const view = params.get('view')
      const dayParam = params.get('day')
      
      if (view === 'analytics') {
        setCurrentView('analytics')
      }
      
      // If day parameter is present, automatically open that day
      if (dayParam) {
        const dayNumber = parseInt(dayParam, 10)
        if (!isNaN(dayNumber) && dayNumber > 0) {
          setSelectedDay(dayNumber)
          setCurrentView('trainingday')
        }
      }
    }
  }, [])

  useEffect(() => {
    initializeAndCheckAccess()
  }, [])

  const initializeAndCheckAccess = async () => {
    try {
      // Initialize database service
      const connected = await engineDatabaseService.initialize()
      setInitialized(connected)

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      setUser(user)

      if (!user) {
        setLoading(false)
        return
      }

      // Check Engine subscription access
      const response = await fetch('/api/engine/check-access')
      const data = await response.json()
      
      setSubscriptionStatus(data)

      // If user has access, set program version automatically
      if (data.hasAccess && connected) {
        // Check if this is a Premium user (not standalone Engine user)
        const isPremiumUser = data.subscriptionData?.plan === 'premium' || data.subscriptionData?.plan === 'full-program'
        
        if (isPremiumUser) {
          // Premium users get 5-day program by default
          const existingVersion = await engineDatabaseService.loadProgramVersion()
          if (!existingVersion) {
            await engineDatabaseService.saveProgramVersion('5-day')
          }
        } else {
          // Standalone Engine users - load their saved version (chosen at signup)
          const programVersion = await engineDatabaseService.loadProgramVersion()
          // If they somehow don't have one, default to 5-day
          if (!programVersion) {
            await engineDatabaseService.saveProgramVersion('5-day')
          }
        }
      }
    } catch (error) {
      console.error('Error checking access:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async () => {
    try {
      setCheckingOut(true)
      
      console.log('🔄 Creating checkout session...')
      
      // Create checkout session (works for both logged in and logged out users)
      const response = await fetch('/api/engine/create-checkout', {
        method: 'POST',
      })

      const data = await response.json()
      
      console.log('📦 Checkout response:', data)

      if (data.url) {
        console.log('✅ Redirecting to checkout:', data.url)
        window.location.href = data.url
      } else {
        const errorMsg = data.error || 'Error creating checkout session. Please try again.'
        console.error('❌ Checkout error:', errorMsg, data)
        alert(errorMsg)
        setCheckingOut(false)
      }
    } catch (error) {
      console.error('❌ Error creating checkout:', error)
      alert('Error creating checkout session. Please check the console and try again.')
      setCheckingOut(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FE5858] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }


  // User has access - show Engine app with routing
  if (subscriptionStatus.hasAccess) {
    const handleDayClick = (dayNumber: number, dayType?: string) => {
      setSelectedDay(dayNumber)
      setCurrentView('trainingday')
    }

    const handleBackToDashboard = () => {
      setSelectedDay(null)
      setCurrentView('dashboard')
    }

    const handleAnalyticsClick = () => {
      setCurrentView('analytics')
    }

    const handleBackFromAnalytics = () => {
      setCurrentView('dashboard')
    }

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <Link href="/dashboard" className="inline-flex items-center text-[#FE5858] hover:text-[#ff6b6b] font-medium transition-colors text-sm">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Dashboard
            </Link>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto">
          {currentView === 'dashboard' && (
            <Dashboard
              onDayClick={handleDayClick}
              onAnalyticsClick={handleAnalyticsClick}
              showTrainingView={false}
              onTrainingViewShown={() => {}}
            />
          )}

          {currentView === 'trainingday' && selectedDay && (
            <TrainingDayComponent
              dayNumber={selectedDay}
              onBack={handleBackToDashboard}
              onBackToMonth={handleBackToDashboard}
            />
          )}

          {currentView === 'analytics' && (
            <Analytics onBack={handleBackFromAnalytics} />
          )}
        </div>
      </div>
    )
  }

  // User does not have access - show paywall
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-[#FE5858] hover:text-[#ff6b6b] font-medium transition-colors">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
        </div>

        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            The Year of the Engine
          </h1>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 leading-tight">
            Conditioning, Treated as a System
          </h2>
          <p className="text-lg md:text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed mb-6">
            Most conditioning programs rotate randomly between Zone 2, intervals, and sprints.
          </p>
          <p className="text-lg md:text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed mb-6">
            That's not the problem.
          </p>
          <p className="text-lg md:text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed mb-6">
            The problem is that most of them don't adapt with enough precision. Targets stay fixed. Progress stalls. Effort goes up, results don't.
          </p>
          <p className="text-lg md:text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed mb-6">
            The Year of the Engine is a conditioning system that evolves with you. Built on structured training data and adaptive pacing, it treats conditioning as something measurable, adjustable, and trainable over time.
          </p>
          <p className="text-lg md:text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed font-semibold">
            Not random workouts. Not static cycles. A system designed to build your engine—deliberately.
          </p>

          {/* 📱 IMAGE PLACEHOLDER */}
          <div className="mt-12 bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
            <p className="text-gray-400 italic text-sm">
              📱 Image Placeholder<br/>
              Conditioning, mapped—not guessed. See how performance changes across effort durations, not just best days.
            </p>
          </div>
        </div>

        {/* Adaptive Conditioning Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Adaptive Conditioning — Not Guesswork
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Good conditioning isn't about pushing harder. It's about applying the right stimulus, at the right time.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            After every session, your performance is logged and analyzed. The system adjusts what comes next:
          </p>
          <ul className="space-y-4 max-w-3xl mx-auto mb-6">
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Hit the target → pacing tightens</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Miss the target → difficulty recalibrates</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Improve in one domain → others adjust independently</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Aerobic capacity, repeatability, and short-duration power are trained as separate but connected systems—so progress stays balanced instead of accidental.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed font-semibold">
            No manual tweaking. No chasing exhaustion. Just conditioning that stays aligned with your actual capacity.
          </p>

          {/* 📱 IMAGE PLACEHOLDER */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image Placeholder<br/>
              Targets evolve as you do. Pacing adjusts session by session to maintain the intended stimulus.
            </p>
          </div>
        </div>

        {/* Built on Structure Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Built on Structure, Not Variety
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            The Year of the Engine is built on 25 proven conditioning structures—each designed to stress different energy systems, fiber types, and pacing demands.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            These frameworks stay consistent. What changes is the target.
          </p>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            Because the structure doesn't drift, progress becomes measurable:
          </p>
          <ul className="space-y-4 max-w-3xl mx-auto mb-6">
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Variable pacing sessions across short, medium, and long efforts</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Changing work-to-rest ratios to build recovery tolerance</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Mixed-demand sessions that test pacing under fatigue</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 leading-relaxed font-semibold">
            Every workout is calibrated to where you are today—not where a template assumes you should be.
          </p>

          {/* 📱 IMAGE PLACEHOLDER */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image Placeholder<br/>
              Consistency creates clarity. Stable structures make adaptation visible.
            </p>
          </div>
        </div>

        {/* Conditioning You Can See Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Conditioning You Can See
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Most conditioning programs tell you how hard to go. The Year of the Engine shows you what it costs.
          </p>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            Your conditioning profile reveals:
          </p>
          <ul className="space-y-4 max-w-3xl mx-auto mb-6">
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Performance trends across effort durations</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Target completion consistency over time</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Heart-rate–based efficiency and training load</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Recovery and tolerance patterns under fatigue</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            This isn't data for motivation. It's data for decisions.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed font-semibold">
            If the system sees it, you see it.
          </p>

          {/* 📱 IMAGE PLACEHOLDER */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image Placeholder<br/>
              Output is only half the story. Efficiency and fatigue explain what's really improving.
            </p>
          </div>
        </div>

        {/* Why It Works Section */}
        <div className="bg-gradient-to-br from-[#FE5858] to-[#ff6b6b] rounded-xl shadow-lg p-8 md:p-12 mb-12 text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">Why The Year of the Engine Works</h2>
          <ul className="space-y-5 max-w-3xl mx-auto">
            <li className="flex items-start">
              <span className="text-lg mr-2">•</span>
              <span className="text-lg"><strong>Adaptive by design</strong> Targets adjust after every session to maintain the right stimulus.</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg mr-2">•</span>
              <span className="text-lg"><strong>Structured, not chaotic</strong> Progress comes from consistency, not novelty.</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg mr-2">•</span>
              <span className="text-lg"><strong>Integrated with Gains AI analytics</strong> Conditioning lives in the same system as strength and skills.</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg mr-2">•</span>
              <span className="text-lg"><strong>Comprehensive engine development</strong> Aerobic base, repeatability, and high-output work trained together.</span>
            </li>
          </ul>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-white rounded-xl shadow-lg p-8 md:p-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Conditioning, Done Intentionally
          </h2>
          <p className="text-lg text-gray-700 mb-6 max-w-3xl mx-auto leading-relaxed">
            The Year of the Engine isn't about surviving workouts. It's about building capacity you can rely on.
          </p>
          <p className="text-lg text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
            If you want conditioning that adapts, explains itself, and compounds— this is the system.
          </p>
          <p className="text-xl font-semibold text-gray-900 mb-8">
            Start your 3-day free trial and train your engine with intent.
          </p>
          <button
            onClick={handleSubscribe}
            disabled={checkingOut}
            className="inline-block px-10 py-5 bg-[#FE5858] text-white rounded-lg text-xl font-semibold hover:bg-[#ff6b6b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {checkingOut ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              'Start Your Free Trial'
            )}
          </button>
          <p className="text-sm text-gray-500 mt-4">
            Secure payment powered by Stripe {!user && '• Create account during checkout'}
          </p>
        </div>
      </div>
    </div>
  )
}

