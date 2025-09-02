import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

serve(async (req) => {
  try {
    const { user_id } = await req.json();
    
    if (!user_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User ID required'
      }), { status: 400 });
    }

    // Get 8 weeks of performance data
    const performanceData = await getHistoricalPerformance(user_id);
    
    // Analyze plateau patterns across different exercises
    const plateauAnalysis = await analyzePlateauPatterns(performanceData);
    
    return new Response(JSON.stringify({
      success: true,
      plateauAnalysis,
      activeInterventions: plateauAnalysis.interventionsNeeded
    }));

  } catch (error) {
    console.error('Plateau analysis error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      plateauAnalysis: { interventionsNeeded: {} } // Safe fallback
    }));
  }
});

async function getHistoricalPerformance(user_id: number) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Get last 8 weeks of performance logs
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
  
  const { data: logs, error } = await supabase
    .from('performance_logs')
    .select(`
      id,
      exercise_name,
      weight_time,
      sets,
      reps,
      rpe,
      completion_quality,
      quality_grade,
      logged_at,
      program_id,
      week,
      day,
      set_number
    `)
    .eq('user_id', user_id)
    .gte('logged_at', eightWeeksAgo.toISOString())
    .order('logged_at', { ascending: true });
    
  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }
  
  return logs || [];
}

async function analyzePlateauPatterns(performanceData: any[]) {
  // Group data by exercise
  const exerciseGroups = groupByExercise(performanceData);
  
  const exerciseAnalysis: any = {};
  const interventionsNeeded: any = {};
  
  // Analyze each exercise for plateau patterns
  for (const [exerciseName, logs] of Object.entries(exerciseGroups)) {
    const analysis = await analyzeExerciseForPlateau(exerciseName, logs as any[]);
    exerciseAnalysis[exerciseName] = analysis;
    
    // If intervention needed, add to active interventions
    if (analysis.interventionNeeded) {
      interventionsNeeded[exerciseName] = {
        protocol: analysis.recommendedProtocol,
        duration: analysis.estimatedDuration,
        constraints: generateInterventionConstraints(analysis)
      };
    }
  }
  
  return {
    exerciseAnalysis,
    interventionsNeeded,
    overallStatus: Object.keys(interventionsNeeded).length > 0 
      ? 'INTERVENTIONS_ACTIVE' 
      : 'NORMAL_PROGRESSION'
  };
}

function groupByExercise(performanceData: any[]) {
  return performanceData.reduce((groups, log) => {
    const exercise = log.exercise_name;
    if (!groups[exercise]) {
      groups[exercise] = [];
    }
    groups[exercise].push(log);
    return groups;
  }, {} as Record<string, any[]>);
}

async function analyzeExerciseForPlateau(exerciseName: string, logs: any[]) {
  if (logs.length < 6) {
    return {
      exerciseName,
      status: 'INSUFFICIENT_DATA',
      interventionNeeded: false
    };
  }
  
  // Sort by date
  logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  
  // Analyze different plateau signals
  const rpeInflation = detectRPEInflation(logs);
  const qualityDegradation = detectQualityDegradation(logs);
  const volumeIntolerance = detectVolumeIntolerance(logs);
  const progressStagnation = detectProgressStagnation(logs);
  
  const signals = [
    rpeInflation.detected,
    qualityDegradation.detected,
    volumeIntolerance.detected,
    progressStagnation.detected
  ].filter(Boolean).length;
  
  const severity = signals / 4; // 0.0 to 1.0
  const interventionNeeded = signals >= 2 && severity > 0.4;
  
  return {
    exerciseName,
    signals: {
      rpeInflation: rpeInflation.detected,
      qualityDegradation: qualityDegradation.detected,
      volumeIntolerance: volumeIntolerance.detected,
      progressStagnation: progressStagnation.detected
    },
    severity,
    interventionNeeded,
    recommendedProtocol: determineInterventionProtocol(rpeInflation, qualityDegradation, volumeIntolerance),
    estimatedDuration: 2, // weeks
    evidence: {
      rpeInflation: rpeInflation.evidence,
      qualityDegradation: qualityDegradation.evidence,
      volumeIntolerance: volumeIntolerance.evidence,
      progressStagnation: progressStagnation.evidence
    }
  };
}

function detectRPEInflation(logs: any[]) {
  // Look for pattern where similar weights require higher RPE over time
  const recentLogs = logs.slice(-6); // Last 6 sessions
  const earlierLogs = logs.slice(-12, -6); // Previous 6 sessions
  
  if (recentLogs.length < 3 || earlierLogs.length < 3) {
    return { detected: false, evidence: 'Insufficient data for RPE inflation analysis' };
  }
  
  // Filter logs with weight data (exclude bodyweight exercises)
  const recentWithWeights = recentLogs.filter(l => l.weight_time && !isNaN(parseFloat(l.weight_time)));
  const earlierWithWeights = earlierLogs.filter(l => l.weight_time && !isNaN(parseFloat(l.weight_time)));
  
  if (recentWithWeights.length < 2 || earlierWithWeights.length < 2) {
    // For bodyweight exercises, just analyze RPE trends
    const recentAvgRPE = average(recentLogs.map(l => l.rpe || 5));
    const earlierAvgRPE = average(earlierLogs.map(l => l.rpe || 5));
    const rpeIncrease = recentAvgRPE - earlierAvgRPE;
    
    const detected = rpeIncrease >= 1.0; // Significant RPE increase for same exercise
    return {
      detected,
      evidence: detected 
        ? `RPE increased ${rpeIncrease.toFixed(1)} points for same exercise difficulty`
        : 'No significant RPE inflation detected'
    };
  }
  
  // Calculate average weight and RPE for weighted exercises
  const recentAvgWeight = average(recentWithWeights.map(l => parseFloat(l.weight_time)));
  const recentAvgRPE = average(recentWithWeights.map(l => l.rpe || 5));
  
  const earlierAvgWeight = average(earlierWithWeights.map(l => parseFloat(l.weight_time)));
  const earlierAvgRPE = average(earlierWithWeights.map(l => l.rpe || 5));
  
  // RPE inflation: similar or lower weight but higher RPE
  const weightChange = (recentAvgWeight - earlierAvgWeight) / earlierAvgWeight;
  const rpeIncrease = recentAvgRPE - earlierAvgRPE;
  
  const detected = weightChange <= 0.05 && rpeIncrease >= 0.5;
  
  return {
    detected,
    evidence: detected 
      ? `RPE increased ${rpeIncrease.toFixed(1)} points while weight stayed similar (${weightChange > 0 ? '+' : ''}${(weightChange * 100).toFixed(1)}%)`
      : 'No significant RPE inflation detected'
  };
}

function detectQualityDegradation(logs: any[]) {
  // Look for declining quality scores over time
  const recentLogs = logs.slice(-6);
  const earlierLogs = logs.slice(-12, -6);
  
  if (recentLogs.length < 3 || earlierLogs.length < 3) {
    return { detected: false, evidence: 'Insufficient data for quality analysis' };
  }
  
  // Use completion_quality (numeric) and quality_grade as backup
  const getQualityScore = (log: any) => {
    if (log.completion_quality && !isNaN(log.completion_quality)) {
      return log.completion_quality; // Use numeric score if available
    }
    // Fallback to grade conversion
    switch (log.quality_grade?.toUpperCase()) {
      case 'A': return 4;
      case 'B': return 3; 
      case 'C': return 2;
      case 'D': return 1;
      default: return 2.5;
    }
  };
  
  const recentAvgQuality = average(recentLogs.map(getQualityScore));
  const earlierAvgQuality = average(earlierLogs.map(getQualityScore));
  
  const qualityDrop = earlierAvgQuality - recentAvgQuality;
  const detected = qualityDrop >= 0.5; // Half point drop or more
  
  return {
    detected,
    evidence: detected
      ? `Quality dropped ${qualityDrop.toFixed(1)} points (${earlierAvgQuality.toFixed(1)} → ${recentAvgQuality.toFixed(1)})`
      : 'No significant quality degradation detected'
  };
}

function detectVolumeIntolerance(logs: any[]) {
  // Look for declining volume completion over time
  const recentLogs = logs.slice(-6);
  const earlierLogs = logs.slice(-12, -6);
  
  if (recentLogs.length < 3 || earlierLogs.length < 3) {
    return { detected: false, evidence: 'Insufficient data for volume analysis' };
  }
  
  // Parse sets as numbers (your data shows sets as strings like "2")
  const parseSetCount = (sets: any) => {
    if (typeof sets === 'string') return parseInt(sets) || 0;
    if (typeof sets === 'number') return sets;
    return 0;
  };
  
  const recentAvgSets = average(recentLogs.map(l => parseSetCount(l.sets)));
  const earlierAvgSets = average(earlierLogs.map(l => parseSetCount(l.sets)));
  
  const volumeDrop = (earlierAvgSets - recentAvgSets) / earlierAvgSets;
  const detected = volumeDrop >= 0.15; // 15% or more volume drop
  
  return {
    detected,
    evidence: detected
      ? `Volume completion dropped ${(volumeDrop * 100).toFixed(1)}% (${earlierAvgSets.toFixed(1)} → ${recentAvgSets.toFixed(1)} sets avg)`
      : 'No significant volume intolerance detected'
  };
}

function detectProgressStagnation(logs: any[]) {
  // Look for lack of weight progression over time
  const last4Weeks = logs.slice(-8); // Approximate last 4 weeks
  
  if (last4Weeks.length < 4) {
    return { detected: false, evidence: 'Insufficient data for progress analysis' };
  }
  
  // Get weights where available, filter out bodyweight exercises
  const weights = last4Weeks
    .map(l => l.weight_time)
    .filter(w => w && !isNaN(parseFloat(w)))
    .map(w => parseFloat(w));
  
  if (weights.length < 4) {
    // For bodyweight exercises, analyze RPE trends instead
    const rpes = last4Weeks.map(l => l.rpe || 5);
    const earlierAvgRPE = average(rpes.slice(0, Math.floor(rpes.length / 2)));
    const recentAvgRPE = average(rpes.slice(Math.floor(rpes.length / 2)));
    
    const rpeDecline = earlierAvgRPE - recentAvgRPE;
    const detected = rpeDecline < -0.5; // RPE getting worse (higher) over time
    
    return {
      detected,
      evidence: detected
        ? `Performance declining - RPE increased ${Math.abs(rpeDecline).toFixed(1)} points over time`
        : 'RPE stable or improving for bodyweight exercise'
    };
  }
  
  const maxWeight = Math.max(...weights);
  const recentMaxWeight = Math.max(...weights.slice(-4));
  
  // No progress if recent max isn't at least 2.5% higher than overall max
  const progressRate = (recentMaxWeight - maxWeight) / maxWeight;
  const detected = progressRate < 0.025; // Less than 2.5% progress
  
  return {
    detected,
    evidence: detected
      ? `No significant weight progression in last 4 weeks (${maxWeight} → ${recentMaxWeight} lbs)`
      : `Weight progressing normally (${maxWeight} → ${recentMaxWeight} lbs)`
  };
}

function determineInterventionProtocol(rpeInflation: any, qualityDegradation: any, volumeIntolerance: any) {
  // Prioritize intervention based on primary signal
  if (qualityDegradation.detected) {
    return 'TEMPO_WORK'; // Focus on movement quality
  }
  if (rpeInflation.detected) {
    return 'INTENSITY_REDUCTION'; // Focus on building strength base
  }
  if (volumeIntolerance.detected) {
    return 'VOLUME_PROGRESSION'; // Focus on capacity building
  }
  return 'TEMPO_WORK'; // Default fallback
}

function generateInterventionConstraints(analysis: any) {
  const { recommendedProtocol } = analysis;
  
  const protocols = {
    TEMPO_WORK: {
      intensityRange: [0.60, 0.75],
      volumeModifier: 1.0,
      exerciseModification: 'tempo_variation',
      focusArea: 'movement_quality'
    },
    INTENSITY_REDUCTION: {
      intensityRange: [0.65, 0.80],
      volumeModifier: 1.2,
      exerciseModification: 'standard',
      focusArea: 'strength_base'
    },
    VOLUME_PROGRESSION: {
      intensityRange: [0.70, 0.85],
      volumeModifier: 0.8,
      exerciseModification: 'standard',
      focusArea: 'capacity_building'
    }
  };
  
  return protocols[recommendedProtocol] || protocols.TEMPO_WORK;
}

// Helper functions
function average(numbers: number[]) {
  return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
}

function numberToQuality(num: number) {
  if (num >= 3.5) return 'A';
  if (num >= 2.5) return 'B';
  if (num >= 1.5) return 'C';
  return 'D';
}
