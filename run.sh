#!/usr/bin/env bash
# Serves the PASTELLA 84 workbench over HTTP so it opens in VS Code's Integrated Browser
# (click the printed http://localhost link in the terminal). Usage: ./run.sh [port]
set -euo pipefail
cd "$(dirname "$0")"

port="${1:-8084}"
while (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; do port=$((port + 1)); done

url="http://localhost:$port/index.html"
echo "PASTELLA 84 워크벤치"
echo "  Open Integrated Browser: $url"
echo "  CAD 출력(STEP/URDF/USDA): http://localhost:$port/cad/out/"
echo "  레퍼런스 이미지 수집: http://localhost:$port/refs.html"
# static files (UTF-8) + reference-image API, see tools/serve.py
echo "  종료: Ctrl+C"
exec python3 tools/serve.py "$port"
