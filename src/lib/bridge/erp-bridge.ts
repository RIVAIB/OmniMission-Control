// src/lib/bridge/erp-bridge.ts
// HMAC-SHA256 verification for incoming ERP bridge events.
// Fase 2: rivaib-erp signs requests with ERP_BRIDGE_SECRET.

import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Verify HMAC-SHA256 signature from rivaib-erp.
 * Header: x-erp-signature: sha256=<hex>
 * @param body     Raw request body (string or Buffer)
 * @param header   Value of x-erp-signature header
 * @param secret   ERP_BRIDGE_SECRET env var
 */
export function verifyErpSignature(
  body: string,
  header: string | null,
  secret: string
): boolean {
  if (!header) return false

  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(header))
  } catch {
    return false
  }
}

/**
 * Map ERP event type to the agent best suited to handle it.
 * Used to auto-route incoming events to the right agent notification.
 */
export function mapEventToAgent(eventType: string): string {
  if (eventType.startsWith('appointment.') || eventType.startsWith('patient.')) return 'JESSY'
  if (eventType.startsWith('payment.'))   return 'APEX'
  if (eventType.startsWith('lead.') || eventType.startsWith('campaign.')) return 'NEXUS'
  if (eventType.startsWith('report.'))    return 'AXIOM'
  if (eventType.startsWith('system.'))    return 'FORGE'
  return 'CLAWDIO'
}
