// État en mémoire + persistance par seaux. Source de vérité unique du mode sans serveur.
import type { Exercise, Goal, Program, SleepEntry, Workout } from '../../models/types'
import { pickStore, type Bucket, type Store } from './store'

export type GoalRec = Omit<Goal, 'current_value' | 'progress_pct'>
export type WorkoutRec = Omit<Workout, 'load'> & { external_id?: string | null }

export interface State {
  nextId: number
  exercises: Exercise[]
  goals: GoalRec[]
  programs: Program[]
  workouts: WorkoutRec[]
  sleep: SleepEntry[]
}

export const SCHEMA_VERSION = 1
const empty = (): State => ({ nextId: 1, exercises: [], goals: [], programs: [], workouts: [], sleep: [] })

let state: State = empty()
let store: Store | null = null
const dirty = new Set<string>()
let flushing: Promise<void> = Promise.resolve()

export const S = () => state
export const storeInfo = () => ({ kind: store?.kind ?? 'memory', label: store?.label ?? '' })
export const newId = () => {
  dirty.add('meta')
  return state.nextId++
}

export const monthKey = (prefix: 'workouts' | 'sleep', date: string) => `${prefix}-${date.slice(0, 7)}`
export const touch = (...keys: string[]) => keys.forEach((k) => dirty.add(k))
export const touchAll = () => {
  ;['meta', 'exercises', 'goals', 'programs'].forEach((k) => dirty.add(k))
  state.workouts.forEach((w) => dirty.add(monthKey('workouts', w.date)))
  state.sleep.forEach((s) => dirty.add(monthKey('sleep', s.date)))
}

function bucketFor(key: string): Bucket | null {
  if (key === 'meta') return { nextId: state.nextId, schema: SCHEMA_VERSION }
  if (key === 'exercises') return { items: state.exercises }
  if (key === 'goals') return { items: state.goals }
  if (key === 'programs') return { items: state.programs }
  const [prefix, ...rest] = key.split('-')
  const month = rest.join('-')
  const list = prefix === 'workouts' ? state.workouts : prefix === 'sleep' ? state.sleep : null
  if (!list) return null
  const items = (list as { date: string }[]).filter((x) => x.date.startsWith(month))
  return items.length ? { items } : null
}

/** Écrit les seaux modifiés (séquentiellement). */
export function flush(): Promise<void> {
  const keys = [...dirty]
  dirty.clear()
  flushing = flushing.catch(() => undefined).then(async () => {
    if (!store) return
    for (const k of keys) {
      const b = bucketFor(k)
      if (b) await store.put(k, JSON.parse(JSON.stringify(b)))
      else await store.remove(k)
    }
  })
  return flushing
}

function fromBuckets(b: Record<string, Bucket>): State {
  const s = empty()
  const items = <T,>(k: string) => ((b[k]?.items as T[] | undefined) ?? [])
  s.nextId = Number(b.meta?.nextId ?? 1)
  s.exercises = items<Exercise>('exercises')
  s.goals = items<GoalRec>('goals')
  s.programs = items<Program>('programs')
  for (const [k, v] of Object.entries(b)) {
    if (k.startsWith('workouts-')) s.workouts.push(...((v.items as WorkoutRec[]) ?? []))
    if (k.startsWith('sleep-')) s.sleep.push(...((v.items as SleepEntry[]) ?? []))
  }
  return s
}

export async function initDb(seedExercises: () => Exercise[]) {
  store = await pickStore()
  state = fromBuckets(await store.loadAll())
  if (!state.exercises.length) {
    state.exercises = seedExercises()
    state.nextId = Math.max(state.nextId, ...state.exercises.map((e) => e.id + 1))
    touch('exercises', 'meta')
    await flush()
  }
}

/** Remplace tout (import de sauvegarde, démo, remise à zéro). */
export async function replaceAll(next: State) {
  const oldKeys = new Set<string>()
  state.workouts.forEach((w) => oldKeys.add(monthKey('workouts', w.date)))
  state.sleep.forEach((s) => oldKeys.add(monthKey('sleep', s.date)))
  state = next
  oldKeys.forEach((k) => dirty.add(k))
  touchAll()
  await flush()
}

export const exportState = () => JSON.stringify({ app: 'footprog', schema: SCHEMA_VERSION, exported_at: new Date().toISOString(), data: state }, null, 1)

export function parseBackup(text: string): State {
  const j = JSON.parse(text)
  const d = j?.data ?? j
  if (!d || !Array.isArray(d.workouts) || !Array.isArray(d.sleep)) throw new Error('Fichier de sauvegarde FootProg invalide')
  return { ...empty(), ...d }
}
