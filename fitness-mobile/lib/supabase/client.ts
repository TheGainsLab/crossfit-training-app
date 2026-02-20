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
    global: {
      fetch: async (url, options = {}) => {
        const maxRetries = 3
        const retryDelay = 1000 // 1 second base delay
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const response = await fetch(url, options)
            
            // If successful, return immediately
            if (response.ok) {
              return response
            }
            
            // If it's a server error (5xx) or timeout, retry
            if (attempt < maxRetries && (response.status >= 500 || response.status === 408)) {
              if (__DEV__) console.log(`Supabase retry ${attempt}/${maxRetries} - Status ${response.status}`)
              await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
              continue
            }
            
            // For other errors (4xx), don't retry - return the error response
            return response
          } catch (error) {
            // Network error (e.g., "Network request failed") - retry
            if (attempt < maxRetries) {
              if (__DEV__) console.log(`Supabase network error, retry ${attempt}/${maxRetries}`)
              await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
              continue
            }
            // All retries exhausted, throw the error
            throw error
          }
        }
        
        // This shouldn't be reached, but TypeScript requires a return
        throw new Error('Max retries exceeded')
      }
    }
  })

  return supabaseInstance
}
