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
    const { coach_id } = await req.json();

    console.log(`Generating coach alerts for coach ${coach_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all athletes for this coach with recent performance data
    const athleteData = await gatherCoachAthleteData(supabase, coach_id);
    
    // Analyze each athlete for human intervention needs
    const alerts = await generateHumanInterventionAlerts(athleteData);
    
    // Generate roster-wide insights
    const rosterInsights = analyzeRosterPatterns(athleteData);

    return new Response(JSON.stringify({
      success: true,
      coachId: coach_id,
      alerts,
      rosterInsights,
      totalAthletes: athleteData.length,
      priorityCount: alerts.filter(a => a.priority === 'high').length,
      generatedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Coach alerts generation error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function gatherCoachAthleteData(supabase: any, coach_id: number) {
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  // Get all athletes under this coach
  const { data: relationships } = await supabase
    .from('coach_athlete_relationships')
    .select(`
      athlete_id,
      permission_level,
      created_at,
      users!coach_athlete_relationships_athlete_id_fkey (
        id, name, ability_level, created_at
      )
    `)
    .eq('coach_id', coach_id)
    .eq('status', 'active');

  if (!relationships || relationships.length === 0) {
    return [];
  }

  // Get performance data for all athletes
  const athleteIds = relationships.map(r => r.athlete_id);
  
  const [performanceLogs, recentSessions, lastContacts] = await Promise.all([
    // Performance logs for trend analysis
    supabase
      .from('performance_logs')
      .select('*')
      .in('user_id', athleteIds)
      .gte('logged_at', twoWeeksAgo.toISOString())
      .order('logged_at', { ascending: false }),
      
    // Session frequency data
    supabase
      .from('exercise_sessions')
      .select('user_id, session_date, exercises_completed')
      .in('user_id', athleteIds)
      .gte('session_date', twoWeeksAgo.toISOString()),
      
// Last coach communication from notes
supabase
  .from('coach_notes')
  .select('athlete_id, created_at')
  .in('athlete_id', athleteIds)
  .eq('coach_id', coach_id)
  .order('created_at', { ascending: false })
  ]);

  // Combine data by athlete
  return relationships.map(rel => ({
    athleteId: rel.athlete_id,
    name: rel.users.name,
    abilityLevel: rel.users.ability_level,
    permissionLevel: rel.permission_level,
    coachingSince: rel.created_at,
    accountAge: rel.users.created_at,
    performanceLogs: (performanceLogs.data || []).filter(log => log.user_id === rel.athlete_id),
    recentSessions: (recentSessions.data || []).filter(session => session.user_id === rel.athlete_id),
lastCoachContact: lastContacts.data
  ?.filter(note => note.athlete_id === rel.athlete_id)
  ?.[0]?.created_at
 }));
}

async function generateHumanInterventionAlerts(athleteData: any[]) {
  const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
  if (!claudeApiKey) throw new Error('Claude API key not found');

  const alerts = [];

  for (const athlete of athleteData) {
    const interventionNeeds = detectInterventionTriggers(athlete);
    
    if (interventionNeeds.length > 0) {
      // Use Claude to generate context and recommendations
      const aiAnalysis = await generateInterventionContext(claudeApiKey, athlete, interventionNeeds);
      
      alerts.push({
        athleteId: athlete.athleteId,
        athleteName: athlete.name,
        priority: calculateAlertPriority(interventionNeeds),
        interventionTriggers: interventionNeeds,
        aiContext: aiAnalysis,
        dataSnapshot: buildAthleteSnapshot(athlete),
        suggestedActions: generateSuggestedActions(interventionNeeds),
        urgencyLevel: determineUrgency(interventionNeeds)
      });
    }
  }

  return alerts.sort((a, b) => {
    const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

function detectInterventionTriggers(athlete: any): any[] {
  const triggers = [];
  const logs = athlete.performanceLogs;
  const sessions = athlete.recentSessions;

  if (logs.length === 0) {
    triggers.push({
      type: 'no_performance_data',
      reason: 'Athlete has no recorded performance data',
      severity: 'medium',
      category: 'engagement'
    });
    return triggers;
  }

  // Analyze performance patterns
  const rpePattern = calculateRPETrend(logs);
  const qualityPattern = calculateQualityTrend(logs);
  const sessionPattern = analyzeSessionFrequency(sessions);

  // Anomalous data patterns (AI can't handle)
  if (rpePattern.direction === 'increasing' && qualityPattern.direction === 'improving') {
    triggers.push({
      type: 'conflicting_signals',
      reason: 'RPE increasing while quality improving - unusual pattern',
      severity: 'high',
      category: 'data_anomaly',
      metrics: { rpe: rpePattern, quality: qualityPattern }
    });
  }

  // Motivation/engagement decline
  if (qualityPattern.direction === 'stable' && rpePattern.direction === 'increasing' && sessionPattern.frequency === 'decreasing') {
    triggers.push({
      type: 'motivation_decline',
      reason: 'Physical capability maintained but engagement/effort dropping',
      severity: 'high',
      category: 'behavioral',
      metrics: { sessions: sessionPattern.weeklyAverage }
    });
  }

  // Extreme performance changes
  if (rpePattern.average > 9.0 || (rpePattern.direction === 'increasing' && rpePattern.change > 2.0)) {
    triggers.push({
      type: 'extreme_fatigue',
      reason: 'RPE levels indicating potential overreaching or external stressors',
      severity: 'high',
      category: 'safety',
      metrics: { currentRPE: rpePattern.average, change: rpePattern.change }
    });
  }

  // Communication gaps during concerning periods
  const daysSinceContact = calculateDaysSinceContact(athlete.lastCoachContact);
  const hasPerformanceConcerns = rpePattern.average > 8.0 || qualityPattern.direction === 'declining';
  
  if (daysSinceContact > 14 && hasPerformanceConcerns) {
    triggers.push({
      type: 'communication_gap',
      reason: 'Extended silence during concerning performance period',
      severity: 'medium',
      category: 'communication',
      metrics: { daysSinceContact, performanceConcern: hasPerformanceConcerns }
    });
  }

  // Sudden pattern breaks
  if (sessionPattern.consistency < 0.5 && athlete.accountAge > 60) { // Established athletes with sudden inconsistency
    triggers.push({
      type: 'pattern_break',
      reason: 'Sudden change in established training patterns',
      severity: 'medium',
      category: 'behavioral',
      metrics: { consistency: sessionPattern.consistency }
    });
  }

  return triggers;
}

async function generateInterventionContext(claudeApiKey: string, athlete: any, triggers: any[]) {
  const prompt = buildInterventionContextPrompt(athlete, triggers);

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

  if (!response.ok) {
    console.warn(`Claude API error for athlete ${athlete.athleteId}: ${response.status}`);
    return generateFallbackContext(triggers);
  }

  const data = await response.json();
  
  try {
    return JSON.parse(data.content[0].text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  } catch (error) {
    console.warn('Failed to parse intervention context:', error);
    return generateFallbackContext(triggers);
  }
}

function buildInterventionContextPrompt(athlete: any, triggers: any[]) {
  const recentLogs = athlete.performanceLogs.slice(0, 10);
  
  return `
You are an expert coach advisor analyzing when human coaching intervention is needed beyond automated program adjustments.

ATHLETE: ${athlete.name}
EXPERIENCE LEVEL: ${athlete.abilityLevel}
COACHING RELATIONSHIP: ${Math.floor((Date.now() - new Date(athlete.coachingSince).getTime()) / (1000 * 60 * 60 * 24))} days

INTERVENTION TRIGGERS DETECTED:
${triggers.map(t => `- ${t.type}: ${t.reason} (${t.severity} severity)`).join('\n')}

RECENT PERFORMANCE DATA:
${recentLogs.map(log => 
  `${new Date(log.logged_at).toLocaleDateString()}: ${log.exercise_name} - RPE ${log.rpe}, Quality ${log.completion_quality}/4`
).join('\n')}

Generate coaching intervention context in JSON format:

{
  "situationSummary": "Brief summary of why human intervention is needed",
  "aiLimitations": "Why automated systems can't handle this situation",
  "coachingOpportunity": "What value human coaching adds here",
  "conversationStarters": [
    "Specific question or comment to open dialogue",
    "Data point to discuss with athlete"
  ],
  "outcomeGoals": [
    "What the coach hopes to achieve",
    "Information the coach needs to gather"
  ],
  "followUpActions": [
    "Concrete next steps after conversation",
    "What to monitor going forward"
  ]
}

Focus on human judgment, motivation, external factors, and relationship building - not program modifications (AI handles those).

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.
`;
}

function generateFallbackContext(triggers: any[]) {
  return {
    situationSummary: `Multiple intervention triggers detected requiring human judgment`,
    aiLimitations: "Automated systems cannot assess motivation, external stressors, or complex behavioral patterns",
    coachingOpportunity: "Personal connection and context gathering to understand underlying factors",
    conversationStarters: [
      "How have you been feeling about your recent training sessions?",
      "I noticed some interesting patterns in your data - let's chat about how things are going"
    ],
    outcomeGoals: [
      "Understand external factors affecting performance",
      "Assess motivation and goal alignment"
    ],
    followUpActions: [
      "Schedule regular check-ins",
      "Monitor response to conversation"
    ]
  };
}

function analyzeRosterPatterns(athleteData: any[]) {
  const patterns = {
    totalAthletes: athleteData.length,
    athletesNeedingAttention: 0,
    commonIssues: [],
    rosterHealth: 'good'
  };

  const allTriggers = athleteData.flatMap(athlete => 
    detectInterventionTriggers(athlete)
  );

  // Count common trigger types
  const triggerCounts = {};
  allTriggers.forEach(trigger => {
    triggerCounts[trigger.type] = (triggerCounts[trigger.type] || 0) + 1;
  });

  // Identify roster-wide issues
  Object.entries(triggerCounts).forEach(([type, count]) => {
    if (count >= 3) { // 3+ athletes with same issue
      patterns.commonIssues.push({
        issue: type,
        athleteCount: count,
        recommendation: getPatternRecommendation(type, count)
      });
    }
  });

  patterns.athletesNeedingAttention = new Set(allTriggers.map(t => t.athleteId)).size;
  
  if (patterns.athletesNeedingAttention > patterns.totalAthletes * 0.5) {
    patterns.rosterHealth = 'concerning';
  } else if (patterns.athletesNeedingAttention > patterns.totalAthletes * 0.3) {
    patterns.rosterHealth = 'needs_attention';
  }

  return patterns;
}

function getPatternRecommendation(triggerType: string, count: number): string {
  const recommendations = {
    'extreme_fatigue': `${count} athletes showing high fatigue - consider program intensity review`,
    'motivation_decline': `${count} athletes with engagement issues - team check-in recommended`,
    'communication_gap': `${count} athletes without recent contact - schedule roster review`,
    'pattern_break': `${count} athletes with disrupted patterns - investigate external factors`
  };
  
  return recommendations[triggerType] || `${count} athletes affected - coach review needed`;
}

// Utility functions
function calculateRPETrend(logs: any[]): { direction: string, average: number, change: number } {
  if (logs.length < 3) return { direction: 'insufficient_data', average: 0, change: 0 };
  
  const rpeLogs = logs.filter(log => log.rpe && log.rpe > 0).slice(0, 10);
  if (rpeLogs.length < 3) return { direction: 'insufficient_data', average: 0, change: 0 };

  const recent = rpeLogs.slice(0, 5);
  const earlier = rpeLogs.slice(5, 10);
  
  const recentAvg = recent.reduce((sum, log) => sum + log.rpe, 0) / recent.length;
  const earlierAvg = earlier.length > 0 ? earlier.reduce((sum, log) => sum + log.rpe, 0) / earlier.length : recentAvg;
  
  const change = recentAvg - earlierAvg;
  const direction = change > 0.5 ? 'increasing' : change < -0.5 ? 'decreasing' : 'stable';
  
  return { direction, average: Math.round(recentAvg * 10) / 10, change: Math.round(change * 10) / 10 };
}

function calculateQualityTrend(logs: any[]): { direction: string, average: number } {
  const qualityLogs = logs.filter(log => log.completion_quality && log.completion_quality > 0).slice(0, 10);
  if (qualityLogs.length < 3) return { direction: 'insufficient_data', average: 0 };

  const recent = qualityLogs.slice(0, 5);
  const earlier = qualityLogs.slice(5, 10);
  
  const recentAvg = recent.reduce((sum, log) => sum + log.completion_quality, 0) / recent.length;
  const earlierAvg = earlier.length > 0 ? earlier.reduce((sum, log) => sum + log.completion_quality, 0) / earlier.length : recentAvg;
  
  const difference = recentAvg - earlierAvg;
  const direction = difference > 0.3 ? 'improving' : difference < -0.3 ? 'declining' : 'stable';
  
  return { direction, average: Math.round(recentAvg * 10) / 10 };
}

function analyzeSessionFrequency(sessions: any[]): { frequency: string, weeklyAverage: number, consistency: number } {
  if (sessions.length === 0) return { frequency: 'none', weeklyAverage: 0, consistency: 0 };
  
  const weeklyAverage = sessions.length / 2; // 2 weeks of data
  const frequency = weeklyAverage >= 4 ? 'high' : weeklyAverage >= 2 ? 'moderate' : 'low';
  
  // Calculate consistency (standard deviation of weekly sessions)
  const week1Sessions = sessions.filter(s => new Date(s.session_date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;
  const week2Sessions = sessions.length - week1Sessions;
  const consistency = 1 - Math.abs(week1Sessions - week2Sessions) / Math.max(week1Sessions + week2Sessions, 1);
  
  return { frequency, weeklyAverage, consistency };
}

function calculateDaysSinceContact(lastContact: string | null): number {
  if (!lastContact) return 999; // Very high number if no contact recorded
  return Math.floor((Date.now() - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24));
}

function calculateAlertPriority(triggers: any[]): 'high' | 'medium' | 'low' {
  const highSeverity = triggers.filter(t => t.severity === 'high').length;
  const totalTriggers = triggers.length;
  
  if (highSeverity >= 2 || triggers.some(t => t.category === 'safety')) return 'high';
  if (highSeverity >= 1 || totalTriggers >= 3) return 'medium';
  return 'low';
}

function determineUrgency(triggers: any[]): 'immediate' | 'this_week' | 'next_week' {
  if (triggers.some(t => t.category === 'safety' || t.type === 'extreme_fatigue')) return 'immediate';
  if (triggers.some(t => t.severity === 'high')) return 'this_week';
  return 'next_week';
}

function buildAthleteSnapshot(athlete: any) {
  return {
    totalSessions: athlete.recentSessions.length,
    avgRPE: calculateRPETrend(athlete.performanceLogs).average,
    sessionConsistency: analyzeSessionFrequency(athlete.recentSessions).consistency,
    daysSinceContact: calculateDaysSinceContact(athlete.lastCoachContact)
  };
}

function generateSuggestedActions(triggers: any[]): string[] {
  const actions = [];
  const categories = [...new Set(triggers.map(t => t.category))];
  
  if (categories.includes('safety')) actions.push('Schedule immediate check-in call');
  if (categories.includes('behavioral')) actions.push('Discuss motivation and external factors');
  if (categories.includes('communication')) actions.push('Send personal message checking in');
  if (categories.includes('data_anomaly')) actions.push('Review recent sessions and gather context');
  
  return actions;
}
