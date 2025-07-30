// /lib/analytics/insights-generator.ts
import { ExerciseMetrics, Recommendation } from './types'

export function generateDataReflectiveInsights(metrics: ExerciseMetrics): string[] {
  const insights: string[] = []

  // Quality achievement insights
  const qualityGrade = metrics.quality.averageGrade
  if (qualityGrade === 'A') {
    insights.push(`A-level quality achieved! Excellent technique demonstrated`)
  } else if (qualityGrade === 'B') {
    insights.push(`B-grade quality shows solid technique development`)
  } else if (qualityGrade === 'C') {
    insights.push(`C-grade quality demonstrates active skill development in progress`)
  } else {
    insights.push(`Quality scores show you're in the skill-building phase`)
  }

  // RPE reality insights
  if (metrics.rpe.average <= 4) {
    insights.push(`RPE of ${metrics.rpe.average.toFixed(1)} indicates this movement feels comfortable for you`)
  } else if (metrics.rpe.average <= 6) {
    insights.push(`RPE of ${metrics.rpe.average.toFixed(1)} shows moderate effort investment in this exercise`)
  } else if (metrics.rpe.average <= 8) {
    insights.push(`RPE of ${metrics.rpe.average.toFixed(1)} shows you're working hard on this challenging movement`)
  } else {
    insights.push(`RPE of ${metrics.rpe.average.toFixed(1)} indicates maximum effort investment in this exercise`)
  }

  // Volume accomplishment insights
  if (metrics.block !== 'METCONS') {
    insights.push(`${metrics.volume.totalReps} total reps completed across your training sessions`)
    
    if (metrics.timesPerformed >= 10) {
      insights.push(`${metrics.timesPerformed} sessions completed - substantial practice investment`)
    } else if (metrics.timesPerformed >= 5) {
      insights.push(`${metrics.timesPerformed} training sessions show consistent engagement`)
    } else {
      insights.push(`${metrics.timesPerformed} sessions completed while developing this skill`)
    }
  }

  // Trend insights
  if (metrics.rpe.trend === 'improving') {
    insights.push(`RPE trend shows this exercise is becoming easier for you`)
  } else if (metrics.rpe.trend === 'declining') {
    insights.push(`RPE trend indicates increasing challenge with this movement`)
  } else {
    insights.push(`Stable RPE performance shows consistent effort patterns`)
  }

  if (metrics.quality.trend === 'improving') {
    insights.push(`Quality scores show steady technique improvement over time`)
  } else if (metrics.quality.trend === 'stable') {
    insights.push(`Quality scores show consistent execution across sessions`)
  }

  // Recent activity insight
  if (metrics.timing.daysSinceLast <= 7) {
    insights.push(`Recently practiced - maintaining active engagement with this exercise`)
  } else if (metrics.timing.daysSinceLast > 21) {
    insights.push(`${Math.round(metrics.timing.daysSinceLast)} days since last practice session`)
  }

  return insights
}

export function generateCoachCollaborativeRecommendations(metrics: ExerciseMetrics): Recommendation[] {
  const recommendations: Recommendation[] = []
  const qualityGrade = metrics.quality.averageGrade

  // High performance collaboration opportunities
  if (qualityGrade === 'A' && metrics.rpe.average <= 5) {
    recommendations.push({
      type: 'collaboration',
      priority: 'high',
      text: `Strong foundation established - discuss progression opportunities with your coach`,
      icon: '🤝'
    })
  }

  // Skill development collaboration
  if (qualityGrade === 'C' || qualityGrade === 'D') {
    recommendations.push({
      type: 'development',
      priority: 'medium',
      text: `Skill development data provides valuable insights for your next coaching session`,
      icon: '📈'
    })
  }

  // High effort collaboration
  if (metrics.rpe.average >= 8) {
    recommendations.push({
      type: 'effort',
      priority: 'medium',
      text: `High effort investment worth discussing technique strategies with your coach`,
      icon: '💪'
    })
  }

  // Consistency achievements
  if (metrics.timesPerformed >= 5 && metrics.quality.trend === 'stable') {
    recommendations.push({
      type: 'consistency',
      priority: 'low',
      text: `Consistent performance metrics to share in your next coaching session`,
      icon: '📊'
    })
  }

  // Recent practice gaps
  if (metrics.timing.daysSinceLast > 14) {
    recommendations.push({
      type: 'frequency',
      priority: 'medium',
      text: `Training frequency patterns worth reviewing with your coach`,
      icon: '📅'
    })
  }

  // General collaboration recommendation
  if (recommendations.length === 0) {
    recommendations.push({
      type: 'general',
      priority: 'low',
      text: `Your performance data provides good information for training conversations`,
      icon: '💬'
    })
  }

  return recommendations
}
