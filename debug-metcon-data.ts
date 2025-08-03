// debug-metcon-data.ts
// Quick script to see the actual MetCon data structure

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://onulmoxjoynunzctzsug.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9udWxtb3hqb3ludW56Y3R6c3VnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM1MjQzNiwiZXhwIjoyMDY3OTI4NDM2fQ.24Z4YBFxdrGGIrl8eBnOxQRf4XVioWX_oAUfPXQ40JI'
)

async function debugMetConData() {
  console.log('🔍 Debugging MetCon data structure...\n')
  
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
    .eq('program_id', 38)
    .not('user_score', 'is', null)
    .limit(2)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log('📊 Sample MetCon Records:')
  console.log('=' .repeat(50))
  
  metconData?.forEach((record, index) => {
    console.log(`\nRecord ${index + 1}:`)
    console.log('- ID:', record.id)
    console.log('- User Score:', record.user_score)
    console.log('- Percentile:', record.percentile)
    console.log('- MetCon Info:', {
      id: record.metcons?.id,
      workout_id: record.metcons?.workout_id,
      format: record.metcons?.format,
      time_range: record.metcons?.time_range
    })
    
    console.log('- Tasks Structure:')
    console.log('  Type:', typeof record.metcons?.tasks)
    console.log('  Is Array:', Array.isArray(record.metcons?.tasks))
    console.log('  Content:', JSON.stringify(record.metcons?.tasks, null, 2))
    
    if (Array.isArray(record.metcons?.tasks)) {
      console.log('- Individual Tasks:')
      record.metcons.tasks.forEach((task: any, taskIndex: number) => {
        console.log(`  Task ${taskIndex + 1}:`, {
          type: typeof task,
          keys: typeof task === 'object' ? Object.keys(task) : 'N/A',
          exercise: task?.exercise || 'No exercise field',
          full: task
        })
      })
    }
    
    console.log('-' .repeat(40))
  })
}

debugMetConData()
