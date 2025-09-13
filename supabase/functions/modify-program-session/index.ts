import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// CORS: reflect a trusted origin for browser calls with Authorization header
const ALLOWED_ORIGINS = [
  'https://www.thegainsapps.com',
  'https://crossfit-training-app.vercel.app',
  'http://localhost:3000'
];

function buildCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-authorization, x-requested-with',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin'
  }
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Parse payload outside try so we can safely reference it later
  let payload: any = null;
  try {
    payload = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON payload' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { user_id, week, day, originalProgram } = payload || {};

  try {
  
 // ADD THIS COMPLETION/CACHE CHECK HERE:
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data: completedLogs } = await supabase
      .from('performance_logs')
      .select('id')
      .eq('user_id', user_id)
      .eq('week', week)
      .eq('day', day)
      .limit(1);
    
// If day is completed, check for stored modified version
if (completedLogs && completedLogs.length > 0) {
  // Look for stored modified version
  const { data: storedModification } = await supabase
    .from('modified_workouts')
    .select('modified_program, modifications_applied')
    .eq('user_id', user_id)
    .eq('week', week)
    .eq('day', day)
    .single();

  return new Response(JSON.stringify({
    success: true,
    program: storedModification ? storedModification.modified_program : originalProgram,
    modificationsApplied: storedModification ? storedModification.modifications_applied : [],
    source: storedModification ? 'stored-modified' : 'original-completed',
    plateauInterventions: {},
    plateauStatus: 'completed-day'
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
   
 // If not completed, return cached modified workout if it exists to avoid re-calling AI on every load
 const { data: cachedModification } = await supabase
   .from('modified_workouts')
   .select('modified_program, modifications_applied')
   .eq('user_id', user_id)
   .eq('week', week)
   .eq('day', day)
   .single();

 if (cachedModification) {
   return new Response(JSON.stringify({
     success: true,
     program: cachedModification.modified_program,
     modificationsApplied: cachedModification.modifications_applied || [],
     source: 'stored-modified',
     plateauInterventions: {},
     plateauStatus: 'not-completed'
   }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
 }
 
 // END OF NEW CODE 

    // Get user context and recent performance
    const userContext = await buildUserContext(user_id);
    
    // Try AI modifications, fallback to original program
    let modifiedProgram;
    try {
      modifiedProgram = await applyAIModifications(originalProgram, userContext);
    } catch (aiError) {
      console.warn('AI modifications failed, using original program');
      modifiedProgram = originalProgram;
    }

// ADD STORAGE LOGIC HERE (before the return statement):
// Store the modified workout (even if no modifications) so subsequent loads use cache instead of re-calling AI
await supabase
  .from('modified_workouts')
  .upsert({
    user_id: user_id,
    program_id: originalProgram?.programId || null,
    week: week,
    day: day,
    modified_program: modifiedProgram,
    modifications_applied: modifiedProgram?.modifications || [],
    is_preview: true,
    source: 'on_load' // or 'weekly'/'chat' when applicable
  });

return new Response(JSON.stringify({
  success: true,
  program: modifiedProgram,
  modificationsApplied: modifiedProgram.modifications || [],
  plateauInterventions: userContext.plateauConstraints || {},
  plateauStatus: userContext.plateauAnalysis?.overallStatus || 'unknown',
  source: modifiedProgram.modifications ? 'ai-enhanced' : 'original'
}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    // Return original program on any error (if provided)
    return new Response(JSON.stringify({
      success: true,
      program: originalProgram ?? null,
      error: (error as any)?.message || 'Unknown error'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function buildUserContext(user_id: number) {
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
  if (!data.success) throw new Error('Failed to build user context');
  return data.userContext;
}

async function applyAIModifications(originalProgram: any, userContext: any) {
  const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
  if (!claudeApiKey) throw new Error('Claude API key not found');

  const prompt = buildModificationPrompt(originalProgram, userContext);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);

  const data = await response.json();
  const aiResponse = data.content[0].text;
  
  return parseModificationResponse(aiResponse, originalProgram);
}


function buildModificationPrompt(originalProgram: any, userContext: any) {
  const recentPerformance = userContext.recentPerformance.slice(0, 10);
  const plateauConstraints = userContext.plateauConstraints || {};
  const plateauAnalysis = userContext.plateauAnalysis;
  
  let prompt = `You are an expert CrossFit coach with advanced periodization knowledge. Analyze this user's performance patterns and modify today's program strategically.

USER CONTEXT:
- Ability: ${userContext.userProfile.ability}
- Recent Performance (A4 Data): ${JSON.stringify(recentPerformance)}`;

  // Add plateau analysis if available (A11 Data)
if (plateauAnalysis && Object.keys(plateauConstraints).length > 0) {
  prompt += `
- PLATEAU STATUS (A11 Analysis): Active interventions detected
- ACTIVE INTERVENTIONS: ${JSON.stringify(plateauConstraints)}`;
}  


  prompt += `

TODAY'S ORIGINAL PROGRAM:
${JSON.stringify(originalProgram.blocks)}

MODIFICATION HIERARCHY:
A11 STRATEGIC RULES (Only apply when plateauConstraints has entries):
${Object.keys(plateauConstraints).length > 0 ? 
  Object.entries(plateauConstraints).map(([exercise, constraints]: [string, any]) => 
    `- ${exercise}: ${constraints.protocol} protocol active. Use ${constraints.exerciseModification}, intensity ${(constraints.intensityRange[0] * 100).toFixed(0)}-${(constraints.intensityRange[1] * 100).toFixed(0)}%, volume modifier ${constraints.volumeModifier}x`
  ).join('\n') : '- No plateau interventions active - use only A4 tactical rules below'
}

A4 TACTICAL RULES (Always active, work within A11 constraints):
1. Reduce volume if recent RPE consistently >8
2. Adjust intensity if completion quality declining
3. Substitute exercises showing poor response patterns
4. Fine-tune within plateau intervention ranges when active

PLATEAU INTERVENTION GUIDE:
- TEMPO_WORK: Add tempo phases (3-4 sec eccentric), reduce intensity by 10-15%
- INTENSITY_REDUCTION: Lower loads by 15-20%, increase volume slightly
- VOLUME_PROGRESSION: Reduce volume by 20%, maintain or slightly increase intensity

EXERCISE MODIFICATION EXAMPLES:
- tempo_variation: "Back Squat" → "Tempo Back Squat (4-sec descent)"
- standard: Keep original exercise name

Respond with JSON only:
{
  "needsModification": true/false,
  "modifications": [
    {
      "type": "plateau_intervention" | "volume_reduction" | "intensity_adjustment",
      "exercise": "Exercise Name",
      "originalSets": 4,
      "newSets": 3,
      "originalReps": 5,
      "newReps": 6,
      "originalIntensity": "75%",
      "newIntensity": "65%",
      "exerciseModification": "tempo_variation",
      "reason": "A11: Breaking 4-week plateau with tempo protocol" | "A4: Recent RPE 8+ pattern"
    }
  ],
  "modifiedProgram": { /* modified program structure */ }
}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.`;

  return prompt;
}
function parseModificationResponse(aiResponse: string, originalProgram: any) {
  try {
    const cleanResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanResponse);
    
    if (!parsed.needsModification) {
      return { 
        ...originalProgram,
        modifications: []
      };
    }
    
    return {
      ...parsed.modifiedProgram,
      modifications: parsed.modifications
    };
    
  } catch (error) {
    console.warn('Failed to parse AI modifications, using original program');
    return originalProgram;
  }
}
