// app/api/coach/program-editor/[athleteId]/modify-exercise/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canAccessAthleteData } from '../../../../../../lib/permissions';

interface ExerciseModificationRequest {
  exerciseId: string;
  exerciseIndex: number;
  week: number;
  day: number;
  programId: string;
  modifications: {
    name?: string;
    sets?: number;
    reps?: string;
    weightTime?: string;
    notes?: string;
  };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  try {
    const { athleteId } = await params;

    // Initialize Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set(name, value, options);
            } catch (error) {
              // Handle cookie setting errors
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set(name, '', { ...options, maxAge: 0 });
            } catch (error) {
              // Handle cookie removal errors
            }
          },
        },
      }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get requesting user from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const requestingUserId = userData.id;
    
// ADD THESE DEBUG LOGS HERE:
console.log('🔍 DEBUG - Requesting user ID (coach):', requestingUserId, typeof requestingUserId);
console.log('🔍 DEBUG - Athlete ID from URL:', athleteId, typeof athleteId);
console.log('🔍 DEBUG - Athlete ID as int:', parseInt(athleteId));



    // Check permissions - only coaches can modify
    const permissionCheck = await canAccessAthleteData(supabase, requestingUserId, parseInt(athleteId));
    if (!permissionCheck.hasAccess || !permissionCheck.isCoach) {
      return NextResponse.json({ success: false, error: 'Only coaches can modify exercises' }, { status: 403 });
    }

    const body: ExerciseModificationRequest = await request.json();
    const { exerciseId, exerciseIndex, week, day, programId, modifications } = body;

    // Validate required fields
    if (!exerciseId || !programId || week === undefined || day === undefined || exerciseIndex === undefined) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: exerciseId, programId, week, day, exerciseIndex' 
      }, { status: 400 });
    }

    // Validate modifications
    if (modifications.sets !== undefined && (modifications.sets <= 0 || modifications.sets > 50)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Sets must be between 1 and 50' 
      }, { status: 400 });
    }

    if (modifications.reps !== undefined && String(modifications.reps).length > 5) {
      return NextResponse.json({ 
        success: false, 
        error: 'Reps must be 5 characters or less' 
      }, { status: 400 });
    }

    if (modifications.weightTime !== undefined && String(modifications.weightTime).length > 5) {
      return NextResponse.json({ 
        success: false, 
        error: 'Weight/Time must be 5 characters or less' 
      }, { status: 400 });
    }

    if (!modifications.name || !modifications.name.trim()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Exercise name is required' 
      }, { status: 400 });
    }

console.log('🔍 DEBUG - Searching for: coach_id =', requestingUserId, 'athlete_id =', parseInt(athleteId), 'status = active');
    
// Get the coach-athlete relationship ID
const { data: relationship, error: relationshipError } = await supabase
  .from('coach_athlete_relationships')
  .select('id')
  .eq('coach_id', requestingUserId)        // ← ADD THIS LINE
  .eq('athlete_id', parseInt(athleteId))
  .eq('status', 'active')
  .single();
      
if (relationshipError || !relationship) {
  return NextResponse.json({
    success: false,
    error: 'Coach-athlete relationship not found'
  }, { status: 404 });
}

    // Check if modification already exists
    const { data: existingMod, error: checkError } = await supabase
      .from('coach_program_modifications')
      .select('id')
      .eq('athlete_id', athleteId)
      .eq('program_id', programId)
      .eq('week_number', week)
      .eq('day_number', day)
      .eq('exercise_index', exerciseIndex)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking existing modifications:', checkError);
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    let result;
    
    if (existingMod) {
      // Update existing modification
      const { data: updateData, error: updateError } = await supabase
        .from('coach_program_modifications')
        .update({
          modifications: modifications,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingMod.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating modification:', updateError);
        return NextResponse.json({ success: false, error: 'Failed to update modification' }, { status: 500 });
      }
      result = updateData;
    } else {
      // Create new modification
      const { data: insertData, error: insertError } = await supabase
        .from('coach_program_modifications')
        .insert([{
          coach_athlete_relationship_id: relationship.id,
          athlete_id: athleteId,
          program_id: programId,
          week_number: week,
          day_number: day,
          exercise_index: exerciseIndex,
          modifications: modifications,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating modification:', insertError);
        return NextResponse.json({ success: false, error: 'Failed to create modification' }, { status: 500 });
      }
      result = insertData;
    }

    // Return the updated exercise data
    return NextResponse.json({
      success: true,
      data: {
        exerciseId: exerciseId,
        modifications: modifications,
        modificationId: result.id,
        message: existingMod ? 'Exercise updated successfully' : 'Exercise modification saved successfully'
      }
    });

  } catch (error) {
    console.error('Unexpected error in exercise modification:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
