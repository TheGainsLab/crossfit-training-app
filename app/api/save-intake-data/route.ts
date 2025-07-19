import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { userId, equipment, skills, oneRMs } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Create Supabase client with service role key
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('💾 Saving intake data for user:', userId)

    // Save equipment
    console.log('🔧 Saving equipment...')
    await supabaseAdmin.from('user_equipment').delete().eq('user_id', userId)
    
    if (equipment && equipment.length > 0) {
      const equipmentRecords = equipment.map((equipmentName: string) => ({
        user_id: userId,
        equipment_name: equipmentName
      }))
      
      const { error: equipmentError } = await supabaseAdmin
        .from('user_equipment')
        .insert(equipmentRecords)
      
      if (equipmentError) {
        console.error('❌ Equipment error:', equipmentError)
        return NextResponse.json({ 
          error: 'Equipment insertion failed', 
          details: equipmentError.message 
        }, { status: 500 })
      }
      
      console.log('✅ Equipment saved:', equipment.length, 'items')
    }

    // Save skills
    console.log('🎯 Saving skills...')
    await supabaseAdmin.from('user_skills').delete().eq('user_id', userId)
    
    if (skills && skills.length > 0) {
      const skillRecords = skills.map((skillLevel: string, index: number) => ({
        user_id: userId,
        skill_index: index,
        skill_name: getSkillNameByIndex(index),
        skill_level: skillLevel
      })).filter((skill: any) => skill.skill_name)
      
      if (skillRecords.length > 0) {
        const { error: skillsError } = await supabaseAdmin
          .from('user_skills')
          .insert(skillRecords)
        
        if (skillsError) {
          console.error('❌ Skills error:', skillsError)
          return NextResponse.json({ 
            error: 'Skills insertion failed', 
            details: skillsError.message 
          }, { status: 500 })
        }
        
        console.log('✅ Skills saved:', skillRecords.length, 'records')
      }
    }

    // Save 1RMs
    console.log('💪 Saving 1RMs...')
    await supabaseAdmin.from('user_one_rms').delete().eq('user_id', userId)
    
    if (oneRMs && oneRMs.length > 0) {
      const oneRMLifts = [
        'Snatch', 'Power Snatch', 'Clean and Jerk', 'Power Clean', 'Clean (clean only)',
        'Jerk (from rack or blocks, max Split or Power Jerk)', 'Back Squat', 'Front Squat',
        'Overhead Squat', 'Deadlift', 'Bench Press', 'Push Press', 'Strict Press',
        'Weighted Pullup (do not include body weight)'
      ]
      
      const oneRMRecords = oneRMs.map((oneRMValue: string, index: number) => ({
        user_id: userId,
        one_rm_index: index,
        exercise_name: oneRMLifts[index],
        one_rm: parseFloat(oneRMValue)
      })).filter((record: any) => !isNaN(record.one_rm) && record.one_rm > 0)

      if (oneRMRecords.length > 0) {
        const { error: oneRMError } = await supabaseAdmin
          .from('user_one_rms')
          .insert(oneRMRecords)
        
        if (oneRMError) {
          console.error('❌ 1RM error:', oneRMError)
          return NextResponse.json({ 
            error: '1RM insertion failed', 
            details: oneRMError.message 
          }, { status: 500 })
        }
        
        console.log('✅ 1RMs saved:', oneRMRecords.length, 'records')
      }
    }

    console.log('🎉 All intake data saved successfully')

    return NextResponse.json({
      success: true,
      message: 'Intake data saved successfully'
    })

  } catch (error) {
    console.error('❌ Save intake data error:', error)
    return NextResponse.json({
      error: 'Failed to save intake data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper function to get skill name by index
function getSkillNameByIndex(index: number): string {
  const skillCategories = [
    {
      name: 'Basic CrossFit skills',
      skills: [
        { name: 'Double Unders', index: 0 },
        { name: 'Wall Balls', index: 1 }
      ]
    },
    {
      name: 'Upper Body Pulling',
      skills: [
        { name: 'Toes to Bar', index: 2 },
        { name: 'Pull-ups (kipping or butterfly)', index: 3 },
        { name: 'Chest to Bar Pull-ups', index: 4 },
        { name: 'Strict Pull-ups', index: 5 }
      ]
    },
    {
      name: 'Upper Body Pressing',
      skills: [
        { name: 'Push-ups', index: 6 },
        { name: 'Ring Dips', index: 7 },
        { name: 'Strict Ring Dips', index: 8 },
        { name: 'Strict Handstand Push-ups', index: 9 },
        { name: 'Wall Facing Handstand Push-ups', index: 10 },
        { name: 'Deficit Handstand Push-ups (4")', index: 11 }
      ]
    },
    {
      name: 'Additional Common Skills',
      skills: [
        { name: 'Alternating Pistols', index: 12 },
        { name: 'GHD Sit-ups', index: 13 },
        { name: 'Wall Walks', index: 14 }
      ]
    },
    {
      name: 'Advanced Upper Body Pulling',
      skills: [
        { name: 'Ring Muscle Ups', index: 15 },
        { name: 'Bar Muscle Ups', index: 16 },
        { name: 'Rope Climbs', index: 17 }
      ]
    },
    {
      name: 'Holds',
      skills: [
        { name: 'Wall Facing Handstand Hold', index: 18 },
        { name: 'Freestanding Handstand Hold', index: 19 }
      ]
    },
    {
      name: 'Advanced Gymnastics',
      skills: [
        { name: 'Legless Rope Climbs', index: 20 },
        { name: 'Pegboard Ascent', index: 21 },
        { name: 'Handstand Walk (10m or 25\')', index: 22 },
        { name: 'Seated Legless Rope Climbs', index: 23 },
        { name: 'Strict Ring Muscle Ups', index: 24 },
        { name: 'Handstand Walk Obstacle Crossings', index: 25 }
      ]
    }
  ]

  for (const category of skillCategories) {
    const skill = category.skills.find(s => s.index === index)
    if (skill) return skill.name
  }
  return ''
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
