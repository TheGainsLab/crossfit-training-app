export default function PremiumPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="py-20" style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">MAXIMIZE THE VALUE OF YOUR EFFORT</h1>
          
          <div className="max-w-3xl mx-auto mb-8">
            <p className="text-lg md:text-xl mb-6">
              Athletes often follow programs based on social media or someone else's competition results. The result is a partial solution. Some things improve, others don't. Progress becomes fragmented and hard to measure. Athletes bounce to a new program, hoping the next one fixes what the last missed.
            </p>
            <p className="text-lg md:text-xl mb-6">
              The Gains AI connects your effort to your results, by generating training from your data, and continuously refines it as you train. Every rep, interval, and calorie feeds a single, evolving performance model, so effort compounds instead of resetting.
            </p>
            <p className="text-lg md:text-xl mb-6 font-semibold">
              You don't follow a program. The program follows you.
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
          <p className="text-sm">3-day free trial • No credit card required</p>
        </div>
      </section>

      {/* Human Physiology Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">HUMAN PHYSIOLOGY HASN'T CHANGED</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-8 max-w-3xl mx-auto">
            Training systems need to.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Exercise physiology is largely understood. Strength is built with heavy compound lifts and sound mechanics. Skills require deliberate practice off the clock. Conditioning improves by getting uncomfortable — repeatedly and intelligently.
            </p>
            <p className="text-lg text-gray-700 font-semibold">
              The principles aren't the problem. The delivery is.
            </p>
            <p className="text-lg text-gray-700">
              Most programs work in parts. But they aren't built for you. They don't know your history and can't track how you're responding. They're designed to scale distribution - to sell broadly, look good publicly, and minimize post-sale involvement. Even well-intentioned coaches can't scale real attention. Success with distribution means coaching will get worse.
            </p>
            <p className="text-lg text-gray-700 font-semibold">
              That's not a coaching failure—It's a systems failure.
            </p>
            <p className="text-lg text-gray-700 font-semibold">
              Gains AI is built differently.
            </p>
            <p className="text-lg text-gray-700">
              Training adapts as your data changes. Context is preserved. Coaches see what the system sees. Personalization runs deep. Adaptation is continuous. And every session feeds back into a system designed to make your effort count — long after most programs would have stopped paying attention.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8 mb-4">
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
            <p className="text-sm text-gray-600 text-center">3-day free trial • No credit card required</p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">HOW IT WORKS</h2>
          <p className="text-xl text-gray-700 text-center max-w-3xl mx-auto mb-12">
            A program you can follow — generated from you.
          </p>
          
          {/* Step 1 */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#FE5858' }}>
                <span className="text-white font-bold text-xl">1</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Diagnostic Intake</h3>
            </div>
            <p className="text-lg text-gray-700 mb-6">
              Gains AI starts by mapping your strength, skills, and conditioning across movements and time domains.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              This intake surfaces opportunities for improvement and defines your path forward. From it, we create your athlete profile — the source of truth for all training decisions.
            </p>
            
            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Strength Summary + Olympic Lift Ratios<br/>
                Strength in context. See how your lifts compare to proven ratios and identify where improvement matters most.
              </p>
            </div>
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
              Your training is generated directly from your data — not selected from a template.
            </p>
            <p className="text-lg text-gray-700 mb-4">That means:</p>
            <ul className="space-y-3 ml-6 mb-6">
              <li className="text-lg text-gray-700">• Technical work targets true deficiencies and imbalances</li>
              <li className="text-lg text-gray-700">• Accessories raise all lifts by improving general strength</li>
              <li className="text-lg text-gray-700">• Lift-specific progressions allow each movement to advance at its own pace</li>
              <li className="text-lg text-gray-700">• Conditioning and MetCons focus on the highest-impact time domains</li>
            </ul>
            
            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Technical Focus Screen<br/>
                Clear signals. No guesswork. Fix root causes — not symptoms.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#FE5858' }}>
                <span className="text-white font-bold text-xl">3</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Train, Log, Learn</h3>
            </div>
            <p className="text-lg text-gray-700 mb-6">
              Logging takes seconds. The value compounds over time.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              Quickly capture sets, reps, perceived effort (RPE), and execution quality. This turns training into structured data that feeds both analytics and adaptation.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              Log what you did — and the system learns how you respond.
            </p>
            
            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Skills Card — Average RPE View<br/>
                Effort matters. Context explains it. See what different tasks actually cost your body over time.
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
            <p className="text-lg text-gray-700 mb-6">
              As your dataset grows, Gains AI identifies patterns other programs miss.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              Training adjusts automatically — task selection, block structure, volume, and emphasis — so your plan stays aligned with your progress instead of falling behind it.
            </p>
            
            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Percentile Heatmap<br/>
                Fitness isn't one number. Performance varies by movement, domain, and intensity — and the system tracks it all.
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
            <p className="text-lg text-gray-700 mb-6">
              AI handles analysis. Coaches provide insight.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              Our coaches have full visibility into your training data and system insights, so you can message anytime. Feedback is precise, contextual, and immediately actionable.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              Share video lifts. Get targeted corrections.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              Coaching stays human. Decisions stay data-informed.
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
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">DATA DOMINANCE</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-8 max-w-3xl mx-auto">
            From training logs to usable knowledge.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Most apps store results as notes. That limits understanding to sorting and looking back.
            </p>
            <p className="text-lg text-gray-700 font-semibold">
              Gains AI is built on structured training data.
            </p>
            <p className="text-lg text-gray-700">
              Every lift, interval, skill, and effort signal is captured with context — so both you and the system understand performance precisely.
            </p>
            <p className="text-lg text-gray-700 font-semibold">
              If the system sees it, you see it.
            </p>
            <p className="text-lg text-gray-700">
              No black boxes. No hidden logic.
            </p>
            <p className="text-lg text-gray-700">
              Track trends. Compare domains. Watch your fitness evolve in real time.
            </p>
            <p className="text-lg text-gray-700 mb-8">
              You own your data — and with it, control over your progress.
            </p>

            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Combined Analytics (Percentile + HR Heatmaps)<br/>
                No black boxes. Every adjustment comes from data you can see and understand.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Teamwork Not Templates Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">TEAMWORK, NOT TEMPLATES</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-8 max-w-3xl mx-auto">
            A system that adapts without losing context.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Gains AI is built on structured training data — so flexibility doesn't come at the cost of continuity.
            </p>
            <p className="text-lg text-gray-700">
              Make small changes directly in the app. The system detects and logs them automatically.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              For larger adjustments, coaches can update your training instantly.
            </p>
            <p className="text-lg text-gray-700 font-semibold">Shift focus without stopping progress:</p>
            <ul className="space-y-3 ml-6 mb-6">
              <li className="text-lg text-gray-700">• Prepare for competition or travel without pausing training</li>
              <li className="text-lg text-gray-700">• Introduce a new stimulus without rewriting the program</li>
            </ul>
            <p className="text-lg text-gray-700 mb-8">
              Because your training history is preserved as structured data, changes don't erase progress or force a reset.
            </p>
            <p className="text-lg text-gray-700 mb-8">
              The system absorbs the update, maintains context, and adapts intelligently — no matter what comes your way.
            </p>

            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="bg-white rounded-lg shadow-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Skills Card or Strength Summary<br/>
                Your training evolves with you. No resets. Just continuous, intelligent upgrades.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Train with a System That Understands You
          </h2>
          <p className="text-lg text-gray-700 mb-8 max-w-3xl mx-auto">
            Download Gains AI and experience the power of continuous personalization, real-time analytics, and expert coaching—all working together to maximize your progress.
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
        </div>
      </section>
    </div>
  )
}
