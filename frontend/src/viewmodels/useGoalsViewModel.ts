import { useMemo, useState } from 'react'
import { todayISO } from '../models/dates'
import type { Goal, GoalInput } from '../models/types'
import { goalRepository } from '../services/repositories'
import { useCommand, useResource } from './useResource'

export type GoalTab = 'active' | 'done' | 'archived'

export const emptyGoal = (): GoalInput => ({
  title: '', metric: 'manual', category: null, period: 'week', direction: 'increase', target_value: 0,
  baseline_value: null, unit: '', start_date: todayISO(), deadline: null, status: 'active',
})

/** Modèles d'objectifs adaptés au foot amateur. */
export const GOAL_PRESETS: { label: string; goal: Partial<GoalInput> }[] = [
  { label: '3 séances perso / semaine', goal: { title: '3 séances perso par semaine', metric: 'sessions_count', period: 'week', target_value: 3, unit: 'séances' } },
  { label: 'Km de footing / semaine', goal: { title: '15 km de footing par semaine', metric: 'distance_km', category: 'footing', period: 'week', target_value: 15, unit: 'km' } },
  { label: 'Minutes de technique / sem.', goal: { title: '60 min de technique au mur par semaine', metric: 'duration_min', category: 'technique_mur', period: 'week', target_value: 60, unit: 'min' } },
  { label: 'Sommeil moyen', goal: { title: 'Dormir 8 h en moyenne', metric: 'sleep_avg_h', period: 'week', target_value: 8, unit: 'h' } },
  { label: 'VMA (test)', goal: { title: 'VMA à 17 km/h', metric: 'manual', target_value: 17, baseline_value: 15, unit: 'km/h' } },
  { label: 'Sprint 30 m', goal: { title: 'Sprint 30 m sous 4,3 s', metric: 'manual', direction: 'decrease', target_value: 4.3, baseline_value: 4.7, unit: 's' } },
  { label: 'Contrôles au mur / 60 s', goal: { title: 'Contrôles orientés réussis en 60 s', metric: 'manual', target_value: 40, baseline_value: 25, unit: 'contrôles' } },
  { label: 'Gainage max', goal: { title: 'Gainage frontal 3 min', metric: 'manual', target_value: 180, baseline_value: 90, unit: 's' } },
  { label: 'Jongles', goal: { title: '100 jongles sans faire tomber', metric: 'manual', target_value: 100, baseline_value: 30, unit: 'jongles' } },
]

export function useGoalsViewModel() {
  const res = useResource(() => goalRepository.list())
  const cmd = useCommand()
  const [tab, setTab] = useState<GoalTab>('active')
  const [editing, setEditing] = useState<{ id: number | null; form: GoalInput } | null>(null)

  const goals = useMemo(() => (res.data ?? []).filter((g) => g.status === tab), [res.data, tab])
  const counts = useMemo(() => {
    const all = res.data ?? []
    return { active: all.filter((g) => g.status === 'active').length, done: all.filter((g) => g.status === 'done').length, archived: all.filter((g) => g.status === 'archived').length }
  }, [res.data])

  const replace = (g: Goal) => res.setData((list) => (list ?? []).map((x) => (x.id === g.id ? g : x)))

  return {
    goals, counts, tab, setTab, loading: res.loading, error: res.error ?? cmd.error, busy: cmd.busy,
    editing,
    openCreate: () => setEditing({ id: null, form: emptyGoal() }),
    openEdit: (g: Goal) => {
      const { id, current_value: _c, progress_pct: _p, measurements: _m, ...form } = g
      void _c; void _p; void _m
      setEditing({ id, form })
    },
    applyPreset: (p: Partial<GoalInput>) => setEditing((e) => e && { ...e, form: { ...emptyGoal(), ...p } }),
    updateForm: (patch: Partial<GoalInput>) => setEditing((e) => e && { ...e, form: { ...e.form, ...patch } }),
    closeEditor: () => setEditing(null),
    save: () =>
      cmd.run(async () => {
        if (!editing) return
        if (!editing.form.title.trim()) throw new Error('Donne un titre à ton objectif')
        if (editing.id) await goalRepository.update(editing.id, editing.form)
        else await goalRepository.create(editing.form)
        setEditing(null)
        await res.reload()
      }),
    setStatus: (g: Goal, status: GoalInput['status']) =>
      cmd.run(async () => {
        const { id, current_value: _c, progress_pct: _p, measurements: _m, ...form } = g
        void _c; void _p; void _m
        replace(await goalRepository.update(id, { ...form, status }))
      }),
    remove: (g: Goal) => cmd.run(async () => { await goalRepository.remove(g.id); await res.reload() }),
    addMeasurement: (g: Goal, value: number, date: string) =>
      cmd.run(async () => {
        replace(await goalRepository.addMeasurement(g.id, { date, value }))
      }),
    removeMeasurement: (g: Goal, mid: number) =>
      cmd.run(async () => { await goalRepository.removeMeasurement(g.id, mid); await res.reload() }),
  }
}
