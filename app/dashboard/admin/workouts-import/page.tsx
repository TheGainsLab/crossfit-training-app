'use client'

import { useEffect, useRef, useState } from 'react'

function parseCSV(text: string): Record<string, any>[] {
  // Minimal CSV parser for well-formed CSV with quoted fields
  const rows: Record<string, any>[] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim().length)
  if (!lines.length) return rows
  const header = lines[0].split(',')
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    // Handle quoted fields that may contain commas
    const fields: string[] = []
    let cur = ''
    let inQuotes = false
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]
      if (ch === '"') {
        if (inQuotes && line[j+1] === '"') { cur += '"'; j++; }
        else { inQuotes = !inQuotes }
      } else if (ch === ',' && !inQuotes) {
        fields.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
    fields.push(cur)
    const row: Record<string, any> = {}
    header.forEach((h, idx) => { row[h] = fields[idx] === '' ? null : fields[idx] })
    rows.push(row)
  }
  return rows
}

export default function AdminWorkoutsImportPage() {
  const [workoutsRows, setWorkoutsRows] = useState<Record<string, any>[]>([])
  const [statsRows, setStatsRows] = useState<Record<string, any>[]>([])
  const [truncate, setTruncate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string>('')
  const workoutsRef = useRef<HTMLInputElement>(null)
  const statsRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, setter: (rows: any[]) => void) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const rows = parseCSV(text)
    setter(rows)
  }

  async function runImport() {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/workouts/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Expect Admin to paste their bearer via a cookie or use a server token endpoint; for now omit auth header
        },
        body: JSON.stringify({ workouts: workoutsRows, stats: statsRows, truncate })
      })
      let data: any = null
      try { data = await res.json() } catch {}
      if (!res.ok) throw new Error((data && (data.error || data.message)) || 'Import failed')
      setMessage(`Imported: workouts=${data.inserted_workouts}, stats=${data.inserted_stats}`)
    } catch (e: any) {
      setMessage(e?.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Workouts Import (Admin)</h1>
      <div className="space-y-2">
        <div className="border rounded p-3">
          <div className="font-medium mb-2">Upload workouts.csv</div>
          <input ref={workoutsRef} type="file" accept=".csv" onChange={(e) => handleFileChange(e, setWorkoutsRows)} />
          <div className="text-sm text-gray-600 mt-1">Rows: {workoutsRows.length}</div>
        </div>
        <div className="border rounded p-3">
          <div className="font-medium mb-2">Upload stats.csv</div>
          <input ref={statsRef} type="file" accept=".csv" onChange={(e) => handleFileChange(e, setStatsRows)} />
          <div className="text-sm text-gray-600 mt-1">Rows: {statsRows.length}</div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={truncate} onChange={e => setTruncate(e.target.checked)} />
          Truncate staging tables before import
        </label>
        <button disabled={loading || (!workoutsRows.length && !statsRows.length)} onClick={runImport} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">
          {loading ? 'Importing…' : 'Import'}
        </button>
        {message && <div className="text-sm mt-2">{message}</div>}
      </div>
      <div className="text-sm text-gray-600">
        Expected headers:
        <div className="mt-1">workouts.csv: slug,event_year,event_name,event_level,name,format,time_domain,time_range?,time_cap_seconds,score_metric,tasks_json,notes,max_weight_male_lbs,max_weight_female_lbs,max_weight_male_kg,max_weight_female_kg,equipment_csv</div>
        <div>stats.csv: workout_slug,gender,top_value,p90_value,median_value,attempts_count,pct_time_capped,display_top,display_p90,display_median</div>
        <div className="mt-1">Allowed equipment names: Barbell, Dumbbells, Pullup Bar or Rig, Wall Ball, Kettlebell, Row Erg, Bike Erg, Ski Erg, Jump Rope, Plyo Box, Rings, Sandbag, Sled, Other</div>
      </div>
    </div>
  )
}

