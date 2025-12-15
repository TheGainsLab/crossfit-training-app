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

// Identify food using Claude Vision API
async function identifyFoodWithClaude(imageBase64: string, imageType: string): Promise<any[]> {
  const claudeApiKey = Deno.env.get('CLAUDE_API_KEY')
  if (!claudeApiKey) {
    throw new Error('Claude API key not found')
  }

  const prompt = `Analyze this food image and identify each distinct food item for nutrition database lookup.

For each food item, provide:
- food_name: Simple, searchable name for nutrition database (e.g., "chicken breast" not "Grilled Herb-Crusted Chicken")
- serving_size: Standard measurement (e.g., "1 cup", "100g", "1 medium", "1 slice")
- description: Cooking method and visual details (e.g., "grilled", "fried", "raw")

Keep food names SIMPLE and GENERIC for better database matching.

Return ONLY a JSON array with no markdown:
[
  {
    "food_name": "string",
    "serving_size": "string",
    "description": "string"
  }
]

If no food visible, return: []`

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: imageType === 'png' ? 'image/png' : 'image/jpeg',
                data: imageBase64
              }
            },
            {
              type: "text",
              text: prompt
            }
          ]
        }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Claude API error:', response.status, errorText)
    throw new Error(`Claude API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const aiResponse = data.content[0].text

  // Extract JSON from response
  let jsonMatch = aiResponse.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    jsonMatch = aiResponse.match(/```json\n?([\s\S]*?)\n?```/) || aiResponse.match(/```\n?([\s\S]*?)\n?```/)
    if (jsonMatch) {
      jsonMatch = [jsonMatch[0], jsonMatch[1]]
    }
  }

  if (!jsonMatch) {
    console.error('Could not extract JSON from Claude response:', aiResponse)
    return []
  }

  try {
    const parsed = JSON.parse(jsonMatch[0] || jsonMatch[1] || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Failed to parse Claude response as JSON:', error)
    return []
  }
}

// Match Claude's estimated serving to the closest FatSecret serving
function findBestServingMatch(estimatedServing: string, availableServings: any[]): any {
  if (!availableServings || availableServings.length === 0) {
    return null
  }

  const estimated = estimatedServing.toLowerCase().trim()
  
  // Extract number from Claude's estimate (e.g., "1 cup" -> 1, "200g" -> 200)
  const estimatedAmount = parseFloat(estimated.match(/[\d.]+/)?.[0] || '1')
  
  // Extract unit from Claude's estimate
  let estimatedUnit = estimated.replace(/[\d.]+\s*/, '').trim()
  
  // Normalize common units
  const unitNormalization: Record<string, string[]> = {
    'g': ['g', 'gram', 'grams'],
    'oz': ['oz', 'ounce', 'ounces'],
    'cup': ['cup', 'cups', 'c'],
    'tbsp': ['tbsp', 'tablespoon', 'tablespoons', 'tbs'],
    'tsp': ['tsp', 'teaspoon', 'teaspoons'],
    'ml': ['ml', 'milliliter', 'milliliters'],
    'serving': ['serving', 'servings', 'serve'],
    'piece': ['piece', 'pieces', 'whole', 'each', 'item'],
    'slice': ['slice', 'slices'],
    'burger': ['burger', 'burgers', 'sandwich', 'sandwiches'],
  }
  
  // Find normalized unit
  let normalizedUnit = estimatedUnit
  for (const [normalized, variants] of Object.entries(unitNormalization)) {
    if (variants.some(v => estimatedUnit.includes(v))) {
      normalizedUnit = normalized
      break
    }
  }
  
  // Score each serving option
  const scoredServings = availableServings.map(serving => {
    let score = 0
    const servingDesc = (serving.serving_description || '').toLowerCase()
    const measurementDesc = (serving.measurement_description || '').toLowerCase()
    const metricUnit = (serving.metric_serving_unit || '').toLowerCase()
    
    // 1. Unit matching (highest priority)
    const servingText = `${servingDesc} ${measurementDesc} ${metricUnit}`
    if (unitNormalization[normalizedUnit]?.some(variant => servingText.includes(variant))) {
      score += 100
      
      // 2. Amount matching (if units match)
      const servingAmount = parseFloat(serving.metric_serving_amount || serving.number_of_units || '1')
      const amountDiff = Math.abs(estimatedAmount - servingAmount)
      const amountScore = Math.max(0, 50 - amountDiff * 5) // Closer = higher score
      score += amountScore
    }
    
    // 3. Keyword matching
    const keywords = estimated.split(/\s+/)
    keywords.forEach(keyword => {
      if (keyword.length > 2 && servingText.includes(keyword)) {
        score += 10
      }
    })
    
    // 4. Prefer "per 100g" or standard servings if no good match
    if (servingDesc.includes('100') && (metricUnit.includes('g') || servingDesc.includes('g'))) {
      score += 5
    }
    
    return { serving, score }
  })
  
  // Sort by score and return best match
  scoredServings.sort((a, b) => b.score - a.score)
  
  console.log(`Matching "${estimatedServing}" to servings:`, 
    scoredServings.slice(0, 3).map(s => ({
      desc: s.serving.serving_description,
      score: s.score
    }))
  )
  
  return scoredServings[0].serving
}

// Search FatSecret and get complete nutrition data for a food item
async function searchAndGetNutrition(foodName: string, estimatedServing?: string): Promise<any> {
  try {
    // Step 1: Search for the food
    const searchResult = await callFatSecretAPI('foods.search', {
      search_expression: foodName.trim(),
      page_number: 0,
      max_results: 5, // Get top 5 to have alternatives
    })

    // Handle FatSecret's quirky response format
    const foods = searchResult?.foods
    if (!foods || !foods.food) {
      console.log(`No results found for: ${foodName}`)
      return null
    }

    // Normalize single vs array
    const foodArray = Array.isArray(foods.food) ? foods.food : [foods.food]
    
    if (foodArray.length === 0) {
      console.log(`Empty results for: ${foodName}`)
      return null
    }

    // Step 2: Get detailed nutrition for the first (best) match
    const bestMatch = foodArray[0]
    const foodId = bestMatch.food_id
    
    const nutritionResult = await callFatSecretAPI('food.get', {
      food_id: foodId,
    })

    // Normalize servings (single vs array quirk)
    const food = nutritionResult?.food
    if (food && food.servings && food.servings.serving) {
      const servings = Array.isArray(food.servings.serving)
        ? food.servings.serving
        : [food.servings.serving]
      
      food.servings.serving = servings
      
      // Find best serving match based on Claude's estimate
      const bestServing = estimatedServing 
        ? findBestServingMatch(estimatedServing, servings)
        : servings[0] // Fallback to first serving if no estimate provided
      
      food.best_matched_serving = bestServing
    }

    return {
      fatsecret_id: foodId,
      food_name: bestMatch.food_name,
      brand_name: bestMatch.brand_name || null,
      food_description: bestMatch.food_description,
      nutrition_data: food, // Complete FatSecret response for caching
      search_alternatives: foodArray.slice(1, 4).map(alt => ({
        food_id: alt.food_id,
        food_name: alt.food_name,
        brand_name: alt.brand_name || null,
        food_description: alt.food_description,
      })), // Top 3 alternatives if user wants to change
    }
  } catch (error) {
    console.error(`Error getting nutrition for ${foodName}:`, error)
    return null
  }
}

// Helper function to round to 2 decimal places
function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
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
    const { imageBase64, imageType = 'jpeg' } = await req.json()

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'imageBase64 parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Remove data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '')

    console.log('Step 1: Identifying food with Claude...')
    
    // Step 1: Identify foods with Claude
    const identifiedFoods = await identifyFoodWithClaude(base64Data, imageType)

    if (identifiedFoods.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: { 
            foods: [],
            message: 'No food items identified in the image'
          } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Step 2: Found ${identifiedFoods.length} food items, searching FatSecret...`)

    // Step 2 & 3: Search FatSecret and get nutrition data for each identified food
    const nutritionResults = await Promise.all(
      identifiedFoods.map(async (identifiedFood) => {
        const nutritionData = await searchAndGetNutrition(
          identifiedFood.food_name,
          identifiedFood.serving_size // Pass Claude's serving estimate
        )
        
        if (!nutritionData) {
          return {
            identified: identifiedFood,
            found: false,
            error: 'No matching food found in database'
          }
        }

        // Use the best matched serving (or fall back to first if no match)
        const defaultServing = nutritionData.nutrition_data?.best_matched_serving 
          || nutritionData.nutrition_data?.servings?.serving?.[0]

        // Log if no serving match was found
        if (!nutritionData.nutrition_data?.best_matched_serving) {
          console.log(`No serving match found for "${identifiedFood.serving_size}", using first available serving`)
        }

        // Calculate number_of_units multiplier
        let numberOfUnits = parseFloat(defaultServing?.number_of_units || '1')
        
        if (identifiedFood.serving_size && defaultServing) {
          const claudeEstimate = identifiedFood.serving_size.toLowerCase().trim()
          const claudeAmount = parseFloat(claudeEstimate.match(/[\d.]+/)?.[0] || '1')
          
          // Extract serving amount
          const servingDesc = (defaultServing.serving_description || '').toLowerCase()
          const metricAmount = parseFloat(defaultServing.metric_serving_amount || '0')
          
          // Try to extract amount from serving description (e.g., "1 cup" -> 1, "100g" -> 100)
          const servingAmount = metricAmount || parseFloat(servingDesc.match(/[\d.]+/)?.[0] || '1')
          
          // Check if units are comparable
          const claudeUnit = claudeEstimate.replace(/[\d.]+\s*/, '').trim()
          const servingUnit = (defaultServing.metric_serving_unit || servingDesc).toLowerCase()
          
          // Define piece-based units that can be compared
          const pieceUnits = ['piece', 'whole', 'each', 'item', 'medium', 'large', 'small']
          const claudeIsPiece = pieceUnits.some(u => claudeUnit.includes(u))
          const servingIsPiece = pieceUnits.some(u => servingUnit.includes(u))
          
          // Check for compatible units (weight/volume or both piece-based)
          const compatibleUnits = (
            (claudeUnit.includes('g') && servingUnit.includes('g')) ||
            (claudeUnit.includes('oz') && servingUnit.includes('oz')) ||
            (claudeUnit.includes('cup') && servingUnit.includes('cup')) ||
            (claudeUnit.includes('ml') && servingUnit.includes('ml')) ||
            (claudeUnit.includes('tbsp') && servingUnit.includes('tbsp')) ||
            (claudeUnit.includes('tsp') && servingUnit.includes('tsp')) ||
            (claudeIsPiece && servingIsPiece) // Both are piece-based units
          )
          
          // Calculate multiplier if units match
          if (compatibleUnits && servingAmount > 0) {
            numberOfUnits = claudeAmount / servingAmount
            console.log(`Calculated multiplier: ${claudeAmount}${claudeUnit} / ${servingAmount} = ${numberOfUnits.toFixed(2)} units`)
          }
        }

        // Safety check: validate numberOfUnits is reasonable
        if (numberOfUnits <= 0 || numberOfUnits > 100) {
          console.warn(`Unreasonable numberOfUnits: ${numberOfUnits}, using 1.0`)
          numberOfUnits = 1.0
        }

        // Round to 2 decimals
        numberOfUnits = roundToTwoDecimals(numberOfUnits)

        return {
          identified: identifiedFood,
          found: true,
          // Data for cached_foods table
          cache_data: {
            fatsecret_id: nutritionData.fatsecret_id,
            name: nutritionData.food_name,
            brand_name: nutritionData.brand_name,
            food_type: nutritionData.nutrition_data?.food_type || null,
            nutrition_data: nutritionData.nutrition_data,
          },
          // Data ready for food_entries table (matches your schema exactly)
          entry_data: {
            food_id: nutritionData.fatsecret_id, // FatSecret food ID
            food_name: nutritionData.food_name,
            serving_id: defaultServing?.serving_id || '0',
            serving_description: defaultServing?.serving_description || null,
            number_of_units: numberOfUnits,
            calories: roundToTwoDecimals(parseFloat(defaultServing?.calories || '0') * numberOfUnits),
            protein: roundToTwoDecimals(parseFloat(defaultServing?.protein || '0') * numberOfUnits),
            carbohydrate: roundToTwoDecimals(parseFloat(defaultServing?.carbohydrate || '0') * numberOfUnits),
            fat: roundToTwoDecimals(parseFloat(defaultServing?.fat || '0') * numberOfUnits),
            fiber: roundToTwoDecimals(parseFloat(defaultServing?.fiber || '0') * numberOfUnits),
            sugar: roundToTwoDecimals(parseFloat(defaultServing?.sugar || '0') * numberOfUnits),
            sodium: roundToTwoDecimals(parseFloat(defaultServing?.sodium || '0') * numberOfUnits),
            // Note: cached_food_id and user_id will be set by your app when saving
          },
          // Which serving was matched
          matched_serving: {
            claude_estimate: identifiedFood.serving_size,
            fatsecret_serving: defaultServing?.serving_description,
            calculated_units: numberOfUnits,
            match_confidence: defaultServing === nutritionData.nutrition_data?.best_matched_serving ? 'high' : 'low'
          },
          // Alternative servings available
          available_servings: nutritionData.nutrition_data?.servings?.serving || [],
          // Alternative foods if user wants to pick different match
          alternatives: nutritionData.search_alternatives,
        }
      })
    )

    console.log('Step 3: Complete! Returning results...')

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { 
          foods: nutritionResults,
          summary: {
            total_identified: identifiedFoods.length,
            total_found: nutritionResults.filter(r => r.found).length,
            total_not_found: nutritionResults.filter(r => !r.found).length,
          }
        } 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Complete nutrition lookup error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})









