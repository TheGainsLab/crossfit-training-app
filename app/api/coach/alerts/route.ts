import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Get current user from auth
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const cookieStore = await cookies();
    const authToken = cookieStore.get('sb-access-token')?.value;
    
    if (!authToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user ID and verify coach status
    const { data: { user } } = await supabase.auth.getUser(authToken);
    if (!user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    // Get coach ID from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify coach status
    const { data: coachData } = await supabase
      .from('coaches')
      .select('id')
      .eq('user_id', userData.id)
      .single();

    if (!coachData) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    // Call the coach alerts Edge Function
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-coach-alerts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ coach_id: coachData.id })
    });

    if (!response.ok) {
      throw new Error(`Coach alerts service failed: ${response.status}`);
    }

    const alertsData = await response.json();
    
    return NextResponse.json({
      success: true,
      ...alertsData
    });

  } catch (error) {
    console.error('Coach alerts API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate coach alerts'
    }, { status: 500 });
  }
}
