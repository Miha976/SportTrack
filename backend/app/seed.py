"""Bibliothèque d'exercices par défaut + jeu de données de démo optionnel.

    python -m app.seed --demo     # remplit 6 semaines de données fictives
"""
from __future__ import annotations

import random
import sys
from datetime import date, timedelta

from sqlalchemy import select

from .database import Base, SessionLocal, engine
from .models import Exercise, Goal, GoalMeasurement, Program, ProgramSession, SleepEntry, WorkoutSession
from .schemas import GenerateRequest
from .services.generator import generate_week

EXERCISES = [
    ("Footing continu", "footing", "Endurance fondamentale, allure conversationnelle.", None, None, 2400),
    ("Fartlek", "footing", "Variations d'allure libres pendant le footing.", None, None, 1800),
    ("30/30 à 100 % VMA", "fractionne", "30 s rapide / 30 s trot.", 2, 8, None),
    ("15/15 à 110 % VMA", "fractionne", "Très proche des efforts de match.", 2, 10, None),
    ("Navettes 4×(5-10-15 m)", "fractionne", "Intermittent avec changements de direction.", 3, 6, None),
    ("Nordic hamstring", "renforcement", "Prévention ischio-jambiers. Descente lente.", 3, 5, None),
    ("Copenhague (adducteurs)", "renforcement", "Gainage latéral, jambe haute sur banc.", 3, None, 20),
    ("Squat bulgare", "renforcement", "Pied arrière surélevé.", 3, 8, None),
    ("Gainage frontal", "renforcement", "Corps aligné, bassin neutre.", 3, None, 45),
    ("Mollets unipodal", "renforcement", "Montée explosive, descente lente.", 3, 15, None),
    ("Fentes marchées", "renforcement", "", 3, 10, None),
    ("Échelle de rythme", "appuis", "Pieds rapides, regard haut.", 6, None, None),
    ("Sprint 10 m départ varié", "appuis", "Départ assis, dos, latéral…", None, 8, None),
    ("Pas chassés + crochet", "appuis", "Changement de direction sur appel.", None, 6, None),
    ("Sauts latéraux (haies basses)", "appuis", "Contacts au sol courts.", 3, 8, None),
    ("Passes 1 touche au mur", "technique_mur", "Alterner pied fort / pied faible.", 4, None, 60),
    ("Contrôle orienté + conduite", "technique_mur", "Contrôle vers plot à 45°, relance.", 4, 10, None),
    ("Contrôle aérien au mur", "technique_mur", "Balle haute, amorti cuisse/poitrine/pied.", 3, 8, None),
    ("Défi 60 s contrôles réussis", "technique_mur", "Compter les contrôles propres en 60 s.", 2, None, 60),
    ("Rouleau de massage", "recuperation", "Quadriceps, ischios, mollets, fessiers.", None, None, 300),
    ("Mobilité hanches 90/90", "recuperation", "", 2, None, 60),
    ("Étirements statiques doux", "recuperation", "20-30 s par muscle, sans douleur.", None, None, 420),
    ("Respiration diaphragmatique", "recuperation", "Expiration 2× plus longue que l'inspiration.", None, None, 180),
    ("Bain froid / douche froide jambes", "recuperation", "10-15 °C, 5-10 min.", None, None, 420),
]


def init_db():
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if not db.scalar(select(Exercise.id).limit(1)):
            db.add_all(Exercise(name=n, category=c, description=d, default_sets=s,
                                default_reps=r, default_duration_s=t) for n, c, d, s, r, t in EXERCISES)
            db.commit()


def seed_demo():
    random.seed(7)
    init_db()
    today = date.today()
    start = today - timedelta(days=today.weekday()) - timedelta(weeks=5)
    with SessionLocal() as db:
        req = GenerateRequest(name="Prépa mi-saison", start_date=start, weeks=8,
                              available_days=[0, 2, 4, 5], collective_days=[1, 3], match_day=6)
        sessions, _ = generate_week(req)
        prog = Program(name=req.name, start_date=start, weeks=8, progression_pct=5, deload_every=4,
                       description="Programme de démonstration")
        prog.sessions = [ProgramSession(**s.model_dump()) for s in sessions]
        db.add(prog)
        db.flush()

        d = start
        while d <= today:
            wd = d.weekday()
            if wd in (1, 3):
                db.add(WorkoutSession(date=d, category="collectif", title="Entraînement club",
                                      duration_min=90, rpe=random.randint(5, 7)))
            if wd == 6:
                db.add(WorkoutSession(date=d, category="match", title="Match championnat",
                                      duration_min=random.choice([70, 80, 90]), rpe=random.randint(7, 9)))
            for ps in prog.sessions:
                if ps.day_of_week == wd and random.random() < 0.78:
                    dist = round(ps.duration_min / random.uniform(5.4, 6.1), 2) if ps.category == "footing" else None
                    db.add(WorkoutSession(
                        date=d, category=ps.category, title=ps.title, program_session_id=ps.id,
                        duration_min=ps.duration_min + random.randint(-5, 5), distance_km=dist,
                        avg_hr=random.randint(130, 165) if ps.category in ("footing", "fractionne") else None,
                        rpe={"faible": 3, "moderee": 6, "elevee": 8}[ps.intensity] + random.randint(-1, 1)))
            dur = random.randint(370, 520)
            db.add(SleepEntry(date=d, duration_min=dur, bedtime=f"{random.choice([22, 23, 23, 0]):02d}:{random.choice([0, 15, 30, 45]):02d}",
                              wake_time="07:30", quality=random.randint(2, 5), deep_min=int(dur * .18),
                              rem_min=int(dur * .22), light_min=int(dur * .55), awake_min=int(dur * .05),
                              resting_hr=random.randint(50, 58), hrv_ms=random.randint(55, 80)))
            d += timedelta(days=1)

        g1 = Goal(title="3 séances perso par semaine", metric="sessions_count", period="week", target_value=3,
                  unit="séances", start_date=start)
        g2 = Goal(title="VMA à 17 km/h", metric="manual", target_value=17, baseline_value=15.5, unit="km/h",
                  start_date=start, deadline=today + timedelta(weeks=6))
        g2.measurements = [GoalMeasurement(date=start, value=15.5), GoalMeasurement(date=start + timedelta(weeks=3), value=16.0),
                           GoalMeasurement(date=today - timedelta(days=2), value=16.4)]
        g3 = Goal(title="Sprint 30 m sous 4,2 s", metric="manual", direction="decrease", target_value=4.2,
                  baseline_value=4.6, unit="s", start_date=start)
        g3.measurements = [GoalMeasurement(date=start, value=4.6), GoalMeasurement(date=today - timedelta(days=9), value=4.45)]
        g4 = Goal(title="Dormir 8 h en moyenne", metric="sleep_avg_h", period="week", target_value=8, unit="h",
                  start_date=start)
        g5 = Goal(title="Contrôles réussis au mur en 60 s", metric="manual", target_value=40, baseline_value=24,
                  unit="contrôles", start_date=start)
        g5.measurements = [GoalMeasurement(date=start + timedelta(weeks=w), value=v)
                           for w, v in enumerate([24, 27, 29, 31, 34, 35])]
        db.add_all([g1, g2, g3, g4, g5])
        db.commit()
    print("Données de démo créées.")


if __name__ == "__main__":
    if "--demo" in sys.argv:
        Base.metadata.drop_all(engine)
        seed_demo()
    else:
        init_db()
