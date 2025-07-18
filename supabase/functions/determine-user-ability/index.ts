import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DetermineUserAbilityRequest {
  namedValues: Record<string, string[]>
}

interface DetermineUserAbilityResponse {
  ability: string
  skills: string[]
  advancedCount: number
  intermediateCount: number
}

export const determineUserAbility = (namedValues: Record<string, string[]>) => {
  // Extract skills with exact same logic as Google Script
  const skills = [
    namedValues['Basic CrossFit skills [Double Unders]'] ? 
      (namedValues['Basic CrossFit skills [Double Unders]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Basic CrossFit skills [Double Unders]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Basic CrossFit skills [Double Unders]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Basic CrossFit skills [Wall Balls]'] ? 
      (namedValues['Basic CrossFit skills [Wall Balls]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Basic CrossFit skills [Wall Balls]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Basic CrossFit skills [Wall Balls]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Upper Body Pulling [Toes to Bar]'] ? 
      (namedValues['Upper Body Pulling [Toes to Bar]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Upper Body Pulling [Toes to Bar]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Upper Body Pulling [Toes to Bar]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Upper Body Pulling [Pull-ups (kipping or butterfly)]'] ? 
      (namedValues['Upper Body Pulling [Pull-ups (kipping or butterfly)]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Upper Body Pulling [Pull-ups (kipping or butterfly)]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Upper Body Pulling [Pull-ups (kipping or butterfly)]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Upper Body Pulling [Chest to Bar Pull-ups]'] ? 
      (namedValues['Upper Body Pulling [Chest to Bar Pull-ups]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Upper Body Pulling [Chest to Bar Pull-ups]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Upper Body Pulling [Chest to Bar Pull-ups]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Upper Body Pulling [Strict Pull-ups]'] ? 
      (namedValues['Upper Body Pulling [Strict Pull-ups]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Upper Body Pulling [Strict Pull-ups]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Upper Body Pulling [Strict Pull-ups]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Upper Body Pressing [Push-ups]'] ? 
      (namedValues['Upper Body Pressing [Push-ups]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Upper Body Pressing [Push-ups]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Upper Body Pressing [Push-ups]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Upper Body Pressing [Ring Dips]'] ? 
      (namedValues['Upper Body Pressing [Ring Dips]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Upper Body Pressing [Ring Dips]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Upper Body Pressing [Ring Dips]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Upper Body Pressing [Strict Ring Dips]'] ? 
      (namedValues['Upper Body Pressing [Strict Ring Dips]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Upper Body Pressing [Strict Ring Dips]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Upper Body Pressing [Strict Ring Dips]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Upper Body Pressing [Strict Handstand Push-ups]'] ? 
      (namedValues['Upper Body Pressing [Strict Handstand Push-ups]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Upper Body Pressing [Strict Handstand Push-ups]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Upper Body Pressing [Strict Handstand Push-ups]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Upper Body Pressing [Wall Facing Handstand Push-ups]'] ? 
      (namedValues['Upper Body Pressing [Wall Facing Handstand Push-ups]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Upper Body Pressing [Wall Facing Handstand Push-ups]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Upper Body Pressing [Wall Facing Handstand Push-ups]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Upper Body Pressing [Deficit Handstand Push-ups (4")]'] ? 
      (namedValues['Upper Body Pressing [Deficit Handstand Push-ups (4")]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Upper Body Pressing [Deficit Handstand Push-ups (4")]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Upper Body Pressing [Deficit Handstand Push-ups (4")]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Additional Common Skills [Alternating Pistols]'] ? 
      (namedValues['Additional Common Skills [Alternating Pistols]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Additional Common Skills [Alternating Pistols]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Additional Common Skills [Alternating Pistols]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Additional Common Skills [GHD Sit-ups]'] ? 
      (namedValues['Additional Common Skills [GHD Sit-ups]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Additional Common Skills [GHD Sit-ups]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Additional Common Skills [GHD Sit-ups]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Additional Common Skills [Wall Walks]'] ? 
      (namedValues['Additional Common Skills [Wall Walks]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Additional Common Skills [Wall Walks]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Additional Common Skills [Wall Walks]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Advanced Upper Body Pulling [Ring Muscle Ups]'] ? 
      (namedValues['Advanced Upper Body Pulling [Ring Muscle Ups]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Advanced Upper Body Pulling [Ring Muscle Ups]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Advanced Upper Body Pulling [Ring Muscle Ups]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Advanced Upper Body Pulling [Bar Muscle Ups]'] ? 
      (namedValues['Advanced Upper Body Pulling [Bar Muscle Ups]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Advanced Upper Body Pulling [Bar Muscle Ups]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Advanced Upper Body Pulling [Bar Muscle Ups]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Advanced Upper Body Pulling [Rope Climbs]'] ? 
      (namedValues['Advanced Upper Body Pulling [Rope Climbs]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Advanced Upper Body Pulling [Rope Climbs]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Advanced Upper Body Pulling [Rope Climbs]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Holds [Wall Facing Handstand Hold]'] ? 
      (namedValues['Holds [Wall Facing Handstand Hold]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Holds [Wall Facing Handstand Hold]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Holds [Wall Facing Handstand Hold]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Holds [Freestanding Handstand Hold]'] ? 
      (namedValues['Holds [Freestanding Handstand Hold]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Holds [Freestanding Handstand Hold]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Holds [Freestanding Handstand Hold]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Advanced Gymnastics [Legless Rope Climbs]'] ? 
      (namedValues['Advanced Gymnastics [Legless Rope Climbs]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Advanced Gymnastics [Legless Rope Climbs]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Advanced Gymnastics [Legless Rope Climbs]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Advanced Gymnastics [Pegboard Ascent]'] ? 
      (namedValues['Advanced Gymnastics [Pegboard Ascent]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Advanced Gymnastics [Pegboard Ascent]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Advanced Gymnastics [Pegboard Ascent]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Advanced Gymnastics [Handstand Walk (10m or 25")]'] ? 
      (namedValues['Advanced Gymnastics [Handstand Walk (10m or 25")]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Advanced Gymnastics [Handstand Walk (10m or 25")]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Advanced Gymnastics [Handstand Walk (10m or 25")]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Advanced Gymnastics [Seated Legless Rope Climbs]'] ? 
      (namedValues['Advanced Gymnastics [Seated Legless Rope Climbs]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Advanced Gymnastics [Seated Legless Rope Climbs]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Advanced Gymnastics [Seated Legless Rope Climbs]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Advanced Gymnastics [Strict Ring Muscle Ups]'] ? 
      (namedValues['Advanced Gymnastics [Strict Ring Muscle Ups]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Advanced Gymnastics [Strict Ring Muscle Ups]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Advanced Gymnastics [Strict Ring Muscle Ups]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it',
    namedValues['Advanced Gymnastics [Handstand Walk Obstacle Crossings]'] ? 
      (namedValues['Advanced Gymnastics [Handstand Walk Obstacle Crossings]'][0].startsWith('Advanced') ? 'Advanced' :
       namedValues['Advanced Gymnastics [Handstand Walk Obstacle Crossings]'][0].startsWith('Intermediate') ? 'Intermediate' :
       namedValues['Advanced Gymnastics [Handstand Walk Obstacle Crossings]'][0].startsWith('Beginner') ? 'Beginner' : 'Don\'t have it') : 'Don\'t have it'
  ];
  
  // Convert skills to numeric levels (exact same logic as Google Script)
  const levels = skills.map(s => {
    if (s.includes('Advanced')) return 3;
    if (s.includes('Intermediate')) return 2;
    if (s.includes('Beginner')) return 1;
    return 0;
  });
  
  // Count skills at each level
  const advancedCount = levels.filter(level => level === 3).length;
  const intermediateCount = levels.filter(level => level === 2).length;
  
  // Apply exact same classification rules as Google Script
  let ability: string;
  if (advancedCount >= 8) {
    ability = 'Advanced';        // 8+ Advanced skills
  } else if (advancedCount >= 4) {
    ability = 'Intermediate';    // 4+ Advanced skills
  } else if (intermediateCount >= 10) {
    ability = 'Intermediate';    // 10+ Intermediate skills
  } else {
    ability = 'Beginner';
  }
  
  return {
    ability,
    skills,
    advancedCount,
    intermediateCount
  };
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { namedValues }: DetermineUserAbilityRequest = await req.json()
    
    if (!namedValues) {
      return new Response(
        JSON.stringify({ error: 'Missing namedValues in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Call the main function
    const result = determineUserAbility(namedValues)

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in determine-user-ability function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
