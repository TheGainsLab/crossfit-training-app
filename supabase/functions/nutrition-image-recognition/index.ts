import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Call Claude Vision API to identify food in image
async function identifyFoodWithClaude(imageBase64: string, imageType: string): Promise<any> {
  const claudeApiKey = Deno.env.get('CLAUDE_API_KEY')
  if (!claudeApiKey) {
    throw new Error('Claude API key not found')
  }

  const prompt = `Analyze this food image and identify all food items visible. For each food item, provide:
1. Food name (be specific, e.g., "Grilled Chicken Breast" not just "Chicken")
2. Estimated serving size/quantity (e.g., "1 cup", "200g", "1 medium apple")
3. Estimated calories (if you can reasonably estimate)
4. Brief description of what you see

Return the response as a JSON array of objects with this structure:
[
  {
    "food_name": "string",
    "serving_size": "string",
    "estimated_calories": number (or null if unknown),
    "description": "string"
  }
]

If you cannot identify any food items, return an empty array [].`

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307", // Using Haiku for cost efficiency
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

  // Try to extract JSON from the response (handle markdown code blocks)
  let jsonMatch = aiResponse.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    // Try to find JSON in code blocks
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
    console.error('Failed to parse Claude response as JSON:', error, 'Response:', aiResponse)
    return []
  }
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

    // Parse request body
    const { imageBase64, imageType = 'jpeg' } = await req.json()

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'imageBase64 parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '')

    // Call Claude to identify food
    const identifiedFoods = await identifyFoodWithClaude(base64Data, imageType)

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { 
          foods: identifiedFoods,
          rawResponse: identifiedFoods // For debugging
        } 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Image recognition error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

