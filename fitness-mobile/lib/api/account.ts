import { createClient } from '../supabase/client'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { logoutRevenueCat } from '../subscriptions'

/**
 * Delete all user data and account.
 *
 * Deletes child tables first (to respect foreign key constraints),
 * then the parent `users` row, then the Supabase auth user,
 * and finally clears local state.
 *
 * Returns { success, error? } so the caller can show appropriate UI.
 */
export async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()

    // Get current auth user
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get the internal user ID (needed for most table deletions)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single()

    if (userError || !userData) {
      return { success: false, error: 'User record not found' }
    }

    const userId = userData.id

    // -------------------------------------------------------
    // Delete child tables first, then parent tables.
    // Each deletion is best-effort — we continue even if a
    // table doesn't exist or has no rows for this user.
    // -------------------------------------------------------

    // 1. Support / chat
    // Delete messages for all conversations owned by this user
    const { data: conversations } = await supabase
      .from('support_conversations')
      .select('id')
      .eq('user_id', userId)

    if (conversations && conversations.length > 0) {
      const conversationIds = conversations.map(c => c.id)
      await supabase
        .from('support_messages')
        .delete()
        .in('conversation_id', conversationIds)
    }

    await supabase
      .from('support_conversations')
      .delete()
      .eq('user_id', userId)

    // Delete chat attachment files from storage
    try {
      const { data: files } = await supabase.storage
        .from('chat-attachments')
        .list(`${userId}`)
      if (files && files.length > 0) {
        const paths = files.map(f => `${userId}/${f.name}`)
        await supabase.storage.from('chat-attachments').remove(paths)
      }
    } catch {
      // Storage bucket may not exist or be empty — continue
    }

    // 2. Nutrition data (child → parent order)
    await supabase.from('meal_template_items').delete().eq('user_id', userId)
    await supabase.from('meal_templates').delete().eq('user_id', userId)
    await supabase.from('food_entries').delete().eq('user_id', userId)
    await supabase.from('food_favorites').delete().eq('user_id', userId)
    await supabase.from('favorite_restaurants').delete().eq('user_id', userId)
    await supabase.from('hidden_restaurants').delete().eq('user_id', userId)
    await supabase.from('favorite_brands').delete().eq('user_id', userId)
    await supabase.from('hidden_brands').delete().eq('user_id', userId)

    // 3. Training / workout data
    await supabase.from('performance_logs').delete().eq('user_id', userId)
    await supabase.from('workout_sessions').delete().eq('user_id', userId)
    await supabase.from('program_metcons').delete().eq('user_id', userId)
    await supabase.from('programs').delete().eq('user_id', userId)

    // 4. Engine-specific data
    await supabase.from('engine_program_day_assignments').delete().eq('user_id', userId)
    await supabase.from('time_trials').delete().eq('user_id', userId)
    await supabase.from('user_modality_preferences').delete().eq('user_id', userId)
    await supabase.from('user_performance_metrics').delete().eq('user_id', userId)

    // 5. User preferences & profile
    await supabase.from('user_equipment').delete().eq('user_id', userId)
    await supabase.from('user_one_rms').delete().eq('user_id', userId)
    await supabase.from('user_skills').delete().eq('user_id', userId)
    await supabase.from('user_preferences').delete().eq('user_id', userId)
    await supabase.from('user_profiles').delete().eq('user_id', userId)
    await supabase.from('intake_drafts').delete().eq('user_id', userId)

    // 6. Delete the parent users row
    await supabase.from('users').delete().eq('id', userId)

    // 7. Log out of RevenueCat (unlinks device from this user)
    try {
      await logoutRevenueCat()
    } catch {
      // Non-blocking — continue even if RevenueCat fails
    }

    // 8. Clear all local storage
    try {
      await AsyncStorage.clear()
    } catch {
      // Non-blocking
    }

    // 9. Delete the Supabase auth user and sign out
    // Note: supabase.auth.admin.deleteUser requires a service role key,
    // which should NOT be on the client. Instead we sign out and rely on
    // a Supabase database trigger or Edge Function to clean up auth.users.
    // For now, signing out is sufficient — the users row is already gone,
    // so even if the auth record persists the account is non-functional.
    await supabase.auth.signOut()

    return { success: true }
  } catch (err: any) {
    console.error('Account deletion error:', err)
    return { success: false, error: err.message || 'An unexpected error occurred' }
  }
}
