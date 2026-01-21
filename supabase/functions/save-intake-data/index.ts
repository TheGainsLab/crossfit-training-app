// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SaveIntakeDataRequest {
  mode: 'draft' | 'complete'
  userId?: number
  equipment?: string[]
  skills?: string[]
  oneRMs?: (number | string)[]
  bodyWeight?: number | string
  height?: number | string
  age?: number | string
  gender?: string
  units?: string
  benchmarks?: any
  preferences?: {
    threeMonthGoals?: string
    monthlyPrimaryGoal?: string
    preferredMetconExercises?: string[]
    avoidedExercises?: string[]
    trainingDaysPerWeek?: number
    primaryStrengthLifts?: string[]
    emphasizedStrengthLifts?: string[]
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse request body
    const body: SaveIntakeDataRequest = await req.json()
    const { mode, userId, equipment, skills, oneRMs, bodyWeight, height, age, gender, units, benchmarks, preferences } = body

    if (!mode || (mode !== 'draft' && mode !== 'complete')) {
      return new Response(
        JSON.stringify({ error: 'mode must be "draft" or "complete"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user ID from auth header or request body
    let effectiveUserId: number | null = null
    
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
    if (authHeader) {
      try {
        const supabaseAuthed = createClient(
          supabaseUrl,
          Deno.env.get('SUPABASE_ANON_KEY') || '',
          { global: { headers: { Authorization: authHeader } } }
        )
        const { data: authData } = await supabaseAuthed.auth.getUser()
        const authId = authData?.user?.id
        if (authId) {
          const { data: urow } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', authId)
            .single()
          if (urow?.id) effectiveUserId = urow.id
        }
      } catch (e) {
        console.warn('Failed to get user from auth header:', e)
      }
    }

    if (!effectiveUserId) {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'User ID required (provide userId or Authorization header)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      effectiveUserId = userId
    }

    console.log(`💾 Saving intake data for user ${effectiveUserId}, mode: ${mode}`)

    // ============================================
    // DRAFT MODE: Save to intake_drafts table
    // ============================================
    if (mode === 'draft') {
      const draftData = {
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
      }

      const { error: draftError } = await supabase
        .from('intake_drafts')
        .upsert({
          user_id: effectiveUserId,
          draft_data: draftData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (draftError) {
        console.error('❌ Draft save error:', draftError)
        return new Response(
          JSON.stringify({ error: 'Failed to save draft', details: draftError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('✅ Draft saved successfully')
      return new Response(
        JSON.stringify({ success: true, saved: 'draft' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // COMPLETE MODE: Save to all tables and queue jobs
    // ============================================
    
    // Get user's subscription tier AND intake_status (for rollback)
    const { data: userData } = await supabase
      .from('users')
      .select('subscription_tier, intake_status')
      .eq('id', effectiveUserId)
      .single()
    
    // Normalize subscription_tier to uppercase for comparison
    const normalizedTier = userData?.subscription_tier?.toUpperCase()
    const isEngineUser = normalizedTier === 'ENGINE'
    const isBTN = normalizedTier === 'BTN'
    const originalIntakeStatus = userData?.intake_status || 'draft'
    console.log('📊 User subscription tier:', userData?.subscription_tier)

    try {
      // Update user details (set generating status early)
      console.log('👤 Updating user details...')
      const parsedWeight = typeof bodyWeight === 'number' ? bodyWeight : (bodyWeight ? parseFloat(String(bodyWeight)) : null)
      const parsedHeight = typeof height === 'number' ? height : (height ? parseFloat(String(height)) : null)
      const parsedAge = typeof age === 'number' ? age : (age ? parseInt(String(age)) : null)
      const snakeBenchmarks = benchmarks || {}

      const { error: userUpdateError } = await supabase
        .from('users')
        .update({
          body_weight: parsedWeight,
          height: parsedHeight,
          age: parsedAge,
          gender: gender || null,
          units: units || 'Imperial (lbs)',
          conditioning_benchmarks: snakeBenchmarks,
          program_generation_pending: false,
          intake_status: 'generating',
          updated_at: new Date().toISOString()
        })
        .eq('id', effectiveUserId)

      if (userUpdateError) {
        throw new Error(`User update failed: ${userUpdateError.message}`)
      }

      // Save equipment
      if (equipment !== undefined && equipment !== null && !isEngineUser) {
        console.log('🔧 Saving equipment...')
        await supabase.from('user_equipment').delete().eq('user_id', effectiveUserId)
        
        if (equipment && equipment.length > 0) {
          const equipmentRecords = equipment.map((equipmentName: string) => ({
            user_id: effectiveUserId,
            equipment_name: equipmentName
          }))
          
          const { error: equipmentError } = await supabase
            .from('user_equipment')
            .insert(equipmentRecords)
          
          if (equipmentError) {
            throw new Error(`Equipment insertion failed: ${equipmentError.message}`)
          }
          
          console.log('✅ Equipment saved:', equipment.length, 'items')
        }
      }

      // Save user preferences
      if (preferences && !isEngineUser) {
        console.log('⚙️ Saving preferences...')
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

        const { data: existingRows } = await supabase
          .from('user_preferences')
          .select('user_id')
          .eq('user_id', effectiveUserId)

        const exists = existingRows && existingRows.length > 0

        if (exists) {
          let { error: updErr } = await supabase
            .from('user_preferences')
            .update(fullPayload)
            .eq('user_id', effectiveUserId)

          if (updErr) {
            const { error: retryErr } = await supabase
              .from('user_preferences')
              .update(basePayload)
              .eq('user_id', effectiveUserId)
            if (retryErr) {
              throw new Error(`Preferences update failed: ${updErr.message}`)
            }
          }
        } else {
          let { error: insErr } = await supabase
            .from('user_preferences')
            .insert(fullPayload)

          if (insErr) {
            const { error: retryErr } = await supabase
              .from('user_preferences')
              .insert(basePayload)
            if (retryErr) {
              throw new Error(`Preferences insert failed: ${insErr.message}`)
            }
          }
        }
        console.log('✅ Preferences saved')
      }

      // Save skills
      if (skills !== undefined && skills !== null && !isEngineUser) {
        console.log('🎯 Saving skills...')
        await supabase.from('user_skills').delete().eq('user_id', effectiveUserId)

        if (skills && skills.length > 0) {
          const skillRecords = skills.map((skillLevel: string, index: number) => {
            let cleanLevel = skillLevel
            if (skillLevel && skillLevel.includes('(')) {
              cleanLevel = skillLevel.split('(')[0].trim()
            }
            
            return {
              user_id: effectiveUserId,
              skill_index: index,
              skill_name: getSkillNameByIndex(index),
              skill_level: cleanLevel
            }
          }).filter((skill: any) => skill.skill_name)

          if (skillRecords.length > 0) {
            const { error: skillsError } = await supabase
              .from('user_skills')
              .insert(skillRecords)
            
            if (skillsError) {
              throw new Error(`Skills insertion failed: ${skillsError.message}`)
            }
            
            console.log('✅ Skills saved:', skillRecords.length, 'records')

            // Recalculate ability level (synchronous - fast DB query)
            try {
              const abilityResponse = await fetch(`${supabaseUrl}/functions/v1/determine-user-ability`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id: effectiveUserId })
              })
              
              if (abilityResponse.ok) {
                const abilityResult = await abilityResponse.json()
                await supabase
                  .from('users')
                  .update({ 
                    ability_level: abilityResult.ability,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', effectiveUserId)
                console.log(`✅ Updated ability_level to: ${abilityResult.ability}`)
              }
            } catch (error) {
              console.warn('⚠️ Error updating ability level (non-critical):', error)
              // Don't throw - ability update is non-critical
            }
          }
        }
      }

      // Save 1RMs
      if (oneRMs !== undefined && oneRMs !== null && !isEngineUser) {
        console.log('💪 Saving 1RMs...')
        await supabase.from('user_one_rms').delete().eq('user_id', effectiveUserId)
        
        if (oneRMs && oneRMs.length > 0) {
          const oneRMLifts = [
            'Snatch', 'Power Snatch', 'Clean and Jerk', 'Power Clean', 'Clean (clean only)',
            'Jerk (from rack or blocks, max Split or Power Jerk)', 'Back Squat', 'Front Squat',
            'Overhead Squat', 'Deadlift', 'Bench Press', 'Push Press', 'Strict Press',
            'Weighted Pullup (do not include body weight)'
          ]
          
          const oneRMRecords = oneRMs.map((oneRMValue: string | number, index: number) => ({
            user_id: effectiveUserId,
            one_rm_index: index,
            exercise_name: oneRMLifts[index],
            one_rm: typeof oneRMValue === 'number' ? oneRMValue : parseFloat(String(oneRMValue))
          })).filter((record: any) => !isNaN(record.one_rm) && record.one_rm > 0)

          if (oneRMRecords.length > 0) {
            const { error: oneRMError } = await supabase
              .from('user_one_rms')
              .insert(oneRMRecords)
            
            if (oneRMError) {
              throw new Error(`1RM insertion failed: ${oneRMError.message}`)
            }
            
            console.log('✅ 1RMs saved:', oneRMRecords.length, 'records')
          }
        }
      }

      console.log('🎉 All intake data saved successfully')

      // Check subscription to determine what jobs to queue
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('billing_interval, status')
        .eq('user_id', effectiveUserId)
        .in('status', ['active', 'trialing'])
        .single()

      const { data: userTier } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('id', effectiveUserId)
        .single()

      const hasSub = subscription !== null
      const weeksToGenerate = hasSub && subscription?.billing_interval === 'quarter'
        ? Array.from({length: 13}, (_, i) => i + 1)
        : [1, 2, 3, 4]

      // Normalize tier to uppercase for case-insensitive comparison
      const normalizedUserTier = userTier?.subscription_tier?.toUpperCase()
      const isAppliedPower = normalizedUserTier === 'APPLIED_POWER'

      // Determine programType based on subscription tier
      const programType = isEngineUser ? 'engine'
        : isAppliedPower ? 'applied_power'
        : 'full'

      // Check if user already has a program and calculate program number
      const { data: existingPrograms } = await supabase
        .from('programs')
        .select('program_number')
        .eq('user_id', effectiveUserId)
        .order('program_number', { ascending: false })
        .limit(1)

      const hasExistingProgram = existingPrograms && existingPrograms.length > 0
      
      // Calculate program number (for first-time users, it's 1)
      const programNumber = hasExistingProgram 
        ? (existingPrograms[0]?.program_number || 0) + 1
        : 1

      // Determine what jobs to queue
      // BTN users don't need program generation (they generate workouts on-demand)
      // Engine users DO need program generation for their Engine conditioning program
      const needsProgram = !isBTN && !hasExistingProgram
      const needsProfile = true // Always generate profile

      console.log(`📋 User tier: ${userData?.subscription_tier}, programType: ${programType}`)
      console.log(`📋 Queueing jobs: program=${needsProgram}, profile=${needsProfile}`)

      const jobIds: number[] = []

      // Queue program generation job if needed
      if (needsProgram) {
        const jobPayload: any = {
          user_id: effectiveUserId,
          status: 'pending',
          program_number: programNumber,
          job_type: 'intake_program',
          payload: {
            weeksToGenerate,
            programType
          }
        }

        const { data: programJob, error: programJobError } = await supabase
          .from('program_generation_jobs')
          .insert(jobPayload)
          .select('id')
          .single()

        if (programJobError) {
          // If error is about missing column, try without job_type
          if (programJobError.message?.includes('job_type') || programJobError.message?.includes('column')) {
            console.warn('⚠️ job_type column not found, using default')
            const { data: retryJob, error: retryError } = await supabase
              .from('program_generation_jobs')
              .insert({
                user_id: effectiveUserId,
                status: 'pending',
                program_number: programNumber,
                payload: {
                  weeksToGenerate,
                  programType
                }
              })
              .select('id')
              .single()
            
            if (retryError) {
              throw new Error(`Failed to queue program job: ${retryError.message}`)
            }
            jobIds.push(retryJob.id)
            console.log(`✅ Queued program generation job: ${retryJob.id}`)
          } else {
            throw new Error(`Failed to queue program job: ${programJobError.message}`)
          }
        } else {
          jobIds.push(programJob.id)
          console.log(`✅ Queued program generation job: ${programJob.id}`)
        }
      }

      // Always queue profile generation job
      // Use existing program_number if available, default to 1 if program exists but program_number is null, or 0 if no program
      const profileProgramNumber = hasExistingProgram 
        ? (existingPrograms[0]?.program_number ?? 1)  // Use ?? to default null to 1
        : 0
      
      const profileJobPayload: any = {
        user_id: effectiveUserId,
        status: 'pending',
        program_number: profileProgramNumber,
        job_type: 'intake_profile',
        payload: {
          userId: effectiveUserId
        }
      }

      const { data: profileJob, error: profileJobError } = await supabase
        .from('program_generation_jobs')
        .insert(profileJobPayload)
        .select('id')
        .single()

      if (profileJobError) {
        // If error is about missing column, try without job_type
        if (profileJobError.message?.includes('job_type') || profileJobError.message?.includes('column')) {
          console.warn('⚠️ job_type column not found, using default')
          const { data: retryJob, error: retryError } = await supabase
            .from('program_generation_jobs')
            .insert({
              user_id: effectiveUserId,
              status: 'pending',
              program_number: profileProgramNumber,
              payload: {
                userId: effectiveUserId
              }
            })
            .select('id')
            .single()
          
          if (retryError) {
            throw new Error(`Failed to queue profile job: ${retryError.message}`)
          }
          jobIds.push(retryJob.id)
          console.log(`✅ Queued profile generation job: ${retryJob.id}`)
        } else {
          throw new Error(`Failed to queue profile job: ${profileJobError.message}`)
        }
      } else {
        jobIds.push(profileJob.id)
        console.log(`✅ Queued profile generation job: ${profileJob.id}`)
      }

      // Delete draft after successful completion
      await supabase
        .from('intake_drafts')
        .delete()
        .eq('user_id', effectiveUserId)

      // For BTN users, mark intake as complete immediately since they don't need program generation
      if (isBTN) {
        console.log('🎯 BTN user - marking intake as complete immediately')
        await supabase
          .from('users')
          .update({
            intake_status: 'complete'
          })
          .eq('id', effectiveUserId)
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Intake data saved and jobs queued',
          jobIds,
          intakeStatus: isBTN ? 'complete' : 'generating',
          programQueued: needsProgram,
          profileQueued: needsProfile
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (error: any) {
      // Rollback: Reset intake_status on error
      console.error('❌ Error during intake save, resetting status:', error)
      
      await supabase
        .from('users')
        .update({
          intake_status: originalIntakeStatus,
          intake_error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', effectiveUserId)

      return new Response(
        JSON.stringify({
          error: 'Failed to save intake data',
          details: error instanceof Error ? error.message : 'Unknown error',
          intakeStatus: originalIntakeStatus
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error: any) {
    console.error('❌ Save intake data error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to save intake data',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
