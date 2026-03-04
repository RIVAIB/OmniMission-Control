// src/lib/ai/openclaw-client.ts
// HTTP client for OpenClaw gateway OpenAI-compatible endpoint.
// Docs: https://docs.openclaw.ai/gateway/openai-http-api

const OPENCLAW_BASE = process.env.OPENCLAW_GATEWAY_URL ?? ''
const OPENCLAW_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN ?? ''

export function isOpenClawAvailable(): boolean {
  return Boolean(OPENCLAW_BASE && OPENCLAW_TOKEN)
}

/**
 * Send a message to an OpenClaw agent via the OpenAI-compatible HTTP API.
 * The `user` field creates a stable session key for memory continuity.
 *
 * @param agentId   - OpenClaw agent ID (e.g. "JESSY")
 * @param sessionId - Stable ID for session continuity (e.g. Telegram chat ID)
 * @param messages  - Full message history in OpenAI format
 * @param systemPrompt - System prompt / soul content to prepend
 * @returns Agent response text
 */
export async function sendToAgent(
  agentId: string,
  sessionId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string
): Promise<string> {
  const url = `${OPENCLAW_BASE}/v1/chat/completions`

  const body = {
    model: 'openclaw',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    user: sessionId,
    stream: false,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
      'x-openclaw-agent-id': agentId,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[OpenClaw] HTTP ${res.status}: ${err}`)
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }

  return data.choices?.[0]?.message?.content ?? ''
}
