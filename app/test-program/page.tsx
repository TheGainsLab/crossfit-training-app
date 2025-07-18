'use client'

import { useState } from 'react'

export default function TestProgramPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Sample intake data (similar to what your Google Forms would submit)
  const sampleIntakeData = {
    "What is your name?": ["Test User"],
    "Enter your email": ["test@example.com"],
    "Choose your gender": ["Male"],
    "Which unit system do you prefer?": ["Imperial (lbs)"],
    "Enter your body weight in your preferred unit (pounds or kilograms, as selected above). We use this to calculate strength and weightlifting targets": ["180"],
    "Select all equipment available for your training": ["Barbell,Dumbbells,Pull-up Bar,Kettlebells"],
    "Enter your 1-RM Snatch": ["135"],
    "Enter your 1-RM Power Snatch": ["125"],
    "Enter your 1-RM Clean and Jerk": ["185"],
    "Enter your 1-RM Back Squat": ["225"],
    "Enter your 1-RM Front Squat": ["185"],
    "Enter your 1-RM Bench Press": ["175"],
    "Enter your 1-RM Strict Press": ["135"],
    "Basic CrossFit skills [Double Unders]": ["Intermediate: I can do 10-25 in a row"],
    "Basic CrossFit skills [Wall Balls]": ["Advanced: I can do 30+ in a row"],
    "Upper Body Pulling [Pull-ups (kipping or butterfly)]": ["Intermediate: I can do 5-15 in a row"],
    "Upper Body Pulling [Strict Pull-ups]": ["Beginner: I can do 1-5 in a row"],
    "Upper Body Pressing [Push-ups]": ["Advanced: I can do 25+ in a row"]
  }

  const testProgramGeneration = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      console.log('🧪 Testing program generation API...')
      
      const response = await fetch('/api/programs/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          namedValues: sampleIntakeData,
          userId: 1, // Test user ID
          weeksToGenerate: [1, 2]
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate program')
      }

      console.log('✅ Program generation successful!', data)
      setResult(data)

    } catch (err) {
      console.error('❌ Program generation failed:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Test Program Generation API</h1>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">Sample Intake Data</h2>
        <pre className="text-sm bg-white p-4 rounded border overflow-auto max-h-40">
          {JSON.stringify(sampleIntakeData, null, 2)}
        </pre>
      </div>

      <button
        onClick={testProgramGeneration}
        disabled={loading}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '⏳ Generating Program...' : '🏋️ Test Program Generation'}
      </button>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="font-semibold text-red-800">❌ Error</h3>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-semibold text-green-800">✅ Success!</h3>
          <div className="mt-4">
            <p><strong>Program ID:</strong> {result.programId}</p>
            <p><strong>Weeks Generated:</strong> {result.weeksGenerated?.join(', ')}</p>
            <p><strong>Total Exercises:</strong> {result.totalExercises}</p>
            <p><strong>Generated At:</strong> {result.generatedAt}</p>
          </div>
          
          <details className="mt-4">
            <summary className="cursor-pointer font-medium">View Full Response</summary>
            <pre className="text-sm bg-white p-4 rounded border mt-2 overflow-auto max-h-60">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}
