'use client'

import { useEffect, useMemo, useState } from 'react'

type WorkoutItem = {
  workout_id: string
  slug: string
  name: string
  event_year: number
  event_level: 'Open' | 'Quarterfinal' | 'Semifinal' | 'Games'
  format: 'AMRAP' | 'For Time' | 'Ladder'
  time_domain: 'sprint' | 'short' | 'medium' | 'long' | 'ultra' | null
  equipment: string[]
  display_top_male?: string
  display_p90_male?: string
  display_median_male?: string
  display_top_female?: string
  display_p90_female?: string
  display_median_female?: string
}

export default function WorkoutsPage() {
  const [items, setItems] = useState<WorkoutItem[]>([])
  const [count, setCount] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  const [q, setQ] = useState('')
  const [level, setLevel] = useState<string>('')
  const [format, setFormat] = useState<string>('')
  const [timeDomain, setTimeDomain] = useState<string>('')
  const [timeRange, setTimeRange] = useState<string>('')
  const [equipment, setEquipment] = useState<string[]>([])
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [sort, setSort] = useState<'newest' | 'popularity' | 'name'>('newest')

  const query = useMemo(() => {
    const usp = new URLSearchParams()
    if (q) usp.set('q', q)
    if (level) usp.set('level', level)
    if (format) usp.set('format', format)
    if (timeDomain) usp.set('timeDomain', timeDomain)
    if (timeRange) usp.set('timeRange', timeRange)
    if (equipment.length) usp.set('equipment', equipment.join(','))
    if (gender) usp.set('gender', gender)
    if (sort) usp.set('sort', sort)
    usp.set('limit', '20')
    usp.set('offset', '0')
    return usp.toString()
  }, [q, level, format, timeDomain, equipment, gender, sort])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/workouts/search?${query}`)
      .then(r => r.json())
      .then(res => {
        if (cancelled) return
        setItems(res.items || [])
        setCount(res.count || 0)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [query])

  const toggleEquipment = (name: string) => {
    setEquipment(prev => (prev.includes(name) ? prev.filter(e => e !== name) : [...prev, name]))
  }

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Competition Workouts</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-start">
        <input className="border p-2 rounded" placeholder="Search name…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="border p-2 rounded" value={level} onChange={e => setLevel(e.target.value)}>
          <option value="">Level</option>
          <option>Open</option>
          <option>Quarterfinal</option>
          <option>Semifinal</option>
          <option>Games</option>
        </select>
        <select className="border p-2 rounded" value={format} onChange={e => setFormat(e.target.value)}>
          <option value="">Format</option>
          <option>AMRAP</option>
          <option>For Time</option>
          <option>Ladder</option>
        </select>
        <select className="border p-2 rounded" value={timeRange} onChange={e => setTimeRange(e.target.value)}>
          <option value="">Time Range</option>
          <option>1:00–5:00</option>
          <option>5:00–10:00</option>
          <option>10:00–15:00</option>
          <option>15:00–20:00</option>
          <option>20:00+</option>
        </select>
        <select className="border p-2 rounded" value={gender} onChange={e => setGender(e.target.value as 'male' | 'female')}>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <select className="border p-2 rounded" value={sort} onChange={e => setSort(e.target.value as any)}>
          <option value="newest">Newest</option>
          <option value="popularity">Popularity</option>
          <option value="name">Name</option>
        </select>
      </div>

      {/* Equipment quick toggles */}
      <div className="flex flex-wrap gap-2 text-sm">
        {['Barbell','Dumbbells','Pullup Bar or Rig','Wall Ball','Kettlebell','Row Erg','Bike Erg','Ski Erg','Jump Rope','Rings','Sandbag','Sled'].map(e => (
          <button key={e} onClick={() => toggleEquipment(e)} className={`px-2 py-1 rounded border ${equipment.includes(e) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}>{e}</button>
        ))}
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-gray-500">Results: {count}</div>
          {items.map(w => (
            <div key={w.workout_id} className="border rounded p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{w.name}</div>
                <div className="text-sm text-gray-500">{w.event_year} • {w.event_level} • {w.format}{w.time_domain ? ` • ${w.time_domain}` : ''}</div>
                <div className="text-sm">
                  {gender === 'female' ? (
                    <>Top {w.display_top_female} • P90 {w.display_p90_female} • P50 {w.display_median_female}</>
                  ) : (
                    <>Top {w.display_top_male} • P90 {w.display_p90_male} • P50 {w.display_median_male}</>
                  )}
                </div>
              </div>
              <a href={`/workouts/${encodeURIComponent((w as any).slug || '')}`} className="text-blue-600 underline">Info</a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

