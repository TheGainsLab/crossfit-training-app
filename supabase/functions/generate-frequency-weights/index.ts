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
    const { exercises, userContext, block } = await req.json();

    // Try AI first, fallback to static weights if AI fails
    let weights;
    try {
      weights = await generateAIFrequencyWeights(exercises, userContext, block);
    } catch (aiError) {
      console.warn('AI frequency weights failed:', aiError.message);
      weights = generateStaticWeights(exercises);
    }

    return new Response(JSON.stringify({
      success: true,
      weights,
      source: weights.some(w => w.adjustmentReason) ? 'ai-enhanced' : 'static-fallback'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Frequency weights error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function generateAIFrequencyWeights(exercises: any[], userContext: any, block: string) {
  const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
  if (!claudeApiKey) throw new Error('Claude API key not found');

  // Build AI prompt with user context and recent performance
  const prompt = buildFrequencyWeightPrompt(exercises, userContext, block);

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

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const aiResponse = data.content[0].text;

  // Parse AI response into frequency weights
  return parseAIWeightsResponse(aiResponse, exercises);
}

function buildFrequencyWeightPrompt(exercises: any[], userContext: any, block: string) {
  const recentPerformance = userContext.recentPerformance
    .filter((p: any) => exercises.some((ex: any) => ex.name === p.exercise_name))
    .slice(0, 10); // Last 10 relevant sessions

  return `
You are an expert CrossFit programmer. Analyze this user's data and adjust exercise frequency weights for optimal programming.

USER PROFILE:
- Ability: ${userContext.userProfile.ability}
- Weaknesses: ${JSON.stringify(userContext.weaknesses)}
- Recent Performance Patterns: ${JSON.stringify(recentPerformance)}

CURRENT BLOCK: ${block}

EXERCISES TO WEIGHT:
${exercises.map(ex => `- ${ex.name} (current weight: ${ex.default_weight})`).join('\n')}

INSTRUCTIONS:
Adjust frequency weights based on:
1. Recent RPE trends (reduce weight if consistently >8)
2. Completion quality patterns (increase weight if improving)
3. User weaknesses (emphasize weakness-addressing exercises)
4. Individual response patterns

Respond with JSON only:
{
  "weights": [
    {
      "exerciseName": "Exercise Name",
      "weight": 7.5,
      "adjustmentReason": "High RPE pattern suggests overuse"
    }
  ]
}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.
`;
}

function parseAIWeightsResponse(aiResponse: string, exercises: any[]) {
  try {
    // Clean response of any markdown formatting
    const cleanResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanResponse);
    
    if (!parsed.weights || !Array.isArray(parsed.weights)) {
      throw new Error('Invalid AI response format');
    }

    // Ensure all exercises have weights (fill missing ones with defaults)
    const aiWeights = parsed.weights;
    const result = exercises.map(ex => {
      const aiWeight = aiWeights.find((w: any) => w.exerciseName === ex.name);
      return {
        exerciseName: ex.name,
        weight: aiWeight ? aiWeight.weight : parseFloat(ex.default_weight) || 5.0,
        adjustmentReason: aiWeight ? aiWeight.adjustmentReason : null
      };
    });

    return result;
  } catch (error) {
    throw new Error('Failed to parse AI weights response');
  }
}

function generateStaticWeights(exercises: any[]) {
  return exercises.map(ex => ({
    exerciseName: ex.name,
    weight: parseFloat(ex.default_weight) || 5.0,
    adjustmentReason: null
  }));
}
