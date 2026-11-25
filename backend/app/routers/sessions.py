from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import WorkoutSession
from ..schemas import WorkoutIn, WorkoutOut
from ..services.stats import session_load
from .common import get_or_404

router = APIRouter(prefix="/api/sessions", tags=["séances"])


def to_out(s: WorkoutSession) -> WorkoutOut:
    o = WorkoutOut.model_validate(s)
    o.load = session_load(s)
    return o


@router.get("", response_model=list[WorkoutOut])
def list_sessions(start: date | None = None, end: date | None = None, category: str | None = None,
                  limit: int = 200, db: Session = Depends(get_db)):
    q = select(WorkoutSession).order_by(WorkoutSession.date.desc(), WorkoutSession.id.desc()).limit(limit)
    if start:
        q = q.where(WorkoutSession.date >= start)
    if end:
        q = q.where(WorkoutSession.date <= end)
    if category:
        q = q.where(WorkoutSession.category.in_(category.split(",")))
    return [to_out(s) for s in db.scalars(q)]


@router.post("", response_model=WorkoutOut, status_code=201)
def create_session(body: WorkoutIn, db: Session = Depends(get_db)):
    s = WorkoutSession(**body.model_dump(), source="manuel")
    db.add(s)
    db.commit()
    return to_out(s)


@router.put("/{sid}", response_model=WorkoutOut)
def update_session(sid: int, body: WorkoutIn, db: Session = Depends(get_db)):
    s = get_or_404(db, WorkoutSession, sid)
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    db.commit()
    return to_out(s)


@router.delete("/{sid}", status_code=204)
def delete_session(sid: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, WorkoutSession, sid))
    db.commit()
