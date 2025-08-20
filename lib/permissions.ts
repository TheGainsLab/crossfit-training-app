/**
 * Centralized permission checking for athlete data access
 * Handles both self-access and coach access permissions
 */

export async function canAccessAthleteData(
  supabase: any, 
  requestingUserId: number, 
  targetAthleteId: number
): Promise<{ hasAccess: boolean; permissionLevel?: string; isCoach?: boolean }> {
  
  // Check if user is accessing their own data
  if (requestingUserId === targetAthleteId) {
    return { 
      hasAccess: true, 
      permissionLevel: 'self', 
      isCoach: false 
    };
  }
  
  // Check if requesting user is an approved coach with access to this athlete
  const { data: coachRelationship, error } = await supabase
    .from('coach_athlete_relationships')
    .select(`
      permission_level,
      coaches!inner(
        id,
        user_id,
        status
      )
    `)
    .eq('coaches.user_id', requestingUserId)
    .eq('coaches.status', 'approved')
    .eq('athlete_id', targetAthleteId)
    .eq('status', 'active')
    .single();
    
  if (error || !coachRelationship) {
    return { hasAccess: false };
  }
  
  return { 
    hasAccess: true, 
    permissionLevel: coachRelationship.permission_level,
    isCoach: true 
  };
}

/**
 * Helper function to get user ID from Supabase auth
 */
export async function getUserIdFromAuth(supabase: any): Promise<{ userId: number | null; error: string | null }> {
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { userId: null, error: 'Unauthorized - no valid session' };
  }

  // Get internal user ID
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (userError || !userData) {
    return { userId: null, error: 'User not found' };
  }

  return { userId: userData.id, error: null };
}
