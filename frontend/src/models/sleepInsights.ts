// Conseils sommeil personnalisés : règles transparentes appliquées aux nuits saisies.
// Fonction pure (Modèle) → testable, et identique en mode serveur et en mode téléphone.
import { addDays, weekday } from './dates'
import type { SleepEntry, Workout } from './types'

export type InsightLevel = 'alert' | 'tip' | 'good'

export interface SleepInsight {
  id: string
  level: InsightLevel
  title: string
  /** Ce qu'il faut faire, concrètement. */
  actions: string[]
  /** Les chiffres qui ont déclenché le conseil. */
  evidence: string
}

export const SLEEP_TARGET_MIN = 8 * 60
const WINDOW = 14 // nuits analysées
const MIN_NIGHTS = 3

// ---------------------------------------------------------------- utilitaires
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const sd = (xs: number[]) => {
  const m = mean(xs)
  return m === null || xs.length < 3 ? null : Math.sqrt(mean(xs.map((x) => (x - m) ** 2))!)
}
/** Heure → minutes, pivot à midi (22:00 → 600, 00:30 → 750) pour que les couchers après minuit restent comparables. */
const pivot = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return ((h + 12) % 24) * 60 + m
}
const fromPivot = (v: number) => {
  const t = (((Math.round(v / 5) * 5) % 1440) + 1440) % 1440
  const h = (Math.floor(t / 60) + 12) % 24
  return `${String(h).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
const h = (min: number) => `${(min / 60).toFixed(1).replace('.', ',')} h`
const signed = (n: number, unit: string) => `${n > 0 ? '+' : '−'}${Math.abs(Math.round(n))} ${unit}`

/** Une entrée sans type (ancienne donnée) est une nuit. */
export const isNap = (e: Pick<SleepEntry, 'kind'>) => e.kind === 'nap'

// ---------------------------------------------------------------- moteur
export function sleepInsights(all: SleepEntry[], workouts: Workout[] = []): SleepInsight[] {
  const rawNights = all.filter((e) => !isNap(e)).sort((a, b) => a.date.localeCompare(b.date)).slice(-WINDOW)
  const naps = all.filter(isNap).sort((a, b) => a.date.localeCompare(b.date))
  if (rawNights.length < MIN_NIGHTS) {
    return [{
      id: 'data', level: 'tip', title: 'Encore quelques nuits à saisir',
      actions: [`Saisis au moins ${MIN_NIGHTS} nuits (coucher, réveil, qualité, réveils) pour obtenir des conseils adaptés.`],
      evidence: `${rawNights.length} nuit(s) enregistrée(s)`,
    }]
  }
  const out: SleepInsight[] = []

  // 0. Saisie probablement erronée : une « nuit » courte prise en journée
  const daytime = rawNights.filter((n) => {
    if (!n.bedtime || n.duration_min >= 180) return false
    const p = pivot(n.bedtime)
    return p >= pivot('10:00') || p <= pivot('19:00') // entre 10 h et 19 h
  })
  if (daytime.length) {
    out.push({
      id: 'misfiled', level: 'alert', title: 'Une « nuit » ressemble à une sieste',
      actions: ['Dans l’historique, ouvre cette entrée (✏️), choisis « ☕ Sieste » et enregistre.', 'Puis ressaisis la vraie nuit de ce jour avec « Saisir ma nuit ».'],
      evidence: daytime.map((n) => `${n.date} : ${n.bedtime}, ${n.duration_min} min`).join(' · '),
    })
  }
  // Les entrées suspectes sont écartées des calculs suivants pour ne pas fausser les conseils.
  const nights = rawNights.filter((n) => !daytime.includes(n))
  if (nights.length < MIN_NIGHTS) return out

  const last7 = nights.slice(-7)
  const avg7 = mean(last7.map((n) => n.duration_min))!
  const wakes = nights.filter((n) => n.wake_time).map((n) => pivot(n.wake_time!))
  const beds = nights.filter((n) => n.bedtime).map((n) => pivot(n.bedtime!))
  const wakeMed = median(wakes)
  const bedMed = median(beds)

  // 1. Durée et dette
  if (avg7 < SLEEP_TARGET_MIN - 15) {
    const debt = last7.reduce((a, n) => a + Math.max(0, SLEEP_TARGET_MIN - n.duration_min), 0)
    const actions: string[] = []
    if (wakeMed !== null) {
      // 8 h de sommeil + ~15 min d'endormissement
      actions.push(`Pour te lever vers ${fromPivot(wakeMed)}, vise une extinction des feux vers ${fromPivot(wakeMed - SLEEP_TARGET_MIN - 15)}.`)
    }
    actions.push('Avance ton coucher par paliers de 15 min tous les 2-3 jours plutôt que d’un coup.')
    const napRecent = naps.filter((n) => n.date >= last7[0].date).reduce((a, n) => a + n.duration_min, 0)
    if (debt > 5 * 60 && !napRecent) actions.push('Pour rattraper sans décaler ton rythme : sieste de 20-30 min avant 15 h, plutôt qu’une grasse matinée.')
    if (napRecent) actions.push(`Tes siestes (${Math.round(napRecent)} min sur la période) compensent en partie, mais ne remplacent pas une nuit complète.`)
    out.push({
      id: 'duration', level: avg7 < 7 * 60 ? 'alert' : 'tip',
      title: avg7 < 7 * 60 ? 'Tu ne dors pas assez' : 'Encore un peu court pour un sportif',
      actions,
      evidence: `Moyenne ${h(avg7)} sur ${last7.length} nuits · dette ${h(debt)} vs 8 h/nuit`,
    })
  }

  // 2. Régularité des horaires
  const bedSd = sd(beds)
  const wakeSd = sd(wakes)
  if ((bedSd ?? 0) > 45 || (wakeSd ?? 0) > 45) {
    const anchor = wakeMed !== null ? `Fixe une heure de lever (≈ ${fromPivot(wakeMed)}), y compris le week-end, à ± 30 min près.` : 'Fixe une heure de lever, y compris le week-end, à ± 30 min près.'
    out.push({
      id: 'regularity', level: 'tip', title: 'Horaires irréguliers',
      actions: [anchor, 'C’est l’heure de lever qui cale l’horloge interne : le coucher suivra naturellement.', 'Prends 10-15 min de lumière du jour le matin.'],
      evidence: [bedSd !== null && `coucher ± ${Math.round(bedSd)} min`, wakeSd !== null && `lever ± ${Math.round(wakeSd)} min`].filter(Boolean).join(' · ') + ' (cible < 30 min)',
    })
  }

  // 3. Décalage semaine / week-end (« jet-lag social »)
  const mid = (n: SleepEntry) => (n.wake_time ? pivot(n.wake_time) - n.duration_min / 2 : null)
  const weMid = nights.filter((n) => weekday(n.date) >= 5).map(mid).filter((x): x is number => x !== null)
  const wdMid = nights.filter((n) => weekday(n.date) < 5).map(mid).filter((x): x is number => x !== null)
  if (weMid.length >= 2 && wdMid.length >= 3) {
    const lag = mean(weMid)! - mean(wdMid)!
    if (lag > 60) {
      out.push({
        id: 'social-jetlag', level: 'tip', title: 'Décalage le week-end',
        actions: ['Limite l’écart de lever entre semaine et week-end à 1 h maximum.', 'Le lundi matin difficile vient souvent de là, pas d’une nuit trop courte.'],
        evidence: `Milieu de nuit décalé de ${Math.round(lag)} min le week-end`,
      })
    }
  }

  // 4. Coucher tardif
  if (bedMed !== null && bedMed > pivot('00:15')) {
    out.push({
      id: 'late', level: 'tip', title: 'Coucher tardif',
      actions: ['Coupe les écrans 30-60 min avant de dormir (ou luminosité au minimum, mode nuit).', 'Garde une routine courte et identique : douche tiède, lecture, lumière tamisée.', 'Évite la caféine après 14 h (café, thé, sodas, boissons énergisantes).'],
      evidence: `Coucher médian ${fromPivot(bedMed)}`,
    })
  }

  // 5. Nuits hachées
  const awak = last7.filter((n) => n.awakenings !== null && n.awakenings !== undefined).map((n) => n.awakenings!)
  const awakeMin = last7.filter((n) => n.awake_min).map((n) => n.awake_min!)
  const avgAwak = mean(awak)
  const avgAwakeMin = mean(awakeMin)
  if ((avgAwak !== null && avgAwak >= 1.5) || (avgAwakeMin !== null && avgAwakeMin >= 30)) {
    out.push({
      id: 'fragmented', level: 'tip', title: 'Nuits hachées',
      actions: [
        'Bois surtout en journée et réduis les boissons dans l’heure qui précède le coucher ; passe aux toilettes juste avant.',
        'Chambre fraîche (≈ 18 °C), sombre et calme ; masque ou bouchons si besoin.',
        'Pas d’alcool le soir : il fait dormir vite mais fragmente la 2e moitié de nuit.',
        'Si tu te réveilles et ne te rendors pas en ~20 min, lève-toi au calme quelques minutes plutôt que de regarder l’heure.',
      ],
      evidence: [avgAwak !== null && `${avgAwak.toFixed(1).replace('.', ',')} réveil(s)/nuit`, avgAwakeMin !== null && `${Math.round(avgAwakeMin)} min éveillé/nuit`].filter(Boolean).join(' · ') + ' (7 dernières nuits)',
    })
  }

  // 6. Qualité ressentie basse malgré une durée correcte
  const q = last7.filter((n) => n.quality).map((n) => n.quality!)
  const avgQ = mean(q)
  if (avgQ !== null && q.length >= 3 && avgQ <= 2.6 && avg7 >= 7 * 60) {
    out.push({
      id: 'quality', level: 'tip', title: 'Tu dors assez mais récupères mal',
      actions: ['Dîner terminé 2-3 h avant le coucher, pas trop copieux.', 'Pas d’écran au lit ; téléphone hors de portée (réveil à part si possible).', 'Si la fatigue au réveil persiste plusieurs semaines (ou ronflements, pauses respiratoires signalées), parles-en à un médecin.'],
      evidence: `Qualité moyenne ${avgQ.toFixed(1).replace('.', ',')}/5 pour ${h(avg7)} de sommeil`,
    })
  }

  // 7. Grasse matinée suivie d'un réveil lourd (inertie du sommeil)
  const lastN = nights[nights.length - 1]
  const prevAvg = mean(nights.slice(0, -1).map((n) => n.duration_min))
  if (prevAvg !== null && lastN.duration_min - prevAvg >= 75 && (lastN.quality ?? 3) <= 2) {
    out.push({
      id: 'inertia', level: 'tip', title: 'Dormir plus longtemps ne t’a pas reposé',
      actions: ['Garde ton heure de lever habituelle, même après une mauvaise nuit : se rendormir près du réveil donne souvent un réveil plus lourd.', 'Compense plutôt par une sieste courte (20-30 min, avant 15 h) ou un coucher plus tôt le soir.'],
      evidence: `Dernière nuit ${h(lastN.duration_min)} (${signed(lastN.duration_min - prevAvg, 'min')} vs ta moyenne), qualité ${lastN.quality}/5`,
    })
  }

  // 8. Effet des séances intenses / matchs sur la nuit suivante
  const intenseDays = new Set(workouts.filter((w) => w.category === 'match' || (w.rpe ?? 0) >= 8).map((w) => w.date))
  const after = nights.filter((n) => intenseDays.has(addDays(n.date, -1)))
  const other = nights.filter((n) => !intenseDays.has(addDays(n.date, -1)))
  if (after.length >= 2 && other.length >= 3) {
    const dDur = mean(after.map((n) => n.duration_min))! - mean(other.map((n) => n.duration_min))!
    const qa = mean(after.filter((n) => n.quality).map((n) => n.quality!))
    const qo = mean(other.filter((n) => n.quality).map((n) => n.quality!))
    const dQ = qa !== null && qo !== null ? qa - qo : 0
    if (dDur <= -25 || dQ <= -0.7) {
      out.push({
        id: 'intense', level: 'tip', title: 'Tes nuits après un effort intense sont moins bonnes',
        actions: [
          'Retour au calme de 10 min en fin de séance, puis douche tiède.',
          'Repas avec glucides et protéines dans les 2 h, et réhydratation progressive (pas tout d’un coup avant de dormir).',
          'Quand c’est possible, place le fractionné et les appuis plutôt en journée qu’en fin de soirée.',
        ],
        evidence: `Après match/séance intense : ${signed(dDur, 'min')} de sommeil${dQ ? `, qualité ${dQ > 0 ? '+' : '−'}${Math.abs(dQ).toFixed(1).replace('.', ',')}` : ''} (${after.length} nuits vs ${other.length})`,
      })
    }
  }

  // 9. Marqueurs montre : VFC et FC de repos (7 dernières nuits vs les précédentes)
  const older = nights.slice(0, -7)
  const hrvNow = mean(last7.filter((n) => n.hrv_ms).map((n) => n.hrv_ms!))
  const hrvBase = mean(older.filter((n) => n.hrv_ms).map((n) => n.hrv_ms!))
  const rhrNow = mean(last7.filter((n) => n.resting_hr).map((n) => n.resting_hr!))
  const rhrBase = mean(older.filter((n) => n.resting_hr).map((n) => n.resting_hr!))
  const hrvDrop = hrvNow !== null && hrvBase !== null && hrvNow < hrvBase * 0.9
  const rhrUp = rhrNow !== null && rhrBase !== null && rhrNow - rhrBase >= 3
  if (hrvDrop || rhrUp) {
    out.push({
      id: 'hrv', level: 'alert', title: 'Signes de fatigue accumulée',
      actions: ['Allège 2-3 jours (pas de fractionné), priorise le sommeil et l’hydratation.', 'Si s’ajoutent courbatures inhabituelles, gorge irritée ou fièvre : repos complet.'],
      evidence: [hrvDrop && `VFC ${Math.round(hrvNow!)} ms vs ${Math.round(hrvBase!)}`, rhrUp && `FC repos ${signed(rhrNow! - rhrBase!, 'bpm')}`].filter(Boolean).join(' · '),
    })
  }

  // 10. Siestes : durée et horaire
  const recentNaps = naps.filter((n) => n.date >= nights[Math.max(0, nights.length - 7)].date)
  const longNaps = recentNaps.filter((n) => n.duration_min > 40)
  const lateNaps = recentNaps.filter((n) => n.bedtime && pivot(n.bedtime) >= pivot('16:00') && pivot(n.bedtime) < pivot('20:00'))
  if (longNaps.length) {
    out.push({
      id: 'nap-long', level: 'tip', title: 'Siestes trop longues',
      actions: ['Vise 20-30 min : au-delà, tu entres en sommeil profond et le réveil est lourd.', 'Mets une alarme et allonge-toi sans chercher à « bien dormir » : même somnoler récupère.'],
      evidence: `${longNaps.length} sieste(s) de plus de 40 min (max ${Math.max(...longNaps.map((n) => n.duration_min))} min)`,
    })
  }
  if (lateNaps.length) {
    out.push({
      id: 'nap-late', level: 'tip', title: 'Siestes tardives',
      actions: ['Termine ta sieste avant 15-16 h : plus tard, elle retarde l’endormissement du soir.', 'En fin de journée, préfère une pause calme ou quelques minutes de respiration lente.'],
      evidence: `${lateNaps.length} sieste(s) commencée(s) après 16 h`,
    })
  }

  // 11. Rien à signaler
  if (!out.some((i) => ['duration', 'regularity', 'fragmented', 'quality', 'hrv'].includes(i.id))) {
    out.push({
      id: 'good', level: 'good', title: 'Ton sommeil tient la route',
      actions: ['Garde ces horaires, surtout la semaine des matchs.', 'La veille de match, ne cherche pas à te coucher beaucoup plus tôt que d’habitude : vise ta routine normale.'],
      evidence: `Moyenne ${h(avg7)}${avgQ !== null ? ` · qualité ${avgQ.toFixed(1).replace('.', ',')}/5` : ''}`,
    })
  }

  const rank: Record<InsightLevel, number> = { alert: 0, tip: 1, good: 2 }
  return out.sort((a, b) => rank[a.level] - rank[b.level]).slice(0, 5)
}
