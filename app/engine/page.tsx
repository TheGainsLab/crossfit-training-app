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
            THE YEAR OF THE ENGINE: WHERE CONDITIONING MEETS INTELLIGENCE
          </h1>
          <p className="text-lg md:text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed">
            Most conditioning programs juggle Zone 2, intervals, and sprints—good at first, then predictable. The Year of the Engine is different. Built on a decade of coaching 10,000+ athletes and powered by a machine-learning engine, it becomes a true training partner, ensuring every second of effort drives measurable progress.
          </p>
        </div>

        {/* A Coach With a Computer Chip Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            A Coach With a Computer Chip in Their Head
          </h2>
          <p className="text-xl font-semibold text-gray-800 mb-6 text-center">
            No more guesswork. Just guaranteed progress.
          </p>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            After every session, you log your score. Our AI processes your performance instantly and adjusts the next workout with precision:
          </p>
          <ul className="space-y-4 max-w-3xl mx-auto mb-6">
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700"><strong>Crush a target?</strong> Your pacing automatically gets harder.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700"><strong>Come up short?</strong> It fine-tunes the difficulty to keep you in the ideal stimulus zone.</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 leading-relaxed">
            Each energy system adapts independently—if your sprint engine climbs while your aerobic power lags, the program adjusts both separately so your entire engine rises together.
          </p>
        </div>

        {/* Foundation Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            A FOUNDATION OF 25 TRAINING STRUCTURES — SUPERCHARGED BY AI
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            The program is built on 25 proven frameworks engineered to stress every muscle fiber and energy system.
          </p>
          <ul className="space-y-4 max-w-3xl mx-auto mb-6">
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700"><strong>Variable Pacing Sessions:</strong> From long grinds to sharp burners, your body learns to answer any demand.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700"><strong>Dynamic Work-to-Rest Ratios:</strong> Intelligent interval manipulation builds recovery capacity and pacing control.</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 leading-relaxed font-semibold">
            Every workout is calibrated to exactly where you are today—not where a template thinks you should be.
          </p>
        </div>

        {/* Analytics Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            UNMATCHED ANALYTICS: SEE YOUR ENGINE IN HIGH DEFINITION
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed text-center">
            Go beyond generic tracking with the most advanced conditioning analytics available.
          </p>
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Your Personal Fitness Dashboard</h3>
          <ul className="space-y-4 max-w-3xl mx-auto">
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700"><strong>Energy System Profiling:</strong> Compare your aerobic, anaerobic, and glycolytic engines with live trend tracking.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700"><strong>Target Completion Intelligence:</strong> Measure how consistently you're hitting rising expectations.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700"><strong>Heart Rate Efficiency Metrics:</strong> See training load, intensity distribution, and cardiovascular improvements across workout types.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700"><strong>Advanced Recovery Insights:</strong> Learn how you handle work intervals longer than rest and what that reveals about your metabolism and pacing under fatigue.</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 mt-6 leading-relaxed font-semibold text-center">
            This is elite-level data—finally made accessible.
          </p>
        </div>

        {/* YOE Advantage Section */}
        <div className="bg-gradient-to-br from-[#FE5858] to-[#ff6b6b] rounded-xl shadow-lg p-8 md:p-12 mb-12 text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">THE YOE ADVANTAGE</h2>
          <ul className="space-y-5 max-w-3xl mx-auto">
            <li className="flex items-start">
              <svg className="w-6 h-6 mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg"><strong>AI-Powered Personalization:</strong> Targets adjust after every workout for continuous progress.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg"><strong>Proven Foundations:</strong> A decade of results across 10,000+ athletes and 25 refined training structures.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg"><strong>Deep, Actionable Analytics:</strong> Insights no other app provides.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg"><strong>Dynamic & Adaptive Training:</strong> Your program evolves session by session.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg"><strong>Comprehensive Conditioning:</strong> Every energy system. Every fiber. One integrated plan.</span>
            </li>
          </ul>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-white rounded-xl shadow-lg p-8 md:p-12">
          <p className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">
            Start your 3-Day Free Trial and experience the future of conditioning.
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

