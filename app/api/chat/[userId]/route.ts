// /app/api/chat/[userId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { message, conversation_id } = await request.json();

    // Same auth pattern as your working A1-A9 APIs
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Rate limiting: 5 messages/min and 50/day per user (user role messages)
    const now = new Date()
    const cutoffMin = new Date(now.getTime() - 60 * 1000).toISOString()
    const cutoffDay = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    // Gather user's conversation ids to count messages
    const { data: convIdsData } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('user_id', parseInt(userId))

    const convIds = (convIdsData || []).map((c: any) => c.id)

    let minuteCount = 0
    let dayCount = 0
    if (convIds.length > 0) {
      const { count: mCount } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .eq('role', 'user')
        .gte('created_at', cutoffMin)
      minuteCount = mCount || 0

      const { count: dCount } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .eq('role', 'user')
        .gte('created_at', cutoffDay)
      dayCount = dCount || 0
    }

    if (minuteCount >= 5) {
      return NextResponse.json(
        { success: false, error: 'rate_limit', message: 'Too many messages. Try again in a minute.' },
        { status: 429 }
      )
    }
    if (dayCount >= 50) {
      return NextResponse.json(
        { success: false, error: 'rate_limit', message: 'Daily chat limit reached. Try again tomorrow.' },
        { status: 429 }
      )
    }

    // Domain fence: allow only fitness/health/nutrition/training/program topics
    const onTopic = isOnTopic((message || '').toLowerCase())
    if (!onTopic) {
      const guidance =
        "I am GainsAI. I can help with every aspect of training, performance, and relevant topics. " +
        "Ask me about fitness, health, nutrition, your program, goals, endurance work, or supplements. " +
        "I have access to your profile and training history, so I can tailor advice to you."
      return NextResponse.json({
        success: true,
        response: guidance,
        conversation_id: conversation_id || null,
        responseType: 'domain_guard',
        coachAlertGenerated: false
      })
    }

    // Quick route for "list skills practiced" type queries
    if (/(list|show|what are).*skills.*(practic(e|ed)|worked on|trained)/i.test(message || '')) {
      try {
        const { data: srows } = await supabase
          .from('performance_logs')
          .select('exercise_name')
          .eq('user_id', parseInt(userId))
          .eq('block', 'SKILLS')
          .order('logged_at', { ascending: false })
          .limit(500)
        const set = new Set<string>()
        for (const r of srows || []) {
          if ((r as any).exercise_name) set.add((r as any).exercise_name)
        }
        const list = Array.from(set)
        const msg = list.length ? `Skills practiced so far (${list.length}):\n• ` + list.join('\n• ') : 'I could not find any skills practice yet.'
        return NextResponse.json({ success: true, response: msg, conversation_id: conversationId, responseType: 'data_lookup', coachAlertGenerated: false })
      } catch {}
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

    // If the user asked for specific exercise history, serve a direct, accurate DB answer
    const exerciseIntent = extractExerciseHistoryIntent(message || '')
    if (exerciseIntent) {
      try {
        const exercise = exerciseIntent
        const { data: logs } = await supabase
          .from('performance_logs')
          .select('*')
          .eq('user_id', parseInt(userId))
          .ilike('exercise_name', `%${exercise}%`)
          .order('logged_at', { ascending: false })
          .limit(20)

        const { data: rms } = await supabase
          .from('user_one_rms')
          .select('*')
          .eq('user_id', parseInt(userId))
          .ilike('exercise_name', `%${exercise}%`)
          .order('created_at', { ascending: false })
          .limit(10)

        const lines: string[] = []
        if (Array.isArray(logs) && logs.length > 0) {
          lines.push(`Recent ${exercise} sessions:`)
          logs.forEach((row: any) => {
            const d = row.logged_at ? new Date(row.logged_at).toLocaleDateString() : 'Unknown date'
            const rpe = row.rpe ? `, RPE ${row.rpe}` : ''
            const reps = row.reps ? `${row.reps} reps` : (row.total_reps ? `${row.total_reps} reps` : '')
            const weight = row.weight ? `${row.weight}${row.units ? ' ' + row.units : ''}` : ''
            const vol = row.volume ? `, vol ${row.volume}` : ''
            const note = row.notes ? ` — ${row.notes}` : ''
            const main = [weight, reps].filter(Boolean).join(' x ')
            lines.push(`• ${d}: ${main || 'Logged'}${rpe}${vol}${note}`)
          })
        } else {
          lines.push(`No recent ${exercise} logs found.`)
        }

        if (Array.isArray(rms) && rms.length > 0) {
          const values = rms.map((r: any) => Number(r.one_rm)).filter((v: any) => !isNaN(v))
          if (values.length > 0) {
            const latest = values[0]
            const best = Math.max(...values)
            const change = latest - values[values.length - 1]
            lines.push(`One-Rep Max snapshots (latest ${values.length}): latest ${latest}, best ${best}, change vs oldest ${change >= 0 ? '+' : ''}${change}`)
          }
        }

        return NextResponse.json({
          success: true,
          response: lines.join('\n'),
          conversation_id: conversationId,
          responseType: 'data_lookup',
          coachAlertGenerated: false
        })
      } catch (e) {
        // fall through to assistant if any error
      }
    }

    // Special-case: MetCon history (tasks + percentiles) with numeric support
    const lastNMatch = (message || '').match(/last\s*(\d+)/i)
    const wantsMetcon = /(metcon|met-con|met con)/i.test(message || '')
    if (wantsMetcon && (lastNMatch || /(recent|last few)/i.test(message || ''))) {
      try {
        const n = lastNMatch ? Math.max(1, Math.min(50, parseInt(lastNMatch[1], 10))) : 4

        // Prefer program_metcons joined by programs.user_id for user-scoped metcon results; fallback to performance_logs
        let rows: any[] = []
        {
          const { data: metRows } = await supabase
            .from('program_metcons')
            .select('workout_id, workout_name, percentile, completed_at, programs!inner(user_id)')
            .eq('programs.user_id', parseInt(userId))
            .not('completed_at', 'is', null)
            .order('completed_at', { ascending: false })
            .limit(n)
          if (metRows && metRows.length > 0) {
            rows = metRows.map((r: any) => ({
              workout_id: r.workout_id,
              workout_name: r.workout_name,
              percentile: r.percentile,
              logged_at: r.completed_at
            }))
          } else {
            const { data: perfRows } = await supabase
              .from('performance_logs')
              .select('workout_id, workout_name, percentile, logged_at')
              .eq('user_id', parseInt(userId))
              .eq('block', 'METCONS')
              .order('logged_at', { ascending: false })
              .limit(n)
            rows = perfRows || []
          }
        }

        if (!rows || rows.length === 0) {
          return NextResponse.json({
            success: true,
            response: 'I could not find any recent MetCons in your logs.',
            conversation_id: conversationId,
            responseType: 'data_lookup',
            coachAlertGenerated: false
          })
        }

        const ids = Array.from(new Set(rows.map((r: any) => r.workout_id).filter(Boolean)))
        let tasksMap: Record<string, string> = {}
        if (ids.length > 0) {
          const { data: metas } = await supabase
            .from('metcons')
            .select('workout_id, tasks')
            .in('workout_id', ids)
          for (const m of metas || []) {
            tasksMap[m.workout_id] = m.tasks || ''
          }
        }

        const lines: string[] = ['Last 4 MetCons:']
        for (const r of rows) {
          const d = r.logged_at ? new Date(r.logged_at as any).toLocaleDateString() : 'Unknown date'
          const name = r.workout_name || r.workout_id || 'Workout'
          const tasks = tasksMap[String(r.workout_id)] || '(tasks not available)'
          const pct = (r as any).percentile !== null && (r as any).percentile !== undefined ? `${(r as any).percentile}%ile` : 'percentile not recorded'
          lines.push(`• ${d} — ${name}: ${pct}\n  Tasks: ${tasks}`)
        }

        return NextResponse.json({
          success: true,
          response: lines.join('\n'),
          conversation_id: conversationId,
          responseType: 'data_lookup',
          coachAlertGenerated: false
        })
      } catch (e) {
        // fall through to assistant if any error
      }
    }

    // Special-case: average of last N for a named exercise
    const avgMatch = (message || '').match(/\b(avg|average)\s+of\s+last\s*(\d+)\s+([a-zA-Z\s]+?)\s*(?:days|sessions)?\b/i)
    if (avgMatch) {
      try {
        const n = Math.max(1, Math.min(50, parseInt(avgMatch[2], 10)))
        const term = avgMatch[3].trim()
        const { data: logs } = await supabase
          .from('performance_logs')
          .select('exercise_name, rpe, weight_time, reps, sets, logged_at')
          .eq('user_id', parseInt(userId))
          .ilike('exercise_name', `%${term}%`)
          .order('logged_at', { ascending: false })
          .limit(n)
        if (!logs || logs.length === 0) {
          return NextResponse.json({
            success: true,
            response: `No recent sessions found matching “${term}”.`,
            conversation_id: conversationId,
            responseType: 'data_lookup',
            coachAlertGenerated: false
          })
        }
        let avgRpe = 0, rpeN = 0
        let avgLoad = 0, loadN = 0
        const asNum = (v: any) => {
          const x = Number(v)
          return isNaN(x) ? null : x
        }
        for (const r of logs) {
          const rpe = asNum((r as any).rpe)
          if (rpe !== null) { avgRpe = (avgRpe * rpeN + rpe) / (rpeN + 1); rpeN++ }
          const load = asNum((r as any).weight_time)
          if (load !== null) { avgLoad = (avgLoad * loadN + load) / (loadN + 1); loadN++ }
        }
        const lines = [`Average over last ${logs.length} ${term} sessions:`]
        if (rpeN) lines.push(`• Avg RPE: ${avgRpe.toFixed(1)}`)
        if (loadN) lines.push(`• Avg load/time: ${avgLoad.toFixed(2)} (units as logged)`) 
        return NextResponse.json({
          success: true,
          response: lines.join('\n'),
          conversation_id: conversationId,
          responseType: 'data_lookup',
          coachAlertGenerated: false
        })
      } catch (e) {
        // fall through
      }
    }

    // Build lightweight user context to help the assistant personalize replies
    const userContext: any = {}
    {
      // Basic profile
      const { data: profile } = await supabase
        .from('users')
        .select('id, name, email, gender, body_weight, units, ability_level')
        .eq('id', parseInt(userId))
        .single()
      if (profile) {
        userContext.profile = profile
      }
      // Extended profile (user_profiles)
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', parseInt(userId))
        .single()
      if (userProfile) {
        userContext.user_profile = userProfile
      }
      // Preferences
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('training_days_per_week, selected_goals, metcon_time_focus, primary_strength_lifts, emphasized_strength_lifts')
        .eq('user_id', parseInt(userId))
        .single()
      if (prefs) {
        userContext.preferences = prefs
      }
      // Equipment
      const { data: equip } = await supabase
        .from('user_equipment')
        .select('equipment_name')
        .eq('user_id', parseInt(userId))
      if (equip) {
        userContext.equipment = (equip || []).map((e: any) => e.equipment_name)
      }
      // Latest 1RMs (by exercise)
      const { data: oneRMs } = await supabase
        .from('user_one_rms')
        .select('exercise_name, one_rm, recorded_at')
        .eq('user_id', parseInt(userId))
        .order('recorded_at', { ascending: false })
        .limit(100)
      if (oneRMs) {
        const latestMap: Record<string, { one_rm: number; recorded_at: string }> = {}
        for (const r of oneRMs) {
          if (!latestMap[r.exercise_name]) latestMap[r.exercise_name] = { one_rm: Number(r.one_rm), recorded_at: r.recorded_at as any }
        }
        userContext.oneRMs = latestMap
      }
      // Recent performance summary (last 90 days)
      const sinceIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      const { data: perf } = await supabase
        .from('performance_logs')
        .select('block, rpe, completion_quality, logged_at')
        .eq('user_id', parseInt(userId))
        .gte('logged_at', sinceIso)
      if (perf) {
        const summary: any = { counts: { SKILLS: 0, 'STRENGTH AND POWER': 0, METCONS: 0 }, avgRPE: 0, n: 0 }
        for (const p of perf) {
          const b = (p as any).block
          if (summary.counts[b] !== undefined) summary.counts[b] += 1
          if ((p as any).rpe) { summary.avgRPE = (summary.avgRPE * summary.n + Number((p as any).rpe)) / (summary.n + 1); summary.n += 1 }
        }
        userContext.performance = { counts: summary.counts, avgRPE: summary.n ? Number(summary.avgRPE.toFixed(1)) : null, since: sinceIso }
      }
    }

    // Get conversation history
    const { data: conversationHistory, error: historyError } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20); // Limit context window

    if (historyError) {
      console.error('Error fetching conversation history:', historyError);
      // Continue without history rather than fail
    }

    // Call training assistant Edge Function (same pattern as A1-A9)
    const assistantResponse = await fetch(`${supabaseUrl}/functions/v1/training-assistant`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: parseInt(userId),
        conversation_id: conversationId,
        message,
        conversation_history: conversationHistory || [],
        user_context: userContext
      })
    });

    if (!assistantResponse.ok) {
      throw new Error(`Training assistant service failed: ${assistantResponse.status}`);
    }

    const assistantData = await assistantResponse.json();

    // Update conversation timestamp
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
    'run', 'rowing', 'bike', 'erg', 'metcon', 'wod', 'crossfit', 'olympic lift', 'snatch', 'clean', 'jerk', 'squat', 'deadlift', 'press', 'pull-up', 'ring',
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
