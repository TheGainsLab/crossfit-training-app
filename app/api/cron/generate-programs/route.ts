import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    console.log('Running scheduled program generation check...')
    
    // Get all active subscribers with their programs
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        subscriptions!inner(billing_interval, status),
        programs(program_number, generated_at)
      `)
      .eq('subscription_status', 'ACTIVE')
      .eq('subscriptions.status', 'active')

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
      
      // If user is due for more programs than they have, generate the next one
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
  // Copy your generateRenewalProgram logic here, but modify it to work with userId instead of stripe subscription ID
  try {
    console.log(`Generating scheduled program for user ${userId}`)
    
    // Get current program count
    const { data: programData, error: programError } = await supabase
      .from('programs')
      .select('program_number')
      .eq('user_id', userId)
      .order('program_number', { ascending: false })
      .limit(1)

    if (programError) {
      console.error('Error getting program count:', programError)
      return
    }

    const nextProgramNumber = (programData?.[0]?.program_number || 0) + 1
    
    // Get current user data from settings (reuse your existing getCurrentUserData function logic)
    const userData = await getCurrentUserDataForCron(userId)
    
    // Always generate 4-week programs regardless of billing interval
    const weeksToGenerate = Array.from({length: 4}, (_, i) => i + 1 + (4 * (nextProgramNumber - 1)))

    // Call program generation
    const programResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-program`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          user_id: userId,
          weeksToGenerate
        })
      }
    )

    if (!programResponse.ok) {
      console.error('Scheduled program generation failed')
      return
    }

    const programResult = await programResponse.json()

    // Save program
    const { error: programSaveError } = await supabase
      .from('programs')
      .insert({
        user_id: userId,
        sport_id: 1,
        program_number: nextProgramNumber,
        weeks_generated: weeksToGenerate,
        program_data: programResult.program,
        user_snapshot: programResult.program.metadata.userSnapshot,
        ratio_snapshot: programResult.program.metadata.ratioSnapshot
      })

    if (programSaveError) {
      console.error('Failed to save scheduled program:', programSaveError)
      return
    }

    console.log(`Successfully generated scheduled program #${nextProgramNumber} for user ${userId}`)

  } catch (error) {
    console.error('Error in generateScheduledProgram:', error)
  }
}

async function getCurrentUserDataForCron(userId: number) {
  // Copy your getCurrentUserData function here since it needs to be accessible in this file
  // ... same logic as your existing function
}
