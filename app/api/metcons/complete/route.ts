import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface MetConCompletionData {
  programId: number
  userId: number
  week: number
  day: number
  workoutScore: string
  metconId?: number
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    const completionData: MetConCompletionData = await request.json()
    
    console.log('🔥 MetCon completion request:', completionData)

    // 1. Find the metcon workout for this week/day
    // For now, we'll use a placeholder metcon_id since we need to figure out 
    // how to map week/day to specific metcons
    const metconId = completionData.metconId || 1 // TODO: Fix this mapping

    // 2. Get the metcon benchmarks for percentile calculation
    const { data: metcon, error: metconError } = await supabase
      .from('metcons')
      .select('male_p50, male_p90, female_p50, female_p90, workout_id')
      .eq('id', metconId)
      .single()

    if (metconError) {
      console.error('❌ Error fetching metcon:', metconError)
      return NextResponse.json({ success: false, error: 'Metcon not found' }, { status: 404 })
    }

    // 3. Calculate percentile (simplified - assumes male for now)
    const userScore = parseFloat(completionData.workoutScore.replace(':', '.')) // Convert "8:19" to 8.19
    const medianScore = parseFloat(metcon.male_p50 || '8.5')
    const excellentScore = parseFloat(metcon.male_p90 || '7.5')
    
    // Simple percentile calculation (this is a placeholder - real calculation would be more complex)
    let percentile = 50 // Default to median
    if (userScore <= excellentScore) {
      percentile = 90
    } else if (userScore <= medianScore) {
      percentile = 70
    } else {
      percentile = 30
    }

    // 4. Determine performance tier
    let performanceTier = 'Average'
    if (percentile >= 90) performanceTier = 'Excellent'
    else if (percentile >= 70) performanceTier = 'Good'
    else if (percentile >= 30) performanceTier = 'Average'
    else performanceTier = 'Needs Work'

    // 5. Check if completion already exists
    const { data: existingCompletion } = await supabase
      .from('program_metcons')
      .select('id')
      .eq('program_id', completionData.programId)
      .eq('week', completionData.week)
      .eq('day', completionData.day)
      .single()

    let result
    if (existingCompletion) {
      // Update existing completion
      const { data, error } = await supabase
        .from('program_metcons')
        .update({
          user_score: completionData.workoutScore,
          percentile: percentile,
          performance_tier: performanceTier,
          completed_at: new Date().toISOString()
        })
        .eq('id', existingCompletion.id)
        .select()
        .single()

      result = { data, error }
    } else {
      // Create new completion
      const { data, error } = await supabase
        .from('program_metcons')
        .insert({
          program_id: completionData.programId,
          week: completionData.week,
          day: completionData.day,
          metcon_id: metconId,
          user_score: completionData.workoutScore,
          percentile: percentile,
          performance_tier: performanceTier,
          excellent_score: metcon.male_p90,
          median_score: metcon.male_p50,
          completed_at: new Date().toISOString()
        })
        .select()
        .single()

      result = { data, error }
    }

    if (result.error) {
      console.error('❌ Error saving MetCon completion:', result.error)
      return NextResponse.json({ success: false, error: result.error.message }, { status: 500 })
    }

    console.log('✅ MetCon completion saved:', result.data)

    return NextResponse.json({ 
      success: true, 
      data: result.data,
      percentile: percentile,
      performanceTier: performanceTier
    })

  } catch (error) {
    console.error('❌ MetCon completion error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
