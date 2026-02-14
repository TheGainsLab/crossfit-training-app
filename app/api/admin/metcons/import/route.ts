import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function isAdminEmail(email: string | null | undefined): boolean {
  const allow = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!allow.length) return true
  if (!email) return false
  return allow.includes(email)
}

// Valid equipment options (must match intake form options)
const VALID_EQUIPMENT = [
  'Air Bike', 'Axle Bar', 'Barbell', 'Bench', 'Squat Rack', 'Climbing Rope',
  'Dball', 'Dip Bar', 'Dumbbells', 'Plyo Box', 'GHD', 'HS Walk Obstacle',
  'High Rings', 'Low or Adjustable Rings', 'Jump Rope', 'Kettlebells',
  'Open Space', 'Parallettes', 'Pegboard', 'Pullup Bar or Rig',
  'Rowing Machine', 'Ski Erg', 'Bike Erg', 'Sandbag', 'Wall Ball', 'Wall Space'
]

// Normalize equipment names to match intake form values
const normalizeEquipment = (raw: string): string => {
  const s = raw.toLowerCase().trim()
  if (s === 'none' || s === '') return 'None'

  // Exact match (case-insensitive)
  const exactMatch = VALID_EQUIPMENT.find(eq => eq.toLowerCase() === s)
  if (exactMatch) return exactMatch

  // Fuzzy matching for common variations
  if (s.includes('pull') && (s.includes('bar') || s.includes('rig'))) return 'Pullup Bar or Rig'
  if (s.includes('barbell')) return 'Barbell'
  if (s.includes('axle')) return 'Axle Bar'
  if (s.includes('dumbbell')) return 'Dumbbells'
  if (s.includes('wall ball') || s.includes('med ball')) return 'Wall Ball'
  if (s.includes('kettlebell')) return 'Kettlebells'
  if (s.includes('rowing') || s.includes('row erg') || s.includes('rower')) return 'Rowing Machine'
  if (s.includes('air bike') || s.includes('assault bike') || s.includes('echo bike')) return 'Air Bike'
  if (s.includes('bike erg') || s === 'bike') return 'Bike Erg'
  if (s.includes('ski')) return 'Ski Erg'
  if (s.includes('jump rope') || s.includes('double under') || s.includes('single under')) return 'Jump Rope'
  if (s.includes('rope climb') || s.includes('climbing rope')) return 'Climbing Rope'
  if (s.includes('plyo') || s.includes('box jump')) return 'Plyo Box'
  if (s.includes('ghd') || s.includes('glute-ham') || s.includes('glute ham')) return 'GHD'
  if (s.includes('high ring')) return 'High Rings'
  if (s.includes('low ring') || s.includes('adjustable ring')) return 'Low or Adjustable Rings'
  if (s === 'rings' || s === 'ring') return 'High Rings'
  if (s.includes('sandbag')) return 'Sandbag'
  if (s.includes('d-ball') || s.includes('dball') || s.includes('d ball')) return 'Dball'
  if (s.includes('dip')) return 'Dip Bar'
  if (s.includes('bench')) return 'Bench'
  if (s.includes('squat rack') || s.includes('rack')) return 'Squat Rack'
  if (s.includes('parallette')) return 'Parallettes'
  if (s.includes('pegboard') || s.includes('peg board')) return 'Pegboard'
  if (s.includes('hs walk') || s.includes('handstand walk') || s.includes('obstacle')) return 'HS Walk Obstacle'
  if (s.includes('open space')) return 'Open Space'
  if (s.includes('wall space')) return 'Wall Space'

  // Return original with proper casing if no match
  return raw.trim()
}

// Valid levels for metcons
const VALID_LEVELS = ['Open', 'Quarterfinal', 'Quarterfinals', 'Semifinal', 'Semifinals', 'Regionals', 'Games']

// Valid formats
const VALID_FORMATS = ['AMRAP', 'For Time', 'Rounds+Reps', 'EMOM', 'Tabata', 'Chipper', 'Ladder', 'Max Reps', 'Max Weight']

// Valid time ranges
const VALID_TIME_RANGES = ['1:00–5:00', '5:00–10:00', '10:00–15:00', '15:00–20:00', '20:00+']

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || (process.env.NEXT_PUBLIC_SUPABASE_URL as string)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }
    const sb = createClient(supabaseUrl, serviceKey)

    // Basic admin gating via bearer token -> user email check
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || ''
    if (token) {
      const { data: authUser } = await createClient(supabaseUrl, serviceKey).auth.getUser(token)
      const email = authUser?.user?.email || null
      if (!isAdminEmail(email)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      if (!isAdminEmail(null)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await req.json()
    const metcons: any[] = Array.isArray(body?.metcons) ? body.metcons : []
    const truncate = Boolean(body?.truncate)

    if (metcons.length === 0) {
      return NextResponse.json({ error: 'No metcons provided' }, { status: 400 })
    }

    // Optionally truncate existing data
    if (truncate) {
      const { error: truncateError } = await sb.from('metcons').delete().neq('id', 0)
      if (truncateError) {
        return NextResponse.json({ error: `Truncate failed: ${truncateError.message}` }, { status: 400 })
      }
    }

    let inserted = 0
    let updated = 0
    const errors: string[] = []

    for (const row of metcons) {
      try {
        // Validate required fields
        const workout_id = String(row.workout_id || '').trim()
        if (!workout_id) {
          errors.push('Missing workout_id')
          continue
        }

        const level = String(row.level || 'Open').trim()
        const format = String(row.format || '').trim()
        if (!format) {
          errors.push(`${workout_id}: Missing format`)
          continue
        }

        // Parse tasks JSON
        let tasks: any[] = []
        if (row.tasks_json) {
          try {
            tasks = typeof row.tasks_json === 'string' ? JSON.parse(row.tasks_json) : row.tasks_json
          } catch (e) {
            errors.push(`${workout_id}: Invalid tasks_json`)
            continue
          }
        } else if (row.tasks) {
          tasks = typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks
        }

        if (!Array.isArray(tasks) || tasks.length === 0) {
          errors.push(`${workout_id}: tasks must be a non-empty array`)
          continue
        }

        // Parse equipment
        let required_equipment: string[] = []
        if (row.equipment_csv || row.required_equipment) {
          const eqRaw = row.equipment_csv || row.required_equipment
          if (typeof eqRaw === 'string') {
            required_equipment = eqRaw.split(',').map(s => normalizeEquipment(s)).filter(Boolean)
          } else if (Array.isArray(eqRaw)) {
            required_equipment = eqRaw.map(s => normalizeEquipment(String(s))).filter(Boolean)
          }
        }

        // Build the metcon record
        const metconRecord = {
          workout_id,
          level,
          format,
          time_range: row.time_range || null,
          max_weight_male: row.max_weight_male || row.max_weight_male_lbs || null,
          max_weight_female: row.max_weight_female || row.max_weight_female_lbs || null,
          required_equipment: required_equipment.length > 0 ? required_equipment : null,
          workout_notes: row.workout_notes || row.notes || null,
          tasks,
          male_p90: row.male_p90 || null,
          male_p50: row.male_p50 || null,
          male_std_dev: row.male_std_dev || null,
          female_p90: row.female_p90 || null,
          female_p50: row.female_p50 || null,
          female_std_dev: row.female_std_dev || null,
          sport_id: parseInt(row.sport_id) || 1,
        }

        // Upsert by workout_id
        const { data: existing } = await sb
          .from('metcons')
          .select('id')
          .eq('workout_id', workout_id)
          .maybeSingle()

        if (existing) {
          const { error: updateError } = await sb
            .from('metcons')
            .update(metconRecord)
            .eq('id', existing.id)

          if (updateError) {
            errors.push(`${workout_id}: Update failed - ${updateError.message}`)
          } else {
            updated++
          }
        } else {
          const { error: insertError } = await sb
            .from('metcons')
            .insert(metconRecord)

          if (insertError) {
            errors.push(`${workout_id}: Insert failed - ${insertError.message}`)
          } else {
            inserted++
          }
        }
      } catch (e: any) {
        errors.push(`Row error: ${e.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      updated,
      total: metcons.length,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined, // Limit errors returned
      hasMoreErrors: errors.length > 20
    })

  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 400 })
  }
}
