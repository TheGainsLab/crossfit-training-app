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

      // Implement metcon time-domain targeting (other kinds can be added later)
      if (action.kind === 'metcon_time_domain') {
        const targetWeekOffset = action?.targetWindow?.weekOffset ?? 1
        const count = Number(action?.params?.count || 2)
        const timeDomain = String(action?.params?.timeDomain || '8-12')

        // Load latest program with structure
        const { data: prog } = await supabase
          .from('programs')
          .select('id, user_id, generated_at, program_data')
          .eq('user_id', user_id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .single()
        if (!prog) {
          await supabase.from('ai_jobs').update({ status: 'failed', metadata: { error: 'No program found' } }).eq('id', job.id)
          return
        }
        const programId = prog.id
        const programData: any = (prog as any).program_data || {}
        const weeks: any[] = Array.isArray(programData.weeks) ? programData.weeks : []
        const weekNum = Math.max(1, Math.min(13, 1 + Number(targetWeekOffset)))
        const targetWeek = weeks.find((w: any) => w.week === weekNum)
        if (!targetWeek) {
          await supabase.from('ai_jobs').update({ status: 'failed', metadata: { error: `Week ${weekNum} not found` } }).eq('id', job.id)
          return
        }

        // Avoid completed or already modified days
        const { data: completed } = await supabase
          .from('performance_logs')
          .select('day')
          .eq('user_id', user_id)
          .eq('program_id', programId)
          .eq('week', weekNum)
        const completedDays = new Set((completed || []).map((r: any) => r.day))
        const { data: existingMods } = await supabase
          .from('modified_workouts')
          .select('day')
          .eq('user_id', user_id)
          .eq('program_id', programId)
          .eq('week', weekNum)
        const modifiedDays = new Set((existingMods || []).map((r: any) => r.day))

        // Collect eligible MetCon days
        const candidates: number[] = []
        for (const d of (targetWeek.days || [])) {
          const hasMetcon = (d.blocks || []).some((b: any) => (b.blockName || b.block) === 'METCONS')
          if (hasMetcon && !completedDays.has(d.day) && !modifiedDays.has(d.day)) {
            candidates.push(d.day)
          }
        }
        const chosen = candidates.slice(0, count)
        if (chosen.length === 0) {
          await supabase.from('ai_jobs').update({ status: 'completed', metadata: { note: 'No eligible days' } }).eq('id', job.id)
          return
        }

        // Fetch metcons catalog for target time domain
        const { data: catalog } = await supabase
          .from('metcons')
          .select('workout_id, format, workout_notes, time_range, tasks, male_p90, male_p50, male_std_dev, female_p90, female_p50, female_std_dev, max_weight_male, max_weight_female')
          .eq('time_range', timeDomain)
          .limit(Math.max(2, chosen.length))
        const picks = (catalog || []).slice(0, chosen.length).map((m: any) => ({
          workoutId: m.workout_id,
          workoutFormat: m.format,
          workoutNotes: m.workout_notes,
          timeRange: m.time_range,
          tasks: m.tasks,
          percentileGuidance: {
            male: { excellentScore: m.male_p90, medianScore: m.male_p50, stdDev: m.male_std_dev },
            female: { excellentScore: m.female_p90, medianScore: m.female_p50, stdDev: m.female_std_dev }
          },
          rxWeights: { male: m.max_weight_male, female: m.max_weight_female }
        }))

        // Apply modifications for each chosen day
        for (let i = 0; i < chosen.length; i++) {
          const dayNum = chosen[i]
          const metconData = picks[i] || picks[0]
          const dayObj = (targetWeek.days || []).find((d: any) => d.day === dayNum) || { blocks: [] }
          const modifiedDay = {
            programId: programId,
            week: weekNum,
            day: dayNum,
            dayName: dayObj.dayName,
            mainLift: dayObj.mainLift,
            isDeload: dayObj.isDeload,
            blocks: dayObj.blocks,
            metconData
          }
          await supabase.from('modified_workouts').upsert({
            user_id,
            program_id: programId,
            week: weekNum,
            day: dayNum,
            modified_program: modifiedDay,
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

      // Unsupported kinds for now
      await supabase.from('ai_jobs').update({ status: 'failed', metadata: { error: 'Unsupported action kind' } }).eq('id', job.id)
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

