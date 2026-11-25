#!/usr/bin/env bash
# Lance backend (port 8000) + frontend (port 5173). Ctrl+C pour tout arrêter.
set -e
cd "$(dirname "$0")"
if [ ! -d backend/.venv ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -r backend/requirements.txt
fi
[ -d frontend/node_modules ] || (cd frontend && npm install)
(cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000) &
API=$!
trap "kill $API" EXIT
cd frontend && npm run dev
