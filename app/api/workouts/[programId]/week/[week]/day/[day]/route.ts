import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ADD THE ENHANCED FUNCTION HERE (after supabase setup, before the GET function)
async function enhanceMetconData(metconData: any) {
  try {
    // Look up the complete metcon data by matching workout_id
    const { data: metcon, error } = await supabase
      .from('metcons')
      .select(`
        id,
        workout_id,
        format,
        workout_notes,
        time_range,
        tasks,
        male_p90,
        male_p50,
        male_std_dev,
        female_p90,
        female_p50,
        female_std_dev,
        max_weight_male,
        max_weight_female
      `)
      .eq('workout_id', metconData.workoutId)
      .single()

    if (error || !metcon) {
      console.warn('⚠️ Could not find metcon data for:', metconData.workoutId)
      return metconData // Return original data without enhancements
    }

    // Return fully enhanced data structure
    return {
      id: metcon.id,
      workoutId: metcon.workout_id,
      workoutFormat: metcon.format,
      workoutNotes: metcon.workout_notes,
      timeRange: metcon.time_range,
      tasks: metcon.tasks,
      percentileGuidance: {
        male: {
          excellentScore: metcon.male_p90,
          medianScore: metcon.male_p50,
          stdDev: metcon.male_std_dev
        },
        female: {
          excellentScore: metcon.female_p90,
          medianScore: metcon.female_p50,
          stdDev: metcon.female_std_dev
        }
      },
      rxWeights: {
        male: metcon.max_weight_male,
        female: metcon.max_weight_female
      }
    }
  } catch (error) {
    console.error('❌ Error enhancing metcon data:', error)
    return metconData // Return original data on error
  }
}

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
      .select('program_data, weeks_generated, generated_at, user_id')
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

// ADD THESE LINES HERE:
// Fetch coach modifications for this specific workout
const { data: modifications, error: modError } = await supabase
  .from('coach_program_modifications')
  .select('*')
  .eq('athlete_id', program.user_id)
  .eq('program_id', programIdNum)
  .eq('week', weekNum)
  .eq('day', dayNum);

if (modError) {
  console.error('Error fetching modifications:', modError);
}

console.log(`🔍 Found ${modifications?.length || 0} coach modifications for this workout`);

// Create modification map for easy lookup
const modificationMap = new Map();
if (modifications) {
  modifications.forEach(mod => {
    const key = `${mod.block_name}-${mod.exercise_index}`;
    modificationMap.set(key, mod.modified_data);
  });
}

// ADD THIS SECTION HERE (before the workout object)
// Fetch user gender for proper MetCon benchmarks
let userGender = 'male' // Default fallback
try {
  const { data: userData, error: userError } = await supabase
    .from('users') 
    .select('gender')
.eq('id', program.user_id)  // Use the user_id from the program we already fetched    
    .single()
  
  if (userData && !userError) {
    userGender = userData.gender || 'male'
    console.log('👤 User gender:', userGender)
  }
} catch (error) {
  console.log('⚠️ Could not fetch user gender, using default')
}



    // Format the workout for frontend consumption
    let workout = {
      programId: programIdNum,
      week: weekNum,
      day: dayNum,
      dayName: targetDay.dayName,
      mainLift: targetDay.mainLift,
      isDeload: targetDay.isDeload,
 userGender: userGender,  // ← ADD THIS LINE      

blocks: targetDay.blocks.map((block: any) => ({
  blockName: block.blockName || block.block,
  exercises: block.exercises.map((exercise: any, exerciseIndex: number) => {
    // Check for coach modifications
    const modKey = `${(block.blockName || block.block)}-${exerciseIndex}`;
    const modification = modificationMap.get(modKey);
    
    // Start with original exercise data
    let finalExercise = {
      name: exercise.name,
      sets: exercise.sets,
      reps: exercise.reps,
      weightTime: exercise.weightTime,
      notes: exercise.notes
    };
    
    // Apply modifications if they exist
    if (modification) {
      console.log(`🔄 Applying modification to ${exercise.name}`);
      if (modification.name) finalExercise.name = modification.name;
      if (modification.sets) finalExercise.sets = modification.sets;
      if (modification.reps) finalExercise.reps = modification.reps;
      if (modification.weightTime) finalExercise.weightTime = modification.weightTime;
      if (modification.notes) finalExercise.notes = modification.notes;
    }
    
    return finalExercise;
  })
})),


      // Include MetCon metadata if available
metconData: targetDay.metconData ? await enhanceMetconData(targetDay.metconData) : null,
      // Summary information
      totalExercises: targetDay.blocks.reduce((sum: number, block: any) => sum + (block.exercises?.length || 0), 0),
      totalBlocks: targetDay.blocks.length
    }

    // Apply AI modifications server-side to avoid extra client roundtrip
    try {
      const aiRes = await fetch(`${process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/modify-program-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: program.user_id, week: weekNum, day: dayNum, originalProgram: workout })
      })
      if (aiRes.ok) {
        const ai = await aiRes.json()
        if (ai?.success && ai?.program?.blocks?.length) {
          workout = ai.program
        }
      }
    } catch (e) {
      console.warn('⚠️ AI modify-program-session failed, returning original workout')
    }

    // Include completions inline to reduce client requests
    let mappedCompletions: any[] = []
    try {
      const { data: completions } = await supabase
        .from('performance_logs')
        .select('*')
        .eq('user_id', program.user_id)
        .eq('program_id', programIdNum)
        .eq('week', weekNum)
        .eq('day', dayNum)
        .order('logged_at', { ascending: true })
      mappedCompletions = (completions || []).map((log: any) => ({
        exercise_name: log.set_number > 1 ? `${log.exercise_name} - Set ${log.set_number}` : log.exercise_name,
        sets_completed: parseInt(log.sets) || 0,
        reps_completed: log.reps,
        weight_used: parseFloat(log.weight_time) || 0,
        rpe: log.rpe,
        quality: log.quality_grade,
        notes: log.result,
        was_rx: true,
        set_number: log.set_number || 1
      }))
    } catch {}

    return NextResponse.json({
      success: true,
      workout,
      completions: mappedCompletions,
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

