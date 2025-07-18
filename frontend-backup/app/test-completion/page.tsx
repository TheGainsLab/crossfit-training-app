'use client'

import { useState } from 'react'

export default function TestCompletionPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [completions, setCompletions] = useState<any[]>([])

  // Sample completion data
  const sampleCompletion = {
    programId: 3, // Using the program we generated earlier
    userId: 1,
    week: 1,
    day: 1,
    block: "STRENGTH AND POWER",
    exerciseName: "Snatch",
    setsCompleted: 4,
    repsCompleted: "8,6,4,2", // Multiple sets completed
    weightUsed: 85, // Average weight used
    rpe: 7,
    notes: "Felt good, technique improving",
    wasRx: true,
    scalingUsed: null
  }

  const logCompletion = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      console.log('📝 Testing completion logging...')
      
      const response = await fetch('/api/workouts/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sampleCompletion)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to log completion')
      }

      console.log('✅ Completion logged successfully!', data)
      setResult(data)

    } catch (err) {
      console.error('❌ Completion logging failed:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const fetchCompletions = async () => {
    setLoading(true)
    setError(null)

    try {
      console.log('📊 Fetching completions...')
      
      const response = await fetch(`/api/workouts/complete?userId=1&programId=3&week=1&day=1`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch completions')
      }

      console.log('✅ Completions fetched successfully!', data)
      setCompletions(data.completions || [])

    } catch (err) {
      console.error('❌ Failed to fetch completions:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Test Workout Completion API</h1>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">Sample Completion Data</h2>
        <pre className="text-sm bg-white p-4 rounded border overflow-auto max-h-40">
          {JSON.stringify(sampleCompletion, null, 2)}
        </pre>
      </div>

      <div className="flex gap-4 mb-8">
        <button
          onClick={logCompletion}
          disabled={loading}
          className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '⏳ Logging...' : '📝 Log Exercise Completion'}
        </button>

        <button
          onClick={fetchCompletions}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '⏳ Fetching...' : '📊 Fetch Day Completions'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="font-semibold text-red-800">❌ Error</h3>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-semibold text-green-800">✅ Completion Logged!</h3>
          <div className="mt-4">
            <p><strong>Exercise:</strong> {result.completion?.exercise_name}</p>
            <p><strong>Sets/Reps:</strong> {result.completion?.sets_completed} sets, {result.completion?.reps_completed} reps</p>
            <p><strong>Weight:</strong> {result.completion?.weight_used} lbs</p>
            <p><strong>RPE:</strong> {result.completion?.rpe}/10</p>
            <p><strong>Session Stats:</strong> {result.sessionStats?.completedExercises} exercises completed</p>
          </div>
          
          <details className="mt-4">
            <summary className="cursor-pointer font-medium">View Full Response</summary>
            <pre className="text-sm bg-white p-4 rounded border mt-2 overflow-auto max-h-60">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {completions.length > 0 && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h3 className="font-semibold text-purple-800">📊 Day 1 Completions ({completions.length} total)</h3>
          <div className="mt-4 space-y-3">
            {completions.map((completion, index) => (
              <div key={completion.id} className="bg-white p-3 rounded border">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{completion.exercise_name}</p>
                    <p className="text-sm text-gray-600">{completion.block}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p>{completion.sets_completed} sets × {completion.reps_completed} reps</p>
                    {completion.weight_used && <p>{completion.weight_used} lbs</p>}
                    {completion.rpe && <p>RPE: {completion.rpe}/10</p>}
                  </div>
                </div>
                {completion.notes && (
                  <p className="text-sm text-gray-700 mt-2">📝 {completion.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
