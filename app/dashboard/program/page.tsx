'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  exercisesLogged: number
  lastLoggedAt?: string
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
      const supabase = createClient()
      
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

      // Get completed exercises from performance_logs
      const { data: completedLogs, error: logsError } = await supabase
        .from('performance_logs')
        .select('week, day, logged_at')
        .eq('program_id', programData.id)
        .eq('user_id', userData.id)

      if (logsError) {
        console.error('Error fetching performance logs:', logsError)
        // Continue without completion data rather than failing completely
      }

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
            completed: false,
            exercisesLogged: 0
          })
        })
      })

      // Mark completed days based on performance logs
      if (completedLogs && completedLogs.length > 0) {
        // Group logs by week/day to count exercises per day
        const logsByDay = new Map<string, {count: number, lastLogged: string}>()
        
        completedLogs.forEach(log => {
          const key = `${log.week}-${log.day}`
          const existing = logsByDay.get(key)
          
          if (existing) {
            existing.count += 1
            // Keep the most recent logged_at time
            if (new Date(log.logged_at) > new Date(existing.lastLogged)) {
              existing.lastLogged = log.logged_at
            }
          } else {
            logsByDay.set(key, {
              count: 1,
              lastLogged: log.logged_at
            })
          }
        })
        
        // Update day overviews with completion data
        logsByDay.forEach((logData, dayKey) => {
          const dayData = dayMap.get(dayKey)
          if (dayData) {
            dayData.exercisesLogged = logData.count
            dayData.lastLoggedAt = logData.lastLogged
            // Consider a day "completed" if at least one exercise is logged
            dayData.completed = logData.count > 0
          }
        })
      }

      const overviews = Array.from(dayMap.values())
      setDayOverviews(overviews)

      // Calculate stats
      const completedCount = overviews.filter(d => d.completed).length
      
      // Find current week based on latest activity or default to week 1
      let currentWeek = 1
      if (completedLogs && completedLogs.length > 0) {
        // Get the most recent week with activity
        const recentWeeks = completedLogs.map(log => log.week)
        currentWeek = Math.max(...recentWeeks)
        
        // If current week is fully completed, advance to next week
        const currentWeekDays = overviews.filter(d => d.week === currentWeek)
        const currentWeekCompleted = currentWeekDays.filter(d => d.completed).length
        
        if (currentWeekCompleted === currentWeekDays.length && currentWeek < Math.max(...overviews.map(d => d.week))) {
          currentWeek += 1
        }
      }
      
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
    return 'bg-ice-blue border-slate-blue'
  }

  const formatLastLogged = (lastLoggedAt?: string) => {
    if (!lastLoggedAt) return null
    
    const date = new Date(lastLoggedAt)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ice-blue flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-coral mx-auto"></div>
          <p className="mt-4 text-charcoal">Loading program overview...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-ice-blue flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <Link href="/dashboard" className="mt-4 text-coral hover:text-coral">
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
    <div className="min-h-screen bg-ice-blue py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
<div className="bg-slate-blue rounded-lg shadow-lg p-6 mb-6">        
          <div className="text-center">
            <h1 className="text-3xl font-bold text-charcoal mb-3">
              Program Overview
            </h1>
            <Link
              href="/dashboard"
              className="text-sm text-coral hover:text-coral underline"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Progress Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
<div className="bg-slate-blue rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-coral">
              {completionStats.completedDays}/{completionStats.totalDays}
            </div>
            <div className="text-charcoal">Days Completed</div>
            <div className="mt-2 bg-slate-blue rounded-full h-2">
              <div
                className="bg-coral h-2 rounded-full transition-all duration-300"
                style={{ width: `${(completionStats.completedDays / completionStats.totalDays) * 100}%` }}
              />
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {Math.round((completionStats.completedDays / completionStats.totalDays) * 100)}% complete
            </div>
          </div>

<div className="bg-slate-blue rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-coral">
              Week {completionStats.currentWeek}
            </div>
            <div className="text-charcoal">Current Week</div>
            <div className="text-sm text-gray-500 mt-1">
              {getWeekType(completionStats.currentWeek)} Week
            </div>
          </div>
          
<div className="bg-slate-blue rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-charcoal">
              #{program?.program_number || 0}
            </div>
            <div className="text-charcoal">Program Number</div>
            <div className="text-sm text-gray-500 mt-1">
              Generated {program?.generated_at ? new Date(program.generated_at).toLocaleDateString() : ''}
            </div>
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
                
className={`rounded-lg border-2 p-6 bg-slate-blue ${
                  [4, 8, 12].includes(week) ? 'border-yellow-300' : 'border-slate-blue'
                } ${isCurrentWeek ? 'ring-2 ring-coral' : ''}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-charcoal">
                      Week {week}
                      {isCurrentWeek && (
                        <span className="ml-2 text-sm bg-coral text-white px-2 py-1 rounded">
                          Current
                        </span>
                      )}
                    </h2>
                    <p className="text-sm text-gray-600">{getWeekType(week)} Week</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-charcoal">
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
                      className={`p-3 rounded-lg border transition-all hover:shadow-md ${
                        day.completed 
                          ? 'bg-coral/5 border-coral/30 hover:bg-coral/10' 
                          : 'bg-white border-slate-blue hover:border-coral'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-sm text-charcoal">{day.day_name}</div>
                        {day.completed && <span className="text-coral text-lg">✓</span>}
                      </div>
                      <div className="text-xs text-gray-500">
                        {day.exercisesLogged > 0 
                          ? `${day.exercisesLogged}/${day.total_exercises} exercises logged`
                          : `${day.total_exercises} exercises`
                        }
                      </div>
                      {day.lastLoggedAt && (
                        <div className="text-xs text-coral mt-1">
                          {formatLastLogged(day.lastLoggedAt)}
                        </div>
                      )}
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
            href="/dashboard"
            className="bg-coral text-white px-6 py-3 rounded-lg hover:bg-coral"
          >
            ← Back to Dashboard
          </Link>
          <Link
            href="/dashboard/progress"
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
          >
            View Analytics
          </Link>
          <Link
            href="/dashboard/settings"
            className="bg-charcoal text-white px-6 py-3 rounded-lg hover:bg-charcoal"
          >
            Settings
          </Link>
        </div>
      </div>
    </div>
  )
}
