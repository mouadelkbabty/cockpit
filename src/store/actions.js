import { save } from './index.js'
import { tap } from '../lib/haptic.js'

// Coche ou décoche une occurrence d'échéance.
export function toggleDeadline(deadline, date) {
  const done = new Set(deadline.doneDates || [])
  if (done.has(date)) done.delete(date)
  else done.add(date)
  save('deadlines', { ...deadline, doneDates: [...done].sort() })
  tap()
}
