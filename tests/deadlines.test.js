import { describe, it, expect } from 'vitest'
import { occurrences, upcoming } from '../src/lib/deadlines.js'

describe('occurrences', () => {
  it('renvoie la date seule pour une échéance unique', () => {
    expect(occurrences({ date: '2026-12-09', repeat: 'none' }, '2026-10-01', '2026-12-31')).toEqual(['2026-12-09'])
    expect(occurrences({ date: '2026-12-09', repeat: 'none' }, '2027-01-01', '2027-12-31')).toEqual([])
  })
  it('répète chaque mois le même jour, borné en fin de mois', () => {
    expect(occurrences({ date: '2026-01-31', repeat: 'monthly' }, '2026-02-01', '2026-04-30')).toEqual([
      '2026-02-28', '2026-03-31', '2026-04-30',
    ])
  })
  it('répète toutes les 4 semaines', () => {
    expect(occurrences({ date: '2026-10-01', repeat: '4weeks' }, '2026-10-01', '2026-11-30')).toEqual([
      '2026-10-01', '2026-10-29', '2026-11-26',
    ])
  })
  it('répète tous les 6 mois', () => {
    expect(occurrences({ date: '2026-12-09', repeat: '6months' }, '2026-10-01', '2027-12-31')).toEqual([
      '2026-12-09', '2027-06-09', '2027-12-09',
    ])
  })
  it('s’arrête à la date de fin', () => {
    expect(occurrences({ date: '2026-01-05', repeat: 'monthly', until: '2027-03-05' }, '2027-02-01', '2027-06-30')).toEqual([
      '2027-02-05', '2027-03-05',
    ])
  })
})

describe('upcoming', () => {
  const list = [
    { id: 'a', title: 'Gouttières', date: '2026-01-05', repeat: 'monthly', doneDates: ['2026-11-05'] },
    { id: 'b', title: 'Facture ortho', date: '2026-12-09', repeat: 'none' },
    { id: 'c', title: 'Vieux truc pas fait', date: '2026-10-01', repeat: 'none' },
    { id: 'd', title: 'Vieux truc fait', date: '2026-10-02', repeat: 'none', doneDates: ['2026-10-02'] },
  ]
  const res = upcoming(list, '2026-10-11', 60)
  it('trie par date', () => {
    expect(res.map((r) => r.date)).toEqual(['2026-10-01', '2026-11-05', '2026-12-05', '2026-12-09'])
  })
  it('garde les échéances uniques en retard tant qu’elles ne sont pas faites', () => {
    expect(res[0]).toMatchObject({ id: 'c', overdue: true, done: false })
    expect(res.find((r) => r.id === 'd')).toBeUndefined()
  })
  it('marque les occurrences déjà cochées', () => {
    expect(res.find((r) => r.date === '2026-11-05').done).toBe(true)
    expect(res.find((r) => r.date === '2026-12-05').done).toBe(false)
  })
  it('ne remonte pas les occurrences passées des échéances répétées', () => {
    expect(res.filter((r) => r.id === 'a').every((r) => r.date >= '2026-10-11')).toBe(true)
  })
})
