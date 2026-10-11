<script setup>
// Mini-courbe sans axes pour un widget : elle donne l'allure, les chiffres sont écrits à côté.
import { computed, useId } from 'vue'

const props = defineProps({
  values: { type: Array, required: true },
  target: { type: Number, default: null },
})

const uid = useId()
const W = 200
const H = 64
const PAD = 5

const range = computed(() => {
  const all = props.target != null ? [...props.values, props.target] : props.values
  const lo = Math.min(0, ...all)
  const hi = Math.max(...all, lo + 1)
  return { lo, hi }
})

const px = (i) => (props.values.length < 2 ? W / 2 : (i * W) / (props.values.length - 1))
const py = (v) => PAD + (H - 2 * PAD) * (1 - (v - range.value.lo) / (range.value.hi - range.value.lo))

const line = computed(() => props.values.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' '))
const area = computed(() => (props.values.length > 1 ? `${line.value} L${W} ${H} L0 ${H} Z` : ''))
const endTop = computed(() => `${(py(props.values[props.values.length - 1] ?? 0) / H) * 100}%`)
</script>

<template>
  <span class="spark" aria-hidden="true">
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none">
      <defs>
        <linearGradient :id="uid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="currentColor" stop-opacity="0.32" />
          <stop offset="1" stop-color="currentColor" stop-opacity="0" />
        </linearGradient>
      </defs>
      <line v-if="target != null" class="spark-target" x1="0" :x2="W" :y1="py(target)" :y2="py(target)" />
      <path v-if="area" class="spark-area" :d="area" :fill="`url(#${uid})`" />
      <path class="spark-line" :d="line" pathLength="1" />
    </svg>
    <i class="spark-end" :style="{ top: endTop }" />
  </span>
</template>

<style>
.spark {
  position: relative;
  display: block;
  height: 4rem;
  color: var(--tint);
}

.spark svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.spark-line {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  stroke-dasharray: 1;
  animation: spark-draw 1100ms var(--spring) 260ms both;
}

.spark-area {
  animation: spark-fade 700ms ease-out 620ms both;
}

.spark-target {
  stroke: var(--label3);
  stroke-width: 1;
  stroke-dasharray: 2 4;
  vector-effect: non-scaling-stroke;
}

.spark-end {
  position: absolute;
  right: -0.25rem;
  width: 0.5rem;
  height: 0.5rem;
  margin-top: -0.25rem;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 2px var(--elev);
  animation: spark-pop 520ms var(--spring-bounce) 1050ms both;
}

@keyframes spark-draw {
  from {
    stroke-dashoffset: 1;
  }
}

@keyframes spark-fade {
  from {
    opacity: 0;
  }
}

@keyframes spark-pop {
  from {
    transform: scale(0);
  }
}
</style>
