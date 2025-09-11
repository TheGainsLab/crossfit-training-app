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
      router.push('/dashboard')
    } else {
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
          <h1 className="text-4xl md:text-6xl font-bold mb-2">AI-Powered Performance</h1>
          <h2 className="text-3xl md:text-5xl font-semibold mb-6">In Your Pocket</h2>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">GainsAI learns from every rep, so every workout is high impact</p>
          <button
            onClick={() => router.push('/start')}
            className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Start Your AI-Powered Journey
          </button>
        </div>
      </section>

      {/* What is GainsAI Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">What is Gains AI?</h2>
          <div className="max-w-4xl mx-auto">
            <p className="text-lg text-gray-700 mb-8 text-center">
              GainsAI is an advanced AI powered by your performance history, goals and feedback. As you train, it learns and adapts, tailoring live program adjustments and coaching advice specifically to you.
            </p>
            
            <div className="bg-blue-50 rounded-lg p-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">Personalized Guidance</h3>
              <p className="text-gray-700 mb-6 text-center">GainsAI connects to all of your information to maximize every aspect of your training. Ask it anything!</p>
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <p className="text-gray-900 font-medium">I need a pacing strategy for today’s MetCon.</p>
                  <p className="text-gray-700 mt-2"><span className="font-semibold">GainsAI:</span> Based on your 1RMs, you’ll maximize your score with fast singles on the cleans and short sets of toes to bar. This will make your transitions faster and reduce wasted time.</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <p className="text-gray-900 font-medium">Help me plan my meals for the week. I want to eat 150-175g of protein per day.</p>
                  <p className="text-gray-700 mt-2"><span className="font-semibold">GainsAI:</span> Here are 6 meal suggestions. Tell me your favorites and I’ll suggest some more like those.</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <p className="text-gray-900 font-medium">Explain the benefit of doing cardio in a fasted state.</p>
                  <p className="text-gray-700 mt-2"><span className="font-semibold">GainsAI:</span> Fasted cardio can have some benefits in terms of mitochondrial biogenesis, due to demand for increased fat utilization. However, some athletes report decreased intensity. Want to learn more?</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <p className="text-gray-900 font-medium">I’m traveling this week and will be in a hotel gym. Help me revise my training for the next 3 days.</p>
                  <p className="text-gray-700 mt-2"><span className="font-semibold">GainsAI:</span> No problem. Most hotel gyms have light dumbbells and treadmills. Here are some workouts that mirror the stimulus of your program.</p>
                </div>
              </div>
              <p className="text-center text-gray-900 font-semibold mt-6">Stop following generic plans. Be the main character in your training.</p>
              <div className="text-center mt-6">
                <a
                  href="https://www.thegainsapps.com/start"
                  className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                >
                  Start Now
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How GainsAI Adapts Your Training (retained layout, updated copy) */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">From Data to Gains.</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-xl">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Tell us your goals and start training.</h3>
              <p className="text-gray-600">Easily record sets, reps, RPE and quality with a few taps on the screen</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-xl">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">AI analyzes everything</h3>
              <p className="text-gray-600">GainsAI analyzes results of after every workout, recognizing opportunities for patterns and growth</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-xl">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">AI-Powered adjustments</h3>
              <p className="text-gray-600">Your program automatically adjusts—intelligently updating exercises, volume, and intensity to break plateaus and fuel your progress.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Better Data, Bigger Gains */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Better Data, Bigger Gains</h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            <strong>See exactly where you're improving, where you might plateau, and what to focus on next.</strong>
          </p>
          <p className="text-lg text-gray-700 max-w-4xl mx-auto">
            Dive into your personal analytics dashboard. Review strength trends, conditioning improvements, and skill mastery. GainsAI doesn't just collect data—it translates it into insights you can actually use to get better, faster.
          </p>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Choose Your Plan</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            
            {/* Monthly Plan */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg p-12 text-center">
              <h3 className="text-3xl font-bold mb-6">Monthly</h3>
              <div className="text-6xl font-bold mb-8">$89<span className="text-2xl font-normal">/month</span></div>
              
              <a
                href="https://buy.stripe.com/test_4gM14odqnavRezneey6Zy00"
                className="block w-full bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors mb-4"
              >
                Start Monthly Plan
              </a>
              <p className="text-sm text-blue-100">
                Cancel anytime. No contracts.
              </p>
            </div>

            {/* Quarterly Plan */}
            <div className="bg-gradient-to-r from-green-600 to-green-800 text-white rounded-lg p-12 text-center relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-sm font-semibold">
                BEST VALUE
              </div>
              <h3 className="text-3xl font-bold mb-6">Quarterly</h3>
              <div className="text-6xl font-bold mb-4">$225<span className="text-2xl font-normal">/quarter</span></div>
              <div className="text-lg mb-8">
                <span className="bg-green-700 px-3 py-1 rounded-full">Save $42 vs Monthly</span>
              </div>
              
              <a
                href="https://buy.stripe.com/test_7sY5kE8635bx76V7Qa6Zy01"
                className="block w-full bg-white text-green-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors mb-4"
              >
                Start Quarterly Plan
              </a>
              <p className="text-sm text-green-100">
                Billed every 3 months. Cancel anytime.
              </p>
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

      {/* Getting Started Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Getting Started: Your Journey to Smarter Gains</h2>
          <div className="grid md:grid-cols-4 gap-8 mt-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-xl">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Set Your Foundation</h3>
              <p className="text-gray-600">Complete a quick assessment of your goals, strength levels, and equipment. GainsAI™ uses this to build your 100% personalized baseline program.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-xl">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Train & Log with Ease</h3>
              <p className="text-gray-600">Execute your workouts and log your results with simple taps. Your sets and reps are tracked automatically. Just add your RPE and quality notes.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-xl">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Get AI-Powered Adjustments</h3>
              <p className="text-gray-600">This is where the magic happens. GainsAI works behind the scenes, evolving your programming in real-time to push you past plateaus and capitalize on breakthroughs.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-xl">4</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Ask & Analyze</h3>
              <p className="text-gray-600">Get instant coaching on any fitness topic, backed by your entire training history. Understand your data and make informed decisions like never before.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Train Smarter?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">Stop following generic programs. Start training with GainsAI™—the only platform that combines personalized CrossFit programming with advanced AI coaching.</p>
          <button
            onClick={handleGetStarted}
            className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Start Your GainsAI™ Journey
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">The Gains Apps</h3>
              <p className="text-gray-400">Personalized CrossFit training programs powered by GainsAI™. Built by coaches, enhanced by artificial intelligence.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
                <li><a href="#" className="hover:text-white">Help Center</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 The Gains Apps. All rights reserved. GainsAI™ is a trademark of The Gains Apps.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
