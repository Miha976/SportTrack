import type { ISODate } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export const toISO = (d: Date): ISODate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const fromISO = (s: ISODate) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const todayISO = () => toISO(new Date())
export const addDays = (s: ISODate, n: number) => {
  const d = fromISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}
export const mondayOf = (s: ISODate) => {
  const d = fromISO(s)
  return addDays(s, -((d.getDay() + 6) % 7))
}
/** 0 = lundi */
export const weekday = (s: ISODate) => (fromISO(s).getDay() + 6) % 7

export const fmtDate = (s: ISODate, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  fromISO(s).toLocaleDateString('fr-FR', opts)
export const fmtShort = (s: ISODate) => fromISO(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

export const fmtMinutes = (min: number) => {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h ? `${h} h ${pad(m)}` : `${m} min`
}
export const fmtPace = (minPerKm: number) => {
  const m = Math.floor(minPerKm)
  return `${m}'${pad(Math.round((minPerKm - m) * 60))}"/km`
}

/** Durée entre coucher et réveil (gère le passage de minuit). */
export const minutesBetween = (bed: string, wake: string) => {
  const [bh, bm] = bed.split(':').map(Number)
  const [wh, wm] = wake.split(':').map(Number)
  let diff = wh * 60 + wm - (bh * 60 + bm)
  if (diff <= 0) diff += 24 * 60
  return diff
}
