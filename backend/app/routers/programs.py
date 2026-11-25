from datetime import date, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Program, ProgramSession
from ..schemas import GenerateRequest, PlannedSession, ProgramIn, ProgramOut, ProgramSessionIn, ProgramSessionOut
from ..services.generator import generate_week
from ..services.stats import monday, planned_sessions
from .common import get_or_404

router = APIRouter(prefix="/api/programs", tags=["programme"])


class GenerateResponse(BaseModel):
    program: ProgramOut
    notes: list[str]


@router.get("", response_model=list[ProgramOut])
def list_programs(db: Session = Depends(get_db)):
    return db.scalars(select(Program).order_by(Program.active.desc(), Program.created_at.desc())).all()


@router.get("/planning", response_model=list[PlannedSession])
def planning(start: date | None = None, days: int = 7, db: Session = Depends(get_db)):
    start = start or monday(date.today())
    return planned_sessions(db, start, start + timedelta(days=days - 1))


def _deactivate_others(db: Session, keep_id: int | None = None):
    for p in db.scalars(select(Program).where(Program.active.is_(True))):
        if p.id != keep_id:
            p.active = False


@router.post("", response_model=ProgramOut, status_code=201)
def create_program(body: ProgramIn, db: Session = Depends(get_db)):
    data = body.model_dump(exclude={"sessions"})
    p = Program(**data)
    p.sessions = [ProgramSession(**s.model_dump()) for s in body.sessions]
    if p.active:
        _deactivate_others(db)
    db.add(p)
    db.commit()
    return p


@router.post("/generate", response_model=GenerateResponse, status_code=201)
def generate(body: GenerateRequest, db: Session = Depends(get_db)):
    sessions, notes = generate_week(body)
    _deactivate_others(db)
    p = Program(name=body.name, start_date=body.start_date, weeks=body.weeks,
                description=f"Généré · niveau {body.level} · focus : {', '.join(body.focus)}")
    p.sessions = [ProgramSession(**s.model_dump()) for s in sessions]
    db.add(p)
    db.commit()
    return GenerateResponse(program=ProgramOut.model_validate(p), notes=notes)


@router.put("/{pid}", response_model=ProgramOut)
def update_program(pid: int, body: ProgramIn, db: Session = Depends(get_db)):
    p = get_or_404(db, Program, pid)
    for k, v in body.model_dump(exclude={"sessions"}).items():
        setattr(p, k, v)
    if p.active:
        _deactivate_others(db, p.id)
    db.commit()
    return p


@router.delete("/{pid}", status_code=204)
def delete_program(pid: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, Program, pid))
    db.commit()


@router.post("/{pid}/sessions", response_model=ProgramSessionOut, status_code=201)
def add_session(pid: int, body: ProgramSessionIn, db: Session = Depends(get_db)):
    p = get_or_404(db, Program, pid)
    s = ProgramSession(**body.model_dump())
    p.sessions.append(s)
    db.commit()
    return s


@router.put("/{pid}/sessions/{sid}", response_model=ProgramSessionOut)
def update_session(pid: int, sid: int, body: ProgramSessionIn, db: Session = Depends(get_db)):
    s = get_or_404(db, ProgramSession, sid)
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    db.commit()
    return s


@router.delete("/{pid}/sessions/{sid}", status_code=204)
def delete_session(pid: int, sid: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, ProgramSession, sid))
    db.commit()
