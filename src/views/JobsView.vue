<script setup>
import { computed, reactive, ref } from 'vue'
import { state, save, remove } from '../store/index.js'
import { today } from '../lib/now.js'
import { tap } from '../lib/haptic.js'
import { diffDays } from '../lib/dates.js'
import { STAGES, stageLabel, followUps, dueDate, isActive } from '../lib/jobs.js'
import { dateShort, relativeDay } from '../lib/format.js'
import Icon from '../components/Icon.vue'
import EditSheet from '../components/EditSheet.vue'

// Les étapes les plus avancées en premier : c'est là que se joue la suite.
const ORDER = ['offre', 'entretien', 'test', 'postule', 'a_postuler']

const apps = computed(() => state.data.applications)
const due = computed(() => followUps(apps.value, today.value))
const dueIds = computed(() => new Set(due.value.map((a) => a.id)))

const groups = computed(() =>
  ORDER.map((id) => ({
    id,
    label: stageLabel(id),
    items: apps.value
      .filter((a) => a.stage === id && !dueIds.value.has(a.id))
      .sort((a, b) => String(dueDate(a) || '9').localeCompare(String(dueDate(b) || '9')) || a.company.localeCompare(b.company)),
  })).filter((g) => g.items.length),
)
const closed = computed(() => apps.value.filter((a) => a.stage === 'refus').sort((a, b) => a.company.localeCompare(b.company)))
const showClosed = ref(false)

const counts = computed(() => {
  const active = apps.value.filter((a) => isActive(a) && a.stage !== 'a_postuler').length
  const todo = apps.value.filter((a) => a.stage === 'a_postuler').length
  return { active, todo }
})

const summary = computed(() => {
  const { active, todo } = counts.value
  if (!apps.value.length) return ''
  const parts = [`${active} en cours`]
  if (todo) parts.push(`${todo} à envoyer`)
  if (due.value.length) parts.push(`${due.value.length} à relancer`)
  return parts.join(', ')
})

function dueNote(a) {
  if (a.nextAction) return a.nextDate ? `${a.nextAction}, ${relativeDay(a.nextDate, today.value).toLowerCase()}` : a.nextAction
  const base = a.touchedOn || a.appliedOn
  if (!base) return 'À relancer'
  const days = diffDays(base, today.value)
  return `Sans nouvelle depuis ${days} jours`
}

function note(a) {
  if (a.nextAction) return a.nextDate ? `${a.nextAction}, ${dateShort(a.nextDate, today.value)}` : a.nextAction
  if (a.nextDate) return `Prévu le ${dateShort(a.nextDate, today.value)}`
  if (a.stage === 'a_postuler') return a.role || ''
  const base = a.touchedOn || a.appliedOn
  return base ? `Dernier contact le ${dateShort(base, today.value)}` : ''
}

// Marque l'action comme faite : la candidature reviendra ici dans une semaine si rien ne bouge.
function markDone(a) {
  save('applications', { ...a, touchedOn: today.value, nextDate: '', nextAction: '' })
  tap()
}

const sheet = reactive({ open: false, title: '', value: {}, canDelete: false })

const FORM = [
  {
    fields: [
      { key: 'company', label: 'Entreprise', placeholder: 'Nom', required: true },
      { key: 'role', label: 'Poste', placeholder: 'Développeur Java' },
      { key: 'stage', label: 'Étape', type: 'select', options: STAGES, default: 'a_postuler' },
    ],
  },
  {
    fields: [
      { key: 'appliedOn', label: 'Envoyée le', type: 'date' },
      { key: 'touchedOn', label: 'Dernier contact', type: 'date' },
    ],
    note: "Sans date prévue, une candidature envoyée remonte dans « À relancer » 7 jours après le dernier contact.",
  },
  {
    fields: [
      { key: 'nextAction', label: 'À faire', placeholder: 'Passer le test' },
      { key: 'nextDate', label: 'Pour le', type: 'date' },
    ],
  },
  {
    fields: [
      { key: 'link', label: 'Lien', type: 'url', placeholder: 'https://' },
      { key: 'note', label: 'Notes', type: 'textarea', rows: 4, placeholder: 'Contact, salaire annoncé, questions à poser…' },
    ],
  },
]

function edit(app) {
  Object.assign(sheet, { title: app ? app.company : 'Nouvelle candidature', value: app || {}, canDelete: Boolean(app), open: true })
}

function onSave(value) {
  const before = sheet.value
  const next = { ...value }
  // Passer à « envoyée » sans date : on prend aujourd'hui pour que la relance soit calculée.
  if (next.stage !== 'a_postuler' && next.stage !== 'refus' && !next.appliedOn && !next.touchedOn) next.appliedOn = today.value
  if (before.id && before.stage !== next.stage && next.touchedOn === (before.touchedOn || '')) next.touchedOn = today.value
  save('applications', next)
}

function onDelete() {
  if (sheet.value.id) remove('applications', sheet.value.id)
}

defineExpose({ add: () => edit(null), addLabel: 'Ajouter une candidature' })
</script>

<template>
  <div class="view">
    <h1 class="large-title">Emploi</h1>
    <p v-if="summary" class="subhead secondary view-summary">{{ summary }}</p>

    <section v-if="!apps.length" class="section">
      <div class="group">
        <div class="empty">
          <p class="headline">Aucune candidature suivie.</p>
          <p class="subhead">Note chaque offre dès que tu la repères : l'étape, la date d'envoi et ce qu'il reste à faire.</p>
        </div>
        <button class="row link-row row-sep" type="button" @click="edit(null)">Ajouter une candidature</button>
      </div>
    </section>

    <section v-if="due.length" class="section">
      <div class="section-head">
        <h2 class="title2">À relancer</h2>
      </div>
      <div class="group">
        <div v-for="a in due" :key="a.id" class="row">
          <button class="row-main row-tap" type="button" @click="edit(a)">
            <span class="row-title">{{ a.company }}</span>
            <span class="row-sub">{{ dueNote(a) }}</span>
          </button>
          <button class="btn btn-small" type="button" @click="markDone(a)">Fait</button>
        </div>
      </div>
    </section>

    <section v-for="g in groups" :key="g.id" class="section">
      <div class="section-head">
        <h2 class="title2">{{ g.label }}</h2>
        <span class="subhead secondary num">{{ g.items.length }}</span>
      </div>
      <div class="group">
        <button v-for="a in g.items" :key="a.id" class="row" type="button" @click="edit(a)">
          <span class="row-main">
            <span class="row-title">{{ a.company }}</span>
            <span v-if="a.role && a.stage !== 'a_postuler'" class="row-sub">{{ a.role }}</span>
            <span v-if="note(a)" class="row-sub">{{ note(a) }}</span>
          </span>
          <Icon class="chevron" name="chevron" :size="14" />
        </button>
      </div>
    </section>

    <section v-if="closed.length" class="section">
      <div class="group">
        <button class="row" type="button" :aria-expanded="showClosed" @click="showClosed = !showClosed">
          <span class="row-main"><span class="row-title">Refus ou abandon</span></span>
          <span class="row-value secondary">{{ closed.length }}</span>
          <Icon class="chevron" :class="{ turned: showClosed }" name="chevron" :size="14" />
        </button>
        <template v-if="showClosed">
          <button v-for="a in closed" :key="a.id" class="row" type="button" @click="edit(a)">
            <span class="row-main">
              <span class="row-title secondary">{{ a.company }}</span>
              <span v-if="a.role" class="row-sub">{{ a.role }}</span>
            </span>
          </button>
        </template>
      </div>
    </section>

    <EditSheet
      v-model:open="sheet.open"
      :title="sheet.title"
      :groups="FORM"
      :value="sheet.value"
      :can-delete="sheet.canDelete"
      delete-label="Supprimer la candidature"
      @save="onSave"
      @delete="onDelete"
    />
  </div>
</template>

<style>
.view-summary {
  margin: 0.25rem 0 0;
}

.btn-small {
  min-height: 2rem;
  padding: 0 0.875rem;
  border-radius: 1rem;
  font-size: 0.9375rem;
}

.chevron.turned {
  transform: rotate(90deg);
}
</style>
