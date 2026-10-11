<script setup>
// Courbe à une seule série : pas de légende (le titre la nomme), repères discrets,
// lecture au survol ou au doigt, et le même contenu en tableau.
import { ref, computed, onMounted, onBeforeUnmount, useId } from 'vue'

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

const gradient = useId()
const box = ref(null)
const width = ref(320)
const active = ref(null)
const asTable = ref(false)
let observer = null

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    width.value = Math.max(200, Math.round(entry.contentRect.width))
  })
  if (box.value) observer.observe(box.value)
})
onBeforeUnmount(() => observer?.disconnect())

const M = { top: 26, right: 52, bottom: 24, left: 6 }

function niceStep(span, count) {
  const raw = span / count
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const unit = raw / pow
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * pow
}

const scale = computed(() => {
  const values = props.points.map((p) => p.value)
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

const line = computed(() => props.points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' '))

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
const shown = computed(() => (active.value == null ? null : props.points[active.value]))

const tipLeft = computed(() => {
  if (active.value == null) return 0
  return Math.max(52, Math.min(width.value - 52, x(active.value)))
})

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
          <linearGradient :id="gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="currentColor" stop-opacity="0.3" />
            <stop offset="1" stop-color="currentColor" stop-opacity="0" />
          </linearGradient>
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

        <g v-if="markIndex != null && markIndex >= 0 && markIndex <= last" class="chart-mark">
          <line :x1="x(markIndex)" :x2="x(markIndex)" :y1="M.top - 4" :y2="M.top + plot.h" />
          <text v-if="markLabel && active == null" :x="x(markIndex)" :y="M.top - 10" text-anchor="middle">{{ markLabel }}</text>
        </g>

        <g v-if="target != null" class="chart-target">
          <line :x1="M.left" :x2="M.left + plot.w" :y1="y(target)" :y2="y(target)" />
          <text :x="M.left + 2" :y="y(target) - 6">{{ targetLabel }}</text>
        </g>

        <path v-if="area" :d="area" :fill="`url(#${gradient})`" />
        <path :d="line" class="chart-line" />

        <circle
          v-if="markIndex != null && markIndex >= 0 && markIndex < last && active == null"
          class="chart-dot"
          :cx="x(markIndex)"
          :cy="y(points[markIndex].value)"
          r="4.5"
        />
        <circle v-if="active == null" class="chart-dot" :cx="x(last)" :cy="y(points[last].value)" r="4.5" />

        <g v-if="active != null">
          <line class="chart-cross" :x1="x(active)" :x2="x(active)" :y1="M.top - 6" :y2="M.top + plot.h" />
          <circle class="chart-dot" :cx="x(active)" :cy="y(points[active].value)" r="5.5" />
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
}

.chart-cross {
  stroke: var(--label2);
  stroke-width: 1;
}

.chart-tip {
  position: absolute;
  top: -0.5rem;
  transform: translateX(-50%);
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
</style>
