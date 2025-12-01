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
      height,
      age,
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
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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

    // Derive numeric users.id from Authorization header if available
    let effectiveUserId: number | null = null
    try {
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
      if (authHeader && supabaseAnonKey) {
        const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } }
        })
        const { data: authData } = await supabaseAuthed.auth.getUser()
        const authId = authData?.user?.id
        if (authId) {
          const { data: urow } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('auth_id', authId)
            .single()
          if (urow?.id) effectiveUserId = urow.id
        }
      }
    } catch {}

    if (!effectiveUserId) effectiveUserId = userId

    console.log('💾 Saving intake data for user:', effectiveUserId)

    // Get user's subscription tier to determine what data to save
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('subscription_tier')
      .eq('id', effectiveUserId)
      .single()
    
    const isEngineUser = userData?.subscription_tier === 'ENGINE'
    console.log('📊 User subscription tier:', userData?.subscription_tier, '| Is Engine user:', isEngineUser)

    // Update user details first
    console.log('👤 Updating user details...')
    const parsedWeight = typeof bodyWeight === 'number' ? bodyWeight : (bodyWeight ? parseFloat(bodyWeight) : null)
    const parsedHeight = typeof height === 'number' ? height : (height ? parseFloat(height) : null)
    const parsedAge = typeof age === 'number' ? age : (age ? parseInt(age) : null)
    // Conditioning benchmarks are already in snake_case format
    const snakeBenchmarks = benchmarks || {}
    const { error: userUpdateError } = await supabaseAdmin
      .from('users')
      .update({
        body_weight: parsedWeight,
        height: parsedHeight,
        age: parsedAge,
        gender: gender || null,
        units: units || 'Imperial (lbs)',
        conditioning_benchmarks: snakeBenchmarks,
        program_generation_pending: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', effectiveUserId)

    if (userUpdateError) {
      console.error('❌ User update error:', userUpdateError)
      return NextResponse.json({ 
        error: 'User update failed', 
        details: userUpdateError.message 
      }, { status: 500 })
    }

    // Save equipment - only update if provided
    if (equipment !== undefined && equipment !== null && !isEngineUser) {
      console.log('🔧 Saving equipment...')
      await supabaseAdmin.from('user_equipment').delete().eq('user_id', effectiveUserId)
      
      if (equipment && equipment.length > 0) {
        const equipmentRecords = equipment.map((equipmentName: string) => ({
          user_id: effectiveUserId,
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
    } else if (isEngineUser) {
      console.log('⏭️ Skipping equipment save for Engine user')
    } else {
      console.log('⏭️ Skipping equipment update - not provided in request')
    }

    // Save user preferences (with fallback for older schema and missing unique constraints)
    // Skip preferences for Engine users
    if (preferences && !isEngineUser) {
      const fullPayload: any = {
        user_id: effectiveUserId,
        three_month_goals: preferences.threeMonthGoals || null,
        monthly_primary_goal: preferences.monthlyPrimaryGoal || null,
        preferred_metcon_exercises: Array.isArray(preferences.preferredMetconExercises) ? preferences.preferredMetconExercises : [],
        avoided_exercises: Array.isArray(preferences.avoidedExercises) ? preferences.avoidedExercises : [],
        training_days_per_week: typeof preferences.trainingDaysPerWeek === 'number' ? preferences.trainingDaysPerWeek : 5,
        primary_strength_lifts: Array.isArray(preferences.primaryStrengthLifts) ? preferences.primaryStrengthLifts : null,
        emphasized_strength_lifts: Array.isArray(preferences.emphasizedStrengthLifts) ? preferences.emphasizedStrengthLifts : null
      }

      const basePayload: any = {
        user_id: effectiveUserId,
        three_month_goals: fullPayload.three_month_goals,
        monthly_primary_goal: fullPayload.monthly_primary_goal,
        preferred_metcon_exercises: fullPayload.preferred_metcon_exercises,
        avoided_exercises: fullPayload.avoided_exercises
      }

      // Determine if a row already exists
      const { data: existingRows, error: selError } = await supabaseAdmin
        .from('user_preferences')
        .select('user_id')
        .eq('user_id', effectiveUserId)

      const exists = !selError && Array.isArray(existingRows) && existingRows.length > 0

      if (exists) {
        // Try update with all fields, fallback to base fields on error
        let { error: updErr } = await supabaseAdmin
          .from('user_preferences')
          .update(fullPayload)
          .eq('user_id', effectiveUserId)

        if (updErr) {
          const retryUpd = await supabaseAdmin
            .from('user_preferences')
            .update(basePayload)
            .eq('user_id', effectiveUserId)
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
    } else if (preferences && isEngineUser) {
      console.log('⏭️ Skipping preferences save for Engine user')
    }

  // Save skills - only update if provided
  if (skills !== undefined && skills !== null && !isEngineUser) {
    console.log('🎯 Saving skills...')
    await supabaseAdmin.from('user_skills').delete().eq('user_id', effectiveUserId)

    if (skills && skills.length > 0) {
      const skillRecords = skills.map((skillLevel: string, index: number) => {
        // Extract just the category from strings like "Advanced (More than 15)"
        let cleanLevel = skillLevel;
        if (skillLevel && skillLevel.includes('(')) {
          cleanLevel = skillLevel.split('(')[0].trim();
        }
        
        return {
          user_id: effectiveUserId,
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
        
        // Recalculate and update ability_level after skills are saved
        console.log('🎯 Recalculating ability level...')
        try {
          const abilityResponse = await fetch(
            `${supabaseUrl}/functions/v1/determine-user-ability`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ user_id: effectiveUserId })
            }
          )
          
          if (abilityResponse.ok) {
            const abilityResult = await abilityResponse.json()
            console.log(`✅ Ability determined: ${abilityResult.ability} (${abilityResult.advancedCount} advanced, ${abilityResult.intermediateCount} intermediate)`)
            
            // Update users table with new ability_level
            const { error: abilityUpdateError } = await supabaseAdmin
              .from('users')
              .update({ 
                ability_level: abilityResult.ability,
                updated_at: new Date().toISOString()
              })
              .eq('id', effectiveUserId)
            
            if (abilityUpdateError) {
              console.error('⚠️ Failed to update ability_level:', abilityUpdateError)
            } else {
              console.log(`✅ Updated ability_level to: ${abilityResult.ability}`)
            }
          } else {
            const errorText = await abilityResponse.text()
            console.error('⚠️ Failed to determine ability:', errorText)
          }
        } catch (error) {
          console.error('⚠️ Error updating ability level (continuing):', error)
          // Don't fail the whole save if this fails
        }
      }
    }
  } else if (isEngineUser) {
    console.log('⏭️ Skipping skills save for Engine user')
  } else {
    console.log('⏭️ Skipping skills update - not provided in request')
  }

  // Save 1RMs - only update if provided
  if (oneRMs !== undefined && oneRMs !== null && !isEngineUser) {
    console.log('💪 Saving 1RMs...')
    await supabaseAdmin.from('user_one_rms').delete().eq('user_id', effectiveUserId)
    
    if (oneRMs && oneRMs.length > 0) {
      const oneRMLifts = [
        'Snatch', 'Power Snatch', 'Clean and Jerk', 'Power Clean', 'Clean (clean only)',
        'Jerk (from rack or blocks, max Split or Power Jerk)', 'Back Squat', 'Front Squat',
        'Overhead Squat', 'Deadlift', 'Bench Press', 'Push Press', 'Strict Press',
        'Weighted Pullup (do not include body weight)'
      ]
      
      const oneRMRecords = oneRMs.map((oneRMValue: string, index: number) => ({
        user_id: effectiveUserId,
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
  } else if (isEngineUser) {
    console.log('⏭️ Skipping 1RMs save for Engine user')
  } else {
    console.log('⏭️ Skipping 1RMs update - not provided in request')
  }

    console.log('🎉 All intake data saved successfully')

    // Check user's subscription to determine weeks to generate and program type
    console.log('📅 Checking subscription...')
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('billing_interval, status, plan')
      .eq('user_id', effectiveUserId)
      .in('status', ['active', 'trialing'])
      .single()

    // Get user's subscription tier from users table
    const { data: userTier } = await supabaseAdmin
      .from('users')
      .select('subscription_tier')
      .eq('id', effectiveUserId)
      .single()

    // If no active subscription, proceed with default monthly generation (4 weeks)
    const hasSub = !(subError || !subscription)

    // Determine weeks to generate based on subscription
    const weeksToGenerate = hasSub && subscription.billing_interval === 'quarter' 
      ? Array.from({length: 13}, (_, i) => i + 1)  // Weeks 1-13
      : [1, 2, 3, 4]  // Weeks 1-4 for monthly or no subscription

    // Determine program type based on subscription tier
    const isAppliedPower = userTier?.subscription_tier === 'APPLIED_POWER'
    const isBTN = userTier?.subscription_tier === 'BTN'
    const isEngine = userTier?.subscription_tier === 'ENGINE'
    
    // Engine users don't need program generation - they use static workouts
    // But they DO need a user profile generated for /profile page access
    if (isEngine) {
      console.log('🎯 Engine user - skipping program generation, generating profile only')
      
      // Generate user profile (needed for /profile page)
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
            user_id: effectiveUserId,
            sport_id: 1,
            force_regenerate: true  // Always regenerate after saving intake data
          })
        }
      )

      if (!profileResponse.ok) {
        const errorText = await profileResponse.text()
        console.error('❌ Profile generation failed:', errorText)
        return NextResponse.json({ 
          error: 'Profile generation failed',
          details: errorText,
          success: false,
          intakeSaved: true
        }, { status: 500 })
      }

      console.log(`✅ Engine user profile generated successfully!`)
      
      return NextResponse.json({ 
        success: true,
        message: 'Intake data saved and profile generated for Engine user',
        intakeSaved: true,
        profileGenerated: true,
        programGenerated: false
      })
    }
    
    // BTN users don't need program generation - they use the workout generator
    // But they DO need a user profile generated for /profile page access
    if (isBTN) {
      console.log('🎯 BTN user - skipping program generation, generating profile only')
      
      // Generate user profile (needed for /profile page)
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
            user_id: effectiveUserId,
            sport_id: 1,
            force_regenerate: true  // Always regenerate after saving intake data
          })
        }
      )

      if (!profileResponse.ok) {
        const errorText = await profileResponse.text()
        console.error('❌ Profile generation failed:', errorText)
        return NextResponse.json({ 
          error: 'Profile generation failed',
          details: errorText,
          success: false,
          intakeSaved: true
        }, { status: 500 })
      }

      console.log(`✅ BTN user profile generated successfully!`)
      
      return NextResponse.json({ 
        success: true,
        message: 'Intake data saved and profile generated for BTN user',
        intakeSaved: true,
        profileGenerated: true,
        programGenerated: false
      })
    }
    
    console.log(`🏋️ Generating ${isAppliedPower ? 'Applied Power' : 'Full'} program for ${weeksToGenerate.length} weeks...`)

    // Check if user already has a program - only generate if this is their first program
    const { data: existingPrograms } = await supabaseAdmin
      .from('programs')
      .select('id')
      .eq('user_id', effectiveUserId)
      .limit(1)

    if (existingPrograms && existingPrograms.length > 0) {
      console.log(`ℹ️ User already has program(s) - skipping program generation on intake update`)
      // Still generate profile since that can be updated
      console.log(`📊 Generating updated user profile...`)
      const profileResponse = await fetch(
        `${supabaseUrl}/functions/v1/generate-user-profile`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            user_id: effectiveUserId,
            sport_id: 1,
            force_regenerate: true  // Force regenerate since data changed
          })
        }
      )
      
      if (!profileResponse.ok) {
        const errorText = await profileResponse.text()
        console.error('❌ Profile generation failed:', errorText)
      } else {
        console.log(`✅ Profile regenerated successfully!`)
      }
      
      return NextResponse.json({ 
        success: true,
        message: 'Intake data saved successfully',
        intakeSaved: true,
        programGenerated: false,
        profileGenerated: true,
        note: 'Program generation skipped - user already has existing program. Profile updated with new data.'
      })
    }

    // Call generate-program edge function (only for first-time users)
    const programResponse = await fetch(
      `${supabaseUrl}/functions/v1/generate-program`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          user_id: effectiveUserId, 
          weeksToGenerate,
          programType: isAppliedPower ? 'applied_power' : 'full' // NEW: Pass program type
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
        user_id: effectiveUserId,
        sport_id: 1,
        program_number: 1,
        weeks_generated: weeksToGenerate,
        program_data: programResult?.program || {},
        user_snapshot: programResult?.program?.metadata?.userSnapshot || null,
        ratio_snapshot: programResult?.program?.metadata?.ratioSnapshot || null
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
        // Read user preferences for day limit
        let dayLimit = 5
        try {
          const { data: prefs } = await supabaseAdmin
            .from('user_preferences')
            .select('training_days_per_week')
            .eq('user_id', effectiveUserId)
            .single()
          if (prefs && typeof prefs.training_days_per_week === 'number') {
            dayLimit = Math.max(3, Math.min(6, prefs.training_days_per_week))
          }
        } catch (_) {}

        for (const w of weeks) {
          const weekNum = w.week
          const daysArr = w.days || []
          for (const d of daysArr) {
            if (typeof d.day === 'number' && d.day > dayLimit) continue
            const blocksArr = d.blocks || []
            for (const b of blocksArr) {
              const exercises = b.exercises || []
              for (const ex of exercises) {
                rows.push({
                  program_id: programId,
                  week: weekNum,
                  day: d.day,
                  block: b.blockName,
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
          user_id: effectiveUserId,
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

  } catch (error: any) {
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



