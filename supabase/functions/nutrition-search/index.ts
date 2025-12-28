import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Call FatSecret API through proxy server
async function callFatSecretAPI(method: string, params: Record<string, string | number>): Promise<any> {
  // Proxy server URL (static IP whitelisted in FatSecret)
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
  
  console.log('Proxy response structure:', JSON.stringify({
    success: result.success,
    hasData: !!result.data,
    dataType: typeof result.data,
    dataKeys: result.data ? Object.keys(result.data).slice(0, 5) : null
  }))
  
  if (!result.success) {
    console.error('Proxy returned unsuccessful response:', result)
    throw new Error(result.error || 'Proxy returned unsuccessful response')
  }

  // Proxy returns {success: true, data: {...}}
  // The data contains the FatSecret API response
  return result.data
}

// Helper to normalize foods.search response (handles single vs array quirk)
function normalizeFoodsSearchResponse(response: any): {
  foods: any[]
  pagination: {
    page: number
    maxResults: number
    total: number
  }
} {
  // Add defensive checks
  if (!response) {
    console.error('Response is null or undefined')
    throw new Error('Invalid response from FatSecret API')
  }

  const { foods } = response
  
  if (!foods) {
    console.error('Response missing foods property. Full response:', JSON.stringify(response))
    throw new Error('Invalid response structure: missing foods property')
  }

  // Handle case where foods.food doesn't exist
  if (!foods.food) {
    console.error('Response missing foods.food property:', JSON.stringify(foods))
    // Return empty array if no foods found
    return {
      foods: [],
      pagination: {
        page: 0,
        maxResults: 0,
        total: 0,
      },
    }
  }
  
  // Handle the single vs array quirk
  const foodArray = Array.isArray(foods.food) 
    ? foods.food 
    : [foods.food]
  
  return {
    foods: foodArray,
    pagination: {
      page: parseInt(foods.page_number || '0', 10),
      maxResults: parseInt(foods.max_results || '0', 10),
      total: parseInt(foods.total_results || '0', 10),
    },
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get auth header
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
    const { 
      query, 
      pageNumber = 0, 
      maxResults = 20,
      filterType = 'all',  // NEW: 'brand', 'generic', 'all'
      brandName = null     // NEW: optional - filter to specific brand
    } = await req.json()

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Query parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call FatSecret API
    const result = await callFatSecretAPI('foods.search', {
      search_expression: query.trim(),
      page_number: pageNumber,
      max_results: maxResults,
    })

    console.log('FatSecret API response:', JSON.stringify(result).substring(0, 500)) // Log first 500 chars
    console.log('Result type:', typeof result)
    console.log('Result keys:', result ? Object.keys(result) : 'null')
    console.log('Has foods property?', result?.foods ? 'YES' : 'NO')

    // Normalize response (handle single vs array quirk)
    const normalized = normalizeFoodsSearchResponse(result)

    // Apply filters if requested
    let filtered = normalized.foods

    if (filterType === 'brand') {
      // Show only branded items (items with brand_name)
      filtered = filtered.filter((f: any) => f.brand_name && f.brand_name.trim().length > 0)
    } else if (filterType === 'generic') {
      // Show only generic items (items without brand_name)
      filtered = filtered.filter((f: any) => !f.brand_name || f.brand_name.trim().length === 0)
    }

    // Filter by specific brand name if provided
    if (brandName && typeof brandName === 'string') {
      const searchBrand = brandName.toLowerCase()
      filtered = filtered.filter((f: any) => 
        f.brand_name && f.brand_name.toLowerCase().includes(searchBrand)
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          foods: filtered,
          pagination: {
            ...normalized.pagination,
            total: filtered.length,
            filtered: filterType !== 'all' || brandName !== null
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Nutrition search error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
