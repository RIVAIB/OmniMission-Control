#!/bin/sh
set -e

# Fix ownership of Railway Volume mount — the volume is owned by root when mounted
# but the app runs as nextjs (uid 1001). chown here (as root) before exec'ing the app.
DATA_DIR="${MISSION_CONTROL_DATA_DIR:-/app/data}"
mkdir -p "$DATA_DIR"
chown -R nextjs:nodejs "$DATA_DIR" 2>/dev/null || true

exec su-exec nextjs node server.js
