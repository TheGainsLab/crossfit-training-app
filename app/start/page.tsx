'use client'

import Link from 'next/link'

export default function StartPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Start Your Journey</h1>
          <p className="text-gray-600 mb-8">Choose a plan to begin training with GainsAI.</p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-2">Monthly</h2>
              <p className="text-gray-600 mb-4">$89 / month • Cancel anytime</p>
              <a
                href="https://buy.stripe.com/test_4gM14odqnavRezneey6Zy00"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
              >
                Start Monthly Plan
              </a>
            </div>

            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-2">Quarterly</h2>
              <p className="text-gray-600 mb-4">$225 / quarter • Best value</p>
              <a
                href="https://buy.stripe.com/test_7sY5kE8635bx76V7Qa6Zy01"
                className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
              >
                Start Quarterly Plan
              </a>
            </div>
          </div>

          <div className="mt-8">
            <Link href="/" className="text-blue-600 hover:text-blue-700">← Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

