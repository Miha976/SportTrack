// Port TypeScript de backend/app/services/generator.py — mêmes règles de placement.
import type { Category, GenerateRequest, Intensity, Level, ProgramExercise, ProgramSessionInput } from '../../models/types'

const HARD = new Set<Category>(['fractionne', 'appuis'])
const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const LEVEL_FACTOR: Record<Level, number> = { debutant: 0.75, intermediaire: 1, avance: 1.25 }
const mod7 = (n: number) => ((n % 7) + 7) % 7
const pyRound = (x: number) => { const r = Math.round(x); return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r } // arrondi bancaire comme Python

interface Tpl { title: string; intensity: Intensity; duration: number; content: string; exercises: ProgramExercise[] }

function template(cat: Category, level: Level, maxMin: number): Tpl {
  const f = LEVEL_FACTOR[level]
  const reps = (n: number) => Math.max(1, pyRound(n * f))
  const t: Partial<Record<Category, Tpl>> = {
    footing: {
      title: 'Footing endurance fondamentale', intensity: 'faible', duration: pyRound(35 * f),
      content: 'Allure conversationnelle (~65-75 % FC max). Finir par 4 lignes droites progressives.',
      exercises: [{ name: 'Footing continu', duration_s: Math.trunc(35 * f * 60) }, { name: 'Lignes droites 80 m', reps: 4 }],
    },
    fractionne: {
      title: 'Intermittent court 30/30', intensity: 'elevee', duration: 40,
      content: `Échauffement 12 min. ${reps(2)} blocs de ${reps(8)} × 30 s à 100-105 % VMA / 30 s récup trottinée, 3 min entre blocs. Retour au calme 8 min.`,
      exercises: [{ name: '30/30 à 100 % VMA', sets: reps(2), reps: reps(8) }],
    },
    renforcement: {
      title: 'Renforcement footballeur', intensity: 'moderee', duration: pyRound(35 * f),
      content: 'Circuit, 40 s effort / 20 s repos. Priorité ischios (Nordic) et adducteurs (Copenhague) pour la prévention des blessures.',
      exercises: [
        { name: 'Nordic hamstring', sets: 3, reps: reps(5) }, { name: 'Copenhague (adducteurs)', sets: 3, duration_s: 20 },
        { name: 'Squat bulgare', sets: 3, reps: reps(8) }, { name: 'Gainage frontal + latéral', sets: 3, duration_s: 40 },
        { name: 'Mollets unipodal', sets: 3, reps: reps(15) }],
    },
    appuis: {
      title: 'Appuis & vitesse', intensity: 'elevee', duration: 30,
      content: 'Échauffement dynamique 10 min. Qualité > quantité : récupération complète entre répétitions.',
      exercises: [
        { name: 'Échelle de rythme (variantes)', sets: reps(6), note: 'pieds rapides' },
        { name: 'Pas chassés + changement de direction', reps: reps(6) },
        { name: 'Sprints 10-20 m départ varié', reps: reps(8) }, { name: 'Pliométrie : sauts latéraux', sets: 3, reps: reps(8) }],
    },
    technique_mur: {
      title: 'Contrôle orienté au mur', intensity: 'moderee', duration: 30,
      content: 'Passe contre le mur, contrôle orienté vers un plot à 45°, relance. Alterner pieds et surfaces. Pression : chrono ou contrôle en 2 touches max.',
      exercises: [
        { name: 'Passes 1 touche pied faible/fort', sets: 4, duration_s: 60 },
        { name: 'Contrôle orienté + conduite vers plot', sets: 4, reps: reps(10) },
        { name: 'Contrôle aérien (balle haute) + enchaînement', sets: 3, reps: reps(8) },
        { name: 'Défi : contrôles réussis en 60 s', sets: 2, duration_s: 60 }],
    },
    recuperation: {
      title: 'Récupération & mobilité', intensity: 'faible', duration: 25,
      content: 'Mobilité hanches/chevilles, étirements doux, auto-massage au rouleau. Respiration lente pour finir.',
      exercises: [
        { name: 'Rouleau : quadriceps, ischios, mollets', duration_s: 300 }, { name: 'Mobilité hanches (90/90)', sets: 2, duration_s: 60 },
        { name: 'Étirements statiques doux', duration_s: 420 }, { name: 'Respiration diaphragmatique', duration_s: 180 }],
    },
  }
  const tpl = { ...t[cat]! }
  tpl.duration = Math.min(pyRound(tpl.duration / 5) * 5, maxMin)
  return tpl
}

const session = (day: number, cat: Category, req: GenerateRequest, o: Partial<Tpl> = {}): ProgramSessionInput => {
  const t = { ...template(cat, req.level, req.max_session_min), ...o }
  return { day_of_week: day, category: cat, title: t.title, duration_min: t.duration, intensity: t.intensity, content: t.content, exercises: t.exercises }
}

export function generateWeek(req: GenerateRequest): { sessions: ProgramSessionInput[]; notes: string[] } {
  const notes: string[] = []
  const sessions: ProgramSessionInput[] = []
  const match = req.match_day
  const collective = new Set(req.collective_days)
  const busy = new Set([...collective, ...(match !== null ? [match] : [])])
  const free = [...new Set(req.available_days)].sort((a, b) => a - b).filter((d) => !busy.has(d))
  const after = match !== null ? mod7(match + 1) : null
  const before = match !== null ? mod7(match - 1) : null
  const hard = new Set<number>()
  const used = new Set<number>()
  const neigh = (d: number) => [mod7(d - 1), mod7(d + 1)]

  const recDay = after !== null && free.includes(after) ? after : free.length >= 4 ? free[0] : null
  if (recDay !== null) {
    sessions.push(session(recDay, 'recuperation', req))
    used.add(recDay)
    if (recDay === after) notes.push('Récupération placée au lendemain du match.')
  }
  if (before !== null && free.includes(before) && !used.has(before)) {
    sessions.push(session(before, 'technique_mur', req, {
      title: 'Activation veille de match', duration: 20, intensity: 'faible',
      content: 'Touches de balle au mur, rythme vif mais court. Aucune fatigue.',
    }))
    used.add(before)
    notes.push('Veille de match : activation légère uniquement.')
  }

  const cap = { debutant: 4, intermediaire: 5, avance: 6 }[req.level]
  const unplaced: Category[] = []
  for (const cat of req.focus) {
    if (cat === 'recuperation' || cat === 'collectif' || cat === 'match') continue
    if (used.size >= cap) { notes.push(`« ${cat} » non planifié : volume hebdo max atteint pour ton niveau.`); continue }
    let cands = free.filter((d) => !used.has(d))
    if (HARD.has(cat)) {
      const strict = cands.filter((d) => d !== before && d !== after && !neigh(d).some((n) => hard.has(n) || collective.has(n)))
      cands = strict.length ? strict : cands.filter((d) => d !== before && d !== after && !neigh(d).some((n) => hard.has(n)))
    }
    if (!cands.length) { unplaced.push(cat); continue }
    if (HARD.has(cat) && match !== null) {
      cands = [...cands].sort((a, b) => -Math.min(mod7(match - a), mod7(a - match)) + Math.min(mod7(match - b), mod7(b - match)))
    }
    const d = cands[0]
    sessions.push(session(d, cat, req))
    used.add(d)
    if (HARD.has(cat)) hard.add(d)
  }

  for (const d of free) {
    if (!used.has(d) && used.size < cap) { sessions.push(session(d, 'technique_mur', req)); used.add(d) }
  }

  if (recDay === null && free.length) unplaced.push('recuperation')
  for (const cat of unplaced) {
    if (HARD.has(cat)) { notes.push(`« ${cat} » non planifié : aucun jour compatible avec une séance intense (ajoute un jour libre éloigné du match).`); continue }
    const hosts = sessions.filter((x) => ((x.intensity !== 'elevee' && x.day_of_week !== before) || cat === 'recuperation')
      && sessions.filter((y) => y.day_of_week === x.day_of_week).length === 1)
    if (!hosts.length) { notes.push(`« ${cat} » non planifié : plus de place cette semaine.`); continue }
    const host = hosts[hosts.length - 1]
    const c = session(host.day_of_week, cat, req)
    c.title = 'Complément · ' + c.title
    c.duration_min = cat === 'recuperation' ? 15 : 20
    if (cat === 'recuperation' || cat === 'footing') c.intensity = 'faible'
    sessions.push(c)
    notes.push(`« ${cat} » ajouté en complément court après la séance du ${DAYS[host.day_of_week]}.`)
  }

  sessions.sort((a, b) => a.day_of_week - b.day_of_week)
  if (free.length < 2) notes.push('Peu de jours disponibles : la progression sera plus lente.')
  return { sessions, notes }
}
