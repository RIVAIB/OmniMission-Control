// src/lib/ai/agent-service.ts
// Rewritten for SQLite (OmniMission-Control). Original used Supabase.
import { randomUUID } from 'crypto'
import { getDatabase } from '@/lib/db'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { callAgent } from './claude'
import { retrieve, retrieveShared, memorize } from '@/lib/memory/mem0'
import { sendToAgent, isOpenClawAvailable } from './openclaw-client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentConfig {
  systemPrompt?: string
  model?: string
  temperature?: number
  maxTokens?: number
  kind?: string
  [key: string]: unknown
}

export interface AgentRow {
  id: number
  name: string
  role: string
  soul_content?: string
  status: string
  config: AgentConfig
}

// ─── DB lookups (synchronous — better-sqlite3 is sync) ───────────────────────

/**
 * Fetch an agent row by name (case-insensitive).
 * Returns null if not found or status is 'error'.
 */
export function getAgentByName(name: string): AgentRow | null {
  const db = getDatabase()
  const row = db
    .prepare(
      `SELECT id, name, role, soul_content, status, config
       FROM agents
       WHERE LOWER(name) = LOWER(?) AND status != 'error'
       LIMIT 1`
    )
    .get(name) as { id: number; name: string; role: string; soul_content?: string; status: string; config?: string } | undefined

  if (!row) return null

  let config: AgentConfig = {}
  try { config = row.config ? JSON.parse(row.config) : {} } catch { /* ignore parse error */ }

  return {
    id: row.id,
    name: row.name,
    role: row.role,
    soul_content: row.soul_content,
    status: row.status,
    config,
  }
}

/**
 * Create a new conversation ID.
 * MC's messages table uses conversation_id (TEXT) directly — no separate conversations table needed.
 */
export function createConversation(_channel: string, _contactId: string): string {
  return randomUUID()
}

// ─── Memory gate ──────────────────────────────────────────────────────────────

/**
 * Memory enabled for all channels (web chat + Telegram).
 */
function shouldMemorize(_contactId: string | undefined): boolean {
  return true
}

// ─── Core processing ──────────────────────────────────────────────────────────

/**
 * Process a user message through an already-loaded agent row.
 * Use this when the caller already has the AgentRow to avoid a redundant DB lookup.
 */
export async function processMessageWithAgent(
  agent: AgentRow,
  conversationId: string,
  userMessage: string,
  contactId?: string
): Promise<{ response: string; agentId: number; agentName: string }> {
  const db = getDatabase()
  const workspaceId = 1

  // 1. Fetch recent conversation history from SQLite
  const historyRows = db
    .prepare(
      `SELECT from_agent, content
       FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC
       LIMIT 20`
    )
    .all(conversationId) as { from_agent: string; content: string }[]

  const history: MessageParam[] = historyRows.map(row => ({
    role: (row.from_agent === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: row.content,
  }))

  // 2. Persist user message before calling Claude
  db.prepare(
    `INSERT INTO messages (conversation_id, from_agent, to_agent, content, message_type, workspace_id)
     VALUES (?, 'user', ?, ?, 'text', ?)`
  ).run(conversationId, agent.name, userMessage, workspaceId)

  // 3. Build system prompt — soul_content (MC) > config.systemPrompt > default
  const baseSystemPrompt =
    agent.soul_content ??
    agent.config.systemPrompt ??
    `You are ${agent.name}, a helpful AI assistant for RIVAIB Health Clinic. Be professional and empathetic.`

  // 4. Retrieve memory context (gated by patient status)
  const memUserId = contactId ?? conversationId
  const memEnabled = shouldMemorize(contactId)

  const [privateCtx, sharedCtx] = memEnabled
    ? await Promise.all([
        retrieve(agent.name, userMessage, memUserId),
        retrieveShared(userMessage, memUserId),
      ])
    : ['', '']

  const memBlock = [
    privateCtx ? `## Tu memoria privada (${agent.name}):\n${privateCtx}` : '',
    sharedCtx  ? `## Contexto compartido del equipo:\n${sharedCtx}`      : '',
  ].filter(Boolean).join('\n\n')

  const knownUser = !!(privateCtx || sharedCtx)
  const memInstructions = knownUser
    ? '\n\n## Instrucción de comportamiento:\nYa conoces a este usuario. NO te presentes ni te identifiques de nuevo. Ve directo al punto.'
    : ''

  const systemPrompt = memBlock
    ? `${baseSystemPrompt}\n\n${memBlock}${memInstructions}`
    : baseSystemPrompt

  // 5. Build messages array for Claude: history + current message
  const claudeMessages: MessageParam[] = [
    ...history,
    { role: 'user', content: userMessage },
  ]

  // 6. Call agent — via OpenClaw if available, fallback to direct Claude API
  let response: string
  if (isOpenClawAvailable()) {
    response = await sendToAgent(
      agent.name,
      memUserId,
      claudeMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : '',
      })),
      systemPrompt
    )
  } else {
    response = await callAgent(
      systemPrompt,
      claudeMessages,
      agent.config.model,
      agent.config.maxTokens ?? 1024
    )
  }

  // 7. Persist agent response
  db.prepare(
    `INSERT INTO messages (conversation_id, from_agent, to_agent, content, message_type, workspace_id)
     VALUES (?, ?, 'user', ?, 'text', ?)`
  ).run(conversationId, agent.name, response, workspaceId)

  // 8. Memorize exchange (fire-and-forget)
  if (memEnabled) {
    memorize(agent.name, userMessage, response, memUserId).catch(
      (err) => console.error('[Memory] memorize error:', err)
    )
  }

  return { response, agentId: agent.id, agentName: agent.name }
}

/**
 * Process a user message by agent name — fetches the agent row then delegates.
 * Use this only when the caller doesn't already have an AgentRow.
 */
export async function processMessage(
  agentName: string,
  conversationId: string,
  userMessage: string,
  contactId?: string
): Promise<{ response: string; agentId: number; agentName: string }> {
  const agent = getAgentByName(agentName)
  if (!agent) throw new Error(`Agent "${agentName}" not found or inactive`)
  return processMessageWithAgent(agent, conversationId, userMessage, contactId)
}
