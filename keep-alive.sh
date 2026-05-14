#!/bin/bash
while true; do
  cd /home/z/my-project
  NODE_ENV=production node .next/standalone/server.js
  echo "Server died, restarting in 2 seconds..." >> /home/z/my-project/server-restart.log
  sleep 2
done
