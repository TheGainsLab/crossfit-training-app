import { createClient } from '../supabase/client'

export interface MealTemplateItem {
  id?: number
  meal_template_id?: number
  food_id: string
  food_name: string
  serving_id?: string
  serving_description?: string
  number_of_units: number
  calories: number
  protein: number
  carbohydrate: number
  fat: number
  fiber?: number
  sugar?: number
  sodium?: number
  sort_order: number
}

export interface MealTemplate {
  id?: number
  user_id: number
  template_name: string
  meal_type?: string
  total_calories: number
  total_protein: number
  total_carbohydrate: number
  total_fat: number
  total_fiber?: number
  total_sugar?: number
  total_sodium?: number
  created_at?: string
  updated_at?: string
  last_logged_at?: string
  log_count?: number
  items?: MealTemplateItem[]
}

/**
 * Create a new meal template with its items
 */
export async function createMealTemplate(
  userId: number,
  templateName: string,
  mealType: string | null,
  items: Omit<MealTemplateItem, 'id' | 'meal_template_id'>[]
): Promise<{ success: boolean; templateId?: number; error?: string }> {
  try {
    const supabase = createClient()

    // Calculate totals from items
    const totals = items.reduce(
      (acc, item) => ({
        calories: acc.calories + (item.calories || 0),
        protein: acc.protein + (item.protein || 0),
        carbohydrate: acc.carbohydrate + (item.carbohydrate || 0),
        fat: acc.fat + (item.fat || 0),
        fiber: acc.fiber + (item.fiber || 0),
        sugar: acc.sugar + (item.sugar || 0),
        sodium: acc.sodium + (item.sodium || 0),
      }),
      { calories: 0, protein: 0, carbohydrate: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }
    )

    // Insert meal template
    const { data: template, error: templateError } = await supabase
      .from('meal_templates')
      .insert({
        user_id: userId,
        template_name: templateName,
        meal_type: mealType,
        total_calories: totals.calories,
        total_protein: totals.protein,
        total_carbohydrate: totals.carbohydrate,
        total_fat: totals.fat,
        total_fiber: totals.fiber,
        total_sugar: totals.sugar,
        total_sodium: totals.sodium,
      })
      .select()
      .single()

    if (templateError) {
      console.error('Error creating meal template:', templateError)
      return { success: false, error: templateError.message }
    }

    // Insert template items
    const itemsToInsert = items.map((item, index) => ({
      meal_template_id: template.id,
      ...item,
      sort_order: item.sort_order ?? index,
    }))

    const { error: itemsError } = await supabase
      .from('meal_template_items')
      .insert(itemsToInsert)

    if (itemsError) {
      console.error('Error creating meal template items:', itemsError)
      // Rollback: delete the template
      await supabase.from('meal_templates').delete().eq('id', template.id)
      return { success: false, error: itemsError.message }
    }

    return { success: true, templateId: template.id }
  } catch (error: any) {
    console.error('Error in createMealTemplate:', error)
    return { success: false, error: error.message || 'Failed to create meal template' }
  }
}

/**
 * Get all meal templates for a user, optionally filtered by meal type
 */
export async function getMealTemplates(
  userId: number,
  mealType?: string
): Promise<MealTemplate[]> {
  try {
    const supabase = createClient()

    let query = supabase
      .from('meal_templates')
      .select('*')
      .eq('user_id', userId)
      .order('last_logged_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (mealType) {
      query = query.eq('meal_type', mealType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching meal templates:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in getMealTemplates:', error)
    return []
  }
}

/**
 * Get a single meal template with all its items
 */
export async function getMealTemplateWithItems(
  templateId: number
): Promise<MealTemplate | null> {
  try {
    const supabase = createClient()

    // Get template
    const { data: template, error: templateError } = await supabase
      .from('meal_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      console.error('Error fetching meal template:', templateError)
      return null
    }

    // Get items
    const { data: items, error: itemsError } = await supabase
      .from('meal_template_items')
      .select('*')
      .eq('meal_template_id', templateId)
      .order('sort_order', { ascending: true })

    if (itemsError) {
      console.error('Error fetching meal template items:', itemsError)
      return null
    }

    return {
      ...template,
      items: items || [],
    }
  } catch (error) {
    console.error('Error in getMealTemplateWithItems:', error)
    return null
  }
}

/**
 * Update a meal template
 */
export async function updateMealTemplate(
  templateId: number,
  updates: Partial<MealTemplate>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()

    const { error } = await supabase
      .from('meal_templates')
      .update(updates)
      .eq('id', templateId)

    if (error) {
      console.error('Error updating meal template:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error in updateMealTemplate:', error)
    return { success: false, error: error.message || 'Failed to update meal template' }
  }
}

/**
 * Delete a meal template (items are cascade deleted)
 */
export async function deleteMealTemplate(
  templateId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()

    const { error } = await supabase
      .from('meal_templates')
      .delete()
      .eq('id', templateId)

    if (error) {
      console.error('Error deleting meal template:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error in deleteMealTemplate:', error)
    return { success: false, error: error.message || 'Failed to delete meal template' }
  }
}

/**
 * Log a meal template to food_entries
 * Creates individual food_entry records for each item in the template
 */
export async function logMealTemplate(
  userId: number,
  templateId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()

    // Get template with items
    const template = await getMealTemplateWithItems(templateId)
    if (!template || !template.items || template.items.length === 0) {
      return { success: false, error: 'Template not found or has no items' }
    }

    // Determine meal type from current time if not set
    let mealType = template.meal_type
    if (!mealType) {
      const hour = new Date().getHours()
      if (hour < 11) mealType = 'breakfast'
      else if (hour < 16) mealType = 'lunch'
      else mealType = 'dinner'
    }

    // Create food entries for each item
    const entries = template.items.map((item) => ({
      user_id: userId,
      food_id: item.food_id,
      food_name: item.food_name,
      serving_id: item.serving_id,
      serving_description: item.serving_description,
      number_of_units: item.number_of_units,
      calories: item.calories,
      protein: item.protein,
      carbohydrate: item.carbohydrate,
      fat: item.fat,
      fiber: item.fiber || 0,
      sugar: item.sugar || 0,
      sodium: item.sodium || 0,
      meal_type: mealType,
      logged_at: new Date().toISOString(),
    }))

    const { error: entriesError } = await supabase
      .from('food_entries')
      .insert(entries)

    if (entriesError) {
      console.error('Error logging meal template:', entriesError)
      return { success: false, error: entriesError.message }
    }

    // Update template stats
    await supabase
      .from('meal_templates')
      .update({
        last_logged_at: new Date().toISOString(),
        log_count: (template.log_count || 0) + 1,
      })
      .eq('id', templateId)

    return { success: true }
  } catch (error: any) {
    console.error('Error in logMealTemplate:', error)
    return { success: false, error: error.message || 'Failed to log meal template' }
  }
}

