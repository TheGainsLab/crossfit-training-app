'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
            Exceptional Work Capacity for Any Goal
          </h2>
          
          <div className="text-left max-w-4xl mx-auto mb-12">
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              Year of the Engine (YoE) is a comprehensive conditioning system designed to build a complete engine — power, endurance, pacing, and repeatability — across the full range of intensities you face in training and competition.
            </p>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              YoE uses 25 progressive training frameworks to deliver a broader, deeper, and more effective conditioning stimulus:
            </p>
            <ul className="space-y-3 mb-6 ml-6">
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Increased power output</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Greater endurance at any intensity</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">New gears for changing demands</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">The ability to push above the redline without blowing up</span>
              </li>
            </ul>
            <p className="text-lg text-gray-700 font-semibold leading-relaxed">
              This isn't random suffering. It's structured exposure that teaches you how to produce, sustain, and control output.
            </p>
          </div>

          {/* Image Placeholder */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image Placeholder: Modality & Equipment Selection<br/>
              Caption: Train on the equipment you actually have. The engine adapts — the stimulus stays precise.
            </p>
          </div>
        </div>

        {/* Beyond Intervals Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Beyond Intervals and Zone 2
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Most conditioning programs live at the extremes: long and easy, or short and painful.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed font-semibold">
            Year of the Engine goes further.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Our frameworks target every muscle fiber type and energy pathway by controlling how work is distributed, not just how hard it feels. This includes:
          </p>
          <ul className="space-y-3 mb-6 ml-6 max-w-3xl mx-auto">
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Polarized training</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Variable and asymmetric intervals</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Decreasing and manipulated rest periods</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Mixed-intensity and fatigue-stacking designs</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 leading-relaxed">
            The result is conditioning that transfers directly to MetCons and competition — where pacing, efficiency, and repeatability matter more than raw effort.
          </p>

          {/* Image Placeholder */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image Placeholder: Workout Breakdown (Rounds, Work, Rest, Goal)<br/>
              Caption: Every interval has a purpose. Work duration, rest, and output goals are defined for each segment — so pacing is trained, not guessed.
            </p>
          </div>
        </div>

        {/* Perfectly Personal Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Perfectly Personal
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Breadth and depth matter — but personalization is what makes them work.
          </p>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            Every Year of the Engine session begins with clear expectations:
          </p>
          <ul className="space-y-3 mb-6 ml-6 max-w-3xl mx-auto">
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">How long you'll work</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">How much output you're targeting</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">How today's intensity compares to your current capacity</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Targets are anchored to your own time trial data, so "hard" always means productive.
          </p>

          {/* Image Placeholder */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8 mb-6">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image Placeholder: Pre-Workout Training Summary<br/>
              Caption: Before you start, you know exactly what the session demands. Duration, total work, and intensity are set relative to your current capacity.
            </p>
          </div>

          <p className="text-lg text-gray-700 mb-6 leading-relaxed font-semibold">
            This isn't motivation — it's calibration.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            By defining expectations upfront, YoE teaches you how to push above the redline deliberately, without guessing or overreaching.
          </p>
        </div>

        {/* Execution Without Guesswork Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Execution Without Guesswork
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            During the workout, the app becomes a pacing tool, not just a timer.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Goals stay visible during every interval, so execution stays precise even as fatigue rises. You're not chasing vibes — you're executing a plan.
          </p>

          {/* Image Placeholder */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8 mb-6">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image Placeholder: In-Workout Interval Countdown Screen<br/>
              Caption: Countdown, round context, and output goal stay visible — so pacing is deliberate even under fatigue.
            </p>
          </div>

          <p className="text-lg text-gray-700 font-semibold leading-relaxed">
            Great engines aren't built by accident.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            They're built by repeating precision when things get uncomfortable.
          </p>
        </div>

        {/* Independent Adaptation Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Independent Adaptation, Total Integration
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Each conditioning component adapts independently.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            When you repeat a stimulus, the system evaluates your performance relative to the target and adjusts the next exposure accordingly. Aerobic power, glycolytic power, and other components all progress on their own timelines — instead of being dragged along by a one-size-fits-all plan.
          </p>

          {/* Image Placeholder */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8 mb-6">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image Placeholder: Stimulus History (Max Aerobic Power)<br/>
              Caption: Each stimulus adapts independently. Targets update based on your actual performance — not calendar time or preset progressions.
            </p>
          </div>

          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            We don't treat conditioning as one vague quality.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            We break it apart, develop each component intelligently, and then reassemble it into a super-powered engine.
          </p>
        </div>

        {/* Analytically Amazing Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Analytically Amazing
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Progress isn't a feeling — it's a pattern.
          </p>
          <p className="text-lg text-gray-700 mb-8 leading-relaxed">
            Year of the Engine is built on structured training data, which means performance isn't just recorded — it's understood. Every metric exists to answer a specific coaching question: How is your engine changing, and what should you do next?
          </p>

          {/* Headline Analytics Summary */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8 mb-6">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image Placeholder: Headline Analytics Summary<br/>
              (Total Work • Energy System Ratios • Pace Overview)<br/>
              Caption: Your engine at a glance. Total work completed, energy system balance, and pacing characteristics — all in one view.
            </p>
          </div>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            This is your orientation point. Instead of a single "fitness score," you see how much work you've done, how your energy systems compare, and how you express pace in real training.
          </p>
          <p className="text-lg text-gray-700 mb-8 leading-relaxed font-semibold">
            Progress isn't one number. It's volume, balance, and expression — viewed together.
          </p>

          {/* Stimulus Performance History */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8 mb-6">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image Placeholder: Stimulus Performance History<br/>
              (Pace / Output Over Repeated Sessions)<br/>
              Caption: Progress, stimulus by stimulus. Compare repeated exposures to the same conditioning task and see how execution improves over time.
            </p>
          </div>
          <p className="text-lg text-gray-700 mb-8 leading-relaxed">
            Every conditioning stimulus has its own learning curve. Tracking performance across repeated sessions shows whether gains are coming from improved capacity, better pacing, or increased efficiency — not just surviving the workout.
          </p>

          {/* Comparison Across Conditioning Stimuli */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8 mb-6">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image Placeholder: Comparison Across Conditioning Stimuli<br/>
              (Average Pace or Output by Day Type)<br/>
              Caption: Different demands reveal different strengths. Compare performance across conditioning frameworks to identify overdeveloped systems and limiting factors.
            </p>
          </div>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            Conditioning is multi-dimensional. By comparing how your engine performs under different structures — aerobic, anaerobic, polarized, mixed — strengths and gaps become obvious without guesswork.
          </p>
          <p className="text-lg text-gray-700 mb-8 leading-relaxed font-semibold">
            This is where intelligent emphasis begins.
          </p>

          {/* Target vs Actual Performance */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8 mb-6">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image Placeholder: Target vs Actual Performance<br/>
              (Session-by-Session Accountability View)<br/>
              Caption: No black box adjustments. See how targets compare to actual performance — and understand exactly why training evolves.
            </p>
          </div>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            Targets only matter if they're visible. By showing expectations and outcomes side by side, every session becomes feedback — reinforcing pacing discipline when targets are met, and recalibrating intelligently when they aren't.
          </p>
          <p className="text-lg text-gray-700 mb-8 leading-relaxed font-semibold">
            Missing a target isn't failure. It's data.
          </p>

          {/* Work-to-Rest Ratio Comparison */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8 mb-6">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image Placeholder: Work-to-Rest Ratio Comparison<br/>
              (Average Pace by Work:Rest Structure)<br/>
              Caption: Recovery shows up between efforts. Compare pacing across different work-to-rest ratios to see how efficiently you recover and reproduce output.
            </p>
          </div>
          <p className="text-lg text-gray-700 mb-8 leading-relaxed">
            Two athletes can produce the same peak output — but only one can repeat it with limited rest. This view exposes recovery capacity and fatigue resistance that traditional metrics miss, guiding smarter interval design and competition preparation.
          </p>

          {/* Heart Rate Efficiency */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8 mb-6">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image Placeholder: Heart Rate Efficiency<br/>
              (Work Output per Heartbeat)<br/>
              Caption: Efficiency reveals adaptation. Heart rate shows what each effort actually costs — exposing aerobic gains and hidden fatigue that pace alone can't.
            </p>
          </div>
          <p className="text-lg text-gray-700 mb-8 leading-relaxed">
            Output is only half the story. Heart rate efficiency reveals whether improvements are coming from real aerobic adaptation or simply working harder. It's one of the clearest signals of long-term engine development.
          </p>

          {/* Closing */}
          <div className="bg-gray-50 rounded-lg p-8 mt-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              Insight Without Guesswork
            </h3>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              You don't need to interpret raw data or trust opaque algorithms.
            </p>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed font-semibold">
              If the system sees it, you see it.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              Every adjustment is grounded in metrics you can understand — giving you clarity, confidence, and control over how your conditioning evolves.
            </p>
          </div>
        </div>

        {/* Choose Your Path Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Choose Your Path
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            There are multiple ways to train with Year of the Engine:
          </p>
          <ul className="space-y-3 mb-6 ml-6 max-w-3xl mx-auto">
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">5-day and 3-day programs</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Classic cycles: 12-week blocks emphasizing one primary stimulus</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Engine360: faster 4-week cycles for broader exposure</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 font-semibold leading-relaxed">
            Same system. Same intelligence. Different rhythms.
          </p>

          {/* Image Placeholder */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image Placeholder: Program Selection Screen<br/>
              Caption: Different schedules. Same engine.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-white rounded-xl shadow-lg p-8 md:p-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Build an Engine That Transfers
          </h2>
          <p className="text-lg text-gray-700 mb-6 max-w-3xl mx-auto leading-relaxed">
            Conditioning isn't about surviving workouts.
          </p>
          <p className="text-lg text-gray-700 mb-6 max-w-3xl mx-auto leading-relaxed">
            It's about producing repeatable output when it matters.
          </p>
          <p className="text-lg text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
            Train with a system that understands your capacity, adapts as you improve, and teaches you how to use your engine — not just test it.
          </p>
          <p className="text-xl font-semibold text-gray-900 mb-8">
            Download the app and get started today.
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
            Secure payment powered by Stripe {!user && '• Create account during checkout'}
          </p>
        </div>
      </div>

      <Footer variant="minimal" />
    </div>
  )
}
