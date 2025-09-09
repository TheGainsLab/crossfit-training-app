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
    const { user_id, week, day, availableMetcons, preferences } = await req.json();

    console.log(`Selecting intelligent MetCon for user ${user_id}, Week ${week}, Day ${day}`);

    // Get user context and heat map data
    const [userContext, heatMapData] = await Promise.all([
      fetchUserContext(user_id),
      fetchUserHeatMapData(user_id)
    ]);

    // Try AI-based selection first, fallback to random selection
    let selectedMetcon;
    try {
      selectedMetcon = await selectMetconWithAI(availableMetcons, userContext, heatMapData, week, day, preferences);
    } catch (aiError) {
      console.warn('AI MetCon selection failed, using random selection:', aiError.message);
      selectedMetcon = randomMetconSelection(availableMetcons);
    }

    return new Response(JSON.stringify({
      success: true,
      selectedMetcon,
      selectionReason: selectedMetcon.selectionReason || 'Random selection fallback'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('MetCon selection error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function fetchUserContext(user_id: number) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  const response = await fetch(`${supabaseUrl}/functions/v1/build-user-context`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ user_id })
  });

  const data = await response.json();
  if (!data.success) throw new Error('Failed to fetch user context');
  return data.userContext;
}

async function fetchUserHeatMapData(user_id: number) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_user_exercise_heatmap?user_id=${user_id}`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
      }
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn('Failed to fetch heat map data:', error);
  }
  
  return null; // No heat map data available
}

async function selectMetconWithAI(availableMetcons: any[], userContext: any, heatMapData: any, week: number, day: number, preferences: any) {
  const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
  if (!claudeApiKey) throw new Error('Claude API key not found');

  const prompt = buildMetconSelectionPrompt(availableMetcons, userContext, heatMapData, week, day, preferences);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);

  const data = await response.json();
  const aiResponse = data.content[0].text;
  
  return parseMetconSelectionResponse(aiResponse, availableMetcons);
}

function buildMetconSelectionPrompt(availableMetcons: any[], userContext: any, heatMapData: any, week: number, day: number, preferences: any) {
  const weakTimedomains = heatMapData ? identifyWeakTimeDomains(heatMapData) : [];
  const strongTimedomains = heatMapData ? identifyStrongTimeDomains(heatMapData) : [];
  
  const avoided = (preferences?.avoided_exercises || preferences?.avoidedExercises || []).slice(0, 20)
  const preferred = (preferences?.preferred_metcon_exercises || preferences?.preferredMetconExercises || []).slice(0, 20)
  const goals = [preferences?.monthly_primary_goal || preferences?.monthlyPrimaryGoal, preferences?.three_month_goals || preferences?.threeMonthGoals].filter(Boolean).join(' | ')

  return `
You are an expert CrossFit coach selecting the optimal MetCon for this athlete.

USER PROFILE:
- Ability: ${userContext.userProfile.ability}
- Equipment: ${userContext.availableEquipment.join(', ')}

PERFORMANCE DATA:
- Weak time domains: ${weakTimedomains.join(', ') || 'Unknown'}
- Strong time domains: ${strongTimedomains.join(', ') || 'Unknown'}
- Recent performance trends: ${JSON.stringify(userContext.recentPerformance.slice(0, 5))}

GOALS/FOCUS: ${goals || 'n/a'}
AVOID: ${avoided.length ? avoided.join(', ') : 'none'}
PREFER: ${preferred.length ? preferred.join(', ') : 'none'}

AVAILABLE METCONS:
${availableMetcons.slice(0, 10).map((metcon, i) => `
${i + 1}. ${metcon.workout_id}
   Format: ${metcon.format}
   Time Range: ${metcon.time_range}
   Equipment: ${metcon.required_equipment?.join(', ') || 'Bodyweight'}
   Level: ${metcon.level || 'All'}
`).join('')}

SELECTION CRITERIA:
Week ${week}, Day ${day} - ${getTrainingPhaseGuidance(week, day)}

Choose the MetCon that:
1. Addresses user's weak time domains (if data available)
2. Matches their equipment and ability level
3. Provides appropriate stimulus for this training phase
4. Complements recent training patterns
5. EXCLUSION: Do not choose workouts containing exercises in the AVOID list
6. PREFERENCE: Break ties in favor of workouts containing exercises in the PREFER list
7. GOALS: Prefer workouts that align with stated goals

Respond with JSON only:
{
  "selectedIndex": 2,
  "selectionReason": "Targets weak long aerobic domain while using available equipment"
}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.
`;
}

function getTrainingPhaseGuidance(week: number, day: number) {
  if ([4, 8, 12].includes(week)) return "Deload week - moderate intensity";
  if (day <= 2) return "Early week - higher intensity acceptable";
  if (day >= 4) return "Late week - consider recovery demands";
  return "Mid-week - balanced approach";
}

function identifyWeakTimeDomains(heatMapData: any): string[] {
  if (!heatMapData?.timeDomains) return [];
  
  return heatMapData.timeDomains.filter((domain: string) => {
    const domainCells = heatMapData.heatmapCells?.filter((cell: any) => cell.time_range === domain) || [];
    if (domainCells.length === 0) return false;
    
    let totalWeighted = 0;
    let totalSessions = 0;
    domainCells.forEach((cell: any) => {
      totalWeighted += cell.avg_percentile * cell.session_count;
      totalSessions += cell.session_count;
    });
    
    const avgPercentile = totalSessions > 0 ? totalWeighted / totalSessions : 50;
    return avgPercentile < 50; // Below median performance
  });
}

function identifyStrongTimeDomains(heatMapData: any): string[] {
  if (!heatMapData?.timeDomains) return [];
  
  return heatMapData.timeDomains.filter((domain: string) => {
    const domainCells = heatMapData.heatmapCells?.filter((cell: any) => cell.time_range === domain) || [];
    if (domainCells.length === 0) return false;
    
    let totalWeighted = 0;
    let totalSessions = 0;
    domainCells.forEach((cell: any) => {
      totalWeighted += cell.avg_percentile * cell.session_count;
      totalSessions += cell.session_count;
    });
    
    const avgPercentile = totalSessions > 0 ? totalWeighted / totalSessions : 50;
    return avgPercentile > 70; // Above 70th percentile
  });
}

function parseMetconSelectionResponse(aiResponse: string, availableMetcons: any[]) {
  try {
    const cleanResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanResponse);
    
    const selectedIndex = parsed.selectedIndex;
    if (selectedIndex >= 0 && selectedIndex < availableMetcons.length) {
      return {
        ...availableMetcons[selectedIndex],
        selectionReason: parsed.selectionReason
      };
    }
  } catch (error) {
    console.warn('Failed to parse AI MetCon selection');
  }
  
  // Fallback to first available MetCon
  return availableMetcons[0];
}

function randomMetconSelection(availableMetcons: any[]) {
  if (!availableMetcons.length) return null;
  const randomIndex = Math.floor(Math.random() * availableMetcons.length);
  return {
    ...availableMetcons[randomIndex],
    selectionReason: 'Random selection (AI unavailable)'
  };
}
