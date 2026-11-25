@echo off
REM Lance backend (port 8000) + frontend (port 5173) sous Windows
cd /d %~dp0
if not exist backend\.venv (
  python -m venv backend\.venv
  backend\.venv\Scripts\pip install -r backend\requirements.txt
)
if not exist frontend\node_modules (cd frontend && npm install && cd ..)
start "FootProg API" cmd /k "cd backend && .venv\Scripts\uvicorn app.main:app --reload --port 8000"
cd frontend && npm run dev
