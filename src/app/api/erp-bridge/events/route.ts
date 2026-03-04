// POST /api/erp-bridge/events — receives events from rivaib-erp (Fase 2).
// HMAC-SHA256 verified. Broadcasts to SSE event bus + optionally notifies agent.
// Currently: validates and logs. Agent notification wired in Fase 2.
import { NextRequest, NextResponse } from 'next/server'
import { verifyErpSignature, mapEventToAgent } from '@/lib/bridge/erp-bridge'
import { eventBus } from '@/lib/event-bus'
import { getDatabase, db_helpers } from '@/lib/db'
import type { ErpEvent, ErpBridgeResponse } from '@/lib/bridge/bridge-types'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.ERP_BRIDGE_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'ERP bridge not configured' }, { status: 503 })
  }

  // 1. Read raw body for HMAC verification
  const rawBody = await request.text()
  const signature = request.headers.get('x-erp-signature')

  if (!verifyErpSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // 2. Parse event
  let event: ErpEvent
  try {
    event = JSON.parse(rawBody) as ErpEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!event.type || !event.payload) {
    return NextResponse.json({ error: 'Missing required fields: type, payload' }, { status: 400 })
  }

  const receivedAt = Math.floor(Date.now() / 1000)
  const targetAgent = event.targetAgent ?? mapEventToAgent(event.type)

  // 3. Log to activity feed (visible in MC dashboard)
  db_helpers.logActivity(
    'erp.event',
    'erp_bridge',
    0,
    event.source ?? 'rivaib-erp',
    `ERP event: ${event.type} → ${targetAgent}`,
    { eventType: event.type, payload: event.payload, targetAgent },
    1
  )

  // 4. Broadcast to SSE clients (War Room live feed)
  eventBus.broadcast('activity.created', {
    type: 'erp.event',
    source: event.source ?? 'rivaib-erp',
    eventType: event.type,
    targetAgent,
    payload: event.payload,
    created_at: receivedAt,
  })

  // 5. TODO (Fase 2): trigger agent notification via Telegram or War Room chat
  // await notifyAgent(targetAgent, event)

  const response: ErpBridgeResponse = {
    ok: true,
    received: receivedAt,
    eventType: event.type,
    message: `Event routed to ${targetAgent}`,
  }

  return NextResponse.json(response, { status: 200 })
}
