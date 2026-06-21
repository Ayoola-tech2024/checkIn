#!/bin/bash
# Dev server watchdog — restarts Next.js on port 3000 if it's not responding.
cd /home/z/my-project

if curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3000/ 2>/dev/null | grep -q 200; then
  # Server healthy — nothing to do.
  exit 0
fi

# Server is down — kill any stale process and restart.
pkill -f "next dev" 2>/dev/null
sleep 2

# Start in a fully detached session so it survives this script exiting.
setsid bash -c 'cd /home/z/my-project && exec node node_modules/.bin/next dev -p 3000' \
  > /home/z/my-project/dev.log 2>&1 < /dev/null &
disown

echo "[$(date)] Watchdog restarted dev server" >> /home/z/my-project/.zscripts/watchdog.log
