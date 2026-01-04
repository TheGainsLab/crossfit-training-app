import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 44-day window: 30 days normal + 14 days buffer for test week submission
const TEST_WINDOW_DAYS = 44

export async function GET() {
  try {
    console.log('Running scheduled program generation check...')

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

    for (const user of users || []) {
      if (!user.programs || user.programs.length === 0) continue

      // CASE 1: User is awaiting test results - check for fallback
      if (user.awaiting_test_results && user.awaiting_test_since) {
        const windowOpenedAt = new Date(user.awaiting_test_since)
        const now = new Date()
        const daysSinceWindowOpened = Math.floor(
          (now.getTime() - windowOpenedAt.getTime()) / (24 * 60 * 60 * 1000)
        )

        if (daysSinceWindowOpened >= TEST_WINDOW_DAYS) {
          // Fallback: Generate next cycle with existing profile data
          console.log(`⏰ User ${user.id}: Test window expired after ${daysSinceWindowOpened} days, triggering fallback`)
          await generateFallbackProgram(user.id, user.current_cycle || 1)
          fallbacksTriggered++
        } else {
          console.log(`⏳ User ${user.id}: Awaiting test results (${daysSinceWindowOpened}/${TEST_WINDOW_DAYS} days)`)
        }
        continue  // Skip normal time-based check for users awaiting tests
      }

      // CASE 2: Normal time-based program generation
      const sortedPrograms = user.programs.sort((a: any, b: any) => a.program_number - b.program_number)
      const firstProgram = sortedPrograms[0]
      const currentProgramCount = user.programs.length

      // Calculate how many programs should exist based on time since first program
      const firstProgramDate = new Date(firstProgram.generated_at)
      const now = new Date()
      const monthsSinceFirst = Math.floor(
        (now.getTime() - firstProgramDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
      )
      const programsDue = monthsSinceFirst + 1

      if (programsDue > currentProgramCount) {
        const nextProgramNumber = currentProgramCount + 1

        // Check if this is a cycle-end program (3, 6, 9, ...)
        const isCycleEnd = nextProgramNumber % 3 === 0

        if (isCycleEnd) {
          console.log(`🔄 User ${user.id}: Generating cycle-end program #${nextProgramNumber} with test week`)
          await generateCycleEndProgram(user.id, nextProgramNumber)
          testWindowsOpened++
        } else {
          console.log(`📦 User ${user.id}: Generating program #${nextProgramNumber}`)
          await generateScheduledProgram(user.id, nextProgramNumber)
        }
        programsGenerated++
      }
    }

    console.log(`✅ Generated ${programsGenerated} programs, ${fallbacksTriggered} fallbacks, ${testWindowsOpened} test windows opened`)
    return NextResponse.json({
      success: true,
      programsGenerated,
      fallbacksTriggered,
      testWindowsOpened,
      message: `Generated ${programsGenerated} programs, ${fallbacksTriggered} fallbacks, ${testWindowsOpened} test windows`
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
      console.log(`✅ Enqueued program #${programNumber} for user ${userId} (weeks ${weeksToGenerate.join(', ')})`)
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
    // Cycle-end programs have 5 weeks (4 regular + 1 test week)
    // Program #3: weeks [9, 10, 11, 12, 13]
    // Program #6: weeks [22, 23, 24, 25, 26]
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

    // Open the test submission window
    const { error: updateErr } = await supabase
      .from('users')
      .update({
        awaiting_test_results: true,
        awaiting_test_since: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateErr) {
      console.error('Failed to set awaiting_test_results:', updateErr)
    } else {
      console.log(`✅ Enqueued cycle-end program #${programNumber} for user ${userId}, test window opened`)
    }
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

    console.log(`✅ Fallback: Enqueued program #${nextProgramNumber} for user ${userId}, advanced to cycle ${currentCycle + 1}`)
  } catch (error) {
    console.error('Error enqueuing fallback program:', error)
  }
}

/**
 * Calculate which weeks belong to a given program number
 * Accounts for test weeks (week 13, 26, 39, ...) being part of cycle-end programs
 */
function getWeeksForProgram(programNumber: number): number[] {
  const cycleNumber = Math.ceil(programNumber / 3)
  const positionInCycle = ((programNumber - 1) % 3) + 1  // 1, 2, or 3

  // Each cycle has 13 weeks (4 + 4 + 5 with test week)
  const cycleStartWeek = (cycleNumber - 1) * 13 + 1

  // Position 1: weeks 1-4, Position 2: weeks 5-8, Position 3: weeks 9-13
  let programStartWeek: number
  if (positionInCycle === 1) {
    programStartWeek = cycleStartWeek
  } else if (positionInCycle === 2) {
    programStartWeek = cycleStartWeek + 4
  } else {
    programStartWeek = cycleStartWeek + 8
  }

  // Cycle-end programs (position 3) have 5 weeks including test week
  const weekCount = positionInCycle === 3 ? 5 : 4

  return Array.from({ length: weekCount }, (_, i) => programStartWeek + i)
}
