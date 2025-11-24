import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// FatSecret token cache (in-memory)
let cachedToken: { access_token: string; expires_at: number } | null = null

async function getFatSecretToken(): Promise<string | null> {
  const clientId = Deno.env.get('FATSECRET_CLIENT_ID')
  const clientSecret = Deno.env.get('FATSECRET_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    console.error('FatSecret credentials not configured')
    return null
  }

  // Check cached token (refresh 1 hour before expiry)
  if (cachedToken && cachedToken.expires_at > Date.now() + 3600000) {
    return cachedToken.access_token
  }

  try {
    const authString = btoa(`${clientId}:${clientSecret}`)
    
    const response = await fetch('https://oauth.fatsecret.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authString}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'premier',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('FatSecret OAuth error:', response.status, errorText)
      return null
    }

    const tokenData = await response.json()
    cachedToken = {
      access_token: tokenData.access_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000),
    }

    return cachedToken.access_token
  } catch (error) {
    console.error('Failed to get FatSecret token:', error)
    return null
  }
}

async function callFatSecretAPI(method: string, params: Record<string, string | number>): Promise<any> {
  const accessToken = await getFatSecretToken()
  if (!accessToken) {
    throw new Error('Failed to obtain FatSecret access token')
  }

  const queryParams = new URLSearchParams({
    method,
    format: 'json',
    ...Object.entries(params).reduce((acc, [key, value]) => {
      acc[key] = String(value)
      return acc
    }, {} as Record<string, string>),
  })

  const response = await fetch(
    `https://platform.fatsecret.com/rest/server.api?${queryParams.toString()}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`FatSecret API error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

// Helper to normalize foods.search response (handles single vs array quirk)
function normalizeFoodsSearchResponse(response: any): {
  foods: any[]
  pagination: {
    page: number
    maxResults: number
    total: number
  }
} {
  const { foods } = response
  
  // Handle the single vs array quirk
  const foodArray = Array.isArray(foods.food) 
    ? foods.food 
    : [foods.food]
  
  return {
    foods: foodArray,
    pagination: {
      page: parseInt(foods.page_number, 10),
      maxResults: parseInt(foods.max_results, 10),
      total: parseInt(foods.total_results, 10),
    },
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user via Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user_id from users table
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!userData) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { query, pageNumber = 0, maxResults = 20 } = await req.json()

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Query parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call FatSecret API
    const result = await callFatSecretAPI('foods.search', {
      search_expression: query.trim(),
      page_number: pageNumber,
      max_results: maxResults,
    })

    // Normalize response (handle single vs array quirk)
    const normalized = normalizeFoodsSearchResponse(result)

    return new Response(
      JSON.stringify({ success: true, data: normalized }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Nutrition search error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
