'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { GeneratedWorkout } from '@/lib/btn/types';
import { generateTestWorkouts } from '@/lib/btn/utils';

interface SubscriptionStatus {
  hasAccess: boolean
  subscriptionData?: {
    status: string
    plan: string
    current_period_end: string
  }
}

function BTNWorkoutGenerator() {
  const [generatedWorkouts, setGeneratedWorkouts] = useState<GeneratedWorkout[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateWorkouts = async () => {
    setIsGenerating(true);
    try {
      // 1. Generate workouts client-side
      console.log('🎲 Generating workouts...');
      const workouts = generateTestWorkouts();
      
      // 2. Display workouts immediately
      setGeneratedWorkouts(workouts);
      console.log(`✅ Generated ${workouts.length} workouts`);
      
      // 3. Save to database in background
      console.log('💾 Saving workouts to database...');
      const response = await fetch('/api/btn/save-workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workouts })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('⚠️ Failed to save workouts:', errorData);
        // Show warning but don't block UI - workouts still displayed
        alert('Workouts generated but not saved to history. You can still use them!');
      } else {
        const data = await response.json();
        console.log(`✅ Saved ${data.savedCount} workouts to database`);
        // Show subtle success indicator
        const message = document.createElement('div');
        message.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-6 py-3 rounded-lg shadow-lg z-50';
        message.innerHTML = `✅ ${data.savedCount} workouts saved! <a href="/btn/history" class="underline font-semibold ml-2">View History →</a>`;
        document.body.appendChild(message);
        setTimeout(() => message.remove(), 5000);
      }
    } catch (error) {
      console.error('❌ Generation failed:', error);
      alert('Failed to generate workouts. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-5">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center text-[#FE5858] hover:text-[#ff6b6b] font-medium transition-colors">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
          
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
              href="/btn/history" 
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              View History
            </Link>
          </div>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-2">BTN Workout Generator</h1>
          <p className="text-gray-600">Generate realistic CrossFit workouts with proper exercise selection and rep schemes</p>
          <div className="mt-4 inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Active Subscription
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold mb-4">Workout Generator</h2>
          <p className="text-gray-600 mb-6">
            Generate 10 realistic CrossFit workouts (2 per time domain) with proper exercise selection, rep schemes, and equipment consistency
          </p>
          
          <button 
            className="w-full py-3 px-6 bg-[#FE5858] text-white rounded-lg text-lg font-semibold hover:bg-[#ff6b6b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={generateWorkouts}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating Workouts...' : 'Generate 10 Workouts'}
          </button>

          {generatedWorkouts.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xl font-bold mb-4">Generated Workouts ({generatedWorkouts.length})</h3>
              <div className="space-y-6">
                {generatedWorkouts.map((workout, index) => (
                  <div key={index} className="border rounded-lg p-6 bg-gray-50">
                    <h4 className="text-lg font-bold mb-2">{workout.name}</h4>
                    <div className="flex gap-4 mb-4 text-sm text-gray-600">
                      <div>
                        <span className="font-semibold">Time Domain:</span> {workout.timeDomain}
                      </div>
                      <div>
                        <span className="font-semibold">Format:</span>{' '}
                        {workout.format === 'Rounds For Time' && workout.rounds
                          ? `${workout.rounds} Rounds For Time`
                          : workout.format === 'AMRAP' && workout.amrapTime
                          ? `AMRAP ${workout.amrapTime} minutes`
                          : `${workout.format}${workout.pattern ? `: ${workout.pattern}` : ''}`}
                      </div>
                    </div>
                    <div className="bg-white rounded p-4 mb-4">
                      <p className="font-semibold mb-2">Exercises:</p>
                      {workout.exercises.map((exercise, exIndex) => (
                        <div key={exIndex} className="flex justify-between py-1">
                          <span>
                            {workout.format === 'For Time' && workout.pattern
                              ? exercise.name
                              : `${exercise.reps} ${exercise.name}`}
                          </span>
                          {exercise.weight && <span className="text-[#FE5858] font-medium">{exercise.weight}</span>}
                        </div>
                      ))}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold">Estimated completion time:</span>{' '}
                      {workout.format === 'AMRAP'
                        ? `${workout.amrapTime} minutes`
                        : `${Math.floor(workout.duration)}:${Math.floor((workout.duration % 1) * 60)
                            .toString()
                            .padStart(2, '0')}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BTNPage() {
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

      // Check BTN subscription access
      const response = await fetch('/api/btn/check-access')
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
      
      // Create checkout session (works for both logged in and logged out users)
      const response = await fetch('/api/btn/create-checkout', {
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

  // User is not logged in - show them the paywall so they can subscribe
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-8">
          <div className="mb-6">
            <Link href="/" className="inline-flex items-center text-[#FE5858] hover:text-[#ff6b6b] font-medium transition-colors">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </Link>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-12">
            <div className="text-center mb-8">
              <div className="mb-6">
                <svg className="w-20 h-20 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">BTN Workout Generator</h1>
              <p className="text-xl text-gray-600 mb-8">
                Premium workout generation requires a subscription
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-8 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">What You&apos;ll Get</h2>
              <ul className="space-y-4 max-w-md mx-auto">
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">AI-powered workout generation tailored to your goals</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Customized programming based on your equipment and preferences</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Unlimited workout generation and modifications</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Access to premium training algorithms and insights</span>
                </li>
              </ul>
            </div>

            <div className="text-center">
              <button
                onClick={handleSubscribe}
                disabled={checkingOut}
                className="inline-block px-8 py-4 bg-[#FE5858] text-white rounded-lg text-lg font-semibold hover:bg-[#ff6b6b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkingOut ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                Secure payment powered by Stripe • Create account during checkout
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // User has access - show the BTN generator
  if (subscriptionStatus.hasAccess) {
    return <BTNWorkoutGenerator />
  }

  // User does not have access - show paywall
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-[#FE5858] hover:text-[#ff6b6b] font-medium transition-colors">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-12">
          <div className="text-center mb-8">
            <div className="mb-6">
              <svg className="w-20 h-20 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">BTN Workout Generator</h1>
            <p className="text-xl text-gray-600 mb-8">
              Premium workout generation requires a subscription
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">What You&apos;ll Get</h2>
            <ul className="space-y-4 max-w-md mx-auto">
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">AI-powered workout generation tailored to your goals</span>
              </li>
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">Customized programming based on your equipment and preferences</span>
              </li>
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">Unlimited workout generation and modifications</span>
              </li>
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">Access to premium training algorithms and insights</span>
              </li>
            </ul>
          </div>

          <div className="text-center">
            <button
              onClick={handleSubscribe}
              disabled={checkingOut}
              className="inline-block px-8 py-4 bg-[#FE5858] text-white rounded-lg text-lg font-semibold hover:bg-[#ff6b6b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkingOut ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
              Secure payment powered by Stripe
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
