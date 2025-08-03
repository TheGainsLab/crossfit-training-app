'use client'
import { useEffect, useState } from 'react'

export default function AnalyticsTest() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function testAnalytics() {
      try {
        const response = await fetch('/api/analytics/47/dashboard?timeRange=30&includeMetCons=true')
        const result = await response.json()
        
        if (result.success) {
          setData(result.data)
        } else {
          setError(result.error)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    testAnalytics()
  }, [])

  if (loading) return <div className="p-8">Loading analytics...</div>
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>
  if (!data) return <div className="p-8">No data</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Analytics Test</h1>
      
      {/* Key Insights */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">AI Insights:</h2>
        {data.insights?.map((insight: string, i: number) => (
          <div key={i} className="bg-blue-50 p-2 mb-2 rounded">
            💡 {insight}
          </div>
        ))}
      </section>

      {/* Overall Metrics */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Training Metrics:</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>Training Days: {data.dashboard?.overallMetrics?.totalTrainingDays}</div>
          <div>Avg RPE: {data.dashboard?.overallMetrics?.averageRPE}</div>
          <div>Consistency: {data.dashboard?.overallMetrics?.consistencyScore}%</div>
          <div>Total Exercises: {data.dashboard?.overallMetrics?.totalExercises}</div>
        </div>
      </section>

      {/* Raw Data */}
      <details className="mt-4">
        <summary className="cursor-pointer">Raw Analytics Data</summary>
        <pre className="bg-gray-100 p-4 text-xs overflow-auto max-h-96">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  )
}
