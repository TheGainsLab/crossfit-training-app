'use client'

import { useEffect, useState } from 'react'

type Stats = {
  gender: 'male'|'female'
  display_top: string | null
  display_p90: string | null
  display_median: string | null
  attempts_count: number
}

export default function WorkoutDetailPage({ params }: { params: { slug: string } }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/workouts/${encodeURIComponent(params.slug)}`)
      .then(r => r.json())
      .then(res => { if (!cancelled) setData(res?.workout || null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [params.slug])

  if (loading) return <div className="p-4">Loading…</div>
  if (!data) return <div className="p-4">Not found</div>

  const male: Stats | null = data?.stats?.male || null
  const female: Stats | null = data?.stats?.female || null

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <div className="text-sm text-gray-500">{data?.event?.year} • {data?.event?.level}</div>
      </div>

      <div className="space-y-2">
        <div className="text-sm">Format: {data.format}{data.time_domain ? ` • ${data.time_domain}` : ''}{typeof data.time_cap_seconds === 'number' ? ` • Cap ${Math.floor((data.time_cap_seconds||0)/60)}:${String((data.time_cap_seconds||0)%60).padStart(2,'0')}` : ''}</div>
        {Array.isArray(data?.equipment) && data.equipment.length > 0 && (
          <div className="text-sm">Equipment: {data.equipment.join(', ')}</div>
        )}
      </div>

      {data?.notes && (
        <div className="prose max-w-none">
          <h2 className="text-lg font-medium">Notes</h2>
          <p>{data.notes}</p>
        </div>
      )}

      {Array.isArray(data?.tasks) && data.tasks.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-2">Tasks</h2>
          <div className="space-y-1 text-sm">
            {data.tasks.map((t: any, idx: number) => (
              <div key={idx} className="border rounded p-2">
                <div className="font-medium">{t.exercise || 'Exercise'}</div>
                <div className="text-gray-600">{[t.reps, t.time, t.calories, t.distance].filter(Boolean).join(' • ')}</div>
                <div className="text-gray-600">{[t.weight_male_lbs ? `${t.weight_male_lbs} lbs` : null, t.weight_female_lbs ? `${t.weight_female_lbs} lbs` : null].filter(Boolean).join(' / ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded p-3">
          <div className="font-medium mb-1">Men</div>
          {male ? (
            <div className="text-sm">Top {male.display_top} • P90 {male.display_p90} • P50 {male.display_median} • n={male.attempts_count}</div>
          ) : (
            <div className="text-sm text-gray-500">No stats</div>
          )}
        </div>
        <div className="border rounded p-3">
          <div className="font-medium mb-1">Women</div>
          {female ? (
            <div className="text-sm">Top {female.display_top} • P90 {female.display_p90} • P50 {female.display_median} • n={female.attempts_count}</div>
          ) : (
            <div className="text-sm text-gray-500">No stats</div>
          )}
        </div>
      </div>

      <div>
        <a href="/start" className="inline-flex items-center px-3 py-2 rounded bg-blue-600 text-white">Sign up to log this workout</a>
      </div>
    </div>
  )
}

