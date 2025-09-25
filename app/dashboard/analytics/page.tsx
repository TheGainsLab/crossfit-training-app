'use client'

export default function AnalyticsOverviewPage() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 border rounded bg-gray-50">
          <div className="text-xs text-gray-600">Adherence</div>
          <div className="text-xl font-semibold">—</div>
        </div>
        <div className="p-3 border rounded bg-gray-50">
          <div className="text-xs text-gray-600">Volume (last 8 weeks)</div>
          <div className="text-xl font-semibold">—</div>
        </div>
        <div className="p-3 border rounded bg-gray-50">
          <div className="text-xs text-gray-600">Avg percentile</div>
          <div className="text-xl font-semibold">—</div>
        </div>
      </div>
      <div className="text-sm text-gray-700">Quick insights</div>
      <ul className="list-disc list-inside text-sm text-gray-700">
        <li>—</li>
        <li>—</li>
      </ul>
    </div>
  )
}

