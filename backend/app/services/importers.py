"""Import des données montre.

Toutes les grandes marques (Garmin, Polar, Coros, Suunto, Amazfit…) permettent
d'exporter une activité en GPX, TCX ou FIT. Le sommeil s'importe en CSV.
Chaque parseur renvoie des dictionnaires neutres -> l'adapter d'une API
constructeur (Polar AccessLink, Garmin Health, Strava…) n'aura qu'à produire
le même format.
"""
from __future__ import annotations

import csv
import hashlib
import io
import math
import xml.etree.ElementTree as ET
from datetime import date, datetime


def _hash(raw: bytes) -> str:
    return hashlib.sha1(raw).hexdigest()[:20]


def _haversine(a: tuple[float, float], b: tuple[float, float]) -> float:
    r = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def _ts(s: str) -> datetime:
    return datetime.fromisoformat(s.strip().replace("Z", "+00:00"))


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _sport_to_category(sport: str | None) -> str:
    s = (sport or "").lower()
    if any(k in s for k in ("soccer", "football")):
        return "collectif"
    if any(k in s for k in ("strength", "training", "fitness")):
        return "renforcement"
    if any(k in s for k in ("yoga", "stretch", "mobility")):
        return "recuperation"
    return "footing"


# ---------------------------------------------------------------- GPX
def parse_gpx(raw: bytes) -> list[dict]:
    root = ET.fromstring(raw)
    pts: list[tuple[float, float, datetime | None, int | None]] = []
    sport = None
    for el in root.iter():
        name = _local(el.tag)
        if name == "type" and sport is None:
            sport = el.text
        if name != "trkpt":
            continue
        t = hr = None
        for c in el.iter():
            cn = _local(c.tag)
            if cn == "time" and c.text:
                t = _ts(c.text)
            elif cn == "hr" and c.text:
                hr = int(float(c.text))
        pts.append((float(el.get("lat")), float(el.get("lon")), t, hr))
    if len(pts) < 2:
        raise ValueError("GPX sans trace exploitable")
    dist = sum(_haversine(pts[i][:2], pts[i + 1][:2]) for i in range(len(pts) - 1))
    times = [p[2] for p in pts if p[2]]
    hrs = [p[3] for p in pts if p[3]]
    start = times[0] if times else None
    duration = (times[-1] - times[0]).total_seconds() / 60 if len(times) > 1 else 0
    return [{
        "date": start.date() if start else date.today(),
        "category": _sport_to_category(sport),
        "title": f"Course importée ({start:%H:%M})" if start else "Course importée",
        "duration_min": round(duration, 1),
        "distance_km": round(dist, 2),
        "avg_hr": round(sum(hrs) / len(hrs)) if hrs else None,
        "max_hr": max(hrs) if hrs else None,
        "calories": None,
        "source": "gpx",
        "external_id": "gpx-" + _hash(raw),
        "details": {"points": len(pts)},
    }]


# ---------------------------------------------------------------- TCX
def parse_tcx(raw: bytes) -> list[dict]:
    root = ET.fromstring(raw)
    out = []
    for act in (e for e in root.iter() if _local(e.tag) == "Activity"):
        sport = act.get("Sport")
        start = None
        dur = dist = cal = 0.0
        hr_avg_weighted = 0.0
        hr_max = 0
        laps = []
        for lap in (e for e in act if _local(e.tag) == "Lap"):
            start = start or _ts(lap.get("StartTime"))
            vals = {}
            for c in lap:
                n = _local(c.tag)
                if n in ("TotalTimeSeconds", "DistanceMeters", "Calories"):
                    vals[n] = float(c.text or 0)
                elif n in ("AverageHeartRateBpm", "MaximumHeartRateBpm"):
                    v = next((x for x in c if _local(x.tag) == "Value"), None)
                    if v is not None:
                        vals[n] = float(v.text)
            t = vals.get("TotalTimeSeconds", 0)
            dur += t
            dist += vals.get("DistanceMeters", 0)
            cal += vals.get("Calories", 0)
            hr_avg_weighted += vals.get("AverageHeartRateBpm", 0) * t
            hr_max = max(hr_max, int(vals.get("MaximumHeartRateBpm", 0)))
            laps.append({"time_s": t, "distance_m": vals.get("DistanceMeters"),
                         "avg_hr": vals.get("AverageHeartRateBpm")})
        if not start:
            continue
        out.append({
            "date": start.date(),
            "category": "fractionne" if len(laps) >= 6 else _sport_to_category(sport),
            "title": f"{sport or 'Activité'} importée ({start:%H:%M})",
            "duration_min": round(dur / 60, 1),
            "distance_km": round(dist / 1000, 2) if dist else None,
            "avg_hr": round(hr_avg_weighted / dur) if dur and hr_avg_weighted else None,
            "max_hr": hr_max or None,
            "calories": int(cal) or None,
            "source": "tcx",
            "external_id": f"tcx-{_hash(raw)}-{len(out)}",
            "details": {"laps": laps},
        })
    if not out:
        raise ValueError("TCX sans activité")
    return out


# ---------------------------------------------------------------- FIT
def parse_fit(raw: bytes) -> list[dict]:
    try:
        from fitparse import FitFile
    except ImportError as e:  # pragma: no cover
        raise ValueError("Installe 'fitparse' pour importer des fichiers FIT") from e
    fit = FitFile(io.BytesIO(raw))
    out = []
    for i, msg in enumerate(fit.get_messages("session")):
        v = {f.name: f.value for f in msg}
        start = v.get("start_time") or datetime.now()
        dist = v.get("total_distance")
        out.append({
            "date": start.date(),
            "category": _sport_to_category(str(v.get("sport"))),
            "title": f"{v.get('sport') or 'Activité'} importée ({start:%H:%M})",
            "duration_min": round((v.get("total_timer_time") or v.get("total_elapsed_time") or 0) / 60, 1),
            "distance_km": round(dist / 1000, 2) if dist else None,
            "avg_hr": v.get("avg_heart_rate"),
            "max_hr": v.get("max_heart_rate"),
            "calories": v.get("total_calories"),
            "source": "fit",
            "external_id": f"fit-{_hash(raw)}-{i}",
            "details": {},
        })
    if not out:
        raise ValueError("FIT sans session")
    return out


def parse_activity(filename: str, raw: bytes) -> list[dict]:
    ext = filename.lower().rsplit(".", 1)[-1]
    if ext == "gpx":
        return parse_gpx(raw)
    if ext == "tcx":
        return parse_tcx(raw)
    if ext == "fit":
        return parse_fit(raw)
    raise ValueError(f"Format .{ext} non supporté (GPX, TCX ou FIT)")


# ---------------------------------------------------------------- Sommeil CSV
SLEEP_ALIASES = {
    "date": ["date", "day", "jour", "calendar date"],
    "bedtime": ["bedtime", "coucher", "sleep start", "start"],
    "wake_time": ["wake_time", "reveil", "réveil", "sleep end", "end"],
    "duration_min": ["duration_min", "duree_min", "durée (min)", "total sleep (min)", "duration"],
    "quality": ["quality", "qualite", "qualité"],
    "deep_min": ["deep_min", "deep", "profond"],
    "rem_min": ["rem_min", "rem", "paradoxal"],
    "light_min": ["light_min", "light", "leger", "léger"],
    "awake_min": ["awake_min", "awake", "eveil", "éveil"],
    "resting_hr": ["resting_hr", "fc_repos", "resting heart rate"],
    "hrv_ms": ["hrv_ms", "hrv", "vfc"],
}


def _to_int(v: str | None) -> int | None:
    if v is None or str(v).strip() == "":
        return None
    v = str(v).strip().replace(",", ".")
    if ":" in v:  # "7:45" -> minutes
        h, m = v.split(":")[:2]
        return int(h) * 60 + int(m)
    return int(round(float(v)))


def _hhmm(v: str | None) -> str | None:
    if not v:
        return None
    v = v.strip()
    if "T" in v or " " in v:
        v = v.replace("T", " ").split(" ")[1]
    return v[:5]


def parse_sleep_csv(raw: bytes) -> list[dict]:
    text = raw.decode("utf-8-sig")
    dialect = csv.Sniffer().sniff(text.splitlines()[0], delimiters=",;\t")
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    cols = {h.strip().lower(): h for h in reader.fieldnames or []}
    mapping = {}
    for key, aliases in SLEEP_ALIASES.items():
        for a in aliases:
            if a in cols:
                mapping[key] = cols[a]
                break
    if "date" not in mapping or "duration_min" not in mapping:
        raise ValueError("Colonnes requises : date, duration_min")
    out = []
    for row in reader:
        get = lambda k: row.get(mapping[k]) if k in mapping else None  # noqa: E731
        d = get("date").strip()[:10]
        out.append({
            "date": date.fromisoformat(d) if "-" in d else datetime.strptime(d, "%d/%m/%Y").date(),
            "bedtime": _hhmm(get("bedtime")),
            "wake_time": _hhmm(get("wake_time")),
            "duration_min": _to_int(get("duration_min")),
            **{k: _to_int(get(k)) for k in
               ("quality", "deep_min", "rem_min", "light_min", "awake_min", "resting_hr", "hrv_ms")},
        })
    return out
