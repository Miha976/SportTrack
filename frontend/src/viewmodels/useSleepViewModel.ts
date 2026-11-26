import { useMemo, useState } from 'react'
import { addDays, fmtShort, minutesBetween, todayISO } from '../models/dates'
import { isNap, sleepInsights } from '../models/sleepInsights'
import type { SleepEntry, SleepInput, SleepKind } from '../models/types'
import { sleepRepository, workoutRepository } from '../services/repositories'
import { useCommand, useResource } from './useResource'

export const SLEEP_TARGET_H = 8

const emptyEntry = (kind: SleepKind): SleepInput => ({
  date: todayISO(), kind,
  bedtime: kind === 'nap' ? '14:00' : '23:00', wake_time: kind === 'nap' ? '14:25' : '07:00',
  duration_min: kind === 'nap' ? 25 : 480, quality: kind === 'nap' ? null : 3,
  deep_min: null, rem_min: null, light_min: null, awake_min: null, awakenings: null, resting_hr: null, hrv_ms: null,
})

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return ((h + 12) % 24) * 60 + m } // pivot à midi

export function useSleepViewModel() {
  const res = useResource(() => sleepRepository.list(120))
  const workouts = useResource(() => workoutRepository.list({ start: addDays(todayISO(), -60), limit: 500 }))
  const cmd = useCommand()
  const [editing, setEditing] = useState<{ id: number | null; form: SleepInput } | null>(null)

  const entries = res.data ?? []
  /** Les statistiques portent sur les nuits ; les siestes sont suivies à part. */
  const nights = useMemo(() => entries.filter((n) => !isNap(n)), [entries])
  const naps = useMemo(() => entries.filter(isNap), [entries])
  const chron = useMemo(() => [...nights].reverse().slice(-28), [nights])

  const stats = useMemo(() => {
    const last7 = nights.slice(0, 7)
    const last28 = nights.slice(0, 28)
    const beds = last28.filter((n) => n.bedtime).map((n) => toMin(n.bedtime!))
    const m = avg(beds)
    const sd = m === null ? null : Math.sqrt(avg(beds.map((b) => (b - m) ** 2)) ?? 0)
    const from = last7.length ? last7[last7.length - 1].date : todayISO()
    const recentNaps = naps.filter((n) => n.date >= from)
    return {
      avg7: avg(last7.map((n) => n.duration_min / 60)),
      avg28: avg(last28.map((n) => n.duration_min / 60)),
      quality7: avg(last7.filter((n) => n.quality).map((n) => n.quality!)),
      bedtimeSd: sd, // régularité du coucher, en minutes
      hrv7: avg(last7.filter((n) => n.hrv_ms).map((n) => n.hrv_ms!)),
      rhr7: avg(last7.filter((n) => n.resting_hr).map((n) => n.resting_hr!)),
      debt7: last7.reduce((a, n) => a + (SLEEP_TARGET_H * 60 - n.duration_min), 0) / 60,
      napMin7: recentNaps.reduce((a, n) => a + n.duration_min, 0),
      napCount7: recentNaps.length,
    }
  }, [nights, naps])

  const chartData = useMemo(() => {
    const napByDate = new Map<string, number>()
    naps.forEach((n) => napByDate.set(n.date, (napByDate.get(n.date) ?? 0) + n.duration_min))
    return chron.map((n) => ({
      label: fmtShort(n.date), date: n.date, hours: +(n.duration_min / 60).toFixed(2),
      nap: napByDate.has(n.date) ? +(napByDate.get(n.date)! / 60).toFixed(2) : null,
      deep: n.deep_min, rem: n.rem_min, light: n.light_min, awake: n.awake_min,
      hrv: n.hrv_ms, rhr: n.resting_hr, quality: n.quality,
    }))
  }, [chron, naps])

  /** Conseils recalculés à chaque saisie. */
  const insights = useMemo(() => sleepInsights(entries, workouts.data ?? []), [entries, workouts.data])

  return {
    entries, nights, naps, stats, chartData, insights, editing, loading: res.loading, busy: cmd.busy,
    hasStages: chron.some((n) => n.deep_min), hasHrv: chron.some((n) => n.hrv_ms), hasNaps: naps.length > 0,
    error: res.error ?? cmd.error,
    openCreate: (kind: SleepKind = 'night') => setEditing({ id: null, form: emptyEntry(kind) }),
    openEdit: (n: SleepEntry) => {
      const { id, source: _s, ...form } = n
      void _s
      setEditing({ id, form: { ...form, kind: form.kind ?? 'night' } })
    },
    update: (patch: Partial<SleepInput>) =>
      setEditing((e) => {
        if (!e) return e
        const next = { ...e.form, ...patch }
        if (patch.kind === 'nap') Object.assign(next, { deep_min: null, rem_min: null, light_min: null, resting_hr: null, hrv_ms: null, awakenings: null })
        if ((patch.bedtime || patch.wake_time || 'awake_min' in patch) && next.bedtime && next.wake_time)
          next.duration_min = Math.max(0, minutesBetween(next.bedtime, next.wake_time) - (next.awake_min ?? 0))
        return { ...e, form: next }
      }),
    close: () => setEditing(null),
    save: () =>
      cmd.run(async () => {
        if (!editing) return
        if (editing.form.duration_min <= 0) throw new Error('La durée doit être positive')
        if (!editing.id && editing.form.kind === 'night' && nights.some((n) => n.date === editing.form.date)) {
          throw new Error('Une nuit existe déjà à cette date : modifie-la dans l’historique (ou choisis « Sieste »).')
        }
        await sleepRepository.save(editing.form, editing.id ?? undefined)
        setEditing(null)
        await res.reload()
      }),
    remove: (n: SleepEntry) => cmd.run(async () => { await sleepRepository.remove(n.id); await res.reload() }),
  }
}
