export default function PremiumPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="py-20" style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Maximize the Value of Every Effort</h1>
          
          <div className="max-w-3xl mx-auto mb-8">
            <p className="text-lg md:text-xl mb-6">
              Most programs work… for a while. Then you outgrow them, or your goals change, and your static program can't adjust.
            </p>
            <p className="text-lg md:text-xl mb-6">
              Gains AI does better. We maximize your training with continuous personalization, real-time analytics, and built-in nutrition—so every rep and calorie compounds into faster, more complete progress.
            </p>
            <p className="text-lg md:text-xl font-semibold">
              No partial solutions. No cobbling. Just smarter results from the effort you're already putting in.
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
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">Human Physiology Hasn't Changed</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Strength still demands heavy loads, compound movements, and crisp technique.
            </p>
            <p className="text-lg text-gray-700">
              Skills demand deliberate, off-the-clock practice.
            </p>
            <p className="text-lg text-gray-700">
              Conditioning demands getting out of breath—repeatedly and intelligently.
            </p>
            <p className="text-lg text-gray-700">
              Most programs aren't terrible.
            </p>
            <p className="text-lg text-gray-700">
              They'll deliver something… for a while.
            </p>
            <p className="text-lg text-gray-700">
              But group programs can only ever give you an approximation.
            </p>
            <p className="text-lg text-gray-700">
              They're not built for long-term, individualized progress.
            </p>
            <p className="text-lg text-gray-700">
              They're built to sell—leaning on the reputation of a competitive athlete, viral social media clips, or the promise of "what worked for them."
            </p>
            <p className="text-lg text-gray-700">
              Post-sale support? Almost nonexistent.
            </p>
            <p className="text-lg text-gray-700">
              Feedback is minimal at best.
            </p>
            <p className="text-lg text-gray-700">
              Even when coaches are involved, no group program can scale meaningful, ongoing attention across hundreds or thousands of members.
            </p>
            <p className="text-lg text-gray-700 font-semibold mt-8">
              That's why Gains AI is different.
            </p>
            <p className="text-lg text-gray-700 font-semibold">
              We don't approximate.
            </p>
            <p className="text-lg text-gray-700 font-semibold mb-8">
              We personalize deeply, adapt continuously, and give you the analytics and coaching visibility to make every session count—without relying on hype or hoping you fit the mold.
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Placeholder Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Feature 1</h3>
            <p className="text-gray-600">
              Placeholder text for premium feature description
            </p>
          </div>
          <div className="bg-white p-8 rounded-lg shadow-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Feature 2</h3>
            <p className="text-gray-600">
              Placeholder text for premium feature description
            </p>
          </div>
          <div className="bg-white p-8 rounded-lg shadow-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Feature 3</h3>
            <p className="text-gray-600">
              Placeholder text for premium feature description
            </p>
          </div>
        </div>

        {/* Placeholder Pricing Section */}
        <div className="bg-white rounded-lg shadow-lg p-12 text-center max-w-2xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Pricing Plans
          </h3>
          <p className="text-gray-600 mb-8">
            [Placeholder for pricing information]
          </p>
          <button className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition">
            Get Started
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 mt-24 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-600">
          <p>[Placeholder footer content]</p>
        </div>
      </footer>
    </div>
  )
}
