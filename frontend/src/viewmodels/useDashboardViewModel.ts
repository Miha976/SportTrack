import { useMemo } from 'react'
import { addDays, mondayOf, todayISO } from '../models/dates'
import type { PlannedSession } from '../models/types'
import { statsRepository, workoutRepository } from '../services/repositories'
import { defaultRpe } from './workoutDefaults'
import { useCommand, useResource } from './useResource'

export function useDashboardViewModel() {
  const res = useResource(() => statsRepository.dashboard())
  const cmd = useCommand()
  const d = res.data

  const weekDays = useMemo(() => {
    const start = mondayOf(todayISO())
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i)
      return { date, isToday: date === todayISO(), planned: d?.week_plan.filter((p) => p.date === date) ?? [] }
    })
  }, [d])

  /** Valide une séance planifiée en un clic (durée prévue, RPE par défaut). */
  const markDone = (p: PlannedSession) =>
    cmd.run(async () => {
      const ps = p.program_session
      await workoutRepository.create({
        date: p.date, category: ps.category, title: ps.title, duration_min: p.scaled_duration_min,
        distance_km: null, avg_hr: null, max_hr: null, calories: null, rpe: defaultRpe(ps.intensity),
        notes: '', program_session_id: ps.id, details: {},
      })
      await res.reload()
    })

  return { data: d, reload: res.reload, loading: res.loading, error: res.error ?? cmd.error, weekDays, markDone, busy: cmd.busy }
}
