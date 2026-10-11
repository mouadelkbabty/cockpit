<script setup>
// Courbe à une seule série : pas de légende (le titre la nomme), repères discrets,
// lecture au survol ou au doigt, et le même contenu en tableau.
// Elle se dessine à l'apparition, puis se transforme quand les données changent : jamais de saut.
import { ref, computed, watch, onMounted, onBeforeUnmount, useId } from 'vue'
import { createSpring, blend, resample } from '../lib/motion.js'

const props = defineProps({
  // [{ label: texte court de l'axe, title: texte complet, value }]
  points: { type: Array, required: true },
  format: { type: Function, default: (v) => String(v) },
  target: { type: Number, default: null },
  targetLabel: { type: String, default: '' },
  markIndex: { type: Number, default: null },
  markLabel: { type: String, default: '' },
  zero: { type: Boolean, default: false },
  height: { type: Number, default: 208 },
  summary: { type: String, default: '' },
  columns: { type: Array, default: () => ['Date', 'Valeur'] },
})

const uid = useId()
const box = ref(null)
const width = ref(320)
const active = ref(null)
const asTable = ref(false)
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const M = { top: 26, right: 52, bottom: 24, left: 6 }

// ---------- Valeurs affichées : elles rejoignent les vraies valeurs avec un ressort ----------

const targetValues = computed(() => props.points.map((p) => p.value))
const display = ref([...targetValues.value])
let morphFrom = display.value
const morph = createSpring({
  value: 1,
  precision: 0.001,
  onUpdate(t) {
    display.value = blend(morphFrom, targetValues.value, t)
  },
})

watch(targetValues, (next, prev) => {
  if (next.length === prev.length && next.every((v, i) => v === prev[i])) return
  if (reduced) {
    display.value = [...next]
    return
  }
  // On repart de ce qui est à l'écran, même si une transformation était déjà en cours.
  morphFrom = resample(display.value, next.length)
  morph.set(0)
  morph.retarget(1, { damping: 1, response: 0.6 })
})

// ---------- Tracé à l'apparition ----------

const draw = ref(reduced ? 1 : 0)
const drawing = createSpring({ value: draw.value, precision: 0.001, onUpdate: (v) => (draw.value = v) })
let sizeObserver = null
let viewObserver = null

onMounted(() => {
  sizeObserver = new ResizeObserver(([entry]) => {
    if (entry.contentRect.width > 0) width.value = Math.max(200, Math.round(entry.contentRect.width))
  })
  if (!box.value) return
  sizeObserver.observe(box.value)
  if (reduced || !('IntersectionObserver' in window)) {
    draw.value = 1
    return
  }
  viewObserver = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return
      viewObserver.disconnect()
      drawing.retarget(1, { damping: 1, response: 0.85 })
    },
    { threshold: 0.35 },
  )
  viewObserver.observe(box.value)
})

onBeforeUnmount(() => {
  sizeObserver?.disconnect()
  viewObserver?.disconnect()
  morph.stop()
  drawing.stop()
  glide.stop()
})

// ---------- Échelles ----------

function niceStep(span, count) {
  const raw = span / count
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const unit = raw / pow
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * pow
}

const scale = computed(() => {
  // L'échelle couvre aussi les valeurs en cours de transformation : la courbe ne sort jamais du cadre.
  const values = [...targetValues.value, ...display.value]
  if (props.target != null) values.push(props.target)
  let min = props.zero ? 0 : Math.min(...values)
  let max = Math.max(...values)
  if (max === min) {
    max += 1
    min -= props.zero ? 0 : 1
  }
  const step = niceStep(max - min, 3)
  const lo = props.zero ? 0 : Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks = []
  for (let t = lo; t <= hi + step / 1000; t += step) ticks.push(Math.round(t * 1000) / 1000)
  return { lo, hi, ticks }
})

const plot = computed(() => ({
  w: width.value - M.left - M.right,
  h: props.height - M.top - M.bottom,
}))

function x(i) {
  const n = props.points.length
  return M.left + (n <= 1 ? plot.value.w / 2 : (i * plot.value.w) / (n - 1))
}

function y(v) {
  const { lo, hi } = scale.value
  return M.top + plot.value.h * (1 - (v - lo) / (hi - lo))
}

const shownValue = (i) => display.value[i] ?? targetValues.value[i] ?? 0

// Valeur sur la courbe à une position intermédiaire entre deux points.
function valueAt(position) {
  const lo = Math.max(0, Math.min(props.points.length - 1, Math.floor(position)))
  const hi = Math.min(props.points.length - 1, lo + 1)
  return shownValue(lo) + (shownValue(hi) - shownValue(lo)) * (position - lo)
}

const line = computed(() => props.points.map((_, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(shownValue(i)).toFixed(1)}`).join(' '))

const area = computed(() => {
  const n = props.points.length
  if (n < 2) return ''
  const base = M.top + plot.value.h
  return `${line.value} L${x(n - 1).toFixed(1)} ${base} L${x(0).toFixed(1)} ${base} Z`
})

// Assez d'étiquettes pour se repérer, jamais assez pour se chevaucher.
const xLabels = computed(() => {
  const n = props.points.length
  const room = Math.max(2, Math.floor(plot.value.w / 52))
  const step = Math.max(1, Math.ceil((n - 1) / (room - 1)))
  const out = []
  for (let i = 0; i < n; i += step) out.push(i)
  return out
})

const last = computed(() => props.points.length - 1)
const hasMark = computed(() => props.markIndex != null && props.markIndex >= 0 && props.markIndex <= last.value)
// Un point n'apparaît qu'une fois le tracé arrivé jusqu'à lui.
const reached = (i) => draw.value >= (last.value > 0 ? i / last.value : 0) - 0.01

// ---------- Lecture : le repère glisse d'un point au suivant ----------

const cursor = ref(0)
const glide = createSpring({ value: 0, precision: 0.01, onUpdate: (v) => (cursor.value = v) })

watch(active, (now, before) => {
  if (now == null) return
  if (before == null || reduced) glide.set(now)
  else glide.retarget(now, { damping: 1, response: 0.16 })
})

const shown = computed(() => (active.value == null ? null : props.points[active.value]))
const tipLeft = computed(() => Math.max(56, Math.min(width.value - 56, x(cursor.value))))

function locate(e) {
  const rect = box.value.getBoundingClientRect()
  const n = props.points.length
  if (n < 2) return 0
  const ratio = (e.clientX - rect.left - M.left) / plot.value.w
  return Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1))))
}

function onMove(e) {
  active.value = locate(e)
}

function onLeave() {
  active.value = null
}

function onKey(e) {
  const n = props.points.length
  if (e.key === 'ArrowRight') active.value = Math.min(n - 1, (active.value ?? -1) + 1)
  else if (e.key === 'ArrowLeft') active.value = Math.max(0, (active.value ?? n) - 1)
  else if (e.key === 'Escape') active.value = null
  else return
  e.preventDefault()
}
</script>

<template>
  <div class="chart">
    <div
      v-show="!asTable"
      ref="box"
      class="chart-plot"
      tabindex="0"
      role="img"
      :aria-label="summary"
      :style="{ height: `${height}px` }"
      @pointermove="onMove"
      @pointerdown="onMove"
      @pointerleave="onLeave"
      @pointercancel="onLeave"
      @blur="onLeave"
      @keydown="onKey"
    >
      <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" aria-hidden="true">
        <defs>
          <linearGradient :id="`${uid}-fill`" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="currentColor" stop-opacity="0.3" />
            <stop offset="1" stop-color="currentColor" stop-opacity="0" />
          </linearGradient>
          <clipPath :id="`${uid}-clip`">
            <rect :x="0" :y="0" :width="M.left + plot.w * draw" :height="height" />
          </clipPath>
        </defs>

        <g class="chart-grid">
          <template v-for="t in scale.ticks" :key="t">
            <line :x1="M.left" :x2="M.left + plot.w" :y1="y(t)" :y2="y(t)" />
            <text :x="M.left + plot.w + 8" :y="y(t) + 4">{{ format(t) }}</text>
          </template>
          <text
            v-for="i in xLabels"
            :key="`x${i}`"
            :x="x(i)"
            :y="height - 6"
            :text-anchor="i === 0 ? 'start' : 'middle'"
          >
            {{ points[i].label }}
          </text>
        </g>

        <g v-if="hasMark" class="chart-mark" :class="{ on: reached(markIndex) }">
          <line :x1="x(markIndex)" :x2="x(markIndex)" :y1="M.top - 4" :y2="M.top + plot.h" />
          <text v-if="markLabel" :x="x(markIndex)" :y="M.top - 10" text-anchor="middle" :class="{ off: active != null }">
            {{ markLabel }}
          </text>
        </g>

        <g v-if="target != null" class="chart-target" :style="{ opacity: Math.min(1, draw * 2.5) }">
          <line :x1="M.left" :x2="M.left + plot.w" :y1="y(target)" :y2="y(target)" />
          <text :x="M.left + 2" :y="y(target) - 6">{{ targetLabel }}</text>
        </g>

        <path v-if="area" :d="area" :fill="`url(#${uid}-fill)`" :clip-path="`url(#${uid}-clip)`" />
        <path
          :d="line"
          class="chart-line"
          pathLength="1"
          stroke-dasharray="1 1"
          :stroke-dashoffset="1 - draw"
          :style="{ opacity: draw > 0.004 ? 1 : 0 }"
        />

        <circle
          v-if="hasMark && markIndex < last"
          class="chart-dot"
          :class="{ on: reached(markIndex) && active == null }"
          :cx="x(markIndex)"
          :cy="y(shownValue(markIndex))"
          r="4.5"
        />
        <circle
          class="chart-dot"
          :class="{ on: draw > 0.985 && active == null }"
          :cx="x(last)"
          :cy="y(shownValue(last))"
          r="4.5"
        />

        <g class="chart-read" :class="{ on: active != null }">
          <line class="chart-cross" :x1="x(cursor)" :x2="x(cursor)" :y1="M.top - 6" :y2="M.top + plot.h" />
          <circle class="chart-dot on" :cx="x(cursor)" :cy="y(valueAt(cursor))" r="5.5" />
        </g>
      </svg>

      <div v-if="shown" class="chart-tip" :style="{ left: `${tipLeft}px` }">
        <span class="caption secondary">{{ shown.title || shown.label }}</span>
        <span class="num">{{ format(shown.value) }}</span>
      </div>
    </div>

    <div v-if="asTable" class="group">
      <table class="plain subhead">
        <thead>
          <tr>
            <th scope="col">{{ columns[0] }}</th>
            <th scope="col">{{ columns[1] }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, i) in points" :key="i">
            <td>{{ p.title || p.label }}</td>
            <td>{{ format(p.value) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <button class="btn-plain footnote chart-switch" type="button" @click="asTable = !asTable">
      {{ asTable ? 'Voir la courbe' : 'Voir en tableau' }}
    </button>
  </div>
</template>

<style>
.chart {
  color: var(--tint);
}

.chart-plot {
  position: relative;
  touch-action: pan-y;
  cursor: crosshair;
  border-radius: 0.5rem;
  -webkit-user-select: none;
  user-select: none;
}

.chart-plot svg {
  display: block;
  overflow: visible;
}

.chart-grid line {
  stroke: var(--sep);
  stroke-width: 0.5;
}

.chart-grid text,
.chart-mark text,
.chart-target text {
  fill: var(--label3);
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
}

.chart-target line {
  stroke: var(--label2);
  stroke-width: 1;
  stroke-dasharray: 2 4;
  stroke-linecap: round;
}

.chart-target text,
.chart-mark text {
  fill: var(--label2);
}

.chart-mark line {
  stroke: var(--label3);
  stroke-width: 0.5;
}

.chart-line {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.chart-dot {
  fill: currentColor;
  stroke: var(--bg);
  stroke-width: 2;
  /* Chaque point se pose avec un petit rebond quand le tracé l'atteint. */
  transform-box: fill-box;
  transform-origin: center;
  transform: scale(0);
  opacity: 0;
  transition: transform 520ms var(--spring-bounce), opacity 160ms ease;
}

.chart-dot.on {
  transform: none;
  opacity: 1;
}

.chart-mark {
  opacity: 0;
  transition: opacity 320ms ease;
}

.chart-mark.on {
  opacity: 1;
}

.chart-mark text {
  transition: opacity 160ms ease;
}

.chart-mark text.off {
  opacity: 0;
}

.chart-read {
  opacity: 0;
  transition: opacity 180ms ease;
}

.chart-read.on {
  opacity: 1;
}

.chart-cross {
  stroke: var(--label2);
  stroke-width: 1;
}

.chart-tip {
  position: absolute;
  top: -0.5rem;
  transform: translateX(-50%);
  animation: tip-in 240ms var(--spring);
  display: grid;
  justify-items: center;
  padding: 0.25rem 0.625rem;
  border-radius: 0.5rem;
  background: var(--elev2);
  color: var(--label);
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
}

.chart-switch {
  display: block;
  min-height: 2.25rem;
  margin: 0.125rem 0 0 auto;
  padding: 0 0.25rem;
  color: var(--label2);
}

@keyframes tip-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(0.25rem) scale(0.94);
  }
}
</style>
