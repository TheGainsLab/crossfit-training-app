export default function AppliedPowerPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="py-20" style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-8">YOUR LIFTING DESERVES ITS OWN PROGRAM.</h1>
          
          <div className="max-w-3xl mx-auto mb-8">
            <p className="text-lg md:text-xl mb-6">
              You train hard. You show up for the MetCons, the skills work, the conditioning. But your lifts aren't where they should be — and the group program isn't going to fix that.
            </p>
            <p className="text-lg md:text-xl mb-6">
              Strength gives you a dedicated, AI-generated lifting program built from your numbers, your movement quality, and your specific weaknesses. Same platform. Same personalization. Focused entirely on getting you stronger.
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
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Your gym program can't prioritize your lifts the way you need.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Most CrossFit programming distributes its attention across everything — strength, conditioning, skills, MetCons. That's the point. But it also means your squat gets the same generic prescription as everyone else's, your overhead position never gets the focused work it needs, and your clean is stuck at the same weight it was six months ago.
            </p>
            <p className="text-lg text-gray-700">
              You've probably tried bolting on extra lifting before or after class. Maybe you pulled a strength cycle off the internet. But without a system that tracks your progress across lifts and adjusts accordingly, you're guessing — and guessing doesn't close gaps.
            </p>
          </div>
        </div>
      </section>

      {/* Three Blocks Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">THREE BLOCKS. ALL CONNECTED. ALL YOURS.</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Focused doesn't mean incomplete.
          </p>
          <div className="max-w-4xl mx-auto space-y-8">
            <p className="text-lg text-gray-700 mb-8">
              Strength is built on three training blocks that work together to move your lifts forward:
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Technical</h3>
                <p className="text-lg text-gray-700">
                  Pulls, holds, and positioning work that targets the movement quality behind your lifts. If your clean is limited by your pull, this is where it gets fixed. Root causes, not symptoms.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Strength & Power</h3>
                <p className="text-lg text-gray-700">
                  The sets, reps, and weight your lifts actually need. Each movement follows its own progression — so a strong deadlift doesn't mask a lagging front squat. Every lift gets the specific stimulus it requires.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Accessories</h3>
                <p className="text-lg text-gray-700">
                  General strength builders selected based on where your profile shows the most opportunity. Core strength, back strength, overhead strength — the supporting work that raises everything else.
                </p>
              </div>
            </div>

            <p className="text-lg text-gray-700 mt-8">
              These three blocks are coordinated by the platform. Your accessories support your lifts. Your technical work addresses the positions that limit them. Nothing is random. Everything connects.
            </p>
          </div>
        </div>
      </section>

      {/* Built From Your Data Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">BUILT FROM YOUR DATA</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Same diagnostic. Same architecture. Scoped to strength.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              It starts with the same diagnostic intake that powers all of Gains AI — mapping your strength across movements to reveal imbalances, gaps, and high-leverage opportunities. From that, the platform builds your athlete profile and generates a lifting program targeted to your specific data.
            </p>
            <p className="text-lg text-gray-700">
              Your training is organized in layers — blocks, tasks, and the variables within them — so the platform can adjust at exactly the right level. Swap an accessory. Modify a rep scheme. Restructure a progression. Every change is precise. Nothing gets rebuilt from scratch.
            </p>
            <p className="text-lg text-gray-700">
              As you train and log, the system tracks your performance, perceived effort, and execution quality across every task. AI synthesizes all of it to keep your program aligned with your progress — adjusting volume, emphasis, and exercise selection as your data evolves.
            </p>
          </div>
        </div>
      </section>

      {/* Designed to Run Alongside Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">DESIGNED TO RUN ALONGSIDE YOUR TRAINING</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Strength fits into your life — not the other way around.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              This isn't a replacement for your gym programming. It's the dedicated lifting work your gym programming can't give you. Run it before class, after class, or on separate days — the platform adapts to your schedule.
            </p>
            <p className="text-lg text-gray-700">
              And because your training history is stored as structured data, you can shift priorities without starting over. Peaking for a competition? The platform adjusts. Coming back from time off? It accounts for that too. Progress is preserved. Context is never lost.
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
              Full analytics — percentile tracking, RPE trends, execution quality — available in the app so you can see where your lifts are progressing and where they need attention.
            </p>
            <p className="text-lg text-gray-700">
              When you need a human perspective, message real coaches with full visibility into your data. Share a lift video. Get corrections grounded in what the numbers already show.
            </p>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Stop guessing at your strength work. Let the platform build it for you.
          </h2>
          <p className="text-xl text-gray-700 mb-8 max-w-3xl mx-auto">
            Three focused training blocks. AI-driven progression. Real coaching. All built from your data.
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
