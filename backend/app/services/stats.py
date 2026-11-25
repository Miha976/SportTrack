"""Calculs : charge d'entraînement, forme du jour, progression des objectifs, planning."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import CATEGORIES, Goal, Program, SleepEntry, WorkoutSession

# RPE par défaut quand il n'est pas renseigné (ex. import montre)
DEFAULT_RPE = {
    "footing": 4, "fractionne": 8, "renforcement": 6, "appuis": 7,
    "technique_mur": 5, "collectif": 6, "match": 8, "recuperation": 2,
}


def monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def session_load(s: WorkoutSession) -> float:
    """Charge interne (Foster) = durée (min) × RPE (1-10)."""
    rpe = s.rpe or DEFAULT_RPE.get(s.category, 5)
    return round((s.duration_min or 0) * rpe, 1)


def sessions_between(db: Session, start: date, end: date) -> list[WorkoutSession]:
    q = select(WorkoutSession).where(WorkoutSession.date >= start, WorkoutSession.date <= end)
    return list(db.scalars(q))


def sleep_between(db: Session, start: date, end: date) -> list[SleepEntry]:
    q = select(SleepEntry).where(SleepEntry.date >= start, SleepEntry.date <= end).order_by(SleepEntry.date)
    return list(db.scalars(q))


# ------------------------------------------------------------------ charge
MIN_HISTORY_DAYS = 27  # 1re séance il y a ≥ 27 jours → 28 jours couverts


def load_series(db: Session, days: int = 56, today: date | None = None) -> list[dict]:
    """Charge quotidienne + aiguë (7 j) + chronique (moy. hebdo sur 28 j) + ratio ACWR."""
    today = today or date.today()
    start = today - timedelta(days=days + 27)
    daily: dict[date, float] = defaultdict(float)
    for s in sessions_between(db, start, today):
        daily[s.date] += session_load(s)
    # Le ratio n'a de sens qu'avec 4 semaines d'historique : avant, la charge chronique
    # est sous-estimée (ex. tout dans la 1re semaine → ratio mécaniquement égal à 4).
    first = db.scalar(select(func.min(WorkoutSession.date)))

    out = []
    for i in range(days):
        d = today - timedelta(days=days - 1 - i)
        acute = sum(daily[d - timedelta(days=k)] for k in range(7))
        chronic = sum(daily[d - timedelta(days=k)] for k in range(28)) / 4
        out.append({
            "date": d.isoformat(),
            "load": round(daily[d], 1),
            "acute": round(acute, 1),
            "chronic": round(chronic, 1),
            "acwr": round(acute / chronic, 2)
            if chronic > 0 and first is not None and (d - first).days >= MIN_HISTORY_DAYS else None,
        })
    return out


def acwr_zone(acwr: float | None) -> str:
    if acwr is None:
        return "inconnu"
    if acwr < 0.8:
        return "sous-charge"
    if acwr <= 1.3:
        return "optimal"
    if acwr <= 1.5:
        return "vigilance"
    return "risque"


# ------------------------------------------------------------------ forme du jour
def readiness(db: Session, today: date | None = None) -> dict:
    """Score de forme 0-100, heuristique et transparent (chaque facteur est listé)."""
    today = today or date.today()
    score = 70.0
    factors: list[dict] = []

    def add(label: str, delta: float):
        nonlocal score
        score += delta
        factors.append({"label": label, "delta": round(delta)})

    nights = sleep_between(db, today - timedelta(days=7), today)
    last = next((n for n in reversed(nights) if n.date == today), None) or (nights[-1] if nights else None)
    previous = [n for n in nights if last is None or n.id != last.id]

    if last:
        h = last.duration_min / 60
        if h >= 8:
            add(f"Sommeil {h:.1f} h (≥ 8 h)", 10)
        elif h >= 7:
            add(f"Sommeil {h:.1f} h", 4)
        elif h >= 6:
            add(f"Sommeil court {h:.1f} h", -6)
        else:
            add(f"Sommeil très court {h:.1f} h", -15)
        if last.quality:
            add(f"Qualité ressentie {last.quality}/5", (last.quality - 3) * 4)
        hrvs = [n.hrv_ms for n in previous if n.hrv_ms]
        if last.hrv_ms and hrvs:
            ratio = last.hrv_ms / (sum(hrvs) / len(hrvs))
            if ratio < 0.9:
                add(f"VFC basse ({last.hrv_ms} ms vs moy. {sum(hrvs)/len(hrvs):.0f})", -10)
            elif ratio > 1.05:
                add(f"VFC haute ({last.hrv_ms} ms)", 5)
        rhrs = [n.resting_hr for n in previous if n.resting_hr]
        if last.resting_hr and rhrs:
            diff = last.resting_hr - sum(rhrs) / len(rhrs)
            if diff >= 5:
                add(f"FC repos +{diff:.0f} bpm", -8)
    else:
        factors.append({"label": "Pas de donnée de sommeil récente", "delta": 0})

    series = load_series(db, days=1, today=today)
    acwr = series[-1]["acwr"] if series else None
    zone = acwr_zone(acwr)
    if zone == "risque":
        add(f"Charge en forte hausse (ratio {acwr})", -15)
    elif zone == "vigilance":
        add(f"Charge en hausse (ratio {acwr})", -7)

    yesterday = sessions_between(db, today - timedelta(days=1), today - timedelta(days=1))
    if any(s.category == "match" or (s.rpe or 0) >= 8 for s in yesterday):
        add("Séance/match intense hier", -8)

    score = max(0, min(100, score))
    if score >= 75:
        advice = "Feu vert : séance intense possible (fractionné, appuis)."
    elif score >= 55:
        advice = "Séance modérée conseillée : technique au mur, renfo léger, footing."
    else:
        advice = "Priorité récupération : mobilité, étirements, sommeil."
    return {"score": round(score), "advice": advice, "factors": factors, "acwr": acwr, "acwr_zone": zone}


# ------------------------------------------------------------------ objectifs
def goal_current_value(db: Session, g: Goal, today: date | None = None) -> float | None:
    today = today or date.today()
    if g.metric == "manual":
        return g.measurements[-1].value if g.measurements else g.baseline_value
    start = monday(today) if g.period == "week" else g.start_date
    if g.metric == "sleep_avg_h":
        nights = sleep_between(db, today - timedelta(days=6) if g.period == "week" else start, today)
        return round(sum(n.duration_min for n in nights) / len(nights) / 60, 2) if nights else None
    sessions = [s for s in sessions_between(db, start, today) if not g.category or s.category == g.category]
    if g.metric == "sessions_count":
        return float(len(sessions))
    if g.metric == "duration_min":
        return round(sum(s.duration_min for s in sessions), 1)
    if g.metric == "distance_km":
        return round(sum(s.distance_km or 0 for s in sessions), 2)
    return None


def goal_progress(g: Goal, current: float | None) -> float:
    if current is None:
        return 0.0
    if g.direction == "decrease":
        base = g.baseline_value if g.baseline_value is not None else (
            g.measurements[0].value if g.measurements else current)
        span = base - g.target_value
        pct = (base - current) / span * 100 if span else (100 if current <= g.target_value else 0)
    else:
        base = g.baseline_value or 0
        span = g.target_value - base
        pct = (current - base) / span * 100 if span else 100
    return round(max(0.0, min(100.0, pct)), 1)


# ------------------------------------------------------------------ planning
def planned_sessions(db: Session, start: date, end: date) -> list[dict]:
    programs = db.scalars(select(Program).where(Program.active.is_(True))).all()
    done = sessions_between(db, start, end)
    out = []
    for p in programs:
        d = max(start, p.start_date)
        last_day = min(end, p.start_date + timedelta(days=p.weeks * 7 - 1))
        while d <= last_day:
            week = (d - p.start_date).days // 7 + 1
            deload = p.deload_every > 0 and week % p.deload_every == 0
            factor = (1 + p.progression_pct / 100) ** (week - 1) * (0.6 if deload else 1)
            for ps in p.sessions:
                if ps.day_of_week != d.weekday():
                    continue
                match = next((s for s in done if s.program_session_id == ps.id and s.date == d), None) \
                    or next((s for s in done if s.date == d and s.category == ps.category
                             and s.program_session_id is None), None)
                out.append({
                    "date": d,
                    "week_index": week,
                    "deload": deload,
                    "program_session": ps,
                    "scaled_duration_min": int(round(ps.duration_min * factor / 5) * 5) or 5,
                    "done_session_id": match.id if match else None,
                })
            d += timedelta(days=1)
    out.sort(key=lambda x: x["date"])
    return out


# ------------------------------------------------------------------ hebdo
def weekly_stats(db: Session, weeks: int = 12, today: date | None = None) -> list[dict]:
    today = today or date.today()
    first = monday(today) - timedelta(weeks=weeks - 1)
    sessions = sessions_between(db, first, today)
    nights = sleep_between(db, first, today)
    plan = planned_sessions(db, first, today)
    out = []
    for w in range(weeks):
        ws = first + timedelta(weeks=w)
        we = ws + timedelta(days=6)
        wk = [s for s in sessions if ws <= s.date <= we]
        wn = [n for n in nights if ws <= n.date <= we]
        wp = [p for p in plan if ws <= p["date"] <= we]
        by_cat = {c: 0.0 for c in CATEGORIES}
        for s in wk:
            by_cat[s.category] = by_cat.get(s.category, 0) + s.duration_min
        footings = [s for s in wk if s.category == "footing" and s.distance_km]
        pace = None
        if footings:
            tot_d = sum(s.distance_km for s in footings)
            pace = round(sum(s.duration_min for s in footings) / tot_d, 2) if tot_d else None
        out.append({
            "week_start": ws.isoformat(),
            "minutes_by_category": {k: round(v, 1) for k, v in by_cat.items()},
            "total_minutes": round(sum(by_cat.values()), 1),
            "distance_km": round(sum(s.distance_km or 0 for s in wk), 2),
            "load": round(sum(session_load(s) for s in wk), 1),
            "sessions": len(wk),
            "sleep_avg_h": round(sum(n.duration_min for n in wn) / len(wn) / 60, 2) if wn else None,
            "footing_pace_min_km": pace,
            "planned": len(wp),
            "planned_done": sum(1 for p in wp if p["done_session_id"]),
        })
    return out
