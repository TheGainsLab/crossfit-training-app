import { createClient } from '../supabase/client'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { logoutRevenueCat } from '../subscriptions'

/**
 * Delete all user data and account.
 *
 * Calls the server-side `delete_user_account` RPC which runs every
 * delete in a single Postgres transaction (all-or-nothing).
 * The RPC also removes the auth.users row so the account is fully gone.
 *
 * After the server-side work succeeds we clean up local state:
 * RevenueCat logout, AsyncStorage clear, Supabase sign-out.
 */
export async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()

    // Verify the user is authenticated before attempting deletion
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return { success: false, error: 'Not authenticated' }
    }

    // Delete chat attachment files from storage (not covered by the RPC)
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUser.id)
        .single()

      if (userData) {
        const { data: files } = await supabase.storage
          .from('chat-attachments')
          .list(`${userData.id}`)
        if (files && files.length > 0) {
          const paths = files.map(f => `${userData.id}/${f.name}`)
          await supabase.storage.from('chat-attachments').remove(paths)
        }
      }
    } catch {
      // Storage cleanup is best-effort — continue even if it fails
    }

    // Single RPC call deletes all user data + auth record in one transaction
    const { error: rpcError } = await supabase.rpc('delete_user_account')

    if (rpcError) {
      console.error('delete_user_account RPC error:', rpcError)
      return { success: false, error: rpcError.message }
    }

    // Server-side deletion succeeded — clean up local state

    try { await logoutRevenueCat() } catch {}

    try { await AsyncStorage.clear() } catch {}

    // Sign out locally (the auth user is already deleted server-side,
    // but this clears the local session tokens)
    await supabase.auth.signOut()

    return { success: true }
  } catch (err: any) {
    console.error('Account deletion error:', err)
    return { success: false, error: err.message || 'An unexpected error occurred' }
  }
}
