// Point d'entrée unique des ViewModels vers les données.
// VITE_DATA=local → mode sans serveur (téléphone / artefact) ; sinon → API FastAPI.
import * as Http from './httpRepositories'
import { initDb } from './local/db'
import * as Local from './local/localRepositories'
import { seedExercises } from './local/seed'

export const IS_LOCAL = import.meta.env.VITE_DATA === 'local'
const impl = IS_LOCAL ? Local : Http

export const goalRepository = impl.goalRepository
export const programRepository = impl.programRepository
export const workoutRepository = impl.workoutRepository
export const sleepRepository = impl.sleepRepository
export const statsRepository = impl.statsRepository
export const exerciseRepository = impl.exerciseRepository
export const importRepository = impl.importRepository
/** Disponible uniquement en mode local (sauvegarde, démo, remise à zéro). */
export const dataRepository = IS_LOCAL ? Local.dataRepository : null

let initP: Promise<void> | null = null
/** Charge les données locales une seule fois (idempotent). */
export const initData = () => {
  if (!IS_LOCAL) return Promise.resolve()
  initP ??= initDb(seedExercises).catch((e) => { initP = null; throw e })
  return initP
}
