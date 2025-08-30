import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

serve(async (req) => {
  try {
    const { user_id, week, day, originalProgram } = await req.json();
    
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

    return new Response(JSON.stringify({
      success: true,
      program: modifiedProgram,
      modificationsApplied: modifiedProgram.modifications || [],
      source: modifiedProgram.modifications ? 'ai-enhanced' : 'original'
    }));

  } catch (error) {
    // Return original program on any error
    return new Response(JSON.stringify({
      success: true,
      program: originalProgram,
      error: error.message
    }));
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
  
  return `
You are an expert CrossFit coach. Analyze this user's recent performance and modify today's program if beneficial.

USER CONTEXT:
- Ability: ${userContext.userProfile.ability}
- Recent Performance: ${JSON.stringify(recentPerformance)}

TODAY'S ORIGINAL PROGRAM:
${JSON.stringify(originalProgram.blocks)}

MODIFICATION GUIDELINES:
1. Reduce volume if recent RPE consistently >8
2. Adjust intensity if completion quality declining
3. Substitute exercises showing poor response patterns
4. Keep modifications subtle and training-block appropriate

Respond with JSON only:
{
  "needsModification": true/false,
  "modifications": [
    {
      "type": "volume_reduction",
      "exercise": "Exercise Name",
      "originalSets": 4,
      "newSets": 3,
      "reason": "Recent RPE 8+ pattern"
    }
  ],
  "modifiedProgram": { /* modified program structure */ }
}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.
`;
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
