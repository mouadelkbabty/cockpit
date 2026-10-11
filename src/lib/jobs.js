import { addDays } from './dates.js'

export const STAGES = [
  { id: 'a_postuler', label: 'À postuler' },
  { id: 'postule', label: 'Candidature envoyée' },
  { id: 'test', label: 'Test' },
  { id: 'entretien', label: 'Entretien' },
  { id: 'offre', label: 'Offre reçue' },
  { id: 'refus', label: 'Refus ou abandon' },
]

const WAITING = new Set(['postule', 'test', 'entretien'])

export function stageLabel(id) {
  return STAGES.find((s) => s.id === id)?.label || id
}

export function isActive(app) {
  return app.stage !== 'refus'
}

// Date à laquelle une candidature demande une action : la date prévue, sinon 7 jours après le dernier mouvement.
export function dueDate(app) {
  if (!isActive(app)) return null
  if (app.nextDate) return app.nextDate
  if (!WAITING.has(app.stage)) return null
  const base = app.touchedOn || app.appliedOn
  return base ? addDays(base, 7) : null
}

export function followUps(apps, today) {
  return apps
    .map((a) => ({ a, due: dueDate(a) }))
    .filter((x) => x.due && x.due <= today)
    .sort((x, y) => (x.due < y.due ? -1 : x.due > y.due ? 1 : 0))
    .map((x) => x.a)
}

export function countsByStage(apps) {
  const out = Object.fromEntries(STAGES.map((s) => [s.id, 0]))
  for (const a of apps) if (a.stage in out) out[a.stage]++
  return out
}
