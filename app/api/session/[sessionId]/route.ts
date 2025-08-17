import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {

  try {
    const supabase = createClient();
    
const params = await context.params;
const sessionId = params.sessionId;

    // Parse sessionId: "46-37-2-1" → user=46, program=37, week=2, day=1
    const [userId, programId, week, day] = sessionId.split('-').map(Number);

    if (!userId || !programId || !week || !day) {
      return Response.json(
        { success: false, error: 'Invalid session ID format' },
        { status: 400 }
      );
    }

    // 1. Get all performance logs for this session
    const { data: performanceLogs, error: performanceError } = await supabase
      .from('performance_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('program_id', programId)
      .eq('week', week)
      .eq('day', day)
      .order('logged_at');

    if (performanceError) {
      console.error('Error fetching performance logs:', performanceError);
      return Response.json(
        { success: false, error: 'Failed to fetch session data' },
        { status: 500 }
      );
    }

    if (!performanceLogs || performanceLogs.length === 0) {
      return Response.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // 2. Check if MetCons exist and get MetCon data
    const hasMetcons = performanceLogs.some(log => log.block === 'METCONS');
    let metconData = null;

    if (hasMetcons) {
      // Get program_metcons entry for this session
      const { data: programMetcons, error: programMetconsError } = await supabase
        .from('program_metcons')
        .select('*')
        .eq('program_id', programId)
        .eq('week', week)
        .eq('day', day)
        .single();

      if (programMetcons && !programMetconsError) {
        // Get metcon details from metcons table
        const { data: metconDetails, error: metconDetailsError } = await supabase
          .from('metcons')
          .select('*')
          .eq('id', programMetcons.metcon_id)
          .single();

        if (metconDetails && !metconDetailsError) {
          metconData = {
            ...programMetcons,
            metcon: metconDetails
          };
        }
      }
    }

    // 3. Group exercises by training block
    const groupedExercises = performanceLogs.reduce((acc, log) => {
      const block = log.block || 'OTHER';
      if (!acc[block]) {
        acc[block] = [];
      }
      acc[block].push(log);
      return acc;
    }, {} as Record<string, any[]>);

    // 4. Calculate session metadata
    const sessionDate = performanceLogs[0]?.logged_at;
    const totalExercises = performanceLogs.length;
    const blocks = Object.keys(groupedExercises);

    // 5. Return structured data
    return Response.json({
      success: true,
      data: {
        sessionInfo: {
          userId,
          programId,
          week,
          day,
          date: sessionDate,
          totalExercises,
          blocks
        },
        exercises: groupedExercises,
        metconData: metconData,
        hasMetcons
      }
    });

  } catch (error) {
    console.error('Error in session API:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
