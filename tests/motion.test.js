import { describe, it, expect, vi, afterEach } from 'vitest'
import { project, rubberband, springStep, springParams, releaseVelocity, nearestIndex, blend, resample, createSpring } from '../src/lib/motion.js'

describe('motion', () => {
  it('projette l’élan d’un geste comme le défilement iOS', () => {
    expect(project(1000)).toBeCloseTo(499, 0)
    expect(project(0)).toBe(0)
    expect(project(-1000)).toBeCloseTo(-499, 0)
  })
  it('résiste de plus en plus au-delà de la limite', () => {
    const a = rubberband(50, 600)
    const b = rubberband(200, 600)
    expect(a).toBeGreaterThan(0)
    expect(a).toBeLessThan(50)
    expect(b).toBeLessThan(200)
    expect(b - a).toBeLessThan(150)
    expect(rubberband(-50, 600)).toBeCloseTo(-a)
  })
  function run(damping, response, v0 = 0) {
    const p = springParams(damping, response)
    let s = { x: 0, v: v0 }
    let max = 0
    for (let i = 0; i < 240; i++) {
      s = springStep(s, 100, p, 1 / 120)
      max = Math.max(max, s.x)
    }
    return { ...s, max }
  }
  it('arrive à la cible sans dépasser quand l’amortissement vaut 1', () => {
    const r = run(1, 0.35)
    expect(r.x).toBeCloseTo(100, 0)
    expect(r.max).toBeLessThanOrEqual(100.5)
  })
  it('dépasse légèrement avec un amortissement de 0,8', () => {
    const r = run(0.8, 0.3)
    expect(r.x).toBeCloseTo(100, 0)
    expect(r.max).toBeGreaterThan(100.5)
  })
  it('mesure la vitesse au relâchement à partir de l’historique récent', () => {
    const hist = [{ t: 0, y: 0 }, { t: 16, y: 10 }, { t: 32, y: 20 }, { t: 48, y: 30 }]
    expect(releaseVelocity(hist)).toBeCloseTo(625, 0)
    expect(releaseVelocity([{ t: 0, y: 5 }])).toBe(0)
  })
})

describe('aides de mouvement', () => {
  it('trouve le repère le plus proche d’une position', () => {
    expect(nearestIndex([40, 120, 200, 280], 130)).toBe(1)
    expect(nearestIndex([40, 120, 200, 280], -50)).toBe(0)
    expect(nearestIndex([40, 120, 200, 280], 999)).toBe(3)
    expect(nearestIndex([], 10)).toBe(-1)
  })
  it('mélange deux séries point par point', () => {
    expect(blend([0, 10], [10, 30], 0.5)).toEqual([5, 20])
    expect(blend([0, 10], [10, 30], 0)).toEqual([0, 10])
    expect(blend([0, 10], [10, 30], 1)).toEqual([10, 30])
  })
  it('rééchantillonne une série à une autre longueur en gardant ses extrémités', () => {
    expect(resample([0, 10], 3)).toEqual([0, 5, 10])
    expect(resample([0, 5, 10], 2)).toEqual([0, 10])
    expect(resample([7], 3)).toEqual([7, 7, 7])
    expect(resample([], 2)).toEqual([0, 0])
  })
})

describe('createSpring', () => {
  afterEach(() => vi.unstubAllGlobals())

  // Fait tourner le ressort image par image, sans navigateur.
  function play(options, to, retarget) {
    const frames = []
    let now = 0
    vi.stubGlobal('performance', { now: () => now })
    vi.stubGlobal('requestAnimationFrame', (cb) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const seen = []
    let rested = null
    const spring = createSpring({ ...options, onUpdate: (v) => seen.push(v), onRest: (v) => (rested = v) })
    spring.retarget(to, retarget)
    for (let i = 0; i < 600 && frames.length; i++) {
      now += 1000 / 60
      frames.shift()(now)
    }
    return { seen, rested }
  }

  it('s’arrête exactement sur la cible', () => {
    const { seen, rested } = play({ value: 0 }, 300, { damping: 1, response: 0.35 })
    expect(rested).toBe(300)
    expect(seen[seen.length - 1]).toBe(300)
  })

  it('ne saute pas à la cible à mi-course quand la valeur va de 0 à 1', () => {
    const { seen, rested } = play({ value: 0, precision: 0.001 }, 1, { damping: 1, response: 1 })
    expect(rested).toBe(1)
    // Le tracé passe bien par la fin de course au lieu de s'y téléporter.
    expect(seen.some((v) => v > 0.9 && v < 0.99)).toBe(true)
    expect(seen.filter((v) => v < 1).length).toBeGreaterThan(40)
  })
})
