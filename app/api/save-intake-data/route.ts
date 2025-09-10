import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { 
      userId, 
      equipment, 
      skills, 
      oneRMs,
      bodyWeight,
      gender,
      units,
      benchmarks,
      preferences 
    } = await request.json()

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

    // Update user details first
    console.log('👤 Updating user details...')
    const parsedWeight = typeof bodyWeight === 'number' ? bodyWeight : (bodyWeight ? parseFloat(bodyWeight) : null)
    const { error: userUpdateError } = await supabaseAdmin
      .from('users')
      .update({
        body_weight: parsedWeight,
        gender: gender || null,
        units: units || 'Imperial (lbs)',
        conditioning_benchmarks: benchmarks || {},
        program_generation_pending: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (userUpdateError) {
      console.error('❌ User update error:', userUpdateError)
      return NextResponse.json({ 
        error: 'User update failed', 
        details: userUpdateError.message 
      }, { status: 500 })
    }

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

    // Save user preferences (with fallback for older schema and missing unique constraints)
    if (preferences) {
      const fullPayload: any = {
        user_id: userId,
        three_month_goals: preferences.threeMonthGoals || null,
        monthly_primary_goal: preferences.monthlyPrimaryGoal || null,
        preferred_metcon_exercises: Array.isArray(preferences.preferredMetconExercises) ? preferences.preferredMetconExercises : [],
        avoided_exercises: Array.isArray(preferences.avoidedExercises) ? preferences.avoidedExercises : [],
        training_days_per_week: typeof preferences.trainingDaysPerWeek === 'number' ? preferences.trainingDaysPerWeek : 5,
        primary_strength_lifts: Array.isArray(preferences.primaryStrengthLifts) ? preferences.primaryStrengthLifts : null,
        emphasized_strength_lifts: Array.isArray(preferences.emphasizedStrengthLifts) ? preferences.emphasizedStrengthLifts : null
      }

      const basePayload: any = {
        user_id: userId,
        three_month_goals: fullPayload.three_month_goals,
        monthly_primary_goal: fullPayload.monthly_primary_goal,
        preferred_metcon_exercises: fullPayload.preferred_metcon_exercises,
        avoided_exercises: fullPayload.avoided_exercises
      }

      // Determine if a row already exists
      const { data: existingRows, error: selError } = await supabaseAdmin
        .from('user_preferences')
        .select('user_id')
        .eq('user_id', userId)

      const exists = !selError && Array.isArray(existingRows) && existingRows.length > 0

      if (exists) {
        // Try update with all fields, fallback to base fields on error
        let { error: updErr } = await supabaseAdmin
          .from('user_preferences')
          .update(fullPayload)
          .eq('user_id', userId)

        if (updErr) {
          const retryUpd = await supabaseAdmin
            .from('user_preferences')
            .update(basePayload)
            .eq('user_id', userId)
          if (retryUpd.error) {
            console.warn('⚠️ Preferences update warning (continuing):', updErr?.message || updErr, 'retry:', retryUpd.error?.message || retryUpd.error)
          }
        }
      } else {
        // Try insert with all fields, fallback to base fields on error
        let { error: insErr } = await supabaseAdmin
          .from('user_preferences')
          .insert(fullPayload)

        if (insErr) {
          const retryIns = await supabaseAdmin
            .from('user_preferences')
            .insert(basePayload)
          if (retryIns.error) {
            console.warn('⚠️ Preferences insert warning (continuing):', insErr?.message || insErr, 'retry:', retryIns.error?.message || retryIns.error)
          }
        }
      }
    }

  // Save skills
console.log('🎯 Saving skills...')
await supabaseAdmin.from('user_skills').delete().eq('user_id', userId)

if (skills && skills.length > 0) {
  const skillRecords = skills.map((skillLevel: string, index: number) => {
    // Extract just the category from strings like "Advanced (More than 15)"
    let cleanLevel = skillLevel;
    if (skillLevel && skillLevel.includes('(')) {
      cleanLevel = skillLevel.split('(')[0].trim();
    }
    
    return {
      user_id: userId,
      skill_index: index,
      skill_name: getSkillNameByIndex(index),
      skill_level: cleanLevel  // Now saves clean values
    }
  }).filter((skill: any) => skill.skill_name)

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

    // Check user's subscription to determine weeks to generate
    console.log('📅 Checking subscription...')
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('billing_interval, status')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .single()

    // If no active subscription, proceed with default monthly generation (4 weeks)
    const hasSub = !(subError || !subscription)

    // Determine weeks to generate based on subscription
    const weeksToGenerate = hasSub && subscription.billing_interval === 'quarter' 
      ? Array.from({length: 13}, (_, i) => i + 1)  // Weeks 1-13
      : [1, 2, 3, 4]  // Weeks 1-4 for monthly or no subscription

    console.log(`🏋️ Generating program for ${weeksToGenerate.length} weeks...`)

    // Call generate-program edge function
    const programResponse = await fetch(
      `${supabaseUrl}/functions/v1/generate-program`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          user_id: userId, 
          weeksToGenerate 
        })
      }
    )

    if (!programResponse.ok) {
      const errorText = await programResponse.text()
      console.error('❌ Program generation failed:', errorText)
      return NextResponse.json({ 
        error: 'Program generation failed',
        details: errorText,
        success: false,
        intakeSaved: true
      }, { status: 500 })
    }

    const programResult = await programResponse.json()

    // Store the generated program in the programs table
    const { data: savedProgram, error: programSaveError } = await supabaseAdmin
      .from('programs')
      .insert({
        user_id: userId,
        sport_id: 1,
        program_number: 1,
        weeks_generated: weeksToGenerate,
        program_data: programResult.program,
        user_snapshot: programResult.program.metadata.userSnapshot,
        ratio_snapshot: programResult.program.metadata.ratioSnapshot
      })
      .select('id')
      .single()

    if (programSaveError) {
      console.error('Failed to save program to database:', programSaveError)
      // Continue anyway - program was generated successfully
    }

    console.log(`✅ Program generated successfully!`)

    // Persist scaffold into program_workouts honoring training_days_per_week
    try {
      const programId = savedProgram?.id
      const weeks = programResult?.program?.weeks || []
      if (programId && Array.isArray(weeks) && weeks.length > 0) {
        const rows: any[] = []
        for (const w of weeks) {
          const weekNum = w.week
          const daysArr = w.days || []
          for (const d of daysArr) {
            const blocksArr = d.blocks || []
            for (const b of blocksArr) {
              const exercises = b.exercises || []
              for (const ex of exercises) {
                rows.push({
                  program_id: programId,
                  week: weekNum,
                  day: d.day,
                  block: b.block,
                  exercise_name: ex.name,
                  main_lift: d.mainLift || null,
                  is_deload: !!d.isDeload
                })
              }
            }
          }
        }
        if (rows.length > 0) {
          const { error: pwErr } = await supabaseAdmin
            .from('program_workouts')
            .insert(rows)
          if (pwErr) {
            console.warn('program_workouts insert warning:', pwErr.message)
          }
        }
      }
    } catch (scaffoldErr: any) {
      console.warn('Failed to persist program_workouts scaffold (non-fatal):', scaffoldErr?.message || scaffoldErr)
    }

console.log(`📊 Generating user profile...`)

const profileResponse = await fetch(
  `${supabaseUrl}/functions/v1/generate-user-profile`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      user_id: userId,
      sport_id: 1,
      force_regenerate: false
    })
  }
)

if (!profileResponse.ok) {
  const errorText = await profileResponse.text()
  console.error('❌ Profile generation failed:', errorText)
} else {
  console.log(`✅ Profile generated successfully!`)
}


    return NextResponse.json({
      success: true,
      message: 'Intake data saved and program generated successfully',
      programId: savedProgram?.id,
      programGenerated: true
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



