import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Call FatSecret API through proxy server
async function callFatSecretAPI(method: string, params: Record<string, string | number>): Promise<any> {
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

  return result.data
}

// Helper function to round to 2 decimal places
function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}

// Normalize barcode to GTIN-13 format (required by FatSecret)
function normalizeBarcodeToGTIN13(barcode: string, barcodeType: string): string {
  const cleaned = barcode.trim().replace(/\D/g, '') // Remove non-digits
  
  if (cleaned.length === 13) {
    return cleaned // Already GTIN-13
  }
  
  if (barcodeType === 'UPC_A' && cleaned.length === 12) {
    return '0' + cleaned // Prepend 0 to make 13 digits
  }
  
  if (barcodeType === 'EAN_8' && cleaned.length === 8) {
    return '00000' + cleaned // Prepend 00000 to make 13 digits
  }
  
  // For other types or if length doesn't match, try to pad to 13
  if (cleaned.length < 13) {
    return cleaned.padStart(13, '0')
  }
  
  // If longer than 13, take last 13 digits
  if (cleaned.length > 13) {
    return cleaned.slice(-13)
  }
  
  return cleaned
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const supabase = createClient(supabaseUrl, supabaseKey)
    
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
    const { barcode, barcodeType = 'UPC_A' } = await req.json()

    if (!barcode || typeof barcode !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'barcode parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalize barcode to GTIN-13 format
    const normalizedBarcode = normalizeBarcodeToGTIN13(barcode, barcodeType)
    console.log(`Looking up barcode: ${barcode} (${barcodeType}) -> normalized: ${normalizedBarcode}`)

    // Step 1: Find food ID from barcode
    const barcodeResult = await callFatSecretAPI('food.find_id_for_barcode', {
      barcode: normalizedBarcode,
    })

    console.log('Barcode result structure:', JSON.stringify(barcodeResult))

    // Handle different possible response structures from FatSecret API
    // FatSecret can return: 
    // - { food_id: { value: "123" } } (most common with barcode scope)
    // - { food_id: { food_id: "123" } }
    // - { food_id: "123" }
    // - { food: { food_id: "123" } }
    let foodId: string | null = null
    
    if (barcodeResult?.food_id) {
      // Check for { food_id: { value: "123" } } structure (most common)
      if (barcodeResult.food_id?.value) {
        if (typeof barcodeResult.food_id.value === 'string') {
          foodId = barcodeResult.food_id.value
        } else if (typeof barcodeResult.food_id.value === 'number') {
          foodId = String(barcodeResult.food_id.value)
        }
      }
      // Check for { food_id: "123" } (direct string)
      else if (typeof barcodeResult.food_id === 'string') {
        foodId = barcodeResult.food_id
      }
      // Check for { food_id: { food_id: "123" } } (nested structure)
      else if (barcodeResult.food_id?.food_id) {
        if (typeof barcodeResult.food_id.food_id === 'string') {
          foodId = barcodeResult.food_id.food_id
        } else if (typeof barcodeResult.food_id.food_id === 'number') {
          foodId = String(barcodeResult.food_id.food_id)
        }
      }
    }
    
    if (!foodId && barcodeResult?.food?.food_id) {
      if (typeof barcodeResult.food.food_id === 'string') {
        foodId = barcodeResult.food.food_id
      } else if (typeof barcodeResult.food.food_id === 'number') {
        foodId = String(barcodeResult.food.food_id)
      }
    }

    if (!foodId) {
      console.log('Barcode not found. Response structure:', JSON.stringify(barcodeResult))
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Product not found',
          message: 'This barcode is not in the FatSecret database'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found food ID: ${foodId}`)

    // Step 2: Get complete nutrition data
    const nutritionResult = await callFatSecretAPI('food.get', {
      food_id: foodId,
    })

    const food = nutritionResult?.food
    if (!food) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not retrieve nutrition data'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalize servings (single vs array quirk)
    if (food.servings && food.servings.serving) {
      const servings = Array.isArray(food.servings.serving)
        ? food.servings.serving
        : [food.servings.serving]
      
      food.servings.serving = servings
    }

    // Get default serving (usually the package serving)
    const defaultServing = food.servings?.serving?.[0]

    if (!defaultServing) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No serving information available'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Return structured data
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          barcode: barcode,
          normalized_barcode: normalizedBarcode,
          found: true,
          // Data for cached_foods table
          cache_data: {
            fatsecret_id: foodId,
            name: food.food_name,
            brand_name: food.brand_name || null,
            food_type: food.food_type || 'Packaged',
            nutrition_data: food,
          },
          // Data ready for food_entries table
          entry_data: {
            food_id: foodId,
            food_name: food.food_name,
            serving_id: defaultServing.serving_id || '0',
            serving_description: defaultServing.serving_description || null,
            number_of_units: 1, // Default to 1 package/serving
            calories: roundToTwoDecimals(parseFloat(defaultServing.calories || '0')),
            protein: roundToTwoDecimals(parseFloat(defaultServing.protein || '0')),
            carbohydrate: roundToTwoDecimals(parseFloat(defaultServing.carbohydrate || '0')),
            fat: roundToTwoDecimals(parseFloat(defaultServing.fat || '0')),
            fiber: roundToTwoDecimals(parseFloat(defaultServing.fiber || '0')),
            sugar: roundToTwoDecimals(parseFloat(defaultServing.sugar || '0')),
            sodium: roundToTwoDecimals(parseFloat(defaultServing.sodium || '0')),
          },
          // Product details
          product_info: {
            brand: food.brand_name,
            name: food.food_name,
            barcode: barcode,
            normalized_barcode: normalizedBarcode,
            barcode_type: barcodeType,
          },
          // Alternative servings available
          available_servings: food.servings?.serving || [],
        } 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Barcode lookup error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        message: 'Failed to look up barcode. It may not be in the database.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
























