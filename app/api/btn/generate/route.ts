import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateTestWorkouts } from '@/lib/btn/utils'
import { UserProfile } from '@/lib/btn/types'

interface GenerateRequest {
  selectedDomains?: string[]
  barbellFilter?: 'any' | 'required' | 'excluded'
  dumbbellFilter?: 'any' | 'required' | 'excluded'
  cardioFilter?: 'any' | 'rower' | 'bike' | 'ski' | 'none'
  exerciseCount?: 'any' | '2' | '3'
  workoutFormat?: 'any' | 'for_time' | 'amrap' | 'rounds_for_time'
  includeExercises?: string[]
  excludeExercises?: string[]
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Parse request body
    const body: GenerateRequest = await request.json()
    const {
      selectedDomains,
      barbellFilter = 'any',
      dumbbellFilter = 'any',
      cardioFilter = 'any',
      exerciseCount = 'any',
      workoutFormat = 'any',
      includeExercises,
      excludeExercises
    } = body

    console.log('🎲 API: Generating workouts with filters:', {
      selectedDomains,
      barbellFilter,
      dumbbellFilter,
      cardioFilter,
      exerciseCount,
      workoutFormat,
      includeExercises,
      excludeExercises
    })

    // Fetch user profile for personalized generation
    let userProfile: UserProfile | undefined = undefined

    try {
      // Get user's numeric ID
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (userData) {
        // Fetch equipment
        const { data: equipmentData } = await supabase
          .from('user_equipment')
          .select('equipment_name')
          .eq('user_id', userData.id)
          .eq('has_access', true)

        // Fetch skills
        const { data: skillsData } = await supabase
          .from('user_skills')
          .select('skill_name, proficiency_level')
          .eq('user_id', userData.id)

        // Fetch 1RMs
        const { data: oneRMData } = await supabase
          .from('user_one_rms')
          .select('lift_name, weight')
          .eq('user_id', userData.id)

        // Fetch gender from users table
        const { data: profileData } = await supabase
          .from('users')
          .select('gender')
          .eq('id', userData.id)
          .single()

        // Build profile object
        const equipment = equipmentData?.map(e => e.equipment_name) || []
        const skills: { [key: string]: string } = {}
        skillsData?.forEach(s => {
          skills[s.skill_name] = s.proficiency_level
        })
        const oneRMs: { [key: string]: number } = {}
        oneRMData?.forEach(o => {
          oneRMs[o.lift_name] = o.weight
        })

        if (equipment.length > 0 || Object.keys(skills).length > 0 || Object.keys(oneRMs).length > 0) {
          userProfile = {
            equipment,
            skills,
            oneRMs,
            gender: profileData?.gender || 'Male',
            units: 'lbs' // Default to pounds for BTN workouts
          }
          console.log('✅ User profile loaded for generation')
        }
      }
    } catch (profileError) {
      console.warn('⚠️ Could not load user profile, using defaults:', profileError)
    }

    // Build requiredEquipment and excludeEquipment arrays
    const requiredEquipment: string[] = []
    const excludeEquipment: string[] = []

    if (barbellFilter === 'required') {
      requiredEquipment.push('Barbell')
    } else if (barbellFilter === 'excluded') {
      excludeEquipment.push('Barbell')
    }

    if (dumbbellFilter === 'required') {
      requiredEquipment.push('Dumbbells')
    } else if (dumbbellFilter === 'excluded') {
      excludeEquipment.push('Dumbbells')
    }

    // Convert exercise count to number
    const exerciseCountNum = exerciseCount === 'any' ? undefined : parseInt(exerciseCount)

    // Convert workout format to internal format string
    const formatFilter = workoutFormat === 'any' ? undefined :
      workoutFormat === 'for_time' ? 'For Time' :
      workoutFormat === 'amrap' ? 'AMRAP' : 'Rounds For Time'

    // Convert cardio filter
    const cardioOption = cardioFilter === 'any' ? undefined : cardioFilter

    // Generate workouts
    const workouts = await generateTestWorkouts(
      selectedDomains && selectedDomains.length > 0 ? selectedDomains : undefined,
      userProfile,
      requiredEquipment.length > 0 ? requiredEquipment : undefined,
      excludeEquipment.length > 0 ? excludeEquipment : undefined,
      exerciseCountNum,
      formatFilter,
      cardioOption,
      includeExercises && includeExercises.length > 0 ? includeExercises : undefined,
      excludeExercises && excludeExercises.length > 0 ? excludeExercises : undefined
    )

    console.log(`✅ Generated ${workouts.length} workouts via API`)

    return NextResponse.json({
      success: true,
      workouts
    })

  } catch (error: any) {
    console.error('❌ Error generating workouts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate workouts' },
      { status: 500 }
    )
  }
}
