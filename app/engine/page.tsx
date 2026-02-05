'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import engineDatabaseService from '@/lib/engine/databaseService';
import Dashboard from './components/Dashboard';
import TrainingDayComponent from './components/TrainingDayComponent';
import Analytics from './components/Analytics';
import Footer from '../components/Footer';

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
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-800 mb-12 leading-tight">
            Exceptional Work Capacity
          </h2>
          
          <div className="text-left max-w-4xl mx-auto mb-12">
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              Build a complete, unbreakable engine: power, endurance, pacing, and repeatability across every intensity and time domain. Attack workout on your terms.
            </p>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              YoE delivers 20 progressive training frameworks, structured, purposeful exposure, supercharged by machine learning, so your training adapts to you. Every single session is personalized. YoE combines your effort with our technology to maximize performance.
            </p>
          </div>

          {/* Image: Modality & Equipment Selection */}
          <div className="mt-8">
            <Image
              src="/engine/modality-equipment-selection.png"
              alt="Modality & Equipment Selection"
              width={1200}
              height={800}
              className="rounded-lg shadow-lg mx-auto"
            />
            <p className="text-sm text-gray-600 text-center mt-3 italic">
              Any equipment, same results
            </p>
          </div>
        </div>

        {/* Beyond Intervals Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Beyond Intervals and Zone 2
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Most programs stick to extremes: endless easy miles or brutal short bursts.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed font-semibold">
            YoE targets every fiber and energy system by smartly distributing work:
          </p>
          <ul className="space-y-3 mb-6 ml-6 max-w-3xl mx-auto">
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">-</span>
              <span className="text-lg text-gray-700">Polarized sessions</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">-</span>
              <span className="text-lg text-gray-700">Variable/asymmetric intervals</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">-</span>
              <span className="text-lg text-gray-700">Manipulated rest and decreasing recoveries</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">-</span>
              <span className="text-lg text-gray-700">Mixed-intensity + fatigue stacking</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 leading-relaxed">
            Result: Conditioning that directly boosts MetCons, competition pacing, efficiency, and repeatability—not just raw effort.
          </p>

          {/* Image: Workout Breakdown */}
          <div className="mt-8">
            <Image
              src="/engine/workout-breakdown.png"
              alt="Workout Breakdown with Rounds, Work, Rest, Goal"
              width={1200}
              height={800}
              className="rounded-lg shadow-lg mx-auto"
            />
            <p className="text-sm text-gray-600 text-center mt-3 italic">
              Purpose in every segment. Defined work, rest, and output goals train pacing—no guessing.
            </p>
          </div>
        </div>

        {/* Perfectly Personal Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Perfectly Personal
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Breadth + depth only win when calibrated to you.
          </p>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            Every YoE session starts with crystal-clear targets anchored to your own time trials:
          </p>
          <ul className="space-y-3 mb-6 ml-6 max-w-3xl mx-auto">
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">-</span>
              <span className="text-lg text-gray-700">Exact duration</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">-</span>
              <span className="text-lg text-gray-700">Output goals relative to your current capacity</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">-</span>
              <span className="text-lg text-gray-700">How this intensity fits your profile</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            "Hard" becomes productive, not arbitrary.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed font-semibold">
            This is calibration, not motivation—teaching deliberate redline pushes without overreach.
          </p>

          {/* Image: Pre-Workout Training Summary */}
          <div className="mt-8">
            <Image
              src="/engine/pre-workout-training-summary.png"
              alt="Pre-Workout Training Summary"
              width={1200}
              height={800}
              className="rounded-lg shadow-lg mx-auto"
            />
            <p className="text-sm text-gray-600 text-center mt-3 italic">
              Know the demands upfront: duration, total work, intensity vs. your baseline.
            </p>
          </div>
        </div>

        {/* Execution Without Guesswork Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Execution Without Guesswork
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            The app turns into your pacing coach mid-workout.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Goals, countdowns, and context stay front-and-center through fatigue—so you execute the plan, not chase feelings.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed font-semibold">
            Precision under discomfort builds elite engines.
          </p>

          {/* Image: In-Workout Interval Countdown */}
          <div className="mt-8">
            <Image
              src="/engine/in-workount-countdown.png"
              alt="In-Workout Interval Countdown Screen"
              width={1200}
              height={800}
              className="rounded-lg shadow-lg mx-auto"
            />
            <p className="text-sm text-gray-600 text-center mt-3 italic">
              Visible goals + round context keep pacing deliberate, even when it hurts.
            </p>
          </div>
        </div>

        {/* Independent Adaptation Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Independent Adaptation, Total Integration
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Conditioning breaks into components (aerobic power, glycolytic, etc.)—each adapts on its own timeline based on your logged performance.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            No dragging one weak link along; targeted progress across the board.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed font-semibold">
            We develop pieces intelligently, then reassemble into a superior whole.
          </p>

          {/* Image: Stimulus History */}
          <div className="mt-8">
            <Image
              src="/engine/stimulus-performance-history.png"
              alt="Stimulus History - Max Aerobic Power"
              width={1200}
              height={800}
              className="rounded-lg shadow-lg mx-auto"
            />
            <p className="text-sm text-gray-600 text-center mt-3 italic">
              Independent evolution. Targets update from your real outputs—not arbitrary progressions.
            </p>
          </div>
        </div>

        {/* Analytically Amazing Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Analytically Amazing
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Progress isn't vibes—it's visible patterns in structured data.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            YoE analytics answer real questions: How is your engine changing? What's next?
          </p>
          <ul className="space-y-3 mb-6 ml-6 max-w-3xl mx-auto">
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">-</span>
              <span className="text-lg text-gray-700">Total work + energy system balance</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">-</span>
              <span className="text-lg text-gray-700">Pace/output trends per stimulus</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">-</span>
              <span className="text-lg text-gray-700">Comparisons across day types</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">-</span>
              <span className="text-lg text-gray-700">Target vs. actual accountability</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">-</span>
              <span className="text-lg text-gray-700">Work:rest recovery efficiency</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">-</span>
              <span className="text-lg text-gray-700">HR output per beat (true aerobic gains)</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            No single "score"—multi-dimensional insight reveals strengths, gaps, efficiency, and fatigue resistance.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed font-semibold">
            If the system sees it, you see it. Every tweak is transparent and understandable.
          </p>

          {/* Analytics Images */}
          <div className="mt-8">
            <Image
              src="/engine/headline-analytics-summary.png"
              alt="Headline Analytics Summary - Total Work, Energy System Ratios, Pace Overview"
              width={1200}
              height={800}
              className="rounded-lg shadow-lg mx-auto mb-6"
            />
            <p className="text-sm text-gray-600 text-center mb-8 italic">
              Engine overview at a glance: volume, balance, pacing expression.
            </p>
          </div>
          
          <div>
            <Image
              src="/engine/stimulus-performance-history.png"
              alt="Stimulus Performance History - Pace and Output Over Repeated Sessions"
              width={1200}
              height={800}
              className="rounded-lg shadow-lg mx-auto mb-6"
            />
            <p className="text-sm text-gray-600 text-center mb-8 italic">
              Stimulus-by-stimulus gains—capacity, pacing, or efficiency?
            </p>
          </div>
          
          <div>
            <Image
              src="/engine/Comparison.png"
              alt="Comparison Across Conditioning Stimuli"
              width={1200}
              height={800}
              className="rounded-lg shadow-lg mx-auto mb-6"
            />
            <p className="text-sm text-gray-600 text-center mb-8 italic">
              Different demands reveal different strengths. Compare performance across conditioning frameworks to identify overdeveloped systems and limiting factors.
            </p>
          </div>
          
          <div>
            <Image
              src="/engine/target-vs-actual.png"
              alt="Target vs Actual Performance"
              width={1200}
              height={800}
              className="rounded-lg shadow-lg mx-auto mb-6"
            />
            <p className="text-sm text-gray-600 text-center mb-8 italic">
              No black box adjustments. See how targets compare to actual performance—and understand exactly why training evolves.
            </p>
          </div>
          
          <div>
            <Image
              src="/engine/work-rest-ratio.png"
              alt="Work-to-Rest Ratio Comparison"
              width={1200}
              height={800}
              className="rounded-lg shadow-lg mx-auto mb-6"
            />
            <p className="text-sm text-gray-600 text-center mb-8 italic">
              Recovery shows up between efforts. Compare pacing across different work:rest ratios to see how efficiently you recover and reproduce output.
            </p>
          </div>
          
          <div>
            <Image
              src="/engine/HR-efficiency.png"
              alt="Heart Rate Efficiency - Work Output per Heartbeat"
              width={1200}
              height={800}
              className="rounded-lg shadow-lg mx-auto"
            />
            <p className="text-sm text-gray-600 text-center mt-3 italic">
              Efficiency reveals adaptation. Heart rate shows what each effort actually costs—exposing aerobic gains and hidden fatigue that pace alone can't.
            </p>
          </div>
        </div>

        {/* Choose Your Path Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Choose Your Path
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Same intelligent system, different rhythms:
          </p>
          <ul className="space-y-3 mb-6 ml-6 max-w-3xl mx-auto">
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">-</span>
              <span className="text-lg text-gray-700">5-day or 3-day schedules</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">-</span>
              <span className="text-lg text-gray-700">Classic 12-week cycles (deep focus on one stimulus)</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">-</span>
              <span className="text-lg text-gray-700">Engine360: fast 4-week blocks for broad exposure</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 font-semibold leading-relaxed">
            Pick what fits your life—progress never resets.
          </p>

          {/* Image: Program Selection - TO BE ADDED */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8 border-2 border-yellow-300">
            <p className="text-gray-600 italic text-sm text-center">
              📱 <strong>Image Needed:</strong> Program Selection Screen<br/>
              (Add screenshot showing 5-day/3-day/Engine360 options)<br/>
              Caption: Different cadences. Identical engine-building intelligence.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-white rounded-xl shadow-lg p-8 md:p-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Build an Engine That Transfers
          </h2>
          <p className="text-lg text-gray-700 mb-6 max-w-3xl mx-auto leading-relaxed">
            Conditioning isn't surviving workouts—it's repeatable output when it counts.
          </p>
          <p className="text-lg text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
            Train with a system that knows your limits, adapts intelligently, and teaches mastery of your engine.
          </p>
          <p className="text-xl font-semibold text-gray-900 mb-8">
            Download the app and start building today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <button
              onClick={handleSubscribe}
              disabled={checkingOut}
              className="inline-flex items-center justify-center px-8 py-4 bg-[#FE5858] text-white rounded-lg text-lg font-semibold hover:bg-[#ff6b6b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
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
                'Download on iOS →'
              )}
            </button>
            <button
              onClick={handleSubscribe}
              disabled={checkingOut}
              className="inline-flex items-center justify-center px-8 py-4 bg-gray-800 text-white rounded-lg text-lg font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              Download on Android →
            </button>
          </div>
          <p className="text-sm text-gray-500">
            3-day free trial • No credit card required<br/>
            Secure payments via Stripe • Account created at checkout
          </p>
        </div>
      </div>

      <Footer variant="minimal" />
    </div>
  )
}
