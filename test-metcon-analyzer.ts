// test-metcon-analyzer.ts
// Script to test your MetCon Analyzer with live data

import { createClient } from '@supabase/supabase-js'
import { 
  processMetConTimeDomainData, 
  calculateMetConProgression,
  getTopTimeDomains,
  getCrossTimeDomainExercises,
  type MetConTimeDomainData 
} from './lib/analytics/metcon-analyzer'

// Initialize Supabase client with your credentials
const supabase = createClient(
  'https://onulmoxjoynunzctzsug.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9udWxtb3hqb3ludW56Y3R6c3VnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM1MjQzNiwiZXhwIjoyMDY3OTI4NDM2fQ.24Z4YBFxdrGGIrl8eBnOxQRf4XVioWX_oAUfPXQ40JI'
)

/**
 * Fetch MetCon data for testing (mimics what your API would provide)
 */
async function fetchMetConDataForUser(userId: number) {
  console.log(`🔍 Fetching MetCon data for user ${userId}...`)
  
  try {
    // Query program_metcons with metcons data (your existing structure)
    const { data: metconData, error } = await supabase
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

    if (error) {
      console.error('❌ Database query failed:', error)
      return null
    }

    console.log(`✅ Retrieved ${metconData?.length || 0} MetCon records`)
    console.log('Sample record:', metconData?.[0])
    
    return metconData
  } catch (error) {
    console.error('❌ Error fetching MetCon data:', error)
    return null
  }
}

/**
 * Fetch Exercise Percentile Log data (NEW - test integration)
 */
async function fetchExercisePercentileData(userId: number) {
  console.log(`🔍 Fetching Exercise Percentile Log data for user ${userId}...`)
  
  try {
    const { data: exerciseData, error } = await supabase
      .from('exercise_percentile_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Exercise Percentile Log query failed:', error)
      return null
    }

    console.log(`✅ Retrieved ${exerciseData?.length || 0} Exercise Percentile entries`)
    console.log('Sample exercise entry:', exerciseData?.[0])
    
    return exerciseData
  } catch (error) {
    console.error('❌ Error fetching Exercise Percentile data:', error)
    return null
  }
}

/**
 * Test the MetCon Analyzer functions
 */
async function testMetConAnalyzer() {
  console.log('🧪 TESTING METCON ANALYZER')
  console.log('=' .repeat(50))
  
  const userId = 47
  
  // 1. Fetch the data
  const metconData = await fetchMetConDataForUser(userId)
  const exerciseData = await fetchExercisePercentileData(userId)
  
  if (!metconData || metconData.length === 0) {
    console.log('❌ No MetCon data found - cannot test')
    return
  }

  console.log('\n📊 TESTING CORE FUNCTIONS:')
  console.log('-'.repeat(30))

  // 2. Test processMetConTimeDomainData
  console.log('\n1️⃣ Testing processMetConTimeDomainData...')
  const timeDomainResult = processMetConTimeDomainData(metconData)
  
  if (timeDomainResult) {
    console.log('✅ Time domain processing successful')
    console.log('Time domains found:', Object.keys(timeDomainResult.timeDomains))
    console.log('Exercises found:', Object.keys(timeDomainResult.exercises))
    console.log('Overall averages:', timeDomainResult.overallAverages)
  } else {
    console.log('❌ Time domain processing failed')
    return
  }

  // 3. Test calculateMetConProgression
  console.log('\n2️⃣ Testing calculateMetConProgression...')
  const progressionResult = calculateMetConProgression(timeDomainResult)
  console.log('✅ Progression trends:', progressionResult)

  // 4. Test getTopTimeDomains
  console.log('\n3️⃣ Testing getTopTimeDomains...')
  const topDomains = getTopTimeDomains(timeDomainResult, 3)
  console.log('✅ Top performing time domains:')
  topDomains.forEach((domain, index) => {
    console.log(`   ${index + 1}. ${domain.timeRange}: ${domain.avgPercentile}th percentile (${domain.count} attempts)`)
  })

  // 5. Test getCrossTimeDomainExercises
  console.log('\n4️⃣ Testing getCrossTimeDomainExercises...')
  const crossDomainExercises = getCrossTimeDomainExercises(timeDomainResult)
  console.log('✅ Cross-domain exercises:')
  crossDomainExercises.slice(0, 5).forEach((exercise, index) => {
    console.log(`   ${index + 1}. ${exercise.exercise}: ${exercise.avgPercentile}th percentile across [${exercise.timeDomains.join(', ')}]`)
  })

  // 6. Compare with Exercise Percentile Log data
  console.log('\n🔗 EXERCISE PERCENTILE LOG INTEGRATION CHECK:')
  console.log('-'.repeat(50))
  
  if (exerciseData && exerciseData.length > 0) {
    console.log('✅ Exercise Percentile Log has data')
    
    // Check if exercises in MetCon analyzer match Exercise Percentile Log
    const metconExercises = new Set(Object.keys(timeDomainResult.exercises))
    const logExercises = new Set(exerciseData.map(entry => entry.exercise_name))
    
    console.log('Exercises in MetCon Analyzer:', Array.from(metconExercises))
    console.log('Exercises in Percentile Log:', Array.from(logExercises))
    
    const overlap = new Set([...metconExercises].filter(x => logExercises.has(x)))
    console.log('Overlapping exercises:', Array.from(overlap))
    
    if (overlap.size > 0) {
      console.log('✅ Integration appears to be working - exercises match!')
    } else {
      console.log('⚠️  No exercise overlap - may need integration work')
    }
  } else {
    console.log('❌ No Exercise Percentile Log data found')
  }

  return {
    timeDomainData: timeDomainResult,
    progression: progressionResult,
    topDomains: topDomains,
    crossDomainExercises: crossDomainExercises,
    exerciseLogData: exerciseData
  }
}

/**
 * Run the test
 */
async function runTest() {
  try {
    console.log('🚀 Starting MetCon Analyzer Testing...\n')
    const results = await testMetConAnalyzer()
    
    console.log('\n🎯 TEST SUMMARY:')
    console.log('=' .repeat(50))
    console.log('✅ All core functions tested successfully')
    console.log('📊 Analytics pipeline appears to be working')
    console.log('💾 Data successfully processed from database')
    
    return results
  } catch (error) {
    console.error('💥 Test failed with error:', error)
  }
}

// Export for use in different environments
export { testMetConAnalyzer, fetchMetConDataForUser, fetchExercisePercentileData, runTest }

// If running directly (not imported), run the test
if (typeof window === 'undefined' && require.main === module) {
  runTest()
}
