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
      .select('name, ability_level, gender, body_weight, units')
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

  return `
You are an expert sports scientist analyzing a CrossFit athlete's performance data to generate predictive insights.

ATHLETE PROFILE:
- Ability: ${userProfile.ability_level || 'Unknown'}
- Gender: ${userProfile.gender || 'Unknown'}
- Body Weight: ${userProfile.body_weight || 'Unknown'} ${userProfile.units || 'lbs'}

PERFORMANCE PATTERNS (6 weeks):
- Total Sessions: ${performanceLogs.length}
- RPE Trend: ${rpePattern.direction} (avg: ${rpePattern.average})
- Quality Trend: ${qualityPattern.direction} (avg: ${qualityPattern.average})
- Volume Pattern: ${volumePattern.trend}
- Strength Progression: ${strengthTrend}

WEAKNESS ANALYSIS:
${Object.keys(ratios).filter(k => k.startsWith('needs_') && ratios[k]).join(', ') || 'No significant weaknesses identified'}

RECENT PERFORMANCE HIGHLIGHTS:
${performanceLogs.slice(-10).map(log => 
  `${log.exercise_name}: RPE ${log.rpe}, Quality ${log.completion_quality}`
).join('\n')}

METCON PERFORMANCE:
- Recent sessions: ${metconData.length}
- Performance variation analysis available

Generate predictive insights in JSON format:

{
  "plateauPredictions": [
    {
      "category": "strength|skills|conditioning",
      "exercise": "Exercise Name",
      "timeframe": "2-3 weeks",
      "confidence": "high|medium|low",
      "reasoning": "Current trajectory analysis"
    }
  ],
  "fatigueWarnings": [
    {
      "riskLevel": "high|medium|low",
      "indicators": ["high RPE pattern", "declining quality"],
      "recommendation": "Reduce volume by 20% next week",
      "timeframe": "immediate"
    }
  ],
  "progressionOpportunities": [
    {
      "area": "Back Squat",
      "currentStatus": "ready for advancement",
      "nextStep": "Increase load by 5-10%",
      "timeline": "next training cycle"
    }
  ],
  "personalizedRecommendations": [
    {
      "category": "programming",
      "recommendation": "Emphasis on posterior chain work",
      "reasoning": "Ratio analysis shows weakness",
      "priority": "high"
    }
  ],
  "performanceForecasts": [
    {
      "metric": "overall fitness",
      "trend": "improving|declining|stable",
      "projectedChange": "5-10% improvement over 4 weeks",
      "keyFactors": ["consistent training", "good recovery patterns"]
    }
  ]
}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.
`;
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
      plateauPredictions: parsed.plateauPredictions || [],
      fatigueWarnings: parsed.fatigueWarnings || [],
      progressionOpportunities: parsed.progressionOpportunities || [],
      personalizedRecommendations: parsed.personalizedRecommendations || [],
      performanceForecasts: parsed.performanceForecasts || [],
      analysisQuality: 'ai-generated'
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
      analysisQuality: 'fallback'
    };
  }
}
