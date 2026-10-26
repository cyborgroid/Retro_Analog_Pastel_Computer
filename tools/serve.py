#!/usr/bin/env python3
"""Local server for the workbench (./run.sh): static files with UTF-8, plus the reference-image API.

  POST /api/refs          collector batches from the browser (tools/refs/collect.js) -> references/inbox/
  GET  /api/refs/status   inbox / download / analysis counts
  POST /api/refs/ingest   start tools/refs/ingest.py in the background (download from the original sites + analyse)

The collector runs in the user's own browser on a page they opened; this server never queries a search engine.
"""
import http.server, json, os, subprocess, sys, threading, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REFS = os.path.join(ROOT, 'references')
INBOX = os.path.join(REFS, 'inbox')
INGEST = {'proc': None}

H = http.server.SimpleHTTPRequestHandler
H.extensions_map = {**H.extensions_map, **{e: t + '; charset=utf-8' for e, t in {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown',
    '.csv': 'text/csv', '.urdf': 'application/xml', '.usda': 'text/plain', '.qasm': 'text/plain', '.cir': 'text/plain', '.dxf': 'text/plain'}.items()},
    '.glb': 'model/gltf-binary', '.step': 'model/step', '.stl': 'model/stl'}


def status():
    def count(path):
        try: return json.load(open(path))
        except Exception: return None
    files = sorted(f for f in os.listdir(INBOX) if f.endswith('.json')) if os.path.isdir(INBOX) else []
    items = 0
    for f in files:
        try: items += len(json.load(open(os.path.join(INBOX, f))).get('items', []))
        except Exception: pass
    st = count(os.path.join(REFS, 'ingest-status.json')) or {}
    st.update(inbox_files=len(files), inbox_items=items, running=bool(INGEST['proc'] and INGEST['proc'].poll() is None))
    return st


class Handler(H):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)

    def log_message(self, fmt, *args):
        if '/api/' in (args[0] if args else ''): sys.stderr.write('%s\n' % (fmt % args))

    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Private-Network', 'true')

    def reply(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code); self.cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8'); self.send_header('Content-Length', str(len(body)))
        self.end_headers(); self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204); self.cors(); self.end_headers()

    def do_GET(self):
        if self.path.startswith('/api/refs/status'): return self.reply(200, status())
        return super().do_GET()

    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n > 200 * 1024 * 1024: return self.reply(413, {'error': 'too large'})
        raw = self.rfile.read(n)
        if self.path.startswith('/api/refs/ingest'):
            if INGEST['proc'] and INGEST['proc'].poll() is None: return self.reply(409, {'error': '이미 실행 중'})
            INGEST['proc'] = subprocess.Popen([sys.executable, os.path.join(ROOT, 'tools', 'refs', 'ingest.py')], cwd=ROOT)
            return self.reply(202, {'started': True})
        if self.path.startswith('/api/refs'):
            try:
                data = json.loads(raw.decode('utf-8'))
                items = data.get('items')
                if not isinstance(items, list): raise ValueError('items missing')
            except Exception as e:
                return self.reply(400, {'error': str(e)})
            os.makedirs(INBOX, exist_ok=True)
            name = time.strftime('%Y%m%d-%H%M%S') + '-%04d.json' % (threading.get_ident() % 10000)
            json.dump({'query': data.get('query'), 'page': data.get('page'), 'received': time.time(), 'items': items},
                      open(os.path.join(INBOX, name), 'w'), ensure_ascii=False)
            return self.reply(200, {'saved': name, 'items': len(items), **status()})
        return self.reply(404, {'error': 'unknown endpoint'})


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8084
    http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
