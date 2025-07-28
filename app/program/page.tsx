'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ProgramPage() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    redirectToCurrentWorkout()
  }, [])

  const redirectToCurrentWorkout = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/signin')
        return
      }

      // Get user ID
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (!userData) {
        router.push('/auth/signin')
        return
      }

      // Get latest program
      const { data: programData } = await supabase
        .from('programs')
        .select('id, generated_at')
        .eq('user_id', userData.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()

      if (!programData) {
        router.push('/intake')
        return
      }

      // Calculate current week and day
      const programStartDate = new Date(programData.generated_at)
      const today = new Date()
      const daysSinceStart = Math.floor((today.getTime() - programStartDate.getTime()) / (1000 * 60 * 60 * 24))
      
      const totalTrainingDays = daysSinceStart - (Math.floor(daysSinceStart / 7) * 2)
      const weekNumber = Math.floor(totalTrainingDays / 5) + 1
      const dayNumber = (totalTrainingDays % 5) + 1

      const currentWeek = Math.min(Math.max(1, weekNumber), 12)
      const currentDay = Math.min(Math.max(1, dayNumber), 5)

      // Redirect to dashboard workout view
      router.push(`/dashboard/workout/${programData.id}/week/${currentWeek}/day/${currentDay}`)
    } catch (error) {
      console.error('Error redirecting to workout:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your workout...</p>
        </div>
      </div>
    )
  }

  return null
}
