'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface ProgramOverview {
  id: number
  program_number: number
  weeks_generated: number[]
  generated_at: string
  user_snapshot: {
    name: string
    ability_level: string
  }
}

interface DayOverview {
  week: number
  day: number
  day_name: string
  main_lift: string
  total_exercises: number
  completed: boolean
}

export default function ProgramOverviewPage() {
  const [loading, setLoading] = useState(true)
  const [program, setProgram] = useState<ProgramOverview | null>(null)
  const [dayOverviews, setDayOverviews] = useState<DayOverview[]>([])
  const [completionStats, setCompletionStats] = useState({
    totalDays: 0,
    completedDays: 0,
    currentWeek: 1
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadProgramOverview()
  }, [])

  const loadProgramOverview = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      // Get user ID from users table
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (!userData) {
        setError('User not found')
        setLoading(false)
        return
      }

      // Get latest program
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('*')
        .eq('user_id', userData.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()

      if (programError || !programData) {
        setError('No program found')
        setLoading(false)
        return
      }

      setProgram(programData)

      // Get all program workouts to build overview
      const { data: workouts, error: workoutsError } = await supabase
        .from('program_workouts')
        .select('week, day, exercise_name, completed_at')
        .eq('program_id', programData.id)
        .order('week', { ascending: true })
        .order('day', { ascending: true })

      if (workoutsError) throw workoutsError

      // Process workouts into day overviews
      const dayMap = new Map<string, DayOverview>()
      const programWeeks = programData.program_data?.weeks || []

      // Initialize all days from program data
      programWeeks.forEach((week: any) => {
        week.days.forEach((day: any) => {
          const key = `${week.week}-${day.day}`
          const totalExercises = day.blocks.reduce((sum: number, block: any) => 
            sum + (block.exercises?.length || 0), 0
          )
          
          dayMap.set(key, {
            week: week.week,
            day: day.day,
            day_name: day.dayName,
            main_lift: day.mainLift,
            total_exercises: totalExercises,
            completed: false
          })
        })
      })

      // Mark completed days
      if (workouts) {
        workouts.forEach(workout => {
          const key = `${workout.week}-${workout.day}`
          const dayData = dayMap.get(key)
          if (dayData && workout.completed_at) {
            dayData.completed = true
          }
        })
      }

      const overviews = Array.from(dayMap.values())
      setDayOverviews(overviews)

      // Calculate stats
      const completedCount = overviews.filter(d => d.completed).length
      const currentWeek = Math.max(...overviews.filter(d => d.completed).map(d => d.week), 1)
      
      setCompletionStats({
        totalDays: overviews.length,
        completedDays: completedCount,
        currentWeek: currentWeek
      })

      setLoading(false)
    } catch (err) {
      console.error('Error loading program overview:', err)
      setError('Failed to load program overview')
      setLoading(false)
    }
  }

  const getWeekType = (weekNumber: number) => {
    if ([4, 8, 12].includes(weekNumber)) return 'Deload'
    return 'Training'
  }

  const getWeekColor = (weekNumber: number) => {
    if ([4, 8, 12].includes(weekNumber)) return 'bg-yellow-100 border-yellow-300'
    return 'bg-white border-gray-200'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading program overview...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <Link href="/dashboard" className="mt-4 text-blue-600 hover:text-blue-700">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Group days by week
  const weekGroups = dayOverviews.reduce((acc, day) => {
    if (!acc[day.week]) acc[day.week] = []
    acc[day.week].push(day)
    return acc
  }, {} as Record<number, DayOverview[]>)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Program Overview
              </h1>
              <p className="text-gray-600">
                Your {program?.weeks_generated.length || 0}-week training program
              </p>
            </div>
            <Link
              href="/dashboard"
              className="text-blue-600 hover:text-blue-700"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Progress Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-blue-600">
              {completionStats.completedDays}/{completionStats.totalDays}
            </div>
            <div className="text-gray-600">Days Completed</div>
            <div className="mt-2 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(completionStats.completedDays / completionStats.totalDays) * 100}%` }}
              />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-green-600">
              Week {completionStats.currentWeek}
            </div>
            <div className="text-gray-600">Current Week</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-purple-600">
              #{program?.program_number || 0}
            </div>
            <div className="text-gray-600">Program Number</div>
          </div>
        </div>

        {/* Week-by-Week View */}
        <div className="space-y-6">
          {Object.entries(weekGroups).map(([weekNum, days]) => {
            const week = parseInt(weekNum)
            const weekCompleted = days.filter(d => d.completed).length
            const isCurrentWeek = week === completionStats.currentWeek
            
            return (
              <div 
                key={week} 
                className={`rounded-lg border-2 p-6 ${getWeekColor(week)} ${
                  isCurrentWeek ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Week {week}
                      {isCurrentWeek && (
                        <span className="ml-2 text-sm bg-blue-600 text-white px-2 py-1 rounded">
                          Current
                        </span>
                      )}
                    </h2>
                    <p className="text-sm text-gray-600">{getWeekType(week)} Week</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">
                      {weekCompleted}/{days.length} days
                    </div>
                    <div className="text-sm text-gray-600">completed</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {days.map(day => (
                    <Link
                      key={`${day.week}-${day.day}`}
                      href={`/dashboard/workout/${program?.id}/week/${day.week}/day/${day.day}`}
                      className={`p-3 rounded-lg border transition-all ${
                        day.completed 
                          ? 'bg-green-50 border-green-300 hover:bg-green-100' 
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-sm">{day.day_name}</div>
                        {day.completed && <span className="text-green-600">✓</span>}
                      </div>
                      <div className="text-xs text-gray-600">{day.main_lift}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {day.total_exercises} exercises
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/program"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            View Detailed Program
          </Link>
          <Link
            href="/profile"
            className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700"
          >
            View Profile Analysis
          </Link>
        </div>
      </div>
    </div>
  )
}
