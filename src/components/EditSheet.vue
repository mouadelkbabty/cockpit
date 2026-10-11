<script setup>
// Formulaire générique dans une feuille : « Annuler » à gauche, « Enregistrer » à droite.
import { reactive, ref, watch, computed } from 'vue'
import BottomSheet from './BottomSheet.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  // [{ note?, fields: [{ key, label, type, options?, placeholder?, required?, rows? }] }]
  groups: { type: Array, default: () => [] },
  value: { type: Object, default: () => ({}) },
  canDelete: { type: Boolean, default: false },
  deleteLabel: { type: String, default: 'Supprimer' },
})
const emit = defineEmits(['update:open', 'save', 'delete'])

const draft = reactive({})
const confirming = ref(false)

const fields = computed(() => props.groups.flatMap((g) => g.fields))

watch(
  () => props.open,
  (open) => {
    if (!open) return
    confirming.value = false
    for (const k of Object.keys(draft)) delete draft[k]
    for (const f of fields.value) {
      const v = props.value?.[f.key]
      if (f.type === 'switch') draft[f.key] = v === undefined ? f.default ?? false : Boolean(v)
      else if (f.type === 'number') draft[f.key] = v == null || v === '' ? '' : String(v).replace('.', ',')
      else draft[f.key] = v ?? f.default ?? ''
    }
  },
  { immediate: true },
)

const valid = computed(() => fields.value.every((f) => !f.required || String(draft[f.key] ?? '').trim() !== ''))

function parseNumber(text) {
  const n = Number(String(text).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function submit() {
  if (!valid.value) return
  const out = { ...props.value }
  for (const f of fields.value) {
    const v = draft[f.key]
    if (f.type === 'number') out[f.key] = v === '' ? null : parseNumber(v)
    else if (f.type === 'switch') out[f.key] = v
    else out[f.key] = typeof v === 'string' ? v.trim() : v
  }
  emit('save', out)
  emit('update:open', false)
}

function close() {
  emit('update:open', false)
}

function askDelete() {
  if (!confirming.value) {
    confirming.value = true
    return
  }
  emit('delete')
  emit('update:open', false)
}
</script>

<template>
  <BottomSheet :open="open" :label="title" @update:open="emit('update:open', $event)">
    <template #left>
      <button class="btn-plain" type="button" @click="close">Annuler</button>
    </template>
    <template #right>
      <button class="btn-plain strong" type="button" :disabled="!valid" @click="submit">Enregistrer</button>
    </template>

    <form @submit.prevent="submit">
      <template v-for="(group, gi) in groups" :key="gi">
        <div class="form-group">
          <div v-for="f in group.fields" :key="f.key" class="field" :class="{ stack: f.type === 'textarea' }">
            <label :for="`f-${f.key}`">{{ f.label }}</label>
            <select v-if="f.type === 'select'" :id="`f-${f.key}`" v-model="draft[f.key]">
              <option v-for="o in f.options" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
            <textarea
              v-else-if="f.type === 'textarea'"
              :id="`f-${f.key}`"
              v-model="draft[f.key]"
              :rows="f.rows || 3"
              :placeholder="f.placeholder"
            />
            <input v-else-if="f.type === 'switch'" :id="`f-${f.key}`" v-model="draft[f.key]" class="switch" type="checkbox" role="switch" />
            <input
              v-else-if="f.type === 'number'"
              :id="`f-${f.key}`"
              v-model="draft[f.key]"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              :placeholder="f.placeholder"
            />
            <input
              v-else
              :id="`f-${f.key}`"
              v-model="draft[f.key]"
              :type="f.type || 'text'"
              :placeholder="f.placeholder"
              autocomplete="off"
              :autocapitalize="f.type === 'url' ? 'off' : 'sentences'"
            />
          </div>
        </div>
        <p v-if="group.note" class="form-note footnote">{{ group.note }}</p>
      </template>
      <button type="submit" class="visually-hidden" tabindex="-1" aria-hidden="true">Enregistrer</button>
    </form>

    <div v-if="canDelete" class="form-group sheet-delete">
      <button class="row btn-danger" type="button" @click="askDelete">
        {{ confirming ? 'Appuie encore pour confirmer' : deleteLabel }}
      </button>
    </div>
  </BottomSheet>
</template>

<style>
.sheet-delete {
  margin-top: 1.75rem;
}

.sheet-delete .row {
  justify-content: center;
}

.field input.switch {
  margin-left: auto;
}
</style>
