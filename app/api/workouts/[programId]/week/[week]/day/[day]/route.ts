import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; week: string; day: string }> }
) {
  try {
    const { programId, week, day } = await params

    
    console.log(`🏋️ Fetching workout: Program ${programId}, Week ${week}, Day ${day}`)

    // Validate parameters
    const programIdNum = parseInt(programId)
    const weekNum = parseInt(week)
    const dayNum = parseInt(day)

    if (isNaN(programIdNum) || isNaN(weekNum) || isNaN(dayNum)) {
      return NextResponse.json(
        { error: 'Invalid parameters. Program ID, week, and day must be numbers.' },
        { status: 400 }
      )
    }

    if (weekNum < 1 || weekNum > 12) {
      return NextResponse.json(
        { error: 'Week must be between 1 and 12' },
        { status: 400 }
      )
    }

    if (dayNum < 1 || dayNum > 5) {
      return NextResponse.json(
        { error: 'Day must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Fetch the program from database
    const { data: program, error: fetchError } = await supabase
      .from('programs')
.select('program_data, weeks_generated, generated_at')
      .eq('id', programIdNum)
      .single()

    if (fetchError) {
      console.error('❌ Failed to fetch program:', fetchError)
      return NextResponse.json(
        { error: 'Program not found', details: fetchError.message },
        { status: 404 }
      )
    }

    if (!program) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      )
    }

    // Check if the requested week was generated
    if (!program.weeks_generated.includes(weekNum)) {
      return NextResponse.json(
        { error: `Week ${weekNum} was not generated for this program. Available weeks: ${program.weeks_generated.join(', ')}` },
        { status: 404 }
      )
    }

    // Extract the specific workout from the program data
    const programData = program.program_data
    const weeks = programData.weeks || []
    
    // Find the requested week
    const targetWeek = weeks.find((w: any) => w.week === weekNum)
    if (!targetWeek) {
      return NextResponse.json(
        { error: `Week ${weekNum} not found in program data` },
        { status: 404 }
      )
    }

    // Find the requested day
    const targetDay = targetWeek.days?.find((d: any) => d.day === dayNum)
    if (!targetDay) {
      return NextResponse.json(
        { error: `Day ${dayNum} not found in week ${weekNum}` },
        { status: 404 }
      )
    }

    console.log(`✅ Found workout: ${targetDay.dayName} - ${targetDay.mainLift}`)

    // Format the workout for frontend consumption
    const workout = {
      programId: programIdNum,
      week: weekNum,
      day: dayNum,
      dayName: targetDay.dayName,
      mainLift: targetDay.mainLift,
      isDeload: targetDay.isDeload,
      blocks: targetDay.blocks.map((block: any) => ({
        blockName: block.block,
        exercises: block.exercises.map((exercise: any) => ({
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          weightTime: exercise.weightTime,
          notes: exercise.notes
        }))
      })),
      // Include MetCon metadata if available
      metconData: targetDay.metconData || null,
      // Summary information
      totalExercises: targetDay.blocks.reduce((sum: number, block: any) => sum + (block.exercises?.length || 0), 0),
      totalBlocks: targetDay.blocks.length
    }

    return NextResponse.json({
      success: true,
      workout,
      metadata: {
       programCreatedAt: program.generated_at,
        availableWeeks: program.weeks_generated,
        fetchedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Unexpected error fetching workout:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
