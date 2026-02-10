import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// CORS: reflect a trusted origin for browser calls with Authorization header
const ALLOWED_ORIGINS = [
  'https://www.thegainsai.com',
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
      .eq('program_id', originalProgram?.programId)
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
    .eq('program_id', originalProgram?.programId)
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
   .select('modified_program, modifications_applied, created_at')
   .eq('user_id', user_id)
   .eq('program_id', originalProgram?.programId)
   .eq('week', week)
   .eq('day', day)
   .single();

 console.log(`🔍 Cache check for user ${user_id}, week ${week}, day ${day}:`, cachedModification ? 'FOUND' : 'NOT FOUND')
 if (cachedModification) {
   console.log(`✅ Using cached modification from ${cachedModification.created_at || 'unknown time'}`)
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
    
    console.log(`🤖 Calling AI for user ${user_id}, week ${week}, day ${day}`)
    console.log(`📊 User context: ability=${userContext.userProfile.ability}, recentSessions=${userContext.recentPerformance.length}, plateauConstraints=${Object.keys(userContext.plateauConstraints || {}).length}`)
    
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
try {
  const { data: upsertData, error: upsertError } = await supabase
    .from('modified_workouts')
    .upsert({
      user_id: user_id,
      program_id: originalProgram?.programId || null,
      week: week,
      day: day,
      modified_program: modifiedProgram,
      modifications_applied: modifiedProgram?.modifications || [],
      is_preview: true,
      source: 'ai'  // AI-generated modifications
    }, { onConflict: 'user_id,program_id,week,day' })
    .select()
  
  if (upsertError) {
    console.error(`❌ Failed to store in modified_workouts:`, upsertError)
  } else {
    console.log(`✅ Stored in modified_workouts:`, {
      id: upsertData?.[0]?.id,
      user_id,
      program_id: originalProgram?.programId,
      week,
      day,
      modificationCount: modifiedProgram?.modifications?.length || 0
    })
  }
} catch (e) {
  console.error(`❌ Upsert exception:`, e)
}

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
  
  console.log(`📥 AI Response (raw, first 500 chars):`, aiResponse.substring(0, 500))
  
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

CRITICAL STRUCTURE REQUIREMENTS - YOU MUST FOLLOW THESE EXACTLY:

PROGRAM STRUCTURE HIERARCHY:
- Blocks contain Tasks (exercises)
- Tasks have Sets
- Sets have Reps
- Reps have Weight, Distance, or Time (in weightTime field)

BLOCK RULES:
1. Block names (blockName) MUST NEVER CHANGE - AI cannot modify block names
2. Block order MUST match original exactly
3. Use "blockName" property (not "name") to match original structure

TASK-LEVEL RULES BY BLOCK:

1. SKILLS Block:
   - Sets: Can modify, but MUST be between 1-3 (never 0, never 4+)
   - Reps: Can modify (can be numbers or strings)
   - weightTime: Can modify (usually empty for bodyweight, but can be specified)
   - Task name: Cannot change (cannot remove exercises entirely)
   - Can reduce volume: If original has sets: 3, can reduce to sets: 1 (low volume), but cannot remove the task
   - RESTRICTION: Cannot remove tasks - all original tasks must remain, even if reduced to minimum volume

2. TECHNICAL WORK Block:
   - Sets: Can modify, but MUST be between 1-3 (never 0, never 4+)
   - Reps: Can modify (usually low, 1-5)
   - weightTime: Can modify (usually specified as weight)
   - Task name: Cannot change (cannot remove exercises entirely)
   - Can reduce volume: If original has sets: 3, can reduce to sets: 1 (low volume), but cannot remove the task
   - RESTRICTION: Cannot remove tasks - all original tasks must remain, even if reduced to minimum volume

3. STRENGTH AND POWER Block - SPECIAL RULES:
   - ⚠️ CRITICAL: Each set is a SEPARATE task object with sets: 1
   - Structure: NEVER use sets: 2, sets: 3, etc. - always sets: 1 per task
   - Sets: AI can change the NUMBER of sets (by adding/removing task objects), but each task object must have sets: 1
   - Reps: Can modify, but MUST be between 2-20 (numeric)
   - weightTime: Can modify, but CANNOT exceed the heaviest weight from the original program's heaviest set
   - To reduce volume from 4 sets to 3 sets: Return 3 separate task objects (remove one), each with sets: 1
   - Weight restriction: If heaviest original weight is "265", no modified weight can exceed "265"
   - Task count: Can be changed (add/remove task objects to modify volume), but each task must have sets: 1
   - VIOLATION: Returning { name: "Front Squat", sets: 3, ... } will be REJECTED
   - VIOLATION: Returning reps < 2 or reps > 20 will be REJECTED
   - VIOLATION: Returning weightTime higher than original max weight will be REJECTED

4. ACCESSORIES Block:
   - Sets: Can modify, but MUST be between 1-3 (never 0, never 4+)
   - Reps: Can modify (usually moderate, 5-15)
   - weightTime: Can modify (usually specified as weight)
   - Task name: Cannot change (cannot remove exercises entirely)
   - Can reduce volume: If original has sets: 3, can reduce to sets: 1 (low volume), but cannot remove the task
   - RESTRICTION: Cannot remove tasks - all original tasks must remain, even if reduced to minimum volume

5. METCONS Block:
   - ⚠️ RESTRICTION: AI CANNOT MODIFY METCONS - Return original tasks exactly as provided
   - Do not change task names, sets, reps, weightTime, or notes
   - Preserve the entire METCONS block structure unchanged
   - This restriction may be lifted in the future, but for now METCONS are off-limits

VALIDATION RULES (your response will be rejected if):
- Block name (blockName) is changed
- METCONS block: Any modification attempted (will be rejected)
- SKILLS, TECHNICAL WORK, or ACCESSORIES: sets < 1 or sets > 3
- SKILLS, TECHNICAL WORK, or ACCESSORIES: Task removed (all original tasks must remain)
- STRENGTH AND POWER: sets !== 1 (each task object must have sets: 1)
- STRENGTH AND POWER: reps < 2 or reps > 20
- STRENGTH AND POWER: weightTime exceeds original max weight
- Any block: Missing task name, sets, or reps properties
- Any block: Malformed reps (concatenated numbers like "654" for non-distance tasks)
- Any block: Malformed weightTime (length > 4 chars or value > 1000 for weight values)

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
    
    console.log(`✅ Parsed AI response:`, {
      needsModification: parsed.needsModification,
      modificationCount: parsed.modifications?.length || 0,
      firstModification: parsed.modifications?.[0] || null
    })
    
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
