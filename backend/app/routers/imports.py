from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SleepEntry, WorkoutSession
from ..schemas import ImportResult
from ..services.importers import parse_activity, parse_sleep_csv

router = APIRouter(prefix="/api/import", tags=["import montre"])


@router.post("/activity", response_model=ImportResult)
async def import_activity(files: list[UploadFile] = File(...), db: Session = Depends(get_db)):
    imported = skipped = 0
    items: list[str] = []
    for f in files:
        try:
            parsed = parse_activity(f.filename or "", await f.read())
        except Exception as e:  # fichier illisible : on continue avec les autres
            items.append(f"{f.filename} : erreur — {e}")
            skipped += 1
            continue
        for a in parsed:
            if db.scalar(select(WorkoutSession.id).where(WorkoutSession.external_id == a["external_id"])):
                skipped += 1
                items.append(f"{f.filename} : déjà importé")
                continue
            db.add(WorkoutSession(**a))
            imported += 1
            km = f"{a['distance_km']} km, " if a.get("distance_km") else ""
            items.append(f"{f.filename} : {a['date']} · {km}{a['duration_min']} min")
    db.commit()
    return ImportResult(imported=imported, skipped=skipped, items=items)


@router.post("/sleep", response_model=ImportResult)
async def import_sleep(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        rows = parse_sleep_csv(await file.read())
    except Exception as e:
        raise HTTPException(400, f"CSV invalide : {e}") from e
    imported = 0
    for r in rows:
        if not r.get("duration_min"):
            continue
        e = db.scalar(select(SleepEntry).where(SleepEntry.date == r["date"])) or SleepEntry()
        for k, v in r.items():
            setattr(e, k, v)
        e.source = "csv"
        db.add(e)
        imported += 1
    db.commit()
    return ImportResult(imported=imported, skipped=len(rows) - imported, items=[])
