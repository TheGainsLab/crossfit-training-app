'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface DaySummary {
  day: number
  dayName: string
  totalExercises: number
  completed: number
}

interface WeekSummary {
  week: number
  days: DaySummary[]
}

interface ProgramSummary {
  id: number
  generatedAt: string
  monthIndex: number
  weeks: WeekSummary[]
}

export default function ProgramPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [programs, setPrograms] = useState<ProgramSummary[]>([])

  useEffect(() => {
    loadPrograms()
  }, [])

  const loadPrograms = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      // Get DB user id
      const { data: userRow, error: userErr } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (userErr || !userRow) {
        setError('User not found')
        setLoading(false)
        return
      }
      setUserId(userRow.id)

      // Fetch all programs for this user ordered by generated date
      const { data: programRows, error: progErr } = await supabase
        .from('programs')
        .select('id, generated_at, program_data, weeks_generated')
        .eq('user_id', userRow.id)
        .order('generated_at', { ascending: true })

      if (progErr) {
        setError('Failed to load programs')
        setLoading(false)
        return
      }

      const monthPromises = (programRows || []).map(async (p: any, idx: number) => {
        const programData = p.program_data || {}
        const weeksGenerated: number[] = (p.weeks_generated || []).slice().sort((a: number, b: number) => a - b)
        const weeksInData: any[] = programData.weeks || []

        const weeks: WeekSummary[] = await Promise.all(
          weeksGenerated.map(async (weekNum) => {
            const weekData = weeksInData.find((w: any) => w.week === weekNum) || { days: [] }
            const days = (weekData.days || []).slice().sort((a: any, b: any) => a.day - b.day)

            const daySummaries: DaySummary[] = await Promise.all(
              days.map(async (d: any) => {
                const totalExercises = (d.blocks || []).reduce((sum: number, block: any) => sum + (block.exercises?.length || 0), 0)
                // Fetch completion count for this day via existing API
                let completed = 0
                try {
                  const res = await fetch(`/api/workouts/complete?userId=${userRow.id}&programId=${p.id}&week=${weekNum}&day=${d.day}`)
                  if (res.ok) {
                    const json = await res.json()
                    completed = json.totalCompleted || 0
                  }
                } catch {}

                return {
                  day: d.day,
                  dayName: d.dayName || `Day ${d.day}`,
                  totalExercises,
                  completed
                }
              })
            )

            return { week: weekNum, days: daySummaries }
          })
        )

        return {
          id: p.id,
          generatedAt: p.generated_at,
          monthIndex: idx + 1,
          weeks
        }
      })

      const summaries = await Promise.all(monthPromises)
      setPrograms(summaries)
      setLoading(false)
    } catch (err) {
      console.error('Error loading programs:', err)
      setError('Failed to load program overview')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your training programs...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <Link href="/dashboard" className="mt-4 text-blue-600 hover:text-blue-700">Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6 mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Training Overview</h1>
        </div>

        <div className="space-y-8">
          {programs.map((program) => (
            <div key={program.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-gray-900">Month {program.monthIndex}</h2>
              </div>
              <div className="text-sm text-gray-500 mb-4">Generated {new Date(program.generatedAt).toLocaleDateString()}</div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {program.weeks.map((week) => (
                  <div key={week.week} className="border rounded-lg p-4 bg-slate-blue border-coral">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-coral">Week {week.week}</h3>
                      <Link href={`/dashboard/workout/${program.id}/week/${week.week}/day/1`} className="text-sm text-blue-600 hover:text-blue-700">Open week →</Link>
                    </div>

                    <div className="space-y-2">
                      {week.days.map((day) => (
                        <Link
                          key={day.day}
                          href={`/dashboard/workout/${program.id}/week/${week.week}/day/${day.day}`}
                          className="flex items-center justify-between rounded border px-3 py-2 hover:bg-gray-50"
                        >
                          <div className="text-sm text-gray-800">{day.dayName}</div>
                          <div className="text-sm font-medium">
                            {day.completed}/{day.totalExercises} complete
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
