import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' }, 
        { status: 401 }
      )
    }

    // Get user's numeric ID from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, gender, units')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' }, 
        { status: 404 }
      )
    }

    console.log(`📊 Fetching BTN profile for user ${userData.id}`)

    // Fetch equipment
    const { data: equipment, error: equipmentError } = await supabase
      .from('user_equipment')
      .select('equipment_name')
      .eq('user_id', userData.id)

    if (equipmentError) {
      console.error('Equipment fetch error:', equipmentError)
      return NextResponse.json(
        { error: 'Failed to fetch equipment' }, 
        { status: 500 }
      )
    }

    // Fetch skills
    const { data: skills, error: skillsError } = await supabase
      .from('user_skills')
      .select('skill_name, skill_level')
      .eq('user_id', userData.id)

    if (skillsError) {
      console.error('Skills fetch error:', skillsError)
      return NextResponse.json(
        { error: 'Failed to fetch skills' }, 
        { status: 500 }
      )
    }

    // Fetch 1RMs
    const { data: oneRMs, error: oneRMsError } = await supabase
      .from('user_one_rms')
      .select('exercise_name, one_rm')
      .eq('user_id', userData.id)

    if (oneRMsError) {
      console.error('1RMs fetch error:', oneRMsError)
      return NextResponse.json(
        { error: 'Failed to fetch 1RMs' }, 
        { status: 500 }
      )
    }

    // Format response
    const equipmentArray = equipment?.map(e => e.equipment_name) || []
    
    // Convert skills array to object for easy lookup
    const skillsObject: { [key: string]: string } = {}
    skills?.forEach(skill => {
      skillsObject[skill.skill_name] = skill.skill_level
    })

    // Convert 1RMs array to object for easy lookup
    const oneRMsObject: { [key: string]: number } = {}
    oneRMs?.forEach(rm => {
      oneRMsObject[rm.exercise_name] = rm.one_rm
    })

    const profile = {
      equipment: equipmentArray,
      gender: userData.gender || 'Male',
      units: userData.units || 'Imperial (lbs)',
      skills: skillsObject,
      oneRMs: oneRMsObject
    }

    console.log(`✅ Profile fetched: ${equipmentArray.length} equipment, ${Object.keys(skillsObject).length} skills, ${Object.keys(oneRMsObject).length} 1RMs`)

    return NextResponse.json({
      success: true,
      profile
    })

  } catch (error: any) {
    console.error('❌ Error fetching user profile:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message }, 
      { status: 500 }
    )
  }
}
