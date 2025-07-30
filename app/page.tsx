'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    checkUser()
  }, [])

  const handleGetStarted = () => {
    if (user) {
      // User is already signed in, redirect to dashboard
      router.push('/dashboard')
    } else {
      // User needs to sign up, redirect to signup
      router.push('/auth/signup')
    }
  }

  const handleSignIn = () => {
    router.push('/auth/signin')
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">The Gains Apps</h1>
            </div>
            <div className="flex items-center space-x-4">
              {loading ? (
                <div className="w-20 h-8 bg-gray-200 animate-pulse rounded"></div>
              ) : user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-gray-700">Welcome back!</span>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
                  >
                    Dashboard
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleSignIn}
                    className="text-gray-700 hover:text-blue-600 font-medium"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={handleGetStarted}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Get Your Perfect CrossFit Program
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            Personalized strength and conditioning programs tailored to your equipment, goals, and ability level. Built by coaches, for athletes.
          </p>
          <button
            onClick={handleGetStarted}
            className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Start Your Program Today
          </button>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-xl">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Subscribe</h3>
              <p className="text-gray-600">Choose your monthly subscription and create your account</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-xl">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Complete Assessment</h3>
              <p className="text-gray-600">Tell us about your equipment, goals, and experience level</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-xl">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Get Your Program</h3>
              <p className="text-gray-600">Our engine creates a personalized 13-week program</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-xl">4</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Train & Progress</h3>
              <p className="text-gray-600">Follow your program and track your gains</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Placeholder */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Why Choose The Gains Apps?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-4">Truly Personalized</h3>
              <p className="text-gray-600">Every program is created specifically for your equipment, goals, and ability level. No generic templates.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-4">Progressive Reveal</h3>
              <p className="text-gray-600">See 20 days at a time to stay focused. Unlock full 13-week programs after 3 months.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-4">Flexible Pacing</h3>
              <p className="text-gray-600">Life happens. Take breaks, go on vacation - your program adapts to your schedule.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-4">Test & Restart</h3>
              <p className="text-gray-600">Week 13 is testing week. See your progress and start a new personalized cycle.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-4">Easy Updates</h3>
              <p className="text-gray-600">Got new equipment? Changed goals? Update your profile and get a fresh program.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-4">Built by Coaches</h3>
              <p className="text-gray-600">Created by strength and conditioning professionals who understand real training.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Choose Your Plan</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            
            {/* Monthly Plan */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg p-8 text-center">
              <h3 className="text-2xl font-bold mb-4">Monthly</h3>
              <div className="text-5xl font-bold mb-2">$89<span className="text-lg font-normal">/month</span></div>
              <p className="mb-6">Perfect for getting started</p>
              <ul className="text-left space-y-2 mb-8">
                <li className="flex items-center"><span className="mr-2">✓</span> Personalized 13-week programs</li>
                <li className="flex items-center"><span className="mr-2">✓</span> Progressive reveal (20 days at a time)</li>
                <li className="flex items-center"><span className="mr-2">✓</span> Unlimited program updates</li>
                <li className="flex items-center"><span className="mr-2">✓</span> Full program access after 3 months</li>
                <li className="flex items-center"><span className="mr-2">✓</span> Expert coaching methodology</li>
              </ul>
              
              <div className="space-y-4">
                <a
                  href="https://buy.stripe.com/test_4gM14odqnavRezneey6Zy00"
                  className="block w-full bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  Start Monthly Plan
                </a>
                <p className="text-sm text-blue-100">
                  Cancel anytime. No contracts.
                </p>
              </div>
            </div>

            {/* Quarterly Plan */}
            <div className="bg-gradient-to-r from-green-600 to-green-800 text-white rounded-lg p-8 text-center relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-sm font-semibold">
                BEST VALUE
              </div>
              <h3 className="text-2xl font-bold mb-4">Quarterly</h3>
              <div className="text-5xl font-bold mb-2">$225<span className="text-lg font-normal">/quarter</span></div>
              <div className="text-sm mb-6">
                <span className="bg-green-700 px-2 py-1 rounded">Save $42 vs Monthly</span>
              </div>
              <ul className="text-left space-y-2 mb-8">
                <li className="flex items-center"><span className="mr-2">✓</span> Everything in Monthly plan</li>
                <li className="flex items-center"><span className="mr-2 text-yellow-400">★</span> <strong>Immediate full 13-week program access</strong></li>
                <li className="flex items-center"><span className="mr-2 text-yellow-400">★</span> <strong>No progressive reveal - see it all</strong></li>
                <li className="flex items-center"><span className="mr-2">✓</span> Unlimited program updates</li>
                <li className="flex items-center"><span className="mr-2">✓</span> Expert coaching methodology</li>
              </ul>
              
              <div className="space-y-4">
                <a
                  href="https://buy.stripe.com/test_7sY5kE8635bx76V7Qa6Zy01"
                  className="block w-full bg-white text-green-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  Start Quarterly Plan
                </a>
                <p className="text-sm text-green-100">
                  Billed every 3 months. Cancel anytime.
                </p>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-8">
            <p className="text-gray-600">
              <span className="inline-block w-4 h-4 bg-green-500 rounded-full mr-2"></span>
              Secure payment powered by Stripe
            </p>
          </div>
        </div>
      </section>

      {/* Social Proof / Testimonials Placeholder */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">What Athletes Are Saying</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Placeholder testimonials - you can replace with real ones */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <p className="text-gray-600 mb-4">"The personalized approach made all the difference. Finally, a program that works with my equipment and schedule."</p>
              <div className="font-semibold text-gray-900">- Sarah M., CrossFit Athlete</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <p className="text-gray-600 mb-4">"I've tried so many programs, but this one actually adapts to my abilities. The progressive reveal keeps me motivated."</p>
              <div className="font-semibold text-gray-900">- Mike T., Gym Owner</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <p className="text-gray-600 mb-4">"As a coach, I love how thorough the assessment is. It creates programs I would design myself."</p>
              <div className="font-semibold text-gray-900">- Coach Lisa R.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Your Journey?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">Join athletes who are already making gains with personalized training programs.</p>
          <button
            onClick={handleGetStarted}
            className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Get Started Today
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">The Gains Apps</h3>
              <p className="text-gray-400">Personalized CrossFit training programs built by coaches, for athletes.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
                <li><a href="#" className="hover:text-white">FAQ</a></li>
                <li><a href="#" className="hover:text-white">Help Center</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white">Billing</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 The Gains Apps. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
