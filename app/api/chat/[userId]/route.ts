// /app/api/chat/[userId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callTrainingAssistant } from '@/lib/ai/client'
import { buildContextFeatures, classifyQuestionAdvanced } from '@/lib/ai/context-builder'
import { normalizeExerciseToFamily } from '@/lib/ai/families'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { message, conversation_id } = await request.json();

    // Require user Authorization header (JWT) to bind RLS for RPC calls
    const authHeader = request.headers.get('authorization') || ''
    const userToken = authHeader.replace(/^Bearer\s+/i, '')
    if (!userToken) {
      return NextResponse.json({ success: false, error: 'Missing Authorization header' }, { status: 401 })
    }

    // Same auth pattern as your working A1-A9 APIs
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Per-request user-bound client (RLS-on)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${userToken}` } } });

    // Verify user has active subscription (same as A1-A9)
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', parseInt(userId))
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
    }

    // (moved) keyword MetCon handler is placed after conversation creation where conversationId exists

    // (moved) Which profile skills need work? handled after conversation creation

    // Domain fence with persistence
    const onTopic = isOnTopic((message || '').toLowerCase())
    if (!onTopic) {
      // Ensure conversation exists to persist guard message
      let conversationId = conversation_id;
      if (!conversationId) {
        const { data: newConversation } = await supabase
          .from('chat_conversations')
          .insert({ user_id: parseInt(userId), title: generateConversationTitle(message), is_active: true })
          .select('id')
          .single();
        conversationId = newConversation?.id;
      }
      const guidance =
        "I am GainsAI. I can help with every aspect of training, performance, and relevant topics. " +
        "Ask me about fitness, health, nutrition, your program, goals, endurance work, or supplements. " +
        "I have access to your profile and training history, so I can tailor advice to you."
      if (conversationId) {
        await supabase.from('chat_messages').insert({ conversation_id: conversationId, role: 'assistant', content: guidance, created_at: new Date().toISOString() })
        await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
      }
      return NextResponse.json({ success: true, response: guidance, conversation_id: conversationId || null, responseType: 'domain_guard', coachAlertGenerated: false })
    }

    // Get or create conversation
    let conversationId = conversation_id;
    if (!conversationId) {
      const { data: newConversation, error: convError } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: parseInt(userId),
          title: generateConversationTitle(message),
          is_active: true
        })
        .select('id')
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
        throw new Error('Failed to create conversation');
      }
      conversationId = newConversation.id;
    }

    // Store user message
    const { error: userMessageError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: message,
        created_at: new Date().toISOString()
      });

    if (userMessageError) {
      console.error('Error storing user message:', userMessageError);
      throw new Error('Failed to store message');
    }

    // Get conversation history
    const { data: conversationHistory, error: historyError } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20);

    if (historyError) {
      console.error('Error fetching conversation history:', historyError);
      // Continue without history rather than fail
    }

    // Build rich context features for the Edge Function
    const contextFeatures = await buildContextFeatures(supabase as any, parseInt(userId))
    const classification = classifyQuestionAdvanced(message || '')
    const mentionedExerciseFamily = normalizeExerciseToFamily(message || '')
    if (mentionedExerciseFamily) {
      (contextFeatures as any).mentionedExerciseFamily = mentionedExerciseFamily
    }

    // Call Supabase Edge Function (training-assistant) with service key
    const serviceUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceUrl || !serviceKey) {
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 })
    }
    const assistantData = await callTrainingAssistant(serviceUrl, serviceKey, {
      user_id: parseInt(userId),
      conversation_id: conversationId,
      message,
      conversation_history: conversationHistory || [],
      user_context: contextFeatures,
      context_type: classification.type
    })

    // Store assistant message and update conversation timestamp
    await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantData.response,
        created_at: new Date().toISOString()
      })
    await supabase
      .from('chat_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

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
// (removed internal basic context; using unified buildContextFeatures instead)

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 })
    }
    return NextResponse.json({ success: true, status: 'ok', userId })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
  }
}

// Helper function (copied from your original)
function generateConversationTitle(firstMessage: string): string {
  const message = firstMessage.toLowerCase();
  
  if (message.includes('squat')) return 'Squat Discussion';
  if (message.includes('deadlift')) return 'Deadlift Questions';
  if (message.includes('program') || message.includes('workout')) return 'Program Questions';
  if (message.includes('nutrition') || message.includes('diet')) return 'Nutrition Chat';
  if (message.includes('recovery') || message.includes('rest')) return 'Recovery Discussion';
  if (message.includes('injury') || message.includes('pain')) return 'Injury Concern';
  
  const words = firstMessage.split(' ').slice(0, 3).join(' ');
  return words.length > 20 ? words.substring(0, 20) + '...' : words;
}

// Simple on-topic classifier (broad, fitness-first)
function isOnTopic(text: string): boolean {
  const allow = [
    'train', 'training', 'workout', 'program', 'cycle', 'block', 'week', 'day',
    'strength', 'power', 'endurance', 'cardio', 'aerobic', 'anaerobic', 'vo2', 'zone 2',
    'hypertrophy', 'mobility', 'flexibility', 'technique', 'form', 'injury', 'pain', 'rehab', 'physical therapy', 'physio',
    'recovery', 'sleep', 'stress', 'hrv', 'rest', 'deload', 'rpe', 'volume', 'intensity', 'sets', 'reps', 'tempo',
    'nutrition', 'diet', 'macros', 'protein', 'carbs', 'fat', 'calorie', 'calories', 'hydration', 'electrolyte', 'supplement', 'creatine', 'caffeine',
    'body weight', 'bodyweight', 'weight loss', 'gain', 'cut', 'bulk',
    'run', 'rowing', 'bike', 'erg', 'metcon', 'wod', 'crossfit', 'olympic', 'olympic lift', 'oly', 'weightlifting', 'lifting', 'snatch', 'clean', 'jerk', 'squat', 'deadlift', 'press', 'pull-up', 'ring',
    'goal', 'progression', 'plateau', '1rm', 'one rep max', 'percentage'
  ]
  // Broaden matching for skills-related intents
  const extra = ['skill', 'skills', 'practice', 'practiced']

  for (const token of [...allow, ...extra]) {
    if (text.includes(token)) return true
  }
  return false
}

// Extract a simple exercise history intent; returns canonical exercise term or null
function extractExerciseHistoryIntent(text: string): string | null {
  const t = text.toLowerCase()
  const wantsHistory = /(history|logs|log|trend|progress|sessions|recent)/.test(t)
  if (!wantsHistory) return null
  const exercises = [
    'snatch', 'clean and jerk', 'clean', 'jerk', 'back squat', 'front squat', 'squat',
    'deadlift', 'bench press', 'strict press', 'press', 'pull-up', 'pull ups', 'ring muscle up', 'bar muscle up'
  ]
  for (const ex of exercises) {
    if (t.includes(ex)) return ex
  }
  return null
}

// Render metcon tasks JSON into readable lines
function formatMetconTasks(tasks: any): string {
  try {
    if (!tasks) return ''
    const arr = Array.isArray(tasks) ? tasks : (typeof tasks === 'string' ? JSON.parse(tasks) : [])
    if (!Array.isArray(arr)) return ''
    const lines: string[] = []
    for (const t of arr) {
      if (!t || typeof t !== 'object') continue
      const kind = t.kind || t.type || ''
      const title = t.title || t.name || ''
      const reps = t.reps || t.rounds || t.count || ''
      const details = t.details || t.description || t.movements || ''
      const movementList = Array.isArray(details) ? details.join(', ') : (typeof details === 'string' ? details : '')
      const duration = t.time || t.duration || ''
      const parts = [kind, title, reps, duration].filter(Boolean).join(' ')
      const line = parts ? `${parts}${movementList ? ': ' + movementList : ''}` : movementList
      if (line) lines.push(line)
    }
    return lines.length ? lines.join(' | ') : ''
  } catch {
    return ''
  }
}
