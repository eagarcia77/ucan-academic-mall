#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
pkill -f "node server.js" 2>/dev/null || true
nohup node server.js > /tmp/ucan-academic-mall.log 2>&1 &
echo $! > /tmp/ucan-academic-mall.pid
for i in {1..30}; do
  if node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    echo "UCAN Academic Mall disponible en el puerto 3000."
    exit 0
  fi
  sleep 1
done
echo "El servidor no respondió. Revise /tmp/ucan-academic-mall.log"
exit 1
