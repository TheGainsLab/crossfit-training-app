import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {

  try {
const { userId } = await params;
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/predictive-performance-modeling`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_id: parseInt(userId) })
    });

    if (!response.ok) {
      throw new Error(`Predictive modeling service failed: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('Predictive insights API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to generate predictive insights' 
    }, { status: 500 });
  }
}
