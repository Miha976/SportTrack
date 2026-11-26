// Repositories sans serveur : même contrat que httpRepositories, données en local.
import { addDays, mondayOf, todayISO } from '../../models/dates'
import type {
  Dashboard, Exercise, GenerateRequest, Goal, GoalInput, ImportResult, LoadPoint, PlannedSession, Program,
  ProgramInput, ProgramSession, ProgramSessionInput, Readiness, SleepEntry, SleepInput, WeekStats, Workout, WorkoutInput,
} from '../../models/types'
import type * as Http from '../httpRepositories'
import { exportState, flush, monthKey, newId, parseBackup, replaceAll, S, storeInfo, touch, type WorkoutRec } from './db'
import { generateWeek } from './generator'
import { parseActivity, parseSleepCsv } from './importers'
import { demoState, seedExercises } from './seed'
import * as St from './stats'

const clone = <T,>(x: T): T => structuredClone(x)
const notFound = (what: string) => new Error(`${what} introuvable`)
const save = async (...keys: string[]) => { touch(...keys); await flush() }
const sortDesc = <T extends { date: string; id: number }>(xs: T[]) =>
  [...xs].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)

const workoutOut = (w: WorkoutRec): Workout => {
  const { external_id: _e, ...rest } = clone(w)
  void _e
  return { ...rest, load: St.sessionLoad(w) }
}

// ------------------------------------------------------------------ Objectifs
export const goalRepository: typeof Http.goalRepository = {
  list: async (status) => {
    const order = { active: 0, done: 1, archived: 2 }
    return S().goals.filter((g) => !status || g.status === status)
      .sort((a, b) => order[a.status] - order[b.status] || b.id - a.id).map(St.goalOut)
  },
  create: async (g: GoalInput) => {
    const rec = { ...clone(g), id: newId(), measurements: [] }
    S().goals.push(rec)
    await save('goals')
    return St.goalOut(rec)
  },
  update: async (id: number, g: GoalInput) => {
    const rec = S().goals.find((x) => x.id === id)
    if (!rec) throw notFound('Objectif')
    Object.assign(rec, clone(g))
    await save('goals')
    return St.goalOut(rec)
  },
  remove: async (id) => {
    S().goals = S().goals.filter((g) => g.id !== id)
    await save('goals')
  },
  addMeasurement: async (id, m) => {
    const rec = S().goals.find((x) => x.id === id)
    if (!rec) throw notFound('Objectif')
    rec.measurements.push({ id: newId(), date: m.date, value: m.value, note: m.note ?? '' })
    rec.measurements.sort((a, b) => a.date.localeCompare(b.date))
    const out: Goal = St.goalOut(rec)
    if (out.progress_pct >= 100 && rec.status === 'active') { rec.status = 'done'; out.status = 'done' }
    await save('goals', 'meta')
    return out
  },
  removeMeasurement: async (id, mid) => {
    const rec = S().goals.find((x) => x.id === id)
    if (rec) rec.measurements = rec.measurements.filter((m) => m.id !== mid)
    await save('goals')
  },
}

// ------------------------------------------------------------------ Programmes
const deactivateOthers = (keep?: number) => S().programs.forEach((p) => { if (p.id !== keep) p.active = false })
const findProgram = (id: number) => { const p = S().programs.find((x) => x.id === id); if (!p) throw notFound('Programme'); return p }
const sortSessions = (p: Program) => p.sessions.sort((a, b) => a.day_of_week - b.day_of_week || a.id - b.id)

export const programRepository: typeof Http.programRepository = {
  list: async () => clone([...S().programs].sort((a, b) => Number(b.active) - Number(a.active) || b.id - a.id)),
  planning: async (start: string, days = 7): Promise<PlannedSession[]> => St.plannedSessions(start, addDays(start, days - 1)),
  create: async (p: ProgramInput) => {
    const rec: Program = { ...clone(p), id: newId(), sessions: (p.sessions ?? []).map((s) => ({ ...clone(s), id: newId() })) }
    if (rec.active) deactivateOthers()
    S().programs.push(rec)
    sortSessions(rec)
    await save('programs')
    return clone(rec)
  },
  update: async (id: number, p: ProgramInput) => {
    const rec = findProgram(id)
    const { sessions: _s, ...fields } = clone(p) as ProgramInput & { id?: number }
    void _s
    delete (fields as { id?: number }).id
    Object.assign(rec, fields)
    if (rec.active) deactivateOthers(rec.id)
    await save('programs')
    return clone(rec)
  },
  remove: async (id) => {
    S().programs = S().programs.filter((p) => p.id !== id)
    await save('programs')
  },
  generate: async (r: GenerateRequest) => {
    const { sessions, notes } = generateWeek(r)
    deactivateOthers()
    const rec: Program = {
      id: newId(), name: r.name, start_date: r.start_date, weeks: r.weeks, progression_pct: 5, deload_every: 4, active: true,
      description: `Généré · niveau ${r.level} · focus : ${r.focus.join(', ')}`, sessions: sessions.map((s) => ({ ...s, id: newId() })),
    }
    S().programs.push(rec)
    await save('programs')
    return { program: clone(rec), notes }
  },
  addSession: async (pid, s: ProgramSessionInput) => {
    const p = findProgram(pid)
    const rec: ProgramSession = { ...clone(s), id: newId() }
    p.sessions.push(rec)
    sortSessions(p)
    await save('programs')
    return clone(rec)
  },
  updateSession: async (pid, sid, s) => {
    const p = findProgram(pid)
    const rec = p.sessions.find((x) => x.id === sid)
    if (!rec) throw notFound('Séance')
    Object.assign(rec, clone(s))
    sortSessions(p)
    await save('programs')
    return clone(rec)
  },
  removeSession: async (pid, sid) => {
    const p = findProgram(pid)
    p.sessions = p.sessions.filter((x) => x.id !== sid)
    S().workouts.forEach((w) => { if (w.program_session_id === sid) { w.program_session_id = null; touch(monthKey('workouts', w.date)) } })
    await save('programs')
  },
}

// ------------------------------------------------------------------ Séances
export const workoutRepository: typeof Http.workoutRepository = {
  list: async (p = {}) => {
    const cats = p.category?.split(',')
    const ws = S().workouts.filter((w) => (!p.start || w.date >= p.start) && (!p.end || w.date <= p.end) && (!cats || cats.includes(w.category)))
    return sortDesc(ws).slice(0, p.limit ?? 200).map(workoutOut)
  },
  create: async (w: WorkoutInput) => {
    const rec: WorkoutRec = { ...clone(w), id: newId(), source: 'manuel' }
    S().workouts.push(rec)
    await save(monthKey('workouts', rec.date))
    return workoutOut(rec)
  },
  update: async (id, w) => {
    const rec = S().workouts.find((x) => x.id === id)
    if (!rec) throw notFound('Séance')
    const old = monthKey('workouts', rec.date)
    Object.assign(rec, clone(w))
    await save(old, monthKey('workouts', rec.date))
    return workoutOut(rec)
  },
  remove: async (id) => {
    const rec = S().workouts.find((x) => x.id === id)
    S().workouts = S().workouts.filter((x) => x.id !== id)
    if (rec) await save(monthKey('workouts', rec.date))
  },
}

// ------------------------------------------------------------------ Sommeil
export const sleepRepository: typeof Http.sleepRepository = {
  list: async (limit = 60) => sortDesc(S().sleep).slice(0, limit).map(clone),
  save: async (s: SleepInput, id?: number) => {
    const isNight = (x: SleepEntry) => (x.kind ?? 'night') === 'night'
    let rec = id !== undefined ? S().sleep.find((x) => x.id === id)
      : s.kind === 'night' ? S().sleep.find((x) => x.date === s.date && isNight(x)) : undefined
    if (id !== undefined && !rec) throw notFound('Entrée de sommeil')
    if (s.kind === 'night' && S().sleep.some((x) => x.date === s.date && isNight(x) && x !== rec)) {
      throw new Error('Une nuit existe déjà à cette date')
    }
    const oldKey = rec ? monthKey('sleep', rec.date) : null
    if (!rec) { rec = { ...clone(s), id: newId(), source: 'manuel' }; S().sleep.push(rec) } else Object.assign(rec, clone(s))
    await save(monthKey('sleep', s.date), ...(oldKey ? [oldKey] : []))
    return clone(rec) as SleepEntry
  },
  remove: async (id) => {
    const rec = S().sleep.find((x) => x.id === id)
    S().sleep = S().sleep.filter((x) => x.id !== id)
    if (rec) await save(monthKey('sleep', rec.date))
  },
}

// ------------------------------------------------------------------ Stats
export const statsRepository: typeof Http.statsRepository = {
  dashboard: async (): Promise<Dashboard> => {
    const today = todayISO()
    const ws = mondayOf(today)
    const week = St.weeklyStats(2)
    const nights = St.sleepBetween(addDays(today, -6), today)
    const done = new Set(St.sessionsBetween(addDays(today, -60), today).map((w) => w.date))
    let streak = 0
    let d = done.has(today) ? today : addDays(today, -1)
    while (done.has(d)) { streak++; d = addDays(d, -1) }
    return {
      readiness: St.readiness(), this_week: week[1], last_week: week[0],
      today_plan: St.plannedSessions(today, today), week_plan: St.plannedSessions(ws, addDays(ws, 6)),
      sleep_avg_h_7d: nights.length ? Math.round((nights.reduce((a, n) => a + n.duration_min, 0) / nights.length / 60) * 100) / 100 : null,
      streak_days: streak,
      goals: S().goals.filter((g) => g.status === 'active').map(St.goalOut),
    }
  },
  weekly: async (weeks = 12): Promise<WeekStats[]> => St.weeklyStats(weeks),
  load: async (days = 56): Promise<LoadPoint[]> => St.loadSeries(days),
  readiness: async (): Promise<Readiness> => St.readiness(),
}

export const exerciseRepository: typeof Http.exerciseRepository = {
  list: async (category) => clone(S().exercises.filter((e) => !category || e.category === category)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, 'fr'))) as Exercise[],
}

// ------------------------------------------------------------------ Import
export const importRepository: typeof Http.importRepository = {
  activities: async (files: File[]): Promise<ImportResult> => {
    let imported = 0, skipped = 0
    const items: string[] = []
    const keys = new Set<string>()
    for (const f of files) {
      try {
        for (const a of parseActivity(f.name, new Uint8Array(await f.arrayBuffer()))) {
          if (S().workouts.some((w) => w.external_id && w.external_id === a.external_id)) {
            skipped++; items.push(`${f.name} : déjà importé`); continue
          }
          const rec: WorkoutRec = { ...a, id: newId() }
          S().workouts.push(rec)
          keys.add(monthKey('workouts', rec.date))
          imported++
          items.push(`${f.name} : ${a.date} · ${a.distance_km ? `${a.distance_km} km, ` : ''}${a.duration_min} min`)
        }
      } catch (e) {
        skipped++
        items.push(`${f.name} : erreur — ${e instanceof Error ? e.message : e}`)
      }
    }
    await save(...keys)
    return { imported, skipped, items }
  },
  sleep: async (file: File): Promise<ImportResult> => {
    const rows = parseSleepCsv(await file.text())
    let imported = 0
    const keys = new Set<string>()
    for (const r of rows) {
      if (!r.duration_min || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue
      const existing = r.kind === 'night' ? S().sleep.find((x) => x.date === r.date && (x.kind ?? 'night') === 'night') : undefined
      if (existing) Object.assign(existing, r, { source: 'csv' })
      else S().sleep.push({ ...r, id: newId(), source: 'csv' })
      keys.add(monthKey('sleep', r.date))
      imported++
    }
    await save(...keys)
    return { imported, skipped: rows.length - imported, items: [] }
  },
}

// ------------------------------------------------------------------ Données (sauvegarde, démo, reset)
export const dataRepository = {
  info: () => ({ ...storeInfo(), counts: { séances: S().workouts.length, nuits: S().sleep.length, objectifs: S().goals.length, programmes: S().programs.length } }),
  isEmpty: () => !S().workouts.length && !S().goals.length && !S().programs.length && !S().sleep.length,
  exportJson: () => exportState(),
  importJson: async (text: string) => replaceAll(parseBackup(text)),
  loadDemo: async () => replaceAll(demoState()),
  reset: async () => replaceAll({ nextId: 100, exercises: seedExercises(), goals: [], programs: [], workouts: [], sleep: [] }),
}
