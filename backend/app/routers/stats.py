from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Goal
from ..services import stats as S
from .goals import to_out as goal_out

router = APIRouter(prefix="/api/stats", tags=["statistiques"])


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    today = date.today()
    wk_start = S.monday(today)
    week = S.weekly_stats(db, weeks=2)
    plan_today = S.planned_sessions(db, today, today)
    plan_week = S.planned_sessions(db, wk_start, wk_start + timedelta(days=6))
    nights = S.sleep_between(db, today - timedelta(days=6), today)
    goals = [goal_out(db, g) for g in db.scalars(select(Goal).where(Goal.status == "active"))]
    # série de jours consécutifs avec au moins une séance
    streak, d = 0, today
    done_dates = {s.date for s in S.sessions_between(db, today - timedelta(days=60), today)}
    if today not in done_dates:
        d -= timedelta(days=1)
    while d in done_dates:
        streak += 1
        d -= timedelta(days=1)
    return {
        "readiness": S.readiness(db),
        "this_week": week[-1],
        "last_week": week[-2],
        "today_plan": [{**p, "program_session": S_ps(p["program_session"])} for p in plan_today],
        "week_plan": [{**p, "program_session": S_ps(p["program_session"])} for p in plan_week],
        "sleep_avg_h_7d": round(sum(n.duration_min for n in nights) / len(nights) / 60, 2) if nights else None,
        "streak_days": streak,
        "goals": goals,
    }


def S_ps(ps):
    from ..schemas import ProgramSessionOut
    return ProgramSessionOut.model_validate(ps)


@router.get("/weekly")
def weekly(weeks: int = 12, db: Session = Depends(get_db)):
    return S.weekly_stats(db, weeks=weeks)


@router.get("/load")
def load(days: int = 56, db: Session = Depends(get_db)):
    return S.load_series(db, days=days)


@router.get("/readiness")
def readiness(db: Session = Depends(get_db)):
    return S.readiness(db)
