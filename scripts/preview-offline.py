"""Local-only preview with external resources blocked for offline regression QA."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial

class OfflineHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Content-Security-Policy', "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'none'; object-src 'self' blob:; frame-src 'self' blob:")
        super().end_headers()

if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    print('Offline-resource QA: http://127.0.0.1:8766/ (external resources blocked)', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8766), partial(OfflineHandler, directory=str(root))).serve_forever()
