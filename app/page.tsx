'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
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
          <p className="text-xl md:text-2xl mb-6 max-w-3xl mx-auto">
            Following other people will never get you to your goals.
          </p>
          <p className="text-xl md:text-2xl mb-6 max-w-3xl mx-auto font-semibold">
            Gains AI is not a program.
          </p>
          <p className="text-xl md:text-2xl mb-6 max-w-3xl mx-auto">
            It's a 100% personalized training system built from your data — combining AI-amplified coaching, proven sports science, and modern technology to deliver training and guidance centered entirely on you.
          </p>
          <p className="text-xl md:text-2xl mb-6 max-w-3xl mx-auto font-semibold">
            You're not adapting to a plan.
          </p>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto font-semibold">
            The plan adapts to you.
          </p>
          <p className="text-lg md:text-xl mb-8 max-w-3xl mx-auto">
            It's not just training. Built-in nutrition tracking is included for every user: photo logging, barcode scans, saved meals, macros, and BMR/TDEE estimates — so fueling finally aligns with training, all in one place.
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

          {/* Image: Profile Overview + Percentile Heatmap */}
          <div className="mt-12 rounded-lg overflow-hidden shadow-lg max-w-4xl mx-auto">
            <Image
              src="/home/profile-overview-percentile-heatmap.png"
              alt="Profile Overview + Percentile Heatmap"
              width={800}
              height={600}
              className="w-full h-auto"
            />
          </div>
          <p className="text-center text-gray-600 italic text-sm mt-4">
            Your training, mapped — not averaged. Strength, skills, and conditioning analyzed together to build a plan that actually fits you.
          </p>
        </div>
      </section>

      {/* Timeless Principles Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">TIMELESS PRINCIPLES, MODERNIZED</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Training fundamentals don't change. Exercise science is well understood — even CrossFit is over 25 years old.
            </p>
            <p className="text-lg text-gray-700">
              Yet most athletes still bounce between programs, chasing trends, social media hype, or copying someone else's results.
            </p>
            <p className="text-lg text-gray-700">
              The problem isn't knowledge. It's delivery.
            </p>
            <p className="text-lg text-gray-700">
              The industry still relies on outdated models: group classes turned into spreadsheets, then packaged as apps. Most platforms are static plans with minimal real feedback — fresh coats of paint, but no upgrades underneath.
            </p>
            <p className="text-lg text-gray-700">
              Gains AI is different. It's a modern, adaptive system that evolves with every session you log — making true personalization the default, not a premium add-on.
            </p>

            {/* Image: Skills Card */}
            <div className="mt-8 rounded-lg overflow-hidden shadow-lg">
              <Image
                src="/home/skills-card-avg-rpe.png"
                alt="Skills Card - Reps / RPE / Quality tracking"
                width={800}
                height={600}
                className="w-full h-auto"
              />
            </div>
            <p className="text-center text-gray-600 italic text-sm mt-4">
              Training is more than checking a box. We track how much you practice, how hard it feels, and how well it's executed.
            </p>
          </div>
        </div>
      </section>

      {/* AI Is A Tool Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">AI POWERED?  REALLY?</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              "AI-powered" has become a hollow buzzword. No one chooses a gym for its computers.
            </p>
            <p className="text-lg text-gray-700">
              Training still comes down to fundamentals: sound principles, effort, and consistency. Barbells, pull-up bars, and a clock will take most athletes further than silicon and servers ever will. So why AI at all?
            </p>
            <p className="text-lg text-gray-700">
              Because used correctly, AI is a tireless analyst.
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
              AI keeps your program aligned with your progress — but it never takes control.
            </p>
            <p className="text-lg text-gray-700">
              You can make small adjustments directly in the app. The system recognizes and logs them automatically. For bigger questions, you message real coaches — never an AI chatbot — with full visibility into your data.
            </p>

            {/* Image: Heart Rate Heatmap */}
            <div className="mt-8 rounded-lg overflow-hidden shadow-lg">
              <Image
                src="/home/HR-Heatmap.png"
                alt="Heart Rate Heatmap"
                width={800}
                height={600}
                className="w-full h-auto"
              />
            </div>
            <p className="text-center text-gray-600 italic text-sm mt-4">
              Output is only half the story. Peak and average heart rate show what each task costs you — revealing efficiency and fatigue.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">HOW IT WORKS</h2>
          <p className="text-xl text-gray-700 text-center max-w-3xl mx-auto mb-12">
            You don't follow a program from someone else. Your data builds the program — and AI keeps it aligned with your progress.
          </p>
          
          {/* Step 1 */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#FE5858' }}>
                <span className="text-white font-bold text-xl">1</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Diagnostic</h3>
            </div>
            <p className="text-lg text-gray-700 mb-4">
              Map your real abilities — strength, skills, and conditioning — across movements and time domains.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              This process reveals imbalances, gaps, and high-leverage opportunities. Your profile updates continuously as you train, becoming the system's source of truth.
            </p>
            
            {/* Image: Strength Summary + Olympic Lift Ratios */}
            <div className="rounded-lg overflow-hidden shadow-lg">
              <Image
                src="/home/strength-summary-oly-ratios.png"
                alt="Strength Summary + Olympic Lift Ratios"
                width={800}
                height={600}
                className="w-full h-auto"
              />
            </div>
            <p className="text-center text-gray-600 italic text-sm mt-4">
              Strength in context. See how your lifts stack up against proven ratios—and pinpoint where gains matter most.
            </p>
          </div>

          {/* Step 2 */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#FE5858' }}>
                <span className="text-white font-bold text-xl">2</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">AI-Engineered Training</h3>
            </div>
            <p className="text-lg text-gray-700 mb-4">
              Your personal profile drives your training — so it's fully personalized by design.
            </p>
            <p className="text-lg text-gray-700 mb-4">That means:</p>
            <ul className="space-y-3 ml-6 mb-6">
              <li className="text-lg text-gray-700">• Strength progressions deliver the specific stimulus each lift needs, with accessories selected to support it</li>
              <li className="text-lg text-gray-700">• Technical work tightens pulls and positioning to correct imbalances and close gaps</li>
              <li className="text-lg text-gray-700">• Skill work prioritizes execution quality — no junk volume</li>
              <li className="text-lg text-gray-700">• Conditioning spans all relevant time domains and intensities</li>
            </ul>
            <p className="text-lg text-gray-700 mb-6">
              No filler. Nothing generic.
            </p>
            
            {/* Image: Technical Focus Screen */}
            <div className="rounded-lg overflow-hidden shadow-lg">
              <Image
                src="/home/technical-focus-screen.png"
                alt="Technical Focus Screen"
                width={800}
                height={600}
                className="w-full h-auto"
              />
            </div>
            <p className="text-center text-gray-600 italic text-sm mt-4">
              Clear signals. No guesswork. Objective ratios reveal what's truly holding you back—so you fix root causes, not chase symptoms.
            </p>
          </div>

          {/* Step 3 */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#FE5858' }}>
                <span className="text-white font-bold text-xl">3</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Capture Signal, Not Just Scores</h3>
            </div>
            <p className="text-lg text-gray-700 mb-4">
              Logging takes seconds. Insights compound forever.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              Each session captures performance data — plus perceived effort (RPE) and execution quality. This turns training into structured data, revealing not just what you did, but how you're responding to it over time.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              That feedback continuously updates your profile and informs what comes next.
            </p>
            
            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Skills Card (Avg RPE selected)<br/>
                Effort counts—but context wins. See exactly how demanding different skills are for <strong>your</strong> body.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#FE5858' }}>
                <span className="text-white font-bold text-xl">4</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Adaptation</h3>
            </div>
            <p className="text-lg text-gray-700 mb-4">
              Gains AI detects patterns traditional programs miss.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              By mapping results at the task and time-domain level, the system sees all dimensions of your fitness and performance — not just totals or averages.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              Training adjusts automatically — pacing, volume, and emphasis — so the system stays aligned with who you are now, not who you were weeks ago.
            </p>
            
            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Percentile Heatmap<br/>
                Fitness isn't a single score. Performance varies by movement and domain—we track it all in detail.
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
              AI provides analysis. Coaches add judgment.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              Message real coaches anytime. With full visibility into your data and system insights, we skip generic advice and move straight to targeted feedback.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              Share videos. Get precise corrections. Coaching stays human. Decisions stay data-informed.
            </p>
            
            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Messaging / Coaching View<br/>
                Human judgment, supercharged by data. Your coach sees what you see—and what the system sees.
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
            <p className="text-lg text-gray-700 font-semibold">
              From logs to intelligence.
            </p>
            <p className="text-lg text-gray-700">
              Most fitness apps store results as notes. That limits insight to sorting, filtering, and looking back.
            </p>
            <p className="text-lg text-gray-700">
              Gains AI is built on structured training data.
            </p>
            <p className="text-lg text-gray-700">
              Every lift, interval, skill, and effort signal is captured with context — turning training history into a usable knowledge base.
            </p>
            <p className="text-lg text-gray-700">
              That structure allows the system to understand performance precisely, not approximately.
            </p>
            <p className="text-lg text-gray-700 font-semibold">
              If the system sees it, you see it.
            </p>
            <p className="text-lg text-gray-700">
              No black boxes. No hidden logic.
            </p>
            <p className="text-lg text-gray-700">
              Track trends. Compare movements and time domains. Watch how your training is evolving in real time. You own your data — and with it, control over your progress.
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
