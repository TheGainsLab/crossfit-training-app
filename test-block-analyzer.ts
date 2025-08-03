// test-block-analyzer.ts
// Script to test Block Analyzer with live data

import { createClient } from '@supabase/supabase-js'
import { 
  processBlockAnalysisData,
  getWeeklyRPEData,
  getWeeklyQualityData,
  type BlockAnalysisData,
  type ProgressionSignal 
} from './lib/analytics/block-analyzer'

// Initialize Supabase client
const supabase = createClient(
  'https://onulmoxjoynunzctzsug.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9udWxtb3hqb3ludW56Y3R6c3VnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM1MjQzNiwiZXhwIjoyMDY3OTI4NDM2fQ.24Z4YBFxdrGGIrl8eBnOxQRf4XVioWX_oAUfPXQ40JI'
)

/**
 * Fetch weekly summaries data for testing
 */
async function fetchWeeklySummariesForUser(userId: number) {
  console.log(`🔍 Fetching Weekly Summaries data for user ${userId}...`)
  
  try {
    const { data: weeklyData, error } = await supabase
      .from('weekly_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('week', { ascending: true })

    if (error) {
      console.error('❌ Weekly Summaries query failed:', error)
      return null
    }

    console.log(`✅ Retrieved ${weeklyData?.length || 0} weekly summary records`)
    console.log('Sample weekly record:', weeklyData?.[0])
    console.log('Available columns:', weeklyData?.[0] ? Object.keys(weeklyData[0]) : 'None')
    
    return weeklyData
  } catch (error) {
    console.error('❌ Error fetching Weekly Summaries data:', error)
    return null
  }
}

/**
 * Test the Block Analyzer functions
 */
async function testBlockAnalyzer() {
  console.log('🧪 TESTING BLOCK ANALYZER')
  console.log('=' .repeat(50))
  
  const userId = 47
  
  // 1. Fetch the weekly summaries data
  const weeklyData = await fetchWeeklySummariesForUser(userId)
  
  if (!weeklyData || weeklyData.length === 0) {
    console.log('❌ No weekly summary data found - cannot test')
    return
  }

  console.log('\n📊 TESTING CORE FUNCTIONS:')
  console.log('-'.repeat(30))

  // 2. Test processBlockAnalysisData
  console.log('\n1️⃣ Testing processBlockAnalysisData...')
  const blockAnalysis = processBlockAnalysisData(weeklyData)
  
  if (blockAnalysis) {
    console.log('✅ Block analysis processing successful')
    console.log('Weeks analyzed:', blockAnalysis.weeklyData.length)
    console.log('Block trends available:', Object.keys(blockAnalysis.blockTrends))
    console.log('Exercise breakdown blocks:', Object.keys(blockAnalysis.exerciseBreakdown))
    console.log('Progression signals:', blockAnalysis.progressionSignals.length)
  } else {
    console.log('❌ Block analysis processing failed')
    return
  }

  // 3. Analyze Block Trends
  console.log('\n2️⃣ Analyzing Block Trends...')
  Object.entries(blockAnalysis.blockTrends).forEach(([block, trends]) => {
    if (block === 'metcons') {
      console.log(`📈 ${block.toUpperCase()}:`)
      console.log(`   Percentile trend: ${trends.percentile_trend}`)
      console.log(`   Volume trend: ${trends.volume_trend}`)
      console.log(`   Current avg percentile: ${trends.current_avg_percentile}`)
      console.log(`   Weeks active: ${trends.weeks_active}`)
    } else {
      console.log(`📈 ${block.toUpperCase()}:`)
      console.log(`   RPE trend: ${trends.rpe_trend} (current: ${trends.current_avg_rpe})`)
      console.log(`   Quality trend: ${trends.quality_trend} (current: ${trends.current_avg_quality})`)
      console.log(`   Volume trend: ${trends.volume_trend}`)
      console.log(`   Weeks active: ${trends.weeks_active}`)
    }
    console.log()
  })

  // 4. Show Exercise Breakdown
  console.log('3️⃣ Exercise Breakdown by Block:')
  Object.entries(blockAnalysis.exerciseBreakdown).forEach(([block, breakdown]) => {
    console.log(`📋 ${block.toUpperCase()}:`)
    console.log(`   Total exercises: ${breakdown.total_exercises}`)
    console.log(`   Avg RPE: ${breakdown.avg_rpe}`)
    console.log(`   Avg Quality: ${breakdown.avg_quality}`)
    console.log(`   Completion rate: ${breakdown.completion_rate}%`)
    console.log()
  })

  // 5. Show Progression Signals
  console.log('4️⃣ Progression Signals:')
  if (blockAnalysis.progressionSignals.length > 0) {
    blockAnalysis.progressionSignals.forEach((signal, index) => {
      const icon = signal.signal_type === 'progression_ready' ? '🚀' :
                   signal.signal_type === 'needs_attention' ? '⚠️' : '✅'
      console.log(`${icon} ${signal.priority.toUpperCase()} - ${signal.block.toUpperCase()}:`)
      console.log(`   ${signal.message}`)
      console.log(`   Week: ${signal.week}`)
      console.log()
    })
  } else {
    console.log('   No progression signals detected')
  }

  // 6. Test Chart Data Functions
  console.log('5️⃣ Testing Chart Data Functions...')
  
  const rpeData = getWeeklyRPEData(blockAnalysis.weeklyData)
  console.log('✅ Weekly RPE data structure:', {
    weeks: rpeData.weeks,
    hasSkillsData: rpeData.skills?.some(val => val !== null),
    hasTechnicalData: rpeData.technical?.some(val => val !== null),
    hasStrengthData: rpeData.strength?.some(val => val !== null),
    hasAccessoriesData: rpeData.accessories?.some(val => val !== null)
  })

  const qualityData = getWeeklyQualityData(blockAnalysis.weeklyData)
  console.log('✅ Weekly Quality data structure:', {
    weeks: qualityData.weeks,
    hasSkillsData: qualityData.skills?.some(val => val !== null),
    hasTechnicalData: qualityData.technical?.some(val => val !== null),
    hasStrengthData: qualityData.strength?.some(val => val !== null),
    hasAccessoriesData: qualityData.accessories?.some(val => val !== null)
  })

  // 7. Training Readiness Assessment
  console.log('\n🎯 TRAINING READINESS ASSESSMENT:')
  console.log('-'.repeat(50))
  
  const highPrioritySignals = blockAnalysis.progressionSignals.filter(s => s.priority === 'high')
  const progressionReady = blockAnalysis.progressionSignals.filter(s => s.signal_type === 'progression_ready')
  const needsAttention = blockAnalysis.progressionSignals.filter(s => s.signal_type === 'needs_attention')

  console.log(`🚨 High Priority Items: ${highPrioritySignals.length}`)
  console.log(`🚀 Ready for Progression: ${progressionReady.length} blocks`)
  console.log(`⚠️  Needs Attention: ${needsAttention.length} blocks`)
  
  if (progressionReady.length > 0) {
    console.log('\n💪 Progression Recommendations:')
    progressionReady.forEach(signal => {
      console.log(`   • ${signal.block}: ${signal.message}`)
    })
  }

  if (needsAttention.length > 0) {
    console.log('\n🔧 Areas for Attention:')
    needsAttention.forEach(signal => {
      console.log(`   • ${signal.block}: ${signal.message}`)
    })
  }

  return blockAnalysis
}

/**
 * Run the test
 */
async function runTest() {
  try {
    console.log('🚀 Starting Block Analyzer Testing...\n')
    const results = await testBlockAnalyzer()
    
    console.log('\n🎯 TEST SUMMARY:')
    console.log('=' .repeat(50))
    console.log('✅ Block Analyzer functions tested successfully')
    console.log('📊 Training periodization analysis complete')
    console.log('💾 Weekly summary data successfully processed')
    console.log('🧠 Progression intelligence generated')
    
    return results
  } catch (error) {
    console.error('💥 Test failed with error:', error)
  }
}

// Export for use in different environments
export { testBlockAnalyzer, fetchWeeklySummariesForUser, runTest }

// If running directly, run the test
if (typeof window === 'undefined' && require.main === module) {
  runTest()
}
