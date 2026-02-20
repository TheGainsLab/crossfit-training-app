import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 44-day window: 30 days normal + 14 days buffer for test week submission
const TEST_WINDOW_DAYS = 44

export async function GET() {
  try {
    // Get all subscribers (active or trialing) with their programs and test cycle state
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        awaiting_test_results,
        awaiting_test_since,
        current_cycle,
        subscriptions!inner(billing_interval, status),
        programs:programs!programs_user_id_fkey(program_number, generated_at)
      `)
      .in('subscriptions.status', ['active','trialing'])

    if (error) throw error

    let programsGenerated = 0
    let fallbacksTriggered = 0
    let testWindowsOpened = 0
    let usersUnstuck = 0

    for (const user of users || []) {
      if (!user.programs || user.programs.length === 0) continue

      // CASE 1: User is awaiting test results - check for fallback
      if (user.awaiting_test_results && user.awaiting_test_since) {
        // Self-healing: detect users stuck with awaiting_test_results=true but
        // no cycle-end program actually exists. This happens when the worker
        // failed to generate the program after the flag was set (pre-fix).
        const programNumbers = user.programs.map((p: any) => p.program_number)
        const currentCycle = user.current_cycle || 1
        const expectedCycleEndProgram = currentCycle * 3 // Program 3, 6, 9...
        const hasCycleEndProgram = programNumbers.includes(expectedCycleEndProgram)

        if (!hasCycleEndProgram) {
          // User is stuck: reset the flag so they fall through to CASE 2
          // and the normal generation loop picks up the missing programs
          console.log(`Unsticking user ${user.id}: awaiting_test_results=true but program #${expectedCycleEndProgram} not found`)
          await supabase
            .from('users')
            .update({
              awaiting_test_results: false,
              awaiting_test_since: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id)

          usersUnstuck++
          // Fall through to CASE 2 instead of continuing
        } else {
          // Legitimately awaiting test results — check for timeout fallback
          const windowOpenedAt = new Date(user.awaiting_test_since)
          const now = new Date()
          const daysSinceWindowOpened = Math.floor(
            (now.getTime() - windowOpenedAt.getTime()) / (24 * 60 * 60 * 1000)
          )

          if (daysSinceWindowOpened >= TEST_WINDOW_DAYS) {
            // Fallback: Generate next cycle with existing profile data
            await generateFallbackProgram(user.id, user.current_cycle || 1)
            fallbacksTriggered++
          }
          continue  // Skip normal time-based check for users awaiting tests
        }
      }

      // CASE 2: Normal time-based program generation
      const sortedPrograms = user.programs.sort((a: any, b: any) => a.program_number - b.program_number)
      const firstProgram = sortedPrograms[0]
      let currentProgramCount = user.programs.length

      // Calculate how many programs should exist based on time since first program
      const firstProgramDate = new Date(firstProgram.generated_at)
      const now = new Date()
      const monthsSinceFirst = Math.floor(
        (now.getTime() - firstProgramDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
      )
      const programsDue = monthsSinceFirst + 1

      // Loop to catch up on all overdue programs (not just one per cron run)
      while (programsDue > currentProgramCount) {
        const nextProgramNumber = currentProgramCount + 1

        // Skip if there's already a pending/processing job for this program
        const { data: existingJob } = await supabase
          .from('program_generation_jobs')
          .select('id')
          .eq('user_id', user.id)
          .eq('program_number', nextProgramNumber)
          .in('status', ['pending', 'processing'])
          .limit(1)

        if (existingJob && existingJob.length > 0) {
          break // Job already in flight for this program number
        }

        // Check if this is a cycle-end program (3, 6, 9, ...)
        const isCycleEnd = nextProgramNumber % 3 === 0

        if (isCycleEnd) {
          await generateCycleEndProgram(user.id, nextProgramNumber)
          testWindowsOpened++
          programsGenerated++
          break // Stop at cycle-end; test results needed before next cycle
        } else {
          await generateScheduledProgram(user.id, nextProgramNumber)
          programsGenerated++
          currentProgramCount++
        }
      }
    }

    return NextResponse.json({
      success: true,
      programsGenerated,
      fallbacksTriggered,
      testWindowsOpened,
      usersUnstuck,
      message: `Generated ${programsGenerated} programs, ${fallbacksTriggered} fallbacks, ${testWindowsOpened} test windows, ${usersUnstuck} users unstuck`
    })

  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json({ error: 'Failed to run scheduled generation' }, { status: 500 })
  }
}

/**
 * Generate a normal mid-cycle program (programs 1, 2, 4, 5, 7, 8, ...)
 */
async function generateScheduledProgram(userId: number, programNumber: number) {
  try {
    // Calculate weeks for this program (4 weeks each)
    // Program #1: weeks [1, 2, 3, 4]
    // Program #2: weeks [5, 6, 7, 8]
    // Program #4: weeks [14, 15, 16, 17] (after test week 13)
    const weeksToGenerate = getWeeksForProgram(programNumber)

    const { error: insErr } = await supabase
      .from('program_generation_jobs')
      .insert({
        user_id: userId,
        program_number: programNumber,
        status: 'pending',
        job_type: 'program_generation',
        payload: { weeksToGenerate }
      })

    if (insErr) {
      console.error('Failed to enqueue program generation job:', insErr)
    } else {
    }
  } catch (error) {
    console.error('Error enqueuing scheduled program:', error)
  }
}

/**
 * Generate a cycle-end program with test week (programs 3, 6, 9, ...)
 * This opens the test submission window
 */
async function generateCycleEndProgram(userId: number, programNumber: number) {
  try {
    // Cycle-end programs have 4 regular weeks; test week is appended by generate-program
    // Program #3: weeks [9, 10, 11, 12] + test week 13 (via includeTestWeek)
    // Program #6: weeks [22, 23, 24, 25] + test week 26 (via includeTestWeek)
    const weeksToGenerate = getWeeksForProgram(programNumber)

    const { error: insErr } = await supabase
      .from('program_generation_jobs')
      .insert({
        user_id: userId,
        program_number: programNumber,
        status: 'pending',
        job_type: 'program_generation',
        payload: {
          weeksToGenerate,
          includeTestWeek: true
        }
      })

    if (insErr) {
      console.error('Failed to enqueue cycle-end program job:', insErr)
      return
    }

    // NOTE: awaiting_test_results is set by the worker AFTER the program is
    // successfully generated.  Setting it here caused users to get permanently
    // blocked when the worker failed to process the job.
  } catch (error) {
    console.error('Error enqueuing cycle-end program:', error)
  }
}

/**
 * Generate fallback program when test window expires without submission
 * Uses existing profile data (not fresh test results)
 */
async function generateFallbackProgram(userId: number, currentCycle: number) {
  try {
    // Next program is first of new cycle
    const nextProgramNumber = currentCycle * 3 + 1  // Cycle 1 -> Program 4, Cycle 2 -> Program 7
    const weeksToGenerate = getWeeksForProgram(nextProgramNumber)

    const { error: insErr } = await supabase
      .from('program_generation_jobs')
      .insert({
        user_id: userId,
        program_number: nextProgramNumber,
        status: 'pending',
        job_type: 'program_generation',
        payload: {
          weeksToGenerate,
          triggeredBy: 'test_window_fallback'
        }
      })

    if (insErr) {
      console.error('Failed to enqueue fallback program job:', insErr)
      return
    }

    // Close the test window and advance cycle
    const { error: updateErr } = await supabase
      .from('users')
      .update({
        awaiting_test_results: false,
        awaiting_test_since: null,
        current_cycle: currentCycle + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateErr) {
      console.error('Failed to update user after fallback:', updateErr)
    }

    // Create a notification for the user
    await supabase
      .from('user_notifications')
      .insert({
        user_id: userId,
        type: 'test_window_expired',
        title: 'New Program Ready',
        message: 'Your next training cycle is ready! You can still submit test results anytime to update your profile for future programs.',
        data: { cycle: currentCycle + 1, programNumber: nextProgramNumber },
        read: false
      })

  } catch (error) {
    console.error('Error enqueuing fallback program:', error)
  }
}

/**
 * Calculate which weeks belong to a given program number
 * Each cycle is 13 weeks: 4 + 4 + 4 regular weeks, plus a test week (13, 26, 39, ...)
 * The test week is NOT included here — it's generated separately via includeTestWeek flag
 */
function getWeeksForProgram(programNumber: number): number[] {
  const cycleNumber = Math.ceil(programNumber / 3)
  const positionInCycle = ((programNumber - 1) % 3) + 1  // 1, 2, or 3

  // Each cycle has 13 weeks (4 + 4 + 4 regular + 1 test week)
  const cycleStartWeek = (cycleNumber - 1) * 13 + 1

  // Position 1: weeks 1-4, Position 2: weeks 5-8, Position 3: weeks 9-12
  // Test week (13, 26, 39...) is appended by generate-program when includeTestWeek = true
  let programStartWeek: number
  if (positionInCycle === 1) {
    programStartWeek = cycleStartWeek
  } else if (positionInCycle === 2) {
    programStartWeek = cycleStartWeek + 4
  } else {
    programStartWeek = cycleStartWeek + 8
  }

  // All programs generate 4 regular weeks; test week is handled separately
  return Array.from({ length: 4 }, (_, i) => programStartWeek + i)
}
