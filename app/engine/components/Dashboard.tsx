'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Lock } from 'lucide-react'
import engineDatabaseService from '@/lib/engine/databaseService'

interface DashboardProps {
  onDayClick: (dayNumber: number, dayType?: string) => void
  onAnalyticsClick: () => void
  showTrainingView?: boolean
  onTrainingViewShown?: () => void
  initialMonth?: number
}

type InternalView = 'main' | 'months' | 'month-days'

export default function Dashboard({
  onDayClick,
  onAnalyticsClick,
  showTrainingView = false,
  onTrainingViewShown,
  initialMonth
}: DashboardProps) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || 1)
  const [workouts, setWorkouts] = useState<any[]>([])
  const [completedSessions, setCompletedSessions] = useState<any[]>([])
  const [programVersion, setProgramVersion] = useState<string | null>(null)
  const [internalView, setInternalView] = useState<InternalView>('main')

  const totalMonths = 36

  const getDaysPerMonth = () => {
    if (!programVersion) return 20
    return programVersion === '3-day' ? 12 : 20
  }

  const getDaysPerWeek = () => {
    if (!programVersion) return 5
    return programVersion === '3-day' ? 3 : 5
  }

  const loadProgramVersion = useCallback(async () => {
    if (!engineDatabaseService.isConnected()) return null

    try {
      const version = await engineDatabaseService.loadProgramVersion()
      const finalVersion = version || '5-day'
      setProgramVersion(finalVersion)
      return finalVersion
    } catch (error) {
      console.error('Error loading program version:', error)
      const defaultVersion = '5-day'
      setProgramVersion(defaultVersion)
      return defaultVersion
    }
  }, [])

  const loadUserDataAndSessions = useCallback(async () => {
    if (!engineDatabaseService.isConnected()) return

    setLoading(true)
    try {
      const version = await engineDatabaseService.loadProgramVersion()
      const userProgramVersion = version || '5-day'
      setProgramVersion(prev => prev || userProgramVersion)

      const [progress, workoutsData] = await Promise.all([
        engineDatabaseService.loadUserProgress(),
        engineDatabaseService.getWorkoutsForProgram(userProgramVersion)
      ])

      if (progress.user) {
        setUser(progress.user)
      }

      // Normalize legacy program_version values to program IDs
      const normalizeProgramVersion = (version: string | null): string => {
        if (!version) return 'main_5day'
        if (version === '5-day' || version === 'Premium') return 'main_5day'
        if (version === '3-day') return 'main_3day'
        return version
      }

      const allSessions = progress.completedSessions || []
      const filteredSessions = allSessions.filter((session: any) => {
        const normalizedSessionVersion = normalizeProgramVersion(session.program_version)
        return normalizedSessionVersion === userProgramVersion
      })

      setCompletedSessions(filteredSessions)
      setWorkouts(workoutsData || [])
    } catch (error) {
      console.error('Failed to load user data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (engineDatabaseService.isConnected()) {
      loadUserDataAndSessions()
      loadProgramVersion()
    }
  }, [loadUserDataAndSessions, loadProgramVersion])

  useEffect(() => {
    if (showTrainingView) {
      if (initialMonth) {
        setSelectedMonth(initialMonth)
        setInternalView('month-days')
      } else {
        setInternalView('months')
      }
    }
  }, [showTrainingView, initialMonth])

  const getMonthAccess = (monthNumber: number) => {
    const daysPerMonth = getDaysPerMonth()

    if (!user) {
      return monthNumber === 1
    }

    if (user.months_unlocked >= 36) {
      return true
    }

    if (user.subscription_status === 'trial') {
      return monthNumber === 1
    }

    if (user.subscription_status === 'active') {
      const maxMonth = Math.ceil((user.current_day || 1) / daysPerMonth)
      return monthNumber <= maxMonth
    }

    return monthNumber === 1
  }

  const getMonthCompletionRatio = (monthNumber: number) => {
    const daysPerMonth = getDaysPerMonth()
    const startDay = (monthNumber - 1) * daysPerMonth + 1
    const endDay = monthNumber * daysPerMonth

    const completedDays = completedSessions.filter(session => {
      const dayNumber = session.program_day_number || session.program_day || session.day_number || session.workout_day
      return dayNumber >= startDay && dayNumber <= endDay
    }).length

    return `${completedDays}/${daysPerMonth}`
  }

  const getCurrentMonth = () => {
    if (!user || !user.current_day) return 0
    const daysPerMonth = getDaysPerMonth()
    const currentMonth = Math.ceil(user.current_day / daysPerMonth)
    return Math.min(currentMonth, 36)
  }

  const getTotalProgramDays = () => {
    if (programVersion === '5-day') {
      return 720
    }
    return 432
  }

  const getDayStatus = (workout: any) => {
    if (!workout) return 'locked'

    const dayNumber = workout.program_day_number || workout.day_number
    const completedDays = completedSessions.map(session =>
      session.program_day_number || session.program_day || session.day_number || session.workout_day
    )

    if (completedDays.includes(dayNumber)) {
      return 'completed'
    }

    const currentDay = user?.current_day || 1
    if (dayNumber === currentDay) {
      return 'current'
    }
    if (dayNumber < currentDay) {
      return 'available'
    }

    const maxUnlockedDay = user?.subscription_status === 'trial' 
      ? getDaysPerMonth()
      : (user?.current_day || 0) + getDaysPerMonth()

    if (dayNumber <= maxUnlockedDay) {
      return 'available'
    }

    return 'locked'
  }

  const getWorkoutTypeDisplayName = (dayType: string) => {
    const typeMap: Record<string, string> = {
      'time_trial': 'Time Trial',
      'endurance': 'Endurance',
      'anaerobic': 'Anaerobic',
      'max_aerobic_power': 'Max Aerobic Power',
      'interval': 'Interval',
      'polarized': 'Polarized',
      'threshold': 'Threshold',
      'tempo': 'Tempo',
      'recovery': 'Recovery',
      'flux': 'Flux',
      'flux_stages': 'Flux Stages',
      'devour': 'Devour',
      'towers': 'Towers',
      'afterburner': 'Afterburner',
      'synthesis': 'Synthesis',
      'hybrid_anaerobic': 'Hybrid Anaerobic',
      'hybrid_aerobic': 'Hybrid Aerobic',
      'ascending': 'Ascending',
      'descending': 'Descending',
      'ascending_devour': 'Ascending Devour',
      'descending_devour': 'Descending Devour',
      'infinity': 'Infinity',
      'atomic': 'Atomic',
      'rocket_races_a': 'Rocket Races A',
      'rocket_races_b': 'Rocket Races B'
    }
    return typeMap[dayType] || dayType?.replace('_', ' ') || 'Conditioning'
  }

  const handleDayClick = (workout: any) => {
    if (!workout) return

    const status = getDayStatus(workout)
    if (status === 'locked') return

    const dayNumber = workout.day_number
    const daysPerMonth = getDaysPerMonth()
    const dayNum = workout.program_day_number || workout.day_number
    const isTimeTrialDay = dayNum % daysPerMonth === 1 || (programVersion === '3-day' && dayNum % 12 === 1)
    const dayType = workout.day_type || (isTimeTrialDay ? 'time_trial' : undefined)

    onDayClick(dayNumber, dayType)
  }

  const handleMonthClick = (monthNum: number) => {
    if (!getMonthAccess(monthNum)) return
    setSelectedMonth(monthNum)
    setInternalView('month-days')
  }

  const renderDayCard = (workout: any) => {
    if (!workout) return null

    const status = getDayStatus(workout)
    const dayNumber = workout.program_day_number || workout.day_number
    const daysPerMonth = getDaysPerMonth()
    const isTimeTrialDay = dayNumber % daysPerMonth === 1 || (programVersion === '3-day' && dayNumber % 12 === 1)

    if (status === 'locked') return null

    return (
      <button
        key={workout.id || dayNumber}
        onClick={() => handleDayClick(workout)}
        className="bg-[#DAE2EA] border border-[#FE5858] rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg flex flex-col items-start gap-2 text-left w-full"
      >
        <span className="font-semibold text-gray-900 text-base">
          Day {dayNumber}
        </span>
        <span className="text-xs text-gray-900 font-medium">
          {isTimeTrialDay ? 'Time Trial' : getWorkoutTypeDisplayName(workout.day_type)}
        </span>
        {status === 'completed' && (
          <span className="text-xs text-gray-900 font-medium">
            Completed
          </span>
        )}
        {status === 'available' && (
          <span className="text-xs text-gray-900 font-medium">
            Ready to start
          </span>
        )}
      </button>
    )
  }

  const renderMonthGrid = () => {
    const daysPerMonth = getDaysPerMonth()
    const startDay = (selectedMonth - 1) * daysPerMonth + 1
    const endDay = selectedMonth * daysPerMonth

    const monthWorkouts = workouts.filter(workout => {
      const dayNumber = workout.program_day_number || workout.day_number
      return dayNumber >= startDay && dayNumber <= endDay
    })

    const daysPerWeek = getDaysPerWeek()
    const numWeeks = Math.ceil(daysPerMonth / daysPerWeek)
    const weeks = []

    for (let week = 1; week <= numWeeks; week++) {
      const weekStartDay = startDay + (week - 1) * daysPerWeek
      const weekEndDay = Math.min(weekStartDay + daysPerWeek - 1, endDay)

      const weekWorkouts = monthWorkouts
        .filter(workout => {
          const dayNumber = workout.program_day_number || workout.day_number
          return dayNumber >= weekStartDay && dayNumber <= weekEndDay
        })
        .sort((a, b) => {
          const dayA = a.program_day_number || a.day_number
          const dayB = b.program_day_number || b.day_number
          return dayA - dayB
        })

      const weekDays = weekWorkouts.map(workout => renderDayCard(workout)).filter(Boolean)

      if (weekDays.length > 0) {
        const completedDays = weekDays.filter((_, idx) => {
          const workout = weekWorkouts[idx]
          return getDayStatus(workout) === 'completed'
        }).length

        weeks.push(
          <div key={week} id={`week-${week}`} className="mb-8 scroll-mt-24">
            <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span className="inline-block w-1 h-5 bg-[#FE5858] rounded"></span>
                Week {week}
              </h3>
              <div className="px-3 py-1 bg-[#FE5858] text-white border border-gray-900 rounded-lg text-sm font-semibold">
                {completedDays}/{weekDays.length} completed
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
              {weekDays}
            </div>
          </div>
        )
      }
    }

    return weeks
  }

  const renderMainView = () => {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6 mb-8">
          <div className="bg-[#DAE2EA] rounded-2xl p-6 border border-white/20 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Progress Overview</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-[#FE5858]">
                  {getCurrentMonth()}
                </div>
                <div className="text-sm text-gray-900 font-medium">Current Month</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[#FE5858]">
                  {completedSessions.length}
                </div>
                <div className="text-sm text-gray-900 font-medium">Days Completed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[#FE5858]">
                  {Math.round((completedSessions.length / getTotalProgramDays()) * 100)}%
                </div>
                <div className="text-sm text-gray-900 font-medium">Percentage</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Training Program</h2>
            <button
              onClick={() => setInternalView('months')}
              className="px-6 py-2 bg-[#FE5858] text-white rounded-lg font-semibold hover:bg-[#ff6b6b] transition-colors"
            >
              View Months
            </button>
          </div>
          <p className="text-gray-600">
            Select a month to view your training days. Program: {programVersion === '3-day' ? 'Engine 3-Day' : 'Engine 5-Day'}
          </p>
        </div>
      </div>
    )
  }

  const renderMonthsView = () => {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <button
            onClick={() => setInternalView('main')}
            className="flex items-center gap-2 bg-[#DAE2EA] border border-white/30 rounded-lg px-4 py-2 text-gray-600 text-sm font-medium mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Select a Month</h2>
        </div>

        <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-lg">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            {Array.from({ length: totalMonths }, (_, i) => {
              const monthNum = i + 1
              const hasAccess = getMonthAccess(monthNum)

              if (!hasAccess) return null

              return (
                <button
                  key={monthNum}
                  onClick={() => handleMonthClick(monthNum)}
                  className="bg-[#DAE2EA] border border-[#FE5858] rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg flex flex-col items-start gap-2"
                >
                  <span className="font-semibold text-gray-900 text-base">
                    Month {monthNum}
                  </span>
                  <span className="text-xs text-gray-900 font-medium">
                    {getMonthCompletionRatio(monthNum)} completed
                  </span>
                </button>
              )
            }).filter(Boolean)}
          </div>
        </div>
      </div>
    )
  }

  const renderMonthDaysView = () => {
    const daysPerMonth = getDaysPerMonth()
    const numWeeks = Math.ceil(daysPerMonth / getDaysPerWeek())

    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <button
            onClick={() => setInternalView('months')}
            className="flex items-center gap-2 bg-[#FE5858] border border-gray-900 rounded-lg px-4 py-2 text-white text-sm font-bold mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Months
          </button>
          <h2 className="text-2xl font-bold text-gray-900">
            Month {selectedMonth} - Days {(selectedMonth - 1) * daysPerMonth + 1} to {selectedMonth * daysPerMonth}
          </h2>
          <div className="flex justify-center gap-3 mt-4 flex-wrap">
            {Array.from({ length: numWeeks }, (_, i) => {
              const week = i + 1
              return (
                <button
                  key={week}
                  onClick={() => {
                    const weekElement = document.getElementById(`week-${week}`)
                    if (weekElement) {
                      weekElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  }}
                  className="bg-[#DAE2EA] border-2 border-[#FE5858] rounded-lg px-6 py-3 text-gray-900 text-sm font-semibold cursor-pointer transition-all hover:bg-[#FE5858] hover:text-white hover:-translate-y-0.5 hover:shadow-lg whitespace-nowrap"
                >
                  Week {week}
                </button>
              )
            })}
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-lg">
          {!getMonthAccess(selectedMonth) ? (
            <div className="text-center py-12">
              <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                Month {selectedMonth} Locked
              </h4>
              <p className="text-gray-600 mb-6">
                Subscribe to unlock Month {selectedMonth} of your training program
              </p>
            </div>
          ) : (
            renderMonthGrid()
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FE5858] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {internalView === 'main' && renderMainView()}
      {internalView === 'months' && renderMonthsView()}
      {internalView === 'month-days' && renderMonthDaysView()}
    </div>
  )
}

