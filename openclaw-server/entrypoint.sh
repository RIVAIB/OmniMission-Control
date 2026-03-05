#!/bin/sh
set -e

echo "[OpenClaw] Starting gateway..."
echo "[OpenClaw] Writing fresh config to /root/.openclaw/ ..."

# Siempre escribir config fresca desde la imagen — evita JSON corrupto
# en el volume de runs anteriores. /root/.openclaw es ephemeral (correcto).
mkdir -p /root/.openclaw/workspaces

# Sustituir variables de entorno y escribir config final
sed \
  -e "s|\${ANTHROPIC_API_KEY}|${ANTHROPIC_API_KEY}|g" \
  -e "s|\${OPENCLAW_GATEWAY_TOKEN}|${OPENCLAW_GATEWAY_TOKEN}|g" \
  -e "s|\${MISSION_CONTROL_ORIGIN}|${MISSION_CONTROL_ORIGIN:-*}|g" \
  /app/config/openclaw.json > /root/.openclaw/openclaw.json

cp -r /app/config/workspaces/. /root/.openclaw/workspaces/

echo "[OpenClaw] Config ready at /root/.openclaw/openclaw.json"
echo "[OpenClaw] Launching gateway on port 18789..."

exec openclaw gateway --port 18789 --verbose
