// Repositories : seul point d'accès aux données pour les ViewModels.
import type {
  Dashboard, Exercise, GenerateRequest, Goal, GoalInput, ImportResult, LoadPoint, PlannedSession, Program,
  ProgramInput, ProgramSession, ProgramSessionInput, Readiness, SleepEntry, SleepInput, WeekStats, Workout,
  WorkoutInput,
} from '../models/types'
import { http, qs } from './http'

export const goalRepository = {
  list: (status?: string) => http.get<Goal[]>(`/goals${qs({ status })}`),
  create: (g: GoalInput) => http.post<Goal>('/goals', g),
  update: (id: number, g: GoalInput) => http.put<Goal>(`/goals/${id}`, g),
  remove: (id: number) => http.del(`/goals/${id}`),
  addMeasurement: (id: number, m: { date: string; value: number; note?: string }) =>
    http.post<Goal>(`/goals/${id}/measurements`, m),
  removeMeasurement: (id: number, mid: number) => http.del(`/goals/${id}/measurements/${mid}`),
}

export const programRepository = {
  list: () => http.get<Program[]>('/programs'),
  planning: (start: string, days = 7) => http.get<PlannedSession[]>(`/programs/planning${qs({ start, days })}`),
  create: (p: ProgramInput) => http.post<Program>('/programs', p),
  update: (id: number, p: ProgramInput) => http.put<Program>(`/programs/${id}`, p),
  remove: (id: number) => http.del(`/programs/${id}`),
  generate: (r: GenerateRequest) => http.post<{ program: Program; notes: string[] }>('/programs/generate', r),
  addSession: (pid: number, s: ProgramSessionInput) => http.post<ProgramSession>(`/programs/${pid}/sessions`, s),
  updateSession: (pid: number, sid: number, s: ProgramSessionInput) =>
    http.put<ProgramSession>(`/programs/${pid}/sessions/${sid}`, s),
  removeSession: (pid: number, sid: number) => http.del(`/programs/${pid}/sessions/${sid}`),
}

export const workoutRepository = {
  list: (p: { start?: string; end?: string; category?: string; limit?: number } = {}) =>
    http.get<Workout[]>(`/sessions${qs(p)}`),
  create: (w: WorkoutInput) => http.post<Workout>('/sessions', w),
  update: (id: number, w: WorkoutInput) => http.put<Workout>(`/sessions/${id}`, w),
  remove: (id: number) => http.del(`/sessions/${id}`),
}

export const sleepRepository = {
  list: (limit = 60) => http.get<SleepEntry[]>(`/sleep${qs({ limit })}`),
  save: (s: SleepInput) => http.post<SleepEntry>('/sleep', s),
  remove: (id: number) => http.del(`/sleep/${id}`),
}

export const statsRepository = {
  dashboard: () => http.get<Dashboard>('/stats/dashboard'),
  weekly: (weeks = 12) => http.get<WeekStats[]>(`/stats/weekly${qs({ weeks })}`),
  load: (days = 56) => http.get<LoadPoint[]>(`/stats/load${qs({ days })}`),
  readiness: () => http.get<Readiness>('/stats/readiness'),
}

export const exerciseRepository = {
  list: (category?: string) => http.get<Exercise[]>(`/exercises${qs({ category })}`),
}

export const importRepository = {
  activities: (files: File[]) => {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    return http.post<ImportResult>('/import/activity', fd)
  },
  sleep: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return http.post<ImportResult>('/import/sleep', fd)
  },
}
