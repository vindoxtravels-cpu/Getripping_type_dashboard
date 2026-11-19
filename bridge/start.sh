#!/bin/sh
# Starts the Reel Studio helper (serves the app; enables Sign in with Claude, Edge voices and reel video analysis).
#   ./bridge/start.sh            start the helper
#   ./bridge/start.sh --speech   also install local speech-to-text (about 190 MB, one time) so reels can be transcribed
# Packages go into bridge/.venv, never into your system Python.
cd "$(dirname "$0")" || exit 1
SPEECH=0
[ "$1" = "--speech" ] && { SPEECH=1; shift; }
PY=python3
# optional local secrets, e.g. COMPOSIO_API_KEY=ck_... (kept out of git)
[ -f .env ] && { set -a; . ./.env; set +a; }
[ -x .venv/bin/python ] && PY=.venv/bin/python
need_venv() { [ -d .venv ] || python3 -m venv --system-site-packages .venv || { echo "Could not create a Python virtual environment."; exit 1; }; PY=.venv/bin/python; }
if ! "$PY" -c "import edge_tts" 2>/dev/null; then
  echo "Installing the edge-tts voice package (one time)..."
  need_venv
  .venv/bin/pip install --quiet edge-tts || echo "Could not install edge-tts. Edge voices will be unavailable."
fi
if [ "$SPEECH" = "1" ] && ! "$PY" -c "import faster_whisper" 2>/dev/null; then
  echo "Installing local speech-to-text (one time, a few minutes)..."
  need_venv
  .venv/bin/pip install --quiet faster-whisper || echo "Could not install faster-whisper. Reels will not be transcribed."
fi
exec "$PY" server.py "$@"
