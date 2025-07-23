import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DetermineUserAbilityRequest {
  user_id: number
}

interface DetermineUserAbilityResponse {
  ability: string
  skills: string[]
  advancedCount: number
  intermediateCount: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { user_id }: DetermineUserAbilityRequest = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`🎯 Determining ability for user ${user_id}`)

    // Query user skills from database (latest for each skill)
    const { data: userSkills, error: skillsError } = await supabase
      .from('latest_user_skills')
      .select(`
        skill_index,
        skill_name,
        skill_level
      `)
      .eq('user_id', user_id)
      .order('skill_index')

    if (skillsError) {
      console.error('Database error fetching skills:', skillsError)
      throw new Error(`Failed to fetch user skills: ${skillsError.message}`)
    }

    if (!userSkills || userSkills.length === 0) {
      console.log('No skills found for user, returning beginner defaults')
      return new Response(
        JSON.stringify({
          ability: 'Beginner',
          skills: Array(26).fill("Don't have it"), // 26 skills with default values
          advancedCount: 0,
          intermediateCount: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Convert database skills to the expected array format (26 skills total)
    const skills = Array(26).fill("Don't have it")
    
    userSkills.forEach(skill => {
      if (skill.skill_index >= 0 && skill.skill_index < 26) {
        skills[skill.skill_index] = skill.skill_level
      }
    })

    console.log(`✅ Found ${userSkills.length} skills for user ${user_id}`)

    // Apply exact same classification logic as original Google Script
    const result = determineUserAbility(skills)

    console.log(`✅ User ability determined: ${result.ability} (${result.advancedCount} advanced skills)`)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

// === ABILITY DETERMINATION LOGIC (Exact same as Google Script) ===
function determineUserAbility(skills: string[]): DetermineUserAbilityResponse {
  // Convert skills to numeric levels (exact same logic as Google Script)
  const levels = skills.map(s => {
    if (s.includes('Advanced')) return 3
    if (s.includes('Intermediate')) return 2
    if (s.includes('Beginner')) return 1
    return 0
  })
  
  // Count skills at each level
  const advancedCount = levels.filter(level => level === 3).length
  const intermediateCount = levels.filter(level => level === 2).length
  
  // Apply exact same classification rules as Google Script
  let ability: string
  if (advancedCount >= 8) {
    ability = 'Advanced'        // 8+ Advanced skills
  } else if (advancedCount >= 4) {
    ability = 'Intermediate'    // 4+ Advanced skills
  } else if (intermediateCount >= 10) {
    ability = 'Intermediate'    // 10+ Intermediate skills
  } else {
    ability = 'Beginner'
  }
  
  return {
    ability,
    skills,
    advancedCount,
    intermediateCount
  }
}
