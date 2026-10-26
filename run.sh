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
echo "  종료: Ctrl+C"
# UTF-8 for every text type (the UI is Korean), proper types for the CAD outputs
exec python3 -c '
import http.server, sys
H = http.server.SimpleHTTPRequestHandler
H.extensions_map = {**H.extensions_map, **{e: t + "; charset=utf-8" for e, t in {
    ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".md": "text/markdown",
    ".csv": "text/csv", ".urdf": "application/xml", ".usda": "text/plain", ".qasm": "text/plain", ".cir": "text/plain"}.items()},
    ".glb": "model/gltf-binary", ".step": "model/step", ".stl": "model/stl"}
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
' "$port"
