// src/lib/telegram/agent-parser.ts
// Detect OmniSentinel agent names in a message for routing.

const AGENT_NAMES = ['CLAWDIO', 'JESSY', 'NEXUS', 'APEX', 'AXIOM', 'FORGE'] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

/**
 * Scan a message for an OmniSentinel agent name (case-insensitive).
 * Returns the agent name (uppercased) or null if none found.
 *
 * Examples:
 *   "JESSY revisa las citas" → "JESSY"
 *   "jessy, dame un resumen" → "JESSY"
 *   "@APEX analiza esto"     → "APEX"
 *   "hola cómo estás"        → null
 */
export function detectAgentMention(text: string): AgentName | null {
    const upper = text.toUpperCase();
    for (const name of AGENT_NAMES) {
        const regex = new RegExp(`(?:^|\\s|@)${name}(?:\\s|,|$|\\.)`, 'i');
        if (regex.test(upper)) return name;
    }
    return null;
}
