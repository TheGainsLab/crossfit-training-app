import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Manual base64 encoding (no external imports needed)
function base64Encode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const encoder = new TextEncoder()
  const bytes = encoder.encode(str)
  let result = ''
  
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]
    const b = bytes[i + 1] || 0
    const c = bytes[i + 2] || 0
    const bitmap = (a << 16) | (b << 8) | c
    
    result += chars.charAt((bitmap >> 18) & 63)
    result += chars.charAt((bitmap >> 12) & 63)
    result += i + 1 < bytes.length ? chars.charAt((bitmap >> 6) & 63) : '='
    result += i + 2 < bytes.length ? chars.charAt(bitmap & 63) : '='
  }
  
  return result
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
    // Use manual base64 encoding
    const credentials = `${clientId}:${clientSecret}`
    const authString = base64Encode(credentials)
    
    // Include credentials in both header AND body (FatSecret might require both)
    const formData = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'basic',
      client_id: clientId,
      client_secret: clientSecret,
    })
    
    const response = await fetch('https://oauth.fatsecret.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authString}`,
      },
      body: formData.toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('FatSecret OAuth error:', response.status, errorText)
      console.error('Request details:', {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        authStringLength: authString.length,
        authStringPreview: authString.substring(0, 20) + '...'
      })
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

  // Build form data body (FatSecret expects form-urlencoded in body)
  const formData = new URLSearchParams({
    method,
    format: 'json',
    ...Object.entries(params).reduce((acc, [key, value]) => {
      acc[key] = String(value)
      return acc
    }, {} as Record<string, string>),
  })

  const response = await fetch(
    'https://platform.fatsecret.com/rest/server.api',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
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
  // Add defensive checks
  if (!response) {
    console.error('Response is null or undefined')
    throw new Error('Invalid response from FatSecret API')
  }

  const { foods } = response
  
  if (!foods) {
    console.error('Response missing foods property:', JSON.stringify(response))
    throw new Error('Invalid response structure: missing foods property')
  }

  // Handle case where foods.food doesn't exist
  if (!foods.food) {
    console.error('Response missing foods.food property:', JSON.stringify(foods))
    // Return empty array if no foods found
    return {
      foods: [],
      pagination: {
        page: 0,
        maxResults: 0,
        total: 0,
      },
    }
  }
  
  // Handle the single vs array quirk
  const foodArray = Array.isArray(foods.food) 
    ? foods.food 
    : [foods.food]
  
  return {
    foods: foodArray,
    pagination: {
      page: parseInt(foods.page_number || '0', 10),
      maxResults: parseInt(foods.max_results || '0', 10),
      total: parseInt(foods.total_results || '0', 10),
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

    // Verify user via Supabase - Direct token verification
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    // Extract token from Authorization header (remove "Bearer " if present)
    const token = authHeader.replace(/^Bearer\s+/i, '')
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Pass token directly to getUser() - more reliable than relying on client auth state
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized',
          details: authError?.message || 'No user returned'
        }),
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

    console.log('FatSecret API response:', JSON.stringify(result).substring(0, 500)) // Log first 500 chars

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
