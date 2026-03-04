// src/lib/bridge/bridge-types.ts
// Shared types for the rivaib-erp ↔ OmniMission-Control bridge.
// Fase 2: rivaib-erp will POST events here when clinic activity occurs.

export type ErpEventType =
  | 'appointment.created'
  | 'appointment.updated'
  | 'appointment.cancelled'
  | 'patient.registered'
  | 'patient.updated'
  | 'payment.created'
  | 'payment.confirmed'
  | 'lead.captured'
  | 'campaign.launched'
  | 'report.generated'
  | 'system.alert'

export interface ErpEvent {
  type: ErpEventType
  timestamp: string       // ISO 8601
  source: string          // e.g. 'rivaib-erp'
  payload: Record<string, unknown>
  /** Optional: target agent to notify (e.g. 'JESSY', 'APEX') */
  targetAgent?: string
}

export interface ErpBridgeResponse {
  ok: boolean
  received: number        // unix timestamp
  eventType: ErpEventType
  message?: string
}
