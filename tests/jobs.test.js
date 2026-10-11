import { describe, it, expect } from 'vitest'
import { STAGES, isActive, followUps, countsByStage } from '../src/lib/jobs.js'

const apps = [
  { id: '1', company: 'A', stage: 'test', nextDate: '2026-10-10', appliedOn: '2026-10-05' },
  { id: '2', company: 'B', stage: 'postule', appliedOn: '2026-10-01' },
  { id: '3', company: 'C', stage: 'postule', appliedOn: '2026-10-08' },
  { id: '4', company: 'D', stage: 'refus', appliedOn: '2026-09-01' },
  { id: '5', company: 'E', stage: 'entretien', nextDate: '2026-10-20', appliedOn: '2026-09-20' },
  { id: '6', company: 'F', stage: 'a_postuler' },
]

describe('jobs', () => {
  it('liste les étapes dans l’ordre', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['a_postuler', 'postule', 'test', 'entretien', 'offre', 'refus'])
  })
  it('distingue les candidatures en cours', () => {
    expect(isActive(apps[0])).toBe(true)
    expect(isActive(apps[3])).toBe(false)
  })
  it('remonte celles dont la prochaine action est due, la plus ancienne d’abord', () => {
    expect(followUps(apps, '2026-10-11').map((a) => a.id)).toEqual(['2', '1'])
  })
  it('relance au bout de 7 jours sans date prévue, mais pas avant', () => {
    const ids = followUps(apps, '2026-10-11').map((a) => a.id)
    expect(ids).toContain('2')
    expect(ids).not.toContain('3')
  })
  it('n’alerte ni sur les refus, ni sur les dates futures, ni sur les offres pas encore envoyées', () => {
    const ids = followUps(apps, '2026-10-11').map((a) => a.id)
    expect(ids).not.toContain('4')
    expect(ids).not.toContain('5')
    expect(ids).not.toContain('6')
  })
  it('compte par étape', () => {
    expect(countsByStage(apps)).toMatchObject({ postule: 2, test: 1, refus: 1, entretien: 1, a_postuler: 1, offre: 0 })
  })
})
