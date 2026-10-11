import { describe, it, expect } from 'vitest'
import { addDays, addMonths, diffDays, monthKey, weekdayIndex, startOfWeek, todayISO, monthsBetween } from '../src/lib/dates.js'

describe('dates', () => {
  it('ajoute des jours en passant les mois', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('ajoute des mois en bornant au dernier jour du mois', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-12-09', 6)).toBe('2027-06-09')
  })
  it('compte les jours entre deux dates', () => {
    expect(diffDays('2026-10-11', '2026-12-09')).toBe(59)
    expect(diffDays('2026-10-11', '2026-10-10')).toBe(-1)
  })
  it('donne la clé du mois et le nombre de mois entre deux clés', () => {
    expect(monthKey('2026-10-11')).toBe('2026-10')
    expect(monthsBetween('2026-10', '2027-03')).toBe(5)
  })
  it('numérote la semaine à partir du lundi', () => {
    expect(weekdayIndex('2026-10-11')).toBe(6) // dimanche
    expect(weekdayIndex('2026-10-12')).toBe(0) // lundi
    expect(startOfWeek('2026-10-11')).toBe('2026-10-05')
  })
  it('donne la date locale du jour', () => {
    expect(todayISO(new Date(2026, 9, 11, 23, 30))).toBe('2026-10-11')
  })
})
