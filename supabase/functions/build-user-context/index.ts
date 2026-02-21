

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({
        error: 'Missing user_id in request body'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Building user context for user ${user_id}`);

    // Fetch all user data in parallel
const [
  userData,
  oneRMsData,
  skillsData,
  ratiosData,
  performanceData,
  equipmentData,
  plateauData
] = await Promise.all([
  fetchUserProfile(supabase, user_id),
  fetchOneRMs(supabase, user_id),
  fetchUserSkills(supabase, user_id),
  fetchUserRatios(supabase, user_id),
  fetchRecentPerformance(supabase, user_id),
  fetchUserEquipment(supabase, user_id),
  fetchPlateauAnalysis(user_id)
]);    


    // Build comprehensive user context
    const userContext = {
      userProfile: {
        id: user_id,
        name: userData.name,
        ability: 'Intermediate',
        bodyWeight: userData.body_weight || 0,
        gender: userData.gender || 'Male',
        units: userData.units || 'Imperial (lbs)'
      },
      currentStrength: oneRMsData,
      skillLevels: skillsData,
      weaknesses: ratiosData,
      recentPerformance: performanceData,
      availableEquipment: equipmentData,
      
  // ADD THESE TWO LINES:
  plateauAnalysis: plateauData?.plateauAnalysis || null,
  plateauConstraints: plateauData?.activeInterventions || {},
metadata: {
  generatedAt: new Date().toISOString(),
  dataPoints: {
    oneRMs: oneRMsData.length,
    skills: skillsData.length,
    recentSessions: performanceData.length,
    equipment: equipmentData.length,
    plateauAnalysis: plateauData ? 'available' : 'unavailable'  // ADD THIS LINE
  }
}

    };

    return new Response(JSON.stringify({
      success: true,
      userContext,
      summary: {
        userId: user_id,
        ability: 'Intermediate',
        weaknessFlags: Object.keys(ratiosData).filter(key => 
          key.startsWith('needs_') && ratiosData[key] === true
        ).length,
        recentSessions: performanceData.length,
        equipmentCount: equipmentData.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Context building error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Helper functions to fetch data from each table
async function fetchUserProfile(supabase: any, user_id: number) {
  const { data, error } = await supabase
    .from('users')
    .select('name, body_weight, gender, units')
    .eq('id', user_id)
    .single();
  
  if (error) throw new Error(`Failed to fetch user profile: ${error.message}`);
  return data || {};
}


// Add this function after fetchUserProfile and before fetchOneRMs:

async function fetchPlateauAnalysis(user_id: number) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const response = await fetch(`${supabaseUrl}/functions/v1/analyze-plateau-patterns`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_id })
    });
    
    if (!response.ok) {
      console.warn(`Plateau analysis service error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    if (!data.success) {
      console.warn(`Plateau analysis failed: ${data.error}`);
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn('Plateau analysis failed:', error.message);
    return null; // Graceful degradation
  }
}


async function fetchOneRMs(supabase: any, user_id: number) {
  const { data, error } = await supabase
    .from('user_one_rms')
    .select('one_rm_index, exercise_name, one_rm')
    .eq('user_id', user_id)
    .order('one_rm_index');
  
  if (error) throw new Error(`Failed to fetch 1RMs: ${error.message}`);
  return data || [];
}

async function fetchUserSkills(supabase: any, user_id: number) {
  const { data, error } = await supabase
    .from('user_skills')
    .select('skill_index, skill_name, skill_level')
    .eq('user_id', user_id)
    .order('skill_index');
  
  if (error) throw new Error(`Failed to fetch skills: ${error.message}`);
  return data || [];
}

async function fetchUserRatios(supabase: any, user_id: number) {
  const { data, error } = await supabase
    .from('user_ratios')
    .select('*')
    .eq('user_id', user_id)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch ratios: ${error.message}`);
  }
  return data || {};
}

async function fetchRecentPerformance(supabase: any, user_id: number) {
  // Fetch the 40 most recent logs regardless of date
  const { data, error } = await supabase
    .from('performance_logs')
    .select('exercise_name, rpe, completion_quality, logged_at, week, day')
    .eq('user_id', user_id)
    .order('logged_at', { ascending: false })
    .limit(40);
  
  if (error) throw new Error(`Failed to fetch recent performance: ${error.message}`);
  return data || [];
}

async function fetchUserEquipment(supabase: any, user_id: number) {
  const { data, error } = await supabase
    .from('user_equipment')
    .select('equipment_name')
    .eq('user_id', user_id);
  
  if (error) throw new Error(`Failed to fetch equipment: ${error.message}`);
  return data ? data.map(item => item.equipment_name) : [];
}

