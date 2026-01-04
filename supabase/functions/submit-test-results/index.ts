import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestResults {
  oneRMs?: Record<string, number>  // { snatch: 185, clean_and_jerk: 225, ... }
  skills?: Record<string, string>  // { double_unders: "Advanced", muscle_ups: "Intermediate", ... }
  benchmarks?: Record<string, string>  // { fran: "3:45", ... } - optional
}

interface SubmitTestResultsRequest {
  user_id: number
  test_results: TestResults
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { user_id, test_results }: SubmitTestResultsRequest = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📝 Processing test results submission for user ${user_id}`)

    // 1. Get user's current state
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, current_cycle, awaiting_test_results')
      .eq('id', user_id)
      .single()

    if (userError || !user) {
      throw new Error(`User not found: ${userError?.message}`)
    }

    // 2. Capture OLD profile for comparison
    const [oldOneRMs, oldSkills] = await Promise.all([
      supabase
        .from('user_one_rms')
        .select('one_rm_index, exercise_name, one_rm')
        .eq('user_id', user_id),
      supabase
        .from('user_skills')
        .select('skill_index, skill_name, skill_level')
        .eq('user_id', user_id)
    ])

    const oldOneRMsMap = new Map(
      (oldOneRMs.data || []).map(r => [r.exercise_name.toLowerCase(), r.one_rm])
    )
    const oldSkillsMap = new Map(
      (oldSkills.data || []).map(s => [s.skill_name.toLowerCase(), s.skill_level])
    )

    // 3. Update profile with new test results
    const changes: string[] = []

    // Update 1RMs
    if (test_results.oneRMs) {
      for (const [exercise, newValue] of Object.entries(test_results.oneRMs)) {
        const exerciseLower = exercise.toLowerCase()
        const oldValue = oldOneRMsMap.get(exerciseLower)

        // Upsert the new value
        const { error: upsertError } = await supabase
          .from('user_one_rms')
          .upsert({
            user_id,
            exercise_name: exercise,
            one_rm: newValue,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,exercise_name'
          })

        if (upsertError) {
          console.warn(`Failed to update 1RM for ${exercise}:`, upsertError.message)
        }

        // Track change for feedback
        if (oldValue && oldValue !== newValue) {
          const diff = newValue - oldValue
          const pct = ((diff / oldValue) * 100).toFixed(1)
          const arrow = diff > 0 ? '↑' : '↓'
          changes.push(`${exercise}: ${oldValue} → ${newValue} (${arrow}${Math.abs(diff)} / ${pct}%)`)
        } else if (!oldValue) {
          changes.push(`${exercise}: New PR of ${newValue}`)
        }
      }
    }

    // Update Skills
    if (test_results.skills) {
      const skillLevelOrder = ["Don't have it", "Beginner", "Intermediate", "Advanced"]

      for (const [skill, newLevel] of Object.entries(test_results.skills)) {
        const skillLower = skill.toLowerCase()
        const oldLevel = oldSkillsMap.get(skillLower)

        // Upsert the new skill level
        const { error: upsertError } = await supabase
          .from('user_skills')
          .upsert({
            user_id,
            skill_name: skill,
            skill_level: newLevel,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,skill_name'
          })

        if (upsertError) {
          console.warn(`Failed to update skill ${skill}:`, upsertError.message)
        }

        // Track change for feedback
        if (oldLevel && oldLevel !== newLevel) {
          const oldIdx = skillLevelOrder.indexOf(oldLevel)
          const newIdx = skillLevelOrder.indexOf(newLevel)
          const arrow = newIdx > oldIdx ? '↑' : '↓'
          changes.push(`${skill}: ${oldLevel} → ${newLevel} ${arrow}`)
        }
      }
    }

    // 4. Recalculate ratios with new data
    try {
      await fetch(`${supabaseUrl}/functions/v1/calculate-ratios`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id })
      })
      console.log('✅ Ratios recalculated')
    } catch (ratioError) {
      console.warn('⚠️ Failed to recalculate ratios (non-fatal):', ratioError)
    }

    // 5. Generate feedback note
    const feedbackMessage = changes.length > 0
      ? `Test Week Results:\n${changes.join('\n')}`
      : 'Test week completed - no changes detected from previous values.'

    // Store feedback note (using a notifications or feedback table)
    const { error: noteError } = await supabase
      .from('user_notifications')
      .insert({
        user_id,
        type: 'test_week_results',
        title: 'Test Week Complete! 🎉',
        message: feedbackMessage,
        data: { changes, cycle: user.current_cycle },
        read: false,
        created_at: new Date().toISOString()
      })

    if (noteError) {
      // Table might not exist, log but don't fail
      console.warn('⚠️ Could not store feedback note:', noteError.message)
    }

    // 6. Determine next program number
    const currentCycle = user.current_cycle || 1
    const nextProgramNumber = currentCycle * 3 + 1  // Cycle 1 -> Program 4, Cycle 2 -> Program 7

    // 7. Check if program already exists (fallback already fired)
    const { data: existingProgram } = await supabase
      .from('programs')
      .select('id')
      .eq('user_id', user_id)
      .eq('program_number', nextProgramNumber)
      .single()

    let programAction = 'generated'

    if (existingProgram) {
      // Fallback already generated this program - check if user started it
      const { data: logs } = await supabase
        .from('performance_logs')
        .select('id')
        .eq('user_id', user_id)
        .gte('week', (nextProgramNumber - 1) * 4 + 1)  // First week of that program
        .limit(1)

      const hasStartedProgram = logs && logs.length > 0

      if (hasStartedProgram) {
        // Too late to regenerate - apply to future programs
        programAction = 'applied_to_future'
        console.log(`⚠️ User already started program #${nextProgramNumber}, applying to future programs`)
      } else {
        // Safe to regenerate
        programAction = 'regenerated'

        // Delete old program
        await supabase
          .from('programs')
          .delete()
          .eq('id', existingProgram.id)

        console.log(`🔄 Deleted stale program #${nextProgramNumber} for regeneration`)
      }
    }

    // 8. Generate next program (if not already started)
    if (programAction !== 'applied_to_future') {
      // Calculate weeks for next program
      const weeksToGenerate = Array.from(
        { length: 4 },
        (_, i) => (nextProgramNumber - 1) * 4 + i + 1
      )

      // Enqueue program generation job
      const { error: jobError } = await supabase
        .from('program_generation_jobs')
        .insert({
          user_id,
          program_number: nextProgramNumber,
          status: 'pending',
          job_type: 'program_generation',
          payload: {
            weeksToGenerate,
            triggeredBy: 'test_week_submission'
          }
        })

      if (jobError) {
        console.error('Failed to enqueue program generation:', jobError)
        throw new Error('Failed to trigger program generation')
      }

      console.log(`✅ Enqueued program #${nextProgramNumber} generation (weeks ${weeksToGenerate.join(', ')})`)
    }

    // 9. Update user state
    await supabase
      .from('users')
      .update({
        awaiting_test_results: false,
        awaiting_test_since: null,
        test_results_submitted_at: new Date().toISOString(),
        current_cycle: currentCycle + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id)

    console.log(`✅ User ${user_id} advanced to cycle ${currentCycle + 1}`)

    return new Response(
      JSON.stringify({
        success: true,
        feedback: {
          title: 'Test Week Complete! 🎉',
          message: feedbackMessage,
          changes
        },
        programAction,
        nextProgramNumber,
        newCycle: currentCycle + 1
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Test results submission error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
