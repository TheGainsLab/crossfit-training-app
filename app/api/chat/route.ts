// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { message, conversation_id } = await request.json();

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

// Get authenticated user using client-side approach
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const cookieStore = await cookies();

// Try multiple possible cookie names for auth
const authToken = cookieStore.get('sb-access-token')?.value || 
                  cookieStore.get('sb_access_token')?.value ||
                  cookieStore.get('supabase-auth-token')?.value;

if (!authToken) {
  // Try to get user from all cookies
  const allCookies = cookieStore.getAll();
  console.log('Available cookies:', allCookies.map(c => c.name));
  return NextResponse.json({ error: 'Not authenticated - no auth token found' }, { status: 401 });
}

const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);
if (authError || !user) {
  console.log('Auth error:', authError);
  return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
}
    
if (!user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    // Get user ID from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userData.id;

    // Get or create conversation
    let conversationId = conversation_id;
    if (!conversationId) {
      const { data: newConversation, error: convError } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: userId,
          title: generateConversationTitle(message)
        })
        .select('id')
        .single();

      if (convError) throw convError;
      conversationId = newConversation.id;
    }

    // Store user message
    const { error: userMessageError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: message
      });

    if (userMessageError) throw userMessageError;

    // Get conversation history
    const { data: conversationHistory } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20); // Limit context window

    // Call training assistant Edge Function
    const response = await fetch(`${supabaseUrl}/functions/v1/training-assistant`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        conversation_id: conversationId,
        message,
        conversation_history: conversationHistory || []
      })
    });

    if (!response.ok) {
      throw new Error(`Training assistant service failed: ${response.status}`);
    }

    const assistantData = await response.json();

    return NextResponse.json({
      success: true,
      response: assistantData.response,
      conversation_id: conversationId,
      responseType: assistantData.responseType,
      coachAlertGenerated: assistantData.coachAlertGenerated
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process chat message'
    }, { status: 500 });
  }
}

// Helper function
function generateConversationTitle(firstMessage: string): string {
  // Extract key topics from first message for title
  const message = firstMessage.toLowerCase();
  
  if (message.includes('squat')) return 'Squat Discussion';
  if (message.includes('deadlift')) return 'Deadlift Questions';
  if (message.includes('program') || message.includes('workout')) return 'Program Questions';
  if (message.includes('nutrition') || message.includes('diet')) return 'Nutrition Chat';
  if (message.includes('recovery') || message.includes('rest')) return 'Recovery Discussion';
  if (message.includes('injury') || message.includes('pain')) return 'Injury Concern';
  
  // Fallback: use first few words
  const words = firstMessage.split(' ').slice(0, 3).join(' ');
  return words.length > 20 ? words.substring(0, 20) + '...' : words;
}
