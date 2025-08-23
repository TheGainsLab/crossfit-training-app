// /app/api/coach/program-editor/[athleteId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canAccessAthleteData } from '@/lib/permissions';

interface Exercise {
  id: string;
  week: number;
  day: number;
  block: string;
  exerciseIndex: number;
  name: string;
  sets: number | string;
  reps: number | string;
  weightTime: string;
  notes: string;
  isModified: boolean;
  isCompleted: boolean;
  constraintWarnings: string[];
}

interface ProgramEditorResponse {
  success: boolean;
  data?: {
    athlete: {
      id: number;
      name: string;
      email: string;
      ability: string;
      equipment: string[];
      skills: string[];
      oneRMs: number[];
      bodyWeight: number;
    };
    program: {
      id: number;
      programNumber: number;
      weeksGenerated: number[];
    };
    weeks: Array<{
      week: number;
      days: Array<{
        day: number;
        dayName: string;
        isDeload: boolean;
        mainLift: string;
        exercises: Exercise[];
      }>;
    }>;
    modifications: any[];
  };
  error?: string;
}

// Exercise to equipment mapping
const EXERCISE_EQUIPMENT_MAP: { [key: string]: string[] } = {
  'Wall Walks': ['Wall Space'],
  'Handstand Push-ups': ['Wall Space'],
  'Strict Handstand Push-ups': ['Wall Space'],
  'Wall Facing Handstand Push-ups': ['Wall Space'],
  'Ring Muscle Ups': ['High Rings'],
  'Double Unders': ['Jump Rope'],
  'Rope Climbs': ['Climbing Rope'],
  'GHD Sit-ups': ['GHD'],
  'Wall Balls': ['Wall Ball', 'Wall Space'],
  'Rowing': ['Rowing Machine'],
  'Box Jumps': ['Plyo Box'],
  'Box Jump Overs': ['Plyo Box'],
  'Burpee Box Jump Overs': ['Plyo Box'],
  'Dumbbell': ['Dumbbells'],
  'Kettlebell': ['Kettlebells'],
  'Barbell': ['Barbell'],
  'Bench Press': ['Bench', 'Barbell'],
  'Back Squat': ['Squat Rack', 'Barbell'],
  'Front Squat': ['Squat Rack', 'Barbell'],
  'Deadlift': ['Barbell'],
  'Snatch': ['Barbell'],
  'Clean and Jerk': ['Barbell'],
  'Clean': ['Barbell'],
  'Jerk': ['Barbell'],
  'Overhead Squat': ['Barbell'],
  'Thrusters': ['Barbell'],
  'Hang Power Cleans': ['Barbell']
};

// 1RM mapping (based on user snapshot order)
const ONE_RM_EXERCISES = [
  'Snatch', 'Clean', 'Clean and Jerk', 'Jerk', 'Back Squat', 'Front Squat', 
  'Overhead Squat', 'Bench Press', 'Strict Press', 'Push Press', 'Deadlift',
  'Sumo Deadlift', 'Weighted Pull-up'
];

function getRequiredEquipment(exerciseName: string): string[] {
  // Check for exact matches first
  if (EXERCISE_EQUIPMENT_MAP[exerciseName]) {
    return EXERCISE_EQUIPMENT_MAP[exerciseName];
  }

  // Check for partial matches (contains keywords)
  const required: string[] = [];
  const lowerName = exerciseName.toLowerCase();

  if (lowerName.includes('dumbbell') || lowerName.includes('db ')) {
    required.push('Dumbbells');
  }
  if (lowerName.includes('kettlebell') || lowerName.includes('kb ')) {
    required.push('Kettlebells');
  }
  if (lowerName.includes('barbell') || lowerName.includes('snatch') || 
      lowerName.includes('clean') || lowerName.includes('jerk') ||
      lowerName.includes('deadlift') || lowerName.includes('squat') ||
      lowerName.includes('bench') || lowerName.includes('press')) {
    required.push('Barbell');
  }
  if (lowerName.includes('box jump') || lowerName.includes('step up')) {
    required.push('Plyo Box');
  }
  if (lowerName.includes('wall ball')) {
    required.push('Wall Ball', 'Wall Space');
  }
  if (lowerName.includes('handstand') || lowerName.includes('wall walk')) {
    required.push('Wall Space');
  }
  if (lowerName.includes('ring')) {
    required.push('High Rings');
  }
  if (lowerName.includes('rope climb')) {
    required.push('Climbing Rope');
  }
  if (lowerName.includes('double under')) {
    required.push('Jump Rope');
  }
  if (lowerName.includes('ghd')) {
    required.push('GHD');
  }
  if (lowerName.includes('row')) {
    required.push('Rowing Machine');
  }

  return required;
}

function getExercise1RM(exerciseName: string, oneRMs: number[]): number | null {
  const lowerName = exerciseName.toLowerCase();
  
  // Check for direct matches
  for (let i = 0; i < ONE_RM_EXERCISES.length; i++) {
    if (lowerName.includes(ONE_RM_EXERCISES[i].toLowerCase())) {
      return oneRMs[i] || null;
    }
  }
  
  return null;
}

function checkConstraintWarnings(
  exercise: any,
  athleteEquipment: string[],
  athleteOneRMs: number[],
  athleteBodyWeight: number
): string[] {
  const warnings: string[] = [];
  
  // Equipment warnings
  const requiredEquipment = getRequiredEquipment(exercise.name);
  for (const equipment of requiredEquipment) {
    if (!athleteEquipment.includes(equipment)) {
      warnings.push(`Requires ${equipment} - athlete doesn't have this equipment`);
    }
  }
  
  // Weight warnings
  if (exercise.weightTime && !isNaN(parseInt(exercise.weightTime))) {
    const exerciseWeight = parseInt(exercise.weightTime);
    const relevantOneRM = getExercise1RM(exercise.name, athleteOneRMs);
    
    if (relevantOneRM && exerciseWeight > relevantOneRM * 1.1) {
      warnings.push(`Weight (${exerciseWeight}lbs) exceeds 110% of athlete's 1RM (${relevantOneRM}lbs)`);
    }
  }
  
  return warnings;
}

async function getCompletedSessions(supabase: any, athleteId: number): Promise<Set<string>> {
  const { data: sessions } = await supabase
    .from('performance_logs')
    .select('week, day')
    .eq('user_id', athleteId);
    
  const completedSet = new Set<string>();
  if (sessions) {
    sessions.forEach((session: any) => {
      completedSet.add(`${session.week}-${session.day}`);
    });
  }
  
  return completedSet;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ athleteId: string }> }
) {
  try {
    const supabase = await createClient();  // ✅ Added await
    const params = await context.params;
    const athleteId = parseInt(params.athleteId);
    
    if (isNaN(athleteId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid athlete ID'
      }, { status: 400 });
    }

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated'
      }, { status: 401 });
    }

    // Get coach user ID
    const { data: coachData, error: coachError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (coachError || !coachData) {
      return NextResponse.json({
        success: false,
        error: 'Coach not found'
      }, { status: 404 });
    }

    // Check permissions
    const permissionCheck = await canAccessAthleteData(supabase, coachData.id, athleteId);
if (!permissionCheck.hasAccess || !permissionCheck.permissionLevel || (!['edit', 'full'].includes(permissionCheck.permissionLevel))) {    
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions to edit this athlete\'s program'
      }, { status: 403 });
    }

    // Get athlete data
    const { data: athleteData, error: athleteError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', athleteId)
      .single();

    if (athleteError || !athleteData) {
      return NextResponse.json({
        success: false,
        error: 'Athlete not found'
      }, { status: 404 });
    }

    // Get athlete's current program
    const { data: programData, error: programError } = await supabase
      .from('programs')
      .select('*')
      .eq('user_id', athleteId)
       .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (programError || !programData) {
      return NextResponse.json({
        success: false,
        error: 'No program found for this athlete'
      }, { status: 404 });
    }

    // Get existing coach modifications
    const { data: modifications, error: modError } = await supabase
      .from('coach_program_modifications')
      .select('*')
      .eq('coach_id', coachData.id)
      .eq('athlete_id', athleteId)
      .eq('program_id', programData.id);

    if (modError) {
      console.error('Error fetching modifications:', modError);
    }

    // Get completed sessions
    const completedSessions = await getCompletedSessions(supabase, athleteId);

    // Extract athlete constraints from user_snapshot
    const userSnapshot = programData.user_snapshot;
    const athleteEquipment = userSnapshot.equipment || [];
    const athleteOneRMs = userSnapshot.oneRMs || [];
    const athleteBodyWeight = userSnapshot.bodyWeight || 200;

    // Process program data
    const programWeeks = programData.program_data.weeks || [];
    const processedWeeks = [];

    for (const weekData of programWeeks) {
      const weekNumber = weekData.week;
      const processedDays = [];

      for (const dayData of weekData.days) {
        const dayNumber = dayData.day;
        const isSessionCompleted = completedSessions.has(`${weekNumber}-${dayNumber}`);
        const exercises: Exercise[] = [];

        for (const block of dayData.blocks) {
          const blockName = block.block;

          for (let exerciseIndex = 0; exerciseIndex < block.exercises.length; exerciseIndex++) {
            const exercise = block.exercises[exerciseIndex];
            const exerciseId = `${weekNumber}-${dayNumber}-${blockName.replace(/\s+/g, '_').toUpperCase()}-${exerciseIndex}`;
            
            // Check for coach modifications
            const modification = modifications?.find(mod => 
              mod.week === weekNumber &&
              mod.day === dayNumber &&
              mod.block_name === blockName &&
              mod.exercise_index === exerciseIndex
            );

            // Use modified data if available, otherwise original
            const finalExercise = modification ? modification.modified_data : exercise;
            
            // Generate constraint warnings (equipment + weight only)
            const constraintWarnings = checkConstraintWarnings(
              finalExercise,
              athleteEquipment,
              athleteOneRMs,
              athleteBodyWeight
            );

            exercises.push({
              id: exerciseId,
              week: weekNumber,
              day: dayNumber,
              block: blockName,
              exerciseIndex,
              name: finalExercise.name || '',
              sets: finalExercise.sets || '',
              reps: finalExercise.reps || '',
              weightTime: finalExercise.weightTime || '',
              notes: finalExercise.notes || '',
              isModified: !!modification,
              isCompleted: isSessionCompleted,
              constraintWarnings
            });
          }
        }

        processedDays.push({
          day: dayNumber,
          dayName: dayData.dayName || `DAY ${dayNumber}`,
          isDeload: dayData.isDeload || false,
          mainLift: dayData.mainLift || '',
          exercises
        });
      }

      processedWeeks.push({
        week: weekNumber,
        days: processedDays
      });
    }

    // Filter to only show future/current weeks (not completed programs)
    const currentDate = new Date();
    const filteredWeeks = processedWeeks; // For now, show all weeks - you might want to add filtering logic

    const response: ProgramEditorResponse = {
      success: true,
      data: {
        athlete: {
          id: athleteData.id,
          name: athleteData.name,
          email: athleteData.email,
          ability: userSnapshot.ability || 'Beginner',
          equipment: athleteEquipment,
          skills: userSnapshot.skills || [],
          oneRMs: athleteOneRMs,
          bodyWeight: athleteBodyWeight
        },
        program: {
          id: programData.id,
          programNumber: programData.program_number,
          weeksGenerated: programData.weeks_generated || []
        },
        weeks: filteredWeeks,
        modifications: modifications || []
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in program editor API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
