"""Modèle de données (SQLAlchemy 2.0)."""
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

# Catégories de séance (ordre = ordre de couleur côté front)
CATEGORIES = [
    "footing",        # endurance fondamentale
    "fractionne",     # VMA, intermittent
    "renforcement",   # renfo musculaire, gainage
    "appuis",         # vitesse, coordination, échelle
    "technique_mur",  # contrôle orienté contre un mur
    "collectif",      # entraînement en club
    "match",
    "recuperation",   # étirements, mobilité, auto-massage
]


class Exercise(Base):
    __tablename__ = "exercises"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(30))
    description: Mapped[str] = mapped_column(Text, default="")
    default_sets: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_reps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_duration_s: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)


class Goal(Base):
    __tablename__ = "goals"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    # metric: sessions_count | duration_min | distance_km | sleep_avg_h | manual
    metric: Mapped[str] = mapped_column(String(30))
    category: Mapped[str | None] = mapped_column(String(30), nullable=True)
    period: Mapped[str] = mapped_column(String(10), default="week")  # week | total
    direction: Mapped[str] = mapped_column(String(10), default="increase")  # increase | decrease
    target_value: Mapped[float] = mapped_column(Float)
    baseline_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(20), default="")
    start_date: Mapped[date] = mapped_column(Date, default=date.today)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(12), default="active")  # active | done | archived
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    measurements: Mapped[list["GoalMeasurement"]] = relationship(
        back_populates="goal", cascade="all, delete-orphan", order_by="GoalMeasurement.date"
    )


class GoalMeasurement(Base):
    __tablename__ = "goal_measurements"
    id: Mapped[int] = mapped_column(primary_key=True)
    goal_id: Mapped[int] = mapped_column(ForeignKey("goals.id", ondelete="CASCADE"))
    date: Mapped[date] = mapped_column(Date)
    value: Mapped[float] = mapped_column(Float)
    note: Mapped[str] = mapped_column(Text, default="")
    goal: Mapped[Goal] = relationship(back_populates="measurements")


class Program(Base):
    __tablename__ = "programs"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    start_date: Mapped[date] = mapped_column(Date)
    weeks: Mapped[int] = mapped_column(Integer, default=6)
    progression_pct: Mapped[float] = mapped_column(Float, default=5.0)  # +x % de volume / semaine
    deload_every: Mapped[int] = mapped_column(Integer, default=4)  # semaine allégée toutes les n semaines (0 = jamais)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    sessions: Mapped[list["ProgramSession"]] = relationship(
        back_populates="program", cascade="all, delete-orphan", order_by="ProgramSession.day_of_week"
    )


class ProgramSession(Base):
    """Séance type de la semaine modèle (répétée chaque semaine avec progression)."""
    __tablename__ = "program_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id", ondelete="CASCADE"))
    day_of_week: Mapped[int] = mapped_column(Integer)  # 0 = lundi
    category: Mapped[str] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(160))
    duration_min: Mapped[int] = mapped_column(Integer, default=30)
    intensity: Mapped[str] = mapped_column(String(10), default="moderee")  # faible | moderee | elevee
    content: Mapped[str] = mapped_column(Text, default="")
    exercises: Mapped[list] = mapped_column(JSON, default=list)
    program: Mapped[Program] = relationship(back_populates="sessions")


class WorkoutSession(Base):
    """Séance réalisée (saisie manuelle ou import montre)."""
    __tablename__ = "workout_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    category: Mapped[str] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(160), default="")
    duration_min: Mapped[float] = mapped_column(Float, default=0)
    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_hr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_hr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    calories: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rpe: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1..10 ressenti d'effort
    notes: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(20), default="manuel")  # manuel | gpx | tcx | fit
    external_id: Mapped[str | None] = mapped_column(String(80), nullable=True, unique=True)
    program_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("program_sessions.id", ondelete="SET NULL"), nullable=True
    )
    details: Mapped[dict] = mapped_column(JSON, default=dict)


class SleepEntry(Base):
    __tablename__ = "sleep_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date, unique=True, index=True)  # date du réveil
    bedtime: Mapped[str | None] = mapped_column(String(5), nullable=True)  # "23:15"
    wake_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    duration_min: Mapped[int] = mapped_column(Integer)
    quality: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1..5
    deep_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rem_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    light_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    awake_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resting_hr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hrv_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str] = mapped_column(String(20), default="manuel")
