import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Version A Lifting Progressions (mirrored from assign-exercises)
// Squats table: used by Back Squat, Front Squat, and Presses (each with own 1RM)
// Olympic Lifts table: used by Snatch and Clean & Jerk (each with own 1RM)
// Working weeks: { week, sets, reps, percentage } → single uniform prescription
// Deload weeks (4, 8, 12): { week, reps[], percentages[] } → descending sets
const liftingProgressions: Record<string, Record<string, any[]>> = {
  'Squats': {
    'Beginner': [
      { week: 1, sets: 4, reps: 6, percentage: 65 },
      { week: 2, sets: 3, reps: 5, percentage: 70 },
      { week: 3, sets: 4, reps: 8, percentage: 60 },
      { week: 4, reps: [6, 4, 2], percentages: [50, 60, 70] },
      { week: 5, sets: 4, reps: 8, percentage: 65 },
      { week: 6, sets: 4, reps: 5, percentage: 75 },
      { week: 7, sets: 4, reps: 10, percentage: 60 },
      { week: 8, reps: [6, 4, 2], percentages: [50, 60, 70] },
      { week: 9, sets: 5, reps: 6, percentage: 70 },
      { week: 10, sets: 4, reps: 5, percentage: 80 },
      { week: 11, sets: 5, reps: 8, percentage: 65 },
      { week: 12, reps: [6, 4, 2], percentages: [50, 60, 70] }
    ],
    'Intermediate': [
      { week: 1, sets: 4, reps: 5, percentage: 75 },
      { week: 2, sets: 3, reps: 5, percentage: 65 },
      { week: 3, sets: 5, reps: 3, percentage: 80 },
      { week: 4, reps: [6, 4, 2], percentages: [50, 60, 70] },
      { week: 5, sets: 4, reps: 5, percentage: 80 },
      { week: 6, sets: 3, reps: 5, percentage: 70 },
      { week: 7, sets: 5, reps: 3, percentage: 85 },
      { week: 8, reps: [6, 4, 2], percentages: [50, 60, 70] },
      { week: 9, sets: 4, reps: 5, percentage: 85 },
      { week: 10, sets: 3, reps: 5, percentage: 75 },
      { week: 11, sets: 5, reps: 2, percentage: 90 },
      { week: 12, reps: [6, 4, 2], percentages: [50, 60, 70] }
    ],
    'Advanced': [
      { week: 1, sets: 5, reps: 5, percentage: 80 },
      { week: 2, sets: 6, reps: 2, percentage: 60 },
      { week: 3, sets: 7, reps: 1, percentage: 90 },
      { week: 4, reps: [4, 3, 2], percentages: [50, 60, 70] },
      { week: 5, sets: 5, reps: 5, percentage: 83 },
      { week: 6, sets: 6, reps: 2, percentage: 63 },
      { week: 7, sets: 7, reps: 1, percentage: 93 },
      { week: 8, reps: [4, 3, 2], percentages: [50, 60, 70] },
      { week: 9, sets: 5, reps: 5, percentage: 85 },
      { week: 10, sets: 6, reps: 2, percentage: 65 },
      { week: 11, sets: 5, reps: 1, percentage: 95 },
      { week: 12, reps: [4, 3, 2], percentages: [50, 60, 70] }
    ]
  },
  'Olympic Lifts': {
    'Beginner': [
      { week: 1, sets: 6, reps: 4, percentage: 55 },
      { week: 2, sets: 8, reps: 3, percentage: 58 },
      { week: 3, sets: 6, reps: 4, percentage: 55 },
      { week: 4, reps: [4, 3, 2], percentages: [50, 60, 70] },
      { week: 5, sets: 8, reps: 3, percentage: 60 },
      { week: 6, sets: 6, reps: 4, percentage: 58 },
      { week: 7, sets: 8, reps: 3, percentage: 60 },
      { week: 8, reps: [4, 3, 2], percentages: [50, 60, 70] },
      { week: 9, sets: 6, reps: 4, percentage: 63 },
      { week: 10, sets: 8, reps: 3, percentage: 60 },
      { week: 11, sets: 6, reps: 4, percentage: 65 },
      { week: 12, reps: [4, 3, 2], percentages: [50, 60, 70] }
    ],
    'Intermediate': [
      { week: 1, sets: 5, reps: 3, percentage: 70 },
      { week: 2, sets: 4, reps: 3, percentage: 62 },
      { week: 3, sets: 5, reps: 2, percentage: 80 },
      { week: 4, reps: [4, 3, 2], percentages: [50, 60, 70] },
      { week: 5, sets: 5, reps: 3, percentage: 73 },
      { week: 6, sets: 4, reps: 3, percentage: 65 },
      { week: 7, sets: 5, reps: 2, percentage: 80 },
      { week: 8, reps: [4, 3, 2], percentages: [50, 60, 70] },
      { week: 9, sets: 5, reps: 3, percentage: 76 },
      { week: 10, sets: 4, reps: 3, percentage: 68 },
      { week: 11, sets: 5, reps: 2, percentage: 85 },
      { week: 12, reps: [4, 3, 2], percentages: [50, 60, 70] }
    ],
    'Advanced': [
      { week: 1, sets: 4, reps: 3, percentage: 78 },
      { week: 2, sets: 5, reps: 3, percentage: 65 },
      { week: 3, sets: 3, reps: 3, percentage: 85 },
      { week: 4, reps: [4, 3, 2], percentages: [50, 60, 70] },
      { week: 5, sets: 4, reps: 3, percentage: 80 },
      { week: 6, sets: 5, reps: 3, percentage: 67 },
      { week: 7, sets: 3, reps: 3, percentage: 87 },
      { week: 8, reps: [4, 3, 2], percentages: [50, 60, 70] },
      { week: 9, sets: 4, reps: 3, percentage: 82 },
      { week: 10, sets: 5, reps: 3, percentage: 70 },
      { week: 11, sets: 3, reps: 3, percentage: 90 },
      { week: 12, reps: [4, 3, 2], percentages: [50, 60, 70] }
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

    // Presses inherit Squats table per Version A design
    const liftType = ['Snatch', 'Clean and Jerk'].includes(mainLift) ? 'Olympic Lifts' : 'Squats'
    const liftLevel = mainLift === 'Snatch' ? levels.snatch :
      mainLift === 'Clean and Jerk' ? levels.cleanJerk :
      ['Back Squat', 'Front Squat'].includes(mainLift) ? levels.backSquat :
      levels.press

    const progression = liftingProgressions[liftType][liftLevel].find((p: any) => p.week === Number(week))
    if (!progression) {
      return NextResponse.json({ success: true, blocks: [[]] })
    }

    const oneRM = oneRMsArray[find1RMIndex(mainLift)] || 0
    let fullSets: any[]

    if (Array.isArray(progression.reps)) {
      // Deload format: descending sets with varying reps/percentages
      fullSets = progression.reps.map((reps: number, idx: number) => {
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
    } else {
      // Working week: uniform sets × reps @ single percentage
      let weightTime = ''
      if (oneRM > 0) {
        const raw = oneRM * (progression.percentage / 100)
        weightTime = roundWeight(raw, units).toString()
      }
      fullSets = [{
        name: mainLift,
        sets: progression.sets,
        reps: progression.reps,
        weightTime,
        notes: liftLevel
      }]
    }

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
