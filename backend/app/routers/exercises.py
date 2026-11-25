from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Exercise
from ..schemas import ExerciseIn, ExerciseOut
from .common import get_or_404

router = APIRouter(prefix="/api/exercises", tags=["exercices"])


@router.get("", response_model=list[ExerciseOut])
def list_exercises(category: str | None = None, db: Session = Depends(get_db)):
    q = select(Exercise).order_by(Exercise.category, Exercise.name)
    if category:
        q = q.where(Exercise.category == category)
    return db.scalars(q).all()


@router.post("", response_model=ExerciseOut, status_code=201)
def create_exercise(body: ExerciseIn, db: Session = Depends(get_db)):
    ex = Exercise(**body.model_dump(), is_custom=True)
    db.add(ex)
    db.commit()
    return ex


@router.delete("/{ex_id}", status_code=204)
def delete_exercise(ex_id: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, Exercise, ex_id))
    db.commit()
