export default function NutritionPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="py-20" style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-8">NUTRITION TRACKING, BUILT IN.</h1>
          <h2 className="text-3xl md:text-4xl font-bold mb-8">FREE FOR EVERY USER.</h2>
          
          <div className="max-w-3xl mx-auto mb-8">
            <p className="text-lg md:text-xl mb-6">
              Training without smart fueling is like driving with the parking brake on. Most apps force you to juggle a separate tracker. Gains AI includes full nutrition logging and tracking — integrated with your training, available to every user, no upsell.
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
          <p className="text-sm text-gray-600">3-day free trial · No credit card required</p>
        </div>
      </section>

      {/* Your Day at a Glance Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">YOUR DAY AT A GLANCE</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Instant clarity on whether today's fueling supports tomorrow's session.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Your nutrition dashboard shows your personalized BMR estimate, today's intake against your target with a clear visual progress bar, and your macro split with daily totals and remaining targets. Deficit or surplus warnings keep you honest without requiring manual math.
            </p>
            <p className="text-lg text-gray-700">
              You see where you stand in seconds — and whether your fueling is aligned with your training.
            </p>

            <div className="bg-gray-100 rounded-lg p-8 mt-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Dashboard screenshot showing BMR, intake progress, macros<br/>
                Pair with nutrition dashboard screenshot
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Log Food Your Way Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">LOG FOOD YOUR WAY</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Five ways to log. All of them fast.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Snap a photo and let AI identify the food with a suggested portion. Scan a barcode for exact nutrition facts. Search any food — home-cooked or from a restaurant — from the FatSecret database. Tap a saved favorite for one-step logging. Or build custom meals from individual ingredients and save them for next time.
            </p>
            <p className="text-lg text-gray-700">
              Portions are adjustable before you log, with macros recalculating live. Build your library of frequent meals and restaurants once — after that, logging takes seconds.
            </p>

            <div className="bg-gray-100 rounded-lg p-8 mt-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Screenshots showing photo AI, barcode scan, search, favorites, and meal builder<br/>
                Pair with logging method screenshots
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Integration Matters Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">WHY INTEGRATION MATTERS</h2>
          <p className="text-xl text-gray-700 text-center font-semibold mb-12 max-w-3xl mx-auto">
            Nutrition and training in one platform changes both.
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              When your nutrition data lives alongside your training data, the picture gets sharper. You stop guessing whether your fueling is helping or holding you back. You can see how your intake correlates with recovery, energy, and performance over time.
            </p>
            <p className="text-lg text-gray-700">
              No app-switching. No syncing. No separate subscription. Your nutrition data feeds into the same platform that manages your training — so everything you track contributes to the same picture.
            </p>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Full nutrition tracking. Fully integrated. Free for every user.
          </h2>
          <p className="text-xl text-gray-700 mb-8 max-w-3xl mx-auto">
            Log your meals alongside your training. See how fueling affects performance. Own all of the data.
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
          <p className="text-sm text-gray-600">3-day free trial · No credit card required</p>
        </div>
      </section>
    </div>
  )
}
