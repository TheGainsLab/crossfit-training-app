// lib/ai/client.ts
// Minimal client to call the Supabase Edge Function training-assistant

export interface AiClientResponse {
  success: boolean
  response: string
  responseType?: string
  coachAlertGenerated?: boolean
}

export async function callTrainingAssistant(
  supabaseUrl: string,
  supabaseServiceKey: string,
  payload: {
    user_id: number
    conversation_id: number
    message: string
    conversation_history: Array<{ role: 'user' | 'assistant'; content: string }>
    user_context: any
    context_type?: string
  }
): Promise<AiClientResponse> {
  const res = await fetch(`${supabaseUrl}/functions/v1/training-assistant`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`training-assistant failed: ${res.status} ${text}`)
  }
  return res.json()
}

