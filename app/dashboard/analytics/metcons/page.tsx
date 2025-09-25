'use client'

import { useState } from 'react'

export default function AnalyticsMetconsPage() {
  const [selection, setSelection] = useState<string[]>([])
  const timeDomains = ['1-5','5-10','10-15','15-20','20+']
  const toggle = (td: string) => setSelection(prev => prev.includes(td) ? prev.filter(x => x!==td) : [...prev, td])
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600">Time Domain:</span>
        {timeDomains.map(td => (
          <button key={td} onClick={() => toggle(td)} className={`px-2 py-1 rounded border ${selection.includes(td) ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`}>{td}</button>
        ))}
      </div>
      <div className="text-sm text-gray-700">Metcon performance heat map (interactive skeleton)</div>
      <div className="grid grid-cols-5 gap-1">
        {timeDomains.map(td => (
          <div key={td} onClick={() => toggle(td)} className={`h-16 cursor-pointer flex items-center justify-center text-xs border ${selection.includes(td) ? 'bg-blue-200' : 'bg-gray-100 hover:bg-gray-200'}`}>{td}</div>
        ))}
      </div>
      <div className="text-sm text-gray-700">Selected: {selection.join(', ') || 'None'}</div>
    </div>
  )
}

