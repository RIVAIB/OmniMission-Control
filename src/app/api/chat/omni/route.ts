// POST /api/chat/omni — OmniSentinel War Room chat endpoint.
// CLAWDIO routes the message to the right agent (unless agentOverride is set).
// Adapted from OmniSentinelAO-Suite's /api/chat/mc — all Supabase replaced with SQLite.
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { routeMessage } from '@/lib/ai/router'
import { processMessageWithAgent, createConversation, getAgentByName } from '@/lib/ai/agent-service'

export const dynamic = 'force-dynamic'

interface ChatRequestBody {
  message: string
  channel?: string
  contactId?: string
  conversationId?: string
  /** If set, skip CLAWDIO routing and use this agent directly. */
  agentOverride?: string
}

// ─── POST /api/chat/omni — CLAWDIO routing endpoint ──────────────────────────

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = (await request.json()) as Partial<ChatRequestBody>
    const {
      message,
      channel = 'webchat',
      contactId,
      agentOverride,
    } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Field "message" is required' }, { status: 400 })
    }

    // 1. Find or create conversation ID
    const conversationId = body.conversationId ?? createConversation(channel, contactId ?? 'web-user')
    const isNew = !body.conversationId

    // 2. Determine which agent should respond
    let agentName: string
    let routingConfidence = 1.0
    let routingReason = 'Agent override'

    if (agentOverride) {
      agentName = agentOverride.toUpperCase()
    } else {
      // Route via CLAWDIO
      const routing = await routeMessage(message)
      agentName = routing.agent
      routingConfidence = routing.confidence
      routingReason = routing.reason
    }

    // 3. Load agent (fallback to JESSY if not found)
    const agent = getAgentByName(agentName) ?? getAgentByName('JESSY')
    if (!agent) {
      return NextResponse.json({ error: 'No active agent available' }, { status: 503 })
    }

    // 4. Process message (saves to SQLite messages table + calls Claude)
    const { response, agentName: respondingAgent } = await processMessageWithAgent(
      agent,
      conversationId,
      message,
      contactId
    )

    // 5. Return
    return NextResponse.json(
      { conversationId, response, agent: respondingAgent, routingConfidence, routingReason },
      { status: isNew ? 201 : 200 }
    )
  } catch (err) {
    console.error('[chat/omni]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── GET /api/chat/omni — health check ───────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json({ status: 'OmniSentinel Chat API ready', version: '1.0' })
}
