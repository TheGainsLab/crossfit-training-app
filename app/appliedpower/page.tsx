'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Footer from '../components/Footer';

interface SubscriptionStatus {
  hasAccess: boolean
  subscriptionData?: {
    status: string
    plan: string
    current_period_end: string
  }
}

export default function AppliedPowerPage() {
  const [loading, setLoading] = useState(true)
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({ hasAccess: false })
  const [checkingOut, setCheckingOut] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      setUser(user)

      if (!user) {
        setLoading(false)
        return
      }

      // Check Applied Power subscription access
      const response = await fetch('/api/appliedpower/check-access')
      const data = await response.json()
      
      setSubscriptionStatus(data)
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
      
      const response = await fetch('/api/appliedpower/create-checkout', {
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

  // User has access - redirect to dashboard
  if (subscriptionStatus.hasAccess) {
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard'
    }
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FE5858] mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  // User does not have access - show paywall
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="py-20" style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link href="/" className="inline-flex items-center text-[#FE5858] hover:text-[#ff6b6b] font-medium transition-colors">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </Link>
          </div>

          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Applied Power
            </h1>
            <h2 className="text-2xl md:text-3xl font-semibold mb-8 leading-tight">
              Strength, Treated as a System
            </h2>
            
            <p className="text-lg md:text-xl max-w-4xl mx-auto mb-12 leading-relaxed">
              Build raw, transferable power with a program that's 100% yours—laser-focused on your weak links, ratios, and limiting factors. No generic percentages. No junk volume. Just smarter, faster strength gains.
            </p>

            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="mt-12 bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
              <p className="text-gray-400 italic text-sm">
                📱 Image: Strength Summary + Olympic Lift Ratios<br/>
                Strength in context. See exactly where you stand against proven ratios—and what to fix first.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Getting Strong Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">
            Getting Strong Is Simple. Getting Strong Well Is Hard.
          </h2>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            Heavy compounds + good technique will always be the foundation.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Any decent program can add plates… for a while.
          </p>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed font-semibold">
            The difference is in the details most programs ignore:
          </p>
          <ul className="space-y-3 ml-6 mb-6">
            <li className="text-lg text-gray-700">• How your squat:deadlift:press ratios actually stack up</li>
            <li className="text-lg text-gray-700">• Where technique is quietly robbing you of pounds</li>
            <li className="text-lg text-gray-700">• Which accessories will raise every bar, not just one</li>
            <li className="text-lg text-gray-700">• How to progress each lift independently without imbalances</li>
          </ul>
          <p className="text-lg text-gray-700 leading-relaxed">
            Applied Power measures all of it, then builds a blueprint that evolves with you.
          </p>

          {/* 📱 IMAGE PLACEHOLDER */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image: Technical Focus Screen or Position Efficiency View<br/>
              Efficiency = free strength. Clean positions and better force transfer show up as bigger lifts, fast.
            </p>
          </div>
        </div>

        {/* Your Personal Strength Blueprint Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">
            Your Personal Strength Blueprint
          </h2>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            From day one you see:
          </p>
          <ul className="space-y-3 ml-6 mb-6">
            <li className="text-lg text-gray-700">• Strength-to-bodyweight ratios and immediate goals</li>
            <li className="text-lg text-gray-700">• Olympic lift ratios that expose technical gaps</li>
            <li className="text-lg text-gray-700">• Individualized technical drills to fix positions before adding load</li>
            <li className="text-lg text-gray-700">• Lift-specific progressions—so your strong squat maintains while your lagging clean catches up</li>
            <li className="text-lg text-gray-700">• Smart accessories chosen for your weak points (core, back, overhead, unilateral)</li>
          </ul>
          <p className="text-lg text-gray-700 leading-relaxed font-semibold">
            Every session is the exact dose you need. Nothing more, nothing less.
          </p>

          {/* 📱 IMAGE PLACEHOLDER */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image: Progression Ladder or Weak-Link Targeting<br/>
              Progress that reflects real improvement—not just heavier bars, better movement.
            </p>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
            How Applied Power Works
          </h2>
          
          {/* Step 1 */}
          <div className="max-w-4xl mx-auto mb-12">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#FE5858' }}>
                <span className="text-white font-bold text-xl">1</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Intake & Diagnostic</h3>
            </div>
            <p className="text-lg text-gray-700 leading-relaxed">
              Enter your lifts → instantly see ratios, imbalances, and high-impact opportunities.
            </p>
          </div>

          {/* Step 2 */}
          <div className="max-w-4xl mx-auto mb-12">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#FE5858' }}>
                <span className="text-white font-bold text-xl">2</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">AI-Engineered Programming</h3>
            </div>
            <p className="text-lg text-gray-700 leading-relaxed">
              Your blueprint becomes your program. Weak links get targeted volume, strong lifts get maintenance or specialization—independently.
            </p>
          </div>

          {/* Step 3 */}
          <div className="max-w-4xl mx-auto mb-12">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#FE5858' }}>
                <span className="text-white font-bold text-xl">3</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Train, Log, Analyze</h3>
            </div>
            <p className="text-lg text-gray-700 leading-relaxed">
              Log in seconds (sets, reps, RPE, execution quality). Data compounds into deeper personalization.
            </p>
          </div>

          {/* Step 4 */}
          <div className="max-w-4xl mx-auto mb-12">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#FE5858' }}>
                <span className="text-white font-bold text-xl">4</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Continuous Adaptation</h3>
            </div>
            <p className="text-lg text-gray-700 leading-relaxed">
              As your numbers and technique evolve, the system rebalances everything: technical emphasis, accessory selection, loading across lifts.
            </p>
          </div>

          {/* Step 5 */}
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#FE5858' }}>
                <span className="text-white font-bold text-xl">5</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">AI + Human Coaching</h3>
            </div>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              AI catches patterns early. Coaches see everything the system sees—and give you judgment where it matters most. Send video. Get answers that actually move the needle.
            </p>
          </div>

          {/* 📱 IMAGE PLACEHOLDER */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image: Messaging View or Analytics + HR Heatmap<br/>
              Human judgment, supercharged by data.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-white rounded-xl shadow-lg p-8 md:p-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Strength That Holds Up
          </h2>
          <p className="text-lg text-gray-700 mb-6 max-w-3xl mx-auto leading-relaxed">
            Applied Power isn't about grinding harder.
          </p>
          <p className="text-lg text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
            It's about building strength that transfers—under fatigue, in competition, and for years, not months.
          </p>
          <p className="text-xl font-semibold text-gray-900 mb-8">
            Ready to stop leaving pounds on the platform?
          </p>
          <p className="text-lg text-gray-700 mb-8">
            Download Gains AI and select Applied Power during onboarding.
          </p>
          
          {/* App Download Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-4">
            <a
              href="YOUR_APP_STORE_LINK"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors hover:opacity-90"
              style={{ backgroundColor: '#FE5858' }}
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              Download on the App Store
            </a>
            
            <a
              href="YOUR_GOOGLE_PLAY_LINK"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors hover:opacity-90"
              style={{ backgroundColor: '#282B34' }}
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
              </svg>
              Get it on Google Play
            </a>
          </div>
          <p className="text-sm text-gray-600">3-day free trial • No credit card required</p>
        </div>
      </div>

      <Footer variant="minimal" />
    </div>
  )
}
