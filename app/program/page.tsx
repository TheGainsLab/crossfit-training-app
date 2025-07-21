'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

interface Exercise {
  name: string
  sets: string
  reps: string
  weightTime: string
  notes: string
}

interface Block {
  block: string
  exercises: Exercise[]
}

interface Day {
  day: number
  dayName: string
  mainLift: string
  isDeload: boolean
  blocks: Block[]
  metconData?: {
    workoutId: string
    workoutFormat: string
    timeRange: string
    percentileGuidance: any
  }
}

interface Week {
  week: number
  days: Day[]
}

interface ProgramData {
  weeks: Week[]
  totalExercises: number
  metadata?: any
}

export default function ProgramPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [program, setProgram] = useState<ProgramData | null>(null)
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [selectedDay, setSelectedDay] = useState(1)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    loadProgram()
  }, [])

  const loadProgram = async () => {
    try {
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }
      setUser(user)

      // Get user ID from users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (userError || !userData) {
        setError('User not found')
        setLoading(false)
        return
      }

      // Fetch the latest program for this user
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('*')
        .eq('user_id', userData.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()

      if (programError || !programData) {
        setError('No program found. Please complete the intake assessment.')
        setLoading(false)
        return
      }

      // The program_data column contains the full program
      setProgram(programData.program_data)
      setLoading(false)
    } catch (err) {
      console.error('Error loading program:', err)
      setError('Failed to load program')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your program...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
            <p className="text-red-700">{error}</p>
            <a 
              href="/intake" 
              className="inline-block mt-4 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Go to Assessment
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!program || !program.weeks) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">No Program Data</h2>
            <p className="text-yellow-700">Program structure not found. Please contact support.</p>
          </div>
        </div>
      </div>
    )
  }

  const currentWeek = program.weeks.find(w => w.week === selectedWeek)
  const currentDay = currentWeek?.days.find(d => d.day === selectedDay)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Your CrossFit Training Program
          </h1>
          <p className="text-gray-600">
            {program.weeks.length} weeks generated • {program.totalExercises} total exercises
          </p>
        </div>

        {/* Week Selector */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex space-x-2 overflow-x-auto">
            {program.weeks.map((week) => (
              <button
                key={week.week}
                onClick={() => {
                  setSelectedWeek(week.week)
                  setSelectedDay(1)
                }}
                className={`px-4 py-2 rounded-md whitespace-nowrap ${
                  selectedWeek === week.week
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Week {week.week}
                {[4, 8, 12].includes(week.week) && (
                  <span className="ml-2 text-xs">(Deload)</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Day Selector */}
        {currentWeek && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex space-x-2 overflow-x-auto">
              {currentWeek.days.map((day) => (
                <button
                  key={day.day}
                  onClick={() => setSelectedDay(day.day)}
                  className={`px-4 py-2 rounded-md whitespace-nowrap ${
                    selectedDay === day.day
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {day.dayName}
                  <span className="block text-xs mt-1">{day.mainLift}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Workout Display */}
        {currentDay && (
          <div className="space-y-6">
            {/* Day Header */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {currentDay.dayName} - {currentDay.mainLift}
              </h2>
              {currentDay.isDeload && (
                <p className="text-yellow-600 font-medium mt-1">Deload Week - Reduced Volume</p>
              )}
            </div>

            {/* Workout Blocks */}
            {currentDay.blocks.map((block, blockIndex) => (
              <div key={blockIndex} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">
                  {block.block}
                </h3>
                
                {block.exercises.length === 0 ? (
                  <p className="text-gray-500 italic">No exercises assigned</p>
                ) : (
                  <div className="space-y-3">
                    {block.exercises.map((exercise, exIndex) => (
                      <div 
                        key={exIndex} 
                        className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 rounded"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">
                              {exercise.name}
                            </h4>
                            <div className="text-sm text-gray-600 mt-1">
                              {exercise.sets && (
                                <span className="mr-4">Sets: {exercise.sets}</span>
                              )}
                              {exercise.reps && (
                                <span className="mr-4">Reps: {exercise.reps}</span>
                              )}
                              {exercise.weightTime && (
                                <span className="mr-4">
                                  {exercise.weightTime.includes('kg') || exercise.weightTime.includes('lbs') 
                                    ? `Weight: ${exercise.weightTime}`
                                    : exercise.weightTime
                                  }
                                </span>
                              )}
                            </div>
                            {exercise.notes && (
                              <p className="text-sm text-gray-500 mt-1 italic">
                                {exercise.notes}
                              </p>
                            )}
                          </div>
                          <input
                            type="checkbox"
                            className="ml-4 h-5 w-5 text-blue-600 rounded"
                            title="Mark as complete"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* MetCon specific display */}
                {block.block === 'METCONS' && currentDay.metconData && (
                  <div className="mt-4 p-4 bg-blue-50 rounded">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold">Format:</span> {currentDay.metconData.workoutFormat}
                      </div>
                      <div>
                        <span className="font-semibold">Time:</span> {currentDay.metconData.timeRange}
                      </div>
                      {currentDay.metconData.percentileGuidance && (
                        <>
                          <div>
                            <span className="font-semibold">Target (50%):</span> {currentDay.metconData.percentileGuidance.medianScore}
                          </div>
                          <div>
                            <span className="font-semibold">Excellent (90%):</span> {currentDay.metconData.percentileGuidance.excellentScore}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
