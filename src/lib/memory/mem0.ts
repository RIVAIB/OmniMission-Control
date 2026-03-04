// src/lib/memory/mem0.ts
// Thin wrapper over mem0 REST API.
// mem0 server runs on Railway: MEM0_BASE_URL env var.

const MEM0_BASE = process.env.MEM0_BASE_URL ?? 'http://localhost:8000';

export interface MemorySearchResult {
    id: string;
    memory: string;
    score?: number;
}

/**
 * Store a user↔agent exchange in mem0 shared memory.
 * Fire-and-forget — caller should not await if non-blocking is needed.
 */
export async function memorize(
    agentName: string,
    userMessage: string,
    agentResponse: string,
    userId: string
): Promise<void> {
    const url = `${MEM0_BASE}/memories`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: 'user',      content: userMessage   },
                    { role: 'assistant', content: agentResponse },
                ],
                agent_id: agentName,
                user_id: userId,
            }),
        });
        if (!res.ok) {
            const body = await res.text();
            console.error('[Memory] memorize failed:', body);
        }
    } catch (err) {
        // Memory is best-effort — never crash the agent pipeline
        console.error('[Memory] memorize error (non-fatal):', err);
    }
}

/**
 * Retrieve relevant memory context for an agent before responding.
 * Returns a formatted string ready to inject into a system prompt,
 * or empty string if no relevant memories found.
 */
export async function retrieve(
    agentName: string,
    query: string,
    userId: string,
    limit = 5
): Promise<string> {
    const url = `${MEM0_BASE}/search`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                agent_id: agentName,
                user_id: userId,
                limit,
            }),
        });
        if (!res.ok) return '';

        const data = (await res.json()) as { results?: MemorySearchResult[] };
        const results = data.results ?? [];
        if (!results.length) return '';

        return results.map(r => `• ${r.memory}`).join('\n');
    } catch {
        // Memory retrieval failure must never block agent response
        return '';
    }
}

/**
 * Retrieve cross-agent shared memory (no agent_id filter).
 * Use this to get context that ANY agent may have stored for this user.
 */
export async function retrieveShared(
    query: string,
    userId: string,
    limit = 5
): Promise<string> {
    const url = `${MEM0_BASE}/search`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                user_id: userId,
                limit,
            }),
        });
        if (!res.ok) return '';

        const data = (await res.json()) as { results?: MemorySearchResult[] };
        const results = data.results ?? [];
        if (!results.length) return '';

        return results.map(r => `• ${r.memory}`).join('\n');
    } catch {
        return '';
    }
}
