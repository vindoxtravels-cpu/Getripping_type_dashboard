#!/usr/bin/env python3
"""Checks the local helper (bridge/server.py): what it refuses to serve, who may call it, and that the
Claude sign-in plumbing works. It starts its own helper on a spare port with a stand-in for Claude Code,
so it never touches your real account. Edge speech is only checked if edge-tts is installed.

Run:  python3 tests/helper_check.py
"""
import base64
import importlib.util
import io
import json
import os
import socket
import stat
import subprocess
import sys
import tempfile
import time
import shutil
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FAILED = []


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def req(base, path, method="GET", headers=None, body=None):
    r = urllib.request.Request(base + path, method=method, headers=headers or {}, data=body)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read(), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)


def check(name, ok, detail=""):
    print(("ok   " if ok else "FAIL ") + name + ("" if ok else "  " + str(detail)))
    if not ok:
        FAILED.append(name)


def main():
    tmp = Path(tempfile.mkdtemp())
    flag = tmp / "signed_in"
    stub = tmp / "claude"
    stub.write_text(f"""#!/bin/bash
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  if [ -f "{flag}" ]; then echo '{{"loggedIn":true,"authMethod":"claude.ai","email":"stub@example.com"}}'; else echo '{{"loggedIn":false}}'; fi; exit 0; fi
if [ "$1" = "auth" ] && [ "$2" = "login" ]; then echo "visit https://claude.ai/oauth/authorize?stub=1"; sleep 1; touch "{flag}"; exit 0; fi
cat > "{tmp}/last_prompt"; echo "$@" > "{tmp}/last_args"; echo "${{ANTHROPIC_API_KEY:-none}}" > "{tmp}/last_key"; echo '{{"type":"result","is_error":false,"result":"stub answer"}}'
""")
    stub.chmod(stub.stat().st_mode | stat.S_IEXEC)
    port = free_port()
    env = dict(os.environ, PORT=str(port), CLAUDE_BIN=str(stub), ANTHROPIC_API_KEY="must-not-be-used")
    proc = subprocess.Popen([sys.executable, str(ROOT / "bridge" / "server.py")], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f"http://localhost:{port}"
    try:
        for _ in range(40):
            try:
                req(base, "/"); break
            except Exception:  # noqa: BLE001
                time.sleep(0.25)
        for p in ("/bridge/server.py", "/tests/helper_check.py", "/.git/config", "/.gitignore", "/reference/ref-1.png"):
            check(f"does not serve {p}", req(base, p)[0] == 404)
        check("serves the app", req(base, "/")[0] == 200 and req(base, "/app.js")[0] == 200)
        check("blocks a wrong Host header", req(base, "/api/session", headers={"Host": "evil.example:1"})[0] == 403)
        check("blocks another site's Origin", req(base, "/api/session", headers={"Origin": "https://evil.example"})[0] == 403)
        check("blocks Sec-Fetch-Site: cross-site", req(base, "/api/session", headers={"Sec-Fetch-Site": "cross-site"})[0] == 403)
        check("API without a token is refused", req(base, "/api/claude/status")[0] == 401)
        check("API with a wrong token is refused", req(base, "/api/claude/status", headers={"X-Studio-Token": "nope"})[0] == 401)
        check("ask without a token is refused", req(base, "/api/claude/ask", "POST", {"Content-Type": "application/json"}, b'{"user":"hi"}')[0] == 401)
        st, body, _ = req(base, "/api/session", headers={"Sec-Fetch-Site": "same-origin"})
        sess = json.loads(body)
        check("same-origin session works", st == 200 and sess.get("token"))
        H = {"X-Studio-Token": sess["token"], "Content-Type": "application/json"}
        j = json.loads(req(base, "/api/claude/status", headers=H)[1])
        check("reports signed out", j.get("installed") is True and j.get("loggedIn") is False, j)
        st, body, _ = req(base, "/api/claude/login", "POST", H, b"{}")
        lj = json.loads(body)
        check("starts sign-in and returns the link", st == 200 and lj.get("url", "").startswith("https://claude.ai/"), lj)
        time.sleep(1.8)
        check("reports signed in afterwards", json.loads(req(base, "/api/claude/status", headers=H)[1]).get("loggedIn") is True)
        st, body, _ = req(base, "/api/claude/ask", "POST", H, json.dumps({"system": "sys", "user": "my prompt", "model": "haiku"}).encode())
        check("ask returns Claude's text", st == 200 and json.loads(body).get("text") == "stub answer", body)
        args = (tmp / "last_args").read_text()
        check("ask turns every tool off", "--tools" in args, args)
        check("ask keeps the prompt out of the command line", "my prompt" not in args and (tmp / "last_prompt").read_text() == "my prompt")
        check("ask uses the account, not an API key from the environment", (tmp / "last_key").read_text().strip() == "none", (tmp / "last_key").read_text())
        check("rejects an unknown voice", req(base, "/api/tts/edge", "POST", H, b'{"text":"hi","voice":"../../x"}')[0] == 400)
        check("rejects a bad speed", req(base, "/api/tts/edge", "POST", H, b'{"text":"hi","voice":"en-US-AriaNeural","rate":"fast"}')[0] == 400)
        check("rejects an oversized request", req(base, "/api/claude/ask", "POST", H, b'{"user":"' + b"x" * 250000 + b'"}')[0] == 400)

        # ---- reel video analysis
        ff = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
        check("session reports ffmpeg and speech flags", "ffmpeg" in sess and "speech" in sess, sess)
        check("analyze without a token is refused", req(base, "/api/reel/analyze", "POST", {"Content-Type": "video/mp4"}, b"x")[0] == 401)
        check("analyze refuses addresses that are not Instagram's video servers",
              req(base, "/api/reel/analyze", "POST", H, b'{"url":"https://example.com/a.mp4"}')[0] == 400)
        check("analyze refuses plain http", req(base, "/api/reel/analyze", "POST", H, b'{"url":"http://x.fbcdn.net/a.mp4"}')[0] == 400)
        if sess.get("ffmpeg") and os.access(ff, os.X_OK):
            vid, jpg = tmp / "t.mp4", tmp / "f.jpg"
            subprocess.run([ff, "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=240x426:rate=25:duration=4", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono",
                            "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(vid)], check=True)
            subprocess.run([ff, "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=red:s=64x64:d=1", "-frames:v", "1", str(jpg)], check=True)
            st, body, _ = req(base, "/api/reel/analyze", "POST", dict(H, **{"Content-Type": "video/mp4"}), vid.read_bytes())
            a = json.loads(body)
            check("analyze cuts frames, with times and valid JPEGs", st == 200 and len(a.get("frames", [])) >= 2 and all(base64.b64decode(f["jpeg"])[:2] == b"\xff\xd8" for f in a["frames"]), a if st != 200 else len(a.get("frames", [])))
            check("analyze reports duration and audio", abs(a.get("duration", 0) - 4) < 0.6 and a.get("hasAudio") is True, {k: a.get(k) for k in ("duration", "hasAudio")})
            check("analyze returns a transcript object", isinstance(a.get("transcript"), (dict, type(None))))
            check("analyze rejects something that is not a video", req(base, "/api/reel/analyze", "POST", dict(H, **{"Content-Type": "video/mp4"}), b"hello")[0] == 400)
            img = base64.b64encode(jpg.read_bytes()).decode()
            st, body, _ = req(base, "/api/claude/vision", "POST", H, json.dumps({"system": "s", "user": "what is this", "images": [img], "model": "haiku"}).encode())
            check("vision returns Claude's text", st == 200 and json.loads(body).get("text") == "stub answer", body)
            sent = (tmp / "last_prompt").read_text()
            check("vision sends the frame to Claude as an image, with tools off", '"type": "image"' in sent and img[:40] in sent and "--tools" in (tmp / "last_args").read_text())
            check("vision refuses a bad frame list", req(base, "/api/claude/vision", "POST", H, b'{"user":"x","images":["not base64!"]}')[0] == 400)
            check("vision refuses no frames", req(base, "/api/claude/vision", "POST", H, b'{"user":"x","images":[]}')[0] == 400)
        else:
            print("skip frame cutting and vision (ffmpeg is not installed)")
        # ---- downloading your own reel: only from Instagram's video servers
        spec = importlib.util.spec_from_file_location("helper_server", ROOT / "bridge" / "server.py")
        srv = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(srv)

        class Fake:
            def __init__(self, data, url): self.b, self.u = io.BytesIO(data), url
            def read(self, n=-1): return self.b.read(n)
            def geturl(self): return self.u
            def __enter__(self): return self
            def __exit__(self, *a): return False

        real_urlopen = srv.urllib.request.urlopen

        def attempt(url, final, data, limit=None):
            srv.urllib.request.urlopen = lambda *a, **k: Fake(data, final)
            if limit: srv.MAX_VIDEO = limit
            dest = tmp / "dl.bin"
            if dest.exists(): dest.unlink()
            try:
                srv.download_cdn(url, dest); return dest.read_bytes()
            except RuntimeError as e:
                return str(e)
            finally:
                srv.MAX_VIDEO = 300 * 1024 * 1024
                srv.urllib.request.urlopen = real_urlopen
        check("download accepts Instagram's video servers", attempt("https://scontent-x.cdninstagram.com/v/a.mp4", "https://scontent-x.cdninstagram.com/v/a.mp4", b"VIDEO") == b"VIDEO")
        check("download accepts fbcdn", attempt("https://video.xx.fbcdn.net/a.mp4", "https://video.xx.fbcdn.net/a.mp4", b"V") == b"V")
        check("download refuses a look-alike host", "only downloads" in str(attempt("https://cdninstagram.com.evil.example/a.mp4", "https://cdninstagram.com.evil.example/a.mp4", b"V")))
        check("download refuses a redirect to another host", "only downloads" in str(attempt("https://a.fbcdn.net/a.mp4", "https://evil.example/a.mp4", b"V")))
        check("download refuses an oversized video", "too large" in str(attempt("https://a.fbcdn.net/a.mp4", "https://a.fbcdn.net/a.mp4", b"x" * 100, limit=10)))
        if sess.get("edge"):
            st, audio, hdr = req(base, "/api/tts/edge", "POST", H, b'{"text":"Testing one two.","voice":"en-US-AriaNeural","rate":"+0%"}')
            check("Edge speech returns audio", st == 200 and len(audio) > 2000 and hdr.get("Content-Type") == "audio/mpeg", (st, len(audio)))
        else:
            print("skip Edge speech (edge-tts is not installed)")
    finally:
        proc.terminate()
    print("\n%s" % ("all checks passed" if not FAILED else f"{len(FAILED)} failed: {FAILED}"))
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
