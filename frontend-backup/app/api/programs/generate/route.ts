import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('🏋️ Program generation API called')
    
    // Parse the request body
    const body = await request.json()
    const { namedValues, weeksToGenerate = [1, 2, 3, 4], userId } = body

    // Validate required fields
    if (!namedValues) {
      return NextResponse.json(
        { error: 'Missing namedValues in request body' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId in request body' },
        { status: 400 }
      )
    }


console.log(`📝 Generating program for user ${userId}, weeks: ${weeksToGenerate.join(', ')}`)

// Add this debug logging
console.log('🔍 Request body being sent to edge function:', JSON.stringify({
  namedValues,
  weeksToGenerate
}, null, 2))

const { data: programData, error: generationError } = await supabase.functions.invoke('generate-program', {
  body: {
    namedValues,
    weeksToGenerate
  }
})

// Add this too
console.log('🔍 Edge function response:', { programData, error: generationError })

    if (generationError) {
      console.error('❌ Program generation failed:', generationError)
      return NextResponse.json(
        { error: 'Failed to generate program', details: generationError.message },
        { status: 500 }
      )
    }

    if (!programData?.success) {
      console.error('❌ Program generation returned unsuccessful result')
      return NextResponse.json(
        { error: 'Program generation was not successful' },
        { status: 500 }
      )
    }

    console.log('✅ Program generated successfully, saving to database...')

// Store the generated program in the database
    const { data: storedProgram, error: storageError } = await supabase
      .from('programs')
.insert({
        user_id: userId,
        program_number: 1, // Default to program #1 for this user
        program_data: programData.program,
        weeks_generated: weeksToGenerate,
        user_snapshot: programData.program.metadata?.userSnapshot || {},
        ratio_snapshot: programData.program.metadata?.ratioSnapshot || {},
        sport_id: 1, // CrossFit
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()




    if (storageError) {
      console.error('❌ Failed to store program:', storageError)
      return NextResponse.json(
        { error: 'Failed to store program', details: storageError.message },
        { status: 500 }
      )
    }

    console.log(`✅ Program stored successfully with ID: ${storedProgram.id}`)

    // Return success response with program ID and metadata
    return NextResponse.json({
      success: true,
      programId: storedProgram.id,
      weeksGenerated: weeksToGenerate,
      totalExercises: programData.program.totalExercises,
      generatedAt: storedProgram.created_at,
      message: 'Program generated and stored successfully'
    })

  } catch (error) {
    console.error('❌ Unexpected error in program generation:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
