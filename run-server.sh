#!/bin/bash
cd /home/z/my-project
while true; do
  NODE_ENV=production bun .next/standalone/server.js >> server.log 2>&1
  echo "[$(date)] Server crashed, restarting in 3 seconds..." >> server.log
  sleep 3
done
