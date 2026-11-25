"""Génération d'une semaine type adaptée au calendrier du joueur.

Règles appliquées (principes classiques de périodisation en football amateur) :
- J+1 après un match : récupération active uniquement.
- J-1 avant un match : activation légère (technique au mur courte), jamais de séance intense.
- Pas deux séances intenses (fractionné / appuis) sur deux jours consécutifs,
  ni la veille ou le lendemain d'un entraînement collectif.
- Une séance de récupération/mobilité au moins par semaine.
- Les catégories de « focus » sont réparties par ordre de priorité.
"""
from __future__ import annotations

from ..schemas import GenerateRequest, ProgramSessionIn

HARD = {"fractionne", "appuis"}
DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
LEVEL_FACTOR = {"debutant": 0.75, "intermediaire": 1.0, "avance": 1.25}


def _template(cat: str, level: str, max_min: int) -> dict:
    f = LEVEL_FACTOR[level]
    reps = lambda n: max(1, round(n * f))  # noqa: E731
    t = {
        "footing": dict(
            title="Footing endurance fondamentale", intensity="faible", duration=round(35 * f),
            content="Allure conversationnelle (~65-75 % FC max). Finir par 4 lignes droites progressives.",
            exercises=[{"name": "Footing continu", "duration_s": int(35 * f * 60)},
                       {"name": "Lignes droites 80 m", "reps": 4}]),
        "fractionne": dict(
            title="Intermittent court 30/30", intensity="elevee", duration=40,
            content=f"Échauffement 12 min. {reps(2)} blocs de {reps(8)} × 30 s à 100-105 % VMA / 30 s récup "
                    "trottinée, 3 min entre blocs. Retour au calme 8 min.",
            exercises=[{"name": "30/30 à 100 % VMA", "sets": reps(2), "reps": reps(8)}]),
        "renforcement": dict(
            title="Renforcement footballeur", intensity="moderee", duration=round(35 * f),
            content="Circuit, 40 s effort / 20 s repos. Priorité ischios (Nordic) et adducteurs (Copenhague) "
                    "pour la prévention des blessures.",
            exercises=[
                {"name": "Nordic hamstring", "sets": 3, "reps": reps(5)},
                {"name": "Copenhague (adducteurs)", "sets": 3, "duration_s": 20},
                {"name": "Squat bulgare", "sets": 3, "reps": reps(8)},
                {"name": "Gainage frontal + latéral", "sets": 3, "duration_s": 40},
                {"name": "Mollets unipodal", "sets": 3, "reps": reps(15)}]),
        "appuis": dict(
            title="Appuis & vitesse", intensity="elevee", duration=30,
            content="Échauffement dynamique 10 min. Qualité > quantité : récupération complète entre répétitions.",
            exercises=[
                {"name": "Échelle de rythme (variantes)", "sets": reps(6), "note": "pieds rapides"},
                {"name": "Pas chassés + changement de direction", "reps": reps(6)},
                {"name": "Sprints 10-20 m départ varié", "reps": reps(8)},
                {"name": "Pliométrie : sauts latéraux", "sets": 3, "reps": reps(8)}]),
        "technique_mur": dict(
            title="Contrôle orienté au mur", intensity="moderee", duration=30,
            content="Passe contre le mur, contrôle orienté vers un plot à 45°, relance. Alterner pieds et surfaces. "
                    "Pression : chrono ou contrôle en 2 touches max.",
            exercises=[
                {"name": "Passes 1 touche pied faible/fort", "sets": 4, "duration_s": 60},
                {"name": "Contrôle orienté + conduite vers plot", "sets": 4, "reps": reps(10)},
                {"name": "Contrôle aérien (balle haute) + enchaînement", "sets": 3, "reps": reps(8)},
                {"name": "Défi : contrôles réussis en 60 s", "sets": 2, "duration_s": 60}]),
        "recuperation": dict(
            title="Récupération & mobilité", intensity="faible", duration=25,
            content="Mobilité hanches/chevilles, étirements doux, auto-massage au rouleau. Respiration lente pour finir.",
            exercises=[
                {"name": "Rouleau : quadriceps, ischios, mollets", "duration_s": 300},
                {"name": "Mobilité hanches (90/90)", "sets": 2, "duration_s": 60},
                {"name": "Étirements statiques doux", "duration_s": 420},
                {"name": "Respiration diaphragmatique", "duration_s": 180}]),
    }[cat]
    t["duration"] = min(int(round(t["duration"] / 5) * 5), max_min)
    return t


def _session(day: int, cat: str, level: str, max_min: int, **override) -> ProgramSessionIn:
    t = _template(cat, level, max_min)
    t.update(override)
    return ProgramSessionIn(
        day_of_week=day, category=cat, title=t["title"], duration_min=t["duration"],
        intensity=t["intensity"], content=t["content"], exercises=t["exercises"])


def generate_week(req: GenerateRequest) -> tuple[list[ProgramSessionIn], list[str]]:
    notes: list[str] = []
    sessions: list[ProgramSessionIn] = []
    match = req.match_day
    collective = set(req.collective_days)
    busy = collective | ({match} if match is not None else set())
    free = [d for d in sorted(set(req.available_days)) if d not in busy]

    day_after_match = (match + 1) % 7 if match is not None else None
    day_before_match = (match - 1) % 7 if match is not None else None
    hard_days: set[int] = set()
    used: set[int] = set()

    def neighbours(d: int) -> set[int]:
        return {(d - 1) % 7, (d + 1) % 7}

    # 1. Récupération au lendemain du match ; sans match, jour dédié seulement si on a ≥ 4 jours libres
    #    (sinon elle sera ajoutée en complément court plus bas).
    rec_day = day_after_match if day_after_match in free else (free[0] if len(free) >= 4 else None)
    if rec_day is not None:
        sessions.append(_session(rec_day, "recuperation", req.level, req.max_session_min))
        used.add(rec_day)
        if rec_day == day_after_match:
            notes.append("Récupération placée au lendemain du match.")

    # 2. Veille de match : activation technique courte
    if day_before_match in free and day_before_match not in used:
        sessions.append(_session(day_before_match, "technique_mur", req.level, req.max_session_min,
                                 title="Activation veille de match", duration=20, intensity="faible",
                                 content="Touches de balle au mur, rythme vif mais court. Aucune fatigue."))
        used.add(day_before_match)
        notes.append("Veille de match : activation légère uniquement.")

    # Volume hebdo individuel max selon le niveau (récup comprise), en plus du collectif/match
    cap = {"debutant": 4, "intermediaire": 5, "avance": 6}[req.level]

    unplaced: list[str] = []

    # 3. Focus dans l'ordre de priorité
    for cat in req.focus:
        if cat in {"recuperation", "collectif", "match"}:
            continue
        if len(used) >= cap:
            notes.append(f"« {cat} » non planifié : volume hebdo max atteint pour ton niveau.")
            continue
        candidates = [d for d in free if d not in used]
        if cat in HARD:
            candidates = [d for d in candidates
                          if d != day_before_match and d != day_after_match
                          and not (neighbours(d) & hard_days)
                          and not (neighbours(d) & collective)] or \
                         [d for d in candidates if d not in (day_before_match, day_after_match)
                          and not (neighbours(d) & hard_days)]
        if not candidates:
            unplaced.append(cat)
            continue
        # privilégier le jour le plus éloigné du match pour l'intensité
        if cat in HARD and match is not None:
            candidates.sort(key=lambda d: -min((match - d) % 7, (d - match) % 7))
        d = candidates[0]
        sessions.append(_session(d, cat, req.level, req.max_session_min))
        used.add(d)
        if cat in HARD:
            hard_days.add(d)

    # 4. Jours libres restants : technique au mur (rentable sans grosse fatigue),
    #    dans la limite d'un volume hebdo adapté au niveau (+ collectif + match).
    for d in free:
        if d not in used and len(used) < cap:
            sessions.append(_session(d, "technique_mur", req.level, req.max_session_min))
            used.add(d)

    # 5. Compléments courts (15-20 min) greffés après une séance non intense du même jour
    if rec_day is None and free:
        unplaced.append("recuperation")
    for cat in unplaced:
        if cat in HARD:
            notes.append(f"« {cat} » non planifié : aucun jour compatible avec une séance intense "
                         "(ajoute un jour libre éloigné du match).")
            continue
        hosts = [x for x in sessions if (x.intensity != "elevee" and x.day_of_week != day_before_match)
                 or cat == "recuperation"]
        hosts = [x for x in hosts if sum(1 for y in sessions if y.day_of_week == x.day_of_week) == 1]
        if not hosts:
            notes.append(f"« {cat} » non planifié : plus de place cette semaine.")
            continue
        host = hosts[-1]
        comp = _session(host.day_of_week, cat, req.level, req.max_session_min)
        comp.title = "Complément · " + comp.title
        comp.duration_min = 15 if cat == "recuperation" else 20
        comp.intensity = "faible" if cat in {"recuperation", "footing"} else comp.intensity
        sessions.append(comp)
        notes.append(f"« {cat} » ajouté en complément court après la séance du {DAYS[host.day_of_week]}.")

    sessions.sort(key=lambda s: s.day_of_week)
    if len(free) < 2:
        notes.append("Peu de jours disponibles : la progression sera plus lente.")
    return sessions, notes
