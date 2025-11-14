'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GeneratedWorkout, UserProfile } from '@/lib/btn/types';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [generatedWorkouts, setGeneratedWorkouts] = useState<GeneratedWorkout[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedWorkouts, setSavedWorkouts] = useState<Set<number>>(new Set());
  const [savingWorkouts, setSavingWorkouts] = useState<Set<number>>(new Set());
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [requireBarbell, setRequireBarbell] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const timeDomains = [
    '1:00 - 5:00',
    '5:00 - 10:00',
    '10:00 - 15:00',
    '15:00 - 20:00',
    '20:00+'
  ];

  // Fetch user profile
  const fetchUserProfile = async () => {
    try {
      console.log('📊 Fetching user profile...');
      const response = await fetch('/api/btn/user-profile');
      
      if (!response.ok) {
        console.warn('⚠️ Failed to fetch user profile, using defaults');
        setProfileLoading(false);
        return;
      }
      
      const data = await response.json();
      if (data.success && data.profile) {
        setUserProfile(data.profile);
        console.log('✅ User profile loaded:', {
          equipment: data.profile.equipment.length,
          skills: Object.keys(data.profile.skills).length,
          oneRMs: Object.keys(data.profile.oneRMs).length
        });
      }
    } catch (error) {
      console.error('❌ Error fetching user profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  // Fetch user profile on mount and when URL has refresh parameter
  useEffect(() => {
    fetchUserProfile();
  }, []);

  // Handle profile refresh from URL parameter
  useEffect(() => {
    if (searchParams.get('refreshed') === 'true') {
      console.log('🔄 Profile was updated, refreshing...');
      fetchUserProfile();
      // Clean URL by removing the query parameter
      router.replace('/btn', { scroll: false });
    }
  }, [searchParams, router]);

  const toggleDomain = (domain: string) => {
    setSelectedDomains(prev => 
      prev.includes(domain)
        ? prev.filter(d => d !== domain)
        : [...prev, domain]
    );
  };

  const generateWorkouts = async () => {
    setIsGenerating(true);
    try {
      console.log('🎲 Generating workouts...');
      console.log('Selected domains:', selectedDomains.length > 0 ? selectedDomains : 'all (random)');
      console.log('Using profile:', userProfile ? 'Yes' : 'No (default generator)');
      
      const workouts = generateTestWorkouts(
        selectedDomains.length > 0 ? selectedDomains : undefined,
        userProfile || undefined,
        requireBarbell ? ['Barbell'] : undefined
      );
      
      // Display workouts immediately (no auto-save)
      setGeneratedWorkouts(workouts);
      setSavedWorkouts(new Set()); // Clear saved state
      console.log(`✅ Generated ${workouts.length} workouts`);
    } catch (error) {
      console.error('❌ Generation failed:', error);
      alert('Failed to generate workouts. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveWorkout = async (workout: GeneratedWorkout, index: number) => {
    setSavingWorkouts(prev => new Set(prev).add(index));
    
    try {
      const response = await fetch('/api/btn/save-workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workouts: [workout] })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save workout');
      }

      // Mark as saved
      setSavedWorkouts(prev => new Set(prev).add(index));
      
      // Show success toast
      const message = document.createElement('div');
      message.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-6 py-3 rounded-lg shadow-lg z-50';
      message.innerHTML = `✅ Workout saved to history!`;
      document.body.appendChild(message);
      setTimeout(() => message.remove(), 3000);
    } catch (error: any) {
      console.error('❌ Save failed:', error);
      alert(`Failed to save workout: ${error.message}`);
    } finally {
      setSavingWorkouts(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  const discardWorkout = (index: number) => {
    setGeneratedWorkouts(prev => prev.filter((_, i) => i !== index));
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
          <p className="text-gray-600">Build a personalized workout library</p>
          <div className="mt-4 inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Active Subscription
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-8 mb-8">
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Select Time Domains:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {timeDomains.map((domain) => (
                <label
                  key={domain}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedDomains.includes(domain)
                      ? 'border-[#FE5858] bg-red-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedDomains.includes(domain)}
                    onChange={() => toggleDomain(domain)}
                    className="w-4 h-4 text-[#FE5858] rounded focus:ring-[#FE5858]"
                  />
                  <span className="text-sm font-medium">{domain}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {selectedDomains.length === 0 
                ? 'No domains selected - will generate 5 random workouts'
                : selectedDomains.length >= 5
                ? `Will generate 1 workout from each selected domain`
                : `Will generate at least 1 from each selected domain, filling remainder randomly`
              }
            </p>
          </div>
          
          {/* Dividing line */}
          <div className="my-6 border-t border-gray-300"></div>
          
          {/* Equipment Filter Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Select Equipment:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <label
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                  requireBarbell
                    ? 'border-[#FE5858] bg-red-50'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={requireBarbell}
                  onChange={() => setRequireBarbell(!requireBarbell)}
                  className="w-4 h-4 text-[#FE5858] rounded focus:ring-[#FE5858]"
                />
                <span className="text-sm font-medium">Barbell</span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {requireBarbell 
                ? 'All workouts will include at least one barbell exercise'
                : 'No equipment filter - workouts may include any equipment'
              }
            </p>
          </div>
          
          <button 
            className="w-full py-3 px-6 bg-[#FE5858] text-white rounded-lg text-lg font-semibold hover:bg-[#ff6b6b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={generateWorkouts}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating Workouts...' : 'Generate 5 Workouts'}
          </button>

          {generatedWorkouts.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xl font-bold mb-4">Generated Workouts ({generatedWorkouts.length})</h3>
              <div className="space-y-6">
                {generatedWorkouts.map((workout, index) => (
                  <div key={index} className="border rounded-lg p-6" style={{ backgroundColor: '#F8FBFE' }}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-lg font-bold">{workout.name}</h4>
                      <div className="flex gap-2">
                        {!savedWorkouts.has(index) ? (
                          <>
                            <button
                              onClick={() => saveWorkout(workout, index)}
                              disabled={savingWorkouts.has(index)}
                              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ backgroundColor: '#FE5858', color: '#F8FBFE' }}
                            >
                              {savingWorkouts.has(index) ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => discardWorkout(index)}
                              disabled={savingWorkouts.has(index)}
                              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}
                            >
                              Discard
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg text-sm font-medium">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Saved
                          </div>
                        )}
                      </div>
                    </div>
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
                    
                    {/* Benchmark Scores */}
                    {workout.medianScore && workout.excellentScore && (
                      <div className="mb-4 p-3 border rounded-lg" style={{ backgroundColor: '#FFFFFF' }}>
                        <div className="text-sm font-semibold mb-2 text-center" style={{ color: '#FE5858' }}>Performance Benchmarks</div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-600">50th Percentile (Median):</span>
                            <span className="ml-2 font-semibold" style={{ color: '#FE5858' }}>{workout.medianScore}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">90th Percentile (Excellent):</span>
                            <span className="ml-2 font-semibold" style={{ color: '#FE5858' }}>{workout.excellentScore}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="rounded p-4 mb-4" style={{ backgroundColor: '#FFFFFF' }}>
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
