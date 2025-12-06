import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null

export function createClient() {
  // Lazy initialization - only create when actually needed
  if (supabaseInstance) {
    return supabaseInstance
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

  console.log('🔑 SUPABASE CLIENT INIT:', { 
    url: supabaseUrl,
    urlDefined: !!supabaseUrl,
    keyDefined: !!supabaseAnonKey,
    keyLength: supabaseAnonKey?.length,
    keyPreview: supabaseAnonKey?.substring(0, 20) + '...'
  })

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not configured')
  }

  supabaseInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })

  return supabaseInstance
}
