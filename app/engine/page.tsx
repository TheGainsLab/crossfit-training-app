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
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-12 leading-tight">
            The Year of the Engine
          </h1>
          
          <div className="text-left max-w-4xl mx-auto mb-12">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
              Most Conditioning Programs Track Workouts. We Track Your Engine.
            </h3>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              Most conditioning apps give you a calorie count, an average heart rate, and maybe a "personal record" badge.
            </p>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              They don't tell you:
            </p>
            <ul className="space-y-3 mb-6 ml-6">
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Whether your aerobic capacity is improving or plateauing</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Why you're crushing sprints but struggling with sustained efforts</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">How your pacing breaks down across different work durations</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Whether you're getting more efficient—or just more exhausted</span>
              </li>
            </ul>
            <p className="text-xl font-semibold text-gray-900 mb-6">
              You're training blind.
            </p>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              The Year of the Engine measures what actually matters: how your engine performs across the full spectrum of conditioning demands—and adjusts your training based on what the data reveals.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed font-semibold">
              Not random workouts. Not static targets. A system designed to build your engine deliberately, and show you exactly how it's developing.
            </p>
          </div>
        </div>

        {/* Adaptive Conditioning Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Adaptive Conditioning—Built on Real Performance Data
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            The Year of the Engine doesn't guess. It measures.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            After every session, your performance is logged and analyzed. The system adjusts what comes next:
          </p>
          <ul className="space-y-4 max-w-3xl mx-auto mb-6">
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Hit the target → Pacing tightens for the next session</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Miss the target → Difficulty recalibrates</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Improve in one domain → That domain's targets adjust independently</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Your aerobic capacity, anaerobic power, and threshold tolerance are trained as separate systems—so progress stays balanced instead of accidental.
          </p>

          {/* 📱 IMAGE PLACEHOLDERS */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8 mb-6">
            <p className="text-gray-400 italic text-sm text-center">
              📱 IMAGE: Training Summary screen<br/>
              Caption: Before you start, you know the target. After you finish, the system knows whether to push harder or pull back.
            </p>
          </div>
          <div className="bg-gray-100 rounded-lg p-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 IMAGE: Target vs. Actual over time (Day 4, 8, 12, 16)<br/>
              Caption: Targets evolve session by session. When you exceed them, they increase. When you miss, they adjust down. This is what adaptive programming actually looks like.
            </p>
          </div>
        </div>

        {/* Unmatched Range of Stimuli Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            An Unmatched Range of Stimuli—Each Tracked Independently
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            The Year of the Engine isn't "intervals and Zone 2."
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            It's 25+ distinct conditioning frameworks, each designed to stress a different aspect of your engine:
          </p>
          <ul className="space-y-4 max-w-3xl mx-auto mb-6">
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Aerobic capacity sessions that build mitochondrial density and oxygen utilization</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Threshold work that raises your lactate clearance and sustains high output longer</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Anaerobic power sessions that develop short-burst explosiveness</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Density tolerance work that trains recovery speed between efforts</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Variable pacing structures that teach you to control output as demands change</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Multi-block sessions that combine different energy systems in one workout</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">MetCon simulators that test everything you've built under competition-style fatigue</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Each structure has a specific purpose. Each adapts independently based on your performance.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            This isn't variety for variety's sake—it's precision. Your aerobic engine and your anaerobic system don't improve at the same rate. The Year of the Engine tracks them separately, so when you're excelling in one domain and struggling in another, your targets adjust accordingly.
          </p>
          <div className="text-center mb-8">
            <Link href="/engine/taxonomy" className="text-[#FE5858] hover:text-[#ff6b6b] font-semibold text-lg transition-colors underline">
              Explore the complete framework taxonomy →
            </Link>
          </div>

          {/* 📱 IMAGE PLACEHOLDERS */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8 mb-6">
            <p className="text-gray-400 italic text-sm text-center">
              📱 IMAGE: Workout breakdown (4x4 structure)<br/>
              Caption: Every session shows you exactly what you're doing—work duration, rest duration, target output. No guessing.
            </p>
          </div>
          <div className="bg-gray-100 rounded-lg p-8 mb-6">
            <p className="text-gray-400 italic text-sm text-center">
              📱 IMAGE: Multi-block day (3 blocks with different stimuli)<br/>
              Caption: Advanced sessions combine multiple energy system demands in one workout—so you learn to transition between pacing strategies under fatigue.
            </p>
          </div>
          <div className="bg-gray-100 rounded-lg p-8 mb-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 IMAGE: Variable pacing structure (ascending work intervals)<br/>
              Caption: Some structures test whether you can maintain pace as intervals get longer. Others test whether you can recover faster as rest shrinks. Progress isn't just about going harder—it's about handling complexity.
            </p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-6 text-center">
            <p className="text-lg text-gray-800 font-semibold mb-3">
              Can I see all 25 day types and what they train?
            </p>
            <Link href="/engine/taxonomy" className="text-[#FE5858] hover:text-[#ff6b6b] font-semibold transition-colors underline">
              Yes. View the complete framework taxonomy →
            </Link>
          </div>
        </div>

        {/* Independent Adaptation Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Independent Adaptation—Because Your Engine Isn't One Thing
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Your anaerobic power and your aerobic capacity don't improve at the same rate.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Most programs don't account for this. If you crush a sprint session, they assume you're ready for harder endurance work too.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed font-semibold">
            The Year of the Engine tracks each stimulus type separately.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            When you exceed your Max Aerobic Power targets, those targets increase. When you struggle with Anaerobic sessions, those targets adjust down. Progress in one domain doesn't artificially inflate expectations in another.
          </p>

          {/* 📱 IMAGE PLACEHOLDERS */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8 mb-6">
            <p className="text-gray-400 italic text-sm text-center">
              📱 IMAGE: Max Aerobic Power history (4 sessions over time)<br/>
              Caption: Every time you complete a Max Aerobic Power session, it's logged. The system tracks your average pace across all sessions—and adjusts future targets based only on that specific stimulus type.
            </p>
          </div>
          <div className="bg-gray-100 rounded-lg p-8 mb-6">
            <p className="text-gray-400 italic text-sm text-center">
              📱 IMAGE: Day Type comparison (Anaerobic vs. Endurance vs. Max Aerobic Power performance)<br/>
              Caption: See your actual performance across different day types. If you're strong anaerobically but weak aerobically, the data makes it obvious.
            </p>
          </div>
          <div className="bg-gray-100 rounded-lg p-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 IMAGE: Average Pace Comparison across multiple day types<br/>
              Caption: Compare your output across different conditioning structures. This isn't just "how hard did you work"—it's "how does your engine perform under different demands?"
            </p>
          </div>
        </div>

        {/* Conditioning You Can See Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Analytics That Actually Tell You Something
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Most conditioning apps show you calories burned and call it progress.
          </p>
          <p className="text-lg text-gray-700 mb-8 leading-relaxed font-semibold">
            The Year of the Engine shows you how your engine works—and where it's getting better.
          </p>

          {/* See Performance Section */}
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            See Your Performance Across Every Stimulus Type
          </h3>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            Every day type you complete is logged and tracked independently. You can compare your output across:
          </p>
          <ul className="space-y-3 max-w-3xl mx-auto mb-8 ml-6">
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Short, maximal efforts (anaerobic power)</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Sustained threshold work (aerobic durability)</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Long endurance sessions (oxidative capacity)</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Variable pacing structures (output control under changing demands)</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Multi-block sessions (system integration under fatigue)</span>
            </li>
          </ul>

          {/* IMAGE PLACEHOLDERS */}
          <div className="bg-gray-100 rounded-lg p-8 mb-6">
            <p className="text-gray-400 italic text-sm text-center">
              📱 IMAGE: Day Type comparison (Anaerobic vs. Endurance vs. Max Aerobic Power performance)<br/>
              Caption: Your anaerobic output might be strong (33 cal/min) while your sustained aerobic work lags (11 cal/min). The data makes it obvious where your engine is imbalanced.
            </p>
          </div>
          <div className="bg-gray-100 rounded-lg p-8 mb-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 IMAGE: Average Pace Comparison across multiple day types<br/>
              Caption: See exactly how you perform across different conditioning structures. This isn't just "how hard did you work"—it's "how does your engine respond to different demands?"
            </p>
          </div>

          {/* Energy System Balance */}
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Track Energy System Balance—Not Just "Fitness"
          </h3>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Your conditioning profile reveals the ratio between your glycolytic power, aerobic capacity, and anaerobic-to-aerobic balance.
          </p>
          <p className="text-lg text-gray-700 mb-8 leading-relaxed">
            If one system dominates, you'll know exactly where the imbalance is—and which sessions to prioritize.
          </p>

          <div className="bg-gray-100 rounded-lg p-8 mb-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 IMAGE: Analytics Summary (Energy System Ratios)<br/>
              Caption: Glycolytic (Anaerobic/TT): 2.19. Aerobic (MAP/TT): 0.75. Systems (Anaerobic/MAP): 2.90. This athlete is anaerobically strong but aerobically underdeveloped. The data doesn't just show performance—it shows what needs work.
            </p>
          </div>

          {/* Target Progression */}
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            See Whether Targets Are Progressing, Plateauing, or Regressing
          </h3>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            Every session shows you what the system expected you to do (target) and what you actually did (actual).
          </p>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            Over time, you can see:
          </p>
          <ul className="space-y-3 max-w-3xl mx-auto mb-8 ml-6">
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Which day types are improving (targets climbing, performance exceeding expectations)</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Which are stalling (hitting the same targets repeatedly without progression)</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Which need recalibration (consistently missing targets = time to pull back or adjust approach)</span>
            </li>
          </ul>

          <div className="bg-gray-100 rounded-lg p-8 mb-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 IMAGE: Target vs. Actual over time (Day 4, 8, 12, 16)<br/>
              Caption: Day 4: Target 10, Actual 11 (exceeded). Day 8: Target 11, Actual 11 (target increased, hit exactly). Day 16: Target 10, Actual 13 (exceeded by 30%). This is what adaptive programming looks like—targets respond to your performance, not to a static template.
            </p>
          </div>

          {/* Performance History */}
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Drill Down Into Performance History for Any Day Type
          </h3>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            Want to see every Max Aerobic Power session you've ever done? Or compare your performance on Anaerobic days over the past month?
          </p>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            The system tracks:
          </p>
          <ul className="space-y-3 max-w-3xl mx-auto mb-8 ml-6">
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Session count (how often you've trained each stimulus)</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Average pace (your typical output for that day type)</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Performance variance (how consistent you are across sessions)</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">Longitudinal trends (whether you're improving, plateauing, or regressing)</span>
            </li>
          </ul>

          <div className="bg-gray-100 rounded-lg p-8 mb-6">
            <p className="text-gray-400 italic text-sm text-center">
              📱 IMAGE: Max Aerobic Power history (4 sessions over time)<br/>
              Caption: Four Max Aerobic Power sessions tracked over time: 10.5 → 11.1 → 10.8 → 12.9 cal/min. Average: 11.3 cal/min (112% of baseline). Progress isn't linear—but the system sees the trend and adjusts accordingly.
            </p>
          </div>
          <div className="bg-gray-100 rounded-lg p-8 mb-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 IMAGE: History - Infinity performance (2 sessions)<br/>
              Caption: Select any day type and see your complete performance history. The system remembers everything—so you never have to wonder "am I actually getting better at this?"
            </p>
          </div>

          {/* Work:Rest Ratio */}
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Analyze Performance by Work:Rest Ratio
          </h3>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            How does your output change based on recovery time?
          </p>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            The system tracks your average pace across different work-to-rest ratios:
          </p>
          <ul className="space-y-3 max-w-3xl mx-auto mb-8 ml-6">
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">1:3 ratio (lots of rest) → highest sustainable output</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">1:1 ratio (equal work and rest) → moderate output, tests repeatability</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700">1:2 ratio (shrinking rest) → tests density tolerance and clearance efficiency</span>
            </li>
          </ul>

          <div className="bg-gray-100 rounded-lg p-8 mb-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 IMAGE: Work:Rest Ratio analysis<br/>
              Caption: 1:3 ratio (4 sessions): 33 cal/min. 1:2 ratio (4 sessions): 17 cal/min. 1:1 ratio (9 sessions): 15 cal/min. This shows how recovery time affects your ability to produce power—intelligence most apps never surface.
            </p>
          </div>

          {/* HR Analytics */}
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Heart Rate Efficiency and Training Load (for athletes using HR monitors)
          </h3>
          <p className="text-lg text-gray-700 mb-8 leading-relaxed">
            See which day types demand the most from your cardiovascular system—and whether you're getting more efficient at handling them over time.
          </p>

          <div className="bg-gray-100 rounded-lg p-8 mb-6">
            <p className="text-gray-400 italic text-sm text-center">
              📱 IMAGE: HR Efficiency by Day Type chart<br/>
              Caption: Anaerobic sessions: 235 HR efficiency (high output, low sustained demand). Endurance sessions: 130 HR efficiency (prolonged cardiovascular cost for lower instantaneous output). This is the cost of different conditioning demands—not just the result.
            </p>
          </div>

          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Track cumulative training load, average HR, peak HR, and max HR across all sessions to manage intensity and avoid overreaching.
          </p>
          <div className="text-center mb-8">
            <Link href="/engine/hr" className="text-[#FE5858] hover:text-[#ff6b6b] font-semibold text-lg transition-colors underline">
              Learn more about HR Analytics →
            </Link>
          </div>

          {/* Data for Decisions */}
          <div className="bg-gray-50 rounded-lg p-8 mt-12">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              This Isn't Data for Motivation—It's Data for Decisions
            </h3>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              The Year of the Engine doesn't just tell you "good job" or show you a graph going up and to the right.
            </p>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              It tells you:
            </p>
            <ul className="space-y-3 max-w-3xl mx-auto mb-6 ml-6">
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Where your engine is strong (so you know what you can rely on)</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Where it's weak (so you know what to prioritize)</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Whether you're progressing (targets increasing, performance exceeding expectations)</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Whether you're plateauing (hitting the same targets repeatedly without adaptation)</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Whether you're overreaching (missing targets consistently, training load climbing without gains)</span>
              </li>
            </ul>
            <p className="text-lg text-gray-700 font-semibold text-center">
              If the system sees it, you see it.<br/>
              And if you see it, you can act on it.
            </p>
          </div>
        </div>

        {/* Why It Works Section */}
        <div className="bg-gradient-to-br from-[#FE5858] to-[#ff6b6b] rounded-xl shadow-lg p-8 md:p-12 mb-12 text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">Why The Year of the Engine Works</h2>
          <ul className="space-y-5 max-w-3xl mx-auto">
            <li className="flex items-start">
              <span className="text-lg mr-2">•</span>
              <span className="text-lg"><strong>Adaptive by Design:</strong> Targets adjust after every session to maintain the right stimulus. You're never coasting, and you're never overreaching without reason.</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg mr-2">•</span>
              <span className="text-lg"><strong>Structured, Not Chaotic:</strong> Progress comes from consistency, not novelty. The frameworks stay stable so adaptation becomes measurable.</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg mr-2">•</span>
              <span className="text-lg"><strong>Modality-Agnostic:</strong> Train on any equipment: rower, bike, ski erg, echo bike, or run. The system adapts to your performance, not your equipment.</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg mr-2">•</span>
              <span className="text-lg"><strong>Integrated with Gains AI:</strong> Conditioning lives in the same system as your strength and skill training. Your engine development doesn't exist in isolation—it supports everything else you do.</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg mr-2">•</span>
              <span className="text-lg"><strong>Comprehensive Engine Development:</strong> Aerobic base, threshold tolerance, anaerobic power, and repeatability—all trained together, all tracked independently.</span>
            </li>
          </ul>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-white rounded-xl shadow-lg p-8 md:p-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Build Your Engine. See It Develop.
          </h2>
          <p className="text-lg text-gray-700 mb-6 max-w-3xl mx-auto leading-relaxed">
            The Year of the Engine isn't about surviving workouts.
          </p>
          <p className="text-lg text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
            It's about building capacity you can rely on—and having the data to prove it's working.
          </p>
          <p className="text-xl font-semibold text-gray-900 mb-8">
            If you want conditioning that adapts, explains itself, and compounds over time—this is the system.
          </p>
          <p className="text-xl font-semibold text-gray-900 mb-8">
            Download the app and start your 3-day free trial.
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

