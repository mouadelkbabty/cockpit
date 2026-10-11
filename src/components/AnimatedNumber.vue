<script setup>
// Nombre qui rejoint sa nouvelle valeur avec un ressort, au lieu de sauter.
// On peut le relancer en plein mouvement : il repart de la valeur affichée.
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { createSpring } from '../lib/motion.js'

const props = defineProps({
  value: { type: Number, default: 0 },
  format: { type: Function, default: (v) => String(v) },
  // Valeur de départ à l'apparition ; sans elle, le nombre s'affiche directement.
  from: { type: Number, default: null },
})

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const start = props.from != null && !reduced ? props.from : props.value
const shown = ref(start)
const spring = createSpring({ value: start, precision: 0.2, onUpdate: (v) => (shown.value = v) })

onMounted(() => {
  if (start !== props.value) spring.retarget(props.value, { damping: 1, response: 0.7 })
})

watch(
  () => props.value,
  (v) => {
    if (reduced) spring.set(v)
    else spring.retarget(v, { damping: 1, response: 0.55 })
  },
)

onBeforeUnmount(() => spring.stop())

// En mouvement on affiche des entiers ; à l'arrivée, la valeur exacte.
const text = computed(() => props.format(Math.abs(shown.value - props.value) < 0.5 ? props.value : Math.round(shown.value)))
</script>

<template>
  <span class="num">{{ text }}</span>
</template>
