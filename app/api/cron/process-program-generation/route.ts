import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    // Invoke the program-generation-worker Edge Function
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/program-generation-worker`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    const result = await response.json()
    
    return NextResponse.json({ 
      success: true, 
      processed: result.processed || 0 
    })
  } catch (error) {
    console.error('Program generation worker invocation error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}


