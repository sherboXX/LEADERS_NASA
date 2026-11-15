"""Local server for Freefall.

Serves the site on http://127.0.0.1:8765/ and, when an OpenAI key is available on this
computer, answers POST /api/ask so the key never has to be pasted into the browser.

Where the key is read from (first one found):
  1. the environment variable OPENAI_API_KEY
  2. the file firelab/.openai-key (one line; it is never served and is git-ignored)
With no key the site still works: the guide falls back to its built-in answers, or uses a
key pasted into Settings.

Run:  python tools/serve.py [port]
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
OPENAI = "https://api.openai.com/v1/chat/completions"


def api_key():
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    path = ROOT / ".openai-key"
    if not key and path.exists():
        key = path.read_text(encoding="utf-8").strip()
    return key


class Handler(SimpleHTTPRequestHandler):
    def reply(self, status, payload):
        data = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def hidden(self):
        """Dot-files (the key file among them) are never served."""
        return any(part.startswith(".") for part in self.path.split("?")[0].split("/") if part)

    def do_GET(self):
        if self.hidden():
            self.send_error(404)
        elif not (self.headers.get("Range") and self.ranged()):
            super().do_GET()

    def ranged(self):
        """Answer 'Range: bytes=a-b' with 206 so audio and video can seek (the background music
        resumes where it left off on the next page). False means: send the whole file instead."""
        path = Path(self.translate_path(self.path))
        m = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers["Range"].strip())
        if not path.is_file() or not m or not (m[1] or m[2]):
            return False
        size = path.stat().st_size
        start, end = (int(m[1]), int(m[2]) if m[2] else size - 1) if m[1] else (max(size - int(m[2]), 0), size - 1)
        if start >= size:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return True
        end = min(end, size - 1)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(str(path)))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        try:
            with open(path, "rb") as f:
                f.seek(start)
                left = end - start + 1
                while left > 0:
                    chunk = f.read(min(65536, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
        except ConnectionError:
            pass  # the browser cancelled this range, as media players often do
        return True

    def do_HEAD(self):
        if self.hidden():
            self.send_error(404)
        else:
            super().do_HEAD()

    def do_POST(self):
        if self.path != "/api/ask":
            self.send_error(404)
            return
        key = api_key()
        if not key:
            self.reply(503, {"error": "no OpenAI key on this computer"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        if not 0 < length <= 200_000:
            self.reply(413, {"error": "request too large"})
            return
        request = urllib.request.Request(OPENAI, data=self.rfile.read(length), headers={
            "Content-Type": "application/json", "Authorization": "Bearer " + key})
        try:
            with urllib.request.urlopen(request, timeout=90) as res:
                self.reply(res.status, res.read())
        except urllib.error.HTTPError as err:
            self.reply(err.code, err.read())
        except Exception as err:  # network down, timeout
            self.reply(502, {"error": str(err)})

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), partial(Handler, directory=str(ROOT)))
    print(f"Freefall is at http://127.0.0.1:{PORT}/   (AI key on this computer: {'yes' if api_key() else 'no'})")
    print("Close this window to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
