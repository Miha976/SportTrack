import { useMemo, useState } from 'react'
import { CATEGORIES } from '../models/catalog'
import { fmtShort } from '../models/dates'
import { goalRepository, statsRepository } from '../services/repositories'
import { useResource } from './useResource'

export function useProgressViewModel() {
  const [weeks, setWeeks] = useState(12)
  const weekly = useResource(() => statsRepository.weekly(weeks), [weeks])
  const goals = useResource(() => goalRepository.list())

  const rows = useMemo(
    () => (weekly.data ?? []).map((w) => ({
      label: fmtShort(w.week_start),
      ...w.minutes_by_category,
      total: w.total_minutes,
      load: w.load,
      km: w.distance_km,
      pace: w.footing_pace_min_km,
      sleep: w.sleep_avg_h,
      adherence: w.planned ? Math.round((w.planned_done / w.planned) * 100) : null,
      planned: w.planned,
      done: w.planned_done,
    })),
    [weekly.data],
  )

  /** N'afficher dans la légende que les catégories réellement pratiquées. */
  const usedCategories = useMemo(
    () => CATEGORIES.filter((c) => (weekly.data ?? []).some((w) => w.minutes_by_category[c.key] > 0)),
    [weekly.data],
  )

  const summary = useMemo(() => {
    const w = weekly.data ?? []
    const half = Math.floor(w.length / 2)
    const sum = (xs: typeof w, k: 'total_minutes' | 'distance_km' | 'sessions') => xs.reduce((a, x) => a + x[k], 0)
    const first = w.slice(0, half)
    const second = w.slice(half)
    const delta = (k: 'total_minutes' | 'distance_km' | 'sessions') => {
      const a = sum(first, k)
      return a ? Math.round(((sum(second, k) - a) / a) * 100) : null
    }
    const planned = w.reduce((a, x) => a + x.planned, 0)
    return {
      totalMinutes: sum(w, 'total_minutes'), totalKm: sum(w, 'distance_km'), sessions: sum(w, 'sessions'),
      minutesDelta: delta('total_minutes'), kmDelta: delta('distance_km'),
      adherence: planned ? Math.round((w.reduce((a, x) => a + x.planned_done, 0) / planned) * 100) : null,
    }
  }, [weekly.data])

  const measuredGoals = useMemo(() => (goals.data ?? []).filter((g) => g.metric === 'manual' && g.measurements.length > 0), [goals.data])

  return {
    weeks, setWeeks, rows, usedCategories, summary, measuredGoals,
    loading: weekly.loading, error: weekly.error ?? goals.error,
  }
}
