from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SleepEntry
from ..schemas import SleepIn, SleepOut
from .common import get_or_404

router = APIRouter(prefix="/api/sleep", tags=["sommeil"])


@router.get("", response_model=list[SleepOut])
def list_sleep(start: date | None = None, limit: int = 60, db: Session = Depends(get_db)):
    q = select(SleepEntry).order_by(SleepEntry.date.desc()).limit(limit)
    if start:
        q = q.where(SleepEntry.date >= start)
    return db.scalars(q).all()


@router.post("", response_model=SleepOut, status_code=201)
def create_sleep(body: SleepIn, db: Session = Depends(get_db)):
    """Nuit : une seule par date (la saisie remplace l'existante). Sieste : toujours ajoutée."""
    e = None
    if body.kind == "night":
        e = db.scalar(select(SleepEntry).where(SleepEntry.date == body.date, SleepEntry.kind == "night"))
    if e is None:
        e = SleepEntry(source="manuel")
        db.add(e)
    for k, v in body.model_dump().items():
        setattr(e, k, v)
    db.commit()
    return e


@router.put("/{eid}", response_model=SleepOut)
def update_sleep(eid: int, body: SleepIn, db: Session = Depends(get_db)):
    e = get_or_404(db, SleepEntry, eid)
    if body.kind == "night":
        other = db.scalar(select(SleepEntry).where(
            SleepEntry.date == body.date, SleepEntry.kind == "night", SleepEntry.id != eid))
        if other:
            raise HTTPException(409, "Une nuit existe déjà à cette date")
    for k, v in body.model_dump().items():
        setattr(e, k, v)
    db.commit()
    return e


@router.delete("/{eid}", status_code=204)
def delete_sleep(eid: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, SleepEntry, eid))
    db.commit()
