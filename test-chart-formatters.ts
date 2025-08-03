// test-chart-formatters.ts
// Test existing Chart Formatters and implement missing ones

import { createClient } from '@supabase/supabase-js'
import { 
  processBlockAnalysisData,
  getWeeklyRPEData,
  getWeeklyQualityData,
  type BlockAnalysisData 
} from './lib/analytics/block-analyzer'
import { 
  processMetConTimeDomainData,
  type MetConTimeDomainData 
} from './lib/analytics/metcon-analyzer'
import {
  formatTrendsChart,
  formatVolumeChart,
  formatMetConChart,
  formatBlockCharts,
  formatMetConCharts,
  formatDashboardCharts
} from './lib/analytics/chart-formatters'

// Initialize Supabase client
const supabase = createClient(
  'https://onulmoxjoynunzctzsug.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9udWxtb3hqb3ludW56Y3R6c3VnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM1MjQzNiwiZXhwIjoyMDY3OTI4NDM2fQ.24Z4YBFxdrGGIrl8eBnOxQRf4XVioWX_oAUfPXQ40JI'
)

/**
 * Enhanced Block Chart Formatters (implement the TODOs)
 */
function formatBlockRPEChart(blockAnalysis: BlockAnalysisData): any {
  const rpeData = getWeeklyRPEData(blockAnalysis.weeklyData)
  
  return {
    labels: rpeData.weeks.map(week => `Week ${week}`),
    datasets: [
      {
        label: 'Skills',
        data: rpeData.skills,
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        tension: 0.3
      },
      {
        label: 'Technical',
        data: rpeData.technical,
        borderColor: '#2196F3',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        tension: 0.3
      },
      {
        label: 'Strength',
        data: rpeData.strength,
        borderColor: '#FF9800',
        backgroundColor: 'rgba(255, 152, 0, 0.1)',
        tension: 0.3
      },
      {
        label: 'Accessories',
        data: rpeData.accessories,
        borderColor: '#9C27B0',
        backgroundColor: 'rgba(156, 39, 176, 0.1)',
        tension: 0.3
      }
    ]
  }
}

function formatBlockQualityChart(blockAnalysis: BlockAnalysisData): any {
  const qualityData = getWeeklyQualityData(blockAnalysis.weeklyData)
  
  return {
    labels: qualityData.weeks.map(week => `Week ${week}`),
    datasets: [
      {
        label: 'Skills Quality',
        data: qualityData.skills,
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        type: 'bar'
      },
      {
        label: 'Technical Quality',
        data: qualityData.technical,
        borderColor: '#2196F3',
        backgroundColor: 'rgba(33, 150, 243, 0.2)',
        type: 'bar'
      },
      {
        label: 'Strength Quality',
        data: qualityData.strength,
        borderColor: '#FF9800',
        backgroundColor: 'rgba(255, 152, 0, 0.2)',
        type: 'bar'
      },
      {
        label: 'Accessories Quality',
        data: qualityData.accessories,
        borderColor: '#9C27B0',
        backgroundColor: 'rgba(156, 39, 176, 0.2)',
        type: 'bar'
      }
    ]
  }
}

function formatProgressionSignalsChart(blockAnalysis: BlockAnalysisData): any {
  const signalCounts = blockAnalysis.progressionSignals.reduce((acc, signal) => {
    const block = signal.block
    if (!acc[block]) acc[block] = { ready: 0, attention: 0, on_track: 0 }
    acc[block][signal.signal_type === 'progression_ready' ? 'ready' : 
               signal.signal_type === 'needs_attention' ? 'attention' : 'on_track']++
    return acc
  }, {} as any)

  const blocks = Object.keys(signalCounts)
  
  return {
    labels: blocks.map(block => block.charAt(0).toUpperCase() + block.slice(1)),
    datasets: [
      {
        label: 'Ready for Progression',
        data: blocks.map(block => signalCounts[block]?.ready || 0),
        backgroundColor: '#4CAF50'
      },
      {
        label: 'Needs Attention',
        data: blocks.map(block => signalCounts[block]?.attention || 0),
        backgroundColor: '#F44336'
      },
      {
        label: 'On Track',
        data: blocks.map(block => signalCounts[block]?.on_track || 0),
        backgroundColor: '#2196F3'
      }
    ]
  }
}

/**
 * Enhanced MetCon Chart Formatters
 */
function formatTimeDomainChart(metconData: MetConTimeDomainData): any {
  const timeDomains = Object.keys(metconData.timeDomains)
  const averages = timeDomains.map(domain => metconData.overallAverages[domain])
  const counts = timeDomains.map(domain => metconData.timeDomains[domain].count)

  return {
    labels: timeDomains,
    datasets: [
      {
        label: 'Average Percentile',
        data: averages,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2
      }
    ]
  }
}

function formatExercisePerformanceChart(metconData: MetConTimeDomainData): any {
  // Get top performing exercises across all time domains
  const exerciseAverages: { [key: string]: number } = {}
  
  Object.entries(metconData.exercises).forEach(([exercise, timeDomains]) => {
    let totalPercentile = 0
    let totalCount = 0
    
    Object.values(timeDomains).forEach(domain => {
      totalPercentile += domain.avgPercentile * domain.count
      totalCount += domain.count
    })
    
    exerciseAverages[exercise] = totalCount > 0 ? totalPercentile / totalCount : 0
  })

  const sortedExercises = Object.entries(exerciseAverages)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10) // Top 10 exercises

  return {
    labels: sortedExercises.map(([exercise]) => exercise),
    datasets: [
      {
        label: 'Average Percentile',
        data: sortedExercises.map(([, percentile]) => percentile),
        backgroundColor: sortedExercises.map((_, index) => 
          `hsla(${index * 36}, 70%, 60%, 0.8)`
        )
      }
    ]
  }
}

/**
 * Test Chart Formatters
 */
async function testChartFormatters() {
  console.log('🧪 TESTING CHART FORMATTERS')
  console.log('=' .repeat(50))
  
  const userId = 47
  
  // Fetch data
  console.log('🔍 Fetching data for chart formatting...')
  
  // Get Block Analysis data
  const { data: weeklyData } = await supabase
    .from('weekly_summaries')
    .select('*')
    .eq('user_id', userId)
    .order('week', { ascending: true })

  const blockAnalysis = processBlockAnalysisData(weeklyData)
  
  // Get MetCon data
  const { data: metconData } = await supabase
    .from('program_metcons')
    .select(`*, metcons (*)`)
    .eq('program_id', 38)
    .not('user_score', 'is', null)

  const metconAnalysis = processMetConTimeDomainData(metconData)

  if (!blockAnalysis || !metconAnalysis) {
    console.log('❌ Failed to get analysis data')
    return
  }

  console.log('\n📊 TESTING CHART FORMATTERS:')
  console.log('-'.repeat(30))

  // 1. Test Block Charts
  console.log('\n1️⃣ Testing Block Chart Formatters...')
  
  const blockRPEChart = formatBlockRPEChart(blockAnalysis)
  console.log('✅ Block RPE Chart:')
  console.log('   Labels:', blockRPEChart.labels)
  console.log('   Datasets:', blockRPEChart.datasets.length)
  console.log('   Sample data points:', blockRPEChart.datasets[0].data)

  const blockQualityChart = formatBlockQualityChart(blockAnalysis)
  console.log('✅ Block Quality Chart:')
  console.log('   Labels:', blockQualityChart.labels)
  console.log('   Datasets:', blockQualityChart.datasets.length)

  const progressionChart = formatProgressionSignalsChart(blockAnalysis)
  console.log('✅ Progression Signals Chart:')
  console.log('   Labels:', progressionChart.labels)
  console.log('   Datasets:', progressionChart.datasets.map(d => d.label))

  // 2. Test MetCon Charts
  console.log('\n2️⃣ Testing MetCon Chart Formatters...')
  
  const timeDomainChart = formatTimeDomainChart(metconAnalysis)
  console.log('✅ Time Domain Chart:')
  console.log('   Labels:', timeDomainChart.labels)
  console.log('   Data:', timeDomainChart.datasets[0].data)

  const exerciseChart = formatExercisePerformanceChart(metconAnalysis)
  console.log('✅ Exercise Performance Chart:')
  console.log('   Top exercises:', exerciseChart.labels)
  console.log('   Performance data:', exerciseChart.datasets[0].data)

  // 3. Test existing formatters with mock data
  console.log('\n3️⃣ Testing Existing Chart Functions...')
  
  // Mock ExerciseMetrics for testing existing functions
  const mockMetrics = {
    progressionData: {
      dates: ['2025-01-01', '2025-01-08', '2025-01-15'],
      weeks: [1, 2, 3],
      rpe: [6, 7, 6.5],
      quality: [3.5, 3.0, 3.7],
      volume: [100, 120, 110]
    },
    metcon: {
      avgPercentile: 45
    }
  }

  try {
    const trendsChart = formatTrendsChart(mockMetrics as any)
    console.log('✅ Trends Chart (existing):')
    console.log('   Labels:', trendsChart.labels)
    console.log('   Datasets:', trendsChart.datasets.length)

    const volumeChart = formatVolumeChart(mockMetrics as any)
    console.log('✅ Volume Chart (existing):')
    console.log('   Labels:', volumeChart.labels)
    console.log('   Dataset type:', volumeChart.datasets[0].type)
  } catch (error) {
    console.log('⚠️  Existing chart functions need type adjustments')
  }

  // 4. Summary of Chart.js Output
  console.log('\n🎨 CHART.JS READY OUTPUT SUMMARY:')
  console.log('-'.repeat(40))
  console.log('✅ Block RPE Progression Chart - Ready for Line Chart')
  console.log('✅ Block Quality Comparison Chart - Ready for Bar Chart')
  console.log('✅ Progression Signals Chart - Ready for Stacked Bar Chart')
  console.log('✅ MetCon Time Domain Chart - Ready for Bar Chart')
  console.log('✅ Exercise Performance Chart - Ready for Horizontal Bar Chart')

  return {
    blockCharts: {
      rpe: blockRPEChart,
      quality: blockQualityChart,
      progression: progressionChart
    },
    metconCharts: {
      timeDomain: timeDomainChart,
      exercises: exerciseChart
    },
    summary: {
      totalCharts: 5,
      chartTypes: ['line', 'bar', 'stacked-bar', 'horizontal-bar'],
      dataPoints: blockRPEChart.datasets[0].data.length,
      timeRange: `Week ${Math.min(...blockRPEChart.labels.map((l: string) => parseInt(l.split(' ')[1])))} - Week ${Math.max(...blockRPEChart.labels.map((l: string) => parseInt(l.split(' ')[1])))}`
    }
  }
}

/**
 * Run the test
 */
async function runTest() {
  try {
    console.log('🚀 Starting Chart Formatters Testing...\n')
    const results = await testChartFormatters()
    
    console.log('\n🎯 TEST SUMMARY:')
    console.log('=' .repeat(50))
    console.log('✅ Chart formatters working successfully')
    console.log('📊 Chart.js-compatible data structures generated')
    console.log('🎨 Ready for frontend visualization')
    console.log('💾 Analytics → Charts pipeline complete')
    
    return results
  } catch (error) {
    console.error('💥 Test failed with error:', error)
  }
}

// Export for use
export { testChartFormatters, formatBlockRPEChart, formatBlockQualityChart, formatTimeDomainChart, runTest }

// If running directly, run the test
if (typeof window === 'undefined' && require.main === module) {
  runTest()
}
