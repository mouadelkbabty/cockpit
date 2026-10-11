import { describe, it, expect } from 'vitest'
import { dayForDate, lastEntry, progression, weekDone, parseExercises, formatExercises } from '../src/lib/sport.js'

const program = {
  days: [
    { id: 'push', name: 'Push', exercises: [{ name: 'Développé couché', sets: 4, reps: '6-8' }] },
    { id: 'pull', name: 'Pull', exercises: [{ name: 'Tractions', sets: 4, reps: '6-10' }] },
  ],
  week: ['push', 'pull', null, 'push', 'pull', null, null],
}
const sessions = [
  { id: 's1', date: '2026-10-05', dayId: 'push', entries: [{ exercise: 'Développé couché', sets: [{ reps: 8, weight: 60 }, { reps: 6, weight: 62.5 }] }] },
  { id: 's2', date: '2026-10-08', dayId: 'push', entries: [{ exercise: 'Développé couché', sets: [{ reps: 8, weight: 62.5 }, { reps: 7, weight: 65 }] }] },
  { id: 's3', date: '2026-10-06', dayId: 'pull', entries: [{ exercise: 'Tractions', sets: [{ reps: 8, weight: 0 }] }] },
]

describe('sport', () => {
  it('trouve la séance prévue un jour donné, ou le repos', () => {
    expect(dayForDate(program, '2026-10-12').id).toBe('push') // lundi
    expect(dayForDate(program, '2026-10-14')).toBe(null) // mercredi
    expect(dayForDate(null, '2026-10-12')).toBe(null)
  })
  it('retrouve les dernières séries d’un exercice avant une date', () => {
    expect(lastEntry(sessions, 'Développé couché', '2026-10-12').sets[1].weight).toBe(65)
    expect(lastEntry(sessions, 'Développé couché', '2026-10-08').sets[1].weight).toBe(62.5)
    expect(lastEntry(sessions, 'Squat', '2026-10-12')).toBe(null)
  })
  it('donne la progression par séance : charge max et volume', () => {
    expect(progression(sessions, 'Développé couché')).toEqual([
      { date: '2026-10-05', top: 62.5, volume: 855 },
      { date: '2026-10-08', top: 65, volume: 955 },
    ])
  })
  it('compte les jours d’entraînement de la semaine', () => {
    expect(weekDone(sessions, '2026-10-11')).toEqual(['2026-10-05', '2026-10-06', '2026-10-08'])
    expect(weekDone(sessions, '2026-10-12')).toEqual([])
  })
  it('lit et réécrit une liste d’exercices en texte', () => {
    const txt = 'Développé couché 4x6-8\nTractions 3 x 10\n\nGainage'
    const parsed = parseExercises(txt)
    expect(parsed).toEqual([
      { name: 'Développé couché', sets: 4, reps: '6-8' },
      { name: 'Tractions', sets: 3, reps: '10' },
      { name: 'Gainage', sets: 3, reps: '' },
    ])
    expect(formatExercises(parsed)).toBe('Développé couché 4x6-8\nTractions 3x10\nGainage 3x')
  })
})
