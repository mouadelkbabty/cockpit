import { weekdayIndex, startOfWeek, addDays } from './dates.js'

export const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export function dayForDate(program, iso) {
  if (!program?.days || !program?.week) return null
  const id = program.week[weekdayIndex(iso)]
  return program.days.find((d) => d.id === id) || null
}

// Dernières séries enregistrées pour un exercice, strictement avant la date donnée.
export function lastEntry(sessions, exercise, before) {
  let best = null
  for (const s of sessions) {
    if (s.date >= before) continue
    const e = (s.entries || []).find((x) => x.exercise === exercise)
    if (e && (!best || s.date > best.date)) best = { date: s.date, sets: e.sets }
  }
  return best
}

export function progression(sessions, exercise) {
  const out = []
  for (const s of sessions) {
    const e = (s.entries || []).find((x) => x.exercise === exercise)
    if (!e) continue
    const sets = (e.sets || []).filter((x) => Number(x.reps) > 0)
    if (!sets.length) continue
    out.push({
      date: s.date,
      top: Math.max(...sets.map((x) => Number(x.weight) || 0)),
      volume: sets.reduce((sum, x) => sum + Number(x.reps) * (Number(x.weight) || 0), 0),
    })
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1))
}

// Jours où une séance a été enregistrée dans la semaine (lundi à dimanche) de la date donnée.
export function weekDone(sessions, iso) {
  const from = startOfWeek(iso)
  const to = addDays(from, 6)
  return [...new Set(sessions.filter((s) => s.date >= from && s.date <= to).map((s) => s.date))].sort()
}

export function exerciseNames(program, sessions) {
  const names = new Set()
  for (const d of program?.days || []) for (const e of d.exercises || []) names.add(e.name)
  for (const s of sessions) for (const e of s.entries || []) names.add(e.exercise)
  return [...names]
}

// Une ligne par exercice : « Développé couché 4x6-8 ».
export function parseExercises(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)\s+(\d+)\s*[x×]\s*(.*)$/i)
      if (!m) return { name: line, sets: 3, reps: '' }
      return { name: m[1].trim(), sets: Number(m[2]), reps: m[3].trim() }
    })
}

export function formatExercises(list) {
  return (list || []).map((e) => `${e.name} ${e.sets}x${e.reps ?? ''}`).join('\n')
}

export const PPL_TEMPLATE = {
  days: [
    { id: 'push-a', name: 'Push A', exercises: [
      { name: 'Développé couché', sets: 4, reps: '6-8' },
      { name: 'Développé incliné haltères', sets: 3, reps: '8-10' },
      { name: 'Développé militaire', sets: 3, reps: '8-10' },
      { name: 'Élévations latérales', sets: 4, reps: '12-15' },
      { name: 'Extensions triceps poulie', sets: 3, reps: '10-12' },
    ] },
    { id: 'pull-a', name: 'Pull A', exercises: [
      { name: 'Tractions', sets: 4, reps: '6-10' },
      { name: 'Rowing barre', sets: 4, reps: '8-10' },
      { name: 'Tirage vertical', sets: 3, reps: '10-12' },
      { name: 'Face pull', sets: 3, reps: '12-15' },
      { name: 'Curl barre', sets: 3, reps: '8-12' },
    ] },
    { id: 'legs-a', name: 'Legs A', exercises: [
      { name: 'Squat', sets: 4, reps: '6-8' },
      { name: 'Soulevé de terre roumain', sets: 3, reps: '8-10' },
      { name: 'Presse à cuisses', sets: 3, reps: '10-12' },
      { name: 'Leg curl', sets: 3, reps: '10-12' },
      { name: 'Mollets debout', sets: 4, reps: '12-15' },
    ] },
    { id: 'push-b', name: 'Push B', exercises: [
      { name: 'Développé militaire', sets: 4, reps: '6-8' },
      { name: 'Développé couché haltères', sets: 3, reps: '8-10' },
      { name: 'Écarté poulie', sets: 3, reps: '12-15' },
      { name: 'Élévations latérales', sets: 4, reps: '12-15' },
      { name: 'Dips', sets: 3, reps: '8-12' },
    ] },
    { id: 'pull-b', name: 'Pull B', exercises: [
      { name: 'Rowing haltère', sets: 4, reps: '8-10' },
      { name: 'Tirage vertical prise serrée', sets: 3, reps: '10-12' },
      { name: 'Tirage horizontal', sets: 3, reps: '10-12' },
      { name: 'Oiseau', sets: 3, reps: '12-15' },
      { name: 'Curl marteau', sets: 3, reps: '10-12' },
    ] },
    { id: 'legs-b', name: 'Legs B', exercises: [
      { name: 'Soulevé de terre', sets: 3, reps: '5' },
      { name: 'Fentes bulgares', sets: 3, reps: '8-10' },
      { name: 'Leg extension', sets: 3, reps: '12-15' },
      { name: 'Leg curl', sets: 3, reps: '10-12' },
      { name: 'Mollets assis', sets: 4, reps: '12-15' },
    ] },
  ],
  week: ['push-a', 'pull-a', 'legs-a', 'push-b', 'pull-b', 'legs-b', null],
}
