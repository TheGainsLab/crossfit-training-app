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
            <h2 className="text-2xl md:text-3xl font-semibold mb-6 leading-tight">
              Strength, Treated as a System
            </h2>
            
            <div className="max-w-4xl mx-auto mb-8">
              <p className="text-lg md:text-xl leading-relaxed">
                Combine modern technology, AI and analytics with the proven principles of strength training in a completely personalized strength program to maximize your gains.
              </p>
            </div>

            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="mt-12 bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
              <p className="text-gray-400 italic text-sm">
                📱 Image Placeholder<br/>
                Strength, in context. Ratios and benchmarks reveal what's actually limiting progress.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Getting Strong Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Getting Strong Is Simple. Getting Strong Well Is Not.
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Any decent program can make you strong. Compound movements, heavy weights and good technique are the foundations of strength and power development.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            The problem is not the knowledge, it's the delivery. Static templates and percentages deliver the basics but fail to account for the differences between athletes. The Gains AI combines the proven principles of strength training and weightlifting with modern technology, AI and data analytics.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            Applied Power precisely measures and analyzes all aspects of your strength and power to create a blueprint. Your blueprint becomes your program, fully personalized to develop each aspect of your strength and power individually and synthesizing them into a cohesive whole.
          </p>

          {/* 📱 IMAGE PLACEHOLDER */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image Placeholder<br/>
              Efficiency matters. Stronger lifts come from better positions and cleaner force transfer.
            </p>
          </div>
        </div>

        {/* Strength Blueprint Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Your Strength Blueprint
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed font-semibold">
            If strength is simple, who needs technology?
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            The GainsAI reviews the relationships among your lifts and identifies gaps and imbalances.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Customized technical work sharpens pulls and reinforces positions.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Individualized accessories build strength that raises every bar: core strength, back strength, overhead strength and unilateral strength.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            Strength progressions are lift specific, so you get the exact dose you need every training day.
          </p>

          {/* 📱 IMAGE PLACEHOLDER */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image Placeholder<br/>
              See the gaps. Train with intent. Diagnostics turn effort into direction.
            </p>
          </div>
        </div>

        {/* Programming That Responds Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">
            Programming That Responds to What You Need
          </h2>
          
          <div className="max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">The process is simple</h3>
            
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              Complete your intake.
            </p>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              Enter your 1RM lifts.
            </p>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              We'll assess your strength to bodyweight ratios to get a sense of your strength levels and set near term goals. Then we look at the ratios between your strength and olympic lifts to identify any technical gaps which can be addressed with technical work. Outstanding strength rarely happens without outstanding technique, so we dial in your technique before we load up the weights.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              The Gains AI programs your lifts independently, so if you have a strong squat but your Olympic lifts are lagging, you'll maintain that squat while we address your Olympic lifts with lighter weights and more reps. As your lifts progress, we can adjust this balance as needed.
            </p>
          </div>

          {/* 📱 IMAGE PLACEHOLDER */}
          <div className="mt-8 bg-gray-100 rounded-lg p-8">
            <p className="text-gray-400 italic text-sm text-center">
              📱 Image Placeholder<br/>
              Progress that reflects real improvement. Not just heavier bars—better movement.
            </p>
          </div>
        </div>

        {/* Why It Works Section */}
        <div className="bg-gradient-to-br from-[#FE5858] to-[#ff6b6b] rounded-xl shadow-lg p-8 md:p-12 mb-12 text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">Why Applied Power Works</h2>
          <ul className="space-y-5 max-w-3xl mx-auto">
            <li className="flex items-start">
              <span className="text-lg mr-2">•</span>
              <span className="text-lg"><strong>Structured strength diagnostics</strong> Ratios reveal limiting factors static programs miss.</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg mr-2">•</span>
              <span className="text-lg"><strong>Precision programming</strong> Training targets causes, not symptoms.</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg mr-2">•</span>
              <span className="text-lg"><strong>Injury resilience by design</strong> Imbalances are addressed before they accumulate.</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg mr-2">•</span>
              <span className="text-lg"><strong>Technical skill development</strong> Efficiency improves alongside force production.</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg mr-2">•</span>
              <span className="text-lg"><strong>Strength that transfers</strong> Power that shows up beyond the gym.</span>
            </li>
          </ul>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-white rounded-xl shadow-lg p-8 md:p-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Strength, Done Intentionally
          </h2>
          <p className="text-lg text-gray-700 mb-6 max-w-3xl mx-auto leading-relaxed">
            Applied Power isn't about grinding harder. It's about building strength that holds up—under load, under fatigue, and over time.
          </p>
          <p className="text-lg text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
            If you want strength training that adapts, explains itself, and compounds— this is the system.
          </p>
          <p className="text-xl font-semibold text-gray-900 mb-8">
            Add Applied Power to your training and build strength with intent
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

      <Footer variant="minimal" />
    </div>
  )
}
