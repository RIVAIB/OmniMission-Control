#!/bin/sh
set -e

echo "[OpenClaw] Starting gateway..."
echo "[OpenClaw] HOME: $OPENCLAW_HOME"

# Primer arranque: el volume en /data/.openclaw está vacío.
# Copiar config desde /app/config (que viene en la imagen del build).
if [ ! -f /data/.openclaw/openclaw.json ]; then
  echo "[OpenClaw] First run — initializing volume from build config..."
  mkdir -p /data/.openclaw/workspaces
  cp /app/config/openclaw.json /data/.openclaw/openclaw.json
  cp -r /app/config/workspaces/. /data/.openclaw/workspaces/
  echo "[OpenClaw] Config initialized."
fi

# Sustituir variables de entorno en openclaw.json
sed -i "s|\${ANTHROPIC_API_KEY}|${ANTHROPIC_API_KEY}|g" /data/.openclaw/openclaw.json
sed -i "s|\${OPENCLAW_GATEWAY_TOKEN}|${OPENCLAW_GATEWAY_TOKEN}|g" /data/.openclaw/openclaw.json
sed -i "s|\${MISSION_CONTROL_ORIGIN}|${MISSION_CONTROL_ORIGIN:-*}|g" /data/.openclaw/openclaw.json

exec openclaw gateway --port 18789 --verbose
