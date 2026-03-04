// GET /api/erp-bridge/status — bridge health check for rivaib-erp.
// Returns bridge configuration status and connectivity info.
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const bridgeConfigured = !!process.env.ERP_BRIDGE_SECRET

  return NextResponse.json({
    ok: true,
    bridge: {
      configured: bridgeConfigured,
      endpoint: '/api/erp-bridge/events',
      authentication: 'HMAC-SHA256 (x-erp-signature header)',
      phase: 'Fase 2 — ready and waiting for rivaib-erp connection',
    },
    mem0: {
      url: process.env.MEM0_BASE_URL ?? 'http://localhost:8000',
      note: 'Shared memory across all agents',
    },
  })
}
