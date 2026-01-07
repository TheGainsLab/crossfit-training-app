// Query all technical exercises to review weight caps needed
// Run with: npx tsx scripts/query-technical-exercises.ts

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data, error } = await supabase
    .from('exercises')
    .select('name, technical_dependency, one_rm_reference, program_notes, difficulty_level')
    .eq('can_be_technical', true)
    .order('name')

  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  console.log('Found ' + data.length + ' technical exercises:\n')

  // Group by technical_dependency
  const byDep: Record<string, typeof data> = {}
  for (const ex of data) {
    const deps = ex.technical_dependency || ['None']
    for (const dep of (Array.isArray(deps) ? deps : [deps])) {
      if (!byDep[dep]) byDep[dep] = []
      byDep[dep].push(ex)
    }
  }

  for (const [dep, exercises] of Object.entries(byDep).sort()) {
    console.log('\n=== ' + dep + ' ===')
    for (const ex of exercises) {
      const oneRmRef = ex.one_rm_reference || 'None'
      console.log('  ' + ex.name)
      console.log('    1RM ref: ' + oneRmRef)
      if (ex.program_notes) {
        const notes = ex.program_notes
        const levels = Object.entries(notes).map(([k,v]) => k + ': ' + v).join(', ')
        console.log('    notes: ' + levels)
      }
    }
  }
}

main()
