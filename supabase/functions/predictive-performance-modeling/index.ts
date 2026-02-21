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
    const { user_id, analysisType = 'comprehensive' } = await req.json();

    console.log(`Generating predictive insights for user ${user_id}, type: ${analysisType}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Gather comprehensive user data for analysis
    const analysisData = await gatherAnalysisData(supabase, user_id);

    // Generate AI-powered predictions and insights
    const predictions = await generatePredictiveInsights(analysisData, analysisType);

    return new Response(JSON.stringify({
      success: true,
      userId: user_id,
      predictions,
      analysisTimestamp: new Date().toISOString(),
      dataPoints: {
        performanceLogs: analysisData.performanceLogs.length,
        strengthSessions: analysisData.strengthData.length,
        metconSessions: analysisData.metconData.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Predictive modeling error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function gatherAnalysisData(supabase: any, user_id: number) {
  const sixWeeksAgo = new Date();
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);

  // Fetch performance data, strength progression, and user profile
  const [performanceLogs, strengthData, metconData, userProfile, ratios] = await Promise.all([
    supabase
      .from('performance_logs')
      .select('*')
      .eq('user_id', user_id)
      .gte('logged_at', sixWeeksAgo.toISOString())
      .order('logged_at', { ascending: true }),
    
    supabase
      .from('performance_logs')
      .select('*')
      .eq('user_id', user_id)
      .in('exercise_name', ['Back Squat', 'Front Squat', 'Deadlift', 'Bench Press', 'Strict Press'])
      .gte('logged_at', sixWeeksAgo.toISOString())
      .order('logged_at', { ascending: true }),

    supabase
      .from('program_metcons')
      .select('*')
      .eq('user_id', user_id)
      .gte('completed_at', sixWeeksAgo.toISOString())
      .order('completed_at', { ascending: true }),

    supabase
      .from('users')
      .select('name, gender, body_weight, units')
      .eq('id', user_id)
      .single(),

    supabase
      .from('user_ratios')
      .select('*')
      .eq('user_id', user_id)
      .single()
  ]);

  return {
    performanceLogs: performanceLogs.data || [],
    strengthData: strengthData.data || [],
    metconData: metconData.data || [],
    userProfile: userProfile.data || {},
    ratios: ratios.data || {}
  };
}

async function generatePredictiveInsights(analysisData: any, analysisType: string) {
  const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
  if (!claudeApiKey) throw new Error('Claude API key not found');

  const prompt = buildPredictiveAnalysisPrompt(analysisData, analysisType);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);

  const data = await response.json();
  const aiResponse = data.content[0].text;
  
  return parsePredictiveResponse(aiResponse);
}

function buildPredictiveAnalysisPrompt(analysisData: any, analysisType: string) {
  const { performanceLogs, strengthData, metconData, userProfile, ratios } = analysisData;

  // Calculate trends over time
  const rpePattern = calculateRPETrend(performanceLogs);
  const qualityPattern = calculateQualityTrend(performanceLogs);
  const volumePattern = calculateVolumePattern(performanceLogs);
  const strengthTrend = analyzeStrengthProgression(strengthData);

  // Calculate additional context for narratives
  const recentSessions = performanceLogs.slice(-14); // Last 2 weeks
  const totalSessions = performanceLogs.length;
  const uniqueExercises = [...new Set(performanceLogs.map(log => log.exercise_name))];
  const trainingFrequency = calculateTrainingFrequency(performanceLogs);
  const personalBests = findRecentAchievements(performanceLogs);
  const consistencyScore = calculateConsistencyScore(performanceLogs);

  return `
You are an expert CrossFit coach providing personalized training insights to an athlete. Your analysis should be encouraging, actionable, and conversational - like a knowledgeable coach who understands their individual journey.

ATHLETE PROFILE:
- Name: ${userProfile.name || 'Athlete'}
- Gender: ${userProfile.gender || 'Unknown'}
- Body Weight: ${userProfile.body_weight || 'Unknown'} ${userProfile.units || 'lbs'}

TRAINING DATA SUMMARY (Last 6 weeks):
- Total Training Sessions: ${totalSessions}
- Recent Activity: ${recentSessions.length} sessions in last 2 weeks
- Training Frequency: ${trainingFrequency.sessionsPerWeek} sessions/week average
- Unique Exercises Practiced: ${uniqueExercises.length}
- Training Consistency: ${consistencyScore}%

PERFORMANCE PATTERNS:
- RPE Trend: ${rpePattern.direction} (current average: ${rpePattern.average}/10)
- Movement Quality: ${qualityPattern.direction} (current average: ${qualityPattern.average}/4)
- Training Volume: ${volumePattern.trend}
- Strength Progression: ${strengthTrend}

RECENT ACHIEVEMENTS:
${personalBests.length > 0 ? personalBests.map(pb => `- ${pb.exercise}: ${pb.achievement} (${pb.date})`).join('\n') : '- Continue building towards your first recorded achievements!'}

IDENTIFIED DEVELOPMENT AREAS:
${Object.keys(ratios).filter(k => k.startsWith('needs_') && ratios[k]).map(area => `- ${area.replace('needs_', '').replace('_', ' ')}`).join('\n') || '- Well-rounded development across all areas'}

DETAILED RECENT PERFORMANCE:
${recentSessions.slice(-8).map(log => 
  `${new Date(log.logged_at).toLocaleDateString()}: ${log.exercise_name} - ${log.result || 'completed'} (RPE: ${log.rpe || 'unrated'}, Quality: ${log.completion_quality || 'unrated'}/4)${log.analysis?.notes ? ` | Notes: ${log.analysis.notes}` : ''}`
).join('\n')}

METCON PERFORMANCE CONTEXT:
- Recent MetCon Sessions: ${metconData.length}
- Conditioning Trend: ${metconData.length > 0 ? 'Active conditioning work' : 'Focus on building conditioning base'}

Generate comprehensive insights in JSON format with BOTH structured predictions AND narrative content:

{
  "weeklyNarrative": {
    "summary": "A 2-3 sentence engaging summary of their recent training, highlighting patterns and achievements",
    "keyInsight": "The most important thing they should know about their current training",
    "progressHighlight": "Specific positive progress or achievement to celebrate",
    "focusArea": "What they should pay attention to in upcoming sessions"
  },
  "plateauPredictions": [
    {
      "category": "strength|skills|conditioning",
      "exercise": "Exercise Name",
      "timeframe": "2-3 weeks",
      "confidence": "high|medium|low",
      "reasoning": "Data-based explanation of why plateau may occur",
      "narrative": "Conversational explanation with specific advice for prevention",
      "actionableSteps": ["Specific step 1", "Specific step 2"]
    }
  ],
  "fatigueWarnings": [
    {
      "riskLevel": "high|medium|low",
      "indicators": ["specific RPE patterns", "quality decline", "frequency changes"],
      "recommendation": "Specific recovery or volume adjustment advice",
      "timeframe": "immediate|this week|next week",
      "narrative": "Encouraging explanation of why this matters and how to address it",
      "recoveryTips": ["Specific tip 1", "Specific tip 2"]
    }
  ],
  "progressionOpportunities": [
    {
      "area": "Specific movement or fitness area",
      "currentStatus": "Where they are now",
      "nextStep": "Specific next progression",
      "timeline": "When to attempt it",
      "narrative": "Motivating explanation of their readiness and approach",
      "preparationSteps": ["How to prepare step 1", "Step 2"]
    }
  ],
  "personalizedGuidance": [
    {
      "category": "programming|technique|mindset|recovery",
      "title": "Specific guidance title",
      "advice": "Detailed, actionable advice",
      "reasoning": "Why this matters for their specific situation",
      "implementation": "How to put this into practice",
      "priority": "high|medium|low"
    }
  ],
  "achievements": [
    {
      "type": "volume|consistency|strength|skill|conditioning",
      "description": "What they accomplished",
      "significance": "Why this matters for their development",
      "buildOn": "How to leverage this success going forward"
    }
  ],
  "forwardLooking": {
    "nextWeekFocus": "What to prioritize in the coming week",
    "monthlyGoal": "Realistic goal for the next 4 weeks based on current trends",
    "adaptationStrategy": "How their body is adapting and what this means for training",
    "motivationalClose": "Encouraging message about their training journey"
  }
}

IMPORTANT GUIDELINES:
- Use the athlete's name when available
- Be encouraging but honest about areas needing work
- Provide specific, actionable advice rather than generic recommendations
- Connect data points into coherent stories about their training journey
- Celebrate progress and improvements, however small
- Use conversational, coaching language rather than clinical analysis
- Focus on what they CAN do and how to improve, not what they're doing wrong
- Reference specific exercises, dates, and performance metrics when relevant
- Make recommendations feel achievable and motivating

DO NOT OUTPUT ANYTHING OTHER than the requested JSON structure. Ensure all narrative fields are engaging, specific, and actionable.
`;
}

// Helper functions for enhanced analysis
function calculateTrainingFrequency(logs: any[]): { sessionsPerWeek: number } {
  if (logs.length === 0) return { sessionsPerWeek: 0 };
  
  const weeks = groupLogsByWeek(logs);
  const avgSessions = weeks.reduce((sum, week) => sum + week.sessionCount, 0) / weeks.length;
  
  return { sessionsPerWeek: Math.round(avgSessions * 10) / 10 };
}

function findRecentAchievements(logs: any[]): any[] {
  const achievements: any[] = [];
  const exerciseGroups = groupBy(logs, 'exercise_name');
  
  Object.keys(exerciseGroups).forEach(exercise => {
    const sessions = exerciseGroups[exercise].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
    
    // Look for recent PRs, quality improvements, or volume milestones
    const recent = sessions.slice(-5);
    const hasQualityImprovement = recent.some((session, i) => 
      i > 0 && session.completion_quality > recent[i-1].completion_quality
    );
    
    if (hasQualityImprovement) {
      achievements.push({
        exercise,
        achievement: "Quality improvement trend",
        date: new Date(recent[recent.length - 1].logged_at).toLocaleDateString()
      });
    }
    
    // Check for weight/time PRs if available
    const weights = sessions.map(s => s.weight_time).filter(w => w && !isNaN(parseFloat(w)));
    if (weights.length >= 2) {
      const maxWeight = Math.max(...weights.map(w => parseFloat(w)));
      const recentMax = Math.max(...recent.map(s => s.weight_time ? parseFloat(s.weight_time) : 0));
      
      if (recentMax === maxWeight && recentMax > 0) {
        achievements.push({
          exercise,
          achievement: `Personal best: ${maxWeight}`,
          date: new Date(sessions.find(s => parseFloat(s.weight_time) === maxWeight)?.logged_at).toLocaleDateString()
        });
      }
    }
  });
  
  return achievements.slice(0, 5); // Return top 5 recent achievements
}

function calculateConsistencyScore(logs: any[]): number {
  if (logs.length === 0) return 0;
  
  const weeks = groupLogsByWeek(logs);
  const targetSessionsPerWeek = 4; // Assume 4 sessions/week as ideal
  
  const consistencyScores = weeks.map(week => {
    const ratio = Math.min(week.sessionCount / targetSessionsPerWeek, 1);
    return ratio * 100;
  });
  
  const avgConsistency = consistencyScores.reduce((sum, score) => sum + score, 0) / consistencyScores.length;
  return Math.round(avgConsistency);
}


function calculateRPETrend(logs: any[]): { direction: string, average: number } {
  if (logs.length < 5) return { direction: 'insufficient data', average: 0 };
  
  const rpeLogs = logs.filter(log => log.rpe && log.rpe > 0);
  if (rpeLogs.length < 5) return { direction: 'insufficient data', average: 0 };

  const recentRPE = rpeLogs.slice(-10).reduce((sum, log) => sum + log.rpe, 0) / Math.min(10, rpeLogs.length);
  const earlierRPE = rpeLogs.slice(0, Math.min(10, rpeLogs.length - 10)).reduce((sum, log) => sum + log.rpe, 0) / Math.max(1, Math.min(10, rpeLogs.length - 10));
  
  const difference = recentRPE - earlierRPE;
  const direction = difference > 0.5 ? 'increasing' : difference < -0.5 ? 'decreasing' : 'stable';
  
  return { direction, average: Math.round(recentRPE * 10) / 10 };
}

function calculateQualityTrend(logs: any[]): { direction: string, average: number } {
  const qualityLogs = logs.filter(log => log.completion_quality && log.completion_quality > 0);
  if (qualityLogs.length < 5) return { direction: 'insufficient data', average: 0 };

  const recentQuality = qualityLogs.slice(-10).reduce((sum, log) => sum + log.completion_quality, 0) / Math.min(10, qualityLogs.length);
  const earlierQuality = qualityLogs.slice(0, Math.min(10, qualityLogs.length - 10)).reduce((sum, log) => sum + log.completion_quality, 0) / Math.max(1, Math.min(10, qualityLogs.length - 10));
  
  const difference = recentQuality - earlierQuality;
  const direction = difference > 0.3 ? 'improving' : difference < -0.3 ? 'declining' : 'stable';
  
  return { direction, average: Math.round(recentQuality * 10) / 10 };
}

function calculateVolumePattern(logs: any[]): { trend: string } {
  // Analyze session frequency over time
  const weeksData = groupLogsByWeek(logs);
  if (weeksData.length < 3) return { trend: 'insufficient data' };
  
  const recentWeeks = weeksData.slice(-3);
  const earlierWeeks = weeksData.slice(0, -3);
  
  const recentAvg = recentWeeks.reduce((sum, week) => sum + week.sessionCount, 0) / recentWeeks.length;
  const earlierAvg = earlierWeeks.length > 0 ? earlierWeeks.reduce((sum, week) => sum + week.sessionCount, 0) / earlierWeeks.length : recentAvg;
  
  const difference = recentAvg - earlierAvg;
  const trend = difference > 1 ? 'increasing' : difference < -1 ? 'decreasing' : 'stable';
  
  return { trend };
}

function analyzeStrengthProgression(strengthData: any[]): string {
  if (strengthData.length < 5) return 'insufficient data';
  
  const exerciseGroups = groupBy(strengthData, 'exercise_name');
  const progressions = Object.keys(exerciseGroups).map(exercise => {
    const sessions = exerciseGroups[exercise].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
    if (sessions.length < 3) return 'insufficient data';
    
    const weights = sessions.map(s => s.weight_used).filter(w => w && w > 0);
    if (weights.length < 3) return 'no weight progression data';
    
    const recent = weights.slice(-3);
    const earlier = weights.slice(0, -3);
    const recentAvg = recent.reduce((sum, w) => sum + w, 0) / recent.length;
    const earlierAvg = earlier.length > 0 ? earlier.reduce((sum, w) => sum + w, 0) / earlier.length : recentAvg;
    
    return recentAvg > earlierAvg ? 'improving' : recentAvg < earlierAvg ? 'declining' : 'stable';
  });
  
  const improving = progressions.filter(p => p === 'improving').length;
  const total = progressions.filter(p => p !== 'insufficient data' && p !== 'no weight progression data').length;
  
  if (total === 0) return 'insufficient strength data';
  const improvingPercentage = improving / total;
  
  return improvingPercentage > 0.6 ? 'generally improving' : 
         improvingPercentage < 0.3 ? 'generally declining' : 'mixed progression';
}

function groupLogsByWeek(logs: any[]): any[] {
  const weeks: { [key: string]: any } = {};
  
  logs.forEach(log => {
    const date = new Date(log.logged_at);
    const weekKey = `${date.getFullYear()}-W${getWeekNumber(date)}`;
    
    if (!weeks[weekKey]) {
      weeks[weekKey] = { weekKey, sessionCount: 0, logs: [] };
    }
    weeks[weekKey].sessionCount++;
    weeks[weekKey].logs.push(log);
  });
  
  return Object.values(weeks).sort((a, b) => a.weekKey.localeCompare(b.weekKey));
}

function groupBy(array: any[], key: string): { [key: string]: any[] } {
  return array.reduce((groups, item) => {
    const group = item[key];
    if (!groups[group]) groups[group] = [];
    groups[group].push(item);
    return groups;
  }, {});
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}


function parsePredictiveResponse(aiResponse: string) {
  try {
    const cleanResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanResponse);
    
    return {
      // Existing structured data
      plateauPredictions: parsed.plateauPredictions || [],
      fatigueWarnings: parsed.fatigueWarnings || [],
      progressionOpportunities: parsed.progressionOpportunities || [],
      personalizedRecommendations: parsed.personalizedRecommendations || [],
      performanceForecasts: parsed.performanceForecasts || [],
      
      // New narrative content
      weeklyNarrative: parsed.weeklyNarrative || {
        summary: "Continue building your training foundation with consistent sessions.",
        keyInsight: "Focus on movement quality and consistency.",
        progressHighlight: "You're on the right track with regular training.",
        focusArea: "Maintain current training approach."
      },
      personalizedGuidance: parsed.personalizedGuidance || [],
      achievements: parsed.achievements || [],
      forwardLooking: parsed.forwardLooking || {
        nextWeekFocus: "Continue current training approach",
        monthlyGoal: "Build training consistency",
        adaptationStrategy: "Allow your body to adapt gradually",
        motivationalClose: "Keep up the great work!"
      },
      
      analysisQuality: 'ai-enhanced'
    };
    
  } catch (error) {
    console.warn('Failed to parse AI predictions:', error);
    return {
      plateauPredictions: [],
      fatigueWarnings: [],
      progressionOpportunities: [],
      personalizedRecommendations: [{
        category: 'system',
        recommendation: 'Continue current training approach',
        reasoning: 'Analysis parsing unavailable, maintaining consistent programming',
        priority: 'low'
      }],
      performanceForecasts: [],
      weeklyNarrative: {
        summary: "Keep training consistently to build your fitness foundation.",
        keyInsight: "Consistency is key to long-term progress.",
        progressHighlight: "Every session contributes to your development.",
        focusArea: "Focus on showing up and doing the work."
      },
      personalizedGuidance: [],
      achievements: [],
      forwardLooking: {
        nextWeekFocus: "Maintain training consistency",
        monthlyGoal: "Continue building your base",
        adaptationStrategy: "Let your body adapt at its own pace",
        motivationalClose: "Trust the process and keep moving forward!"
      },
      analysisQuality: 'fallback'
    };
  }
}

