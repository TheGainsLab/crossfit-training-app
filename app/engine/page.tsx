export default function EnginePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="py-20" style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-8">BUILD AN ENGINE, NOT JUST ENDURANCE.</h1>
          
          <div className="max-w-3xl mx-auto mb-8">
            <p className="text-lg md:text-xl mb-6">
              Conditioning isn't surviving workouts. It's repeatable output when it counts — across every intensity, every time domain, every energy system.
            </p>
            <p className="text-lg md:text-xl mb-6">
              Year of the Engine is a systematic conditioning platform built on 20 distinct training frameworks, each targeting a specific adaptation. Every session is calibrated to your data. Every target adapts based on your results. This is conditioning with structure, progression, and precision.
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

      {/* The Problem Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">THE PROBLEM</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Most conditioning programs are built on two speeds: easy and brutal.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Endless Zone 2 or punishing intervals. Maybe some variety in the movements, but no real structure underneath. No progression model. No way to know if what you're doing is actually developing the right systems — or just making you tired.
            </p>
            <p className="text-lg text-gray-700">
              You might feel like you're working hard. But without a system that targets specific adaptations, tracks your response, and adjusts accordingly, you're training volume without direction. Hard doesn't mean productive.
            </p>
          </div>
        </div>
      </section>

      {/* 20 Frameworks Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">20 FRAMEWORKS. EACH ONE HAS A JOB.</h2>
          <div className="text-center mb-8">
            <a href="/engine/taxonomy" className="inline-block text-lg font-semibold hover:underline" style={{ color: '#FE5858' }}>
              → Explore all 20 frameworks in the full taxonomy
            </a>
          </div>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Conditioning isn't one thing. Your training shouldn't be either.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Your engine has multiple systems — aerobic capacity, threshold tolerance, anaerobic power, repeatability, pacing control, density tolerance — and each one adapts at a different rate and requires a different stimulus.
            </p>
            <p className="text-lg text-gray-700">
              Year of the Engine is built on 20 distinct conditioning frameworks, each designed to stress a specific aspect of your engine. This isn't variety for variety's sake. Every structure has a defined purpose and a measurable adaptation.
            </p>
            <p className="text-lg text-gray-700 mb-8 font-semibold">
              A few examples of what that looks like in practice:
            </p>

            <div className="space-y-6 mb-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Max Aerobic Power</h3>
                <p className="text-lg text-gray-700">
                  Long severe intervals with equal work-to-rest, paced from your time trial. Designed to raise your VO₂max ceiling — the aerobic capacity that all other work draws from.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Flux</h3>
                <p className="text-lg text-gray-700">
                  Continuous Zone 2 with short, controlled pace increases. Trains lactate clearance and metabolic flexibility without breaking down your aerobic base.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Hybrid Aerobic</h3>
                <p className="text-lg text-gray-700">
                  Clustered aerobic-power intervals with incomplete recovery. Builds the sustained output and density tolerance that directly transfers to CrossFit and HYROX performance.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Infinity</h3>
                <p className="text-lg text-gray-700">
                  Long escalating density across multiple phases with no clear reset. Simulates the sustained aerobic-glycolytic erosion of real competition — pacing discipline under prolonged discomfort.
                </p>
              </div>
            </div>

            <p className="text-lg text-gray-700 mb-6">
              These are four of twenty. Each framework targets a different system, progresses independently, and adapts to your performance over time.
            </p>
            
            <div className="text-center">
              <a href="/engine/taxonomy" className="inline-block text-lg font-semibold hover:underline" style={{ color: '#FE5858' }}>
                → Explore all 20 frameworks in the full taxonomy
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Calibrated to You Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">CALIBRATED TO YOU</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Every target is anchored to your data — not someone else's "hard."
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Your training begins with a time trial that establishes your baseline. From there, every session has crystal-clear targets: exact duration, output goals relative to your current capacity, and how the prescribed intensity fits your profile.
            </p>
            <p className="text-lg text-gray-700">
              "Hard" becomes productive, not arbitrary. This is calibration — teaching deliberate redline pushes without overreach. You always know what you're trying to hit and why.
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
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">INDEPENDENT ADAPTATION</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Each system evolves on its own timeline.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Your aerobic capacity doesn't improve at the same rate as your anaerobic power. Your threshold tolerance doesn't progress on the same schedule as your repeatability. Treating them as one thing means dragging weak links along and holding strong systems back.
            </p>
            <p className="text-lg text-gray-700">
              Year of the Engine breaks conditioning into its components — and each one adapts independently based on your logged performance. Machine learning tracks your response to each framework and adjusts targets accordingly. No arbitrary progressions. Targets update from your real outputs.
            </p>
            <p className="text-lg text-gray-700">
              The platform develops each piece intelligently, then reassembles them into a superior whole.
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
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">EXECUTION WITHOUT GUESSWORK</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            The app becomes your pacing coach mid-workout.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Goals, countdowns, and round context stay front-and-center through fatigue — so you execute the plan instead of chasing feelings. You always know where you are in the session, what the target is, and how it connects to the bigger picture.
            </p>
            <p className="text-lg text-gray-700">
              Precision under discomfort is what builds elite engines.
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
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">ANALYTICS BUILT FOR CONDITIONING</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Progress isn't vibes. It's visible patterns in structured data.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Year of the Engine analytics answer the questions that matter: How is your engine actually changing? Where are you improving? What needs attention?
            </p>
            <p className="text-lg text-gray-700">
              Your dashboard tracks total work and energy system balance, pace and output trends per framework, target vs. actual accountability, work-to-rest recovery efficiency, and heart rate output per beat — true aerobic gains that pace alone can't reveal.
            </p>
            <p className="text-lg text-gray-700">
              No single score. Multi-dimensional insight across every system, every framework, and every session. If the system sees it, you see it.
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

      {/* Fits Your Schedule Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">FITS YOUR SCHEDULE</h2>
          <div className="max-w-4xl mx-auto">
            <p className="text-lg text-gray-700 text-center">
              Year of the Engine runs on 5-day or 3-day schedules with classic 12-week cycles for deep focus, or Engine360 — fast 4-week blocks for broad exposure across all frameworks. Pick what fits your life. Progress never resets.
            </p>
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
