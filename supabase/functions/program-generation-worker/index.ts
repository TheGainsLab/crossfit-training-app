// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, serviceKey)

// Reset jobs stuck in 'processing' for more than 15 minutes
async function resetStuckJobs() {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  
  // Fetch stuck jobs with retry_count and max_retries
  const { data: stuckJobs, error } = await supabase
    .from('program_generation_jobs')
    .select('id, user_id, retry_count, max_retries')
    .eq('status', 'processing')
    .lt('started_at', fifteenMinutesAgo)
  
  if (error) {
    console.error('❌ Error checking for stuck jobs:', error)
    return
  }
  
  if (stuckJobs && stuckJobs.length > 0) {
    console.log(`⚠️ Found ${stuckJobs.length} stuck jobs, checking retry limits...`)
    
    for (const job of stuckJobs) {
      const retryCount = (job.retry_count || 0) + 1
      const maxRetries = job.max_retries || 3
      
      await supabase
        .from('program_generation_jobs')
        .update({ 
          status: retryCount < maxRetries ? 'pending' : 'failed',
          started_at: null,
          retry_count: retryCount,
          error_message: retryCount >= maxRetries ? 'Job timed out after max retries' : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)
      
      if (retryCount >= maxRetries) {
        console.log(`❌ Job ${job.id} exceeded max retries, marking as failed`)
      } else {
        console.log(`⚠️ Job ${job.id} reset to pending (retry ${retryCount}/${maxRetries})`)
      }
    }
    
    console.log(`✅ Processed ${stuckJobs.length} stuck jobs`)
  }
}

// Atomically claim a job (only if status is still 'pending')
async function claimJob(jobId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('program_generation_jobs')
    .update({ 
      status: 'processing',
      started_at: new Date().toISOString()
    })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select()
  
  if (error) {
    console.error(`❌ Error claiming job ${jobId}:`, error)
    return false
  }
  
  // If data is empty, the job was already claimed by another worker
  return data && data.length > 0
}

// Check if all intake jobs for a user are complete
async function checkIntakeJobsComplete(userId: number): Promise<{ allComplete: boolean; hasFailed: boolean; errorMessage?: string }> {
  const { data: jobs, error } = await supabase
    .from('program_generation_jobs')
    .select('status, error_message, job_type')
    .eq('user_id', userId)
    .in('job_type', ['intake_program', 'intake_profile'])
  
  if (error || !jobs || jobs.length === 0) {
    return { allComplete: false, hasFailed: false }
  }
  
  const allComplete = jobs.every(job => job.status === 'completed' || job.status === 'failed')
  const hasFailed = jobs.some(job => job.status === 'failed')
  const failedJob = jobs.find(job => job.status === 'failed')
  
  return {
    allComplete,
    hasFailed,
    errorMessage: failedJob?.error_message || undefined
  }
}

// Update user intake status based on job completion
async function updateIntakeStatus(userId: number, allComplete: boolean, hasFailed: boolean, errorMessage?: string) {
  if (allComplete) {
    if (hasFailed) {
      await supabase
        .from('users')
        .update({
          intake_status: 'failed',
          intake_error_message: errorMessage || 'Job processing failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
      console.log(`❌ Updated user ${userId} intake_status to 'failed'`)
    } else {
      await supabase
        .from('users')
        .update({
          intake_status: 'complete',
          intake_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
      console.log(`✅ Updated user ${userId} intake_status to 'complete'`)
    }
  }
}

// Process intake_program job type
async function processIntakeProgramJob(job: any) {
  const jobId = job.id
  const userId = job.user_id
  const programNumber = job.program_number
  const weeksToGenerate = job.payload?.weeksToGenerate || [1, 2, 3, 4]
  const programType = job.payload?.programType || 'full'
  
  console.log(`🔄 Processing intake_program job ${jobId} for user ${userId}, program #${programNumber}`)
  
  // Check if program already exists (defensive check)
  const { data: existingProgram } = await supabase
    .from('programs')
    .select('id')
    .eq('user_id', userId)
    .eq('program_number', programNumber)
    .single()
  
  if (existingProgram) {
    throw new Error(`Program #${programNumber} already exists for user ${userId}`)
  }
  
  // Call generate-program Edge Function
  const generateResponse = await fetch(`${supabaseUrl}/functions/v1/generate-program`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_id: userId,
      weeksToGenerate,
      programType
    })
  })
  
  if (!generateResponse.ok) {
    const errorText = await generateResponse.text()
    throw new Error(`generate-program failed: ${errorText}`)
  }
  
  const programResult = await generateResponse.json()
  
  if (!programResult?.success || !programResult?.program) {
    throw new Error('generate-program returned invalid result')
  }
  
  // Save the program to the programs table
  const { data: savedProgram, error: saveError } = await supabase
    .from('programs')
    .insert({
      user_id: userId,
      sport_id: 1,
      program_number: programNumber,
      weeks_generated: weeksToGenerate,
      program_data: programResult.program,
      user_snapshot: programResult.program?.metadata?.userSnapshot || null,
      ratio_snapshot: programResult.program?.metadata?.ratioSnapshot || null
    })
    .select('id')
    .single()
  
  if (saveError) {
    throw new Error(`Failed to save program: ${saveError.message}`)
  }
  
  const programId = savedProgram.id
  console.log(`✅ Program saved with ID: ${programId}`)
  
  // Persist program_workouts and program_metcons
  try {
    const weeks = programResult?.program?.weeks || []
    if (programId && Array.isArray(weeks) && weeks.length > 0) {
      // Read user preferences for day limit
      let dayLimit = 5
      try {
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('training_days_per_week')
          .eq('user_id', userId)
          .single()
        if (prefs && typeof prefs.training_days_per_week === 'number') {
          dayLimit = Math.max(3, Math.min(6, prefs.training_days_per_week))
        }
      } catch (_) {}
      
      const workoutRows: any[] = []  // For program_workouts
      const engineRows: any[] = []   // For program_metcons (Engine workouts)
      
      for (const w of weeks) {
        const weekNum = w.week
        const daysArr = w.days || []
        for (const d of daysArr) {
          if (typeof d.day === 'number' && d.day > dayLimit) continue
          const blocksArr = d.blocks || []
          for (const b of blocksArr) {
            // Handle ENGINE block separately - save to program_metcons
            if (b.blockName === 'ENGINE' && d.engineData) {
              const engineData = d.engineData
              engineRows.push({
                program_id: programId,
                week: weekNum,
                day: d.day,
                workout_type: 'conditioning',
                engine_workout_id: engineData.workoutId,
                program_day_number: engineData.dayNumber,
                program_version: '5-day',
                day_type: engineData.dayType,
                workout_data: {
                  block_count: engineData.blockCount,
                  block_params: engineData.blockParams,
                  duration: engineData.duration
                }
              })
            } else {
              // Regular blocks - save to program_workouts
              const exercises = b.exercises || []
              for (const ex of exercises) {
                workoutRows.push({
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
      }
      
      // Insert program_workouts
      if (workoutRows.length > 0) {
        const { error: pwErr } = await supabase
          .from('program_workouts')
          .insert(workoutRows)
        if (pwErr) {
          console.warn('⚠️ program_workouts insert warning:', pwErr.message)
        } else {
          console.log(`✅ Saved ${workoutRows.length} exercises to program_workouts`)
        }
      }
      
      // Insert Engine workouts to program_metcons
      if (engineRows.length > 0) {
        const { error: engineErr } = await supabase
          .from('program_metcons')
          .insert(engineRows)
        if (engineErr) {
          console.warn('⚠️ program_metcons insert warning:', engineErr.message)
        } else {
          console.log(`✅ Saved ${engineRows.length} Engine workouts to program_metcons`)
        }
      }
    }
  } catch (scaffoldErr: any) {
    console.warn('⚠️ Failed to persist program_workouts scaffold (non-fatal):', scaffoldErr?.message || scaffoldErr)
    // Don't throw - this is non-fatal
  }
  
  console.log(`✅ Successfully processed intake_program job ${jobId} for user ${userId}`)
}

// Process intake_profile job type
async function processIntakeProfileJob(job: any) {
  const jobId = job.id
  const userId = job.user_id || job.payload?.userId
  
  if (!userId) {
    throw new Error('user_id is required for intake_profile job')
  }
  
  console.log(`🔄 Processing intake_profile job ${jobId} for user ${userId}`)
  
  const profileResponse = await fetch(`${supabaseUrl}/functions/v1/generate-user-profile`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      user_id: userId,
      sport_id: 1,
      force_regenerate: true
    })
  })
  
  if (!profileResponse.ok) {
    const errorText = await profileResponse.text()
    throw new Error(`generate-user-profile failed: ${errorText}`)
  }
  
  console.log(`✅ Successfully processed intake_profile job ${jobId} for user ${userId}`)
}

// Process legacy program_generation job type (backward compatibility)
async function processProgramGenerationJob(job: any) {
  const jobId = job.id
  const userId = job.user_id
  const programNumber = job.program_number
  const weeksToGenerate = job.payload?.weeksToGenerate || [1, 2, 3, 4]
  
  console.log(`🔄 Processing program_generation job ${jobId} for user ${userId}, program #${programNumber}`)
  
  // Get user's subscription tier to determine program type
  const { data: userData } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', userId)
    .single()
  
  const isAppliedPower = userData?.subscription_tier === 'APPLIED_POWER'
  const programType = isAppliedPower ? 'applied_power' : 'full'
  
  // Call generate-program Edge Function
  const generateResponse = await fetch(`${supabaseUrl}/functions/v1/generate-program`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_id: userId,
      weeksToGenerate,
      programType
    })
  })
  
  if (!generateResponse.ok) {
    const errorText = await generateResponse.text()
    throw new Error(`generate-program failed: ${errorText}`)
  }
  
  const programResult = await generateResponse.json()
  
  if (!programResult?.success || !programResult?.program) {
    throw new Error('generate-program returned invalid result')
  }
  
  // Save the program to the programs table
  const { error: saveError } = await supabase
    .from('programs')
    .insert({
      user_id: userId,
      sport_id: 1,
      program_number: programNumber,
      weeks_generated: weeksToGenerate,
      program_data: programResult.program,
      user_snapshot: programResult.program?.metadata?.userSnapshot || null,
      ratio_snapshot: programResult.program?.metadata?.ratioSnapshot || null
    })
  
  if (saveError) {
    throw new Error(`Failed to save program: ${saveError.message}`)
  }
  
  // Generate updated profile (non-critical)
  try {
    await fetch(`${supabaseUrl}/functions/v1/generate-user-profile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        user_id: userId,
        sport_id: 1,
        force_regenerate: true
      })
    })
  } catch (_) {
    // Non-critical, ignore errors
  }
  
  console.log(`✅ Successfully processed program_generation job ${jobId} for user ${userId}`)
}

// Main job processing function
async function processJob(job: any) {
  const jobId = job.id
  const userId = job.user_id
  const jobType = job.job_type || 'program_generation' // Default for backward compatibility
  
  try {
    // Atomically claim the job
    const claimed = await claimJob(jobId)
    if (!claimed) {
      console.log(`⏭️ Job ${jobId} was already claimed by another worker, skipping`)
      return
    }
    
    console.log(`🔄 Processing job ${jobId} (type: ${jobType}) for user ${userId}`)
    
    // Route to appropriate handler based on job type
    if (jobType === 'intake_program') {
      await processIntakeProgramJob(job)
    } else if (jobType === 'intake_profile') {
      await processIntakeProfileJob(job)
    } else if (jobType === 'program_generation' || !jobType) {
      // Backward compatibility: default to program_generation
      await processProgramGenerationJob(job)
    } else {
      throw new Error(`Unknown job type: ${jobType}`)
    }
    
    // Mark as completed
    await supabase
      .from('program_generation_jobs')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
    
    console.log(`✅ Job ${jobId} completed successfully`)
    
    // Check if all intake jobs for this user are complete (only for intake jobs)
    if (jobType === 'intake_program' || jobType === 'intake_profile') {
      const { allComplete, hasFailed, errorMessage } = await checkIntakeJobsComplete(userId)
      if (allComplete) {
        await updateIntakeStatus(userId, allComplete, hasFailed, errorMessage)
      }
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const retryCount = (job.retry_count || 0) + 1
    const maxRetries = job.max_retries || 3
    
    console.error(`❌ Job ${jobId} failed:`, errorMessage)
    
    // Update job status
    await supabase
      .from('program_generation_jobs')
      .update({ 
        status: retryCount < maxRetries ? 'pending' : 'failed',
        error_message: errorMessage,
        retry_count: retryCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
    
    // If this is an intake job and it failed permanently, check if all jobs are done
    const jobType = job.job_type || 'program_generation'
    if ((jobType === 'intake_program' || jobType === 'intake_profile') && retryCount >= maxRetries) {
      const { allComplete, hasFailed } = await checkIntakeJobsComplete(userId)
      if (allComplete) {
        await updateIntakeStatus(userId, allComplete, hasFailed, errorMessage)
      }
    }
  }
}

serve(async (req) => {
  try {
    // Check if a specific job_id was provided (webhook path)
    let jobToProcess: any = null
    
    try {
      const body = await req.json().catch(() => ({}))
      if (body.job_id) {
        const { data: job, error } = await supabase
          .from('program_generation_jobs')
          .select('*')
          .eq('id', body.job_id)
          .single()
        
        if (error || !job) {
          console.error(`❌ Job ${body.job_id} not found:`, error)
          return new Response(
            JSON.stringify({ success: false, error: `Job ${body.job_id} not found` }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          )
        }
        
        if (job.status !== 'pending') {
          console.log(`⏭️ Job ${body.job_id} is not pending (status: ${job.status}), skipping`)
          return new Response(
            JSON.stringify({ success: true, message: `Job ${body.job_id} is not pending` }),
            { headers: { 'Content-Type': 'application/json' } }
          )
        }
        
        jobToProcess = job
      }
    } catch (e) {
      // If body parsing fails, continue with polling mode
      console.log('No job_id in request body, using polling mode')
    }
    
    // Only reset stuck jobs in polling mode (not on webhook requests)
    if (!jobToProcess) {
      await resetStuckJobs()
    }
    
    // If specific job provided, process it
    if (jobToProcess) {
      await processJob(jobToProcess)
      return new Response(
        JSON.stringify({ success: true, processed: 1, jobId: jobToProcess.id }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    // Otherwise, poll for pending jobs (cron path)
    const { data: jobs } = await supabase
      .from('program_generation_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10)
    
    if (jobs && jobs.length > 0) {
      console.log(`📋 Found ${jobs.length} pending jobs`)
      // Process jobs sequentially to avoid overwhelming the system
      for (const job of jobs) {
        await processJob(job)
      }
      console.log(`✅ Processed ${jobs.length} jobs`)
    } else {
      console.log('ℹ️ No pending jobs')
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: jobs?.length || 0 
      }), 
      { 
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  } catch (e) {
    console.error('❌ Worker error:', e)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: String(e) 
      }), 
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  }
})


