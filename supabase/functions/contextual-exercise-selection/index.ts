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
    const { 
      filteredExercises, 
      userContext, 
      block, 
      mainLift, 
      numExercises,
      weeklyFrequencies,
      dailyContext
    } = await req.json();

    console.log(`Contextual selection for ${block}: ${filteredExercises.length} candidates, need ${numExercises}`);

    // Try AI-enhanced selection first, fallback to probabilistic selection
    let selectedExercises;
    try {
      selectedExercises = await selectExercisesWithAI(
        filteredExercises, 
        userContext, 
        block, 
        mainLift, 
        numExercises,
        weeklyFrequencies,
        dailyContext
      );
    } catch (aiError) {
      console.warn('AI exercise selection failed:', aiError.message);
      selectedExercises = fallbackProbabilisticSelection(filteredExercises, userContext, numExercises);
    }

    return new Response(JSON.stringify({
      success: true,
      selectedExercises,
      selectionMethod: selectedExercises.some(ex => ex.aiReason) ? 'ai-contextual' : 'probabilistic-fallback'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Contextual selection error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function selectExercisesWithAI(
  filteredExercises: any[], 
  userContext: any, 
  block: string, 
  mainLift: string, 
  numExercises: number,
  weeklyFrequencies: any,
  dailyContext: any
) {
  const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
  if (!claudeApiKey) throw new Error('Claude API key not found');

  const prompt = buildExerciseSelectionPrompt(
    filteredExercises, 
    userContext, 
    block, 
    mainLift, 
    numExercises,
    weeklyFrequencies,
    dailyContext
  );

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);

  const data = await response.json();
  const aiResponse = data.content[0].text;
  
  return parseExerciseSelectionResponse(aiResponse, filteredExercises);
}

function buildExerciseSelectionPrompt(
  filteredExercises: any[], 
  userContext: any, 
  block: string, 
  mainLift: string, 
  numExercises: number,
  weeklyFrequencies: any,
  dailyContext: any
) {
  // Analyze recent performance patterns for each exercise
  const exercisePerformance = filteredExercises.map(ex => {
    const recentSessions = userContext.recentPerformance.filter((p: any) => p.exercise_name === ex.name);
    const avgRPE = recentSessions.reduce((sum: number, s: any) => sum + (s.rpe || 5), 0) / Math.max(recentSessions.length, 1);
    const avgQuality = recentSessions.reduce((sum: number, s: any) => sum + (s.completion_quality || 3), 0) / Math.max(recentSessions.length, 1);
    
    return {
      name: ex.name,
      recentSessions: recentSessions.length,
      avgRPE: Math.round(avgRPE * 10) / 10,
      avgQuality: Math.round(avgQuality * 10) / 10,
      weeklyFrequency: weeklyFrequencies[ex.name] || 0,
      difficulty: ex.difficulty_level,
      category: ex.accessory_category || block
    };
  });

  const userWeaknesses = Object.keys(userContext.weaknesses).filter(key => 
    key.startsWith('needs_') && userContext.weaknesses[key] === true
  );

  return `
You are an expert CrossFit coach selecting optimal exercises for personalized programming.

USER PROFILE:
- Ability: ${userContext.userProfile.ability}
- Current weaknesses: ${userWeaknesses.join(', ')}
- Recent training quality: ${userContext.recentPerformance.slice(0, 3).map((p: any) => `${p.exercise_name}: RPE ${p.rpe}, Quality ${p.completion_quality}`).join('; ')}

TRAINING BLOCK: ${block} for ${mainLift}
NEED TO SELECT: ${numExercises} exercises

AVAILABLE EXERCISES WITH PERFORMANCE DATA:
${exercisePerformance.slice(0, 15).map(ex => 
  `- ${ex.name} (${ex.difficulty}): Recent sessions: ${ex.recentSessions}, Avg RPE: ${ex.avgRPE}, Quality: ${ex.avgQuality}, Weekly freq: ${ex.weeklyFrequency}`
).join('\n')}

SELECTION CRITERIA:
1. Avoid exercises with recent high RPE (>8) or declining quality
2. Balance weekly frequencies to prevent overuse
3. Target user weaknesses when possible
4. Consider exercise combinations that complement each other
5. Sequence from easier to harder within the session

Respond with JSON only:
{
  "selectedExercises": [
    {
      "name": "Exercise Name",
      "selectionReason": "Targets upper back weakness, low recent RPE"
    }
  ]
}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.
`;
}

function parseExerciseSelectionResponse(aiResponse: string, filteredExercises: any[]) {
  try {
    const cleanResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanResponse);
    
    if (!parsed.selectedExercises || !Array.isArray(parsed.selectedExercises)) {
      throw new Error('Invalid AI response format');
    }

    const selectedExercises = parsed.selectedExercises.map((aiSelection: any) => {
      const exercise = filteredExercises.find(ex => ex.name === aiSelection.name);
      return exercise ? {
        ...exercise,
        aiReason: aiSelection.selectionReason
      } : null;
    }).filter(Boolean);

    return selectedExercises;
    
  } catch (error) {
    console.warn('Failed to parse AI exercise selection:', error);
    throw error;
  }
}

function fallbackProbabilisticSelection(filteredExercises: any[], userContext: any, numExercises: number) {
  // Use your existing probabilistic selection logic as fallback
  const abilityIndex = userContext.userProfile.ability === 'Advanced' ? 'advanced_weight' : 
                      userContext.userProfile.ability === 'Intermediate' ? 'intermediate_weight' : 
                      'beginner_weight';

  const weights = filteredExercises.map(exercise => 
    parseFloat(exercise[abilityIndex]) || parseFloat(exercise.default_weight) || 5
  );
  
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const probabilities = weights.map(w => w / totalWeight);
  
  const selectedIndices: number[] = [];
  const selected: any[] = [];
  
  for (let i = 0; i < numExercises && i < filteredExercises.length; i++) {
    const rand = Math.random();
    let cumulative = 0;
    
    for (let j = 0; j < probabilities.length; j++) {
      cumulative += probabilities[j];
      if (rand <= cumulative && !selectedIndices.includes(j)) {
        selectedIndices.push(j);
        selected.push({
          ...filteredExercises[j],
          selectionMethod: 'probabilistic'
        });
        probabilities.splice(j, 1);
        break;
      }
    }
  }
  
  return selected;
}
