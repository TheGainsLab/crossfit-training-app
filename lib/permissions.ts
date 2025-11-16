/**
 * Centralized permission checking for athlete data access
 * Handles both self-access, coach access, and admin access permissions
 */

export async function canAccessAthleteData(
  supabase: any, 
  requestingUserId: number, 
  targetAthleteId: number
): Promise<{ hasAccess: boolean; permissionLevel?: string; isCoach?: boolean; isAdmin?: boolean }> {
  
  // Check if user is accessing their own data
  if (requestingUserId === targetAthleteId) {
    return { 
      hasAccess: true, 
      permissionLevel: 'self', 
      isCoach: false,
      isAdmin: false
    };
  }
  
  // Check if requesting user is an admin (admins can access all athletes)
  const requestingUserRole = await getUserRole(supabase, requestingUserId);
  if (requestingUserRole.role === 'admin') {
    return { 
      hasAccess: true, 
      permissionLevel: 'full', 
      isCoach: true, // Admins can act as coaches
      isAdmin: true
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
    isCoach: true,
    isAdmin: false
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

/**
 * Get user role from database
 */
export async function getUserRole(
  supabase: any,
  userId: number
): Promise<{ role: string | null; error: string | null }> {
  const { data: userData, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !userData) {
    return { role: null, error: 'User not found' };
  }

  return { role: userData.role || 'athlete', error: null };
}

/**
 * Check if a user is an admin
 */
export async function isAdmin(
  supabase: any,
  userId: number
): Promise<boolean> {
  const { role, error } = await getUserRole(supabase, userId);
  if (error) return false;
  return role === 'admin';
}

/**
 * Check if a user is a coach (by role)
 */
export async function isCoachByRole(
  supabase: any,
  userId: number
): Promise<boolean> {
  const { role, error } = await getUserRole(supabase, userId);
  if (error) return false;
  return role === 'coach' || role === 'admin'; // Admins can also act as coaches
}
