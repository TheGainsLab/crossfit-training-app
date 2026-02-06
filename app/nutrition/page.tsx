export default function NutritionPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="py-20" style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Track Your Food</h1>
          
          <div className="max-w-3xl mx-auto">
            <p className="text-lg md:text-xl mb-6">
              Every Gains AI athlete has full access to our nutrition app.
            </p>
            <p className="text-lg md:text-xl font-semibold">
              With just a few taps, you can easily log everything you eat in a given day and track your caloric intake to help you with achieving your goals.
            </p>
          </div>
        </div>
      </section>

      {/* Training Integration Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-lg text-gray-700 leading-relaxed">
              Calorie tracking and macro tracking is nothing new. But we combine it with tracking training performance to give you the most complete picture of your progress.
            </p>
          </div>
        </div>
      </section>

      {/* Easy Logging Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">Extremely Easy to Use</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700 leading-relaxed">
              Our nutrition app is extremely easy to use. We give you several easy ways to log your meals.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              Don't have time to wait and measure? Snap a photo and our AI will identify the foods on your plate.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              You'll be able to confirm the quantities.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              Our AI is connected to a database with millions of foods, so whether you're eating at home or at a restaurant or at a friend's house, you'll be able to snap a photo and log your food.
            </p>
          </div>
        </div>
      </section>

      {/* Favorites Library Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">Build Your Favorites</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700 leading-relaxed">
              We know that most people repeat their meals rather often. We have a nutrition library feature that allows you to build your favorites before you eat them.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              Choose the entire meal, or select individual ingredients and assemble it. You can reuse this meal every time you eat it.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              We even have a restaurant database so you can add your favorite restaurants and browse their menu every time you eat there—or just add your favorite meals from those restaurants.
            </p>
          </div>
        </div>
      </section>

      {/* BMR/TDEE Tracking Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8">Track Your Progress</h2>
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-lg text-gray-700 leading-relaxed">
              During intake we'll assess your basal metabolic rate (BMR) as well as your expected TDEE. A simple bar chart in the app indicates the progress you're making for these nutrition goals.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Fuel Your Training
          </h2>
          <p className="text-lg text-gray-700 mb-8 max-w-3xl mx-auto">
            Complete nutrition tracking included free with every Gains AI subscription.
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
