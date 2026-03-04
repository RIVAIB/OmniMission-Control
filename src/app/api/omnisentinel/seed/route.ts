// POST /api/omnisentinel/seed — upserts the 8 OmniSentinel agents into SQLite.
// Requires admin role. Safe to run multiple times (idempotent).
import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { OMNISENTINEL_AGENTS } from '@/data/omnisentinel-agents'

export async function POST(req: NextRequest) {
  const auth = requireRole(req, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const db = getDatabase()
  const now = Math.floor(Date.now() / 1000)
  const results: { name: string; action: 'inserted' | 'updated' }[] = []

  const upsert = db.prepare(`
    INSERT INTO agents (name, role, soul_content, status, config, workspace_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      role        = excluded.role,
      soul_content = excluded.soul_content,
      status      = excluded.status,
      config      = excluded.config,
      updated_at  = excluded.updated_at
  `)

  const checkExisting = db.prepare(`SELECT id FROM agents WHERE name = ?`)

  const runAll = db.transaction(() => {
    for (const agent of OMNISENTINEL_AGENTS) {
      const existing = checkExisting.get(agent.name)
      upsert.run(
        agent.name,
        agent.role,
        agent.soul_content,
        agent.status,
        JSON.stringify(agent.config),
        now,
        now
      )
      results.push({ name: agent.name, action: existing ? 'updated' : 'inserted' })
    }
  })

  runAll()

  return NextResponse.json({
    ok: true,
    message: `Seeded ${OMNISENTINEL_AGENTS.length} OmniSentinel agents`,
    agents: results,
  })
}
