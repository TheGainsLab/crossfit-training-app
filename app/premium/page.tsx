export default function PremiumPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="py-20" style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">THE COMPLETE PLATFORM.</h1>
          <h2 className="text-3xl md:text-5xl font-bold mb-8">EVERY DOMAIN. FULLY PERSONALIZED.</h2>
          
          <div className="max-w-3xl mx-auto mb-8">
            <p className="text-lg md:text-xl mb-6">
              Premium covers every dimension of your fitness — strength, technique, skills, accessories, conditioning, and MetCons — all generated from your data, all adapting as you progress. Nothing left to chance. Nothing left out.
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

      {/* What You're Training Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">WHAT YOU'RE TRAINING</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Personalized and integrated
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Beast on the barbell but struggle on gymnastics? Crushing short workouts but gassing out on longer pieces? Each segment of your training moves at your pace, not a template's.
            </p>
            <p className="text-lg text-gray-700">
              Personalized training creates valuable data. Your results feed into an AI engine that aligns your training with your progress — automatically. When you improve, AI knows.
            </p>
            <p className="text-lg text-gray-700">
              Full transparency here. Your analytics tab shows you exactly what the system sees, so you always know what's driving your training.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">HOW IT WORKS</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Your data builds the program. AI keeps it aligned. Coaches keep it human.
          </p>

          {/* Diagnostic Intake */}
          <div className="max-w-4xl mx-auto mb-16">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Diagnostic Intake</h3>
            <div className="space-y-4 mb-6">
              <p className="text-lg text-gray-700">
                Gains AI starts by mapping your strength, skills, and conditioning across movements and time domains. This diagnostic surfaces where you're strong, where you're falling short, and where improvement will have the most impact.
              </p>
              <p className="text-lg text-gray-700">
                From this, we build your athlete profile — the source of truth behind every training decision the platform makes. Your profile isn't static. It updates continuously as you train, so your program is always built from your most current data.
              </p>
            </div>
            
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Strength Summary + Olympic Lift Ratios screenshot<br/>
                Pair with screenshot showing diagnostic results
              </p>
            </div>
          </div>

          {/* Training Generated */}
          <div className="max-w-4xl mx-auto mb-16">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Training Generated From Your Data</h3>
            <div className="space-y-4 mb-6">
              <p className="text-lg text-gray-700">
                Your program is generated directly from your athlete profile — not pulled from a library.
              </p>
              <p className="text-lg text-gray-700">
                Technical work targets real deficiencies. Strength progressions deliver the specific stimulus each lift needs. Accessories are selected to support your weakest links. Skills work prioritizes execution quality over volume. MetCons match your current capacity. Engine targets push you based on what you've actually done. Within each task, we personalize the variables: sets, reps, weight, and time.
              </p>
            </div>
            
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Technical Focus Screen screenshot<br/>
                Pair with screenshot showing program structure
              </p>
            </div>
          </div>

          {/* Train, Log, Learn */}
          <div className="max-w-4xl mx-auto mb-16">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Train, Log, Learn</h3>
            <div className="space-y-4 mb-6">
              <p className="text-lg text-gray-700">
                Logging takes seconds. You capture sets, reps, perceived effort, and execution quality after each session.
              </p>
              <p className="text-lg text-gray-700">
                Over time, this builds a detailed picture of how your body actually responds to training — not in theory, but in practice.
              </p>
            </div>
            
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Skills Card — Average RPE View screenshot<br/>
                Pair with screenshot showing logging interface
              </p>
            </div>
          </div>

          {/* Continuous Adaptation */}
          <div className="max-w-4xl mx-auto mb-16">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Continuous Adaptation</h3>
            <div className="space-y-4 mb-6">
              <p className="text-lg text-gray-700">
                As your dataset grows, Gains AI adjusts automatically. If a movement is stalling, the platform intervenes at the task level. If an entire block needs restructuring, it handles that too. If your recovery data shows you need a lighter week, variables adjust across the board.
              </p>
            </div>
            
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Percentile Heatmap screenshot<br/>
                Pair with screenshot showing adaptation in action
              </p>
            </div>
          </div>

          {/* Expert Coaching */}
          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Expert Coaching</h3>
            <div className="space-y-4 mb-6">
              <p className="text-lg text-gray-700">
                AI handles the analysis. Coaches provide the insight.
              </p>
              <p className="text-lg text-gray-700">
                Message real coaches anytime — never an AI chatbot. Because your coaches have full visibility into your training data and the platform's recommendations, there's no catching up, no back-and-forth, no digging through spreadsheets. Feedback is precise, contextual, and immediately actionable.
              </p>
            </div>
            
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Coaching/messaging screenshot<br/>
                Pair with screenshot showing coaching interface
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Analytics Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">ANALYTICS</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Your progress, visible from every angle.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Gains AI tracks your performance at every level — individual tasks, training blocks, and the overall program. That data isn't hidden behind the AI. Everything the system sees, you see.
            </p>

            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Combined analytics screenshots — Percentile Heatmap, HR Heatmap, Skills Cards<br/>
                Pair with comprehensive analytics dashboard screenshots
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Nutrition Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">NUTRITION</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Optimal training and optimal fuel work best together.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700 mb-8">
              Premium includes built-in nutrition tracking: photo logging, barcode scans, saved meals, macros, and BMR/TDEE estimates. Your nutrition keeps pace with your training.
            </p>

            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Nutrition tracking screenshots<br/>
                Pair with nutrition interface screenshots
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Flexibility Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">FLEXIBILITY WITHOUT STARTING OVER</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Shift priorities whenever life demands it.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700 font-semibold">
              The program you keep.
            </p>
            <p className="text-lg text-gray-700">
              Most programs run their course. Gains AI doesn't — because it's built from your data, it evolves as your goals do. Preparing for a competition, adjusting for travel, shifting focus to a new skill — your training adapts without starting over.
            </p>
            <p className="text-lg text-gray-700">
              Make small adjustments in the app. The AI integrates them automatically. For bigger shifts, message your coach.
            </p>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Every domain. Fully personalized. Always adapting.
          </h2>
          <p className="text-xl text-gray-700 mb-8 max-w-3xl mx-auto">
            Premium is the complete Gains AI experience — six training blocks, real coaching, full analytics, and a platform that follows your progress from every angle.
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

          <div className="flex flex-wrap gap-4 justify-center text-lg text-gray-700">
            <span>→ Looking for something more focused?</span>
            <a href="/appliedpower" className="text-coral-500 hover:underline font-semibold" style={{ color: '#FE5858' }}>Explore Strength</a>
            <span>·</span>
            <a href="/engine" className="text-coral-500 hover:underline font-semibold" style={{ color: '#FE5858' }}>Explore Engine</a>
          </div>
        </div>
      </section>
    </div>
  )
}
