// src/lib/ai/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { GEMINI_MODEL } from './models'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? '')

function extractText(content: MessageParam['content']): string {
  if (typeof content === 'string') return content
  const block = content.find(b => b.type === 'text')
  return block && 'text' in block ? block.text : ''
}

/**
 * Llama a Gemini con system prompt + historial de mensajes.
 * Misma firma que callAgent en claude.ts para intercambio directo.
 */
export async function callAgent(
  systemPrompt: string,
  messages: MessageParam[],
  model?: string,
  maxTokens = 1024
): Promise<string> {
  if (messages.length === 0) return ''

  const geminiModel = genAI.getGenerativeModel({
    model: model ?? GEMINI_MODEL,
    systemInstruction: systemPrompt,
    generationConfig: { maxOutputTokens: maxTokens },
  })

  // Gemini: historial = todos los mensajes excepto el último
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: extractText(m.content) }],
  }))

  const lastMessage = messages[messages.length - 1]
  const chat = geminiModel.startChat({ history })
  const result = await chat.sendMessage(extractText(lastMessage.content))
  return result.response.text()
}
