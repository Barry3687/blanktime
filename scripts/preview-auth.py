"""Local QA against real Supabase Auth; never changes production config.

Before sign-in, explicitly allow http://127.0.0.1:8765/ in Supabase redirect
URLs. Remove that temporary allow-list entry after QA. No secret key needed.
"""
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = "http://127.0.0.1:8765/"


class AuthPreview(SimpleHTTPRequestHandler):
    def do_GET(self):
        if urlsplit(self.path).path == "/cloud/config.json":
            config = json.loads((ROOT / "cloud/config.json").read_text(encoding="utf-8"))
            config["redirectUrl"] = ORIGIN
            body = json.dumps(config).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, format, *args):
        # Auth redirects include one-time codes. Do not put query strings in
        # terminal output or saved access logs.
        if args and isinstance(args[0], str):
            request = args[0].split(" ")
            if len(request) >= 2:
                request[1] = urlsplit(request[1]).path
                args = (" ".join(request), *args[1:])
        super().log_message(format, *args)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8765), partial(AuthPreview, directory=str(ROOT)))
    print("Local Auth QA: " + ORIGIN, flush=True)
    print("Real Google sign-in; production config remains unchanged.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
