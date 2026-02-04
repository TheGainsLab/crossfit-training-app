'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Footer from './components/Footer'

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
      router.push('/start')
    }
  }

  const handleSignIn = () => {
    router.push('/auth/signin')
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Global Navigation is rendered via app/layout.tsx */}

      {/* Hero Section */}
      <section className="py-20" style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Stop Doing Someone Else's Workout.</h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            Generic programs ignore your real strengths, weaknesses, and goals.
          </p>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            Gains AI creates — and constantly evolves — a 100% personalized plan using your data, proven sports science, and AI-amplified expert coaching.
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
          <p className="text-sm text-gray-600">3-day free trial • No credit card required.</p>

          {/* 📱 IMAGE PLACEHOLDER: Profile Overview + Percentile Heatmap */}
          <div className="mt-12 bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
            <p className="text-gray-400 italic text-sm">
              📱 Image: Profile Overview + Percentile Heatmap<br/>
              Your training, mapped — not averaged. Strength, skills, and conditioning analyzed together to build a plan that actually fits you.
            </p>
          </div>
        </div>
      </section>

      {/* Timeless Principles Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">TIMELESS PRINCIPLES, MODERNIZED</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              The foundations of training are well understood. Exercise physiology is largely solved — and even CrossFit itself is over 25 years old.
            </p>
            <p className="text-lg text-gray-700">
              But athletes still bounce from program to program, chasing novelty, social media hype, or someone else's results.
            </p>
            <p className="text-lg text-gray-700">
              The problem isn't knowledge. It's delivery.
            </p>
            <p className="text-lg text-gray-700">
              The industry is still stuck in a low-tech model: repackaged group programs born in the era of PDFs and spreadsheets.  Even today, most fitness apps are little more than spreadsheets on your phone — static plans with limited feedback.
            </p>
            <p className="text-lg text-gray-700">
              Gains AI is built differently: a modern system that adapts as you train — making real personalization the standard, not the upgrade.
            </p>

            {/* 📱 IMAGE PLACEHOLDER: Skills Card */}
            <div className="mt-8 bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Skills Card (Reps / RPE / Quality toggle)<br/>
                Training is more than checking a box. We track how much you practice, how hard it feels, and how well it's executed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AI Is A Tool Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">AI POWERED?  REALLY?</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              "AI-powered" has become a hollow buzzword.
            </p>
            <p className="text-lg text-gray-700">
              Training is simple: basics + effort + consistency = results.  So why use AI at all?  Because AI is a tireless analyst.
            </p>
            <p className="text-lg text-gray-700">
              Gains AI doesn't replace coaching. It supports it by:
            </p>
            <ul className="space-y-3 ml-6">
              <li className="text-lg text-gray-700">• Detecting subtle performance and fatigue patterns</li>
              <li className="text-lg text-gray-700">• Flagging burnout risk before it shows up as stalled progress</li>
              <li className="text-lg text-gray-700">• Adjusting pacing, volume, and emphasis based on real data</li>
            </ul>
            <p className="text-lg text-gray-700">
              Your program stays aligned with your body's actual signals — not group templates.
            </p>

            {/* 📱 IMAGE PLACEHOLDER: Heart Rate Heatmap */}
            <div className="mt-8 bg-white rounded-lg shadow-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Heart Rate Heatmap<br/>
                Output is only half the story. Peak and average heart rate show what each task costs you — revealing efficiency and fatigue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">HOW IT WORKS</h2>
          
          {/* Step 1 */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#FE5858' }}>
                <span className="text-white font-bold text-xl">1</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Comprehensive Diagnostic</h3>
            </div>
            <p className="text-lg text-gray-700 mb-4">
              At signup, we assess strength, skills, and conditioning across movements and time domains.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              Imbalances, gaps, and opportunities are visible in your profile — and update continuously as you train.
            </p>
            
            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Strength Summary + Olympic Lift Ratios<br/>
                Strength in context. See how your lifts compare to proven ratios — and where improvements matter most.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#FE5858' }}>
                <span className="text-white font-bold text-xl">2</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">AI-Engineered Programming</h3>
            </div>
            <p className="text-lg text-gray-700 mb-4">
              Your program is built from your actual profile — not a category you were sorted into.
            </p>
            <p className="text-lg text-gray-700 mb-4">That includes:</p>
            <ul className="space-y-3 ml-6 mb-6">
              <li className="text-lg text-gray-700">• Strength progressions targeted to weak links</li>
              <li className="text-lg text-gray-700">• Technical work driven by limiting factors</li>
              <li className="text-lg text-gray-700">• Skill practice structured for exposure, effort, and quality</li>
              <li className="text-lg text-gray-700">• Conditioning designed across time domains</li>
            </ul>
            <p className="text-lg text-gray-700 mb-6">
              No filler. No junk volume. No generic templates.
            </p>
            
            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Technical Focus Screen<br/>
                Clear signals. No guesswork. Objective ratios highlight what's limiting progress — so training fixes causes, not symptoms.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#FE5858' }}>
                <span className="text-white font-bold text-xl">3</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Train, Log, and Analyze</h3>
            </div>
            <p className="text-lg text-gray-700 mb-4">
              Logging takes seconds, but the insight compounds.
            </p>
            <p className="text-lg text-gray-700 mb-4">Each session captures:</p>
            <ul className="space-y-3 ml-6 mb-4">
              <li className="text-lg text-gray-700">• Performance</li>
              <li className="text-lg text-gray-700">• Perceived effort (RPE)</li>
              <li className="text-lg text-gray-700">• Self-reported execution quality</li>
            </ul>
            <p className="text-lg text-gray-700 mb-6">
              Over time, this builds a personal analytics profile — showing not just what you did, but how it affected you.
            </p>
            
            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Skills Card (Avg RPE selected)<br/>
                Effort matters — but context matters more. See how hard different skills actually cost you.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#FE5858' }}>
                <span className="text-white font-bold text-xl">4</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Continuous Adaptation</h3>
            </div>
            <p className="text-lg text-gray-700 mb-4">
              As your data accumulates, Gains AI detects patterns that static programs miss:
            </p>
            <ul className="space-y-3 ml-6 mb-4">
              <li className="text-lg text-gray-700">• Efficiency changes</li>
              <li className="text-lg text-gray-700">• Tolerance limits</li>
              <li className="text-lg text-gray-700">• Technique breakdown under fatigue</li>
            </ul>
            <p className="text-lg text-gray-700 mb-6">
              Your training adjusts — pacing, volume, emphasis — so progress continues without burning out.
            </p>
            
            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Percentile Heatmap<br/>
                Fitness isn't one number. Performance changes by movement and time domain. We track it all.
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#FE5858' }}>
                <span className="text-white font-bold text-xl">5</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Expert Coaching, Amplified</h3>
            </div>
            <p className="text-lg text-gray-700 mb-4">
              AI provides insight. Coaches provide judgment.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              Message us anytime. With full visibility into your data and AI analysis, conversations start at the right level — not with guesswork.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              Share video. Get targeted feedback. Coaching stays human. Decisions stay informed.
            </p>
            
            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Messaging / Coaching View<br/>
                Human judgment, backed by data. Coaches see exactly what you see — and what the system sees.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Data Dominance Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">DATA DOMINANCE</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Most fitness apps store results as notes. That limits insight to sorting and filtering.
            </p>
            <p className="text-lg text-gray-700">
              Gains AI is built on structured training data — giving both you and the system the context needed to understand performance precisely.
            </p>
            <p className="text-lg text-gray-700 font-semibold">
              If the system sees it, you see it.
            </p>
            <p className="text-lg text-gray-700">
              Track trends. Compare domains. Understand how training is evolving in real time. You own your data — and with it, control over your progress.
            </p>

            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="mt-8 bg-white rounded-lg shadow-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Combined Analytics (Percentile + HR Heatmaps)<br/>
                No black boxes. Every adjustment comes from data you can see and understand.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Teamwork Not Templates Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">TEAMWORK, NOT TEMPLATES</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Programs are personalized — but never locked in.
            </p>
            <p className="text-lg text-gray-700">Change focus anytime:</p>
            <ul className="space-y-3 ml-6">
              <li className="text-lg text-gray-700">• Emphasize a lift</li>
              <li className="text-lg text-gray-700">• Add or remove skills</li>
              <li className="text-lg text-gray-700">• Adjust for travel, equipment, or schedule</li>
            </ul>
            <p className="text-lg text-gray-700">
              The system adapts without resetting progress or forcing a new program.
            </p>
            <p className="text-lg text-gray-700">
              Because your data is structured, flexibility doesn't mean starting over — it means adjusting intelligently.
            </p>

            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="mt-8 bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Skills Card or Strength Summary<br/>
                Your training evolves with you. No resets. No starting over. Just smarter adjustments.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16" style={{ backgroundColor: '#282B34', color: '#FFFFFF' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-8">Train with a system that understands you.</h2>
          
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
              Download on App Store
            </a>
            
            <a
              href="YOUR_GOOGLE_PLAY_LINK"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg text-lg font-semibold transition-colors hover:opacity-90"
              style={{ backgroundColor: '#FFFFFF', color: '#282B34' }}
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
              </svg>
              Get it on Google Play
            </a>
          </div>
          <p className="text-sm text-gray-400">3-day free trial • No credit card required</p>
        </div>
      </section>

      <Footer variant="full" />
    </div>
  )
}
