'use client'

export default function AnalyticsStrengthPage() {
  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-700">Strength overview (skeleton)</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 border rounded bg-gray-50">Movement frequency</div>
        <div className="p-3 border rounded bg-gray-50">Avg RPE by movement</div>
        <div className="p-3 border rounded bg-gray-50">Best sets / PRs</div>
        <div className="p-3 border rounded bg-gray-50">1RM trends</div>
      </div>
    </div>
  )
}

