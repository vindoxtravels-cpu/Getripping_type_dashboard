#!/bin/sh
# Starts the Reel Studio helper (serves the app and enables Sign in with Claude and Edge voices).
# Installs the free edge-tts package into bridge/.venv the first time if it is not already available.
cd "$(dirname "$0")" || exit 1
PY=python3
if ! "$PY" -c "import edge_tts" 2>/dev/null; then
  echo "Installing the edge-tts voice package (one time)..."
  [ -d .venv ] || python3 -m venv .venv || { echo "Could not create a Python virtual environment."; exit 1; }
  .venv/bin/pip install --quiet edge-tts || { echo "Could not install edge-tts. Edge voices will be unavailable."; }
  PY=.venv/bin/python
fi
exec "$PY" server.py "$@"
