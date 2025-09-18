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

    // Short conversation context is not required; the prompt encodes constraints.
    const ai = createAITrainingAssistantForUser(supabase as any)

    const prompt = `Estimate how many calories I burned today. Respond strictly in this exact format with integers only: LOW: <int> kcal NEWLINE HIGH: <int> kcal. Use my profile (age, gender, weight), today's program context (program_id=${programId}, week=${week}, day=${day}), recent performance logs, and typical CrossFit session demands. Typical sessions are roughly 200–1000 kcal. Do not return values below 100 kcal.`

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
      if (high > 2000) high = 2000
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

