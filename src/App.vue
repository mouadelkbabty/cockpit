<script setup>
import { ref, computed, watch, provide, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { state, signIn } from './store/index.js'
import { createSpring, project, rubberband, releaseVelocity, nearestIndex } from './lib/motion.js'
import Icon from './components/Icon.vue'
import TodayView from './views/TodayView.vue'
import MoneyView from './views/MoneyView.vue'
import JobsView from './views/JobsView.vue'
import SportView from './views/SportView.vue'
import SettingsView from './views/SettingsView.vue'

const TABS = [
  { id: 'today', hash: '', label: "Aujourd'hui", icon: 'today', color: 'var(--label)', view: TodayView },
  { id: 'money', hash: 'argent', label: 'Argent', icon: 'money', color: 'var(--money)', view: MoneyView },
  { id: 'jobs', hash: 'emploi', label: 'Emploi', icon: 'jobs', color: 'var(--jobs)', view: JobsView },
  { id: 'sport', hash: 'sport', label: 'Sport', icon: 'sport', color: 'var(--sport)', view: SportView },
  { id: 'settings', hash: 'reglages', label: 'Réglages', icon: 'settings', color: 'var(--label)', view: SettingsView },
]

function tabFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, '')
  return (TABS.find((t) => t.hash === hash) || TABS[0]).id
}

const icon = `${import.meta.env.BASE_URL}icon.svg`
const current = ref(tabFromHash())
const tab = computed(() => TABS.find((t) => t.id === current.value))
const view = ref(null)
const shell = ref(null)

function go(id) {
  const target = TABS.find((t) => t.id === id)
  if (!target) return
  if (id === current.value) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  window.location.hash = target.hash ? `#/${target.hash}` : '#/'
}
provide('go', go)

function onHash() {
  current.value = tabFromHash()
}

// ---------- En-tête lié au défilement ----------
// Le matériau de la barre et le petit titre suivent la position de la page, point par point,
// au lieu de basculer d'un coup. Tirer la page vers le bas fait grossir le grand titre.

let scrollFrame = 0
const clamp01 = (v) => Math.max(0, Math.min(1, v))

function applyScroll() {
  scrollFrame = 0
  const el = shell.value
  if (!el) return
  const y = window.scrollY
  el.style.setProperty('--bar', clamp01((y - 6) / 34).toFixed(3))
  el.style.setProperty('--ttl', clamp01((y - 30) / 24).toFixed(3))
  el.style.setProperty('--pull', y < 0 ? Math.min(-y / 560, 0.14).toFixed(3) : '0')
}

function onScroll() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(applyScroll)
}

// ---------- Lentille de la barre d'onglets ----------
// Une seule pastille qui glisse d'un onglet à l'autre avec un ressort. Sur téléphone on peut la saisir
// et la promener : elle suit le doigt, puis s'aimante à l'onglet vers lequel le geste allait.

const nav = ref(null)
const lens = ref(null)
const tabEls = ref([])
const hover = ref(null)
const grabbed = ref(false)
const box = { x: 0, y: 0, w: 0, h: 0 }
let lensVisible = false
let drag = null
let swallowClick = false

function paint() {
  const el = lens.value
  if (!el) return
  el.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`
  el.style.width = `${Math.max(0, box.w)}px`
  el.style.height = `${Math.max(0, box.h)}px`
}

const springs = Object.fromEntries(
  ['x', 'y', 'w', 'h'].map((key) => [
    key,
    createSpring({
      value: 0,
      onUpdate(v) {
        box[key] = v
        paint()
      },
    }),
  ]),
)

const isDesktop = () => window.matchMedia('(min-width: 54rem)').matches
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function rectOf(id) {
  const el = tabEls.value[TABS.findIndex((t) => t.id === id)]
  if (!el || !el.offsetWidth) return null
  return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }
}

function place(animated, options = {}) {
  const rect = rectOf(current.value)
  if (!lens.value) return
  lens.value.style.opacity = rect ? '1' : '0'
  if (!rect) {
    lensVisible = false
    return
  }
  const jump = !animated || !lensVisible || reducedMotion()
  lensVisible = true
  for (const key of ['x', 'y', 'w', 'h']) {
    if (jump) springs[key].set(rect[key])
    else springs[key].retarget(rect[key], { damping: options.damping ?? 1, response: 0.36, velocity: key === 'x' ? options.velocity : undefined })
  }
}

function centers() {
  return TABS.map((t) => rectOf(t.id)).map((r) => (r ? r.x + r.w / 2 : null))
}

function onNavDown(e) {
  if (isDesktop() || reducedMotion() || !lensVisible || e.button > 0) return
  const rect = nav.value.getBoundingClientRect()
  const local = e.clientX - rect.left
  const inside = local >= box.x && local <= box.x + box.w
  drag = {
    id: e.pointerId,
    startX: e.clientX,
    left: rect.left,
    width: rect.width,
    // Saisie sur la lentille : on garde l'écart entre le doigt et son centre. Ailleurs : elle vient sous le doigt.
    offset: inside ? local - (box.x + box.w / 2) : 0,
    attached: inside,
    moved: false,
    history: [{ t: e.timeStamp, y: e.clientX }],
  }
}

function onNavMove(e) {
  if (!drag || e.pointerId !== drag.id) return
  drag.history.push({ t: e.timeStamp, y: e.clientX })
  if (drag.history.length > 12) drag.history.shift()
  if (!drag.moved) {
    // Un petit seuil distingue le glissement du simple appui.
    if (Math.abs(e.clientX - drag.startX) < 8) return
    drag.moved = true
    grabbed.value = true
    nav.value.setPointerCapture(e.pointerId)
  }
  const max = drag.width - box.w
  let x = e.clientX - drag.left - drag.offset - box.w / 2
  // Aux extrémités, la lentille résiste au lieu de buter.
  if (x < 0) x = -rubberband(-x, drag.width, 0.25)
  else if (x > max) x = max + rubberband(x - max, drag.width, 0.25)
  if (drag.attached) {
    springs.x.set(x)
  } else {
    springs.x.retarget(x, { damping: 1, response: 0.14 })
    if (Math.abs(box.x - x) < 3) drag.attached = true
  }
  const index = nearestIndex(centers().map((c) => (c == null ? Infinity : c)), box.x + box.w / 2)
  hover.value = index >= 0 ? TABS[index].id : null
}

function onNavUp(e) {
  if (!drag || e.pointerId !== drag.id) return
  const wasDrag = drag.moved
  const velocity = releaseVelocity(drag.history)
  drag = null
  grabbed.value = false
  hover.value = null
  if (!wasDrag) return
  swallowClick = true
  window.setTimeout(() => (swallowClick = false), 0)
  // On vise l'onglet où le geste allait s'arrêter, pas celui sous le doigt au moment du relâchement.
  const landing = box.x + box.w / 2 + project(velocity, 0.99)
  const index = nearestIndex(centers().map((c) => (c == null ? Infinity : c)), landing)
  const target = TABS[index] || tab.value
  if (target.id === current.value) place(true, { velocity, damping: 0.8 })
  else {
    pendingThrow = { velocity, damping: 0.8 }
    go(target.id)
  }
}

let pendingThrow = null

function onTabClick(id) {
  if (swallowClick) return
  go(id)
}

watch(current, () => {
  const throwOptions = pendingThrow || {}
  pendingThrow = null
  nextTick(() => place(true, throwOptions))
})

watch(
  tab,
  (t) => {
    document.documentElement.style.setProperty('--tint', t.color)
    document.title = t.id === 'today' ? 'Cockpit' : `${t.label} · Cockpit`
    nextTick(() => {
      window.scrollTo(0, 0)
      applyScroll()
    })
  },
  { immediate: true },
)

let resizer = null

onMounted(() => {
  window.addEventListener('hashchange', onHash)
  window.addEventListener('scroll', onScroll, { passive: true })
  applyScroll()
  if (nav.value) {
    place(false)
    resizer = new ResizeObserver(() => place(false))
    resizer.observe(nav.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', onHash)
  window.removeEventListener('scroll', onScroll)
  resizer?.disconnect()
  for (const s of Object.values(springs)) s.stop()
})

const needsSignIn = computed(() => state.mode === 'cloud' && state.authReady && !state.user)
const loading = computed(() => state.mode === 'cloud' && (!state.authReady || (state.user && !state.ready)))

// L'écran de connexion remplace toute l'interface : la lentille est replacée quand la barre revient.
watch(needsSignIn, (gate) => {
  if (gate) return
  nextTick(() => {
    if (!nav.value) return
    place(false)
    resizer?.disconnect()
    resizer = new ResizeObserver(() => place(false))
    resizer.observe(nav.value)
    applyScroll()
  })
})
</script>

<template>
  <div v-if="needsSignIn" class="gate">
    <div class="gate-inner">
      <img :src="icon" width="72" height="72" alt="" />
      <h1 class="large-title">Cockpit</h1>
      <p class="secondary">Connecte-toi pour retrouver tes données sur tous tes appareils.</p>
      <button class="btn btn-filled btn-block" type="button" @click="signIn">Se connecter avec Google</button>
      <p v-if="state.error" class="banner footnote" role="alert">{{ state.error }}</p>
    </div>
  </div>

  <div v-else ref="shell" class="shell">
    <header class="topbar">
      <span />
      <span class="topbar-title" aria-hidden="true">{{ tab.label }}</span>
      <div class="topbar-actions">
        <button v-if="view?.add" class="icon-btn" type="button" :aria-label="view.addLabel || 'Ajouter'" @click="view.add()">
          <Icon name="plus" />
        </button>
        <button
          v-if="current !== 'settings'"
          class="icon-btn settings-btn"
          type="button"
          aria-label="Réglages"
          @click="go('settings')"
        >
          <Icon name="settings" />
        </button>
      </div>
    </header>

    <nav
      ref="nav"
      class="tabbar"
      :class="{ grabbed }"
      aria-label="Sections"
      @pointerdown="onNavDown"
      @pointermove="onNavMove"
      @pointerup="onNavUp"
      @pointercancel="onNavUp"
    >
      <div class="tabbar-brand">Cockpit</div>
      <span ref="lens" class="tab-lens" aria-hidden="true" />
      <button
        v-for="(t, i) in TABS"
        :key="t.id"
        :ref="(el) => (tabEls[i] = el)"
        class="tab"
        :class="{ 'tab-settings': t.id === 'settings', 'is-hover': hover === t.id, 'is-dim': hover && hover !== t.id }"
        type="button"
        :style="{ '--tab-color': t.color }"
        :aria-current="current === t.id ? 'page' : undefined"
        @click="onTabClick(t.id)"
      >
        <Icon :name="t.icon" />
        <span>{{ t.label }}</span>
      </button>
    </nav>

    <main class="main">
      <p v-if="state.error" class="banner footnote" role="alert">
        {{ state.error }}
        <button class="btn-plain footnote" type="button" @click="state.error = null">Masquer</button>
      </p>
      <p v-if="loading" class="secondary loading">Chargement de tes données</p>
      <component :is="tab.view" v-else ref="view" />
    </main>
  </div>
</template>

<style>
/* ---------- Structure ---------- */

.shell {
  min-height: 100dvh;
}

.main {
  padding: calc(var(--top-h) + var(--safe-t)) var(--pad) calc(var(--bar-h) + max(0.75rem, var(--safe-b)) + 2.5rem);
  max-width: 46rem;
  margin: 0 auto;
}

/* Une feuille ouverte repousse le contenu vers l'arrière ; --sheet suit la feuille, doigt compris. */
html.sheet-open .main {
  transform: scale(calc(1 - 0.05 * var(--sheet, 0)));
  transform-origin: 50% var(--sheet-origin, 50%);
}

/* ---------- Barre du haut ---------- */

.topbar {
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 20;
  height: calc(var(--top-h) + var(--safe-t));
  padding: var(--safe-t) 0.5rem 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
}

/* Bord de défilement : le matériau n'apparaît qu'à mesure que du contenu passe dessous. */
.topbar::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: var(--material);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.1);
  opacity: var(--bar, 0);
}

.topbar-title {
  font-weight: 600;
  opacity: var(--ttl, 0);
  transform: translateY(calc((1 - var(--ttl, 0)) * 0.4rem));
}

.topbar-actions {
  justify-self: end;
  display: flex;
  gap: 0.25rem;
}

.icon-btn {
  width: 2.75rem;
  height: 2.75rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--tint);
  transition: transform 480ms var(--spring-bounce), background 200ms ease-out, color 300ms ease;
}

.icon-btn:active {
  transform: scale(0.88);
  background: var(--fill);
  transition: transform 90ms ease-out, background 90ms ease-out;
}

/* ---------- Barre d'onglets : une capsule de verre qui flotte au-dessus du contenu ---------- */

.tabbar {
  position: fixed;
  z-index: 20;
  left: 0;
  right: 0;
  bottom: max(0.75rem, var(--safe-b));
  width: min(calc(100% - 2rem), 25rem);
  height: var(--bar-h);
  margin: 0 auto;
  padding: 0.3125rem;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  border-radius: 2rem;
  background: rgba(40, 40, 44, 0.72);
  -webkit-backdrop-filter: blur(28px) saturate(190%);
  backdrop-filter: blur(28px) saturate(190%);
  /* Le filet clair du haut est la lumière qui accroche le bord du matériau. */
  box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.24), inset 0 0 0 0.5px rgba(255, 255, 255, 0.08), 0 0.75rem 2.5rem rgba(0, 0, 0, 0.55);
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}

/* Le contenu s'efface en arrivant sous la capsule, sans trait de séparation. */
.shell::after {
  content: '';
  position: fixed;
  inset: auto 0 0 0;
  z-index: 15;
  height: calc(var(--bar-h) + max(0.75rem, var(--safe-b)) + 2rem);
  background: linear-gradient(to top, #000 38%, rgba(0, 0, 0, 0.7) 68%, rgba(0, 0, 0, 0));
  pointer-events: none;
}

.tab-lens {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 1.6875rem;
  background: rgba(255, 255, 255, 0.13);
  box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.26), inset 0 0 0 0.5px rgba(255, 255, 255, 0.06);
  pointer-events: none;
  will-change: transform;
  transition: background 200ms ease, box-shadow 200ms ease, opacity 200ms ease;
}

/* Saisie, la lentille s'éclaircit : on voit qu'on la tient. */
.tabbar.grabbed .tab-lens {
  background: rgba(255, 255, 255, 0.22);
  box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.4), 0 0.25rem 1rem rgba(0, 0, 0, 0.35);
}

.tab {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 0.125rem;
  border-radius: 1.6875rem;
  /* Sur un matériau translucide, un gris plat se perd : le texte est plus clair et un peu plus gras. */
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.012em;
  transition: color 220ms ease, transform 480ms var(--spring-bounce);
}

.tab:active {
  transform: scale(0.92);
  transition: color 220ms ease, transform 90ms ease-out;
}

.tabbar.grabbed .tab:active {
  transform: none;
}

.tab[aria-current='page'],
.tab.is-hover {
  color: var(--tab-color, var(--label));
}

.tab.is-dim[aria-current='page'] {
  color: rgba(255, 255, 255, 0.62);
}

/* L'icône de l'onglet choisi rebondit une fois. */
.tab[aria-current='page'] svg {
  animation: tab-pop 620ms var(--spring-bounce);
}

@keyframes tab-pop {
  from {
    transform: scale(0.78);
  }
}

.tab-settings {
  display: none;
}

.tabbar-brand {
  display: none;
}

/* ---------- Ordinateur : colonne latérale ---------- */

@media (min-width: 54rem) {
  .tabbar {
    inset: 0 auto 0 0;
    width: var(--side-w);
    height: auto;
    margin: 0;
    padding: 1.25rem 0.75rem;
    grid-auto-flow: row;
    grid-auto-columns: auto;
    grid-auto-rows: max-content;
    align-content: start;
    gap: 0.125rem;
    border-radius: 0;
    /* Matériau plus lourd : une région de structure, pas un contrôle. */
    background: #0e0e10;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    box-shadow: inset -0.5px 0 0 var(--sep);
    touch-action: auto;
  }

  .shell::after {
    display: none;
  }

  .tabbar-brand {
    display: block;
    padding: 0.25rem 0.75rem 1rem;
    font-size: 1.375rem;
    font-weight: 700;
    letter-spacing: -0.012em;
  }

  .tab-lens {
    border-radius: 0.625rem;
    background: var(--fill);
    box-shadow: none;
  }

  .tab {
    grid-auto-flow: column;
    justify-content: start;
    justify-items: start;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.625rem;
    font-size: 1rem;
    font-weight: 400;
    letter-spacing: 0;
    color: var(--label2);
  }

  .tab:active {
    transform: scale(0.98);
  }

  .tab[aria-current='page'] {
    color: var(--label);
  }

  .tab[aria-current='page'] svg {
    color: var(--tab-color, var(--label));
  }

  .tab-settings {
    display: grid;
  }

  .topbar {
    left: var(--side-w);
  }

  .topbar .settings-btn {
    display: none;
  }

  .main {
    margin-left: var(--side-w);
    max-width: none;
    padding-left: 2rem;
    padding-right: 2rem;
    padding-bottom: 3rem;
  }

  .main > * {
    max-width: 44rem;
    margin-left: auto;
    margin-right: auto;
  }
}

/* ---------- Écran de connexion et états ---------- */

.gate {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 2rem 1.5rem;
}

.gate-inner {
  width: 100%;
  max-width: 22rem;
  display: grid;
  gap: 0.75rem;
  justify-items: start;
}

.gate-inner img {
  border-radius: 1rem;
  margin-bottom: 0.5rem;
}

.gate-inner .btn {
  margin-top: 0.75rem;
}

.loading {
  margin-top: 4rem;
  text-align: center;
}

.banner .btn-plain {
  min-height: 0;
  padding: 0;
  margin-left: 0.5rem;
  text-decoration: underline;
  color: inherit;
}

/* ---------- Préférences d'accessibilité ---------- */

@media (prefers-reduced-transparency: reduce) {
  .topbar::before,
  .tabbar {
    background: #1c1c1e;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

@media (prefers-contrast: more) {
  .topbar::before,
  .tabbar {
    background: #000;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    box-shadow: inset 0 0 0 1px var(--sep);
  }
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .topbar::before,
  .tabbar {
    background: #1c1c1e;
  }
}

@media (prefers-reduced-motion: reduce) {
  html.sheet-open .main {
    transform: none;
  }
}
</style>
