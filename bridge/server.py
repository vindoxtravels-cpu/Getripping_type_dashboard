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
import base64
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
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

try:
    import edge_tts  # pip install edge-tts
except Exception:  # noqa: BLE001
    edge_tts = None
try:  # optional: speech-to-text for reels (./bridge/start.sh --speech installs it)
    import numpy as np
    from faster_whisper import WhisperModel
except Exception:  # noqa: BLE001
    np = None
    WhisperModel = None

ROOT = Path(__file__).resolve().parent.parent
PORT = int(os.environ.get("PORT", "5174"))
TOKEN = secrets.token_urlsafe(24)
HOSTS = {f"localhost:{PORT}", f"127.0.0.1:{PORT}"}
ORIGINS = {f"http://{h}" for h in HOSTS}
MIME = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json"}
HIDDEN_DIRS = {"bridge", "tests", "node_modules", "reference"}
HIDDEN_FILES = set()
MAX_BODY = 200_000
MAX_VISION = 25_000_000          # frames sent to Claude
MAX_VIDEO = 300 * 1024 * 1024    # a reel video
CDN_SUFFIXES = (".fbcdn.net", ".cdninstagram.com")  # the only hosts the helper will download a reel from
CLAUDE_SLOTS = threading.Semaphore(2)
ANALYZE_SLOT = threading.Semaphore(1)


def _find_tool(name):
    return shutil.which(name) or next((p for p in (f"/opt/homebrew/bin/{name}", f"/usr/local/bin/{name}") if os.access(p, os.X_OK)), None)


FFMPEG, FFPROBE = _find_tool("ffmpeg"), _find_tool("ffprobe")


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


def claude_vision(system, text, images, model):
    """Claude looks at frames. Images go in as message content, so every tool can stay switched off."""
    b = find_claude()
    if not b:
        raise RuntimeError("Claude Code is not installed on this computer.")
    if not isinstance(images, list) or not 1 <= len(images) <= 40 or not all(isinstance(i, str) and re.fullmatch(r"[A-Za-z0-9+/=]{20,600000}", i) for i in images):
        raise RuntimeError("Send 1 to 40 JPEG frames.")
    alias = model if model in ("sonnet", "haiku", "opus") else "sonnet"
    content = [{"type": "text", "text": text}] + [{"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": i}} for i in images]
    msg = json.dumps({"type": "user", "message": {"role": "user", "content": content}}) + "\n"
    cmd = [b, "-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--no-session-persistence", "--disable-slash-commands",
           "--strict-mcp-config", "--system-prompt", system or "You are a helpful assistant.", "--model", alias, "--tools", ""]
    if not CLAUDE_SLOTS.acquire(timeout=5):
        raise RuntimeError("Claude is busy with another request. Try again in a moment.")
    try:
        with tempfile.TemporaryDirectory() as cwd:
            r = subprocess.run(cmd, input=msg, capture_output=True, text=True, timeout=300, cwd=cwd, env=clean_env())
    except subprocess.TimeoutExpired:
        raise RuntimeError("Claude took too long to look at the video. Try again.")
    finally:
        CLAUDE_SLOTS.release()
    result = None
    for line in (r.stdout or "").splitlines():
        try:
            j = json.loads(line)
        except Exception:  # noqa: BLE001
            continue
        if j.get("type") == "result":
            result = j
    if not result:
        raise RuntimeError((r.stderr or "Claude Code returned nothing.")[:300])
    if result.get("is_error"):
        msg = str(result.get("result") or "Claude Code reported an error.")
        if re.search(r"login|auth|sign", msg, re.I):
            msg = "Claude Code is not signed in. Use Sign in with Claude in the app."
        raise RuntimeError(msg[:300])
    return str(result.get("result", ""))


def probe_video(path):
    r = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", path], capture_output=True, text=True, timeout=60)
    j = json.loads(r.stdout or "{}")
    streams = j.get("streams") or []
    dur = float((j.get("format") or {}).get("duration") or 0)
    return {"duration": dur, "hasVideo": any(x.get("codec_type") == "video" for x in streams), "hasAudio": any(x.get("codec_type") == "audio" for x in streams)}


def cut_frames(path, duration, out_dir, max_frames=30):
    """Frames at every scene change, plus evenly spaced ones so slow scenes are covered too."""
    gap = max(1.5, duration / 14)
    vf = f"select='isnan(prev_selected_t)+gt(scene,0.22)+gte(t-prev_selected_t,{gap:.2f})',scale=480:-2,showinfo"
    last = None
    for mode in (["-fps_mode", "vfr"], ["-vsync", "vfr"]):  # the flag was renamed in newer ffmpeg
        for f in out_dir.glob("f_*.jpg"):
            f.unlink()
        last = subprocess.run([FFMPEG, "-v", "info", "-i", path, "-an", "-vf", vf, *mode, "-q:v", "4", "-frames:v", str(max_frames), str(out_dir / "f_%03d.jpg")],
                              capture_output=True, text=True, timeout=240)
        if last.returncode == 0:
            break
    if last is None or last.returncode != 0:
        raise RuntimeError("ffmpeg could not read this video.")
    times = [float(m.group(1)) for m in re.finditer(r"pts_time:([\d.]+)", last.stderr)]
    files = sorted(out_dir.glob("f_*.jpg"))
    return [{"t": round(times[i] if i < len(times) else 0.0, 2), "jpeg": base64.b64encode(f.read_bytes()).decode()} for i, f in enumerate(files)]


_whisper = {"model": None, "lock": threading.Lock()}


def transcribe(path):
    """Local speech-to-text. ffmpeg decodes the audio, so no extra audio library is needed."""
    if not WhisperModel:
        return None
    raw = subprocess.run([FFMPEG, "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, timeout=300).stdout
    if len(raw) < 16000 * 4 // 2:
        return {"segments": [], "language": None}
    audio = np.frombuffer(raw, dtype=np.float32)
    with _whisper["lock"]:
        if _whisper["model"] is None:
            _whisper["model"] = WhisperModel("base", device="cpu", compute_type="int8")
        segs, info = _whisper["model"].transcribe(audio, vad_filter=True)
        out = [{"start": round(x.start, 1), "end": round(x.end, 1), "text": x.text.strip()} for x in segs]
    return {"segments": out, "language": info.language}


def download_cdn(url, dest):
    u = urlparse(url)
    if u.scheme != "https" or not (u.hostname or "").endswith(CDN_SUFFIXES):
        raise RuntimeError("The helper only downloads videos from Instagram's own servers.")
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60) as r:
        if not (urlparse(r.geturl()).hostname or "").endswith(CDN_SUFFIXES):
            raise RuntimeError("The helper only downloads videos from Instagram's own servers.")
        size = 0
        with open(dest, "wb") as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_VIDEO:
                    raise RuntimeError("That video is too large.")
                f.write(chunk)


def analyze_video(video_path, work_dir):
    if not FFMPEG or not FFPROBE:
        raise RuntimeError("Video analysis needs ffmpeg. Install it with: brew install ffmpeg")
    info = probe_video(video_path)
    if not info["hasVideo"] or info["duration"] <= 0:
        raise RuntimeError("That file does not look like a video.")
    if info["duration"] > 600:
        raise RuntimeError("That video is longer than 10 minutes. Trim it to the reel first.")
    if not ANALYZE_SLOT.acquire(timeout=5):
        raise RuntimeError("Another video is being analyzed. Try again in a moment.")
    try:
        frames = cut_frames(video_path, info["duration"], work_dir)
        speech = transcribe(video_path) if info["hasAudio"] else {"segments": [], "language": None}
    finally:
        ANALYZE_SLOT.release()
    if not frames:
        raise RuntimeError("No frames could be cut from that video.")
    return {"duration": round(info["duration"], 1), "hasAudio": info["hasAudio"], "frames": frames, "transcript": speech, "speechAvailable": bool(WhisperModel)}


_voices = {"t": 0.0, "v": None}


OAUTH_UP = {"register": "https://login.composio.dev/oauth2/register", "token": "https://login.composio.dev/oauth2/token"}
TOKEN_FIELDS = ("grant_type", "code", "redirect_uri", "client_id", "code_verifier", "refresh_token")


def oauth_relay(kind, raw, origin):
    """Composio's sign-in server doesn't let browsers read its replies, so the two sign-in calls go through here.
    No secret or API key is involved: a fixed set of fields goes to one fixed address."""
    from urllib.parse import parse_qs, urlencode
    if kind == "register":
        b = json.loads(raw or b"{}")
        uris = b.get("redirect_uris") or []
        if not uris or not all(str(u).startswith(origin + "/") for u in uris):
            raise RuntimeError("Redirect addresses must be on this site.")
        data = json.dumps({"client_name": str(b.get("client_name", "Reel Studio"))[:60], "redirect_uris": uris,
                           "grant_types": ["authorization_code", "refresh_token"], "response_types": ["code"],
                           "token_endpoint_auth_method": "none"}).encode()
        ctype = "application/json"
    elif kind == "token":
        q = parse_qs(raw.decode())
        out = {k: q[k][0] for k in TOKEN_FIELDS if k in q}
        if out.get("grant_type") not in ("authorization_code", "refresh_token"):
            raise RuntimeError("unsupported_grant_type")
        if "redirect_uri" in out and not out["redirect_uri"].startswith(origin + "/"):
            raise RuntimeError("Redirect address must be on this site.")
        data = urlencode(out).encode()
        ctype = "application/x-www-form-urlencoded"
    else:
        raise RuntimeError("Not found.")
    req = urllib.request.Request(OAUTH_UP[kind], data=data, method="POST", headers={"content-type": ctype, "user-agent": "reel-studio-helper"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


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
        try:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", cache)
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass  # the page was reloaded or closed before the reply arrived: nothing to report

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

    def _body(self, limit=MAX_BODY):
        n = int(self.headers.get("Content-Length") or 0)
        if n > limit:
            raise RuntimeError("Request too large.")
        return json.loads(self.rfile.read(n) or b"{}")

    def _save_upload(self, dest):
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > MAX_VIDEO:
            raise RuntimeError("Send a video file up to 300 MB.")
        left = n
        with open(dest, "wb") as f:
            while left > 0:
                chunk = self.rfile.read(min(1 << 20, left))
                if not chunk:
                    break
                f.write(chunk)
                left -= len(chunk)

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
        if parts is None or not target.is_file() or any(p.startswith(".") for p in parts) or parts[0] in HIDDEN_DIRS or parts[-1] in HIDDEN_FILES or target.suffix not in MIME:
            return self._json(404, {"error": "Not found."})
        self._send(200, target.read_bytes(), MIME[target.suffix])

    def do_POST(self):
        path = urlparse(self.path).path
        if not path.startswith("/api/"):
            return self._json(404, {"error": "Not found."})
        if not self._guard():
            return
        try:
            if path == "/api/reel/analyze":
                with tempfile.TemporaryDirectory() as td:
                    td = Path(td)
                    video = td / "in.video"
                    if self.headers.get("Content-Type", "").startswith("application/json"):
                        download_cdn(str(self._body().get("url", "")), video)
                    else:
                        self._save_upload(video)
                    return self._json(200, analyze_video(str(video), td))
            if path == "/api/claude/vision":
                b = self._body(MAX_VISION)
                text = str(b.get("user", ""))
                if not text or len(text) > 30000:
                    raise RuntimeError("Prompt must be 1 to 30000 characters.")
                return self._json(200, {"text": claude_vision(str(b.get("system", ""))[:4000], text, b.get("images"), str(b.get("model", "sonnet")))})
            if path.startswith("/api/oauth/"):
                n = int(self.headers.get("Content-Length") or 0)
                if n > 4000:
                    raise RuntimeError("Request too large.")
                code, data = oauth_relay(path[len("/api/oauth/"):], self.rfile.read(n), f"http://{self.headers.get('Host')}")
                return self._send(code, data, "application/json")
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
                return self._json(200, {"token": TOKEN, "edge": bool(edge_tts), "claudeInstalled": bool(find_claude()), "ffmpeg": bool(FFMPEG and FFPROBE), "speech": bool(WhisperModel)})
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
    print(f"  Video frames: {'ready (ffmpeg)' if FFMPEG and FFPROBE else 'needs ffmpeg: brew install ffmpeg'}")
    print(f"  Speech text : {'ready' if WhisperModel else 'off, run ./bridge/start.sh --speech to add it'}")
    print("\n  Press Ctrl+C to stop.\n")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")
