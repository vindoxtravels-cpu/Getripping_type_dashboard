#!/usr/bin/env python3
"""Reel Studio local helper.

Serves the app on http://localhost:5174 and adds two things a web page cannot do on its own:

  1. Claude through YOUR OWN signed-in Claude Code (no API key). Requests run the unmodified
     `claude` program on this machine with every tool disabled, so it can only answer text.
  2. Free neural text-to-speech from Microsoft Edge's read-aloud voices (the `edge-tts` package).

Everything stays on this machine. Only this app's own page can talk to it: requests must come from
localhost, from the same site, and carry a random token that changes every time the helper starts.
"""
import asyncio
import glob
import json
import os
import re
import secrets
import shutil
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

try:
    import edge_tts  # pip install edge-tts
except Exception:  # noqa: BLE001
    edge_tts = None

ROOT = Path(__file__).resolve().parent.parent
PORT = int(os.environ.get("PORT", "5174"))
TOKEN = secrets.token_urlsafe(24)
HOSTS = {f"localhost:{PORT}", f"127.0.0.1:{PORT}"}
ORIGINS = {f"http://{h}" for h in HOSTS}
MIME = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json"}
HIDDEN_DIRS = {"bridge", "tests", "node_modules", "reference"}
MAX_BODY = 200_000
CLAUDE_SLOTS = threading.Semaphore(2)


def clean_env():
    # sign-in mode must use the account, not a stray API key in the environment
    return {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}


def find_claude():
    env = os.environ.get("CLAUDE_BIN")
    if env and os.access(env, os.X_OK):
        return env
    found = shutil.which("claude")
    if found:
        return found
    bundled = glob.glob(str(Path.home() / "Library/Application Support/Claude/claude-code/*/*/claude.app/Contents/MacOS/claude"))
    if bundled:
        return max(bundled, key=os.path.getmtime)
    for c in (Path.home() / ".local/bin/claude", Path.home() / ".claude/local/claude", Path("/opt/homebrew/bin/claude"), Path("/usr/local/bin/claude")):
        if os.access(c, os.X_OK):
            return str(c)
    return None


def claude_status():
    b = find_claude()
    if not b:
        return {"installed": False}
    try:
        with tempfile.TemporaryDirectory() as cwd:
            r = subprocess.run([b, "auth", "status"], capture_output=True, text=True, timeout=25, cwd=cwd, env=clean_env())
        j = json.loads(r.stdout or "{}")
    except Exception as e:  # noqa: BLE001
        return {"installed": True, "loggedIn": False, "error": str(e)[:200]}
    return {"installed": True, "loggedIn": bool(j.get("loggedIn")), "method": j.get("authMethod"), "email": j.get("email")}


_login = {"proc": None, "lines": []}


def claude_login():
    """Starts Claude Code's own sign-in (it opens your browser). The page then polls claude_status()."""
    b = find_claude()
    if not b:
        raise RuntimeError("Claude Code is not installed on this computer.")
    p = _login["proc"]
    if p and p.poll() is None:
        return {"started": True, "url": next((m.group(0) for l in _login["lines"] for m in [re.search(r"https://\S+", l)] if m), None)}
    _login["lines"] = []
    p = subprocess.Popen([b, "auth", "login", "--claudeai"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                         text=True, cwd=tempfile.gettempdir(), env=clean_env())
    _login["proc"] = p

    def pump():
        for line in p.stdout:  # type: ignore[union-attr]
            _login["lines"].append(line.strip())
            del _login["lines"][:-50]
    threading.Thread(target=pump, daemon=True).start()
    for _ in range(16):  # up to ~4 s for the sign-in link to be printed
        time.sleep(0.25)
        if any("https://" in l for l in _login["lines"]):
            break
    return {"started": True, "url": next((m.group(0) for l in _login["lines"] for m in [re.search(r"https://\S+", l)] if m), None)}


def claude_ask(system, user, model):
    b = find_claude()
    if not b:
        raise RuntimeError("Claude Code is not installed on this computer.")
    alias = model if model in ("sonnet", "haiku", "opus") else "sonnet"
    cmd = [b, "-p", "--output-format", "json", "--no-session-persistence", "--disable-slash-commands", "--strict-mcp-config",
           "--system-prompt", system or "You are a helpful assistant.", "--model", alias, "--tools", ""]
    if not CLAUDE_SLOTS.acquire(timeout=5):
        raise RuntimeError("Claude is busy with another request. Try again in a moment.")
    try:
        with tempfile.TemporaryDirectory() as cwd:  # empty folder: nothing for Claude to read
            r = subprocess.run(cmd, input=user, capture_output=True, text=True, timeout=180, cwd=cwd, env=clean_env())
    except subprocess.TimeoutExpired:
        raise RuntimeError("Claude took too long to answer. Try again.")
    finally:
        CLAUDE_SLOTS.release()
    out = (r.stdout or "").strip()
    try:
        j = json.loads(out)
    except Exception:  # noqa: BLE001
        raise RuntimeError((r.stderr or out or "Claude Code returned nothing.")[:300])
    if j.get("is_error"):
        msg = str(j.get("result") or "Claude Code reported an error.")
        if re.search(r"login|auth|sign", msg, re.I):
            msg = "Claude Code is not signed in. Use Sign in with Claude in the app."
        raise RuntimeError(msg[:300])
    return str(j.get("result", ""))


_voices = {"t": 0.0, "v": None}


def edge_voices():
    if not edge_tts:
        raise RuntimeError("Edge voices need the edge-tts package. Start the helper with ./bridge/start.sh and it installs it.")
    if _voices["v"] and time.time() - _voices["t"] < 3600:
        return _voices["v"]
    raw = asyncio.run(edge_tts.list_voices())
    _voices["v"] = [{"id": x["ShortName"], "name": (x.get("FriendlyName") or x["ShortName"]).replace("Microsoft ", ""), "locale": x["Locale"], "gender": x["Gender"]} for x in raw]
    _voices["t"] = time.time()
    return _voices["v"]


async def _synth(text, voice, rate, pitch):
    comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    buf = bytearray()
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            buf.extend(chunk["data"])
    return bytes(buf)


def edge_speak(text, voice, rate, pitch):
    if not edge_tts:
        raise RuntimeError("Edge voices need the edge-tts package. Start the helper with ./bridge/start.sh and it installs it.")
    if not re.fullmatch(r"[\w-]{3,60}", voice or ""):
        raise RuntimeError("Unknown voice.")
    if not re.fullmatch(r"[+-]\d{1,3}%", rate or "+0%"):
        raise RuntimeError("Bad speed.")
    if not re.fullmatch(r"[+-]\d{1,3}Hz", pitch or "+0Hz"):
        raise RuntimeError("Bad pitch.")
    text = (text or "").strip()
    if not text or len(text) > 4000:
        raise RuntimeError("Text must be 1 to 4000 characters.")
    audio = asyncio.run(_synth(text, voice, rate or "+0%", pitch or "+0Hz"))
    if not audio:
        raise RuntimeError("Edge returned no audio. Check the voice name and your connection.")
    return audio


class Handler(BaseHTTPRequestHandler):
    server_version = "ReelStudioHelper"

    def log_message(self, fmt, *args):  # keep the terminal quiet; errors are printed explicitly
        pass

    # ---- plumbing
    def _send(self, code, data, ctype, cache="no-store"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def _json(self, code, obj):
        self._send(code, json.dumps(obj).encode(), "application/json")

    def _guard(self, need_token=True):
        if self.headers.get("Host", "") not in HOSTS:
            self._json(403, {"error": "Wrong host."}); return False
        o = self.headers.get("Origin")
        if o and o not in ORIGINS:
            self._json(403, {"error": "Only this app can use the helper."}); return False
        site = self.headers.get("Sec-Fetch-Site")
        if site and site not in ("same-origin", "none"):
            self._json(403, {"error": "Only this app can use the helper."}); return False
        if need_token and not secrets.compare_digest(self.headers.get("X-Studio-Token", ""), TOKEN):
            self._json(401, {"error": "Missing or wrong helper token. Reload the page."}); return False
        return True

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            raise RuntimeError("Request too large.")
        return json.loads(self.rfile.read(n) or b"{}")

    # ---- routes
    def do_GET(self):
        path = urlparse(self.path).path
        if path.startswith("/api/"):
            return self._api_get(path)
        if self.headers.get("Host", "") not in HOSTS:
            return self._json(403, {"error": "Wrong host."})
        rel = unquote(path).lstrip("/") or "index.html"
        target = (ROOT / rel).resolve()
        parts = target.relative_to(ROOT).parts if ROOT in target.parents or target == ROOT else None
        if parts is None or not target.is_file() or any(p.startswith(".") for p in parts) or parts[0] in HIDDEN_DIRS or target.suffix not in MIME:
            return self._json(404, {"error": "Not found."})
        self._send(200, target.read_bytes(), MIME[target.suffix])

    def do_POST(self):
        path = urlparse(self.path).path
        if not path.startswith("/api/"):
            return self._json(404, {"error": "Not found."})
        if not self._guard():
            return
        try:
            body = self._body()
            if path == "/api/claude/ask":
                user = str(body.get("user", ""))
                if not user or len(user) > 30000:
                    raise RuntimeError("Prompt must be 1 to 30000 characters.")
                return self._json(200, {"text": claude_ask(str(body.get("system", ""))[:4000], user, str(body.get("model", "sonnet")))})
            if path == "/api/claude/login":
                return self._json(200, claude_login())
            if path == "/api/tts/edge":
                audio = edge_speak(body.get("text"), body.get("voice"), body.get("rate", "+0%"), body.get("pitch", "+0Hz"))
                return self._send(200, audio, "audio/mpeg")
            return self._json(404, {"error": "Not found."})
        except Exception as e:  # noqa: BLE001
            print(f"[helper] {path}: {e}")
            return self._json(400, {"error": str(e)[:400]})

    def _api_get(self, path):
        if not self._guard(need_token=(path != "/api/session")):
            return
        try:
            if path == "/api/session":
                return self._json(200, {"token": TOKEN, "edge": bool(edge_tts), "claudeInstalled": bool(find_claude())})
            if path == "/api/claude/status":
                return self._json(200, claude_status())
            if path == "/api/tts/voices":
                return self._json(200, {"voices": edge_voices()})
            return self._json(404, {"error": "Not found."})
        except Exception as e:  # noqa: BLE001
            print(f"[helper] {path}: {e}")
            return self._json(400, {"error": str(e)[:400]})


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    c = find_claude()
    print(f"\n  Reel Studio helper is running.\n\n  Open  http://localhost:{PORT}\n")
    print(f"  Claude Code : {'found' if c else 'not found (install it to use Sign in with Claude)'}")
    print(f"  Edge voices : {'ready' if edge_tts else 'missing, run ./bridge/start.sh to install'}")
    print("\n  Press Ctrl+C to stop.\n")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")
