// Import montre dans le navigateur : GPX/TCX (XML), FIT (SDK officiel Garmin), CSV sommeil.
import { Decoder, Stream } from '@garmin/fitsdk'
import type { Category, SleepInput } from '../../models/types'
import type { WorkoutRec } from './db'

export type ParsedActivity = Omit<WorkoutRec, 'id'>

const hash = (bytes: Uint8Array) => {
  // FNV-1a 32 bits ×2 (empreinte de dédoublonnage, pas de sécurité)
  let h1 = 0x811c9dc5, h2 = 0x01000193
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 16777619)
    h2 = Math.imul(h2 ^ bytes[bytes.length - 1 - i], 2246822519)
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
}

const pad = (n: number) => String(n).padStart(2, '0')
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

export function sportToCategory(sport?: string | null): Category {
  const s = (sport ?? '').toLowerCase()
  if (/soccer|football/.test(s)) return 'collectif'
  if (/strength|training|fitness/.test(s)) return 'renforcement'
  if (/yoga|stretch|mobility/.test(s)) return 'recuperation'
  return 'footing'
}

const base = (o: Partial<ParsedActivity>): ParsedActivity => ({
  date: localDate(new Date()), category: 'footing', title: 'Activité importée', duration_min: 0, distance_km: null,
  avg_hr: null, max_hr: null, calories: null, rpe: null, notes: '', program_session_id: null, details: {}, source: 'gpx', ...o,
})

const byLocal = (root: Document | Element, name: string) => Array.from(root.getElementsByTagNameNS('*', name))
const childText = (el: Element, name: string) => byLocal(el, name)[0]?.textContent ?? null

function haversine(a: [number, number], b: [number, number]) {
  const R = 6371, rad = Math.PI / 180
  const [la1, lo1, la2, lo2] = [a[0] * rad, a[1] * rad, b[0] * rad, b[1] * rad]
  const h = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const xml = (bytes: Uint8Array) => {
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('XML illisible')
  return doc
}

export function parseGpx(bytes: Uint8Array): ParsedActivity[] {
  const doc = xml(bytes)
  const pts = byLocal(doc, 'trkpt').map((p) => {
    const t = childText(p, 'time')
    const hr = childText(p, 'hr')
    return { ll: [Number(p.getAttribute('lat')), Number(p.getAttribute('lon'))] as [number, number], t: t ? new Date(t) : null, hr: hr ? Number(hr) : null }
  })
  if (pts.length < 2) throw new Error('GPX sans trace exploitable')
  let dist = 0
  for (let i = 0; i < pts.length - 1; i++) dist += haversine(pts[i].ll, pts[i + 1].ll)
  const times = pts.filter((p) => p.t).map((p) => p.t!)
  const hrs = pts.filter((p) => p.hr).map((p) => p.hr!)
  const start = times[0]
  const sport = byLocal(doc, 'type')[0]?.textContent
  return [base({
    date: start ? localDate(start) : localDate(new Date()),
    category: sportToCategory(sport),
    title: start ? `Course importée (${hhmm(start)})` : 'Course importée',
    duration_min: times.length > 1 ? r1((times[times.length - 1].getTime() - times[0].getTime()) / 60000) : 0,
    distance_km: r2(dist),
    avg_hr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
    max_hr: hrs.length ? Math.max(...hrs) : null,
    source: 'gpx', external_id: 'gpx-' + hash(bytes), details: { points: pts.length },
  })]
}

export function parseTcx(bytes: Uint8Array): ParsedActivity[] {
  const doc = xml(bytes)
  const out: ParsedActivity[] = []
  for (const act of byLocal(doc, 'Activity')) {
    const sport = act.getAttribute('Sport')
    let start: Date | null = null
    let dur = 0, dist = 0, cal = 0, hrW = 0, hrMax = 0
    const laps: { time_s: number; distance_m: number | null; avg_hr: number | null }[] = []
    for (const lap of byLocal(act, 'Lap')) {
      start ??= new Date(lap.getAttribute('StartTime')!)
      const num = (n: string) => { const v = Array.from(lap.children).find((c) => c.localName === n); return v ? Number(v.textContent) : 0 }
      const hrOf = (n: string) => { const v = Array.from(lap.children).find((c) => c.localName === n); return v ? Number(childText(v, 'Value')) : 0 }
      const t = num('TotalTimeSeconds'), dm = num('DistanceMeters'), avg = hrOf('AverageHeartRateBpm')
      dur += t; dist += dm; cal += num('Calories'); hrW += avg * t; hrMax = Math.max(hrMax, hrOf('MaximumHeartRateBpm'))
      laps.push({ time_s: t, distance_m: dm || null, avg_hr: avg || null })
    }
    if (!start) continue
    out.push(base({
      date: localDate(start), category: laps.length >= 6 ? 'fractionne' : sportToCategory(sport),
      title: `${sport ?? 'Activité'} importée (${hhmm(start)})`, duration_min: r1(dur / 60),
      distance_km: dist ? r2(dist / 1000) : null, avg_hr: dur && hrW ? Math.round(hrW / dur) : null, max_hr: hrMax || null,
      calories: Math.trunc(cal) || null, source: 'tcx', external_id: `tcx-${hash(bytes)}-${out.length}`, details: { laps } as never,
    }))
  }
  if (!out.length) throw new Error('TCX sans activité')
  return out
}

export function parseFit(bytes: Uint8Array): ParsedActivity[] {
  const dec = new Decoder(Stream.fromByteArray(Array.from(bytes)))
  if (!dec.isFIT()) throw new Error('Fichier FIT invalide')
  const { messages, errors } = dec.read()
  const sessions = (messages.sessionMesgs ?? []) as Record<string, unknown>[]
  if (!sessions.length) throw new Error(errors?.length ? `FIT illisible : ${String(errors[0])}` : 'FIT sans session')
  return sessions.map((s, i) => {
    const start = s.startTime instanceof Date ? s.startTime : new Date()
    const dist = Number(s.totalDistance ?? 0)
    return base({
      date: localDate(start), category: sportToCategory(String(s.sport ?? '')),
      title: `${String(s.sport ?? 'Activité')} importée (${hhmm(start)})`,
      duration_min: r1(Number(s.totalTimerTime ?? s.totalElapsedTime ?? 0) / 60),
      distance_km: dist ? r2(dist / 1000) : null,
      avg_hr: (s.avgHeartRate as number) ?? null, max_hr: (s.maxHeartRate as number) ?? null,
      calories: (s.totalCalories as number) ?? null, source: 'fit', external_id: `fit-${hash(bytes)}-${i}`,
    })
  })
}

export function parseActivity(name: string, bytes: Uint8Array): ParsedActivity[] {
  const ext = name.toLowerCase().split('.').pop()
  if (ext === 'gpx') return parseGpx(bytes)
  if (ext === 'tcx') return parseTcx(bytes)
  if (ext === 'fit') return parseFit(bytes)
  throw new Error(`Format .${ext} non supporté (GPX, TCX ou FIT)`)
}

// ---------------------------------------------------------------- Sommeil CSV
const ALIASES: Record<string, string[]> = {
  date: ['date', 'day', 'jour', 'calendar date'],
  bedtime: ['bedtime', 'coucher', 'sleep start', 'start'],
  wake_time: ['wake_time', 'reveil', 'réveil', 'sleep end', 'end'],
  duration_min: ['duration_min', 'duree_min', 'durée (min)', 'total sleep (min)', 'duration'],
  quality: ['quality', 'qualite', 'qualité'],
  deep_min: ['deep_min', 'deep', 'profond'],
  rem_min: ['rem_min', 'rem', 'paradoxal'],
  light_min: ['light_min', 'light', 'leger', 'léger'],
  awake_min: ['awake_min', 'awake', 'eveil', 'éveil'],
  resting_hr: ['resting_hr', 'fc_repos', 'resting heart rate'],
  hrv_ms: ['hrv_ms', 'hrv', 'vfc'],
}

const toInt = (v?: string) => {
  if (v === undefined || v.trim() === '') return null
  const s = v.trim().replace(',', '.')
  if (s.includes(':')) { const [h, m] = s.split(':'); return Number(h) * 60 + Number(m) }
  return Math.round(Number(s))
}
const toHHMM = (v?: string) => {
  if (!v?.trim()) return null
  let s = v.trim()
  if (s.includes('T') || s.includes(' ')) s = s.replace('T', ' ').split(' ')[1]
  return s.slice(0, 5)
}

export function parseSleepCsv(text: string): SleepInput[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) throw new Error('CSV vide')
  const sep = [';', '\t', ','].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0]
  const head = lines[0].split(sep).map((h) => h.trim().toLowerCase())
  const idx: Record<string, number> = {}
  for (const [k, al] of Object.entries(ALIASES)) { const i = head.findIndex((h) => al.includes(h)); if (i >= 0) idx[k] = i }
  if (idx.date === undefined || idx.duration_min === undefined) throw new Error('Colonnes requises : date, duration_min')
  return lines.slice(1).map((l) => {
    const c = l.split(sep)
    const g = (k: string) => (idx[k] === undefined ? undefined : c[idx[k]])
    const d = (g('date') ?? '').trim().slice(0, 10)
    const date = d.includes('-') ? d : d.split('/').reverse().join('-')
    return {
      date, bedtime: toHHMM(g('bedtime')), wake_time: toHHMM(g('wake_time')), duration_min: toInt(g('duration_min')) ?? 0,
      quality: toInt(g('quality')), deep_min: toInt(g('deep_min')), rem_min: toInt(g('rem_min')), light_min: toInt(g('light_min')),
      awake_min: toInt(g('awake_min')), resting_hr: toInt(g('resting_hr')), hrv_ms: toInt(g('hrv_ms')),
    }
  })
}
