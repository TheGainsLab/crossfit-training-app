import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CompletionData {
  programId: number
  userId: number
  week: number
  day: number
  block: string
  exerciseName: string
  setNumber?: number 
  setsCompleted?: number
  repsCompleted?: number | string  // Can be number or string like "8-10" or "AMRAP"
  weightUsed?: number
  timeCompleted?: string  // For time-based exercises like "5:30"
  caloriesCompleted?: number  // For calorie-based exercises
  distanceCompleted?: string  // For distance-based exercises
  rpe?: number  // Rate of Perceived Exertion (1-10)
  quality?: string  // Quality grade (A, B, C, D)
  notes?: string
  wasRx?: boolean  // Did they do the workout as prescribed?
  scalingUsed?: string  // What scaling modifications were used
}

// =============================================================================
// WEEKLY SUMMARY FUNCTIONS
// =============================================================================

/**
 * Update weekly summary after workout completion
 * Translates Google Apps Script logic to TypeScript/Supabase
 */
async function updateWeeklySummary(data: {
  userId: number;
  programId: number;
  week: number;
}) {
  try {
    console.log(`📊 Updating weekly summary for User ${data.userId}, Week ${data.week}`);
    
    // Step 1: Aggregate data by training block
    const blockAggregations = await aggregateByTrainingBlock(data);
    
    // Step 2: Get MetCon percentile data
    const metconData = await getMetconAggregation(data);
    
    // Step 3: Calculate overall totals
    const overallTotals = await calculateOverallTotals(data);
    
    // Step 4: Upsert into weekly_summaries
    const summaryData = {
      program_id: data.programId,
      user_id: data.userId,
      week: data.week,
      
      // Training block aggregations
      skills_completed: blockAggregations.SKILLS?.count || 0,
      skills_avg_rpe: blockAggregations.SKILLS?.avgRpe || null,
      skills_avg_quality: blockAggregations.SKILLS?.avgQuality || null,
      
      technical_completed: blockAggregations['TECHNICAL WORK']?.count || 0,
      technical_avg_rpe: blockAggregations['TECHNICAL WORK']?.avgRpe || null,
      technical_avg_quality: blockAggregations['TECHNICAL WORK']?.avgQuality || null,
      
      strength_completed: blockAggregations['STRENGTH AND POWER']?.count || 0,
      strength_avg_rpe: blockAggregations['STRENGTH AND POWER']?.avgRpe || null,
      strength_avg_quality: blockAggregations['STRENGTH AND POWER']?.avgQuality || null,
      
      accessories_completed: blockAggregations.ACCESSORIES?.count || 0,
      accessories_avg_rpe: blockAggregations.ACCESSORIES?.avgRpe || null,
      accessories_avg_quality: blockAggregations.ACCESSORIES?.avgQuality || null,
      
      metcons_completed: metconData.count,
      metcons_avg_percentile: metconData.avgPercentile,
      
      // Overall totals
      total_exercises_completed: overallTotals.totalExercises,
      overall_avg_rpe: overallTotals.avgRpe,
      overall_avg_quality: overallTotals.avgQuality,
      
      calculated_at: new Date().toISOString()
    };

    // Upsert (insert or update if exists)
    const { error } = await supabase
      .from('weekly_summaries')
      .upsert(summaryData, {
        onConflict: 'program_id,week',
        ignoreDuplicates: false
      });    

    if (error) {
      console.error('❌ Error updating weekly summary:', error);
      return;
    }
    
    console.log(`✅ Updated weekly summary: ${overallTotals.totalExercises} exercises, avg RPE ${overallTotals.avgRpe}`);
    
  } catch (error) {
    console.error('❌ Error in updateWeeklySummary:', error);
  }
}

/**
 * Aggregate performance data by training block
 */
async function aggregateByTrainingBlock(data: { userId: number; week: number }) {
  const { data: performanceData, error } = await supabase
    .from('performance_logs')
    .select('block, rpe, completion_quality')
    .eq('user_id', data.userId)
    .eq('week', data.week);
    
  if (error) {
    console.error('❌ Error fetching performance data:', error);
    return {};
  }
  
  const aggregations: Record<string, any> = {};
  
  // Group by block and calculate averages
  performanceData?.forEach((entry: any) => {
    const block = entry.block;
    
    if (!aggregations[block]) {
      aggregations[block] = {
        count: 0,
        totalRpe: 0,
        totalQuality: 0
      };
    }
    
    aggregations[block].count++;
    aggregations[block].totalRpe += entry.rpe || 0;
    aggregations[block].totalQuality += entry.completion_quality || 0;
  });
  
  // Calculate averages
  Object.keys(aggregations).forEach(block => {
    const blockData = aggregations[block];
    aggregations[block] = {
      count: blockData.count,
      avgRpe: blockData.count > 0 ? Math.round((blockData.totalRpe / blockData.count) * 10) / 10 : null,
      avgQuality: blockData.count > 0 ? Math.round((blockData.totalQuality / blockData.count) * 10) / 10 : null
    };
  });
  
  return aggregations;
}

/**
 * Get MetCon aggregation data - FIXED VERSION
 * Counts actual MetCon completions, not just program_metcons entries
 */
async function getMetconAggregation(data: { programId: number; week: number }) {
  // First, try to get from program_metcons (new method with actual scores)
  const { data: metconData, error } = await supabase
    .from('program_metcons')
    .select('percentile')
    .eq('program_id', data.programId)
    .eq('week', data.week)
    .not('user_score', 'is', null);
    
  // If we have data from program_metcons, use it
  if (!error && metconData && metconData.length > 0) {
    const percentiles = metconData.map((m: any) => parseFloat(m.percentile)).filter(p => !isNaN(p));
    const avgPercentile = percentiles.length > 0 
      ? Math.round((percentiles.reduce((sum, p) => sum + p, 0) / percentiles.length) * 100) / 100
      : null;
      
    return {
      count: percentiles.length, // Count of actual MetCon completions with scores
      avgPercentile
    };
  }
  
  // Fallback: Count distinct MetCon sessions from performance_logs
  console.log(`⚠️ No program_metcons data found for program ${data.programId}, week ${data.week}. Using performance_logs fallback.`);
  
  const { data: performanceData, error: perfError } = await supabase
    .from('performance_logs')
    .select('day, logged_at')
    .eq('program_id', data.programId)
    .eq('week', data.week)
    .eq('block', 'METCONS');
    
  if (perfError || !performanceData || performanceData.length === 0) {
    console.log(`⚠️ No MetCon performance data found for program ${data.programId}, week ${data.week}`);
    return { count: 0, avgPercentile: null };
  }
  
  // Count unique days with MetCon exercises
  const uniqueDays = new Set(performanceData.map(p => p.day));
  const sessionCount = uniqueDays.size;
  
  console.log(`📊 Found ${sessionCount} MetCon sessions (days: ${Array.from(uniqueDays).join(', ')}) for program ${data.programId}, week ${data.week}`);
  
  return {
    count: sessionCount, // Count of distinct MetCon session days
    avgPercentile: null   // No percentile data available from performance_logs
  };
}



/**
 * Calculate overall totals across all blocks
 */
async function calculateOverallTotals(data: { userId: number; week: number }) {
  const { data: performanceData, error } = await supabase
    .from('performance_logs')
    .select('rpe, completion_quality')
    .eq('user_id', data.userId)
    .eq('week', data.week);
    
  if (error || !performanceData?.length) {
    return { totalExercises: 0, avgRpe: null, avgQuality: null };
  }
  
  const totalExercises = performanceData.length;
  const validRpe = performanceData.filter((p: any) => p.rpe).map((p: any) => p.rpe);
  const validQuality = performanceData.filter((p: any) => p.completion_quality).map((p: any) => p.completion_quality);
  
  const avgRpe = validRpe.length > 0 
    ? Math.round((validRpe.reduce((sum: number, rpe: number) => sum + rpe, 0) / validRpe.length) * 10) / 10
    : null;
    
  const avgQuality = validQuality.length > 0
    ? Math.round((validQuality.reduce((sum: number, q: number) => sum + q, 0) / validQuality.length) * 10) / 10
    : null;
    
  return { totalExercises, avgRpe, avgQuality };
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    console.log('📝 Exercise completion logging called')
    
    const body = await request.json()
    const completionData: CompletionData = body

    console.log('📥 API received request body:', JSON.stringify(body, null, 2))
    console.log('🔍 Parsed completionData:', {
      exerciseName: completionData.exerciseName,
      setNumber: completionData.setNumber,
      setsCompleted: completionData.setsCompleted,
      setsCompletedType: typeof completionData.setsCompleted,
      repsCompleted: completionData.repsCompleted,
      repsCompletedType: typeof completionData.repsCompleted,
      weightUsed: completionData.weightUsed,
      weightUsedType: typeof completionData.weightUsed,
      rpe: completionData.rpe,
      quality: completionData.quality,
      wasRx: completionData.wasRx
    })

    // Validate required fields
    if (!completionData.programId || !completionData.userId || 
        !completionData.week || !completionData.day || 
        !completionData.block || !completionData.exerciseName) {
      return NextResponse.json(
        { error: 'Missing required fields: programId, userId, week, day, block, exerciseName' },
        { status: 400 }
      )
    }

    // Validate numeric ranges
    if (completionData.week < 1 || completionData.week > 12) {
      return NextResponse.json(
        { error: 'Week must be between 1 and 12' },
        { status: 400 }
      )
    }

    if (completionData.day < 1 || completionData.day > 5) {
      return NextResponse.json(
        { error: 'Day must be between 1 and 5' },
        { status: 400 }
      )
    }

    if (completionData.rpe && (completionData.rpe < 1 || completionData.rpe > 10)) {
      return NextResponse.json(
        { error: 'RPE must be between 1 and 10' },
        { status: 400 }
      )
    }

    if (completionData.quality && !['A', 'B', 'C', 'D'].includes(completionData.quality)) {
      return NextResponse.json(
        { error: 'Quality must be A, B, C, or D' },
        { status: 400 }
      )
    }

    console.log(`📊 Logging completion: ${completionData.exerciseName} - Week ${completionData.week}, Day ${completionData.day}`)

    // Check if this exact completion already exists (prevent duplicates)
    const { data: existingCompletion } = await supabase
      .from('workout_completions')
      .select('id')
      .eq('user_id', completionData.userId)
      .eq('program_id', completionData.programId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)
      .eq('block', completionData.block)
      .eq('exercise_name', completionData.exerciseName)
      .eq('set_number', completionData.setNumber || 1)
      .single()

    let result
    if (existingCompletion) {
      // Update existing completion
      console.log('🔄 Updating existing completion...')
      const { data, error } = await supabase
        .from('workout_completions')
        .update({
          set_number: completionData.setNumber || 1,
          sets_completed: completionData.setsCompleted,
          reps_completed: completionData.repsCompleted?.toString(),
          weight_used: completionData.weightUsed,
          time_completed: completionData.timeCompleted,
          calories_completed: completionData.caloriesCompleted,
          distance_completed: completionData.distanceCompleted,
          rpe: completionData.rpe,
          notes: completionData.notes,
          was_rx: completionData.wasRx,
          scaling_used: completionData.scalingUsed,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCompletion.id)
        .select()
        .single()

      result = { data, error }
    } else {
      // Create new completion
      console.log('✨ Creating new completion...')
      const { data, error } = await supabase
        .from('workout_completions')
        .insert({
          user_id: completionData.userId,
          program_id: completionData.programId,
          week: completionData.week,
          day: completionData.day,
          block: completionData.block,
          exercise_name: completionData.exerciseName,
          set_number: completionData.setNumber || 1,
          sets_completed: completionData.setsCompleted,
          reps_completed: completionData.repsCompleted?.toString(),
          weight_used: completionData.weightUsed,
          time_completed: completionData.timeCompleted,
          calories_completed: completionData.caloriesCompleted,
          distance_completed: completionData.distanceCompleted,
          rpe: completionData.rpe,
          notes: completionData.notes,
          was_rx: completionData.wasRx,
          scaling_used: completionData.scalingUsed,
          completed_at: new Date().toISOString()
        })
        .select()
        .single()

      result = { data, error }
    }

    if (result.error) {
      console.error('❌ Failed to save completion:', result.error)
      return NextResponse.json(
        { error: 'Failed to save workout completion', details: result.error.message },
        { status: 500 }
      )
    }

    // Also log to performance_logs for analytics (including quality grade)
    console.log('📊 Logging to performance_logs for analytics...')
    
    // First, try to find the program_workout_id
    const { data: programWorkout } = await supabase
      .from('program_workouts')
      .select('id')
      .eq('program_id', completionData.programId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)
      .eq('exercise_name', completionData.exerciseName)
      .eq('block', completionData.block)
      .single()

    // Check if performance log already exists
    const { data: existingPerfLog } = await supabase
      .from('performance_logs')
      .select('id')
      .eq('program_id', completionData.programId)
      .eq('user_id', completionData.userId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)
      .eq('exercise_name', completionData.exerciseName)
      .eq('set_number', completionData.setNumber || 1)
      .single()

    // Convert quality letter grade to numeric if needed
    const qualityNumeric = completionData.quality ? 
      { 'A': 4, 'B': 3, 'C': 2, 'D': 1 }[completionData.quality] : null

    // Build perfLogData, only including fields that have values (don't overwrite with null)
    const perfLogData: any = {
      program_id: completionData.programId,
      user_id: completionData.userId,
      program_workout_id: programWorkout?.id,
      week: completionData.week,
      day: completionData.day,
      block: completionData.block,
      exercise_name: completionData.exerciseName,
      set_number: completionData.setNumber || 1,
      rpe: completionData.rpe,
      completion_quality: qualityNumeric,
      quality_grade: completionData.quality,
      logged_at: new Date().toISOString()
    }

    // Only include sets/reps/weight_time if they have values (don't overwrite with null)
    if (completionData.setsCompleted !== undefined && completionData.setsCompleted !== null) {
      perfLogData.sets = completionData.setsCompleted.toString()
    }
    if (completionData.repsCompleted !== undefined && completionData.repsCompleted !== null && completionData.repsCompleted.toString().trim() !== '') {
      perfLogData.reps = completionData.repsCompleted.toString()
    }
    if (completionData.weightUsed !== undefined && completionData.weightUsed !== null) {
      perfLogData.weight_time = completionData.weightUsed.toString()
    }
    if (completionData.notes !== undefined && completionData.notes !== null) {
      perfLogData.result = completionData.notes
    }
    // Include new fields for complete data tracking
    if (completionData.wasRx !== undefined) {
      perfLogData.was_rx = completionData.wasRx
    }
    if (completionData.scalingUsed !== undefined && completionData.scalingUsed !== null) {
      perfLogData.scaling_used = completionData.scalingUsed
    }
    if (completionData.caloriesCompleted !== undefined && completionData.caloriesCompleted !== null) {
      perfLogData.calories_completed = completionData.caloriesCompleted
    }
    if (completionData.distanceCompleted !== undefined && completionData.distanceCompleted !== null) {
      perfLogData.distance_completed = completionData.distanceCompleted
    }
    if (completionData.timeCompleted !== undefined && completionData.timeCompleted !== null) {
      perfLogData.time_completed = completionData.timeCompleted
    }
    
    console.log('💾 Saving to performance_logs:', {
      exercise_name: perfLogData.exercise_name,
      set_number: perfLogData.set_number,
      sets: perfLogData.sets,
      setsSource: completionData.setsCompleted,
      reps: perfLogData.reps,
      repsSource: completionData.repsCompleted,
      weight_time: perfLogData.weight_time,
      weightSource: completionData.weightUsed,
      rpe: perfLogData.rpe,
      completion_quality: perfLogData.completion_quality,
      quality_grade: perfLogData.quality_grade,
      was_rx: perfLogData.was_rx,
      scaling_used: perfLogData.scaling_used,
      calories_completed: perfLogData.calories_completed,
      distance_completed: perfLogData.distance_completed,
      time_completed: perfLogData.time_completed
    })

    let savedLogId: number | null = null
    if (existingPerfLog) {
      // Update existing performance log
      const { data: updatedLog, error: updateError } = await supabase
        .from('performance_logs')
        .update(perfLogData)
        .eq('id', existingPerfLog.id)
        .select()
        .single()
      
      if (updateError) {
        console.error('❌ Error updating performance log:', updateError)
      } else {
        savedLogId = updatedLog?.id || existingPerfLog.id
        console.log('✅ Updated existing performance log:', {
          id: savedLogId,
          sets: updatedLog?.sets,
          reps: updatedLog?.reps,
          weight_time: updatedLog?.weight_time
        })
      }
    } else {
      // Create new performance log
      const { data: insertedLog, error: insertError } = await supabase
        .from('performance_logs')
        .insert(perfLogData)
        .select()
        .single()
      
      if (insertError) {
        console.error('❌ Error inserting performance log:', insertError)
      } else {
        savedLogId = insertedLog?.id || null
        console.log('✅ Created new performance log:', {
          id: savedLogId,
          sets: insertedLog?.sets,
          reps: insertedLog?.reps,
          weight_time: insertedLog?.weight_time
        })
      }
    }

    // Verify what was actually saved
    if (savedLogId) {
      const { data: verifiedLog } = await supabase
        .from('performance_logs')
        .select('*')
        .eq('id', savedLogId)
        .single()
      
      console.log('🔍 Verified saved log in database:', {
        id: verifiedLog?.id,
        exercise_name: verifiedLog?.exercise_name,
        set_number: verifiedLog?.set_number,
        sets: verifiedLog?.sets,
        reps: verifiedLog?.reps,
        weight_time: verifiedLog?.weight_time,
        rpe: verifiedLog?.rpe
      })
    }

    console.log('✅ Workout completion saved successfully')
    // Revalidate analytics caches (global and domain tabs)
    try {
      revalidateTag(`global-analytics:${completionData.userId}`)
      revalidateTag(`skills-analytics:${completionData.userId}`)
      revalidateTag(`strength-analytics:${completionData.userId}`)
      revalidateTag(`metcons-analytics:${completionData.userId}`)
    } catch {}

    // Update weekly summary after successful completion
    try {
      await updateWeeklySummary({
        userId: completionData.userId,
        programId: completionData.programId,
        week: completionData.week
      });
    } catch (summaryError) {
      console.error('❌ Error updating weekly summary (non-blocking):', summaryError);
      // Don't fail the entire request if weekly summary update fails
    }

    // Get completion stats for this workout session
    const { data: sessionStats } = await supabase
      .from('workout_completions')
      .select('exercise_name')
      .eq('user_id', completionData.userId)
      .eq('program_id', completionData.programId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)

    const completedExercises = sessionStats?.length || 0

    return NextResponse.json({
      success: true,
      completion: result.data,
      sessionStats: {
        completedExercises,
        week: completionData.week,
        day: completionData.day,
        block: completionData.block
      },
      message: existingCompletion ? 'Workout completion updated successfully' : 'Workout completion logged successfully'
    })

  } catch (error) {
    console.error('❌ Unexpected error logging workout completion:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve completions for a specific workout day
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const programId = searchParams.get('programId')
    const week = searchParams.get('week')
    const day = searchParams.get('day')

    if (!userId || !programId || !week || !day) {
      return NextResponse.json(
        { error: 'Missing required query parameters: userId, programId, week, day' },
        { status: 400 }
      )
    }

    console.log(`📊 Fetching completions for User ${userId}, Program ${programId}, Week ${week}, Day ${day}`)

    const { data: completions, error } = await supabase
.from('performance_logs')
      .select('*')
      .eq('user_id', parseInt(userId))
      .eq('program_id', parseInt(programId))
      .eq('week', parseInt(week))
      .eq('day', parseInt(day))
      
.order('logged_at', { ascending: true })
// ADD THESE LINES HERE:
console.log('🔍 Raw performance_logs query result:')
console.log('Count:', completions?.length || 0)
console.log('Data:', completions)   



 if (error) {
      console.error('❌ Failed to fetch completions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch workout completions', details: error.message },
        { status: 500 }
      )
    }



// Map performance_logs data to completion format

const mappedCompletions = completions?.map(log => ({
  exercise_name: log.set_number > 1 ? `${log.exercise_name} - Set ${log.set_number}` : log.exercise_name,
  sets_completed: parseInt(log.sets) || 0,
  reps_completed: log.reps,
  weight_used: parseFloat(log.weight_time) || 0,
  rpe: log.rpe,
  quality: log.quality_grade,
  notes: log.result,
  was_rx: log.was_rx ?? true,
  scaling_used: log.scaling_used || null,
  calories_completed: log.calories_completed || null,
  distance_completed: log.distance_completed || null,
  time_completed: log.time_completed || null
})) || []

return NextResponse.json({
  success: true,
  completions: mappedCompletions,
  totalCompleted: mappedCompletions.length
})




  } catch (error) {
    console.error('❌ Unexpected error fetching completions:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
