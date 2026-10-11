<script>
// Compteur partagé entre toutes les feuilles : l'arrière-plan reste figé tant qu'une seule est ouverte.
let locks = 0
function lock(on) {
  locks += on ? 1 : -1
  const app = document.getElementById('app')
  if (app) app.inert = locks > 0
  document.documentElement.style.overflow = locks > 0 ? 'hidden' : ''
}
</script>

<script setup>
// Feuille modale. Sur téléphone elle monte du bas et suit le doigt ; sur ordinateur c'est une fenêtre centrée.
// Le mouvement est un ressort : on peut la rattraper en plein vol, et un geste lancé garde sa vitesse.
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { createSpring, project, rubberband, releaseVelocity } from '../lib/motion.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  label: { type: String, default: '' },
})
const emit = defineEmits(['update:open', 'closed'])

const mounted = ref(false)
const sheet = ref(null)
const scrim = ref(null)

let extent = 1
let desktop = false
let reduced = false
let closing = false
let drag = null
let releaseSpeed
let restoreFocus = null

const spring = createSpring({
  value: 0,
  onUpdate: apply,
  onRest(value) {
    if (closing && value >= extent - 1) finish()
  },
})

function apply(offset) {
  const el = sheet.value
  if (!el) return
  const progress = Math.max(0, Math.min(1, 1 - offset / extent))
  if (reduced) {
    el.style.transform = 'none'
    el.style.opacity = String(progress)
  } else if (desktop) {
    el.style.transform = `scale(${0.96 + 0.04 * progress})`
    el.style.opacity = String(Math.min(1, progress * 1.6))
  } else {
    el.style.transform = `translate3d(0, ${offset}px, 0)`
    el.style.opacity = '1'
  }
  if (scrim.value) scrim.value.style.opacity = String(progress)
}

function measure() {
  desktop = window.matchMedia('(min-width: 54rem)').matches
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  extent = desktop || reduced ? 100 : sheet.value.offsetHeight + 24
}


async function show() {
  restoreFocus = document.activeElement
  closing = false
  mounted.value = true
  await nextTick()
  if (!sheet.value) return
  measure()
  lock(true)
  spring.set(extent)
  spring.retarget(0, { velocity: 0, damping: 1, response: reduced ? 0.2 : 0.4 })
  sheet.value.focus({ preventScroll: true })
}

function hide(velocity = 0) {
  closing = true
  spring.retarget(extent, { velocity, damping: 1, response: reduced ? 0.15 : 0.32 })
}

function finish() {
  if (!mounted.value) return
  mounted.value = false
  closing = false
  lock(false)
  emit('closed')
  restoreFocus?.focus?.({ preventScroll: true })
  restoreFocus = null
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      if (mounted.value) {
        // Rouverte pendant sa fermeture : elle repart d'où elle est.
        closing = false
        spring.retarget(0, { damping: 1, response: 0.4 })
      } else {
        show()
      }
    } else if (mounted.value) {
      hide(releaseSpeed)
      releaseSpeed = undefined
    }
  },
  { immediate: true },
)

function requestClose() {
  emit('update:open', false)
}

function onKey(e) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    requestClose()
  }
}

function onDown(e) {
  if (desktop || reduced || drag) return
  if (e.target.closest('button, input, select, textarea, a')) return
  measure()
  drag = { id: e.pointerId, startY: e.clientY, startOffset: spring.value, history: [{ t: e.timeStamp, y: e.clientY }] }
  spring.stop()
  e.currentTarget.setPointerCapture(e.pointerId)
}

function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return
  const raw = drag.startOffset + (e.clientY - drag.startY)
  // Vers le haut, la feuille résiste au lieu de s'arrêter net.
  spring.set(raw >= 0 ? raw : -rubberband(-raw, extent, 0.3))
  drag.history.push({ t: e.timeStamp, y: e.clientY })
  if (drag.history.length > 12) drag.history.shift()
}

function onUp(e) {
  if (!drag || e.pointerId !== drag.id) return
  const velocity = releaseVelocity(drag.history)
  drag = null
  // On décide d'après l'endroit où le geste finirait, pas d'après l'endroit où le doigt se lève.
  const landing = spring.value + project(velocity)
  if (landing > extent * 0.5 && velocity >= 0) {
    releaseSpeed = velocity
    closing = true
    spring.retarget(extent, { velocity, damping: 1, response: 0.32 })
    requestClose()
  } else {
    // Un geste lancé a de l'élan : le retour a droit à un léger rebond. Un simple relâchement, non.
    const thrown = Math.abs(velocity) > 300
    spring.retarget(0, { velocity, damping: thrown ? 0.8 : 1, response: thrown ? 0.3 : 0.35 })
  }
}

onBeforeUnmount(() => {
  spring.stop()
  if (mounted.value) lock(false)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="mounted" class="sheet-layer" @keydown="onKey">
      <div ref="scrim" class="sheet-scrim" @click="requestClose" />
      <div ref="sheet" class="sheet" role="dialog" aria-modal="true" :aria-label="label" tabindex="-1">
        <div
          class="sheet-head"
          @pointerdown="onDown"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointercancel="onUp"
        >
          <div class="sheet-grabber" />
          <div class="sheet-bar">
            <div class="sheet-bar-left"><slot name="left" /></div>
            <div class="sheet-title">{{ label }}</div>
            <div class="sheet-bar-right"><slot name="right" /></div>
          </div>
        </div>
        <div class="sheet-body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
.sheet-layer {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet-scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  opacity: 0;
}

.sheet {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 40rem;
  max-height: calc(100dvh - var(--safe-t) - 1.25rem);
  background: var(--elev);
  border-radius: 1.125rem 1.125rem 0 0;
  box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.14);
  outline: 0;
  will-change: transform;
}

/* Prolonge la feuille sous l'écran quand on la tire vers le haut. */
.sheet::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  height: 16rem;
  background: var(--elev);
}

.sheet-head {
  flex: none;
  touch-action: none;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}

.sheet-grabber {
  width: 2.25rem;
  height: 0.3125rem;
  margin: 0.375rem auto 0;
  border-radius: 0.1875rem;
  background: var(--label3);
}

.sheet-bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  min-height: 3rem;
  padding: 0 0.5rem;
}

.sheet-bar-right {
  justify-self: end;
}

.sheet-title {
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.sheet-body {
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 0.5rem 1rem calc(1.5rem + var(--safe-b));
}

@media (min-width: 54rem) {
  .sheet-layer {
    align-items: center;
  }

  .sheet {
    max-width: 30rem;
    max-height: min(46rem, 88vh);
    border-radius: 1rem;
    box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.6), inset 0 0 0 0.5px rgba(255, 255, 255, 0.12);
  }

  .sheet::after,
  .sheet-grabber {
    display: none;
  }

  .sheet-head {
    cursor: default;
    padding-top: 0.375rem;
  }
}
</style>
