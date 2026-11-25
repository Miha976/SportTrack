import { useMemo, useState } from 'react'
import type { Category, Workout, WorkoutInput } from '../models/types'
import { workoutRepository } from '../services/repositories'
import { emptyWorkout } from './workoutDefaults'
import { useCommand, useResource } from './useResource'

export function useSessionsViewModel() {
  const [filter, setFilter] = useState<Category | null>(null)
  const res = useResource(() => workoutRepository.list({ category: filter ?? undefined, limit: 300 }), [filter])
  const cmd = useCommand()
  const [editing, setEditing] = useState<{ id: number | null; form: WorkoutInput } | null>(null)

  const grouped = useMemo(() => {
    const m = new Map<string, Workout[]>()
    for (const w of res.data ?? []) m.set(w.date, [...(m.get(w.date) ?? []), w])
    return [...m.entries()]
  }, [res.data])

  const totals = useMemo(() => {
    const list = res.data ?? []
    return {
      count: list.length,
      minutes: list.reduce((a, w) => a + w.duration_min, 0),
      km: list.reduce((a, w) => a + (w.distance_km ?? 0), 0),
    }
  }, [res.data])

  return {
    grouped, totals, filter, setFilter, loading: res.loading, error: res.error ?? cmd.error, busy: cmd.busy,
    editing,
    openCreate: (c?: Category) => setEditing({ id: null, form: emptyWorkout(c ?? filter ?? 'footing') }),
    openEdit: (w: Workout) => {
      const { id, source: _s, load: _l, ...form } = w
      void _s; void _l
      setEditing({ id, form })
    },
    updateForm: (patch: Partial<WorkoutInput>) => setEditing((e) => e && { ...e, form: { ...e.form, ...patch } }),
    updateDetail: (k: string, v: number | string) =>
      setEditing((e) => e && { ...e, form: { ...e.form, details: { ...e.form.details, [k]: v } } }),
    close: () => setEditing(null),
    save: () =>
      cmd.run(async () => {
        if (!editing) return
        if (editing.form.duration_min <= 0) throw new Error('La durée doit être positive')
        if (editing.id) await workoutRepository.update(editing.id, editing.form)
        else await workoutRepository.create(editing.form)
        setEditing(null)
        await res.reload()
      }),
    remove: (w: Workout) => cmd.run(async () => { await workoutRepository.remove(w.id); setEditing(null); await res.reload() }),
  }
}
