// lib/ai/client.ts
// Server-side client to call the training assistant Edge Function with ContextFeatures

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
    conversation_history: Array<{ role: 'user'|'assistant'; content: string }>
    user_context: any
    context_type?: string
  }
): Promise<AiClientResponse> {
  const res = await fetch(`${supabaseUrl}/functions/v1/training-assistant`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(`training-assistant failed: ${res.status}`)
  return res.json()
}

