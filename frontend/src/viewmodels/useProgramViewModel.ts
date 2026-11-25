import { useMemo, useState } from 'react'
import { addDays, mondayOf, todayISO } from '../models/dates'
import type { Category, GenerateRequest, PlannedSession, Program, ProgramSessionInput, WorkoutInput } from '../models/types'
import { exerciseRepository, programRepository, workoutRepository } from '../services/repositories'
import { defaultRpe } from './workoutDefaults'
import { useCommand, useResource } from './useResource'

export const defaultGenerate = (): GenerateRequest => ({
  name: 'Mon programme', start_date: mondayOf(todayISO()), weeks: 6, available_days: [0, 2, 4, 5],
  collective_days: [1, 3], match_day: 6, focus: ['fractionne', 'renforcement', 'appuis', 'technique_mur', 'footing'],
  level: 'intermediaire', max_session_min: 60,
})

export const emptyProgramSession = (day = 0): ProgramSessionInput => ({
  day_of_week: day, category: 'technique_mur', title: '', duration_min: 30, intensity: 'moderee', content: '', exercises: [],
})

export function useProgramViewModel() {
  const programs = useResource(() => programRepository.list())
  const exercises = useResource(() => exerciseRepository.list())
  const [weekStart, setWeekStart] = useState(mondayOf(todayISO()))
  const planning = useResource(() => programRepository.planning(weekStart, 7), [weekStart])
  const cmd = useCommand()

  const [generator, setGenerator] = useState<GenerateRequest | null>(null)
  const [genNotes, setGenNotes] = useState<string[]>([])
  const [sessionEditor, setSessionEditor] = useState<{ id: number | null; form: ProgramSessionInput } | null>(null)
  const [selected, setSelected] = useState<PlannedSession | null>(null)

  const active: Program | null = useMemo(() => programs.data?.find((p) => p.active) ?? null, [programs.data])
  const others = useMemo(() => programs.data?.filter((p) => !p.active) ?? [], [programs.data])

  const currentWeek = useMemo(() => {
    if (!active) return null
    const diff = (new Date(todayISO()).getTime() - new Date(active.start_date).getTime()) / 86400000
    return Math.floor(diff / 7) + 1
  }, [active])

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i)
      return { date, isToday: date === todayISO(), items: planning.data?.filter((p) => p.date === date) ?? [] }
    }),
    [planning.data, weekStart],
  )
  const adherence = useMemo(() => {
    const all = planning.data ?? []
    const past = all.filter((p) => p.date <= todayISO())
    return { planned: all.length, due: past.length, done: past.filter((p) => p.done_session_id).length }
  }, [planning.data])

  const reloadAll = async () => { await Promise.all([programs.reload(), planning.reload()]) }

  return {
    loading: programs.loading, error: programs.error ?? planning.error ?? cmd.error, busy: cmd.busy,
    active, others, currentWeek, weekStart, days, adherence, exercises: exercises.data ?? [],
    prevWeek: () => setWeekStart((w) => addDays(w, -7)),
    nextWeek: () => setWeekStart((w) => addDays(w, 7)),
    thisWeek: () => setWeekStart(mondayOf(todayISO())),

    // Générateur
    generator, genNotes,
    openGenerator: () => { setGenNotes([]); setGenerator(defaultGenerate()) },
    updateGenerator: (patch: Partial<GenerateRequest>) => setGenerator((g) => g && { ...g, ...patch }),
    toggleDay: (field: 'available_days' | 'collective_days', d: number) =>
      setGenerator((g) => g && { ...g, [field]: g[field].includes(d) ? g[field].filter((x) => x !== d) : [...g[field], d] }),
    toggleFocus: (c: Category) =>
      setGenerator((g) => g && { ...g, focus: g.focus.includes(c) ? g.focus.filter((x) => x !== c) : [...g.focus, c] }),
    closeGenerator: () => setGenerator(null),
    generate: () =>
      cmd.run(async () => {
        if (!generator) return
        const r = await programRepository.generate(generator)
        setGenNotes(r.notes)
        setWeekStart(mondayOf(generator.start_date))
        await reloadAll()
      }),

    // Programmes
    activate: (p: Program) => cmd.run(async () => { await programRepository.update(p.id, { ...p, active: true }); await reloadAll() }),
    updateProgram: (p: Program, patch: Partial<Program>) =>
      cmd.run(async () => { await programRepository.update(p.id, { ...p, ...patch }); await reloadAll() }),
    removeProgram: (p: Program) => cmd.run(async () => { await programRepository.remove(p.id); await reloadAll() }),

    // Séances type
    sessionEditor,
    openNewSession: (day: number) => setSessionEditor({ id: null, form: emptyProgramSession(day) }),
    openEditSession: (s: ProgramSessionInput & { id: number }) => {
      const { id, ...form } = s
      setSessionEditor({ id, form })
    },
    updateSessionForm: (patch: Partial<ProgramSessionInput>) => setSessionEditor((e) => e && { ...e, form: { ...e.form, ...patch } }),
    closeSessionEditor: () => setSessionEditor(null),
    saveSession: () =>
      cmd.run(async () => {
        if (!active || !sessionEditor) return
        const form = { ...sessionEditor.form, title: sessionEditor.form.title || 'Séance' }
        if (sessionEditor.id) await programRepository.updateSession(active.id, sessionEditor.id, form)
        else await programRepository.addSession(active.id, form)
        setSessionEditor(null)
        await reloadAll()
      }),
    removeSession: (sid: number) =>
      cmd.run(async () => { if (active) { await programRepository.removeSession(active.id, sid); setSessionEditor(null); await reloadAll() } }),

    // Réalisation
    selected, select: setSelected,
    logPlanned: (p: PlannedSession, patch: Partial<WorkoutInput>) =>
      cmd.run(async () => {
        const ps = p.program_session
        await workoutRepository.create({
          date: p.date, category: ps.category, title: ps.title, duration_min: p.scaled_duration_min,
          distance_km: null, avg_hr: null, max_hr: null, calories: null, rpe: defaultRpe(ps.intensity),
          notes: '', program_session_id: ps.id, details: {}, ...patch,
        })
        setSelected(null)
        await planning.reload()
      }),
  }
}
