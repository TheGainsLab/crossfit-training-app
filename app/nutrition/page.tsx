export default function NutritionPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="py-20" style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Nutrition Built In – Fuel That Actually Maximizes Your Training</h1>
          
          <div className="max-w-3xl mx-auto mb-8">
            <p className="text-lg md:text-xl mb-6">
              Training without smart fueling is like driving with the parking brake on.
            </p>
            <p className="text-lg md:text-xl mb-6">
              Most apps force you to juggle separate trackers.
            </p>
            <p className="text-lg md:text-xl mb-6">
              Gains AI includes full nutrition logging and tracking—free for every user, deeply integrated with your workouts.
            </p>
            <p className="text-lg md:text-xl font-semibold">
              Log fast. Track accurately. See how macros and calories directly impact recovery, energy, and progress.
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

      {/* Your Day at a Glance Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">Your Day at a Glance</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700 mb-6">
              The dashboard gives instant clarity:
            </p>
            
            <ul className="space-y-4 mb-8">
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Personalized BMR estimate (tailored to your profile and activity level)</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Today's intake vs. BMR/goal — visual progress bar + deficit/surplus warning</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Macro split (protein, carbs, fat) with daily totals and remaining targets</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Quick meal timing buttons for real-life structure (Pre/Post-Workout emphasis)</span>
              </li>
            </ul>

            <p className="text-lg text-gray-700 mb-8">
              No manual math. Immediate visibility into whether today's fueling supports tomorrow's session.
            </p>

            {/* 📱 IMAGE PLACEHOLDER */}
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Today's Summary Dashboard<br/>
                (cropped to BMR value, progress bar, macro circles, and meal category buttons)<br/>
                Caption: BMR, intake progress, macros, and remaining targets—see fueling status in seconds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Log Food Your Way Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">Log Food Your Way – Effortless and Precise</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700 mb-6">
              Choose the method that fits the moment—everything feeds the same smart dashboard:
            </p>
            
            <ul className="space-y-4 mb-8">
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700"><strong>Photo Recognition</strong> — Snap a pic → AI identifies food and suggests realistic portion (macros update live)</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700"><strong>Barcode</strong> — Scan packaging → pulls exact nutrition facts</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700"><strong>Search</strong> — Type any food → pull from FatSecret database (home or restaurant items)</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700"><strong>Favorites</strong> — One-tap saved meals or restaurant orders</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700"><strong>Meal Builder</strong> — Combine ingredients into custom, savable meals</span>
              </li>
            </ul>

            <p className="text-lg text-gray-700 mb-6">
              Build your library once: add frequent restaurants and create named meals. Logging becomes near-instant.
            </p>
            <p className="text-lg text-gray-700 mb-8">
              Adjust portions with sliders or taps—macros and calories recalculate live before you log. Save as favorite for even faster repeats.
            </p>

            {/* 📱 IMAGE PLACEHOLDER 1 - Log Food Screen */}
            <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Log Food Screen<br/>
                (cropped to meal category buttons + "How are we logging it?" options row: Photo, Barcode, Search, Favorites, Meal Builder)<br/>
                Caption: Pick your path: Photo AI, barcode, search, favorites, or build custom.
              </p>
            </div>

            {/* 📱 IMAGE PLACEHOLDER 2 - Search Foods Results */}
            <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Search Foods Results (Grilled Chicken example)<br/>
                (cropped to search bar + top results list with branded items and macro previews)<br/>
                Caption: Search any food—home or branded restaurant—with full macros per serving.
              </p>
            </div>

            {/* 📱 IMAGE PLACEHOLDER 3 - Pulled Pork Photo Log */}
            <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Pulled Pork Photo Log Screen<br/>
                (cropped to food name, AI-suggested portion, quantity slider/circles, macros breakdown, meal total, and Log/Save buttons)<br/>
                Caption: Photo → AI recognition → suggested portion + live macros → log. Effortless precision.
              </p>
            </div>

            {/* 📱 IMAGE PLACEHOLDER 4 - Add Restaurant */}
            <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Add Restaurant Screen<br/>
                (cropped to search bar + list of restaurants with Add/Remove buttons)<br/>
                Caption: Save your favorite restaurants—Chipotle, Starbucks, Chick-fil-A, etc.—for quick logging when eating out.
              </p>
            </div>

            {/* 📱 IMAGE PLACEHOLDER 5 - Meal Builder */}
            <div className="bg-white rounded-lg shadow-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 Image: Meal Builder Screen<br/>
                (cropped to Meal Name field + Quick Add Ingredients categories/buttons)<br/>
                Caption: Build custom meals from quick-add favorites—save and log with one tap next time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Integrated Nutrition Wins Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">Why Integrated Nutrition Wins</h2>
          <div className="max-w-4xl mx-auto">
            <ul className="space-y-4 mb-8">
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Zero app-switching friction</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Training data informs macro/calorie suggestions (e.g., higher carbs after heavy sessions)</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Access to FatSecret's massive database—log home-cooked or restaurant meals with real data</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Full access included—no upsell, no separate subscription</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700">Data you own: trends show how fueling affects performance, recovery, and adaptation</span>
              </li>
            </ul>
            
            <p className="text-lg text-gray-700 font-semibold text-center">
              Stop guessing if your macros are holding you back. Make every calorie work as hard as every rep.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Ready to fuel smarter?
          </h2>
          <p className="text-lg text-gray-700 mb-8 max-w-3xl mx-auto">
            Download Gains AI and start logging nutrition alongside your training.
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
