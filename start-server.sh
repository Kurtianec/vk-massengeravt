#!/bin/bash
cd /home/z/my-project
NODE_ENV=production
export HOSTNAME="0.0.0.0"
exec node .next/standalone/server.js
