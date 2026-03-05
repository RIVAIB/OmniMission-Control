#!/bin/sh
set -e

echo "[OpenClaw] Starting gateway..."

# Runtime data (device pairings, sessions, keys) must survive redeployments.
# The Railway Volume is mounted at /data/.openclaw — symlink /root/.openclaw
# there so all OpenClaw reads/writes go to persistent storage.
mkdir -p /data/.openclaw/workspaces

if [ -L /root/.openclaw ]; then
  echo "[OpenClaw] /root/.openclaw already symlinked to volume"
elif [ -d /root/.openclaw ]; then
  # First run after this change: merge any existing ephemeral data then symlink
  cp -rn /root/.openclaw/. /data/.openclaw/ 2>/dev/null || true
  rm -rf /root/.openclaw
  ln -s /data/.openclaw /root/.openclaw
else
  ln -s /data/.openclaw /root/.openclaw
fi

echo "[OpenClaw] Writing fresh config to volume (/data/.openclaw/) ..."

# Always overwrite only the config file — never wipe runtime data (devices, etc.)
sed \
  -e "s|\${ANTHROPIC_API_KEY}|${ANTHROPIC_API_KEY}|g" \
  -e "s|\${OPENCLAW_GATEWAY_TOKEN}|${OPENCLAW_GATEWAY_TOKEN}|g" \
  -e "s|\${MISSION_CONTROL_ORIGIN}|${MISSION_CONTROL_ORIGIN:-*}|g" \
  /app/config/openclaw.json > /data/.openclaw/openclaw.json

cp -r /app/config/workspaces/. /data/.openclaw/workspaces/

echo "[OpenClaw] Config ready at /data/.openclaw/openclaw.json"
echo "[OpenClaw] Launching gateway on port 18789..."

exec openclaw gateway --port 18789 --verbose
