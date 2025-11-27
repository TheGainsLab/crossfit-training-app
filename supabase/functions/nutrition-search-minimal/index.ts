// Test 1: Just the serve import
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('Minimal test - serve import works')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Serve import works!' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
