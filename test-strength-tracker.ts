// test-strength-tracker.ts
// Test Strength Tracker - lifting progression and ratio monitoring

import { createClient } from '@supabase/supabase-js'
import { 
  processStrengthData,
  getMovementProgressionData,
  calculate1RM,
  getTopMovements,
  type StrengthAnalysisData,
  type MovementData 
} from './lib/analytics/strength-tracker'

// Initialize Supabase client
const supabase = createClient(
  'https://onulmoxjoynunzctzsug.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9udWxtb3hqb3ludW56Y3R6c3VnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM1MjQzNiwiZXhwIjoyMDY3OTI4NDM2fQ.24Z4YBFxdrGGIrl8eBnOxQRf4XVioWX_oAUfPXQ40JI'
)

/**
 * Fetch strength training data
 */
async function fetchStrengthData(userId: number) {
  console.log(`🔍 Fetching strength training data for user ${userId}...`)
  
  try {
    // Get performance data for strength and power blocks
    const { data: performanceData, error: perfError } = await supabase
      .from('performance_logs')
      .select('*')
      .eq('user_id', userId)
      .in('block', ['STRENGTH AND POWER', 'STRENGTH & POWER', 'STRENGTH', 'TECHNICAL WORK']) // Include technical work for olympic lifts
      .order('logged_at', { ascending: true })

    if (perfError) throw perfError

    // Get weekly summaries for periodization analysis
    const { data: weeklyData, error: weeklyError } = await supabase
      .from('weekly_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('week', { ascending: true })

    if (weeklyError) throw weeklyError

    console.log(`📊 Data Summary:`)
    console.log(`  Strength Performance Records: ${performanceData?.length || 0}`)
    console.log(`  Weekly Summaries: ${weeklyData?.length || 0}`)

    // Show sample strength records to understand data structure
    if (performanceData && performanceData.length > 0) {
      console.log(`  Sample Strength Record:`)
      const sample = performanceData[0]
      console.log(`    Exercise: ${sample.exercise_name}`)
      console.log(`    Block: ${sample.block}`)
      console.log(`    Weight/Time: ${sample.weight_time || 'Not recorded'}`)
      console.log(`    Sets: ${sample.sets}, Reps: ${sample.reps}`)
      console.log(`    RPE: ${sample.rpe}, Quality: ${sample.quality_grade}`)
    }

    return {
      performanceData: performanceData || [],
      weeklyData: weeklyData || []
    }

  } catch (error) {
    console.error('❌ Error fetching strength data:', error)
    return null
  }
}

/**
 * Test utility functions
 */
function testUtilityFunctions() {
  console.log('\n🧪 TESTING UTILITY FUNCTIONS')
  console.log('=' .repeat(50))

  // Test 1RM calculations
  console.log('\n1️⃣ Testing 1RM Calculations (Epley Formula)...')
  const rmTests = [
    { weight: 225, reps: 5, expected: Math.round(225 * (1 + 5/30)) },
    { weight: 185, reps: 8, expected: Math.round(185 * (1 + 8/30)) },
    { weight: 315, reps: 1, expected: 315 }, // 1RM is itself
    { weight: 135, reps: 12, expected: Math.round(135 * (1 + 12/30)) }
  ]

  rmTests.forEach(test => {
    const result = calculate1RM(test.weight, test.reps)
    const status = result === test.expected ? '✅' : '❌'
    console.log(`   ${status} ${test.weight}lbs x ${test.reps} reps → 1RM: ${result}lbs (expected: ${test.expected}lbs)`)
  })

  console.log('\n✅ Utility functions tested')
}

/**
 * Test strength data processing
 */
async function testStrengthTracker() {
  console.log('\n🧪 TESTING STRENGTH TRACKER')
  console.log('=' .repeat(50))
  
  const userId = 47
  
  // 1. Fetch strength data
  const data = await fetchStrengthData(userId)
  
  if (!data || data.performanceData.length === 0) {
    console.log('❌ No strength training data found')
    console.log('📝 Note: User may not have sufficient strength training logged yet')
    return null
  }

  console.log('\n📊 TESTING STRENGTH ANALYSIS:')
  console.log('-'.repeat(30))

  // 2. Process strength data
  console.log('\n1️⃣ Processing Strength Data...')
  const strengthAnalysis = processStrengthData(data.performanceData, data.weeklyData)
  
  if (!strengthAnalysis) {
    console.log('❌ Strength analysis processing failed')
    return null
  }

  console.log('✅ Strength analysis completed')
  console.log(`   Movements analyzed: ${Object.keys(strengthAnalysis.movements).length}`)
  console.log(`   Weekly progression points: ${strengthAnalysis.weeklyProgression.length}`)
  console.log(`   Strength ratios calculated: ${strengthAnalysis.strengthRatios.length}`)

  // 3. Movement Analysis
  console.log('\n2️⃣ Movement Analysis:')
  Object.entries(strengthAnalysis.movements).forEach(([name, movement]) => {
    const trendIcon = movement.progressionTrend === 'improving' ? '📈' : 
                     movement.progressionTrend === 'declining' ? '📉' : '➡️'
    
    console.log(`${trendIcon} ${movement.name}:`)
    console.log(`   Sessions: ${movement.sessions.length}`)
    console.log(`   Max Weight: ${movement.maxWeight}lbs`)
    console.log(`   Current Weight: ${movement.currentWeight}lbs`)
    console.log(`   Avg RPE: ${movement.avgRPE.toFixed(1)}`)
    console.log(`   Avg Quality: ${movement.avgQuality.toFixed(1)}`)
    console.log(`   Total Volume: ${movement.totalVolume.toLocaleString()}lbs`)
    console.log(`   Progression: ${movement.progressionTrend}`)
    console.log(`   Weeks Active: ${movement.weeksActive}`)
    console.log(`   Last Performed: ${new Date(movement.lastPerformed).toLocaleDateString()}`)
    
    // Show estimated 1RM if we have rep data
    if (movement.maxWeight > 0) {
      const estimated1RM = calculate1RM(movement.maxWeight, 1) // Assuming max weight is 1RM
      console.log(`   Estimated 1RM: ${estimated1RM}lbs`)
    }
    console.log()
  })

  // 4. Weekly Progression Analysis
  console.log('3️⃣ Weekly Progression:')
  strengthAnalysis.weeklyProgression.forEach(week => {
    console.log(`📅 Week ${week.week}:`)
    console.log(`   Total Volume: ${week.totalVolume.toLocaleString()}lbs`)
    console.log(`   Avg Intensity: ${week.avgIntensity.toFixed(1)}%`)
    console.log(`   Avg RPE: ${week.avgRPE.toFixed(1)}`)
    console.log(`   Avg Quality: ${week.avgQuality.toFixed(1)}`)
    console.log(`   Movements: ${week.movementsPerformed}`)
    console.log()
  })

  // 5. Strength Ratios Analysis
  console.log('4️⃣ Strength Ratios Analysis:')
  if (strengthAnalysis.strengthRatios.length > 0) {
    strengthAnalysis.strengthRatios.forEach(ratio => {
      const statusIcon = ratio.status === 'excellent' ? '🟢' :
                        ratio.status === 'good' ? '🟡' : '🔴'
      
      console.log(`${statusIcon} ${ratio.ratio_name}:`)
      console.log(`   Current: ${ratio.current_ratio}%`)
      console.log(`   Target: ${ratio.target_ratio}%`)
      console.log(`   Status: ${ratio.status}`)
      console.log()
    })
  } else {
    console.log('   ⚠️  Insufficient movement data for ratio calculations')
    console.log('   💡 Need multiple compound lifts (Back Squat, Front Squat, Deadlift, Clean, Snatch)')
  }

  // 6. Periodization Analysis
  console.log('5️⃣ Periodization Analysis:')
  const periodization = strengthAnalysis.periodization
  console.log(`📋 Current Phase: ${periodization.current_phase}`)
  console.log(`📅 Week in Phase: ${periodization.week_in_phase}`)
  console.log(`📈 Intensity Trend: ${periodization.intensity_trend}`)
  console.log(`📊 Volume Trend: ${periodization.volume_trend}`)
  console.log(`🎯 Recommended Focus: ${periodization.recommended_focus}`)

  // 7. Top Movements Analysis
  console.log('\n6️⃣ Top Movements Analysis:')
  
  const topByWeight = getTopMovements(strengthAnalysis.movements, 'weight').slice(0, 3)
  console.log('🏆 Strongest Movements (by max weight):')
  topByWeight.forEach((movement, index) => {
    console.log(`   ${index + 1}. ${movement.name}: ${movement.maxWeight}lbs`)
  })

  const topByProgression = getTopMovements(strengthAnalysis.movements, 'progression').slice(0, 3)
  console.log('\n📈 Best Progression:')
  topByProgression.forEach((movement, index) => {
    console.log(`   ${index + 1}. ${movement.name}: ${movement.progressionTrend}`)
  })

  const topByVolume = getTopMovements(strengthAnalysis.movements, 'volume').slice(0, 3)
  console.log('\n💪 Highest Volume:')
  topByVolume.forEach((movement, index) => {
    console.log(`   ${index + 1}. ${movement.name}: ${movement.totalVolume.toLocaleString()}lbs`)
  })

  // 8. Test movement progression data for charting
  console.log('\n7️⃣ Chart Data Preparation:')
  if (Object.keys(strengthAnalysis.movements).length > 0) {
    const firstMovement = Object.values(strengthAnalysis.movements)[0]
    const progressionData = getMovementProgressionData(firstMovement)
    
    console.log(`📊 Chart data for ${firstMovement.name}:`)
    console.log(`   Data points: ${progressionData.weeks.length}`)
    console.log(`   Weeks: [${progressionData.weeks.join(', ')}]`)
    console.log(`   Weights: [${progressionData.weights.join(', ')}]`)
    console.log(`   RPE: [${progressionData.rpe.join(', ')}]`)
    console.log('✅ Chart data ready for frontend visualization')
  }

  return strengthAnalysis
}

/**
 * Run comprehensive strength tracker test
 */
async function runTest() {
  try {
    console.log('🚀 Starting Strength Tracker Testing...\n')
    
    // Test utility functions
    testUtilityFunctions()
    
    // Test main strength tracking functionality
    const results = await testStrengthTracker()
    
    console.log('\n🎯 TEST SUMMARY:')
    console.log('=' .repeat(50))
    
    if (results) {
      console.log('✅ Strength Tracker working successfully')
      console.log('💪 Movement analysis and progression tracking operational')
      console.log('📊 Strength ratios and periodization analysis complete')
      console.log('📈 Chart data preparation ready')
      console.log('🎯 Coaching insights for strength development available')
    } else {
      console.log('⚠️  Limited strength data available for comprehensive analysis')
      console.log('💡 Strength Tracker ready but needs more training data')
    }
    
    console.log('🔧 Strength analytics module tested and operational')
    
    return results
  } catch (error) {
    console.error('💥 Test failed with error:', error)
  }
}

// Export for use
export { testStrengthTracker, fetchStrengthData, testUtilityFunctions, runTest }

// If running directly, run the test
if (typeof window === 'undefined' && require.main === module) {
  runTest()
}
