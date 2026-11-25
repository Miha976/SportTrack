"""Schémas Pydantic (contrats d'API)."""
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Category = Literal[
    "footing", "fractionne", "renforcement", "appuis",
    "technique_mur", "collectif", "match", "recuperation",
]
Metric = Literal["sessions_count", "duration_min", "distance_km", "sleep_avg_h", "manual"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Exercices ----------
class ExerciseIn(BaseModel):
    name: str
    category: Category
    description: str = ""
    default_sets: int | None = None
    default_reps: int | None = None
    default_duration_s: int | None = None


class ExerciseOut(ExerciseIn, ORM):
    id: int
    is_custom: bool


# ---------- Objectifs ----------
class GoalIn(BaseModel):
    title: str
    metric: Metric
    category: Category | None = None
    period: Literal["week", "total"] = "week"
    direction: Literal["increase", "decrease"] = "increase"
    target_value: float
    baseline_value: float | None = None
    unit: str = ""
    start_date: date = Field(default_factory=date.today)
    deadline: date | None = None
    status: Literal["active", "done", "archived"] = "active"


class MeasurementIn(BaseModel):
    date: date
    value: float
    note: str = ""


class MeasurementOut(MeasurementIn, ORM):
    id: int


class GoalOut(GoalIn, ORM):
    id: int
    current_value: float | None = None
    progress_pct: float = 0
    measurements: list[MeasurementOut] = []


# ---------- Programme ----------
class ProgramExercise(BaseModel):
    name: str
    sets: int | None = None
    reps: int | None = None
    duration_s: int | None = None
    note: str = ""


class ProgramSessionIn(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    category: Category
    title: str
    duration_min: int = 30
    intensity: Literal["faible", "moderee", "elevee"] = "moderee"
    content: str = ""
    exercises: list[ProgramExercise] = []


class ProgramSessionOut(ProgramSessionIn, ORM):
    id: int


class ProgramIn(BaseModel):
    name: str
    description: str = ""
    start_date: date
    weeks: int = Field(6, ge=1, le=52)
    progression_pct: float = 5.0
    deload_every: int = 4
    active: bool = True
    sessions: list[ProgramSessionIn] = []


class ProgramOut(ORM):
    id: int
    name: str
    description: str
    start_date: date
    weeks: int
    progression_pct: float
    deload_every: int
    active: bool
    sessions: list[ProgramSessionOut]


class GenerateRequest(BaseModel):
    name: str = "Mon programme"
    start_date: date
    weeks: int = Field(6, ge=1, le=24)
    available_days: list[int] = Field(description="Jours où je peux m'entraîner seul (0=lundi)")
    collective_days: list[int] = []
    match_day: int | None = 6
    focus: list[Category] = ["fractionne", "renforcement", "appuis", "technique_mur", "footing"]
    level: Literal["debutant", "intermediaire", "avance"] = "intermediaire"
    max_session_min: int = 60


class PlannedSession(BaseModel):
    date: date
    week_index: int
    deload: bool
    program_session: ProgramSessionOut
    scaled_duration_min: int
    done_session_id: int | None = None


# ---------- Séances réalisées ----------
class WorkoutIn(BaseModel):
    date: date
    category: Category
    title: str = ""
    duration_min: float = 0
    distance_km: float | None = None
    avg_hr: int | None = None
    max_hr: int | None = None
    calories: int | None = None
    rpe: int | None = Field(None, ge=1, le=10)
    notes: str = ""
    program_session_id: int | None = None
    details: dict = {}


class WorkoutOut(WorkoutIn, ORM):
    id: int
    source: str
    load: float = 0  # charge interne = durée × RPE (méthode sRPE de Foster)


# ---------- Sommeil ----------
class SleepIn(BaseModel):
    date: date
    bedtime: str | None = None
    wake_time: str | None = None
    duration_min: int
    quality: int | None = Field(None, ge=1, le=5)
    deep_min: int | None = None
    rem_min: int | None = None
    light_min: int | None = None
    awake_min: int | None = None
    resting_hr: int | None = None
    hrv_ms: int | None = None


class SleepOut(SleepIn, ORM):
    id: int
    source: str


class ImportResult(BaseModel):
    imported: int
    skipped: int
    items: list[str]
