// Port TypeScript de backend/app/services/stats.py (mêmes règles, mêmes résultats).
import { CATEGORIES } from '../../models/catalog'
import { addDays, mondayOf, todayISO } from '../../models/dates'
import type { AcwrZone, Category, Goal, LoadPoint, PlannedSession, Readiness, ReadinessFactor, WeekStats } from '../../models/types'
import { S, type GoalRec, type WorkoutRec } from './db'

export const DEFAULT_RPE: Record<Category, number> = {
  footing: 4, fractionne: 8, renforcement: 6, appuis: 7, technique_mur: 5, collectif: 6, match: 8, recuperation: 2,
}
const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

export const sessionLoad = (w: WorkoutRec) => r1((w.duration_min || 0) * (w.rpe || DEFAULT_RPE[w.category] || 5))
export const sessionsBetween = (a: string, b: string) => S().workouts.filter((w) => w.date >= a && w.date <= b)
export const sleepBetween = (a: string, b: string) =>
  S().sleep.filter((n) => n.date >= a && n.date <= b).sort((x, y) => x.date.localeCompare(y.date))

/** 1re séance il y a ≥ 27 jours → 28 jours couverts. */
export const MIN_HISTORY_DAYS = 27

export function loadSeries(days = 56, today = todayISO()): LoadPoint[] {
  const daily = new Map<string, number>()
  for (const w of sessionsBetween(addDays(today, -(days + 27)), today)) daily.set(w.date, (daily.get(w.date) ?? 0) + sessionLoad(w))
  const at = (d: string) => daily.get(d) ?? 0
  // Le ratio n'a de sens qu'avec 4 semaines d'historique (sinon charge chronique sous-estimée).
  const first = S().workouts.reduce<string | null>((m, w) => (m === null || w.date < m ? w.date : m), null)
  const enoughHistory = (d: string) => first !== null && addDays(first, MIN_HISTORY_DAYS) <= d
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(today, -(days - 1 - i))
    let acute = 0, chronic = 0
    for (let k = 0; k < 28; k++) {
      const v = at(addDays(d, -k))
      if (k < 7) acute += v
      chronic += v
    }
    chronic /= 4
    return { date: d, load: r1(at(d)), acute: r1(acute), chronic: r1(chronic), acwr: chronic > 0 && enoughHistory(d) ? r2(acute / chronic) : null }
  })
}

export function acwrZone(a: number | null): AcwrZone {
  if (a === null) return 'inconnu'
  if (a < 0.8) return 'sous-charge'
  if (a <= 1.3) return 'optimal'
  if (a <= 1.5) return 'vigilance'
  return 'risque'
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export function readiness(today = todayISO()): Readiness {
  let score = 70
  const factors: ReadinessFactor[] = []
  const add = (label: string, delta: number) => { score += delta; factors.push({ label, delta: Math.round(delta) }) }

  const nights = sleepBetween(addDays(today, -7), today)
  const last = nights.find((n) => n.date === today) ?? nights[nights.length - 1]
  const prev = nights.filter((n) => n !== last)
  if (last) {
    const h = last.duration_min / 60
    const hs = h.toFixed(1)
    if (h >= 8) add(`Sommeil ${hs} h (≥ 8 h)`, 10)
    else if (h >= 7) add(`Sommeil ${hs} h`, 4)
    else if (h >= 6) add(`Sommeil court ${hs} h`, -6)
    else add(`Sommeil très court ${hs} h`, -15)
    if (last.quality) add(`Qualité ressentie ${last.quality}/5`, (last.quality - 3) * 4)
    const hrvs = prev.filter((n) => n.hrv_ms).map((n) => n.hrv_ms!)
    if (last.hrv_ms && hrvs.length) {
      const m = mean(hrvs)
      const ratio = last.hrv_ms / m
      if (ratio < 0.9) add(`VFC basse (${last.hrv_ms} ms vs moy. ${Math.round(m)})`, -10)
      else if (ratio > 1.05) add(`VFC haute (${last.hrv_ms} ms)`, 5)
    }
    const rhrs = prev.filter((n) => n.resting_hr).map((n) => n.resting_hr!)
    if (last.resting_hr && rhrs.length) {
      const diff = last.resting_hr - mean(rhrs)
      if (diff >= 5) add(`FC repos +${Math.round(diff)} bpm`, -8)
    }
  } else factors.push({ label: 'Pas de donnée de sommeil récente', delta: 0 })

  const acwr = loadSeries(1, today)[0]?.acwr ?? null
  const zone = acwrZone(acwr)
  if (zone === 'risque') add(`Charge en forte hausse (ratio ${acwr})`, -15)
  else if (zone === 'vigilance') add(`Charge en hausse (ratio ${acwr})`, -7)

  const y = addDays(today, -1)
  if (sessionsBetween(y, y).some((w) => w.category === 'match' || (w.rpe ?? 0) >= 8)) add('Séance/match intense hier', -8)

  score = Math.max(0, Math.min(100, score))
  const advice = score >= 75
    ? 'Feu vert : séance intense possible (fractionné, appuis).'
    : score >= 55 ? 'Séance modérée conseillée : technique au mur, renfo léger, footing.'
      : 'Priorité récupération : mobilité, étirements, sommeil.'
  return { score: Math.round(score), advice, factors, acwr, acwr_zone: zone }
}

export function goalCurrent(g: GoalRec, today = todayISO()): number | null {
  if (g.metric === 'manual') return g.measurements.length ? g.measurements[g.measurements.length - 1].value : g.baseline_value
  const start = g.period === 'week' ? mondayOf(today) : g.start_date
  if (g.metric === 'sleep_avg_h') {
    const nights = sleepBetween(g.period === 'week' ? addDays(today, -6) : start, today)
    return nights.length ? r2(mean(nights.map((n) => n.duration_min)) / 60) : null
  }
  const ws = sessionsBetween(start, today).filter((w) => !g.category || w.category === g.category)
  if (g.metric === 'sessions_count') return ws.length
  if (g.metric === 'duration_min') return r1(ws.reduce((a, w) => a + w.duration_min, 0))
  if (g.metric === 'distance_km') return r2(ws.reduce((a, w) => a + (w.distance_km ?? 0), 0))
  return null
}

export function goalProgress(g: GoalRec, cur: number | null): number {
  if (cur === null) return 0
  let pct: number
  if (g.direction === 'decrease') {
    const base = g.baseline_value ?? (g.measurements[0]?.value ?? cur)
    const span = base - g.target_value
    pct = span ? ((base - cur) / span) * 100 : cur <= g.target_value ? 100 : 0
  } else {
    const base = g.baseline_value ?? 0
    const span = g.target_value - base
    pct = span ? ((cur - base) / span) * 100 : 100
  }
  return r1(Math.max(0, Math.min(100, pct)))
}

export const goalOut = (g: GoalRec): Goal => {
  const cur = goalCurrent(g)
  return { ...structuredClone(g), current_value: cur, progress_pct: goalProgress(g, cur) }
}

const weekdayOf = (iso: string) => (new Date(iso + 'T12:00:00').getDay() + 6) % 7
const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)

export function plannedSessions(start: string, end: string): PlannedSession[] {
  const done = sessionsBetween(start, end)
  const out: PlannedSession[] = []
  for (const p of S().programs.filter((x) => x.active)) {
    let d = start > p.start_date ? start : p.start_date
    const lastDay = addDays(p.start_date, p.weeks * 7 - 1)
    const stop = end < lastDay ? end : lastDay
    while (d <= stop) {
      const week = Math.floor(daysBetween(p.start_date, d) / 7) + 1
      const deload = p.deload_every > 0 && week % p.deload_every === 0
      const factor = (1 + p.progression_pct / 100) ** (week - 1) * (deload ? 0.6 : 1)
      for (const ps of p.sessions) {
        if (ps.day_of_week !== weekdayOf(d)) continue
        const match = done.find((w) => w.program_session_id === ps.id && w.date === d)
          ?? done.find((w) => w.date === d && w.category === ps.category && w.program_session_id == null)
        out.push({
          date: d, week_index: week, deload, program_session: structuredClone(ps),
          scaled_duration_min: Math.round((ps.duration_min * factor) / 5) * 5 || 5,
          done_session_id: match?.id ?? null,
        })
      }
      d = addDays(d, 1)
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export function weeklyStats(weeks = 12, today = todayISO()): WeekStats[] {
  const first = addDays(mondayOf(today), -7 * (weeks - 1))
  const all = sessionsBetween(first, today)
  const nights = sleepBetween(first, today)
  const plan = plannedSessions(first, today)
  return Array.from({ length: weeks }, (_, i) => {
    const ws = addDays(first, 7 * i)
    const we = addDays(ws, 6)
    const wk = all.filter((w) => w.date >= ws && w.date <= we)
    const wn = nights.filter((n) => n.date >= ws && n.date <= we)
    const wp = plan.filter((p) => p.date >= ws && p.date <= we)
    const by = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0])) as Record<Category, number>
    wk.forEach((w) => { by[w.category] += w.duration_min })
    const footings = wk.filter((w) => w.category === 'footing' && w.distance_km)
    const totD = footings.reduce((a, w) => a + (w.distance_km ?? 0), 0)
    return {
      week_start: ws,
      minutes_by_category: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, r1(v)])) as Record<Category, number>,
      total_minutes: r1(Object.values(by).reduce((a, b) => a + b, 0)),
      distance_km: r2(wk.reduce((a, w) => a + (w.distance_km ?? 0), 0)),
      load: r1(wk.reduce((a, w) => a + sessionLoad(w), 0)),
      sessions: wk.length,
      sleep_avg_h: wn.length ? r2(mean(wn.map((n) => n.duration_min)) / 60) : null,
      footing_pace_min_km: totD ? r2(footings.reduce((a, w) => a + w.duration_min, 0) / totD) : null,
      planned: wp.length,
      planned_done: wp.filter((p) => p.done_session_id).length,
    }
  })
}
