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
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Stop doing someone else's workouts.</h1>
          <p className="text-xl md:text-2xl mb-6 max-w-3xl mx-auto">
            Following other people is not the path to your goals. Gains AI combines AI-amplified coaching, proven sports science, and modern technology to deliver training centered entirely on you.
          </p>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto font-semibold">
            No more following a program. The program follows you.
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
          <p className="text-sm text-gray-600">Try it free!  3 Day free Trial</p>

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
          <p className="text-xl text-gray-700 text-center font-semibold mb-8 max-w-3xl mx-auto">
            Training fundamentals don't change. Delivery has to.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Exercise science is settled — even CrossFit is over 25 years old. Yet athletes still bounce between programs, chasing trends, hype, or someone else's results.
            </p>
            <p className="text-lg text-gray-700 font-semibold">
              The problem isn't knowledge. It's delivery.
            </p>
            <p className="text-lg text-gray-700">
              The industry is stuck on outdated models: group programs, PDFs, and apps that are little more than fancy spreadsheets. Built to sell to as many people as possible, not to deliver results tailored to you.
            </p>
            <p className="text-lg text-gray-700">
              Most programs produce some results if you follow them.   But the one-size-fits-all approach means you're getting a partial solution; strong in one domain, stagnation in others.  You might hit the target sometimes, but never the bullseye.
            </p>
            <p className="text-lg text-gray-700">
              Gains AI is different. It's a modern, adaptive system that evolves with every completed session  — making true personalization the standard.
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
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">AI POWERED? REALLY?</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-8 max-w-3xl mx-auto">
            No one chooses a gym for its computers.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              "AI-powered" has become a hollow buzzword. Training still comes down to fundamentals: sound principles, effort, and consistency. Barbells, pull-up bars, and a clock will take most athletes further than silicon and servers ever will.
            </p>
            <p className="text-lg text-gray-700 font-semibold">
              So why AI at all? Because used correctly, AI is a tireless analyst.
            </p>
            <p className="text-lg text-gray-700">
              Gains AI works behind the scenes — detecting patterns, flagging burnout risk, and adjusting pacing, volume, and emphasis based on real data. You also have the flexibility to edit any item in the program, and the AI integrates your changes seamlessly. For bigger questions, you message real coaches — never an AI chatbot — with full visibility into your data.
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


      {/* Data and Teamwork Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">DATA AND TEAMWORK, NOT TEMPLATES</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-8 max-w-3xl mx-auto">
            If the system sees it, you see it.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              There are no black boxes or hidden logic. Gains AI turns your training logs into intelligence, and every insight is visible to you in real time. You own your data — and with it, control over your progress.
            </p>
            <p className="text-lg text-gray-700">
              Our structured data architecture makes this possible. Your training is organized in layers, so changes — yours or the AI's — happen at exactly the right level without disrupting everything else.  Shift priorities whenever you need to: practice specific movements before a competition, drill a newly unlocked skill, or adjust for travel, equipment, or schedule changes.
            </p>
            <p className="text-lg text-gray-700">
              Because your training history is stored as structured data, changes don't erase progress or force a reset. The system absorbs the update, preserves context, and adjusts intelligently — so direction stays clear even as priorities evolve.
            </p>

            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="mt-8 bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Combined Analytics (Percentile + HR Heatmaps)<br/>
                No black boxes. Every adjustment comes from data you can see and understand.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Short Version */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">HOW IT WORKS — THE SHORT VERSION</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-8 max-w-3xl mx-auto">
            Your data builds the program. AI keeps it aligned. Coaches keep it human.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              It starts with a diagnostic that maps your strength, skills, and conditioning to build your athlete profile. From there, AI generates training targeted to your specific data — not selected from a template. Every session you log updates the system: what you lifted, how hard it felt, how well you executed. As your data grows, training adapts automatically — at the right level, at the right time.
            </p>
            <p className="text-lg text-gray-700">
              And when you need a human perspective, real coaches are a message away with full visibility into everything the platform sees.
            </p>
            <div className="flex flex-wrap gap-4 justify-center mt-8">
              <a href="/premium" className="inline-block px-6 py-3 rounded-lg text-white font-semibold transition-colors hover:opacity-90" style={{ backgroundColor: '#FE5858' }}>
                See how Premium works
              </a>
              <a href="/appliedpower" className="inline-block px-6 py-3 rounded-lg text-white font-semibold transition-colors hover:opacity-90" style={{ backgroundColor: '#282B34' }}>
                Explore Strength
              </a>
              <a href="/engine" className="inline-block px-6 py-3 rounded-lg text-white font-semibold transition-colors hover:opacity-90" style={{ backgroundColor: '#282B34' }}>
                Explore Engine
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Train with a system that understands you.
          </h2>
          <p className="text-xl text-gray-700 mb-8 max-w-3xl mx-auto">
            Your goals. Your data. Your training — always evolving, always personal.
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
          <p className="text-sm text-gray-600">Try it free!  3 Day free Trial</p>
        </div>
      </section>

      <Footer variant="full" />
    </div>
  )
}
