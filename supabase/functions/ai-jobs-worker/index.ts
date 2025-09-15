// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, serviceKey)

async function processJob(job: any) {
  try {
    const { user_id, job_type, payload } = job

    // Cooldowns and dedupe could be checked here (omitted for brevity)

    if (job_type === 'preview_action') {
      // For preview, we can write is_preview rows, or just mark job done
      await supabase.from('ai_jobs').update({ status: 'completed' }).eq('id', job.id)
      return
    }

    if (job_type === 'apply_action') {
      const action = payload?.action
      if (!action) throw new Error('Missing action')

      // Example: metcon time-domain swap placeholder (real logic would pick future uncached days and swap catalog entries)
      // For now, simply mark job completed; actual write to modified_workouts happens in a fuller implementation
      await supabase.from('ai_jobs').update({ status: 'completed' }).eq('id', job.id)
      return
    }

    // Unknown job: mark failed
    await supabase.from('ai_jobs').update({ status: 'failed' }).eq('id', job.id)
  } catch (e) {
    await supabase.from('ai_jobs').update({ status: 'failed', metadata: { error: String(e) } }).eq('id', job.id)
  }
}

serve(async (_req) => {
  try {
    // Pull a few pending jobs
    const { data: jobs } = await supabase
      .from('ai_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5)

    if (jobs && jobs.length > 0) {
      await Promise.all(jobs.map(processJob))
    }

    return new Response(JSON.stringify({ success: true, processed: jobs?.length || 0 }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})

