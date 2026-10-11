import { diffDays, toDate } from './dates.js'

const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const eur2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

export function eur(n) {
  const v = Number(n) || 0
  return Number.isInteger(v) ? eur0.format(v) : eur2.format(v)
}

export function kg(n) {
  return `${num1.format(Number(n) || 0)} kg`
}

const num2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })

export function percent(n) {
  return `${num2.format(Number(n) || 0)} %`
}

export function number(n) {
  return num1.format(Number(n) || 0)
}

const UTC = { timeZone: 'UTC' }
const fLong = new Intl.DateTimeFormat('fr-FR', { ...UTC, weekday: 'long', day: 'numeric', month: 'long' })
const fShort = new Intl.DateTimeFormat('fr-FR', { ...UTC, day: 'numeric', month: 'short' })
const fShortYear = new Intl.DateTimeFormat('fr-FR', { ...UTC, day: 'numeric', month: 'short', year: 'numeric' })
const fMonth = new Intl.DateTimeFormat('fr-FR', { ...UTC, month: 'long', year: 'numeric' })
const fMonthShort = new Intl.DateTimeFormat('fr-FR', { ...UTC, month: 'short' })
const fMonthOnly = new Intl.DateTimeFormat('fr-FR', { ...UTC, month: 'long' })

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export function dateLong(iso) {
  return cap(fLong.format(toDate(iso)))
}

export function dateShort(iso, today) {
  const sameYear = !today || iso.slice(0, 4) === today.slice(0, 4)
  // Sans le point d'abréviation (« 5 oct »), pour ne jamais finir une phrase par deux points.
  return (sameYear ? fShort : fShortYear).format(toDate(iso)).replace('.', '')
}

export function monthLabel(key) {
  return fMonth.format(toDate(`${key}-01`))
}

export function monthName(key) {
  return fMonthOnly.format(toDate(`${key}-01`))
}

export function monthShort(key) {
  return fMonthShort.format(toDate(`${key}-01`)).replace('.', '')
}

export function relativeDay(iso, today) {
  const d = diffDays(today, iso)
  if (d === 0) return "Aujourd'hui"
  if (d === 1) return 'Demain'
  if (d === -1) return 'Hier'
  if (d > 1 && d <= 14) return `Dans ${d} jours`
  if (d < -1) return `En retard de ${-d} jours`
  return dateShort(iso, today)
}
