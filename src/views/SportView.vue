<script setup>
import { computed, ref, watch } from 'vue'
import { state, setting, save, remove, saveSetting } from '../store/index.js'
import { today } from '../lib/now.js'
import { tap } from '../lib/haptic.js'
import { addDays, startOfWeek } from '../lib/dates.js'
import { dayForDate, lastEntry, weekDone, exerciseNames, PPL_TEMPLATE } from '../lib/sport.js'
import { kg, number, dateShort, dateLong } from '../lib/format.js'
import Icon from '../components/Icon.vue'
import TrendChart from '../components/TrendChart.vue'
import ProgramSheet from '../components/ProgramSheet.vue'

const INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const program = setting('program')
const sessions = computed(() => state.data.sessions)
const hasProgram = computed(() => Boolean(program.value?.days?.length))

const selected = ref(today.value)
watch(today, (now, before) => {
  if (selected.value === before) selected.value = now
})

// ---------- Semaine ----------

const weekStart = computed(() => startOfWeek(selected.value))
const strip = computed(() =>
  INITIALS.map((initial, i) => {
    const iso = addDays(weekStart.value, i)
    return {
      iso,
      initial,
      num: Number(iso.slice(8)),
      planned: Boolean(dayForDate(program.value, iso)),
      done: sessions.value.some((s) => s.date === iso),
      isToday: iso === today.value,
    }
  }),
)
const doneThisWeek = computed(() => weekDone(sessions.value, selected.value).length)
const plannedPerWeek = computed(() => (program.value?.week || []).filter(Boolean).length)

const weekDirection = ref('next')

function shiftWeek(n) {
  weekDirection.value = n > 0 ? 'next' : 'prev'
  selected.value = addDays(selected.value, 7 * n)
}

// ---------- Séance du jour choisi ----------

const session = computed(() => sessions.value.find((s) => s.date === selected.value) || null)
const override = ref('')
watch(selected, () => {
  override.value = ''
})

const day = computed(() => {
  const days = program.value?.days
  if (!days) return null
  const forced = session.value?.dayId || override.value
  return (forced && days.find((d) => d.id === forced)) || dayForDate(program.value, selected.value)
})

const text = (v) => (v == null || v === '' ? '' : String(v).replace('.', ','))
const value = (v) => {
  if (v == null || String(v).trim() === '') return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const draft = ref([])

function build() {
  const d = day.value
  if (!d) {
    draft.value = []
    return
  }
  const saved = session.value
  draft.value = d.exercises.map((ex) => {
    const entry = saved?.entries?.find((e) => e.exercise === ex.name)
    const count = Math.max(Number(ex.sets) || 1, entry?.sets?.length || 0)
    return {
      name: ex.name,
      target: [ex.sets, ex.reps].filter(Boolean).join(' × '),
      last: lastEntry(sessions.value, ex.name, selected.value),
      sets: Array.from({ length: count }, (_, i) => ({ weight: text(entry?.sets?.[i]?.weight), reps: text(entry?.sets?.[i]?.reps) })),
    }
  })
}

// On ne reconstruit pas à chaque enregistrement : la saisie en cours ne doit jamais être écrasée.
watch([selected, () => state.ready, () => JSON.stringify(day.value)], build, { immediate: true })

function persist() {
  const entries = []
  for (const ex of draft.value) {
    const sets = ex.sets.map((s) => ({ weight: value(s.weight), reps: value(s.reps) }))
    if (sets.some((s) => s.reps > 0)) entries.push({ exercise: ex.name, sets })
  }
  const names = new Set(draft.value.map((ex) => ex.name))
  const kept = (session.value?.entries || []).filter((e) => !names.has(e.exercise))
  const all = [...entries, ...kept]
  if (!all.length) {
    if (session.value) remove('sessions', selected.value)
    return
  }
  save('sessions', { id: selected.value, date: selected.value, dayId: day.value.id, dayName: day.value.name, entries: all })
}

const isDone = (s) => value(s.reps) > 0

// Valeurs proposées : la série précédente du jour, sinon la même série la dernière fois.
function hint(ex, i) {
  for (let k = i - 1; k >= 0; k--) if (isDone(ex.sets[k])) return { weight: ex.sets[k].weight, reps: ex.sets[k].reps }
  const before = ex.last?.sets
  const s = before?.[i] ?? before?.[before.length - 1]
  return { weight: text(s?.weight), reps: text(s?.reps) }
}

function toggleSet(ex, i, event) {
  const s = ex.sets[i]
  if (isDone(s)) {
    s.weight = ''
    s.reps = ''
  } else {
    const h = hint(ex, i)
    if (!s.weight) s.weight = h.weight
    if (!s.reps) s.reps = h.reps
    if (!isDone(s)) {
      event.currentTarget.parentElement.querySelector('input[data-reps]')?.focus()
      return
    }
    tap()
  }
  persist()
}

function addSet(ex) {
  ex.sets.push({ weight: '', reps: '' })
}

function describe(sets) {
  const done = (sets || []).filter((s) => Number(s.reps) > 0)
  if (!done.length) return ''
  const runs = []
  for (const s of done) {
    const w = Number(s.weight) || 0
    const run = runs[runs.length - 1]
    if (run && run.w === w) run.reps.push(s.reps)
    else runs.push({ w, reps: [s.reps] })
  }
  return runs.map((r) => (r.w ? `${kg(r.w)} × ${r.reps.join(', ')}` : `${r.reps.join(', ')} répétitions`)).join(' puis ')
}

// ---------- Progression ----------

function series(name) {
  const out = []
  for (const s of sessions.value) {
    const sets = (s.entries || []).find((e) => e.exercise === name)?.sets?.filter((x) => Number(x.reps) > 0)
    if (!sets?.length) continue
    out.push({
      date: s.date,
      top: Math.max(...sets.map((x) => Number(x.weight) || 0)),
      reps: Math.max(...sets.map((x) => Number(x.reps) || 0)),
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

const tracked = computed(() => exerciseNames(program.value, sessions.value).filter((n) => series(n).length))
const chosen = ref('')
const exercise = computed(() => (tracked.value.includes(chosen.value) ? chosen.value : tracked.value[0] || ''))
const history = computed(() => (exercise.value ? series(exercise.value) : []))
const loaded = computed(() => history.value.some((p) => p.top > 0))
const progressPoints = computed(() =>
  history.value.map((p) => ({ label: dateShort(p.date), title: dateShort(p.date, today.value), value: loaded.value ? p.top : p.reps })),
)
const progressFormat = (v) => (loaded.value ? kg(v) : `${number(v)} rép.`)
const progressNote = computed(() => {
  const pts = progressPoints.value
  if (pts.length < 2) return ''
  const gain = pts[pts.length - 1].value - pts[0].value
  const unit = loaded.value ? 'kg' : 'répétitions'
  if (gain === 0) return `Stable depuis le ${pts[0].title}.`
  return `${gain > 0 ? '+' : '−'}${number(Math.abs(gain))} ${unit} depuis le ${pts[0].title}.`
})

// ---------- Poids du corps ----------

const weights = computed(() => [...state.data.weights].sort((a, b) => a.date.localeCompare(b.date)))
const weightToday = computed(() => weights.value.find((w) => w.date === today.value) || null)
const weightBefore = computed(() => [...weights.value].reverse().find((w) => w.date < today.value) || null)
const weightPoints = computed(() => weights.value.map((w) => ({ label: dateShort(w.date), title: dateShort(w.date, today.value), value: w.kg })))
const weightNote = computed(() => {
  const list = weights.value
  if (list.length < 2) return ''
  const gain = list[list.length - 1].kg - list[0].kg
  if (Math.abs(gain) < 0.05) return `Stable depuis le ${dateShort(list[0].date, today.value)}.`
  return `${gain > 0 ? '+' : '−'}${number(Math.abs(gain))} kg depuis le ${dateShort(list[0].date, today.value)}.`
})

function saveWeight(event) {
  const n = value(event.target.value)
  if (n == null) {
    if (weightToday.value) remove('weights', today.value)
    return
  }
  save('weights', { id: today.value, date: today.value, kg: n })
  tap()
}

// ---------- Programme ----------

const editing = ref(false)

function saveProgram(next) {
  saveSetting('program', next)
}

function useTemplate() {
  saveSetting('program', PPL_TEMPLATE)
}
</script>

<template>
  <div class="view">
    <h1 v-reveal class="large-title">Sport</h1>
    <p v-if="hasProgram" v-reveal class="subhead secondary view-summary">
      {{ doneThisWeek }} {{ doneThisWeek > 1 ? 'séances faites' : 'séance faite' }} cette semaine sur {{ plannedPerWeek }} prévues
    </p>

    <section v-if="!hasProgram" v-reveal class="section">
      <div class="group">
        <div class="empty">
          <p class="headline">Aucun programme pour l'instant.</p>
          <p class="subhead">
            Écris tes séances une fois : chaque jour, l'application te montre la séance prévue et ce que tu as soulevé la
            dernière fois.
          </p>
        </div>
        <button class="row link-row row-sep" type="button" @click="editing = true">Écrire mon programme</button>
        <button class="row link-row" type="button" @click="useTemplate">Partir du modèle Push, Pull, Legs</button>
      </div>
    </section>

    <template v-else>
      <section v-reveal class="section">
        <div class="week">
          <button class="icon-btn week-nav" type="button" aria-label="Semaine précédente" @click="shiftWeek(-1)">
            <Icon class="back" name="chevron" :size="16" />
          </button>
          <Transition :name="`week-${weekDirection}`">
          <div :key="weekStart" class="week-days">
            <button
              v-for="d in strip"
              :key="d.iso"
              class="week-day"
              type="button"
              :class="{ today: d.isToday }"
              :aria-pressed="d.iso === selected"
              :aria-label="`${dateLong(d.iso)}${d.done ? ', séance faite' : d.planned ? ', séance prévue' : ', repos'}`"
              @click="selected = d.iso"
            >
              <span class="caption secondary">{{ d.initial }}</span>
              <span class="week-num num">{{ d.num }}</span>
              <span class="week-mark" :class="{ done: d.done, planned: d.planned }" />
            </button>
          </div>
          </Transition>
          <button class="icon-btn week-nav" type="button" aria-label="Semaine suivante" @click="shiftWeek(1)">
            <Icon name="chevron" :size="16" />
          </button>
        </div>
      </section>

      <section v-reveal class="section">
        <div class="section-head">
          <h2 class="title2">{{ day ? day.name : 'Repos' }}</h2>
          <span class="subhead secondary">{{ selected === today ? "Aujourd'hui" : dateShort(selected, today) }}</span>
        </div>

        <div v-if="!day" class="group">
          <p class="empty">Pas de séance prévue ce jour-là.</p>
          <div class="field row-sep">
            <label for="override">Faire une séance</label>
            <select id="override" v-model="override">
              <option value="">Choisir</option>
              <option v-for="d in program.days" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </div>
        </div>

        <div v-for="ex in draft" :key="ex.name" class="group exercise">
          <div class="exercise-head">
            <div class="exercise-title">
              <span class="headline">{{ ex.name }}</span>
              <span v-if="ex.target" class="subhead secondary num">{{ ex.target }}</span>
            </div>
            <p v-if="ex.last" class="footnote secondary">
              Le {{ dateShort(ex.last.date, today) }} : {{ describe(ex.last.sets) }}
            </p>
          </div>
          <div v-for="(s, i) in ex.sets" :key="i" class="set" :class="{ done: isDone(s) }">
            <span class="set-index footnote secondary num">{{ i + 1 }}</span>
            <label class="set-field">
              <input
                v-model="s.weight"
                class="num"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                :placeholder="hint(ex, i).weight || '0'"
                :aria-label="`${ex.name}, série ${i + 1}, charge en kilos`"
                @change="persist"
              />
              <span class="footnote secondary">kg</span>
            </label>
            <label class="set-field">
              <input
                v-model="s.reps"
                class="num"
                data-reps
                type="text"
                inputmode="numeric"
                autocomplete="off"
                :placeholder="hint(ex, i).reps || '0'"
                :aria-label="`${ex.name}, série ${i + 1}, répétitions`"
                @change="persist"
              />
              <span class="footnote secondary">rép.</span>
            </label>
            <button
              class="check"
              type="button"
              role="checkbox"
              :aria-checked="isDone(s) ? 'true' : 'false'"
              :aria-label="`${ex.name}, série ${i + 1} faite`"
              @click="toggleSet(ex, i, $event)"
            >
              <span class="check-ring"><Icon name="check" :size="14" /></span>
            </button>
          </div>
          <button class="row link-row row-sep subhead" type="button" @click="addSet(ex)">Ajouter une série</button>
        </div>
        <p v-if="day" class="section-note footnote">
          Coche une série pour reprendre les valeurs proposées. Tout est enregistré au fur et à mesure.
        </p>
      </section>

      <section v-reveal class="section">
        <div class="section-head">
          <h2 class="title2">Progression</h2>
        </div>
        <template v-if="tracked.length">
          <div class="group">
            <div class="field">
              <label for="exercise">Exercice</label>
              <select id="exercise" :value="exercise" @change="chosen = $event.target.value">
                <option v-for="n in tracked" :key="n" :value="n">{{ n }}</option>
              </select>
            </div>
          </div>
          <template v-if="progressPoints.length > 1">
            <TrendChart
              class="sport-chart"
              :points="progressPoints"
              :format="progressFormat"
              :height="180"
              :summary="`${exercise} : ${progressNote}`"
              :columns="['Séance', loaded ? 'Charge la plus lourde' : 'Meilleure série']"
            />
            <p class="section-note footnote">
              {{ loaded ? 'Charge la plus lourde de chaque séance.' : 'Meilleure série de chaque séance.' }} {{ progressNote }}
            </p>
          </template>
          <p v-else class="section-note footnote">Encore une séance de cet exercice et la courbe apparaît.</p>
        </template>
        <div v-else class="group">
          <p class="empty">La courbe de chaque exercice apparaît ici dès ta première séance enregistrée.</p>
        </div>
      </section>
    </template>

    <section v-reveal class="section">
      <div class="section-head">
        <h2 class="title2">Poids du corps</h2>
      </div>
      <div class="group">
        <div class="field">
          <label for="weight">Aujourd'hui</label>
          <input
            id="weight"
            class="num"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            :value="text(weightToday?.kg)"
            :placeholder="weightBefore ? text(weightBefore.kg) : '0'"
            @change="saveWeight"
          />
          <span class="secondary">kg</span>
        </div>
      </div>
      <TrendChart
        v-if="weightPoints.length > 1"
        class="sport-chart"
        :points="weightPoints"
        :format="kg"
        :height="180"
        :summary="`Poids du corps. ${weightNote}`"
        :columns="['Date', 'Poids']"
      />
      <p v-if="weightNote" class="section-note footnote">{{ weightNote }}</p>
      <p v-else-if="weightBefore && !weightToday" class="section-note footnote">
        Dernière pesée : {{ kg(weightBefore.kg) }} le {{ dateShort(weightBefore.date, today) }}.
      </p>
    </section>

    <section v-if="hasProgram" v-reveal class="section">
      <div class="group">
        <button class="row link-row" type="button" @click="editing = true">Modifier le programme</button>
      </div>
    </section>

    <ProgramSheet v-model:open="editing" :program="program" @save="saveProgram" />
  </div>
</template>

<style>
.week {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  margin: 0 -0.5rem;
  overflow-x: clip;
}

.icon-btn.week-nav {
  width: 2rem;
  color: var(--label3);
}

.week-nav .back {
  transform: rotate(180deg);
}

.week-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-area: 1 / 2;
}

/* Changer de semaine : l'ancienne sort d'un côté, la nouvelle entre de l'autre. */
.week-next-enter-active,
.week-next-leave-active,
.week-prev-enter-active,
.week-prev-leave-active {
  transition: transform 520ms var(--spring), opacity 220ms ease;
}

.week-next-enter-from,
.week-prev-leave-to {
  opacity: 0;
  transform: translateX(28%);
}

.week-next-leave-to,
.week-prev-enter-from {
  opacity: 0;
  transform: translateX(-28%);
}

.week-day {
  display: grid;
  justify-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0 0.375rem;
  transition: transform 100ms ease-out;
}

.week-day:active {
  transform: scale(0.94);
}

.week-num {
  width: 100%;
  max-width: 2.25rem;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 1.125rem;
}

.week-day.today .week-num {
  color: var(--tint);
  font-weight: 600;
}

.week-day[aria-pressed='true'] .week-num {
  background: var(--label);
  color: #000;
  font-weight: 600;
  /* Le jour choisi se pose avec un rebond. */
  animation: day-pop 520ms var(--spring-bounce);
}

@keyframes day-pop {
  from {
    transform: scale(0.6);
  }
}

.week-day.today[aria-pressed='true'] .week-num {
  background: var(--tint);
}

.week-mark {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
}

.week-mark.planned {
  box-shadow: inset 0 0 0 1px var(--label3);
}

.week-mark {
  transition: background 240ms ease, box-shadow 240ms ease, transform 520ms var(--spring-bounce);
}

.week-mark.done {
  background: var(--tint);
  box-shadow: none;
  transform: scale(1.25);
}

/* Une série validée : la ligne s'éclaire brièvement. */
.set {
  transition: background 600ms ease;
}

.set-field {
  transition: box-shadow 160ms ease, background 240ms ease;
}

.set.done .set-field {
  background: rgba(118, 118, 128, 0.14);
}

.exercise + .exercise {
  margin-top: 0.75rem;
}

.exercise-head {
  padding: 0.75rem 1rem 0.5rem;
}

.exercise-head p {
  margin: 0.125rem 0 0;
}

.exercise-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.set {
  display: grid;
  grid-template-columns: 1.25rem 1fr 1fr auto;
  align-items: center;
  gap: 0.625rem;
  padding: 0.3125rem 1rem;
}

.set .check {
  margin: 0 -0.375rem 0 0;
  padding: 0.625rem 0.375rem;
}

.set .check[aria-checked='true'] .check-ring {
  background: var(--tint);
  border-color: var(--tint);
}

.set-field {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  height: 2.5rem;
  padding: 0 0.75rem;
  border-radius: 0.625rem;
  background: var(--fill);
  cursor: text;
}

.set-field:focus-within {
  box-shadow: inset 0 0 0 1.5px var(--tint);
}

.set-field input {
  flex: 1;
  min-width: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
}

.set-field input::placeholder {
  color: var(--label3);
}

.sport-chart {
  margin-top: 1.25rem;
}

.field > span {
  flex: none;
}
</style>
