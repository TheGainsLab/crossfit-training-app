// app/api/exercises/available/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canAccessAthleteData } from '../../../../lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId');
    const block = searchParams.get('block');

    if (!athleteId || !block) {
      return NextResponse.json({ 
        success: false, 
        error: 'athleteId and block parameters are required' 
      }, { status: 400 });
    }

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

    // Check permissions - coach must have access to this athlete
    const permissionCheck = await canAccessAthleteData(supabase, requestingUserId, athleteId);
    if (!permissionCheck.hasAccess || !permissionCheck.isCoach) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Map block name to database column
    const blockColumnMap: { [key: string]: string } = {
      'SKILLS': 'can_be_skills',
      'TECHNICAL WORK': 'can_be_technical', 
      'STRENGTH AND POWER': 'can_be_strength',
      'ACCESSORIES': 'can_be_accessories',
      'METCONS': 'can_be_metcons'
    };

    const blockColumn = blockColumnMap[block];
    if (!blockColumn) {
      return NextResponse.json({ 
        success: false, 
        error: `Invalid block: ${block}` 
      }, { status: 400 });
    }

    // Get user's equipment
    const { data: userEquipment, error: equipmentError } = await supabase
      .from('user_equipment')
      .select('equipment_name')
      .eq('user_id', athleteId);

    if (equipmentError) {
      console.error('Error fetching user equipment:', equipmentError);
      return NextResponse.json({ success: false, error: 'Failed to fetch user equipment' }, { status: 500 });
    }

    const userEquipmentNames = (userEquipment || []).map(eq => eq.equipment_name);

    // Get user's skills with levels
    const { data: userSkills, error: skillsError } = await supabase
      .from('user_skills')
      .select('skill_name, skill_level')
      .eq('user_id', athleteId);

    if (skillsError) {
      console.error('Error fetching user skills:', skillsError);
      return NextResponse.json({ success: false, error: 'Failed to fetch user skills' }, { status: 500 });
    }

    // Helper function to check if user meets skill prerequisite
    const meetsSkillPrerequisite = (prerequisite: string): boolean => {
      if (!prerequisite) return true;
      
      // Parse prerequisite format: "Pull-ups (kipping or butterfly): Beginner"
      const parts = prerequisite.split(':');
      if (parts.length !== 2) return true; // Invalid format, allow it
      
      const skillName = parts[0].trim();
      const requiredLevel = parts[1].trim();
      
      // Find user's skill
      const userSkill = userSkills?.find(skill => skill.skill_name === skillName);
      if (!userSkill) return false; // User doesn't have this skill
      
      // Extract level from user's skill level (e.g., "Intermediate (8-15)" -> "Intermediate")
      const userLevel = userSkill.skill_level.split(' ')[0];
      
      // Define level hierarchy
      const levelHierarchy = ['Beginner', 'Intermediate', 'Advanced'];
      const requiredLevelIndex = levelHierarchy.indexOf(requiredLevel);
      const userLevelIndex = levelHierarchy.indexOf(userLevel);
      
      return userLevelIndex >= requiredLevelIndex;
    };

    // Build the query to get available exercises
    let query = supabase
      .from('exercises')
      .select('id, name, required_equipment, prerequisite_1, prerequisite_2')
      .eq(blockColumn, true);

    const { data: allExercises, error: exercisesError } = await query;

    if (exercisesError) {
      console.error('Error fetching exercises:', exercisesError);
      return NextResponse.json({ success: false, error: 'Failed to fetch exercises' }, { status: 500 });
    }

    // Filter exercises based on equipment and skill requirements
    const availableExercises = (allExercises || []).filter(exercise => {
      // Check equipment requirements
      if (exercise.required_equipment && exercise.required_equipment.length > 0) {
        const hasAllEquipment = exercise.required_equipment.every((requiredEq: string) =>
          userEquipmentNames.includes(requiredEq)
        );
        if (!hasAllEquipment) return false;
      }

      // Check skill prerequisites
      if (exercise.prerequisite_1 && !meetsSkillPrerequisite(exercise.prerequisite_1)) {
        return false;
      }
      if (exercise.prerequisite_2 && !meetsSkillPrerequisite(exercise.prerequisite_2)) {
        return false;
      }

      return true;
    });

    // Return just the exercise names for the dropdown
    const exerciseNames = availableExercises
      .map(exercise => exercise.name)
      .sort();

    return NextResponse.json({
      success: true,
      data: {
        exercises: exerciseNames,
        total: exerciseNames.length,
        block: block,
        athleteId: athleteId
      }
    });

  } catch (error) {
    console.error('Unexpected error in available exercises API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
