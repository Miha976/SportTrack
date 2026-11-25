from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Goal, GoalMeasurement
from ..schemas import GoalIn, GoalOut, MeasurementIn
from ..services.stats import goal_current_value, goal_progress
from .common import get_or_404

router = APIRouter(prefix="/api/goals", tags=["objectifs"])


def to_out(db: Session, g: Goal) -> GoalOut:
    cur = goal_current_value(db, g)
    out = GoalOut.model_validate(g)
    out.current_value = cur
    out.progress_pct = goal_progress(g, cur)
    return out


@router.get("", response_model=list[GoalOut])
def list_goals(status: str | None = None, db: Session = Depends(get_db)):
    q = select(Goal).order_by(Goal.status, Goal.created_at.desc())
    if status:
        q = q.where(Goal.status == status)
    return [to_out(db, g) for g in db.scalars(q)]


@router.post("", response_model=GoalOut, status_code=201)
def create_goal(body: GoalIn, db: Session = Depends(get_db)):
    g = Goal(**body.model_dump())
    db.add(g)
    db.commit()
    return to_out(db, g)


@router.put("/{goal_id}", response_model=GoalOut)
def update_goal(goal_id: int, body: GoalIn, db: Session = Depends(get_db)):
    g = get_or_404(db, Goal, goal_id)
    for k, v in body.model_dump().items():
        setattr(g, k, v)
    db.commit()
    return to_out(db, g)


@router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, Goal, goal_id))
    db.commit()


@router.post("/{goal_id}/measurements", response_model=GoalOut, status_code=201)
def add_measurement(goal_id: int, body: MeasurementIn, db: Session = Depends(get_db)):
    g = get_or_404(db, Goal, goal_id)
    g.measurements.append(GoalMeasurement(**body.model_dump()))
    g.measurements.sort(key=lambda m: m.date)
    db.commit()
    db.refresh(g)
    out = to_out(db, g)
    if out.progress_pct >= 100 and g.status == "active":
        g.status = "done"
        db.commit()
        out.status = "done"
    return out


@router.delete("/{goal_id}/measurements/{m_id}", response_model=GoalOut)
def delete_measurement(goal_id: int, m_id: int, db: Session = Depends(get_db)):
    g = get_or_404(db, Goal, goal_id)
    db.delete(get_or_404(db, GoalMeasurement, m_id))
    db.commit()
    db.refresh(g)
    return to_out(db, g)
