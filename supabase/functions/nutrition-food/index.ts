import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Call FatSecret API through proxy server
async function callFatSecretAPI(method: string, params: Record<string, string | number>): Promise<any> {
  // Proxy server URL (static IP whitelisted in FatSecret)
  const proxyUrl = 'http://104.236.49.96:3000'
  
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method,
      params,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Proxy error:', response.status, errorText)
    throw new Error(`Proxy error: ${response.status} - ${errorText}`)
  }

  const result = await response.json()
  
  if (!result.success) {
    console.error('Proxy returned unsuccessful response:', result)
    throw new Error(result.error || 'Proxy returned unsuccessful response')
  }

  // Proxy returns {success: true, data: {...}}
  // The data contains the FatSecret API response
  return result.data
}

// Constants for unit conversion
const GRAMS_PER_OZ = 28.35

// Helper to normalize food.get response (handles single vs array serving quirk)
function normalizeFoodGetResponse(response: any): any {
  const { food } = response
  
  // Handle single vs array serving quirk
  if (food.servings && food.servings.serving) {
    const servings = Array.isArray(food.servings.serving)
      ? food.servings.serving
      : [food.servings.serving]
    
    return {
      ...food,
      servings: {
        serving: servings,
      },
    }
  }
  
  return food
}

// Convert serving to per-gram nutrition for easy oz/g conversion
function normalizeToPerGram(serving: any): any {
  let grams: number | null = null
  
  // Try to extract grams from the serving
  if (serving.metric_serving_amount && serving.metric_serving_unit === 'g') {
    grams = parseFloat(serving.metric_serving_amount)
  } else if (serving.serving_description) {
    const desc = serving.serving_description.toLowerCase()
    
    // Parse "1 oz" or "3 oz"
    const ozMatch = desc.match(/([\d.]+)\s*oz/i)
    if (ozMatch) {
      grams = parseFloat(ozMatch[1]) * GRAMS_PER_OZ
    }
    
    // Parse "100g" or "341 g"
    if (!grams) {
      const gMatch = desc.match(/([\d.]+)\s*g(?:\s|$)/i)
      if (gMatch) {
        grams = parseFloat(gMatch[1])
      }
    }
  }
  
  if (!grams || grams <= 0) return null
  
  return {
    grams,
    calories_per_gram: parseFloat(serving.calories || 0) / grams,
    protein_per_gram: parseFloat(serving.protein || 0) / grams,
    carbs_per_gram: parseFloat(serving.carbohydrate || 0) / grams,
    fat_per_gram: parseFloat(serving.fat || 0) / grams,
    fiber_per_gram: parseFloat(serving.fiber || 0) / grams,
    sodium_per_gram: parseFloat(serving.sodium || 0) / grams,
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
    const { foodId, normalize = false } = await req.json()

    if (!foodId || typeof foodId !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'foodId parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call FatSecret API
    const result = await callFatSecretAPI('food.get', {
      food_id: foodId.trim(),
    })

    // Normalize response (handle single vs array serving quirk)
    const normalized = normalizeFoodGetResponse(result)

    // Add per-gram nutrition if requested
    if (normalize && normalized.servings?.serving) {
      const servings = normalized.servings.serving
      
      // Find best serving to normalize (prefer 100g, then 1oz, then first available)
      let bestServing = servings.find((s: any) => 
        s.serving_description?.toLowerCase().includes('100') && 
        s.metric_serving_unit === 'g'
      ) || servings.find((s: any) => 
        s.serving_description?.toLowerCase().includes('1 oz')
      ) || servings[0]
      
      const perGram = normalizeToPerGram(bestServing)
      
      if (perGram) {
        normalized.normalized_nutrition = {
          ...perGram,
          source_serving: bestServing.serving_description,
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: { food: normalized } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Get food error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
