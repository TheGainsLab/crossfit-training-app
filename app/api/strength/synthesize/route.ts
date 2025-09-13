import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Minimal duplication of lifting progressions to synthesize deterministic Strength sets
const liftingProgressions: Record<string, Record<string, Array<{ week: number; reps: number[]; percentages: number[] }>>> = {
  'Olympic Lifts': {
    'Beginner': [
      { week: 1, reps: [8, 6, 4, 2], percentages: [55, 60, 65, 70] },
      { week: 2, reps: [8, 6, 4, 2], percentages: [60, 65, 70, 75] },
      { week: 3, reps: [8, 6, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 4, reps: [4, 3, 2], percentages: [50, 60, 70] }
    ],
    'Intermediate': [
      { week: 1, reps: [8, 6, 4, 2], percentages: [60, 65, 70, 75] },
      { week: 2, reps: [8, 6, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 3, reps: [8, 6, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 4, reps: [4, 3, 2], percentages: [50, 60, 70] }
    ],
    'Advanced': [
      { week: 1, reps: [4, 4, 2, 2], percentages: [60, 65, 70, 75] },
      { week: 2, reps: [4, 4, 2, 2], percentages: [65, 70, 75, 80] },
      { week: 3, reps: [4, 4, 2, 2], percentages: [70, 75, 80, 85] },
      { week: 4, reps: [4, 3, 2], percentages: [50, 60, 70] }
    ]
  },
  'Squats': {
    'Beginner': [
      { week: 1, reps: [10, 8, 6, 4], percentages: [55, 60, 65, 70] },
      { week: 2, reps: [10, 8, 6, 4], percentages: [60, 65, 70, 75] },
      { week: 3, reps: [10, 8, 6, 4], percentages: [65, 70, 75, 80] },
      { week: 4, reps: [6, 4, 2], percentages: [50, 60, 70] }
    ],
    'Intermediate': [
      { week: 1, reps: [10, 8, 6, 4], percentages: [60, 65, 70, 75] },
      { week: 2, reps: [10, 8, 6, 4], percentages: [65, 70, 75, 80] },
      { week: 3, reps: [10, 8, 6, 4], percentages: [70, 75, 80, 85] },
      { week: 4, reps: [6, 4, 2], percentages: [50, 60, 70] }
    ],
    'Advanced': [
      { week: 1, reps: [6, 4, 4, 2], percentages: [60, 65, 70, 75] },
      { week: 2, reps: [6, 4, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 3, reps: [6, 4, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 4, reps: [4, 3, 2], percentages: [50, 60, 70] }
    ]
  },
  'Presses': {
    'Beginner': [
      { week: 1, reps: [6, 4, 4, 2], percentages: [55, 60, 65, 70] },
      { week: 2, reps: [6, 4, 4, 2], percentages: [60, 65, 70, 75] },
      { week: 3, reps: [6, 4, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 4, reps: [6, 4, 2], percentages: [50, 60, 70] }
    ],
    'Intermediate': [
      { week: 1, reps: [8, 6, 4, 2], percentages: [60, 65, 70, 75] },
      { week: 2, reps: [8, 6, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 3, reps: [8, 6, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 4, reps: [6, 4, 2], percentages: [50, 60, 70] }
    ],
    'Advanced': [
      { week: 1, reps: [6, 4, 4, 2], percentages: [60, 65, 70, 75] },
      { week: 2, reps: [6, 4, 4, 2], percentages: [65, 70, 75, 80] },
      { week: 3, reps: [6, 4, 4, 2], percentages: [70, 75, 80, 85] },
      { week: 4, reps: [4, 3, 2], percentages: [50, 60, 70] }
    ]
  }
}

function find1RMIndex(exercise: string): number {
  const oneRMs = [
    'Snatch', 'Power Snatch', 'Clean and Jerk', 'Power Clean', 'Clean (Only)', 'Jerk (Only)',
    'Back Squat', 'Front Squat', 'Overhead Squat', 'Deadlift', 'Bench Press', 'Push Press',
    'Strict Press', 'Weighted Pullup'
  ]
  return oneRMs.indexOf(exercise)
}

function roundWeight(weight: number, userUnits: string): number {
  if (!weight || isNaN(weight)) return weight
  if (userUnits === 'Metric (kg)') {
    return Math.round(weight / 2.5) * 2.5
  } else {
    return Math.round(weight / 5) * 5
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, mainLift, week, strengthBlocksCount = 1 } = await req.json()
    if (!mainLift || !week) {
      return NextResponse.json({ success: false, error: 'Missing mainLift or week' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceKey)

    let units = 'Imperial (lbs)'
    let oneRMsArray = Array(14).fill(0)
    let levels = { snatch: 'Beginner', cleanJerk: 'Beginner', backSquat: 'Beginner', press: 'Beginner' }

    if (userId) {
      const { data: userRow } = await supabase
        .from('users')
        .select('units')
        .eq('id', userId)
        .single()
      if (userRow?.units) units = userRow.units

      const { data: oneRMs } = await supabase
        .from('latest_user_one_rms')
        .select('one_rm_index, one_rm')
        .eq('user_id', userId)
        .order('one_rm_index')
      if (Array.isArray(oneRMs)) {
        oneRMs.forEach(rm => {
          if (rm.one_rm_index >= 0 && rm.one_rm_index < 14) {
            oneRMsArray[rm.one_rm_index] = rm.one_rm
          }
        })
      }

      // Pull ratio levels if present
      const { data: ratios } = await supabase
        .from('user_ratio_snapshots')
        .select('snatch_level, clean_jerk_level, back_squat_level, press_level')
        .eq('user_id', userId)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (ratios) {
        levels = {
          snatch: ratios.snatch_level || levels.snatch,
          cleanJerk: ratios.clean_jerk_level || levels.cleanJerk,
          backSquat: ratios.back_squat_level || levels.backSquat,
          press: ratios.press_level || levels.press
        }
      }
    }

    const liftType = ['Snatch', 'Clean and Jerk'].includes(mainLift) ? 'Olympic Lifts' :
      ['Back Squat', 'Front Squat'].includes(mainLift) ? 'Squats' : 'Presses'
    const liftLevel = mainLift === 'Snatch' ? levels.snatch :
      mainLift === 'Clean and Jerk' ? levels.cleanJerk :
      ['Back Squat', 'Front Squat'].includes(mainLift) ? levels.backSquat :
      levels.press

    const progression = liftingProgressions[liftType][liftLevel].find(p => p.week === Number(week))
    if (!progression) {
      return NextResponse.json({ success: true, blocks: [[]] })
    }

    const oneRM = oneRMsArray[find1RMIndex(mainLift)] || 0
    const fullSets = progression.reps.map((reps, idx) => {
      let weightTime = ''
      if (oneRM > 0) {
        const raw = oneRM * (progression.percentages[idx] / 100)
        weightTime = roundWeight(raw, units).toString()
      }
      return {
        name: mainLift,
        sets: 1,
        reps: reps,
        weightTime,
        notes: `${liftLevel} - Set ${idx + 1}`
      }
    })

    // Split sets across requested number of strength blocks
    const blocks: any[] = []
    const total = fullSets.length
    const base = Math.floor(total / strengthBlocksCount)
    const extra = total % strengthBlocksCount
    let cursor = 0
    for (let i = 0; i < strengthBlocksCount; i++) {
      const take = base + (i < extra ? 1 : 0)
      blocks.push(fullSets.slice(cursor, cursor + take))
      cursor += take
    }

    return NextResponse.json({ success: true, blocks })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 500 })
  }
}

