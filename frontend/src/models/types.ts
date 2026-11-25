// ===== Modèle (M de MVVM) : types du domaine, miroir des schémas de l'API =====

export type Category =
  | 'footing'
  | 'fractionne'
  | 'renforcement'
  | 'appuis'
  | 'technique_mur'
  | 'collectif'
  | 'match'
  | 'recuperation'

export type Metric = 'sessions_count' | 'duration_min' | 'distance_km' | 'sleep_avg_h' | 'manual'
export type Intensity = 'faible' | 'moderee' | 'elevee'
export type Level = 'debutant' | 'intermediaire' | 'avance'
export type ISODate = string

export interface Exercise {
  id: number
  name: string
  category: Category
  description: string
  default_sets: number | null
  default_reps: number | null
  default_duration_s: number | null
  is_custom: boolean
}

export interface Measurement {
  id: number
  date: ISODate
  value: number
  note: string
}

export interface GoalInput {
  title: string
  metric: Metric
  category: Category | null
  period: 'week' | 'total'
  direction: 'increase' | 'decrease'
  target_value: number
  baseline_value: number | null
  unit: string
  start_date: ISODate
  deadline: ISODate | null
  status: 'active' | 'done' | 'archived'
}

export interface Goal extends GoalInput {
  id: number
  current_value: number | null
  progress_pct: number
  measurements: Measurement[]
}

export interface ProgramExercise {
  name: string
  sets?: number | null
  reps?: number | null
  duration_s?: number | null
  note?: string
}

export interface ProgramSessionInput {
  day_of_week: number
  category: Category
  title: string
  duration_min: number
  intensity: Intensity
  content: string
  exercises: ProgramExercise[]
}

export interface ProgramSession extends ProgramSessionInput {
  id: number
}

export interface Program {
  id: number
  name: string
  description: string
  start_date: ISODate
  weeks: number
  progression_pct: number
  deload_every: number
  active: boolean
  sessions: ProgramSession[]
}

export type ProgramInput = Omit<Program, 'id' | 'sessions'> & { sessions?: ProgramSessionInput[] }

export interface GenerateRequest {
  name: string
  start_date: ISODate
  weeks: number
  available_days: number[]
  collective_days: number[]
  match_day: number | null
  focus: Category[]
  level: Level
  max_session_min: number
}

export interface PlannedSession {
  date: ISODate
  week_index: number
  deload: boolean
  program_session: ProgramSession
  scaled_duration_min: number
  done_session_id: number | null
}

export interface WorkoutInput {
  date: ISODate
  category: Category
  title: string
  duration_min: number
  distance_km: number | null
  avg_hr: number | null
  max_hr: number | null
  calories: number | null
  rpe: number | null
  notes: string
  program_session_id: number | null
  details: Record<string, number | string>
}

export interface Workout extends WorkoutInput {
  id: number
  source: 'manuel' | 'gpx' | 'tcx' | 'fit'
  load: number
}

export interface SleepInput {
  date: ISODate
  bedtime: string | null
  wake_time: string | null
  duration_min: number
  quality: number | null
  deep_min: number | null
  rem_min: number | null
  light_min: number | null
  awake_min: number | null
  awakenings: number | null
  resting_hr: number | null
  hrv_ms: number | null
}

export interface SleepEntry extends SleepInput {
  id: number
  source: string
}

export interface ReadinessFactor {
  label: string
  delta: number
}

export type AcwrZone = 'inconnu' | 'sous-charge' | 'optimal' | 'vigilance' | 'risque'

export interface Readiness {
  score: number
  advice: string
  factors: ReadinessFactor[]
  acwr: number | null
  acwr_zone: AcwrZone
}

export interface WeekStats {
  week_start: ISODate
  minutes_by_category: Record<Category, number>
  total_minutes: number
  distance_km: number
  load: number
  sessions: number
  sleep_avg_h: number | null
  footing_pace_min_km: number | null
  planned: number
  planned_done: number
}

export interface LoadPoint {
  date: ISODate
  load: number
  acute: number
  chronic: number
  acwr: number | null
}

export interface Dashboard {
  readiness: Readiness
  this_week: WeekStats
  last_week: WeekStats
  today_plan: PlannedSession[]
  week_plan: PlannedSession[]
  sleep_avg_h_7d: number | null
  streak_days: number
  goals: Goal[]
}

export interface ImportResult {
  imported: number
  skipped: number
  items: string[]
}
