import { addDays, addMonths } from './dates.js'

export const REPEATS = [
  { id: 'none', label: 'Une seule fois' },
  { id: 'monthly', label: 'Chaque mois' },
  { id: '4weeks', label: 'Toutes les 4 semaines' },
  { id: '6months', label: 'Tous les 6 mois' },
]

function nth(start, repeat, n) {
  if (repeat === 'monthly') return addMonths(start, n)
  if (repeat === '6months') return addMonths(start, 6 * n)
  if (repeat === '4weeks') return addDays(start, 28 * n)
  return n === 0 ? start : null
}

// Dates d'une échéance comprises entre from et to (inclus).
export function occurrences(deadline, from, to) {
  const out = []
  const repeat = deadline.repeat || 'none'
  const end = deadline.until && deadline.until < to ? deadline.until : to
  for (let n = 0; n < 2000; n++) {
    const d = nth(deadline.date, repeat, n)
    if (!d || d > end) break
    if (d >= from) out.push(d)
    if (repeat === 'none') break
  }
  return out
}

// Échéances des `days` prochains jours, plus les échéances uniques en retard non faites.
export function upcoming(deadlines, today, days) {
  const to = addDays(today, days)
  const out = []
  for (const dl of deadlines) {
    const done = new Set(dl.doneDates || [])
    const repeat = dl.repeat || 'none'
    if (repeat === 'none') {
      if (dl.date > to) continue
      const isDone = done.has(dl.date)
      if (dl.date < today && isDone) continue
      out.push({ id: dl.id, title: dl.title, date: dl.date, done: isDone, overdue: dl.date < today && !isDone, deadline: dl })
    } else {
      for (const date of occurrences(dl, today, to)) {
        out.push({ id: dl.id, title: dl.title, date, done: done.has(date), overdue: false, deadline: dl })
      }
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}
