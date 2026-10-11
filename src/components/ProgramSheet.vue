<script setup>
// Éditeur du programme : une séance = un nom et une liste d'exercices, un par ligne.
import { reactive, watch, computed } from 'vue'
import BottomSheet from './BottomSheet.vue'
import { newId } from '../store/index.js'
import { WEEKDAYS, parseExercises, formatExercises, PPL_TEMPLATE } from '../lib/sport.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  program: { type: Object, default: null },
})
const emit = defineEmits(['update:open', 'save'])

const local = reactive({ days: [], week: [] })

function load(program) {
  local.days = (program?.days || []).map((d) => ({ id: d.id, name: d.name, text: formatExercises(d.exercises) }))
  local.week = WEEKDAYS.map((_, i) => program?.week?.[i] || '')
}

watch(
  () => props.open,
  (open) => {
    if (open) load(props.program)
  },
  { immediate: true },
)

const named = computed(() => local.days.filter((d) => d.name.trim()))

function addDay() {
  local.days.push({ id: newId(), name: '', text: '' })
}

function removeDay(day) {
  local.days = local.days.filter((d) => d !== day)
  local.week = local.week.map((id) => (id === day.id ? '' : id))
}

function rows(text) {
  return Math.max(3, text.split('\n').length)
}

function submit() {
  const days = named.value.map((d) => ({ id: d.id, name: d.name.trim(), exercises: parseExercises(d.text) }))
  const ids = new Set(days.map((d) => d.id))
  emit('save', { days, week: local.week.map((id) => (ids.has(id) ? id : null)) })
  emit('update:open', false)
}
</script>

<template>
  <BottomSheet :open="open" label="Programme" @update:open="emit('update:open', $event)">
    <template #left>
      <button class="btn-plain" type="button" @click="emit('update:open', false)">Annuler</button>
    </template>
    <template #right>
      <button class="btn-plain strong" type="button" @click="submit">Enregistrer</button>
    </template>

    <div v-if="!local.days.length" class="form-group">
      <button class="row link-row" type="button" @click="load(PPL_TEMPLATE)">Partir du modèle Push, Pull, Legs</button>
    </div>

    <div v-for="(d, i) in local.days" :key="d.id" class="form-group">
      <div class="field">
        <label :for="`day-${d.id}`">Séance {{ i + 1 }}</label>
        <input :id="`day-${d.id}`" v-model="d.name" type="text" placeholder="Push A" autocomplete="off" />
      </div>
      <div class="field stack">
        <label :for="`ex-${d.id}`">Exercices, un par ligne</label>
        <textarea :id="`ex-${d.id}`" v-model="d.text" :rows="rows(d.text)" placeholder="Développé couché 4x6-8" />
      </div>
      <div class="field">
        <button class="btn-plain btn-danger day-remove" type="button" @click="removeDay(d)">Supprimer cette séance</button>
      </div>
    </div>

    <div class="form-group">
      <button class="row link-row" type="button" @click="addDay">Ajouter une séance</button>
    </div>
    <p class="form-note footnote">
      Écris le nombre de séries puis les répétitions, par exemple « Squat 4x6-8 ». Garde le même nom d'un exercice pour
      conserver son historique.
    </p>

    <div v-if="named.length" class="form-group">
      <div v-for="(name, i) in WEEKDAYS" :key="name" class="field">
        <label :for="`wd-${i}`">{{ name }}</label>
        <select :id="`wd-${i}`" v-model="local.week[i]">
          <option value="">Repos</option>
          <option v-for="d in named" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>
      </div>
    </div>
  </BottomSheet>
</template>

<style>
.day-remove {
  padding: 0;
  margin: 0 auto;
}
</style>
