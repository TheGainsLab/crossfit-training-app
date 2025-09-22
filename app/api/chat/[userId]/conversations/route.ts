// /app/api/chat/[userId]/conversations/route.ts
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
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Require Authorization and map to numeric users.id, then enforce it matches the path userId
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: authData } = await supabaseAuthed.auth.getUser();
    const authId = authData?.user?.id;
    if (!authId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Service client for secure server-side lookups (RLS bypass)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authId)
      .single();
    const authedUserId = userRow?.id as number | undefined;
    if (!authedUserId || authedUserId !== parseInt(userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify user has active subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', parseInt(userId))
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
    }

    // Get user's conversations (validated against authed user)
    const { data: conversations, error } = await supabase
      .from('chat_conversations')
      .select(`
        id, 
        title, 
        created_at, 
        updated_at,
        chat_messages(content, role, created_at)
      `)
      .eq('user_id', parseInt(userId))
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching conversations:', error);
      throw new Error('Failed to fetch conversations');
    }

    return NextResponse.json({
      success: true,
      conversations: conversations || []
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch conversations'
    }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { title } = await request.json();

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify active subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', parseInt(userId))
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
    }

    // Create new conversation
    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .insert({
        user_id: parseInt(userId),
        title: title || 'New Conversation',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      throw new Error('Failed to create conversation');
    }

    return NextResponse.json({ success: true, conversation });

  } catch (error) {
    console.error('Create conversation API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create conversation' 
    }, { status: 500 });
  }
}
