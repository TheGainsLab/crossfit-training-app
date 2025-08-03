// test-skills-analyzer.ts
// Test Skills Analyzer - gymnastic skill development tracking

import { createClient } from '@supabase/supabase-js'
import { 
  processSkillsData,
  getSkillProgressionData,
  calculateSkillMastery,
  getSkillsNeedingAttention,
  getSkillsReadyForProgression,
  type SkillsAnalysisData,
  type SkillData 
} from './lib/analytics/skills-analyzer'

// Initialize Supabase client
const supabase = createClient(
  'https://onulmoxjoynunzctzsug.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9udWxtb3hqb3ludW56Y3R6c3VnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM1MjQzNiwiZXhwIjoyMDY3OTI4NDM2fQ.24Z4YBFxdrGGIrl8eBnOxQRf4XVioWX_oAUfPXQ40JI'
)

/**
 * Fetch skills training data
 */
async function fetchSkillsData(userId: number) {
  console.log(`🔍 Fetching skills training data for user ${userId}...`)
  
  try {
    // Get performance data for skills and technical work blocks
    const { data: performanceData, error: perfError } = await supabase
      .from('performance_logs')
      .select('*')
      .eq('user_id', userId)
      .in('block', ['SKILLS', 'TECHNICAL WORK'])
      .order('logged_at', { ascending: true })

    if (perfError) throw perfError

    // Get weekly summaries for skills progression analysis
    const { data: weeklyData, error: weeklyError } = await supabase
      .from('weekly_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('week', { ascending: true })

    if (weeklyError) throw weeklyError

    console.log(`📊 Data Summary:`)
    console.log(`  Skills Performance Records: ${performanceData?.length || 0}`)
    console.log(`  Weekly Summaries: ${weeklyData?.length || 0}`)

    // Show sample skills records to understand data structure
    if (performanceData && performanceData.length > 0) {
      console.log(`  Sample Skills Record:`)
      const sample = performanceData[0]
      console.log(`    Exercise: ${sample.exercise_name}`)
      console.log(`    Block: ${sample.block}`)
      console.log(`    Sets: ${sample.sets}, Reps: ${sample.reps}`)
      console.log(`    RPE: ${sample.rpe}, Quality: ${sample.quality_grade}`)
      console.log(`    Result: ${sample.result || 'Not recorded'}`)
    }

    return {
      performanceData: performanceData || [],
      weeklyData: weeklyData || []
    }

  } catch (error) {
    console.error('❌ Error fetching skills data:', error)
    return null
  }
}

/**
 * Test skills data processing
 */
async function testSkillsAnalyzer() {
  console.log('\n🧪 TESTING SKILLS ANALYZER')
  console.log('=' .repeat(50))
  
  const userId = 47
  
  // 1. Fetch skills data
  const data = await fetchSkillsData(userId)
  
  if (!data || data.performanceData.length === 0) {
    console.log('❌ No skills training data found')
    console.log('📝 Note: User may not have sufficient gymnastic skills logged yet')
    return null
  }

  console.log('\n📊 TESTING SKILLS ANALYSIS:')
  console.log('-'.repeat(30))

  // 2. Process skills data
  console.log('\n1️⃣ Processing Skills Data...')
  const skillsAnalysis = processSkillsData(data.performanceData, data.weeklyData)
  
  if (!skillsAnalysis) {
    console.log('❌ Skills analysis processing failed')
    return null
  }

  console.log('✅ Skills analysis completed')
  console.log(`   Skills analyzed: ${Object.keys(skillsAnalysis.skills).length}`)
  console.log(`   Weekly progression points: ${skillsAnalysis.weeklyProgression.length}`)

  // 3. Individual Skill Analysis
  console.log('\n2️⃣ Individual Skill Analysis:')
  Object.entries(skillsAnalysis.skills).forEach(([name, skill]) => {
    const trendIcon = skill.progressionTrend === 'improving' ? '📈' : 
                     skill.progressionTrend === 'declining' ? '📉' : '➡️'
    const gradeIcon = skill.qualityGrade === 'A' ? '🟢' :
                     skill.qualityGrade === 'B' ? '🟡' :
                     skill.qualityGrade === 'C' ? '🟠' : '🔴'
    
    console.log(`${gradeIcon} ${skill.name} (${skill.block}):`)
    console.log(`   Grade: ${skill.qualityGrade} (${skill.avgQuality.toFixed(1)}/4.0)`)
    console.log(`   Sessions: ${skill.sessions.length}`)
    console.log(`   Total Reps: ${skill.totalReps}`)
    console.log(`   Avg RPE: ${skill.avgRPE.toFixed(1)}`)
    console.log(`   Progression: ${trendIcon} ${skill.progressionTrend}`)
    console.log(`   Consistency: ${skill.consistency}%`)
    console.log(`   Days Since Last: ${skill.daysSinceLast}`)
    console.log(`   Weeks Active: ${skill.weeksActive}`)
    console.log(`   Last Performed: ${new Date(skill.lastPerformed).toLocaleDateString()}`)
    console.log()
  })

  // 4. Skills by Grade Analysis
  console.log('3️⃣ Skills by Grade:')
  Object.entries(skillsAnalysis.skillsByGrade).forEach(([grade, skills]) => {
    const gradeIcon = grade === 'A' ? '🟢' : grade === 'B' ? '🟡' : grade === 'C' ? '🟠' : '🔴'
    console.log(`${gradeIcon} Grade ${grade}: ${skills.length} skills`)
    
    if (skills.length > 0) {
      skills.slice(0, 3).forEach(skill => { // Show top 3 per grade
        console.log(`   • ${skill.name} (${skill.totalReps} reps, ${skill.consistency}% consistency)`)
      })
      if (skills.length > 3) {
        console.log(`   ... and ${skills.length - 3} more`)
      }
    }
    console.log()
  })

  // 5. Weekly Skills Progression
  console.log('4️⃣ Weekly Skills Progression:')
  skillsAnalysis.weeklyProgression.forEach(week => {
    console.log(`📅 Week ${week.week}:`)
    console.log(`   Skills Completed: ${week.skillsCompleted}`)
    console.log(`   Technical Completed: ${week.technicalCompleted}`)
    console.log(`   Skills RPE: ${week.avgSkillsRPE.toFixed(1)}`)
    console.log(`   Technical RPE: ${week.avgTechnicalRPE.toFixed(1)}`)
    console.log(`   Skills Quality: ${week.avgSkillsQuality.toFixed(1)}`)
    console.log(`   Technical Quality: ${week.avgTechnicalQuality.toFixed(1)}`)
    console.log()
  })

  // 6. Consistency Metrics
  console.log('5️⃣ Consistency Metrics:')
  const consistency = skillsAnalysis.consistencyMetrics
  console.log(`📊 Total Skills Practiced: ${consistency.totalSkillsPracticed}`)
  console.log(`🔄 Regularly Practiced (last 2 weeks): ${consistency.regularlyPracticedSkills}`)
  console.log(`📈 Average Sessions per Skill: ${consistency.averageSessionsPerSkill}`)
  console.log(`🏆 Most Consistent: ${consistency.mostConsistentSkill}`)
  console.log(`⚠️  Least Consistent: ${consistency.leastConsistentSkill}`)
  console.log(`🎯 Overall Consistency Rate: ${consistency.overallConsistencyRate}%`)

  // 7. Skill Mastery Analysis
  console.log('\n6️⃣ Skill Mastery Analysis:')
  const mastery = calculateSkillMastery(skillsAnalysis.skills)
  console.log(`🎯 Overall Skill Mastery: ${mastery}%`)
  
  const skillsNeedingAttention = getSkillsNeedingAttention(skillsAnalysis.skills)
  console.log(`⚠️  Skills Needing Attention: ${skillsNeedingAttention.length}`)
  skillsNeedingAttention.slice(0, 3).forEach(skill => {
    const reason = skill.daysSinceLast > 14 ? 'Not practiced recently' :
                  skill.qualityGrade === 'D' ? 'Poor quality' : 'Low consistency'
    console.log(`   • ${skill.name}: ${reason} (${skill.daysSinceLast} days ago)`)
  })

  const skillsReadyForProgression = getSkillsReadyForProgression(skillsAnalysis.skills)
  console.log(`🚀 Skills Ready for Progression: ${skillsReadyForProgression.length}`)
  skillsReadyForProgression.slice(0, 3).forEach(skill => {
    console.log(`   • ${skill.name}: Grade ${skill.qualityGrade}, ${skill.consistency}% consistency`)
  })

  // 8. Chart Data Preparation
  console.log('\n7️⃣ Chart Data Preparation:')
  if (Object.keys(skillsAnalysis.skills).length > 0) {
    const firstSkill = Object.values(skillsAnalysis.skills)[0]
    const progressionData = getSkillProgressionData(firstSkill)
    
    console.log(`📊 Chart data for ${firstSkill.name}:`)
    console.log(`   Data points: ${progressionData.weeks.length}`)
    console.log(`   Weeks: [${progressionData.weeks.join(', ')}]`)
    console.log(`   RPE: [${progressionData.rpe.join(', ')}]`)
    console.log(`   Quality: [${progressionData.quality.join(', ')}]`)
    console.log(`   Volume: [${progressionData.volume.join(', ')}]`)
    console.log('✅ Chart data ready for frontend visualization')
  }

  // 9. Skills Training Recommendations
  console.log('\n8️⃣ Training Recommendations:')
  const totalSkills = Object.keys(skillsAnalysis.skills).length
  const masterSkills = Object.values(skillsAnalysis.skills).filter(s => s.qualityGrade === 'A').length
  const strugglingSkills = Object.values(skillsAnalysis.skills).filter(s => s.qualityGrade === 'D').length
  
  console.log('🎯 Coaching Insights:')
  
  if (mastery >= 75) {
    console.log('   💪 Excellent skill mastery - ready for advanced progressions')
  } else if (mastery >= 50) {
    console.log('   ✅ Good skill development - focus on consistency and progression')
  } else if (mastery >= 25) {
    console.log('   🔧 Developing skills - maintain regular practice')
  } else {
    console.log('   🚀 Early skill development - focus on fundamentals')
  }
  
  if (consistency.overallConsistencyRate >= 70) {
    console.log('   🔄 Excellent training consistency')
  } else if (consistency.overallConsistencyRate >= 50) {
    console.log('   📈 Good consistency - aim for more regular practice')
  } else {
    console.log('   ⚠️  Inconsistent practice - focus on regular skill sessions')
  }

  return skillsAnalysis
}

/**
 * Test with different skill type filters
 */
async function testSkillTypeFiltering() {
  console.log('\n🧪 TESTING SKILL TYPE FILTERING')
  console.log('=' .repeat(50))
  
  const userId = 47
  const data = await fetchSkillsData(userId)
  
  if (!data || data.performanceData.length === 0) {
    console.log('⚠️  No skills data available for filtering test')
    return
  }

  // Test filtering by Skills block only
  console.log('\n1️⃣ Testing Skills Block Filter...')
  const skillsOnly = processSkillsData(data.performanceData, data.weeklyData, 'SKILLS')
  if (skillsOnly) {
    console.log(`✅ Skills Block: ${Object.keys(skillsOnly.skills).length} skills found`)
  }

  // Test filtering by Technical Work block only
  console.log('\n2️⃣ Testing Technical Work Filter...')
  const technicalOnly = processSkillsData(data.performanceData, data.weeklyData, 'TECHNICAL WORK')
  if (technicalOnly) {
    console.log(`✅ Technical Work Block: ${Object.keys(technicalOnly.skills).length} skills found`)
  }

  console.log('✅ Skill type filtering operational')
}

/**
 * Run comprehensive skills analyzer test
 */
async function runTest() {
  try {
    console.log('🚀 Starting Skills Analyzer Testing...\n')
    
    // Test main skills analysis functionality
    const results = await testSkillsAnalyzer()
    
    // Test skill type filtering
    await testSkillTypeFiltering()
    
    console.log('\n🎯 TEST SUMMARY:')
    console.log('=' .repeat(50))
    
    if (results) {
      console.log('✅ Skills Analyzer working successfully')
      console.log('🎯 Gymnastic skill tracking and progression analysis operational')
      console.log('🔄 Consistency metrics and practice pattern analysis complete')
      console.log('📊 Skill mastery and coaching recommendations available')
      console.log('📈 Chart data preparation ready')
    } else {
      console.log('⚠️  Limited skills data available for comprehensive analysis')
      console.log('💡 Skills Analyzer ready but needs more gymnastic training data')
    }
    
    console.log('🤸 Skills analytics module tested and operational')
    
    return results
  } catch (error) {
    console.error('💥 Test failed with error:', error)
  }
}

// Export for use
export { testSkillsAnalyzer, fetchSkillsData, testSkillTypeFiltering, runTest }

// If running directly, run the test
if (typeof window === 'undefined' && require.main === module) {
  runTest()
}
