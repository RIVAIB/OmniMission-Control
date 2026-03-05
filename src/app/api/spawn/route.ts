import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'
import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { heavyLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { validateBody, spawnAgentSchema } from '@/lib/validation'

const OPENCLAW_BASE = process.env.OPENCLAW_GATEWAY_URL ?? ''
const OPENCLAW_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN ?? ''

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = heavyLimiter(request)
  if (rateCheck) return rateCheck

  try {
    const result = await validateBody(request, spawnAgentSchema)
    if ('error' in result) return result.error
    const { task, model, label, timeoutSeconds } = result.data

    const spawnId = `spawn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    if (!OPENCLAW_BASE || !OPENCLAW_TOKEN) {
      return NextResponse.json({
        success: false,
        spawnId,
        error: 'OpenClaw gateway not configured (OPENCLAW_GATEWAY_URL / OPENCLAW_GATEWAY_TOKEN missing)',
        task, model, label, timeoutSeconds, createdAt: Date.now(),
      }, { status: 503 })
    }

    try {
      // Resolve model: if short alias (e.g. "sonnet"), use the full model name
      const resolvedModel = model?.includes('/')
        ? model
        : `anthropic/claude-sonnet-4-6`

      // Use OpenClaw's OpenAI-compatible HTTP API instead of local clawdbot CLI
      const res = await fetch(`${OPENCLAW_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
          // Default to JESSY — the primary agent defined in openclaw.json
          'x-openclaw-agent-id': 'JESSY',
        },
        body: JSON.stringify({
          model: resolvedModel,
          messages: [{ role: 'user', content: task }],
          // Stable session key so spawns are tracked per label
          user: `mc-spawn-${label || spawnId}`,
          stream: false,
        }),
        signal: AbortSignal.timeout((timeoutSeconds ?? 300) * 1000),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`OpenClaw HTTP ${res.status}: ${errText}`)
      }

      const data = await res.json() as {
        choices?: Array<{ message?: { content?: string } }>
        id?: string
      }

      const reply = data.choices?.[0]?.message?.content ?? ''

      return NextResponse.json({
        success: true,
        spawnId,
        sessionInfo: data.id ?? spawnId,
        task, model: resolvedModel, label,
        timeoutSeconds,
        createdAt: Date.now(),
        stdout: reply,
        stderr: '',
      })

    } catch (execError: any) {
      logger.error({ err: execError }, 'Spawn execution error')
      return NextResponse.json({
        success: false,
        spawnId,
        error: execError.message || 'Failed to spawn agent',
        task, model, label, timeoutSeconds, createdAt: Date.now(),
      }, { status: 500 })
    }

  } catch (error) {
    logger.error({ err: error }, 'Spawn API error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Get spawn history
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

    // In a real implementation, you'd store spawn history in a database
    // For now, we'll try to read recent spawn activity from logs
    
    try {
      if (!config.logsDir) {
        return NextResponse.json({ history: [] })
      }

      const files = await readdir(config.logsDir)
      const logFiles = await Promise.all(
        files
          .filter((file) => file.endsWith('.log'))
          .map(async (file) => {
            const fullPath = join(config.logsDir, file)
            const stats = await stat(fullPath)
            return { file, fullPath, mtime: stats.mtime.getTime() }
          })
      )

      const recentLogs = logFiles
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 5)

      const lines: string[] = []

      for (const log of recentLogs) {
        const content = await readFile(log.fullPath, 'utf-8')
        const matched = content
          .split('\n')
          .filter((line) => line.includes('sessions_spawn'))
        lines.push(...matched)
      }

      const spawnHistory = lines
        .slice(-limit)
        .map((line, index) => {
          try {
            const timestampMatch = line.match(
              /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/
            )
            const modelMatch = line.match(/model[:\s]+"([^"]+)"/)
            const taskMatch = line.match(/task[:\s]+"([^"]+)"/)

            return {
              id: `history-${Date.now()}-${index}`,
              timestamp: timestampMatch
                ? new Date(timestampMatch[1]).getTime()
                : Date.now(),
              model: modelMatch ? modelMatch[1] : 'unknown',
              task: taskMatch ? taskMatch[1] : 'unknown',
              status: 'completed',
              line: line.trim()
            }
          } catch (parseError) {
            return null
          }
        })
        .filter(Boolean)

      return NextResponse.json({ history: spawnHistory })

    } catch (logError) {
      // If we can't read logs, return empty history
      return NextResponse.json({ history: [] })
    }

  } catch (error) {
    logger.error({ err: error }, 'Spawn history API error')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
