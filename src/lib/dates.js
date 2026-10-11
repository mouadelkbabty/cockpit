// Dates manipulées comme des chaînes 'AAAA-MM-JJ', calculées en UTC pour éviter les décalages horaires.

const DAY = 86400000

function parse(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fmt(date) {
  return date.toISOString().slice(0, 10)
}

export function todayISO(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(iso, n) {
  return fmt(new Date(parse(iso).getTime() + n * DAY))
}

export function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + n, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  first.setUTCDate(Math.min(d, last))
  return fmt(first)
}

export function diffDays(a, b) {
  return Math.round((parse(b) - parse(a)) / DAY)
}

export function monthKey(iso) {
  return iso.slice(0, 7)
}

export function addMonthKey(key, n) {
  return addMonths(`${key}-01`, n).slice(0, 7)
}

export function monthsBetween(a, b) {
  const [ya, ma] = a.split('-').map(Number)
  const [yb, mb] = b.split('-').map(Number)
  return (yb - ya) * 12 + (mb - ma)
}

// 0 = lundi … 6 = dimanche
export function weekdayIndex(iso) {
  return (parse(iso).getUTCDay() + 6) % 7
}

export function startOfWeek(iso) {
  return addDays(iso, -weekdayIndex(iso))
}

export function toDate(iso) {
  return parse(iso)
}
