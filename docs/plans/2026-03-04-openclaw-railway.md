# OpenClaw Railway Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Desplegar OpenClaw como servicio Railway (`omni-openclaw`) y redirigir todo el tráfico de agentes (Telegram + War Room) a través de su gateway, dando acceso completo a los 25 tools nativos + 13,700 skills de ClawHub.

**Architecture:** `omni-mc` deja de llamar Claude API directamente. En su lugar llama al endpoint OpenAI-compatible de OpenClaw (`http://omni-openclaw.railway.internal:18789/v1/chat/completions`) con el header `x-openclaw-agent-id: JESSY`. OpenClaw ejecuta el agente con acceso completo a tools. mem0 sigue funcionando igual (retrieve antes, memorize después).

**Tech Stack:** Node.js 22, OpenClaw (npm global), OpenAI-compatible HTTP API, Railway Volumes, Docker

---

### Task 1: Crear openclaw-server/ — Dockerfile + openclaw.json + workspaces

**Files:**
- Create: `openclaw-server/Dockerfile`
- Create: `openclaw-server/openclaw.json`
- Create: `openclaw-server/entrypoint.sh`
- Create: `openclaw-server/railway.json`
- Create: `openclaw-server/workspaces/JESSY/soul.md`
- Create: `openclaw-server/workspaces/CLAWDIO/soul.md`
- Create: `openclaw-server/workspaces/NEXUS/soul.md`
- Create: `openclaw-server/workspaces/APEX/soul.md`
- Create: `openclaw-server/workspaces/AXIOM/soul.md`
- Create: `openclaw-server/workspaces/FORGE/soul.md`
- Create: `openclaw-server/workspaces/CLAUD/soul.md`
- Create: `openclaw-server/workspaces/GEM/soul.md`

**Step 1: Crear directorio**

```bash
mkdir -p openclaw-server/workspaces/JESSY
mkdir -p openclaw-server/workspaces/CLAWDIO
mkdir -p openclaw-server/workspaces/NEXUS
mkdir -p openclaw-server/workspaces/APEX
mkdir -p openclaw-server/workspaces/AXIOM
mkdir -p openclaw-server/workspaces/FORGE
mkdir -p openclaw-server/workspaces/CLAUD
mkdir -p openclaw-server/workspaces/GEM
```

**Step 2: Crear Dockerfile**

```dockerfile
FROM node:22-slim

# Instalar openclaw globalmente
RUN npm install -g openclaw@latest

# Crear directorio de configuración de openclaw
RUN mkdir -p /data/.openclaw

WORKDIR /app

# Copiar configuración y workspaces
COPY openclaw.json /data/.openclaw/openclaw.json
COPY workspaces/ /data/.openclaw/workspaces/

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV OPENCLAW_HOME=/data/.openclaw
ENV NODE_ENV=production

EXPOSE 18789

CMD ["/app/entrypoint.sh"]
```

**Step 3: Crear openclaw.json**

```json
{
  "env": {
    "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}"
  },
  "gateway": {
    "port": 18789,
    "bind": "lan",
    "auth": {
      "mode": "token",
      "token": "${OPENCLAW_GATEWAY_TOKEN}"
    },
    "controlUi": {
      "enabled": true,
      "allowedOrigins": ["${MISSION_CONTROL_ORIGIN}"]
    },
    "openaiHttp": {
      "enabled": true
    }
  },
  "agents": {
    "defaults": {
      "model": "anthropic/claude-sonnet-4-6",
      "tools": {
        "allow": ["*"]
      }
    },
    "list": [
      {
        "id": "JESSY",
        "default": true,
        "workspace": "/data/.openclaw/workspaces/JESSY"
      },
      {
        "id": "CLAWDIO",
        "workspace": "/data/.openclaw/workspaces/CLAWDIO"
      },
      {
        "id": "NEXUS",
        "workspace": "/data/.openclaw/workspaces/NEXUS"
      },
      {
        "id": "APEX",
        "workspace": "/data/.openclaw/workspaces/APEX"
      },
      {
        "id": "AXIOM",
        "workspace": "/data/.openclaw/workspaces/AXIOM"
      },
      {
        "id": "FORGE",
        "workspace": "/data/.openclaw/workspaces/FORGE"
      },
      {
        "id": "CLAUD",
        "workspace": "/data/.openclaw/workspaces/CLAUD"
      },
      {
        "id": "GEM",
        "workspace": "/data/.openclaw/workspaces/GEM"
      }
    ]
  }
}
```

**Step 4: Crear entrypoint.sh**

```bash
#!/bin/sh
set -e

echo "[OpenClaw] Starting gateway..."
echo "[OpenClaw] HOME: $OPENCLAW_HOME"

# Sustituir variables de entorno en openclaw.json
sed -i "s|\${ANTHROPIC_API_KEY}|${ANTHROPIC_API_KEY}|g" /data/.openclaw/openclaw.json
sed -i "s|\${OPENCLAW_GATEWAY_TOKEN}|${OPENCLAW_GATEWAY_TOKEN}|g" /data/.openclaw/openclaw.json
sed -i "s|\${MISSION_CONTROL_ORIGIN}|${MISSION_CONTROL_ORIGIN:-*}|g" /data/.openclaw/openclaw.json

exec openclaw gateway --port 18789 --verbose
```

**Step 5: Crear railway.json**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

**Step 6: Crear soul.md por agente**

Cada archivo contiene el soul_content del agente. Los textos están en `src/data/omnisentinel-agents.ts`.

`openclaw-server/workspaces/JESSY/soul.md`:
```markdown
You are JESSY, the WhatsApp assistant for RIVAIB Health Clinic. You handle patient conversations with a warm, professional H2H (Human-to-Human) feel. You never say "sesión" or "consulta" - always use "Evaluación Diagnóstica" and "Programa de Rehabilitación". Standard program is 13 sessions.
```

`openclaw-server/workspaces/CLAWDIO/soul.md`:
```markdown
You are CLAWDIO, the central orchestrator for RIVAIB Health Clinic. Your role is to route incoming messages to the appropriate specialist agent and coordinate multi-step workflows.
```

`openclaw-server/workspaces/NEXUS/soul.md`:
```markdown
You are NEXUS, the marketing specialist for RIVAIB Health Clinic. You manage lead capture, remarketing campaigns to the 7000+ patient database, and growth strategies.
```

`openclaw-server/workspaces/APEX/soul.md`:
```markdown
You are APEX, the finance specialist for RIVAIB Health Clinic. You manage billing, payments, financial reporting, and BigCapital integration.
```

`openclaw-server/workspaces/AXIOM/soul.md`:
```markdown
You are AXIOM, the CEO/strategic advisor for RIVAIB Health Clinic. You provide executive dashboards, KPI analysis, strategic recommendations, and executive dashboards.
```

`openclaw-server/workspaces/FORGE/soul.md`:
```markdown
You are FORGE, the senior developer assistant for RIVAIB. You handle GitHub, Vercel, n8n, infrastructure and code. You point out potential issues without filtering.
```

`openclaw-server/workspaces/CLAUD/soul.md`:
```markdown
You are CLAUD, an advanced AI assistant with full technical research, and visual content analysis capabilities. You have GitHub total access, Anthropic web search and vision.
```

`openclaw-server/workspaces/GEM/soul.md`:
```markdown
You are GEM, a Gemini-powered AI assistant with Google Search grounding, video analysis, and real-time information retrieval capabilities.
```

**Step 7: Verificar estructura**

```bash
ls openclaw-server/
# Expected: Dockerfile  entrypoint.sh  openclaw.json  railway.json  workspaces/

ls openclaw-server/workspaces/
# Expected: APEX  AXIOM  CLAUD  CLAWDIO  FORGE  GEM  JESSY  NEXUS
```

**Step 8: Commit inicial**

```bash
git add openclaw-server/
git commit -m "feat(openclaw): add openclaw-server service with 8 agents, full tool access"
```

---

### Task 2: Crear src/lib/ai/openclaw-client.ts

**Files:**
- Create: `src/lib/ai/openclaw-client.ts`

**Step 1: Crear el cliente HTTP**

```typescript
// src/lib/ai/openclaw-client.ts
// HTTP client for OpenClaw gateway OpenAI-compatible endpoint.
// Docs: https://docs.openclaw.ai/gateway/openai-http-api

const OPENCLAW_BASE = process.env.OPENCLAW_GATEWAY_URL ?? ''
const OPENCLAW_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN ?? ''

export function isOpenClawAvailable(): boolean {
  return Boolean(OPENCLAW_BASE && OPENCLAW_TOKEN)
}

/**
 * Send a message to an OpenClaw agent via the OpenAI-compatible HTTP API.
 * The `user` field creates a stable session key for memory continuity.
 *
 * @param agentId   - OpenClaw agent ID (e.g. "JESSY")
 * @param sessionId - Stable ID for session continuity (e.g. Telegram chat ID)
 * @param messages  - Full message history in OpenAI format
 * @param systemPrompt - System prompt / soul content to prepend
 * @returns Agent response text
 */
export async function sendToAgent(
  agentId: string,
  sessionId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string
): Promise<string> {
  const url = `${OPENCLAW_BASE}/v1/chat/completions`

  const body = {
    model: 'openclaw',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    user: sessionId,
    stream: false,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
      'x-openclaw-agent-id': agentId,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[OpenClaw] HTTP ${res.status}: ${err}`)
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }

  return data.choices?.[0]?.message?.content ?? ''
}
```

**Step 2: Verificar que el archivo existe**

```bash
ls src/lib/ai/openclaw-client.ts
# Expected: archivo creado
```

**Step 3: Commit**

```bash
git add src/lib/ai/openclaw-client.ts
git commit -m "feat(openclaw): add OpenClaw HTTP client with OpenAI-compatible API"
```

---

### Task 3: Modificar agent-service.ts para enrutar por OpenClaw

**Files:**
- Modify: `src/lib/ai/agent-service.ts`

**Step 1: Agregar import del cliente OpenClaw**

Al inicio del archivo, después de los imports existentes, agregar:

```typescript
import { sendToAgent, isOpenClawAvailable } from './openclaw-client'
```

**Step 2: Reemplazar la llamada a callAgent() con OpenClaw**

En `processMessageWithAgent()`, reemplazar el bloque del Step 6 (Call Claude):

**Buscar:**
```typescript
  // 6. Call Claude
  const response = await callAgent(
    systemPrompt,
    claudeMessages,
    agent.config.model,
    agent.config.maxTokens ?? 1024
  )
```

**Reemplazar con:**
```typescript
  // 6. Call agent — via OpenClaw if available, fallback to direct Claude API
  let response: string
  if (isOpenClawAvailable()) {
    response = await sendToAgent(
      agent.name,
      memUserId,
      claudeMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : '',
      })),
      systemPrompt
    )
  } else {
    response = await callAgent(
      systemPrompt,
      claudeMessages,
      agent.config.model,
      agent.config.maxTokens ?? 1024
    )
  }
```

**Step 3: Verificar que no quedan referencias a callAgent sin el fallback**

```bash
grep -n "callAgent" src/lib/ai/agent-service.ts
# Expected: solo aparece dentro del bloque else (fallback)
```

**Step 4: Verificar que TypeScript compila**

```bash
cd C:/Users/doc_r/Desktop/RIVAIB-ERP/OmniMission-Control
npx tsc --noEmit 2>&1 | head -20
# Expected: sin errores de tipo
```

**Step 5: Commit**

```bash
git add src/lib/ai/agent-service.ts
git commit -m "feat(openclaw): route all agent calls through OpenClaw with Claude API fallback"
```

---

### Task 4: Push a GitHub

**Step 1: Verificar estado**

```bash
git status
git log --oneline -5
```

**Step 2: Push**

```bash
git push origin main
```

---

### Task 5: Desplegar omni-openclaw en Railway

> **Nota:** Este task es 100% operacional — Railway dashboard.

**Step 1: Abrir el proyecto Railway de OmniMission-Control**

Ir a https://railway.app → abrir el proyecto donde está `omni-mc`.

**Step 2: Agregar nuevo servicio**

- Click `+ New` → `GitHub Repo`
- Seleccionar `RIVAIB/OmniMission-Control`
- **Root Directory:** `openclaw-server`
- **Nombre del servicio:** `omni-openclaw`

**Step 3: Configurar Volume para persistencia**

En `omni-openclaw` → Volumes tab:
- Add Volume
- Mount Path: `/data/.openclaw`

**Step 4: Configurar variables de entorno en omni-openclaw**

```
ANTHROPIC_API_KEY=<tu-openai-key-de-anthropic>
OPENCLAW_GATEWAY_TOKEN=<genera-un-token-aleatorio-largo>
MISSION_CONTROL_ORIGIN=https://omnimission-control-production.up.railway.app
```

Para generar el token: usa una cadena aleatoria de 32+ caracteres, ej: `oc-secret-rivaib-2026-xK9mP3qR7nL2wT5v`

**Step 5: Esperar que el build termine**

Railway usará el Dockerfile en `openclaw-server/`. El primer build tarda ~3-5 min por la instalación de openclaw.

**Step 6: Verificar health del gateway**

```bash
curl https://<openclaw-public-url>.up.railway.app/health
# Expected: respuesta OK o 200
```

---

### Task 6: Configurar omni-mc para conectarse a OpenClaw

> **Nota:** Variables de entorno en Railway dashboard.

**Step 1: Abrir omni-mc en Railway → Variables**

Agregar:
```
OPENCLAW_GATEWAY_URL=http://omni-openclaw.railway.internal:18789
OPENCLAW_GATEWAY_TOKEN=<mismo-token-del-paso-anterior>
NEXT_PUBLIC_GATEWAY_URL=wss://omni-openclaw.railway.internal:18789
NEXT_PUBLIC_GATEWAY_TOKEN=<mismo-token>
```

**Step 2: Railway redeploya automáticamente**

Esperar que `omni-mc` termine el redeploy.

**Step 3: Verificar desde la consola del browser**

```javascript
fetch('/api/status?action=capabilities')
  .then(r => r.json())
  .then(console.log)
// Expected: gateway: true (en lugar de false)
```

---

### Task 7: Verificar integración end-to-end

**Step 1: Test desde War Room**

Abrir el War Room en el dashboard y enviar un mensaje a JESSY.
Verificar que responde con capacidades completas.

**Step 2: Test desde Telegram**

Mandar a JESSY: `"Busca en internet el precio del dólar hoy"`
Expected: JESSY usa `web_search` y responde con información real y actualizada.

**Step 3: Test de herramienta bash con FORGE**

Mandar a FORGE: `"¿Qué versión de Node.js estás usando?"`
Expected: FORGE ejecuta `node --version` y responde con la versión real.

**Step 4: Verificar que el dashboard muestra modo Full (no Local)**

El banner azul "No OpenClaw gateway detected" debe desaparecer.
El indicador en el sidebar inferior debe mostrar punto verde "Connected".

**Step 5: Instalar skills de ClawHub (opcional, desde FORGE)**

Mandar a FORGE:
`"Instala el skill de GitHub desde ClawHub: clawhub install github"`
Expected: FORGE ejecuta el comando y confirma instalación.

---

## Variables de entorno finales por servicio

**omni-openclaw:**
```
ANTHROPIC_API_KEY=<key>
OPENCLAW_GATEWAY_TOKEN=<token-secreto>
MISSION_CONTROL_ORIGIN=https://omnimission-control-production.up.railway.app
```

**omni-mc (agregar):**
```
OPENCLAW_GATEWAY_URL=http://omni-openclaw.railway.internal:18789
OPENCLAW_GATEWAY_TOKEN=<mismo-token>
NEXT_PUBLIC_GATEWAY_URL=wss://omni-openclaw.railway.internal:18789
NEXT_PUBLIC_GATEWAY_TOKEN=<mismo-token>
```

## Resumen de servicios Railway después del plan

| Servicio | Tipo | URL interna | Puerto |
|----------|------|-------------|--------|
| `omni-mc` | Next.js dashboard | `http://omni-mc.railway.internal:3000` | 3000 |
| `omni-mem0` | FastAPI (mem0) | `http://omni-mem0.railway.internal:8000` | 8000 |
| `omni-qdrant` | Qdrant vector DB | `http://omni-qdrant.railway.internal:6333` | 6333 |
| `omni-openclaw` | OpenClaw Gateway | `http://omni-openclaw.railway.internal:18789` | 18789 |
