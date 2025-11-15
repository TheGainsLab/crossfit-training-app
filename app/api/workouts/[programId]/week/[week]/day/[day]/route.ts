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

    // Check cache before calling Edge Function
    console.log(`🔍 Checking cache for workout: user ${program.user_id}, program ${programIdNum}, week ${weekNum}, day ${dayNum}`)
    const { data: cachedMod, error: cacheError } = await supabase
      .from('modified_workouts')
      .select('modified_program, modifications_applied, created_at')
      .eq('user_id', program.user_id)
      .eq('program_id', programIdNum)
      .eq('week', weekNum)
      .eq('day', dayNum)
      .single()

    if (cacheError && cacheError.code !== 'PGRST116') {
      console.warn(`⚠️ Cache check error:`, cacheError)
    }
    console.log(`📦 Cache result:`, cachedMod ? `FOUND (created ${cachedMod.created_at})` : 'NOT FOUND')

    // Apply AI modifications server-side to avoid extra client roundtrip
    try {
      console.log(`🚀 Calling Edge Function modify-program-session`)
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
        console.log(`📥 Edge Function response:`, {
          success: ai?.success,
          hasProgram: !!ai?.program,
          blockCount: ai?.program?.blocks?.length,
          source: ai?.source,
          modificationsAppliedCount: ai?.modificationsApplied?.length || 0
        })
        if (ai?.success && ai?.program?.blocks?.length) {
          // Merge AI modifications with original workout structure
          // This preserves week, day, programId, and ensures exercises maintain proper structure
          workout = {
            ...workout, // Preserve all original properties (week, day, programId, dayName, mainLift, isDeload, userGender, etc.)
            blocks: workout.blocks.map((originalBlock: any, blockIndex: number) => {
              const aiBlock = ai.program.blocks[blockIndex]
              if (!aiBlock) return originalBlock // Fallback to original if AI block missing
              
              // For each block, merge exercises carefully to preserve set structure
              return {
                ...originalBlock, // Preserve blockName and other properties
                exercises: aiBlock.exercises && Array.isArray(aiBlock.exercises) && aiBlock.exercises.length > 0
                  ? (() => {
                      // Block-specific validation
                      if (originalBlock.blockName === 'STRENGTH AND POWER') {
                        // STRENGTH AND POWER: Exercise count can change (volume modification), but each must have sets: 1
                        // No strict count check here - allow volume changes
                      } else if (['SKILLS', 'TECHNICAL WORK', 'ACCESSORIES'].includes(originalBlock.blockName)) {
                        // SKILLS, TECHNICAL WORK, ACCESSORIES: Task count must match (cannot remove tasks)
                        if (aiBlock.exercises.length !== originalBlock.exercises.length) {
                          console.warn(`⚠️ AI returned ${aiBlock.exercises.length} tasks but original had ${originalBlock.exercises.length} for ${originalBlock.blockName} block, using original structure`)
                          return originalBlock.exercises
                        }
                      } else if (originalBlock.blockName === 'METCONS') {
                        // METCONS: No modifications allowed - return original
                        console.warn(`⚠️ AI attempted to modify METCONS block, using original structure`)
                        return originalBlock.exercises
                      }
                      
                      // Map exercises with validation
                      return aiBlock.exercises.map((aiExercise: any, exIndex: number) => {
                        // Validate AI exercise structure - ensure reps is not concatenated
                        const originalExercise = originalBlock.exercises[exIndex]
                        if (originalExercise) {
                          // STRENGTH AND POWER block validation
                          if (originalBlock.blockName === 'STRENGTH AND POWER') {
                            // 1. Sets must always be 1 for strength exercises
                            if (aiExercise.sets !== 1 && aiExercise.sets !== undefined) {
                              console.warn(`⚠️ AI returned strength exercise with sets !== 1 (${aiExercise.sets}) for ${aiExercise.name}, using original structure`)
                              return originalExercise
                            }
                            
                            // 2. Reps must be a valid number between 2-20
                            const repsNum = typeof aiExercise.reps === 'string' 
                              ? parseInt(aiExercise.reps) 
                              : aiExercise.reps
                            
                            if (isNaN(repsNum) || repsNum < 2 || repsNum > 20) {
                              console.warn(`⚠️ AI returned invalid reps "${aiExercise.reps}" (must be 2-20) for ${aiExercise.name}, using original structure`)
                              return originalExercise
                            }
                            
                            // 3. Check for concatenated reps (e.g., "654" = 654, which is > 20)
                            if (typeof aiExercise.reps === 'string' && aiExercise.reps.length > 2) {
                              // If it's a string longer than 2 chars, it's likely concatenated (e.g., "654")
                              const parsed = parseInt(aiExercise.reps)
                              if (!isNaN(parsed) && parsed > 20) {
                                console.warn(`⚠️ AI returned concatenated reps "${aiExercise.reps}" for ${aiExercise.name}, using original structure`)
                                return originalExercise
                              }
                            }
                            
                            // 4. Weight validation - string length > 4 OR numeric value > 1000 = likely concatenated
                            // 5. Weight cannot exceed original max weight
                            if (aiExercise.weightTime && typeof aiExercise.weightTime === 'string') {
                              const weightNum = parseFloat(aiExercise.weightTime)
                              // If string is longer than 4 chars OR value > 1000, it's likely concatenated
                              // (Allows "1000" = 4 chars, but catches "180185190" = 9 chars)
                              if (aiExercise.weightTime.length > 4 || (!isNaN(weightNum) && weightNum > 1000)) {
                                console.warn(`⚠️ AI returned malformed weight "${aiExercise.weightTime}" (length ${aiExercise.weightTime.length}, value ${weightNum}) for ${aiExercise.name}, using original structure`)
                                return originalExercise
                              }
                              
                              // Check if weight exceeds original max weight for this exercise
                              const originalWeights = originalBlock.exercises
                                .filter((ex: any) => ex.name === aiExercise.name && ex.weightTime)
                                .map((ex: any) => parseFloat(ex.weightTime) || 0)
                              const maxOriginalWeight = originalWeights.length > 0 ? Math.max(...originalWeights) : Infinity
                              
                              if (!isNaN(weightNum) && weightNum > maxOriginalWeight) {
                                console.warn(`⚠️ AI returned weight "${aiExercise.weightTime}" (${weightNum}) exceeding original max weight ${maxOriginalWeight} for ${aiExercise.name}, using original structure`)
                                return originalExercise
                              }
                            }
                          }
                          
                          // Block-specific validation for SKILLS, TECHNICAL WORK, ACCESSORIES
                          if (['SKILLS', 'TECHNICAL WORK', 'ACCESSORIES'].includes(originalBlock.blockName)) {
                            // Sets must be between 1-3
                            const setsNum = typeof aiExercise.sets === 'string' 
                              ? parseInt(aiExercise.sets) 
                              : aiExercise.sets
                            
                            if (isNaN(setsNum) || setsNum < 1 || setsNum > 3) {
                              console.warn(`⚠️ AI returned invalid sets "${aiExercise.sets}" (must be 1-3) for ${aiExercise.name} in ${originalBlock.blockName}, using original structure`)
                              return originalExercise
                            }
                          }
                          
                          // General validation for all blocks
                          // Check for concatenated reps (e.g., "642" instead of separate exercises)
                          if (typeof aiExercise.reps === 'string' && aiExercise.reps.length > 3) {
                            // Likely concatenated reps - use original structure
                            console.warn(`⚠️ AI returned malformed reps "${aiExercise.reps}" for ${aiExercise.name}, using original structure`)
                            return originalExercise
                          }
                          
                          // Check if AI exercise is missing critical properties
                          if (!aiExercise.name || !aiExercise.hasOwnProperty('sets') || !aiExercise.hasOwnProperty('reps')) {
                            console.warn(`⚠️ AI exercise missing properties for ${aiExercise.name || 'unknown'}, using original structure`)
                            return originalExercise
                          }
                          
                          // Preserve weightTime from original if AI version is missing it
                          // This allows AI to modify weights when it provides them, but prevents weight loss when AI omits weightTime
                          if (originalExercise.weightTime && !aiExercise.weightTime) {
                            console.warn(`⚠️ AI exercise missing weightTime for ${aiExercise.name}, preserving from original`)
                            aiExercise.weightTime = originalExercise.weightTime
                          }
                        }
                        return aiExercise
                      })
                    })()
                  : originalBlock.exercises // Fallback to original exercises if AI exercises are invalid
              }
            }),
            ...(ai.program.metconData && { metconData: ai.program.metconData }),
            ...(ai.source && { source: ai.source }),
            ...(ai.rationale && { rationale: ai.rationale })
          }
          console.log(`✅ Workout merged:`, {
            totalBlocks: workout.blocks.length,
            totalExercises: workout.blocks.reduce((sum: number, b: any) => sum + (b.exercises?.length || 0), 0),
            hasMetconData: !!workout.metconData,
            source: (workout as any).source || 'original'
          })
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
        exercise_name: log.exercise_name, // Return clean name - frontend will add "- Set X" suffix when creating keys
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

