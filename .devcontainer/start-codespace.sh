#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Detiene cualquier servidor anterior, incluyendo ejecuciones directas y npm start.
if [[ -f /tmp/ucan-academic-mall.pid ]]; then
  kill "$(cat /tmp/ucan-academic-mall.pid)" 2>/dev/null || true
  rm -f /tmp/ucan-academic-mall.pid
fi
pkill -f "node .*server.js" 2>/dev/null || true

# npm start es obligatorio: precarga auth-compat-v287.js antes de server.js.
nohup npm start > /tmp/ucan-academic-mall.log 2>&1 &
echo $! > /tmp/ucan-academic-mall.pid

for i in {1..45}; do
  if node -e "fetch('http://127.0.0.1:3000/version').then(async r=>{if(!r.ok)process.exit(1);const v=await r.json();process.exit(v.version==='V287'?0:2)}).catch(()=>process.exit(1))"; then
    echo "UCAN Academic Mall V287 disponible en el puerto 3000."
    exit 0
  fi
  sleep 1
done

echo "El servidor V287 no respondió correctamente. Revise /tmp/ucan-academic-mall.log"
tail -n 80 /tmp/ucan-academic-mall.log 2>/dev/null || true
exit 1
