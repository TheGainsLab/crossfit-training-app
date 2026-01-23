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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const token = authHeader.replace(/^Bearer\s+/i, '')
    // Use service role to bypass RLS - we verify the user manually above
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
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
    const { action, ...params } = await req.json()

    if (!action) {
      return new Response(
        JSON.stringify({ success: false, error: 'Action parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let result

    switch (action) {
      case 'get_all':
        result = await getAllFavorites(supabase, userId)
        break
      
      case 'add_restaurant':
        result = await addRestaurant(supabase, userId, params)
        break
      
      case 'add_brand':
        result = await addBrand(supabase, userId, params)
        break
      
      case 'add_food':
        result = await addFood(supabase, userId, params)
        break
      
      case 'delete_food':
        result = await deleteFood(supabase, userId, params)
        break
      
      case 'delete_restaurant':
        result = await deleteRestaurant(supabase, userId, params)
        break
      
      case 'delete_brand':
        result = await deleteBrand(supabase, userId, params)
        break
      
      case 'hide_restaurant':
        result = await hideRestaurant(supabase, userId, params)
        break
      
      case 'hide_brand':
        result = await hideBrand(supabase, userId, params)
        break
      
      case 'add_meal_template':
        result = await addMealTemplate(supabase, userId, params)
        break

      case 'update_meal_template':
        result = await updateMealTemplate(supabase, userId, params)
        break

      case 'delete_meal_template':
        result = await deleteMealTemplate(supabase, userId, params)
        break

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Favorites manage error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Get all favorites organized by type
async function getAllFavorites(supabase: any, userId: number) {
  const [restaurants, brands, foods, meals] = await Promise.all([
    supabase.from('favorite_restaurants')
      .select('*')
      .eq('user_id', userId)
      .order('last_accessed_at', { ascending: false, nullsFirst: false }),
    
    supabase.from('favorite_brands')
      .select('*')
      .eq('user_id', userId)
      .order('last_accessed_at', { ascending: false, nullsFirst: false }),
    
    supabase.from('food_favorites')
      .select('*')
      .eq('user_id', userId)
      .order('log_count', { ascending: false }),
    
    supabase.from('meal_templates')
      .select('*')
      .eq('user_id', userId)
      .order('log_count', { ascending: false })
  ])

  return {
    restaurants: restaurants.data || [],
    brands: brands.data || [],
    foods: foods.data || [],
    meals: meals.data || []
  }
}

// Add restaurant
async function addRestaurant(supabase: any, userId: number, params: any) {
  const { restaurant_name, fatsecret_brand_filter = null } = params

  if (!restaurant_name) {
    throw new Error('restaurant_name required')
  }

  // Remove from hidden list if exists
  await supabase
    .from('hidden_restaurants')
    .delete()
    .eq('user_id', userId)
    .eq('restaurant_name', restaurant_name)

  const { data, error } = await supabase
    .from('favorite_restaurants')
    .insert({
      user_id: userId,
      restaurant_name,
      fatsecret_brand_filter,
      last_accessed_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error

  return data
}

// Add brand
async function addBrand(supabase: any, userId: number, params: any) {
  const { brand_name, fatsecret_brand_filter = null } = params

  if (!brand_name) {
    throw new Error('brand_name required')
  }

  // Remove from hidden list if exists
  await supabase
    .from('hidden_brands')
    .delete()
    .eq('user_id', userId)
    .eq('brand_name', brand_name)

  const { data, error } = await supabase
    .from('favorite_brands')
    .insert({
      user_id: userId,
      brand_name,
      fatsecret_brand_filter,
      last_accessed_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error

  return data
}

// Add food favorite
async function addFood(supabase: any, userId: number, params: any) {
  const {
    food_id,
    food_name,
    food_type = 'generic',
    brand_name = null,
    restaurant_id = null,
    brand_id = null,
    serving_id = null,
    serving_description = null,
    default_amount = 1,
    default_unit = 'serving',
    calories_per_gram = null,
    protein_per_gram = null,
    carbs_per_gram = null,
    fat_per_gram = null,
    fiber_per_gram = null,
    sodium_per_gram = null,
    raw_serving_calories = null,
    raw_serving_protein = null,
    raw_serving_carbs = null,
    raw_serving_fat = null,
  } = params

  if (!food_id || !food_name) {
    throw new Error('food_id and food_name required')
  }

  const { data, error } = await supabase
    .from('food_favorites')
    .insert({
      user_id: userId,
      food_id,
      food_name,
      food_type,
      brand_name,
      restaurant_id,
      brand_id,
      serving_id,
      serving_description,
      default_amount,
      default_unit,
      calories_per_gram,
      protein_per_gram,
      carbs_per_gram,
      fat_per_gram,
      fiber_per_gram,
      sodium_per_gram,
      raw_serving_calories,
      raw_serving_protein,
      raw_serving_carbs,
      raw_serving_fat,
    })
    .select()
    .single()

  if (error) throw error

  return data
}

// Delete food favorite
async function deleteFood(supabase: any, userId: number, params: any) {
  const { id } = params

  if (!id) {
    throw new Error('id required')
  }

  const { error } = await supabase
    .from('food_favorites')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  return { deleted: true }
}

// Delete restaurant
async function deleteRestaurant(supabase: any, userId: number, params: any) {
  const { id } = params

  if (!id) {
    throw new Error('id required')
  }

  const { error } = await supabase
    .from('favorite_restaurants')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  return { deleted: true }
}

// Delete brand
async function deleteBrand(supabase: any, userId: number, params: any) {
  const { id } = params

  if (!id) {
    throw new Error('id required')
  }

  const { error } = await supabase
    .from('favorite_brands')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  return { deleted: true }
}

// Hide restaurant (remove from selection list)
async function hideRestaurant(supabase: any, userId: number, params: any) {
  const { restaurant_name } = params

  if (!restaurant_name) {
    throw new Error('restaurant_name required')
  }

  const { data, error } = await supabase
    .from('hidden_restaurants')
    .insert({
      user_id: userId,
      restaurant_name,
    })
    .select()
    .single()

  if (error) {
    // Handle duplicate gracefully
    if (error.code === '23505') {
      return { hidden: true, already_hidden: true }
    }
    throw error
  }

  return { hidden: true, data }
}

// Hide brand (remove from selection list)
async function hideBrand(supabase: any, userId: number, params: any) {
  const { brand_name } = params

  if (!brand_name) {
    throw new Error('brand_name required')
  }

  const { data, error } = await supabase
    .from('hidden_brands')
    .insert({
      user_id: userId,
      brand_name,
    })
    .select()
    .single()

  if (error) {
    // Handle duplicate gracefully
    if (error.code === '23505') {
      return { hidden: true, already_hidden: true }
    }
    throw error
  }

  return { hidden: true, data }
}

// Add meal template with items
async function addMealTemplate(supabase: any, userId: number, params: any) {
  const { template_name, items, totals } = params

  if (!template_name) {
    throw new Error('template_name required')
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('items array required with at least one item')
  }

  // Create the meal template
  const { data: template, error: templateError } = await supabase
    .from('meal_templates')
    .insert({
      user_id: userId,
      template_name,
      total_calories: totals.calories || 0,
      total_protein: totals.protein || 0,
      total_carbohydrate: totals.carbohydrate || 0,
      total_fat: totals.fat || 0,
      total_fiber: totals.fiber || 0,
      total_sodium: totals.sodium || 0,
    })
    .select()
    .single()

  if (templateError) throw templateError

  // Add all items to the meal template
  const itemsToInsert = items.map((item: any, index: number) => ({
    meal_template_id: template.id,
    food_id: item.food_id,
    food_name: item.food_name,
    serving_id: item.serving_id || '0',
    serving_description: item.serving_description || '',
    number_of_units: item.number_of_units || 1,
    calories: item.calories || 0,
    protein: item.protein || 0,
    carbohydrate: item.carbohydrate || 0,
    fat: item.fat || 0,
    fiber: item.fiber || 0,
    sugar: item.sugar || 0,
    sodium: item.sodium || 0,
    sort_order: index,
  }))

  const { error: itemsError } = await supabase
    .from('meal_template_items')
    .insert(itemsToInsert)

  if (itemsError) throw itemsError

  return template
}

// Update meal template with items
async function updateMealTemplate(supabase: any, userId: number, params: any) {
  const { template_id, template_name, items, totals } = params

  if (!template_id) {
    throw new Error('template_id required')
  }

  if (!template_name) {
    throw new Error('template_name required')
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('items array required with at least one item')
  }

  // Verify the template belongs to this user
  const { data: existing } = await supabase
    .from('meal_templates')
    .select('id')
    .eq('id', template_id)
    .eq('user_id', userId)
    .single()

  if (!existing) {
    throw new Error('Meal template not found or access denied')
  }

  // Update the meal template
  const { data: template, error: templateError } = await supabase
    .from('meal_templates')
    .update({
      template_name,
      total_calories: totals.calories || 0,
      total_protein: totals.protein || 0,
      total_carbohydrate: totals.carbohydrate || 0,
      total_fat: totals.fat || 0,
      total_fiber: totals.fiber || 0,
      total_sodium: totals.sodium || 0,
    })
    .eq('id', template_id)
    .select()
    .single()

  if (templateError) throw templateError

  // Delete existing items
  const { error: deleteError } = await supabase
    .from('meal_template_items')
    .delete()
    .eq('meal_template_id', template_id)

  if (deleteError) throw deleteError

  // Add new items
  const itemsToInsert = items.map((item: any, index: number) => ({
    meal_template_id: template.id,
    food_id: item.food_id,
    food_name: item.food_name,
    serving_id: item.serving_id || '0',
    serving_description: item.serving_description || '',
    number_of_units: item.number_of_units || 1,
    calories: item.calories || 0,
    protein: item.protein || 0,
    carbohydrate: item.carbohydrate || 0,
    fat: item.fat || 0,
    fiber: item.fiber || 0,
    sugar: item.sugar || 0,
    sodium: item.sodium || 0,
    sort_order: index,
  }))

  const { error: itemsError } = await supabase
    .from('meal_template_items')
    .insert(itemsToInsert)

  if (itemsError) throw itemsError

  return template
}

// Delete meal template
async function deleteMealTemplate(supabase: any, userId: number, params: any) {
  const { id } = params

  if (!id) {
    throw new Error('id required')
  }

  // Delete items first (cascade should handle this, but be explicit)
  await supabase
    .from('meal_template_items')
    .delete()
    .eq('meal_template_id', id)

  // Delete the template
  const { error } = await supabase
    .from('meal_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  return { deleted: true }
}






