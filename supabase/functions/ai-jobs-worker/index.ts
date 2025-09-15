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

      // Minimal apply: mark a placeholder future day as AI updated (to surface end-to-end flow)
      const targetWeekOffset = action?.targetWindow?.weekOffset ?? 1
      const { data: prog } = await supabase
        .from('programs')
        .select('id, user_id, generated_at')
        .eq('user_id', user_id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()
      if (prog) {
        const programId = prog.id
        const week = Math.max(1, Math.min(13, 1 + Number(targetWeekOffset)))
        const day = 1
        await supabase.from('modified_workouts').upsert({
          user_id,
          program_id: programId,
          week,
          day,
          modified_program: null,
          modifications_applied: [action],
          is_preview: false,
          applied_at: new Date().toISOString(),
          source: 'ai',
          rationale: { message: action?.rationale || 'AI applied action', action },
          applied_by_job_id: job.id
        }, { onConflict: 'user_id,program_id,week,day' })
      }
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

