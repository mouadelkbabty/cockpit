// Mouvement physique : ressorts interruptibles, projection d'élan, résistance en butée.

// Distance qu'un geste lancé à `velocity` px/s parcourt encore (même décroissance que le défilement iOS).
export function project(velocity, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

// Au-delà d'une limite, l'élément suit de moins en moins le doigt.
export function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

// Ressort décrit par son amortissement (1 = sans rebond) et sa réponse en secondes.
export function springParams(dampingRatio = 1, response = 0.35) {
  const omega = (2 * Math.PI) / response
  return { k: omega * omega, c: 2 * dampingRatio * omega }
}

// Solution exacte du ressort amorti sur un pas de temps : stable et fidèle quelle que soit la fréquence d'affichage.
export function springStep(state, target, params, dt) {
  const w0 = Math.sqrt(params.k)
  const zeta = params.c / (2 * w0)
  const x0 = state.x - target
  const v0 = state.v
  let x
  let v
  if (Math.abs(zeta - 1) < 1e-6) {
    const e = Math.exp(-w0 * dt)
    const b = v0 + w0 * x0
    x = e * (x0 + b * dt)
    v = e * (v0 - w0 * b * dt)
  } else if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta)
    const e = Math.exp(-zeta * w0 * dt)
    const b = (v0 + zeta * w0 * x0) / wd
    const cos = Math.cos(wd * dt)
    const sin = Math.sin(wd * dt)
    x = e * (x0 * cos + b * sin)
    v = e * ((b * wd - zeta * w0 * x0) * cos - (x0 * wd + zeta * w0 * b) * sin)
  } else {
    const root = w0 * Math.sqrt(zeta * zeta - 1)
    const r1 = -zeta * w0 + root
    const r2 = -zeta * w0 - root
    const a = (v0 - r2 * x0) / (r1 - r2)
    const b = x0 - a
    x = a * Math.exp(r1 * dt) + b * Math.exp(r2 * dt)
    v = a * r1 * Math.exp(r1 * dt) + b * r2 * Math.exp(r2 * dt)
  }
  return { x: x + target, v }
}

// Vitesse (px/s) sur les 100 dernières millisecondes de l'historique du pointeur.
export function releaseVelocity(history) {
  if (history.length < 2) return 0
  const last = history[history.length - 1]
  let first = history[0]
  for (const h of history) {
    if (last.t - h.t <= 100) { first = h; break }
  }
  const dt = last.t - first.t
  return dt > 0 ? ((last.y - first.y) / dt) * 1000 : 0
}

// Anime une valeur vers une cible ; `retarget` change la cible en gardant la vitesse courante.
export function createSpring({ value = 0, onUpdate, onRest }) {
  let state = { x: value, v: 0 }
  let target = value
  let params = springParams()
  let frame = null
  let lastTime = 0

  function tick(now) {
    const dt = Math.min(0.032, (now - lastTime) / 1000 || 0.016)
    lastTime = now
    state = springStep(state, target, params, dt)
    if (Math.abs(state.x - target) < 0.5 && Math.abs(state.v) < 5) {
      state = { x: target, v: 0 }
      frame = null
      onUpdate?.(state.x)
      onRest?.(state.x)
      return
    }
    onUpdate?.(state.x)
    frame = requestAnimationFrame(tick)
  }

  return {
    get value() { return state.x },
    get moving() { return frame !== null },
    set(x) { this.stop(); state = { x, v: 0 }; target = x; onUpdate?.(x) },
    stop() { if (frame !== null) cancelAnimationFrame(frame); frame = null },
    retarget(to, { velocity, damping = 1, response = 0.35 } = {}) {
      target = to
      params = springParams(damping, response)
      if (velocity !== undefined) state = { x: state.x, v: velocity }
      if (frame === null) { lastTime = performance.now(); frame = requestAnimationFrame(tick) }
    },
  }
}
