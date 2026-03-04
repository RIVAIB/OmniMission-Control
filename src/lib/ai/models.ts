// src/lib/ai/models.ts
// Fuente única de verdad para model IDs.
// Override via env vars: CLAUDE_MODEL, GEMINI_MODEL
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6'
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
