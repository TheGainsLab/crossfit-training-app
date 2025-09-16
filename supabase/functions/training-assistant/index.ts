import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Parse body first so we can use fields in error fallback paths
  let body: any = null;
  try {
    body = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON payload' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { user_id, conversation_id, message, conversation_history, user_context } = body || {};

  try {

    console.log(`Processing training chat for user ${user_id}`);


    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Prefer provided user_context; fallback to building server-side if absent
    const userContext = user_context || (await gatherTrainingContext(supabase, user_id));
    
    // Check for safety concerns and coach escalation needs
    const safetyAnalysis = await analyzeSafetyAndEscalation(message, conversation_history);

    // Generate AI response with full training context
    const aiResponse = await generateTrainingAssistantResponse(
      userContext,
      message,
      conversation_history,
      safetyAnalysis
    );
    // Do not persist here to avoid duplicates; API route handles persistence
    const messageId: number | null = null;

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
    const errMsg = (error as any)?.message || 'Failed to generate training response';
    const stack = (error as any)?.stack || undefined;
    return new Response(JSON.stringify({ success: false, error: errMsg, stack }), {
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
      model: "claude-3-5-haiku-20241022",
      max_tokens: 2000,
      temperature: 0.25,
      messages: [
        { role: "user", content: prompt }
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
  const lower = (userMessage || '').toLowerCase()
  const wantsOly = /(olympic|oly|snatch|clean\s*&?\s*jerk|clean and jerk)/i.test(lower)

  // Prefer full context from chat route if provided
  const profile = userContext?.identity || userContext?.profile || {}
  const preferences = userContext?.preferences || {}
  const oly = userContext?.oly || {}

  if (wantsOly) {
    const sn = oly?.snatch || {}
    const cj = oly?.cleanJerk || {}
    const proxies = oly?.proxies || {}
    return `You are an expert weightlifting coach.
User asked about Olympic lifts. Output two sections only: Snatch, Clean & Jerk. Facts-first. Do not mention unrelated movements.

ATHLETE: ${profile?.name || 'Athlete'} (${profile?.abilityLevel || 'level unknown'}). Training days/week: ${preferences?.trainingDaysPerWeek ?? 'n/a'}.

SNATCH (facts only)
- Latest 1RM: ${sn.latestOneRm ?? 'n/a'}
- Sessions (90d): ${sn.sessions ?? 0}
- Avg RPE (90d): ${sn.avgRpe ?? 'n/a'}
- Avg quality (90d): ${sn.avgQuality ?? 'n/a'}
- Proxies (90d): OHS sessions ${proxies?.overheadSquat?.sessions ?? 0}, SB sessions ${proxies?.snatchBalance?.sessions ?? 0}

CLEAN & JERK (facts only)
- Latest 1RM: ${cj.latestOneRm ?? 'n/a'}
- Sessions (90d): ${cj.sessions ?? 0}
- Avg RPE (90d): ${cj.avgRpe ?? 'n/a'}
- Avg quality (90d): ${cj.avgQuality ?? 'n/a'}
- Proxy Front Squat (90d): sessions ${proxies?.frontSquat?.sessions ?? 0}

Now provide a concise interpretation (2–3 lines) based strictly on the above numbers (plateau/progression, likely limiter). If insufficient data, state exactly what is missing. No drills unless explicitly asked.`
  }

  // Default coaching prompt
  return `You are a knowledgeable CrossFit training assistant. Use the user's actual logged data, preferences, and recent history to answer.
User: "${userMessage}"
Rules:
- Cite concrete numbers (RPE, sessions, 1RMs, percentiles) from context.
- Be brief and specific. If data is missing, say what and where.
`
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
