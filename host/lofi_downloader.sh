#!/bin/sh
SCRIPT_DIR="$(cd "$(dirname "$0")" >/dev/null 2>&1 && pwd)"
VENV_PY="$SCRIPT_DIR/venv/bin/python"
if [ -x "$VENV_PY" ]; then
  exec "$VENV_PY" "$SCRIPT_DIR/lofi_downloader.py" "$@"
fi
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:$PATH"
exec /usr/bin/env python3 "$SCRIPT_DIR/lofi_downloader.py" "$@"
