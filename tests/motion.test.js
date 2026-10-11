import { describe, it, expect } from 'vitest'
import { project, rubberband, springStep, springParams, releaseVelocity } from '../src/lib/motion.js'

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
