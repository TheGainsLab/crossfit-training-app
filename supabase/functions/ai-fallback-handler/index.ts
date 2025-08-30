import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { fallbackType, context } = await req.json();

    console.log(`Executing fallback for: ${fallbackType}`);

    let fallbackResult;
    
    switch (fallbackType) {
      case 'frequency-weights':
        fallbackResult = generateStaticFrequencyWeights(context);
        break;
      case 'program-notes':
        fallbackResult = generateStaticProgramNotes(context);
        break;
      case 'exercise-selection':
        fallbackResult = performBasicExerciseSelection(context);
        break;
      default:
        throw new Error(`No fallback available for: ${fallbackType}`);
    }

    return new Response(JSON.stringify({
      success: true,
      result: fallbackResult,
      source: 'algorithmic-fallback',
      fallbackType
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Fallback handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Fallback function implementations
function generateStaticFrequencyWeights(context: any) {
  const { exercises } = context;
  
  // Use your existing static weight logic
  return exercises.map((exercise: any) => ({
    exerciseName: exercise.name,
    weight: parseFloat(exercise.default_weight) || 5.0,
    source: 'static'
  }));
}

function generateStaticProgramNotes(context: any) {
  const { exercise, userAbility } = context;
  
  // Return basic program notes based on ability level
  const basicNotes = {
    'Beginner': { sets: 3, reps: 10, notes: 'Focus on form' },
    'Intermediate': { sets: 4, reps: 8, notes: 'Moderate intensity' },
    'Advanced': { sets: 5, reps: 6, notes: 'High intensity' }
  };
  
  return basicNotes[userAbility] || basicNotes['Beginner'];
}

function performBasicExerciseSelection(context: any) {
  const { availableExercises, numNeeded } = context;
  
  // Simple random selection as fallback
  const shuffled = availableExercises.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, numNeeded);
}
