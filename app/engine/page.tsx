export default function EnginePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="py-20" style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-8">The Year of the Engine</h1>
          
          <div className="max-w-3xl mx-auto mb-8">
            <p className="text-lg md:text-xl mb-6 font-semibold">
              Exceptional Capacity.
            </p>
            <p className="text-lg md:text-xl mb-6">
              Most conditioning programs are cobbled together from monostructural sports — recycled Zone 2 work, random intervals, and cookie-cutter sprints. They're better than nothing, but not by much. They don't distinguish between users or account for your training history.
            </p>
            <p className="text-lg md:text-xl mb-6">
              The Year of the Engine is different. Twenty progressive training frameworks target every muscle fiber type — polarized training, variable intervals, decreasing rest periods, and more. The result: increased power, greater endurance at any intensity, new gears, and the ability to pace above the redline without blowing up. Not just intervals and Zone 2 — novel stimuli that translate directly to metcon and competition performance.
            </p>
          </div>

          {/* App Download Button */}
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
              Start Free Trial
            </a>
          </div>
          <p className="text-sm text-gray-600">3-day free trial · No credit card required</p>
        </div>
      </section>

      {/* Built for Real Performance Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">BUILT FOR REAL PERFORMANCE</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Performance requires numerous adaptations: aerobic power, aerobic capacity, threshold tolerance, anaerobic power, density tolerance, pacing control across varied tasks, and more. Conditioning means being ready for anything. The Year of the Engine is built on 20 distinct frameworks, each designed to stress a specific aspect of your engine — polarized training, variable intervals, decreasing rest periods, and more. Every structure has a defined purpose and a measurable adaptation. This isn't variety for variety's sake.
            </p>
          </div>
        </div>
      </section>


      {/* Calibrated to You Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">CALIBRATED TO YOU</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Your training begins with a time trial that establishes your baseline. From there, every session has crystal-clear targets: exact duration, output goals relative to your current capacity, and how the prescribed intensity fits your profile. You always know what you're trying to hit and why.
            </p>

            <div className="bg-gray-100 rounded-lg p-8 mt-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Pre-Workout Training Summary screenshot<br/>
                Pair with screenshot showing pre-workout targets and context
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Independent Adaptation Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">INDEPENDENT ADAPTATION</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Your aerobic capacity doesn't improve at the same rate as your anaerobic power. Your threshold tolerance doesn't progress on the same schedule as your repeatability. Treating them as one system means dragging weak links along and holding strong ones back. Year of the Engine breaks conditioning into its components — each one adapts independently based on your logged performance. Machine learning tracks your response to each framework and adjusts targets accordingly. No arbitrary progressions. The platform develops each piece intelligently, then reassembles them into a superior whole.
            </p>

            <div className="bg-gray-100 rounded-lg p-8 mt-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Stimulus History — Max Aerobic Power screenshot<br/>
                Pair with screenshot showing performance progression over time
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Execution Without Guesswork Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">EXECUTION WITHOUT GUESSWORK</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              The app becomes your pacing coach mid-workout. Goals, countdowns, and round context stay front-and-center through fatigue — so you execute the plan instead of chasing feelings. Before you start, the app walks you through what to expect: targets for every segment, intensity comparisons versus your time trial, and your history on that stimulus. Once the clock starts, you see your goal for every interval. Log your score with a few taps — including heart rate data and individual interval results.
            </p>

            <div className="bg-gray-100 rounded-lg p-8 mt-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 In-Workout Interval Countdown screenshot<br/>
                Pair with screenshot showing live workout interface
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Analytics Built for Conditioning Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">ANALYTICS BUILT FOR CONDITIONING</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Progress isn't vibes. It's visible patterns in structured data. Your dashboard tracks total work and energy system balance, pace and output trends per framework, target versus actual accountability, work-to-rest recovery efficiency, and heart rate output per beat — true aerobic gains that pace alone can't reveal. Compare performance across different work-to-rest ratios for unmatched insight into your recovery. Multi-dimensional insight across every system, every framework, and every session. If the system sees it, you see it.
            </p>

            <div className="bg-gray-100 rounded-lg p-8 mt-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Analytics screenshots — headline summary, stimulus history, comparison, target vs. actual, work:rest ratio, HR efficiency<br/>
                Pair with comprehensive analytics dashboard screenshots
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Train with a system that knows your engine — and builds it deliberately.
          </h2>
          <p className="text-xl text-gray-700 mb-8 max-w-3xl mx-auto">
            Twenty frameworks. Independent adaptation. Targets calibrated to your data. Conditioning that transfers when it counts.
          </p>

          {/* App Download Button */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
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
              Start Free Trial
            </a>
          </div>
          <p className="text-sm text-gray-600 mb-8">3-day free trial · No credit card required</p>

          <div className="flex flex-wrap gap-2 justify-center text-lg text-gray-700">
            <span>→ Want strength, skills, and MetCons too?</span>
            <a href="/premium" className="text-coral-500 hover:underline font-semibold" style={{ color: '#FE5858' }}>Explore Premium</a>
          </div>
        </div>
      </section>
    </div>
  )
}
