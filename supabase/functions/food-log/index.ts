import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const userId = userData.id

    // Parse request body
    const {
      food_id,
      food_name,
      cached_food_id = null,
      favorite_food_id = null,
      meal_template_id = null,
      serving_id,
      serving_description = null,
      number_of_units = 1,
      calories,
      protein,
      carbohydrate,
      fat,
      fiber = null,
      sugar = null,
      sodium = null,
      meal_type = null,
      source = 'manual',
      restaurant_id = null,
      notes = null,
      logged_at = new Date().toISOString()
    } = await req.json()

    // Validate required fields
    if (!food_id || !food_name || !serving_id || calories === undefined) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: food_id, food_name, serving_id, calories' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert food entry
    const { data: entry, error: insertError } = await supabase
      .from('food_entries')
      .insert({
        user_id: userId,
        food_id,
        cached_food_id,
        favorite_food_id,
        meal_template_id,
        food_name,
        serving_id,
        serving_description,
        number_of_units,
        calories,
        protein,
        carbohydrate,
        fat,
        fiber,
        sugar,
        sodium,
        meal_type,
        source,
        restaurant_id,
        notes,
        logged_at
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      throw insertError
    }

    // Note: Triggers will automatically:
    // - Update daily_nutrition
    // - Update cached_food access stats
    // - Update favorite usage stats (log_count, last_logged_at)
    // - Auto-add to favorites if logged 3+ times

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: entry
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Food log error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})






