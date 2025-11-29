'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

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
            APPLIED POWER: YOUR STRENGTH, DECODED
          </h1>
          <p className="text-lg md:text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed">
            Move beyond generic programs. This is AI-powered strength training that acts as your personal coach—pinpointing weaknesses, enhancing technique, and building truly resilient, functional power.
          </p>
        </div>

        {/* The Truth About Getting Strong Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            THE TRUTH ABOUT GETTING STRONG
          </h2>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            Anyone can get stronger by showing up and lifting heavy. The principles are simple.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed font-semibold">
            But elite, transferable, injury-proof strength comes from far more than adding weight to a bar.
          </p>
          <ul className="space-y-3 max-w-3xl mx-auto mb-6">
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700">It comes from <strong>balance</strong>.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700">It comes from <strong>technique</strong>.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700">It comes from <strong>efficiency</strong>.</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed font-semibold">
            Applied Power transforms your effort into its most effective form.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            We combine rock-solid strength principles with AI-driven analysis that identifies your limiting factors—so every session builds not just more strength, but better strength. It's like training with a world-class coach who sees what you can't and adjusts your plan in real time.
          </p>
        </div>

        {/* How It Works Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            HOW IT WORKS: THE BLUEPRINT FOR SMARTER STRENGTH
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Your training starts with a deep assessment that goes far beyond 1RMs.
          </p>
          <p className="text-xl font-semibold text-gray-800 mb-6">
            Our AI builds your Strength Blueprint, analyzing:
          </p>
          <ul className="space-y-4 max-w-3xl mx-auto mb-6">
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700"><strong>Olympic Lifting Ratios & Efficiency:</strong> Detect technical leaks and power gaps in your snatch, clean, and jerk.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700"><strong>Bodyweight Strength Ratios:</strong> Establish realistic, personalized strength targets.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700"><strong>Muscular Balance & Imbalances:</strong> Identify where your posterior chain, overhead stability, or trunk strength is lagging—so we can fix issues before they become injuries.</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 leading-relaxed font-semibold">
            This blueprint forms the basis of your personalized strength path.
          </p>
        </div>

        {/* Personalized Path Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">
            YOUR PERSONALIZED PATH TO POWER
          </h2>
          
          <div className="space-y-8 max-w-3xl mx-auto">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">1. Targeted Accessory Work</h3>
              <p className="text-lg text-gray-700 mb-3 leading-relaxed">
                No guessing. If you're weak overhead, leaking power off the floor, or missing positional integrity, your program automatically integrates accessory work to correct it.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                If you're already balanced, we push volume and intensity to accelerate raw strength.
              </p>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">2. Technical Mastery Drills</h3>
              <p className="text-lg text-gray-700 mb-3 leading-relaxed font-semibold">
                Strength is a skill.
              </p>
              <p className="text-lg text-gray-700 mb-3 leading-relaxed">
                If your Olympic lift ratios fall below ideal ranges, the program prescribes precision drills to improve motor patterns, timing, coordination, and efficiency.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                We break down complex lifts so every rep moves you closer to mastery.
              </p>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">3. Smarter Strength Progression</h3>
              <p className="text-lg text-gray-700 mb-3 leading-relaxed">
                Your program evolves with your improvement.
              </p>
              <p className="text-lg text-gray-700 mb-3 leading-relaxed">
                Expect measurable changes in mobility, positioning, bar path efficiency, and overall athleticism—not just heavier lifts.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed font-semibold">
                You don't just gain strength; you gain control.
              </p>
            </div>
          </div>
        </div>

        {/* Applied Power Advantage Section */}
        <div className="bg-gradient-to-br from-[#FE5858] to-[#ff6b6b] rounded-xl shadow-lg p-8 md:p-12 mb-12 text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">THE APPLIED POWER ADVANTAGE</h2>
          <ul className="space-y-5 max-w-3xl mx-auto">
            <li className="flex items-start">
              <svg className="w-6 h-6 mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg"><strong>AI-Driven Strength Diagnostics:</strong> Understand your lifting profile with data you've never had access to before.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg"><strong>Precision Programming:</strong> Automatically targets limitations and amplifies strengths.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg"><strong>Injury Resilience:</strong> Fix imbalances before they become problems.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg"><strong>Technical Skill Development:</strong> Improve bar path, efficiency, and movement IQ.</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg"><strong>Functional, Transferable Power:</strong> Strength that shows up everywhere—on the field, on the platform, and in everyday performance.</span>
            </li>
          </ul>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-white rounded-xl shadow-lg p-8 md:p-12">
          <p className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            STOP JUST WORKING HARD. START WORKING INTELLIGENTLY.
          </p>
          <p className="text-lg md:text-xl text-gray-700 mb-8">
            Experience the future of strength. Add Applied Power to your training and build a stronger, smarter, more resilient body.
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
              'Subscribe Now'
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
