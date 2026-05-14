#!/bin/bash
cd /home/z/my-project/.next/standalone
trap '' SIGTERM SIGINT SIGHUP
while true; do
  echo "[$(date)] Starting production server..."
  NODE_OPTIONS="--max-old-space-size=1024" PORT=3000 HOSTNAME=0.0.0.0 NODE_ENV=production node server.js 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 3s..."
  sleep 3
done
