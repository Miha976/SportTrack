import { useMemo, useState } from 'react'
import { fmtShort, minutesBetween, todayISO } from '../models/dates'
import type { SleepEntry, SleepInput } from '../models/types'
import { sleepRepository } from '../services/repositories'
import { useCommand, useResource } from './useResource'

export const SLEEP_TARGET_H = 8

const emptySleep = (): SleepInput => ({
  date: todayISO(), bedtime: '23:00', wake_time: '07:00', duration_min: 480, quality: 3, deep_min: null,
  rem_min: null, light_min: null, awake_min: null, resting_hr: null, hrv_ms: null,
})

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return ((h + 12) % 24) * 60 + m } // pivot à midi

export function useSleepViewModel() {
  const res = useResource(() => sleepRepository.list(60))
  const cmd = useCommand()
  const [editing, setEditing] = useState<SleepInput | null>(null)

  const nights = res.data ?? []
  const chron = useMemo(() => [...nights].reverse().slice(-28), [nights])

  const stats = useMemo(() => {
    const last7 = nights.slice(0, 7)
    const last28 = nights.slice(0, 28)
    const beds = last28.filter((n) => n.bedtime).map((n) => toMin(n.bedtime!))
    const m = avg(beds)
    const sd = m === null ? null : Math.sqrt(avg(beds.map((b) => (b - m) ** 2)) ?? 0)
    return {
      avg7: avg(last7.map((n) => n.duration_min / 60)),
      avg28: avg(last28.map((n) => n.duration_min / 60)),
      quality7: avg(last7.filter((n) => n.quality).map((n) => n.quality!)),
      bedtimeSd: sd, // régularité du coucher, en minutes
      hrv7: avg(last7.filter((n) => n.hrv_ms).map((n) => n.hrv_ms!)),
      rhr7: avg(last7.filter((n) => n.resting_hr).map((n) => n.resting_hr!)),
      debt7: last7.reduce((a, n) => a + (SLEEP_TARGET_H * 60 - n.duration_min), 0) / 60,
    }
  }, [nights])

  const chartData = useMemo(
    () => chron.map((n) => ({
      label: fmtShort(n.date), date: n.date, hours: +(n.duration_min / 60).toFixed(2),
      deep: n.deep_min, rem: n.rem_min, light: n.light_min, awake: n.awake_min,
      hrv: n.hrv_ms, rhr: n.resting_hr, quality: n.quality,
    })),
    [chron],
  )
  const hasStages = chron.some((n) => n.deep_min)
  const hasHrv = chron.some((n) => n.hrv_ms)

  return {
    nights, stats, chartData, hasStages, hasHrv, editing, loading: res.loading, busy: cmd.busy,
    error: res.error ?? cmd.error,
    openCreate: () => setEditing(emptySleep()),
    openEdit: (n: SleepEntry) => { const { id: _i, source: _s, ...form } = n; void _i; void _s; setEditing(form) },
    update: (patch: Partial<SleepInput>) =>
      setEditing((e) => {
        if (!e) return e
        const next = { ...e, ...patch }
        if ((patch.bedtime || patch.wake_time) && next.bedtime && next.wake_time)
          next.duration_min = minutesBetween(next.bedtime, next.wake_time) - (next.awake_min ?? 0)
        return next
      }),
    close: () => setEditing(null),
    save: () => cmd.run(async () => { if (editing) { await sleepRepository.save(editing); setEditing(null); await res.reload() } }),
    remove: (n: SleepEntry) => cmd.run(async () => { await sleepRepository.remove(n.id); await res.reload() }),
  }
}
