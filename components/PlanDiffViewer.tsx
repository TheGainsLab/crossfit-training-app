'use client'

import React, { useState } from 'react'

type PlanChange = any

function formatChangeType(t: string): string {
  switch (t) {
    case 'replace_exercise': return 'Replace exercise'
    case 'add_exercise_in_block': return 'Add exercise'
    case 'remove_exercise_in_block': return 'Remove exercise'
    case 'adjust_exercise_prescription': return 'Adjust prescription'
    case 'swap_metcon': return 'Swap metcon'
    default: return t
  }
}

function formatTarget(target: any, change: any): string {
  const wd = target?.week ? `Week ${target.week}` : ''
  const dd = target?.day ? `Day ${target.day}` : ''
  const blk = target?.block ? `${target.block}` : ''
  const name = target?.name ? ` • ${target.name}` : ''
  const parts = [wd, dd, blk].filter(Boolean).join(' • ')
  return parts ? `${parts}${name}` : name.replace(/^ \u2022\s?/, '')
}

export default function PlanDiffViewer({ data, week }: { data: any; week?: number }) {
  const [showJson, setShowJson] = useState(false)
  const diff = data?.diff || data
  const changes: PlanChange[] = diff?.changes || []
  const [decisions, setDecisions] = useState<Record<number, 'accepted' | 'rejected' | undefined>>(() => {
    if (!week) return {}
    try {
      const raw = localStorage.getItem(`coach:decisions:${week}`)
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })

  if (!changes.length) {
    return <div className="text-sm text-gray-600">No proposed changes.</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-gray-900">Proposed Changes ({changes.length})</div>
        <button className="text-xs text-blue-600 hover:underline" onClick={() => setShowJson(!showJson)}>
          {showJson ? 'View readable' : 'View JSON'}
        </button>
      </div>
      {showJson ? (
        <pre className="text-xs bg-gray-50 border rounded p-2 whitespace-pre-wrap overflow-x-auto">{JSON.stringify(diff, null, 2)}</pre>
      ) : (
        <ul className="space-y-2">
          {changes.map((c: any, idx: number) => (
            <li key={idx} className="border rounded p-3">
              <div className="text-sm font-medium text-gray-900">{formatChangeType(c.type)}</div>
              <div className="text-xs text-gray-700 mt-0.5">{formatTarget(c.target, c)}</div>
              {c.new && (
                <div className="text-xs text-gray-700 mt-1">
                  {c.new.name && <div><span className="font-medium">New:</span> {c.new.name}</div>}
                  {c.new.sets && <div><span className="font-medium">Sets:</span> {c.new.sets}</div>}
                  {Array.isArray(c.new.reps) ? <div><span className="font-medium">Reps:</span> {c.new.reps.join(', ')}</div> : (c.new.reps && <div><span className="font-medium">Reps:</span> {c.new.reps}</div>)}
                  {c.new.weightTime && <div><span className="font-medium">Weight/Time:</span> {c.new.weightTime}</div>}
                  {c.new.rest_sec && <div><span className="font-medium">Rest:</span> {c.new.rest_sec}s</div>}
                  {c.new.intensity?.percent_1rm && <div><span className="font-medium">%1RM:</span> {Math.round(c.new.intensity.percent_1rm * 100)}%</div>}
                </div>
              )}
              {(c.sets || c.reps || c.rest_sec || c.intensity) && (
                <div className="text-xs text-gray-700 mt-1">
                  {c.sets && <div><span className="font-medium">Sets:</span> {c.sets}</div>}
                  {Array.isArray(c.reps) ? <div><span className="font-medium">Reps:</span> {c.reps.join(', ')}</div> : (c.reps && <div><span className="font-medium">Reps:</span> {c.reps}</div>)}
                  {c.rest_sec && <div><span className="font-medium">Rest:</span> {c.rest_sec}s</div>}
                  {c.intensity?.percent_1rm && <div><span className="font-medium">%1RM:</span> {Math.round(c.intensity.percent_1rm * 100)}%</div>}
                </div>
              )}
              {c.rationale && (
                <div className="text-xs text-gray-600 italic mt-1">Rationale: {c.rationale}</div>
              )}
              {week && (
                <div className="mt-2 flex items-center gap-2">
                  <button className={`px-2 py-1 rounded text-xs border ${decisions[idx] === 'accepted' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700'}`} onClick={() => setDecisions(prev => ({ ...prev, [idx]: 'accepted' }))}>Accept</button>
                  <button className={`px-2 py-1 rounded text-xs border ${decisions[idx] === 'rejected' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700'}`} onClick={() => setDecisions(prev => ({ ...prev, [idx]: 'rejected' }))}>Reject</button>
                  {decisions[idx] && <span className="text-xs text-gray-500">Marked {decisions[idx]}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {week && (
        <div className="pt-2 flex items-center justify-end">
          <button className="px-3 py-1.5 rounded text-xs bg-blue-600 text-white" onClick={() => {
            try {
              localStorage.setItem(`coach:decisions:${week}`, JSON.stringify(decisions))
              localStorage.setItem(`coach:lock:${week}`, 'locked')
            } catch {}
          }}>Save decisions</button>
        </div>
      )}
    </div>
  )
}

