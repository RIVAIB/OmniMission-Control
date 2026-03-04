// src/lib/ai/router.ts
// CLAWDIO routing orchestrator — decides which agent handles a message.
// Adapted for OmniMission-Control: uses new callAgent(system, messages, model, maxTokens) signature.
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { callAgent } from './claude'
import { CLAUDE_MODEL } from './models'

// ─── CLAWDIO Routing Prompt ───────────────────────────────────────────────────

const ROUTING_PROMPT = `You are CLAWDIO, the routing orchestrator for RIVAIB Health Clinic.

Analyze the user's message and decide which specialist agent should handle it:

AGENTS:
- JESSY: Patient appointments, scheduling, availability, medical consultations, reminders. WhatsApp primary contact.
- NEXUS: Marketing, promotions, campaigns, lead capture, pricing questions.
- APEX: Payments, invoices, billing, financial queries, receipts.
- AXIOM: Business reports, metrics, KPIs, strategic analysis.
- FORGE: Technical questions, system issues, code, deployments, GitHub.

RULES:
- If unclear, default to JESSY (main patient contact)
- Consider conversation history for context
- Be decisive, pick ONE agent

Respond ONLY with valid JSON, nothing else:
{"agent": "AGENT_NAME", "confidence": 0.95, "reason": "brief explanation"}`

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoutingDecision {
  agent: string
  confidence: number
  reason: string
}

// ─── Router ───────────────────────────────────────────────────────────────────

/**
 * Ask CLAWDIO (Claude) which agent should handle the message.
 * Falls back to JESSY on any parsing error.
 */
export async function routeMessage(
  message: string,
  conversationHistory?: MessageParam[]
): Promise<RoutingDecision> {
  try {
    const messages: MessageParam[] = [
      ...(conversationHistory ?? []),
      { role: 'user', content: message },
    ]

    const raw = await callAgent(
      ROUTING_PROMPT,
      messages,
      CLAUDE_MODEL,
      256  // low max_tokens — routing decisions are short
    )

    // Strip any markdown code fences Claude might add despite instructions
    const cleaned = raw.replace(/```(?:json)?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned) as Partial<RoutingDecision>

    return {
      agent: parsed.agent ?? 'JESSY',
      confidence: parsed.confidence ?? 0.5,
      reason: parsed.reason ?? 'Defaulted to JESSY',
    }
  } catch {
    // Graceful fallback — never crash the pipeline
    return { agent: 'JESSY', confidence: 0.5, reason: 'Routing fallback (parse error)' }
  }
}
