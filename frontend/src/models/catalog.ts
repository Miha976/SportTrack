// Métadonnées d'affichage : modules (couleur d'accent par écran) et catégories (couleurs de données).
import type { Category, Intensity, Metric } from './types'

export type ModuleKey =
  | 'dashboard'
  | 'goals'
  | 'program'
  | 'sessions'
  | 'recovery'
  | 'sleep'
  | 'progress'
  | 'watch'

export interface ModuleMeta {
  key: ModuleKey
  label: string
  short: string
  path: string
  color: string
}

/** Une couleur d'accent par module pour se repérer d'un coup d'œil. */
export const MODULES: ModuleMeta[] = [
  { key: 'dashboard', label: 'Tableau de bord', short: 'Accueil', path: '/', color: '#a3e635' },
  { key: 'goals', label: 'Objectifs', short: 'Objectifs', path: '/objectifs', color: '#fbbf24' },
  { key: 'program', label: 'Programme', short: 'Plan', path: '/programme', color: '#60a5fa' },
  { key: 'sessions', label: 'Séances', short: 'Séances', path: '/seances', color: '#fb923c' },
  { key: 'recovery', label: 'Récupération', short: 'Récup', path: '/recuperation', color: '#34d399' },
  { key: 'sleep', label: 'Sommeil', short: 'Sommeil', path: '/sommeil', color: '#a78bfa' },
  { key: 'progress', label: 'Progression', short: 'Stats', path: '/progression', color: '#22d3ee' },
  { key: 'watch', label: 'Montre & import', short: 'Montre', path: '/montre', color: '#f472b6' },
]

export const moduleByKey = (k: ModuleKey) => MODULES.find((m) => m.key === k)!

/**
 * Couleurs des catégories (données / graphiques). Ordre fixe validé pour la
 * séparation daltonisme sur fond sombre — ne pas réordonner.
 */
export const CATEGORIES: { key: Category; label: string; color: string; emoji: string }[] = [
  { key: 'footing', label: 'Footing', color: '#338ced', emoji: '🏃' },
  { key: 'fractionne', label: 'Fractionné', color: '#e76624', emoji: '⚡' },
  { key: 'renforcement', label: 'Renforcement', color: '#00a888', emoji: '💪' },
  { key: 'appuis', label: 'Appuis & vitesse', color: '#d28e05', emoji: '🪜' },
  { key: 'technique_mur', label: 'Technique au mur', color: '#e24d8b', emoji: '🧱' },
  { key: 'collectif', label: 'Entraînement club', color: '#0aac23', emoji: '👥' },
  { key: 'match', label: 'Match', color: '#9887ef', emoji: '⚽' },
  { key: 'recuperation', label: 'Récupération', color: '#eb6263', emoji: '🧘' },
]

export const catMeta = (c: Category) => CATEGORIES.find((x) => x.key === c)!

/** Catégories que l'on planifie dans un programme individuel. */
export const PERSONAL_CATEGORIES: Category[] = [
  'footing',
  'fractionne',
  'renforcement',
  'appuis',
  'technique_mur',
  'recuperation',
]

export const INTENSITY_LABEL: Record<Intensity, string> = {
  faible: 'Faible',
  moderee: 'Modérée',
  elevee: 'Élevée',
}

export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
export const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export const METRIC_LABEL: Record<Metric, string> = {
  sessions_count: 'Nombre de séances (auto)',
  duration_min: 'Minutes d’entraînement (auto)',
  distance_km: 'Distance en km (auto)',
  sleep_avg_h: 'Sommeil moyen en h (auto)',
  manual: 'Mesure manuelle (test, record…)',
}

/** RPE : échelle de Borg CR-10 simplifiée. */
export const RPE_LABEL: Record<number, string> = {
  1: 'Très facile',
  2: 'Facile',
  3: 'Modéré',
  4: 'Un peu dur',
  5: 'Dur',
  6: 'Dur +',
  7: 'Très dur',
  8: 'Très dur +',
  9: 'Quasi max',
  10: 'Maximal',
}
