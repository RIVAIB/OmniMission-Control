// src/lib/ai/claude.ts
import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { CLAUDE_MODEL } from './models'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Llama a Claude con system prompt + historial de mensajes.
 * Retorna el texto de respuesta o '' si no hay bloque de texto.
 */
export async function callAgent(
  systemPrompt: string,
  messages: MessageParam[],
  model?: string,
  maxTokens = 1024
): Promise<string> {
  const response = await client.messages.create({
    model: model ?? CLAUDE_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  })
  const block = response.content.find(b => b.type === 'text')
  return block?.type === 'text' ? block.text : ''
}
