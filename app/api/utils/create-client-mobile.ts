import { NextRequest } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

/**
 * Creates a Supabase client that works for both web (cookies) and mobile (Authorization header)
 * Tries cookies first (web), then falls back to Authorization header (mobile)
 */
export async function createClientForRequest(request: NextRequest) {
  // First, try the standard server client (uses cookies for web)
  try {
    const serverClient = await createServerClient()
    const { data: { user } } = await serverClient.auth.getUser()
    
    if (user) {
      return serverClient
    }
  } catch (error) {
    // If cookies don't work, try Authorization header
    console.log('Server client failed, trying Authorization header')
  }

  // Fall back to Authorization header (for mobile)
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // Create client with the token
    const client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })

    // Verify the token works by getting the user
    const { data: { user }, error } = await client.auth.getUser(token)
    if (user && !error) {
      return client
    } else {
      console.log('Authorization header token invalid:', error)
    }
  }

  // If neither works, return the server client anyway (will fail auth check)
  return await createServerClient()
}
















