from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import exercises, goals, imports, programs, sessions, sleep, stats
from .seed import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="FootProg API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"], allow_headers=["*"],
)
for r in (exercises, goals, programs, sessions, sleep, stats, imports):
    app.include_router(r.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
