'use client'

import { useState } from 'react'

function parseCSV(text: string): Record<string, any>[] {
  const rows: Record<string, any>[] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim().length)
  if (!lines.length) return rows
  const header = lines[0].split(',').map(h => h.replace(/^\uFEFF/, '').trim())
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const fields: string[] = []
    let cur = ''
    let inQuotes = false
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]
      if (ch === '"') {
        if (inQuotes && line[j+1] === '"') { cur += '"'; j++ }
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
    header.forEach((h, idx) => {
      const v = fields[idx] ?? ''
      row[h] = v === '' ? null : v.trim()
    })
    rows.push(row)
  }
  return rows
}

export default function AdminMetconsImportPage() {
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [truncate, setTruncate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [errors, setErrors] = useState<string[]>([])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const parsed = parseCSV(text)
    setRows(parsed)
    setMessage('')
    setErrors([])
  }

  async function runImport() {
    setLoading(true)
    setMessage('')
    setErrors([])
    try {
      const res = await fetch('/api/admin/metcons/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metcons: rows, truncate })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Import failed')
      }
      setMessage(`Success! Inserted: ${data.inserted}, Updated: ${data.updated}, Total: ${data.total}`)
      if (data.errors) {
        setErrors(data.errors)
      }
    } catch (e: any) {
      setMessage(`Error: ${e?.message || 'Failed'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 space-y-6">
      <h1 className="text-2xl font-semibold">MetCons Import (Admin)</h1>
      <p className="text-gray-600">
        Upload a CSV file to bulk import MetCons into the database. These are used by the assign-metcon function.
      </p>

      <div className="border rounded p-4 space-y-4">
        <div>
          <label className="font-medium block mb-2">Upload metcons.csv</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <div className="text-sm text-gray-600 mt-2">Rows parsed: {rows.length}</div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={truncate}
            onChange={e => setTruncate(e.target.checked)}
            className="rounded"
          />
          <span className="text-red-600 font-medium">Delete all existing metcons before import</span>
        </label>

        <button
          disabled={loading || rows.length === 0}
          onClick={runImport}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-700"
        >
          {loading ? 'Importing...' : 'Import MetCons'}
        </button>

        {message && (
          <div className={`text-sm p-3 rounded ${message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}

        {errors.length > 0 && (
          <div className="text-sm bg-yellow-50 p-3 rounded">
            <div className="font-medium text-yellow-800 mb-2">Warnings/Errors ({errors.length}):</div>
            <ul className="list-disc list-inside text-yellow-700 space-y-1">
              {errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="border rounded p-4 space-y-4 bg-gray-50">
        <h2 className="font-semibold text-lg">CSV Format</h2>

        <div className="space-y-2 text-sm">
          <h3 className="font-medium">Required Columns:</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li><code className="bg-gray-200 px-1 rounded">workout_id</code> - Unique ID (e.g., "fran", "open-24-1")</li>
            <li><code className="bg-gray-200 px-1 rounded">level</code> - Open, Quarterfinal, Semifinal, Games</li>
            <li><code className="bg-gray-200 px-1 rounded">format</code> - AMRAP, For Time, Rounds+Reps, EMOM, etc.</li>
            <li><code className="bg-gray-200 px-1 rounded">tasks_json</code> - JSON array of movements</li>
          </ul>
        </div>

        <div className="space-y-2 text-sm">
          <h3 className="font-medium">Optional Columns:</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li><code className="bg-gray-200 px-1 rounded">time_range</code> - 1:00–5:00, 5:00–10:00, 10:00–15:00, 15:00–20:00, 20:00+</li>
            <li><code className="bg-gray-200 px-1 rounded">equipment_csv</code> - Comma-separated: Barbell, Dumbbells, Pullup Bar or Rig, etc.</li>
            <li><code className="bg-gray-200 px-1 rounded">max_weight_male</code> / <code className="bg-gray-200 px-1 rounded">max_weight_female</code> - Heaviest weight in lbs</li>
            <li><code className="bg-gray-200 px-1 rounded">workout_notes</code> - Description text</li>
            <li><code className="bg-gray-200 px-1 rounded">male_p90</code> - Male 90th percentile time (seconds)</li>
            <li><code className="bg-gray-200 px-1 rounded">male_p50</code> - Male 50th percentile/median time (seconds)</li>
            <li><code className="bg-gray-200 px-1 rounded">male_std_dev</code> - Male standard deviation (seconds)</li>
            <li><code className="bg-gray-200 px-1 rounded">female_p90</code> - Female 90th percentile time (seconds)</li>
            <li><code className="bg-gray-200 px-1 rounded">female_p50</code> - Female 50th percentile/median time (seconds)</li>
            <li><code className="bg-gray-200 px-1 rounded">female_std_dev</code> - Female standard deviation (seconds)</li>
          </ul>
        </div>

        <div className="space-y-2 text-sm">
          <h3 className="font-medium">tasks_json Format:</h3>
          <pre className="bg-gray-200 p-2 rounded overflow-x-auto text-xs">
{`[
  {"exercise": "Thruster", "reps": "21", "weight_male": "95", "weight_female": "65"},
  {"exercise": "Pull-up", "reps": "21"},
  {"exercise": "Thruster", "reps": "15", "weight_male": "95", "weight_female": "65"},
  {"exercise": "Pull-up", "reps": "15"},
  {"exercise": "Thruster", "reps": "9", "weight_male": "95", "weight_female": "65"},
  {"exercise": "Pull-up", "reps": "9"}
]`}
          </pre>
          <p className="text-gray-600">
            Each task can have: <code>exercise</code>, <code>reps</code>, <code>weight_male</code>, <code>weight_female</code>, <code>distance</code>, <code>time</code>, <code>calories</code>
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <h3 className="font-medium">Equipment Values (must match intake form):</h3>
          <div className="text-gray-700 space-y-1">
            <p><strong>Basics:</strong> Barbell, Dumbbells, Kettlebells, Pullup Bar or Rig, High Rings, Low or Adjustable Rings, Bench, Squat Rack, Open Space, Wall Space, Jump Rope, Wall Ball</p>
            <p><strong>Cardio:</strong> Rowing Machine, Air Bike, Ski Erg, Bike Erg</p>
            <p><strong>Specialty:</strong> GHD, Axle Bar, Climbing Rope, Pegboard, Parallettes, Dball, Dip Bar, Plyo Box, HS Walk Obstacle, Sandbag</p>
            <p><strong>Other:</strong> None</p>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <h3 className="font-medium">Example Row (Fran):</h3>
          <pre className="bg-gray-200 p-2 rounded overflow-x-auto text-xs">
{`workout_id,level,format,time_range,equipment_csv,max_weight_male,max_weight_female,tasks_json,workout_notes,male_p90,male_p50,male_std_dev,female_p90,female_p50,female_std_dev
fran,Open,For Time,1:00–5:00,"Barbell, Pullup Bar or Rig",95,65,"[{""exercise"":""Thruster"",""reps"":""21"",""weight_male"":""95"",""weight_female"":""65""},{""exercise"":""Pull-up"",""reps"":""21""},{""exercise"":""Thruster"",""reps"":""15"",""weight_male"":""95"",""weight_female"":""65""},{""exercise"":""Pull-up"",""reps"":""15""},{""exercise"":""Thruster"",""reps"":""9"",""weight_male"":""95"",""weight_female"":""65""},{""exercise"":""Pull-up"",""reps"":""9""}]",21-15-9 Thrusters and Pull-ups,180,330,45,240,420,55`}
          </pre>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="border rounded p-4">
          <h2 className="font-semibold mb-3">Preview (first 5 rows)</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gray-100">
                  {Object.keys(rows[0] || {}).slice(0, 8).map(key => (
                    <th key={key} className="px-2 py-1 text-left font-medium">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t">
                    {Object.values(row).slice(0, 8).map((val: any, j) => (
                      <td key={j} className="px-2 py-1 max-w-[200px] truncate">
                        {typeof val === 'string' ? val.slice(0, 50) : JSON.stringify(val)?.slice(0, 50)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
