export default function AppliedPowerPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="py-20" style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-8">YOUR LIFTING DESERVES ITS OWN PROGRAM.</h1>
          
          <div className="max-w-3xl mx-auto mb-8">
            <p className="text-lg md:text-xl mb-6">
              Applied Power is built from your numbers, your movement quality, and your specific weaknesses. Same AI-Powered platform. Same personalization. Focused entirely on getting you stronger.
            </p>
          </div>

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

      {/* The Problem Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">THE PROBLEM</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Most strength programs work. Lift heavy, use compound movements, recover well — you'll get stronger. That's not the hard part.
            </p>
            <p className="text-lg text-gray-700">
              The hard part is knowing where your time is best spent. Which lifts need more volume. Where technique is limiting your numbers. When a progression has stalled. Most programs can't answer those questions because they don't have your data.
            </p>
            <p className="text-lg text-gray-700">
              Gains AI starts by mapping your lifts — not just your maxes, but how they relate to each other and to your body weight. If your clean is lagging relative to your back squat, that points to a technical gap, not a strength gap. The diagnostic tells us where strength work pays off and where technical work or accessories will move the needle faster.
            </p>
            <div className="bg-gray-100 rounded-lg p-8 mt-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Strength Summary + Olympic Lift Ratios screenshot
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Three Blocks Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">THREE BLOCKS. ALL CONNECTED. ALL YOURS.</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Three blocks. All connected. All yours.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Technical work fixes the positions limiting your lifts. Strength & Power gives each lift the stimulus it needs. Accessories fill the gaps your profile reveals. The platform coordinates all three — so nothing is random and everything supports your progress.
            </p>
            <div className="bg-gray-100 rounded-lg p-8 mt-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Block structure visual
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Built From Your Data Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">BUILT FROM YOUR DATA</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              From your diagnostic, the platform generates a program targeted to your data — and adapts it as you train and log.
            </p>
            <div className="bg-gray-100 rounded-lg p-8 mt-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Technical Focus Screen screenshot
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Train, Log, Learn Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">TRAIN, LOG, LEARN</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Logging takes seconds. A few taps captures sets, reps, perceived effort, and execution quality.
            </p>
            <div className="bg-gray-100 rounded-lg p-8 mt-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Logging interface screenshot
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Continuous Adaptation Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">CONTINUOUS ADAPTATION</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              As your data grows, Gains AI adjusts automatically. If a movement is stalling, the platform intervenes at the task level. If an entire block needs restructuring, it handles that too. If your recovery data shows you need a lighter week, variables adjust across the board.
            </p>
            <div className="bg-gray-100 rounded-lg p-8 mt-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Percentile Heatmap screenshot
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Designed to Run Alongside Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">DESIGNED TO RUN ALONGSIDE YOUR TRAINING</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              This isn't a replacement for your gym programming. It's the dedicated lifting work your gym programming can't give you. Run it before class, after class, or on separate days — the platform adapts to your schedule.
            </p>
          </div>
        </div>
      </section>

      {/* Coaching and Analytics Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">COACHING AND ANALYTICS</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Everything the platform sees, you see. And so does your coach.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              When you need a human perspective, message real coaches with full visibility into your data. No catching up, no back-and-forth. Share a lift video. Get corrections grounded in what your data already shows.
            </p>
            <div className="bg-gray-100 rounded-lg p-8 mt-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Analytics + Coaching screenshots
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Stop guessing at your strength work. Let the platform build it for you.
          </h2>

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
          <p className="text-sm text-gray-600 mb-8">Try it free!  3 Day free Trial</p>

          <div className="flex flex-wrap gap-2 justify-center text-lg text-gray-700">
            <span>→ Want the full platform? Skills, MetCons, conditioning, and more.</span>
            <a href="/premium" className="text-coral-500 hover:underline font-semibold" style={{ color: '#FE5858' }}>Explore Premium</a>
          </div>
        </div>
      </section>
    </div>
  )
}
