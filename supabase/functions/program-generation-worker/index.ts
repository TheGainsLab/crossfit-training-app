// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, serviceKey)

async function processJob(job: any) {
  const jobId = job.id
  const userId = job.user_id
  const programNumber = job.program_number
  const weeksToGenerate = job.payload?.weeksToGenerate || [1, 2, 3, 4]
  
  try {
    // Mark as processing
    await supabase
      .from('program_generation_jobs')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', jobId)
    
    console.log(`🔄 Processing program generation for user ${userId}, program #${programNumber}`)
    
    // Call generate-program Edge Function
    const generateResponse = await fetch(`${supabaseUrl}/functions/v1/generate-program`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        weeksToGenerate
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
    
    // Mark as completed
    await supabase
      .from('program_generation_jobs')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
    
    console.log(`✅ Successfully generated and saved program #${programNumber} for user ${userId}`)
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const retryCount = (job.retry_count || 0) + 1
    const maxRetries = job.max_retries || 3
    
    console.error(`❌ Program generation failed for user ${userId}:`, errorMessage)
    
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
  }
}

serve(async (_req) => {
  try {
    // Pull pending jobs (process up to 10 at a time)
    const { data: jobs } = await supabase
      .from('program_generation_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10)
    
    if (jobs && jobs.length > 0) {
      console.log(`📋 Found ${jobs.length} pending program generation jobs`)
      // Process jobs sequentially to avoid overwhelming the system
      for (const job of jobs) {
        await processJob(job)
      }
      console.log(`✅ Processed ${jobs.length} program generation jobs`)
    } else {
      console.log('ℹ️ No pending program generation jobs')
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


