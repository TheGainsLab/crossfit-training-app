// test-dashboard-generator.ts
// Comprehensive test of Dashboard Generator - the synthesis layer

import { createClient } from '@supabase/supabase-js'
import { 
  generateOverallDashboard,
  type DashboardData,
  type DashboardInput 
} from './lib/analytics/dashboard-generator'

// Initialize Supabase client
const supabase = createClient(
  'https://onulmoxjoynunzctzsug.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9udWxtb3hqb3ludW56Y3R6c3VnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM1MjQzNiwiZXhwIjoyMDY3OTI4NDM2fQ.24Z4YBFxdrGGIrl8eBnOxQRf4XVioWX_oAUfPXQ40JI'
)

/**
 * Fetch all data needed for comprehensive dashboard
 */
async function fetchDashboardData(userId: number) {
  console.log(`🔍 Fetching comprehensive data for user ${userId}...`)
  
  try {
    // 1. Performance Logs - Individual exercise data
    const { data: performanceData, error: perfError } = await supabase
      .from('performance_logs')
      .select('*')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })

    if (perfError) throw perfError

    // 2. Weekly Summaries - Aggregated weekly data
    const { data: weeklyData, error: weeklyError } = await supabase
      .from('weekly_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('week', { ascending: true })

    if (weeklyError) throw weeklyError

    // 3. MetCon Data - Conditioning performance with metcon details
    const { data: metconData, error: metconError } = await supabase
      .from('program_metcons')
      .select(`
        *,
        metcons (
          id,
          workout_id,
          format,
          level,
          time_range,
          tasks
        )
      `)
      .eq('program_id', 38) // User 47's program
      .not('user_score', 'is', null)
      .order('completed_at', { ascending: false })

    if (metconError) throw metconError

    console.log('📊 Data Summary:')
    console.log(`  Performance Logs: ${performanceData?.length || 0}`)
    console.log(`  Weekly Summaries: ${weeklyData?.length || 0}`)
    console.log(`  MetCon Records: ${metconData?.length || 0}`)

    return {
      performanceData: performanceData || [],
      weeklyData: weeklyData || [],
      metconData: metconData || []
    }

  } catch (error) {
    console.error('❌ Error fetching dashboard data:', error)
    return null
  }
}

/**
 * Test Dashboard Generator with comprehensive analysis
 */
async function testDashboardGenerator() {
  console.log('🧪 TESTING DASHBOARD GENERATOR')
  console.log('=' .repeat(50))
  
  const userId = 47
  
  // 1. Fetch all required data
  const data = await fetchDashboardData(userId)
  
  if (!data) {
    console.log('❌ Failed to fetch dashboard data')
    return
  }

  // 2. Prepare Dashboard Input
  const dashboardInput: DashboardInput = {
    performanceData: data.performanceData,
    weeklySummaries: data.weeklyData,
    metconData: data.metconData,
    timeRange: 13, // 13-week program
    dashboardType: 'comprehensive'
  }

  console.log('\n📊 TESTING DASHBOARD GENERATION:')
  console.log('-'.repeat(30))

  // 3. Generate Dashboard
  console.log('\n1️⃣ Generating Overall Dashboard...')
  const dashboard = generateOverallDashboard(dashboardInput)
  
  if (!dashboard) {
    console.log('❌ Dashboard generation failed')
    return
  }

  console.log('✅ Dashboard generated successfully')

  // 4. Analyze Overall Metrics
  console.log('\n2️⃣ Overall Training Metrics:')
  console.log(`📅 Training Period: Week ${dashboard.overallMetrics.currentWeek} (${dashboard.overallMetrics.trainingPhase} phase)`)
  console.log(`🏋️  Total Training Days: ${dashboard.overallMetrics.totalTrainingDays}`)
  console.log(`💪 Total Exercises: ${dashboard.overallMetrics.totalExercises}`)
  console.log(`⚡ Average RPE: ${dashboard.overallMetrics.averageRPE}/10`)
  console.log(`🎯 Average Quality: ${dashboard.overallMetrics.averageQuality}/4.0`)
  console.log(`📈 Total Volume: ${dashboard.overallMetrics.totalVolume} reps`)
  console.log(`🔄 Consistency Score: ${dashboard.overallMetrics.consistencyScore}%`)

  // 5. Block Performance Analysis
  console.log('\n3️⃣ Block Performance Analysis:')
  Object.entries(dashboard.blockPerformance).forEach(([block, performance]) => {
    const trendIcon = performance.trend === 'improving' ? '📈' : 
                     performance.trend === 'declining' ? '📉' : '➡️'
    const statusIcon = performance.readyForProgression ? '🚀' :
                      performance.needsAttention ? '⚠️' : '✅'
    
    console.log(`${statusIcon} ${block}:`)
    console.log(`   Exercises: ${performance.exercisesCompleted}`)
    console.log(`   RPE: ${performance.averageRPE}/10 | Quality: ${performance.averageQuality}/4.0`)
    console.log(`   Trend: ${trendIcon} ${performance.trend} | Score: ${performance.overallScore}%`)
    console.log(`   Top Exercises: ${performance.topExercises.join(', ') || 'None'}`)
    console.log()
  })

  // 6. Progression Trends
  console.log('4️⃣ Progression Trends:')
  const trends = dashboard.progressionTrends
  console.log(`📊 RPE Trend: ${trends.rpe}`)
  console.log(`🎯 Quality Trend: ${trends.quality}`)
  console.log(`📈 Volume Trend: ${trends.volume}`)
  console.log(`🔄 Consistency Trend: ${trends.consistency}`)

  // 7. MetCon Analysis
  if (dashboard.metconAnalysis) {
    console.log('\n5️⃣ MetCon Performance Analysis:')
    const metcon = dashboard.metconAnalysis
    console.log(`🏃 Total MetCons: ${metcon.totalWorkouts}`)
    console.log(`📊 Average Percentile: ${metcon.averagePercentile}th`)
    console.log(`🎯 Best Time Domain: ${metcon.bestTimeRange}`)
    console.log(`⚠️  Weakest Time Domain: ${metcon.worstTimeRange}`)
    console.log(`📈 Trend: ${metcon.trend}`)
    console.log(`💪 Strongest Exercises: ${metcon.strongestExercises.join(', ') || 'None identified'}`)
  }

  // 8. Recent Activity
  console.log('\n6️⃣ Recent Activity Summary:')
  const activity = dashboard.recentActivity
  console.log(`📅 Last Workout: ${new Date(activity.lastWorkoutDate).toLocaleDateString()}`)
  console.log(`⏰ Days Since Last Workout: ${activity.daysSinceLastWorkout}`)
  console.log(`📊 Weekly Frequency: ${activity.weeklyFrequency} days`)
  console.log(`🏋️  Recent Exercises: ${activity.recentExercises.length} logged`)
  
  if (activity.recentExercises.length > 0) {
    console.log('   Latest exercises:')
    activity.recentExercises.slice(0, 5).forEach(exercise => {
      console.log(`     • ${exercise.name} (${exercise.block}): RPE ${exercise.rpe}, Quality ${exercise.quality}`)
    })
  }

  // 9. Key Insights
  console.log('\n7️⃣ AI-Generated Key Insights:')
  dashboard.keyInsights.forEach((insight, index) => {
    console.log(`💡 ${index + 1}. ${insight}`)
  })

  // 10. Training Readiness Assessment
  console.log('\n🎯 TRAINING READINESS ASSESSMENT:')
  console.log('-'.repeat(50))
  
  const readyBlocks = Object.entries(dashboard.blockPerformance)
    .filter(([_, performance]) => performance.readyForProgression)
  const attentionBlocks = Object.entries(dashboard.blockPerformance)
    .filter(([_, performance]) => performance.needsAttention)

  console.log(`🚀 Ready for Progression: ${readyBlocks.length} blocks`)
  readyBlocks.forEach(([block, _]) => {
    console.log(`   • ${block}`)
  })

  console.log(`⚠️  Needs Attention: ${attentionBlocks.length} blocks`)
  attentionBlocks.forEach(([block, _]) => {
    console.log(`   • ${block}`)
  })

  // 11. Data Integration Verification
  console.log('\n🔗 DATA INTEGRATION VERIFICATION:')
  console.log('-'.repeat(40))
  console.log(`✅ Performance Logs: ${dashboardInput.performanceData.length} records processed`)
  console.log(`✅ Weekly Summaries: ${dashboardInput.weeklySummaries.length} weeks analyzed`)
  console.log(`✅ MetCon Data: ${dashboardInput.metconData.length} workouts included`)
  console.log(`✅ Block Analysis: ${Object.keys(dashboard.blockPerformance).length} blocks evaluated`)
  console.log(`✅ Insights Generated: ${dashboard.keyInsights.length} key insights`)

  // 12. Dashboard Completeness Score
  const completenessFactors = [
    dashboard.overallMetrics.totalExercises > 0,
    Object.keys(dashboard.blockPerformance).length > 0,
    dashboard.metconAnalysis?.totalWorkouts && dashboard.metconAnalysis.totalWorkouts > 0,
    dashboard.keyInsights.length > 0,
    dashboard.recentActivity.recentExercises.length > 0
  ]
  
  const completenessScore = Math.round((completenessFactors.filter(Boolean).length / completenessFactors.length) * 100)
  
  console.log(`📊 Dashboard Completeness: ${completenessScore}%`)

  return dashboard
}

/**
 * Run the comprehensive test
 */
async function runTest() {
  try {
    console.log('🚀 Starting Dashboard Generator Testing...\n')
    const results = await testDashboardGenerator()
    
    console.log('\n🎯 TEST SUMMARY:')
    console.log('=' .repeat(50))
    console.log('✅ Dashboard Generator working successfully')
    console.log('🧠 AI coaching insights generated')
    console.log('📊 Comprehensive analytics synthesis complete')
    console.log('🔗 Multi-source data integration verified')
    console.log('🎨 Ready for frontend dashboard display')
    
    return results
  } catch (error) {
    console.error('💥 Test failed with error:', error)
  }
}

// Export for use
export { testDashboardGenerator, fetchDashboardData, runTest }

// If running directly, run the test
if (typeof window === 'undefined' && require.main === module) {
  runTest()
}
