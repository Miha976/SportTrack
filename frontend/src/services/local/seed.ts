// Bibliothèque d'exercices + données de démonstration (port de backend/app/seed.py).
import { addDays, mondayOf, todayISO, weekday } from '../../models/dates'
import type { Category, Exercise, Program } from '../../models/types'
import type { GoalRec, State, WorkoutRec } from './db'
import { generateWeek } from './generator'

type Row = [string, Category, string, number | null, number | null, number | null]
const EXERCISES: Row[] = [
  ['Footing continu', 'footing', 'Endurance fondamentale, allure conversationnelle.', null, null, 2400],
  ['Fartlek', 'footing', "Variations d'allure libres pendant le footing.", null, null, 1800],
  ['30/30 à 100 % VMA', 'fractionne', '30 s rapide / 30 s trot.', 2, 8, null],
  ['15/15 à 110 % VMA', 'fractionne', 'Très proche des efforts de match.', 2, 10, null],
  ['Navettes 4×(5-10-15 m)', 'fractionne', 'Intermittent avec changements de direction.', 3, 6, null],
  ['Nordic hamstring', 'renforcement', 'Prévention ischio-jambiers. Descente lente.', 3, 5, null],
  ['Copenhague (adducteurs)', 'renforcement', 'Gainage latéral, jambe haute sur banc.', 3, null, 20],
  ['Squat bulgare', 'renforcement', 'Pied arrière surélevé.', 3, 8, null],
  ['Gainage frontal', 'renforcement', 'Corps aligné, bassin neutre.', 3, null, 45],
  ['Mollets unipodal', 'renforcement', 'Montée explosive, descente lente.', 3, 15, null],
  ['Fentes marchées', 'renforcement', '', 3, 10, null],
  ['Échelle de rythme', 'appuis', 'Pieds rapides, regard haut.', 6, null, null],
  ['Sprint 10 m départ varié', 'appuis', 'Départ assis, dos, latéral…', null, 8, null],
  ['Pas chassés + crochet', 'appuis', 'Changement de direction sur appel.', null, 6, null],
  ['Sauts latéraux (haies basses)', 'appuis', 'Contacts au sol courts.', 3, 8, null],
  ['Passes 1 touche au mur', 'technique_mur', 'Alterner pied fort / pied faible.', 4, null, 60],
  ['Contrôle orienté + conduite', 'technique_mur', 'Contrôle vers plot à 45°, relance.', 4, 10, null],
  ['Contrôle aérien au mur', 'technique_mur', 'Balle haute, amorti cuisse/poitrine/pied.', 3, 8, null],
  ['Défi 60 s contrôles réussis', 'technique_mur', 'Compter les contrôles propres en 60 s.', 2, null, 60],
  ['Rouleau de massage', 'recuperation', 'Quadriceps, ischios, mollets, fessiers.', null, null, 300],
  ['Mobilité hanches 90/90', 'recuperation', '', 2, null, 60],
  ['Étirements statiques doux', 'recuperation', '20-30 s par muscle, sans douleur.', null, null, 420],
  ['Respiration diaphragmatique', 'recuperation', "Expiration 2× plus longue que l'inspiration.", null, null, 180],
  ['Bain froid / douche froide jambes', 'recuperation', '10-15 °C, 5-10 min.', null, null, 420],
]

export const seedExercises = (): Exercise[] =>
  EXERCISES.map(([name, category, description, s, r, t], i) => ({
    id: i + 1, name, category, description, default_sets: s, default_reps: r, default_duration_s: t, is_custom: false,
  }))

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function demoState(): State {
  const rand = rng(7)
  const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1))
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
  let id = 100
  const nid = () => id++
  const today = todayISO()
  const start = addDays(mondayOf(today), -35)

  const { sessions } = generateWeek({
    name: 'Prépa mi-saison', start_date: start, weeks: 8, available_days: [0, 2, 4, 5], collective_days: [1, 3],
    match_day: 6, focus: ['fractionne', 'renforcement', 'appuis', 'technique_mur', 'footing'], level: 'intermediaire', max_session_min: 60,
  })
  const program: Program = {
    id: nid(), name: 'Prépa mi-saison', description: 'Programme de démonstration', start_date: start, weeks: 8,
    progression_pct: 5, deload_every: 4, active: true, sessions: sessions.map((s) => ({ ...s, id: nid() })),
  }

  const workouts: WorkoutRec[] = []
  const sleep: State['sleep'] = []
  const w = (o: Partial<WorkoutRec> & Pick<WorkoutRec, 'date' | 'category' | 'duration_min'>): WorkoutRec => ({
    id: nid(), title: '', distance_km: null, avg_hr: null, max_hr: null, calories: null, rpe: null, notes: '',
    program_session_id: null, details: {}, source: 'manuel', ...o,
  })
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const wd = weekday(d)
    if (wd === 1 || wd === 3) workouts.push(w({ date: d, category: 'collectif', title: 'Entraînement club', duration_min: 90, rpe: int(5, 7) }))
    if (wd === 6) workouts.push(w({ date: d, category: 'match', title: 'Match championnat', duration_min: pick([70, 80, 90]), rpe: int(7, 9) }))
    for (const ps of program.sessions) {
      if (ps.day_of_week !== wd || rand() >= 0.78 || d === today) continue
      workouts.push(w({
        date: d, category: ps.category, title: ps.title, program_session_id: ps.id, duration_min: ps.duration_min + int(-5, 5),
        distance_km: ps.category === 'footing' ? Math.round((ps.duration_min / (5.4 + rand() * 0.7)) * 100) / 100 : null,
        avg_hr: ps.category === 'footing' || ps.category === 'fractionne' ? int(130, 165) : null,
        rpe: { faible: 3, moderee: 6, elevee: 8 }[ps.intensity] + int(-1, 1),
      }))
    }
    const dur = int(370, 520)
    if (rand() < 0.2) {
      const len = pick([20, 25, 30, 55])
      sleep.push({ id: nid(), date: d, kind: 'nap', duration_min: len, bedtime: '14:00', wake_time: `14:${pad(len)}`, quality: null, deep_min: null, rem_min: null, light_min: null, awake_min: null, awakenings: null, resting_hr: null, hrv_ms: null, source: 'demo' })
    }
    sleep.push({
      id: nid(), date: d, kind: 'night', duration_min: dur, bedtime: `${pad(pick([22, 23, 23, 0]))}:${pad(pick([0, 15, 30, 45]))}`, wake_time: '07:30',
      quality: int(2, 5), deep_min: Math.trunc(dur * 0.18), rem_min: Math.trunc(dur * 0.22), light_min: Math.trunc(dur * 0.55),
      awake_min: Math.trunc(dur * 0.05), awakenings: pick([0, 0, 1, 1, 2, 3]), resting_hr: int(50, 58), hrv_ms: int(55, 80), source: 'demo',
    })
  }

  const g = (o: Partial<GoalRec> & Pick<GoalRec, 'title' | 'metric' | 'target_value'>): GoalRec => ({
    id: nid(), category: null, period: 'week', direction: 'increase', baseline_value: null, unit: '', start_date: start,
    deadline: null, status: 'active', measurements: [], ...o,
  })
  const m = (date: string, value: number) => ({ id: nid(), date, value, note: '' })
  const goals: GoalRec[] = [
    g({ title: '3 séances perso par semaine', metric: 'sessions_count', target_value: 3, unit: 'séances' }),
    g({ title: 'VMA à 17 km/h', metric: 'manual', target_value: 17, baseline_value: 15.5, unit: 'km/h', deadline: addDays(today, 42),
      measurements: [m(start, 15.5), m(addDays(start, 21), 16), m(addDays(today, -2), 16.4)] }),
    g({ title: 'Sprint 30 m sous 4,2 s', metric: 'manual', direction: 'decrease', target_value: 4.2, baseline_value: 4.6, unit: 's',
      measurements: [m(start, 4.6), m(addDays(today, -9), 4.45)] }),
    g({ title: 'Dormir 8 h en moyenne', metric: 'sleep_avg_h', target_value: 8, unit: 'h' }),
    g({ title: 'Contrôles réussis au mur en 60 s', metric: 'manual', target_value: 40, baseline_value: 24, unit: 'contrôles',
      measurements: [24, 27, 29, 31, 34, 35].map((v, i) => m(addDays(start, 7 * i), v)) }),
  ]
  return { nextId: id, exercises: seedExercises(), goals, programs: [program], workouts, sleep }
}

const pad = (n: number) => String(n).padStart(2, '0')
