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
    const { user_id, conversation_id, message, conversation_history } = await req.json();

    console.log(`Processing training chat for user ${user_id}`);


    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Gather comprehensive user context for personalized responses
    const userContext = await gatherTrainingContext(supabase, user_id);
    
    // Check for safety concerns and coach escalation needs
    const safetyAnalysis = await analyzeSafetyAndEscalation(message, conversation_history);

    // Generate AI response with full training context
    const aiResponse = await generateTrainingAssistantResponse(
      userContext, 
      message, 
      conversation_history,
      safetyAnalysis
    );

    // Store the conversation in database
    const messageId = await storeConversationMessage(
      supabase,
      conversation_id,
      'assistant',
      aiResponse.content,
      {
        safety_flags: safetyAnalysis,
        context_used: userContext.summary,
        response_type: aiResponse.responseType
      }
    );

    // Generate coach alerts if needed
    if (safetyAnalysis.coachAlertNeeded) {
      await createCoachAlert(supabase, user_id, conversation_id, messageId, safetyAnalysis);
    }

    return new Response(JSON.stringify({
      success: true,
      response: aiResponse.content,
      responseType: aiResponse.responseType,
      messageId,
      coachAlertGenerated: safetyAnalysis.coachAlertNeeded,
      contextSummary: userContext.summary
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Training assistant error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to generate training response'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function gatherTrainingContext(supabase: any, user_id: number) {
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  // Gather comprehensive training data
  const [userProfile, currentProgram, recentPerformance, analyticsInsights, coachRelationships] = await Promise.all([
    // User profile and goals
    supabase
      .from('users')
      .select('name, ability_level, gender, body_weight, units, goals, created_at')
      .eq('id', user_id)
      .single(),

    // Current program details
    supabase
      .from('programs')
      .select(`
        id, generated_at, program_type, 
        program_workouts(week, day, main_lift, is_deload)
      `)
      .eq('user_id', user_id)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single(),

    // Recent performance logs
    supabase
      .from('performance_logs')
      .select('*')
      .eq('user_id', user_id)
      .gte('logged_at', twoWeeksAgo.toISOString())
      .order('logged_at', { ascending: false })
      .limit(50),

    // Get fresh A8 insights by calling your existing predictive modeling
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/predictive-performance-modeling`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_id: user_id })
    }).then(res => res.ok ? res.json() : null).catch(() => null),

    // Coach relationships
    supabase
      .from('coach_athlete_relationships')
      .select('coaches(coach_name)')
      .eq('athlete_id', user_id)
      .eq('status', 'active')
  ]);

  // Calculate recent training patterns
  const recentLogs = recentPerformance.data || [];
  const trainingFrequency = calculateRecentTrainingFrequency(recentLogs);
  const performanceTrends = analyzeRecentPerformance(recentLogs);
  const currentWeek = getCurrentProgramWeek(currentProgram.data);

  return {
    profile: userProfile.data,
    program: {
      id: currentProgram.data?.id,
      currentWeek,
      currentDay: getCurrentProgramDay(),
      recentWorkouts: currentProgram.data?.program_workouts?.slice(-7) || []
    },
    performance: {
      recentLogs: recentLogs.slice(0, 10), // Last 10 sessions
      trainingFrequency,
      trends: performanceTrends
    },
    insights: analyticsInsights?.predictions || null,
    coaches: coachRelationships.data || [],
    summary: {
      totalRecentSessions: recentLogs.length,
      avgRecentRPE: recentLogs.reduce((sum, log) => sum + (log.rpe || 0), 0) / Math.max(1, recentLogs.length),
      trainingConsistency: trainingFrequency.consistency,
      hasActiveCoach: (coachRelationships.data || []).length > 0
    }
  };
}

async function generateTrainingAssistantResponse(userContext: any, userMessage: string, conversationHistory: any[], safetyAnalysis: any) {
const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');  
console.log('API Key exists:', !!claudeApiKey);
console.log('API Key length:', claudeApiKey?.length || 0);
console.log('API Key starts with sk-ant:', claudeApiKey?.startsWith('sk-ant-'));

if (!claudeApiKey) throw new Error('Claude API key not found');

  const prompt = buildTrainingAssistantPrompt(userContext, userMessage, conversationHistory, safetyAnalysis);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
model: "claude-3-5-haiku-20241022", // Haiku model
      max_tokens: 2000,
messages: [
  {
    role: "user",
    content: prompt
  }
]      
    })
  });

console.log('Claude API Response Status:', response.status);
if (!response.ok) {
  const errorText = await response.text();
  console.log('Claude API Error Details:', errorText);
  throw new Error(`Claude API error: ${response.status} - ${errorText}`);
}

  const data = await response.json();
  const aiResponse = data.content[0].text;

  return {
    content: aiResponse,
    responseType: determineResponseType(userMessage, aiResponse, safetyAnalysis)
  };
}

function buildTrainingAssistantPrompt(userContext: any, userMessage: string, conversationHistory: any[], safetyAnalysis: any): string {
  const { profile, program, performance, insights, coaches } = userContext;

  return `
You are a knowledgeable CrossFit training assistant for ${profile?.name || 'this athlete'}. You have access to their complete training data and should provide personalized, contextual advice.

ATHLETE PROFILE:
- Name: ${profile?.name || 'Unknown'}
- Experience: ${profile?.ability_level || 'Unknown'} level
- Training Age: ${profile?.created_at ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)) : '?'} months
- Has Active Coach: ${coaches.length > 0 ? `Yes (${coaches.map(c => c.coaches.coach_name).join(', ')})` : 'No'}

CURRENT PROGRAM CONTEXT:
- Program ID: ${program.id}
- Current Week: ${program.currentWeek}
- Recent Workouts: ${program.recentWorkouts.map(w => `Week ${w.week} Day ${w.day}: ${w.main_lift}${w.is_deload ? ' (Deload)' : ''}`).join(', ')}

RECENT PERFORMANCE (Last 2 weeks):
- Sessions Completed: ${performance.recentLogs.length}
- Average RPE: ${userContext.summary.avgRecentRPE.toFixed(1)}/10
- Training Frequency: ${performance.trainingFrequency.sessionsPerWeek.toFixed(1)} sessions/week
- Recent Exercises: ${performance.recentLogs.slice(0, 5).map(log => 
    `${log.exercise_name} (RPE: ${log.rpe}, Quality: ${log.completion_quality}/4)`
  ).join('; ')}

LATEST INSIGHTS:
${insights ? 
  `Recent AI analysis: ${insights.weeklyNarrative?.summary || 'Continue current training approach'}
  ${insights.plateauPredictions?.length > 0 ? `\nPlateau alerts: ${insights.plateauPredictions.map(p => `${p.exercise} (${p.timeframe})`).join(', ')}` : ''}
  ${insights.progressionOpportunities?.length > 0 ? `\nProgression ready: ${insights.progressionOpportunities.map(p => p.area).join(', ')}` : ''}` 
  : 'No recent insights available'
}

SAFETY CONSIDERATIONS:
${safetyAnalysis.concerns.length > 0 ? 
  `IMPORTANT: ${safetyAnalysis.concerns.join(', ')}` : 
  'No immediate safety concerns detected'
}

COACHING GUIDELINES:
- Provide specific, actionable advice based on their actual training data
- Reference specific exercises, RPE patterns, and performance trends when relevant
- Maintain encouraging but realistic tone
- If they have a coach, complement rather than override coach guidance
- For injury concerns, refer to healthcare professionals
- For complex program changes, suggest discussing with their coach if they have one
- Use their actual performance data to explain recommendations

USER'S CURRENT QUESTION: "${userMessage}"

Respond as a knowledgeable training partner who knows their complete training history. Be specific, reference their actual data, and provide practical guidance they can implement immediately.
`;
}

async function analyzeSafetyAndEscalation(message: string, conversationHistory: any[]) {
  const concerns = [];
  let coachAlertNeeded = false;
  let medicalReferralSuggested = false;

  const lowerMessage = message.toLowerCase();

  // Injury-related keywords
  if (lowerMessage.includes('pain') || lowerMessage.includes('injury') || lowerMessage.includes('hurt')) {
    concerns.push('injury_concern');
    coachAlertNeeded = true;
    medicalReferralSuggested = true;
  }

  // Overtraining indicators
  if (lowerMessage.includes('exhausted') || lowerMessage.includes('burning out') || lowerMessage.includes('cant recover')) {
    concerns.push('overtraining_indicators');
    coachAlertNeeded = true;
  }

  // Disordered eating patterns
  if (lowerMessage.includes('not eating') || lowerMessage.includes('starving myself') || lowerMessage.includes('deserve food')) {
    concerns.push('eating_disorder_risk');
    coachAlertNeeded = true;
    medicalReferralSuggested = true;
  }

  // Excessive exercise compulsion
  if (lowerMessage.includes('have to work out') || lowerMessage.includes('cant skip') || lowerMessage.includes('feel guilty')) {
    concerns.push('exercise_compulsion');
    coachAlertNeeded = true;
  }

  return {
    concerns,
    coachAlertNeeded,
    medicalReferralSuggested,
    riskLevel: concerns.length > 1 ? 'high' : concerns.length > 0 ? 'medium' : 'low'
  };
}

async function storeConversationMessage(supabase: any, conversationId: number, role: string, content: string, metadata: any) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      metadata,
      coach_flagged: metadata.safety_flags?.coachAlertNeeded || false,
      safety_review_needed: metadata.safety_flags?.medicalReferralSuggested || false
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function createCoachAlert(supabase: any, userId: number, conversationId: number, messageId: number, safetyAnalysis: any) {
  // Get user's coaches
  const { data: coachRelationships } = await supabase
    .from('coach_athlete_relationships')
    .select('coach_id')
    .eq('athlete_id', userId)
    .eq('status', 'active');

  if (!coachRelationships || coachRelationships.length === 0) return;

  // Create alerts for all active coaches
  const alertPromises = coachRelationships.map(rel =>
    supabase
      .from('coach_chat_alerts')
      .insert({
        coach_id: rel.coach_id,
        athlete_id: userId,
        conversation_id: conversationId,
        message_id: messageId,
        alert_type: safetyAnalysis.concerns.join(','),
        alert_reason: `Safety concerns detected in training chat: ${safetyAnalysis.concerns.join(', ')}`
      })
  );

  await Promise.all(alertPromises);
}

// Utility functions
function calculateRecentTrainingFrequency(logs: any[]) {
  if (logs.length === 0) return { sessionsPerWeek: 0, consistency: 0 };
  
  const weeks = Math.ceil(logs.length / 7);
  const sessionsPerWeek = logs.length / Math.max(weeks, 1);
  
  // Calculate consistency (simplified)
  const consistency = Math.min(1, sessionsPerWeek / 4); // Assuming 4 sessions/week is ideal
  
  return { sessionsPerWeek, consistency };
}

function analyzeRecentPerformance(logs: any[]) {
  if (logs.length < 3) return { trend: 'insufficient_data' };
  
  const recentRPE = logs.slice(0, 5).reduce((sum, log) => sum + (log.rpe || 0), 0) / 5;
  const earlierRPE = logs.slice(5, 10).reduce((sum, log) => sum + (log.rpe || 0), 0) / Math.max(1, logs.slice(5, 10).length);
  
  const rpeTrend = recentRPE > earlierRPE + 0.5 ? 'increasing' : 
                   recentRPE < earlierRPE - 0.5 ? 'decreasing' : 'stable';
  
  return { trend: rpeTrend, recentRPE, earlierRPE };
}

function getCurrentProgramWeek(program: any): number {
  if (!program?.generated_at) return 1;
  
  const programStart = new Date(program.generated_at);
  const now = new Date();
  const weeksDiff = Math.floor((now.getTime() - programStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
  
  return Math.max(1, Math.min(4, weeksDiff + 1)); // Assuming 4-week programs
}

function getCurrentProgramDay(): number {
  const today = new Date().getDay(); // 0 = Sunday
  // Map to training days (assuming Mon=1, Tue=2, Wed=3, Thu=4)
  const dayMapping = [1, 1, 2, 3, 4, 1, 1]; // Sun=1, Mon=1, Tue=2, Wed=3, Thu=4, Fri=1, Sat=1
  return dayMapping[today];
}

function determineResponseType(userMessage: string, aiResponse: string, safetyAnalysis: any): string {
  if (safetyAnalysis.medicalReferralSuggested) return 'medical_referral';
  if (safetyAnalysis.coachAlertNeeded) return 'coach_escalation';
  
  const lowerMessage = userMessage.toLowerCase();
  if (lowerMessage.includes('program') || lowerMessage.includes('workout')) return 'program_guidance';
  if (lowerMessage.includes('form') || lowerMessage.includes('technique')) return 'technique_advice';
  if (lowerMessage.includes('nutrition') || lowerMessage.includes('eating')) return 'nutrition_guidance';
  if (lowerMessage.includes('recovery') || lowerMessage.includes('rest')) return 'recovery_advice';
  
  return 'general_training';
}
