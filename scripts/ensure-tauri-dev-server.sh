#!/usr/bin/env sh
set -eu

PORT="${COOPT_TAURI_DEV_PORT:-1420}"
HOST="${COOPT_TAURI_DEV_HOST:-127.0.0.1}"

if command -v lsof >/dev/null 2>&1; then
  if lsof -iTCP:"${PORT}" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
    echo "[tauri-dev] Reusing existing dev server on ${HOST}:${PORT}"
    exit 0
  fi
fi

exec npm run dev -- --host "${HOST}" --port "${PORT}" --strictPort