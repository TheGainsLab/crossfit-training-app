import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    console.log('Running scheduled program generation check...')
    
    // Get all subscribers (active or trialing) with their programs
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        subscriptions!inner(billing_interval, status),
        programs:programs!programs_user_id_fkey(program_number, generated_at)
      `)
      .in('subscriptions.status', ['active','trialing'])

    if (error) throw error

    let programsGenerated = 0

    for (const user of users || []) {
      if (!user.programs || user.programs.length === 0) continue
      
      // Sort programs by number to get the first one
      const sortedPrograms = user.programs.sort((a, b) => a.program_number - b.program_number)
      const firstProgram = sortedPrograms[0]
      const latestProgram = sortedPrograms[sortedPrograms.length - 1]
      
      // Calculate how many programs should exist based on time since first program
      const firstProgramDate = new Date(firstProgram.generated_at)
      const now = new Date()
      const monthsSinceFirst = Math.floor((now.getTime() - firstProgramDate.getTime()) / (30 * 24 * 60 * 60 * 1000))
      const programsDue = monthsSinceFirst + 1 // +1 because they start with program 1
      const currentProgramCount = user.programs.length
      
      // If user is due for more programs than they have, generate the next one (monthly cadence regardless of billing)
      if (programsDue > currentProgramCount) {
        console.log(`User ${user.id} is due for program #${currentProgramCount + 1}`)
        await generateScheduledProgram(user.id, user.subscriptions[0].billing_interval)
        programsGenerated++
      }
    }

    console.log(`Generated ${programsGenerated} scheduled programs`)
    return NextResponse.json({ 
      success: true, 
      programsGenerated,
      message: `Generated ${programsGenerated} scheduled programs`
    })
    
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json({ error: 'Failed to run scheduled generation' }, { status: 500 })
  }
}

async function generateScheduledProgram(userId: number, billingInterval: string) {
  try {
    // Determine next program number
    const { data: progCount } = await supabase
      .from('programs')
      .select('program_number')
      .eq('user_id', userId)
      .order('program_number', { ascending: false })
      .limit(1)
    const nextProgramNumber = (progCount?.[0]?.program_number || 0) + 1

    // Calculate correct weeks for this program number
    // Program #1: weeks [1, 2, 3, 4]
    // Program #2: weeks [5, 6, 7, 8]
    // Program #3: weeks [9, 10, 11, 12]
    // etc.
    const weeksToGenerate = Array.from({length: 4}, (_, i) => i + 1 + (4 * (nextProgramNumber - 1)))

    // Enqueue to dedicated program generation queue
    const { error: insErr } = await supabase
      .from('program_generation_jobs')
      .insert({
        user_id: userId,
        program_number: nextProgramNumber,
        status: 'pending',
        payload: { weeksToGenerate }
      })
    
    if (insErr) {
      console.error('Failed to enqueue program generation job:', insErr)
    } else {
      console.log(`✅ Enqueued program #${nextProgramNumber} for user ${userId}`)
    }
  } catch (error) {
    console.error('Error enqueuing scheduled program:', error)
  }
}
