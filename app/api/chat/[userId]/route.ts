// /app/api/chat/[userId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAITrainingAssistantForUser } from '@/lib/ai/ai-training-service'

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

    // Ensure a conversation exists (create if missing)
    let conversationId = conversation_id as number | null
    if (!conversationId) {
      const title = String((message || '').slice(0, 40) || 'New conversation')
      const { data: newConv, error: convErr } = await supabase
        .from('chat_conversations')
        .insert({ user_id: parseInt(userId), title, is_active: true })
        .select('id')
        .single()
      if (!convErr && newConv?.id) {
        conversationId = newConv.id
      }
    }

    // Optionally persist the user message for history
    if (conversationId) {
      await supabase
        .from('chat_messages')
        .insert({ conversation_id: conversationId, role: 'user', content: message, created_at: new Date().toISOString() })
    }

    // Get conversation history
    const { data: conversationHistory } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId || -1)
      .order('created_at', { ascending: true })
      .limit(20);

    // In-route AI assistant bound to the user's Supabase client
    const actionName = request.headers.get('x-action-name') || null
    const entity = request.headers.get('x-entity') || null
    const range = request.headers.get('x-range') || null
    if (actionName) {
      console.log('[CHAT][action]', { userId: parseInt(userId), actionName, entity, range })
    }
    const ai = createAITrainingAssistantForUser(supabase as any)
    const assistantData = await ai.generateResponse({
      userQuestion: message,
      userId: parseInt(userId),
      conversationHistory: conversationHistory || [],
      userContext: await getBasicUserContextInternal(supabase as any, parseInt(userId)),
      // @ts-ignore pass context
      entity,
      range
    })

    // Store assistant message and update conversation timestamp
    if (conversationId) {
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
        .eq('id', conversationId)
    }

    return NextResponse.json({
      success: true,
      response: assistantData.response,
      conversation_id: conversationId,
      responseType: 'program_guidance',
      coachAlertGenerated: false
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process chat message'
    }, { status: 500 });
  }
}

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

// Minimal user context helper for coaching personalization (name, level, units)
async function getBasicUserContextInternal(userSb: any, userId: number) {
  try {
    const { data } = await userSb
      .from('user_complete_profile')
      .select('name, ability_level, units, current_program_id')
      .eq('user_id', userId)
      .single()
    return {
      name: data?.name || 'Athlete',
      ability_level: data?.ability_level || 'Unknown',
      units: data?.units || 'Unknown',
      current_program_id: data?.current_program_id || null,
    }
  } catch {
    return { name: 'Athlete', ability_level: 'Unknown', units: 'Unknown', current_program_id: null }
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
    'body weight', 'bodyweight', 'weight loss', 'gain', 'cut', 'bulk', 'exercise', 'exercises', 'movement', 'movements',
    'run', 'rowing', 'bike', 'erg', 'metcon', 'wod', 'crossfit', 'olympic', 'olympic lift', 'oly', 'weightlifting', 'lifting', 'snatch', 'clean', 'jerk', 'squat', 'deadlift', 'press', 'pull-up', 'ring',
    'goal', 'progression', 'plateau', '1rm', 'one rep max', 'percentage'
  ]
  // Broaden matching for skills-related intents
  const extra = ['skill', 'skills', 'practice', 'practiced', 'accessory', 'accessories']

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
