#!/bin/bash
# Check if Next.js dev server is running, restart if not
if ! curl -s -m 3 http://localhost:3000/api/auth/session > /dev/null 2>&1; then
  echo "[$(date)] Server down, restarting..." >> /home/z/my-project/server-monitor.log
  pkill -f "next dev" 2>/dev/null
  sleep 1
  cd /home/z/my-project
  nohup bun run dev >> /home/z/my-project/dev.log 2>&1 &
  disown
  echo "[$(date)] Server restart initiated" >> /home/z/my-project/server-monitor.log
fi

# Also ensure scheduler is running
if ! curl -s -m 3 http://localhost:3003/health > /dev/null 2>&1; then
  echo "[$(date)] Scheduler down, restarting..." >> /home/z/my-project/server-monitor.log
  cd /home/z/my-project/mini-services/scheduler
  nohup bun --hot index.ts >> /home/z/my-project/scheduler.log 2>&1 &
  disown
  echo "[$(date)] Scheduler restart initiated" >> /home/z/my-project/server-monitor.log
fi
