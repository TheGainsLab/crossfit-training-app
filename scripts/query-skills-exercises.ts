// Quick script to query all skills exercises and their program_notes
// Run with: npx tsx scripts/query-skills-exercises.ts
// Requires SUPABASE_URL and SUPABASE_SERVICE_KEY env vars

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
    .select('name, skill_index, difficulty_level, program_notes')
    .eq('can_be_skills', true)
    .order('skill_index')
    .order('difficulty_level')
    .order('name')

  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  console.log(`\nFound ${data.length} skills exercises:\n`)
  console.log('=' .repeat(100))

  // Group by skill_index for easier reading
  const bySkillIndex: Record<number, typeof data> = {}
  for (const ex of data) {
    const idx = ex.skill_index ?? -1
    if (!bySkillIndex[idx]) bySkillIndex[idx] = []
    bySkillIndex[idx].push(ex)
  }

  for (const [skillIdx, exercises] of Object.entries(bySkillIndex).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`\n--- Skill Index: ${skillIdx} ---`)
    for (const ex of exercises) {
      console.log(`\n  ${ex.name} (${ex.difficulty_level})`)
      if (ex.program_notes) {
        const notes = ex.program_notes
        for (const [level, value] of Object.entries(notes)) {
          console.log(`    ${level}: ${value}`)
        }
      } else {
        console.log('    (no program_notes)')
      }
    }
  }
}

main()
