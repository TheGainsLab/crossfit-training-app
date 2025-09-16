// /app/api/chat/[userId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callTrainingAssistant } from '@/lib/ai/client'
import { OptimizedContextBuilder, classifyQuestionAdvanced } from '@/lib/ai/context-builder'

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
    const contextBuilder = new OptimizedContextBuilder(supabase);

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

    // (moved) quick route handled after conversation creation so we can persist assistant reply

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

    // Special-case: Which profile skills need work?
    {
      const t = (message || '').toLowerCase()
      const wantsSkillsGap = /(which|what).*(skill|skills).*(need|needs|weak|improv|improve|focus|work)/i.test(t)
      if (wantsSkillsGap) {
        try {
          const { data: skills } = await supabase
            .from('user_skills')
            .select('skill_name, skill_level')
            .eq('user_id', parseInt(userId))
          if (skills && skills.length) {
            const low = [] as string[]
            const mid = [] as string[]
            for (const s of skills) {
              const lvl = String((s as any).skill_level || '').toLowerCase()
              const name = (s as any).skill_name
              if (!name) continue
              if (lvl.includes("don't have") || lvl.includes('dont have') || lvl.includes('beginner')) low.push(name)
              else if (lvl.includes('intermediate')) mid.push(name)
            }
            const lines: string[] = []
            if (low.length) lines.push(`Needs work (profile): ${low.join(', ')}`)
            if (mid.length) lines.push(`Mid-tier (profile): ${mid.join(', ')}`)
            if (!lines.length) lines.push('Your profile skills are mostly at Advanced or not set.')
            const resp = lines.join('\n')
            await supabase.from('chat_messages').insert({ conversation_id: conversationId, role: 'assistant', content: resp, created_at: new Date().toISOString() })
            await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
            return NextResponse.json({ success: true, response: resp, conversation_id: conversationId, responseType: 'data_lookup', coachAlertGenerated: false })
          }

          // Fallback: infer from performance logs (least-practiced or lower quality)
          const { data: logs } = await supabase
            .from('performance_logs')
            .select('exercise_name, completion_quality, logged_at')
            .eq('user_id', parseInt(userId))
            .eq('block', 'SKILLS')
            .order('logged_at', { ascending: false })
            .limit(200)
          const stat: Record<string, { n: number; q: number; qn: number }> = {}
          for (const r of logs || []) {
            const name = (r as any).exercise_name
            if (!name) continue
            if (!stat[name]) stat[name] = { n: 0, q: 0, qn: 0 }
            stat[name].n += 1
            const q = Number((r as any).completion_quality)
            if (!Number.isNaN(q)) { stat[name].q = (stat[name].q * stat[name].qn + q) / (stat[name].qn + 1); stat[name].qn += 1 }
          }
          const entries = Object.entries(stat)
            .map(([name, s]) => ({ name, count: s.n, avgQ: s.qn ? Number(s.q.toFixed(2)) : null }))
            .sort((a, b) => (a.avgQ ?? 99) - (b.avgQ ?? 99) || a.count - b.count)
            .slice(0, 8)
          const lines = entries.length
            ? ['Skills that likely need focus (inferred from recent practice):', ...entries.map(e => `• ${e.name} — avg quality ${e.avgQ ?? 'n/a'}, sessions ${e.count}`)]
            : ['I could not infer weak skills from recent logs.']
          const resp = lines.join('\n')
          await supabase.from('chat_messages').insert({ conversation_id: conversationId, role: 'assistant', content: resp, created_at: new Date().toISOString() })
          await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
          return NextResponse.json({ success: true, response: resp, conversation_id: conversationId, responseType: 'data_lookup', coachAlertGenerated: false })
        } catch {}
      }
    }

    // Special-case: MetCons filtered by keyword in tasks (e.g., "metcons with barbells")
    {
      const t = (message || '').toLowerCase()
      const kwMatch = t.match(/metcon[s]?\s+(?:with|containing|including|featuring)\s+([a-z0-9 ,\-_/]+)/i)
      if (kwMatch) {
        try {
          const termBlob = kwMatch[1].toLowerCase().trim()
          const terms = termBlob
            .split(/[,]+|\band\b/)
            .map((s: string) => s.trim())
            .filter((s: string) => Boolean(s))
          // Fetch recent completed user metcons
          const { data: metRows } = await supabase
            .from('program_metcons')
            .select('metcon_id, percentile, completed_at, programs!inner(user_id)')
            .eq('programs.user_id', parseInt(userId))
            .not('completed_at', 'is', null)
            .order('completed_at', { ascending: false })
            .limit(50)
          const rows: any[] = metRows || []
          if (!rows.length) {
            const resp = 'I could not find any completed MetCons to search.'
            await supabase.from('chat_messages').insert({ conversation_id: conversationId, role: 'assistant', content: resp, created_at: new Date().toISOString() })
            await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
            return NextResponse.json({ success: true, response: resp, conversation_id: conversationId, responseType: 'data_lookup', coachAlertGenerated: false })
          }

          const ids = Array.from(new Set(rows.map((r: any) => r.metcon_id).filter((v: any) => v !== null && v !== undefined)))
          const { data: metas } = await supabase
            .from('metcons')
            .select('id, tasks')
            .in('id', ids)
          const taskText: Record<string, string> = {}
          for (const m of metas || []) {
            taskText[String((m as any).id)] = (formatMetconTasks((m as any).tasks) || '').toLowerCase()
          }

          const filtered = rows.filter((r: any) => {
            const tt = taskText[String(r.metcon_id)] || ''
            if (!tt) return false
            if (!terms.length) return true
            return terms.some((term: string) => tt.includes(term))
          })

          if (!filtered.length) {
            const resp = `I did not find any of your recent MetCons matching: ${terms.join(', ')}`
            await supabase.from('chat_messages').insert({ conversation_id: conversationId, role: 'assistant', content: resp, created_at: new Date().toISOString() })
            await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
            return NextResponse.json({ success: true, response: resp, conversation_id: conversationId, responseType: 'data_lookup', coachAlertGenerated: false })
          }

          const lines: string[] = [`MetCons matching “${terms.join(', ')}”:`]
          for (const r of filtered.slice(0, 10)) {
            const d = r.completed_at ? new Date(r.completed_at as any).toLocaleDateString() : 'Unknown date'
            const name = r.metcon_id ? `MetCon #${r.metcon_id}` : 'MetCon'
            const pct = (r as any).percentile !== null && (r as any).percentile !== undefined ? `${(r as any).percentile}%ile` : 'percentile not recorded'
            const tasks = (taskText[String(r.metcon_id)] || '').replace(/\s*\|\s*/g, '; ')
            lines.push(`• ${d} — ${name}: ${pct}\n  Tasks: ${tasks || '(not available)'}`)
          }

          const resp = lines.join('\n')
          await supabase.from('chat_messages').insert({ conversation_id: conversationId, role: 'assistant', content: resp, created_at: new Date().toISOString() })
          await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
          return NextResponse.json({ success: true, response: resp, conversation_id: conversationId, responseType: 'data_lookup', coachAlertGenerated: false })
        } catch {}
      }
    }
    // Quick route for "list skills practiced" type queries (persist assistant reply)
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

        await supabase.from('chat_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: msg,
          created_at: new Date().toISOString()
        })
        await supabase
          .from('chat_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId)

        return NextResponse.json({ success: true, response: msg, conversation_id: conversationId, responseType: 'data_lookup', coachAlertGenerated: false })
      } catch {}
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
          .order('recorded_at', { ascending: false })
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

        const respContent = lines.join('\n')
        await supabase.from('chat_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: respContent,
          created_at: new Date().toISOString()
        })
        await supabase
          .from('chat_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId)

        return NextResponse.json({
          success: true,
          response: respContent,
          conversation_id: conversationId,
          responseType: 'data_lookup',
          coachAlertGenerated: false
        })
      } catch (e) {
        // fall through to assistant if any error
      }
    }

    // Special-case: last N skills sessions/blocks
    {
      const t = (message || '').toLowerCase()
      const nMatch = t.match(/last\s*(\d+)\s*(skill|skills)\s*(blocks?|sessions?)/i)
      const wantRecent = /(recent|last few).*(skill|skills)/i.test(t)
      const n = nMatch ? Math.max(1, Math.min(50, parseInt(nMatch[1], 10))) : (wantRecent ? 4 : null)
      if (n) {
        try {
          const { data: logs } = await supabase
            .from('performance_logs')
            .select('exercise_name, rpe, completion_quality, logged_at')
            .eq('user_id', parseInt(userId))
            .eq('block', 'SKILLS')
            .order('logged_at', { ascending: false })
            .limit(n)

          if (!logs || logs.length === 0) {
            const respContent = 'I could not find any recent SKILLS sessions.'
            await supabase.from('chat_messages').insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: respContent,
              created_at: new Date().toISOString()
            })
            await supabase
              .from('chat_conversations')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', conversationId)
            return NextResponse.json({ success: true, response: respContent, conversation_id: conversationId, responseType: 'data_lookup', coachAlertGenerated: false })
          }

          const lines: string[] = [`Last ${logs.length} SKILLS sessions:`]
          for (const row of logs) {
            const d = (row as any).logged_at ? new Date((row as any).logged_at as any).toLocaleDateString() : 'Unknown date'
            const ex = (row as any).exercise_name || 'Skills work'
            const rpe = (row as any).rpe ? `, RPE ${(row as any).rpe}` : ''
            const q = (row as any).completion_quality ? `, Quality ${(row as any).completion_quality}/4` : ''
            lines.push(`• ${d}: ${ex}${rpe}${q}`)
          }

          const respContent = lines.join('\n')
          await supabase.from('chat_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: respContent,
            created_at: new Date().toISOString()
          })
          await supabase
            .from('chat_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId)
          return NextResponse.json({ success: true, response: respContent, conversation_id: conversationId, responseType: 'data_lookup', coachAlertGenerated: false })
        } catch (e) {
          // fall through
        }
      }
    }

    // Special-case: MetCon history (tasks + percentiles) with numeric support
    const lastNMatch = (message || '').match(/last\s*(\d+)/i)
    const wantsMetcon = /(metcon|met-con|met con)/i.test(message || '')
    if (wantsMetcon && (lastNMatch || /(recent|last few)/i.test(message || ''))) {
      try {
        const n = lastNMatch ? Math.max(1, Math.min(50, parseInt(lastNMatch[1], 10))) : 4

        // Prefer program_metcons joined by programs.user_id (metcon_id, percentile, completed_at)
        const { data: metRows } = await supabase
          .from('program_metcons')
          .select('metcon_id, percentile, completed_at, programs!inner(user_id)')
          .eq('programs.user_id', parseInt(userId))
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(n)
        const rows: any[] = metRows || []

        if (!rows || rows.length === 0) {
          const respContent = 'I could not find any recent MetCons in your logs.'
          await supabase.from('chat_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: respContent,
            created_at: new Date().toISOString()
          })
          await supabase
            .from('chat_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId)
          return NextResponse.json({
            success: true,
            response: respContent,
            conversation_id: conversationId,
            responseType: 'data_lookup',
            coachAlertGenerated: false
          })
        }

        const ids = Array.from(new Set(rows.map((r: any) => r.metcon_id).filter((v: any) => v !== null && v !== undefined)))
        let tasksMap: Record<string, string> = {}
        if (ids.length > 0) {
          // Assume metcons.id = metcon_id
          const { data: metas } = await supabase
            .from('metcons')
            .select('id, tasks')
            .in('id', ids)
          for (const m of metas || []) {
            tasksMap[String(m.id)] = formatMetconTasks((m as any).tasks)
          }
        }

        const lines: string[] = [`Last ${rows.length} MetCons:`]
        for (const r of rows) {
          const d = r.completed_at ? new Date(r.completed_at as any).toLocaleDateString() : 'Unknown date'
          const name = r.metcon_id ? `MetCon #${r.metcon_id}` : 'MetCon'
          const tasks = tasksMap[String(r.metcon_id)] || '(tasks not available)'
          const pct = (r as any).percentile !== null && (r as any).percentile !== undefined ? `${(r as any).percentile}%ile` : 'percentile not recorded'
          lines.push(`• ${d} — ${name}: ${pct}\n  Tasks: ${tasks}`)
        }

        const respContent2 = lines.join('\n')
        await supabase.from('chat_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: respContent2,
          created_at: new Date().toISOString()
        })
        await supabase
          .from('chat_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId)
        return NextResponse.json({
          success: true,
          response: respContent2,
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
          const respContent = `No recent sessions found matching “${term}”.`
          await supabase.from('chat_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: respContent,
            created_at: new Date().toISOString()
          })
          await supabase
            .from('chat_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId)
          return NextResponse.json({
            success: true,
            response: respContent,
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
        const respContent = lines.join('\n')
        await supabase.from('chat_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: respContent,
          created_at: new Date().toISOString()
        })
        await supabase
          .from('chat_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId)
        return NextResponse.json({
          success: true,
          response: respContent,
          conversation_id: conversationId,
          responseType: 'data_lookup',
          coachAlertGenerated: false
        })
      } catch (e) {
        // fall through
      }
    }

    // Classification and optimized context build
    const classification = classifyQuestionAdvanced(message || '')
    const context = await contextBuilder.buildContext(parseInt(userId),
      classification.type === 'basic' ? 'basic' : classification.type === 'performance' ? 'performance' : classification.type === 'historical' ? 'historical' : 'basic',
      classification.querySpecific)

    // Get conversation history (shorter for basic)
    const { data: conversationHistory, error: historyError } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(classification.type === 'basic' ? 8 : 20);

    if (historyError) {
      console.error('Error fetching conversation history:', historyError);
      // Continue without history rather than fail
    }

    // Call training assistant Edge Function with full context and context_type
    const assistantData = await callTrainingAssistant(supabaseUrl, supabaseServiceKey, {
      user_id: parseInt(userId),
      conversation_id: conversationId,
      message,
      conversation_history: conversationHistory || [],
      user_context: context.data,
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
