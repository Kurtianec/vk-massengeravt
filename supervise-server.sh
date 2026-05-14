#!/bin/bash
cd /home/z/my-project
trap '' SIGTERM SIGINT SIGHUP
while true; do
  echo "[$(date)] Starting Next.js dev server..."
  NODE_OPTIONS="--max-old-space-size=1024" npx next dev --port 3000 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 5s..."
  sleep 5
done
