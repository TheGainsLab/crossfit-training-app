// app/api/ai/estimate-calories/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAITrainingAssistantForUser } from '@/lib/ai/ai-training-service'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export async function OPTIONS() {
  return new NextResponse('ok', { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const { userId, programId, week, day } = await request.json()

    const authHeader = request.headers.get('authorization') || ''
    const userToken = authHeader.replace(/^Bearer\s+/i, '')
    if (!userToken) {
      return NextResponse.json({ success: false, error: 'Missing Authorization header' }, { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500, headers: corsHeaders })
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: `Bearer ${userToken}` } } })

    // Fetch user profile for weight/age/gender
    const { data: userData } = await supabase
      .from('users')
      .select('body_weight, height, age, gender, units')
      .eq('id', userId)
      .single()

    // Fetch workout structure
    let workoutSummary = 'Workout details not available'
    try {
      // Get the base URL for internal API calls
      const origin = request.headers.get('origin') || request.headers.get('host')
      const protocol = request.headers.get('x-forwarded-proto') || (origin?.includes('localhost') ? 'http' : 'https')
      const baseUrl = origin 
        ? `${protocol}://${origin}`
        : (process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : 'http://localhost:3000')
      
      const workoutRes = await fetch(`${baseUrl}/api/workouts/${programId}/week/${week}/day/${day}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (workoutRes.ok) {
        const workoutData = await workoutRes.json()
        if (workoutData.success && workoutData.workout) {
          const workout = workoutData.workout
          const blocks = workout.blocks || []
          
          // Build workout summary
          const blockSummaries = blocks.map((block: any, idx: number) => {
            const exercises = block.exercises || []
            const exerciseList = exercises.map((ex: any) => {
              const sets = ex.sets || '-'
              const reps = ex.reps || '-'
              const weight = ex.weightTime || ''
              return `  - ${ex.name}: ${sets} sets × ${reps} reps${weight ? ` @ ${weight}` : ''}`
            }).join('\n')
            return `Block ${idx + 1} (${block.type || 'Training'}):\n${exerciseList}`
          }).join('\n\n')
          
          const totalExercises = blocks.reduce((sum: number, b: any) => sum + (Array.isArray(b.exercises) ? b.exercises.length : 0), 0)
          workoutSummary = `Today's Workout Structure:\n${blockSummaries}\n\nTotal Blocks: ${blocks.length}\nTotal Exercises: ${totalExercises}`
        }
      }
    } catch (workoutError) {
      console.error('Error fetching workout for calorie estimation:', workoutError)
      // Continue with workoutSummary = 'Workout details not available'
    }

    // Build user context
    const userContext = userData ? `User Profile: ${userData.age} years old, ${userData.gender}, ${userData.body_weight}${userData.units?.includes('kg') ? 'kg' : 'lbs'}` : 'User profile not available'

    const ai = createAITrainingAssistantForUser(supabase as any)

    const prompt = `Estimate how many calories I burned during this workout. 

${userContext}

${workoutSummary}

Based on the workout structure above, estimate calories burned. Consider:
- Exercise types and intensity
- Total volume (sets × reps × weight)
- Estimated workout duration (typical CrossFit sessions: 15-60 minutes)
- User's body weight and metabolic rate

Respond strictly in this exact format with integers only: 
LOW: <int> kcal
HIGH: <int> kcal

Provide a narrow, realistic range. Typical CrossFit sessions burn 200-800 kcal. Do not return values below 100 kcal or above 1500 kcal. The range should be no more than 300 kcal wide (e.g., 350-550 kcal, not 100-2000 kcal).`

    const result = await ai.generateResponse({
      userQuestion: prompt,
      userId: Number(userId),
      conversationHistory: [],
      userContext: undefined,
    })

    const raw = result.response || ''
    // Parse LOW/HIGH integers
    const kcalMatches = Array.from(raw.matchAll(/(\d+)[\s-]*(kcal|calories?)/gi)).map((m) => parseInt(m[1], 10))
    const allNums = (raw.match(/\d+/g) || []).map((n) => parseInt(n, 10))

    let low: number | null = null
    let high: number | null = null
    if (kcalMatches.length >= 2) {
      const a = kcalMatches[0]
      const b = kcalMatches[1]
      low = Math.min(a, b)
      high = Math.max(a, b)
    } else if (allNums.length >= 2) {
      const sorted = [...allNums].sort((a, b) => b - a)
      high = sorted[0]
      low = sorted[1]
    }

    if (low != null && high != null) {
      low = Math.max(100, Math.round(low))
      high = Math.max(low + 1, Math.round(high))
      // Enforce tighter constraints
      if (high > 1500) high = 1500
      if (high - low > 300) {
        // If range is too wide, narrow it to ±150 around the average
        const avg = Math.round((low + high) / 2)
        low = Math.max(100, avg - 150)
        high = Math.min(1500, avg + 150)
      }
      const average = Math.round((low + high) / 2)
      return NextResponse.json({ success: true, low, high, average, raw }, { headers: corsHeaders })
    }

    return NextResponse.json({ success: true, low: null, high: null, average: null, raw }, { headers: corsHeaders })
  } catch (error) {
    console.error('Estimate calories API error:', error)
    const msg = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: msg }, { status: 500, headers: corsHeaders })
  }
}

