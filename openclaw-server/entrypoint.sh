#!/bin/sh
set -e

echo "[OpenClaw] Starting gateway..."
echo "[OpenClaw] HOME: $OPENCLAW_HOME"

# Sustituir variables de entorno en openclaw.json
sed -i "s|\${ANTHROPIC_API_KEY}|${ANTHROPIC_API_KEY}|g" /data/.openclaw/openclaw.json
sed -i "s|\${OPENCLAW_GATEWAY_TOKEN}|${OPENCLAW_GATEWAY_TOKEN}|g" /data/.openclaw/openclaw.json
sed -i "s|\${MISSION_CONTROL_ORIGIN}|${MISSION_CONTROL_ORIGIN:-*}|g" /data/.openclaw/openclaw.json

exec openclaw gateway --port 18789 --verbose
