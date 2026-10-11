<script setup>
import { computed, inject } from 'vue'
import { state, setting } from '../store/index.js'
import { useSavings } from '../store/savings.js'
import { toggleDeadline } from '../store/actions.js'
import { today } from '../lib/now.js'
import { monthKey, addDays, startOfWeek } from '../lib/dates.js'
import { upcoming } from '../lib/deadlines.js'
import { followUps, isActive, dueDate } from '../lib/jobs.js'
import { dayForDate, weekDone } from '../lib/sport.js'
import { eur, dateLong, dateShort, relativeDay, monthName, monthLabel } from '../lib/format.js'
import Icon from '../components/Icon.vue'
import AnimatedNumber from '../components/AnimatedNumber.vue'
import Sparkline from '../components/Sparkline.vue'

const go = inject('go')

const { goal, savings } = useSavings()
const program = setting('program')
const empty = computed(() => Object.values(state.data).every((list) => list.length === 0))

function deadlineNote(d) {
  const dl = d.deadline
  if (!dl.amount) return ''
  if (dl.kind === 'recevoir') return `${eur(dl.amount)} à recevoir`
  if (dl.kind === 'payer') return `${eur(dl.amount)} à payer`
  return eur(dl.amount)
}

const soon = computed(() => upcoming(state.data.deadlines, today.value, 14))

// Ce qui demande une action aujourd'hui, tous domaines confondus.
const now = computed(() => {
  const out = []
  for (const d of soon.value) {
    if (d.date > today.value) continue
    out.push({
      key: `d-${d.id}-${d.date}`,
      type: 'deadline',
      title: d.title,
      sub: [d.overdue ? relativeDay(d.date, today.value) : '', deadlineNote(d)].filter(Boolean).join(', '),
      late: d.overdue,
      done: d.done,
      source: d,
    })
  }
  for (const a of followUps(state.data.applications, today.value)) {
    out.push({
      key: `a-${a.id}`,
      type: 'link',
      tab: 'jobs',
      color: 'var(--jobs)',
      title: a.nextAction || `Relancer ${a.company}`,
      sub: a.nextAction ? a.company : a.role || '',
    })
  }
  const day = dayForDate(program.value, today.value)
  if (day) {
    const logged = state.data.sessions.some((s) => s.date === today.value)
    out.push({
      key: 'sport',
      type: 'link',
      tab: 'sport',
      color: 'var(--sport)',
      title: `Séance ${day.name}`,
      sub: logged ? 'Enregistrée' : `${day.exercises.length} exercices`,
      done: logged,
    })
  }
  const g = goal.value
  if (g?.monthly > 0 && g.depositDoneMonth !== monthKey(today.value)) {
    out.push({
      key: 'deposit',
      type: 'link',
      tab: 'money',
      color: 'var(--money)',
      title: `Versement de ${monthName(monthKey(today.value))}`,
      sub: `${eur(g.monthly)} à mettre de côté`,
    })
  }
  return out
})

const later = computed(() => soon.value.filter((d) => d.date > today.value && !d.done))
const tomorrow = computed(() => addDays(today.value, 1))

// ---------- Widget Épargne ----------

const spark = computed(() => {
  const s = savings.value
  if (!s.monthly && !s.inflows.length) return []
  const count = Math.max(4, s.goalIndex + 1)
  return [s.total, ...s.points.slice(0, count).map((p) => p.amount)]
})

const savingsFoot = computed(() => {
  const s = savings.value
  if (!s.hasGoal) return ''
  if (s.total >= s.target) return 'Objectif atteint'
  if (s.status.amountAtDate != null) return `${eur(s.status.amountAtDate)} prévus le ${dateShort(goal.value.date, today.value)}`
  if (s.status.reachedMonth) return `Atteint en ${monthLabel(s.status.reachedMonth)}`
  return ''
})

// ---------- Widget Emploi ----------

const apps = computed(() => state.data.applications.filter(isActive))
const sent = computed(() => apps.value.filter((a) => a.stage !== 'a_postuler'))
const due = computed(() => followUps(state.data.applications, today.value).length)
// Une pastille par candidature : pleine une fois envoyée.
const pipeline = computed(() =>
  [...apps.value]
    .sort((a, b) => (a.stage === 'a_postuler') - (b.stage === 'a_postuler'))
    .slice(0, 14)
    .map((a) => ({ id: a.id, sent: a.stage !== 'a_postuler' })),
)
const jobsFoot = computed(() => {
  if (due.value) return `${due.value} à relancer`
  const next = apps.value
    .map((a) => ({ a, date: dueDate(a) }))
    .filter((x) => x.date)
    .sort((x, y) => x.date.localeCompare(y.date))[0]
  if (next) return `${next.a.company}, ${relativeDay(next.date, today.value).toLowerCase()}`
  const waiting = apps.value.length - sent.value.length
  return waiting ? `${waiting} à envoyer` : 'Rien à relancer'
})

// ---------- Widget Sport ----------

const week = computed(() => {
  const start = startOfWeek(today.value)
  return Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(start, i)
    return {
      iso,
      done: state.data.sessions.some((s) => s.date === iso),
      planned: Boolean(dayForDate(program.value, iso)),
      isToday: iso === today.value,
    }
  })
})
const todaySession = computed(() => dayForDate(program.value, today.value))
const doneCount = computed(() => weekDone(state.data.sessions, today.value).length)
const plannedCount = computed(() => (program.value?.week || []).filter(Boolean).length)
</script>

<template>
  <div class="view">
    <p v-reveal class="subhead secondary view-date">{{ dateLong(today) }}</p>
    <h1 v-reveal class="large-title">Aujourd'hui</h1>

    <section v-if="empty" v-reveal class="section">
      <div class="group">
        <div class="empty">
          <p class="headline">Rien n'est encore enregistré.</p>
          <p class="subhead">
            Importe ton fichier de données dans les réglages, ou commence par ajouter un compte, une candidature ou ton
            programme de sport.
          </p>
        </div>
        <button class="row link-row row-sep" type="button" @click="go('settings')">Ouvrir les réglages</button>
      </div>
    </section>

    <template v-else>
      <div class="widgets">
        <button v-reveal class="widget widget-wide" type="button" style="--tint: var(--money)" @click="go('money')">
          <span class="widget-head">
            <Icon name="money" :size="18" />
            <span>Épargne</span>
          </span>
          <span class="widget-body">
            <span class="widget-text">
              <span class="widget-figure"><AnimatedNumber :value="savings.total" :format="eur" :from="0" /></span>
              <span v-if="savings.hasGoal" class="footnote secondary">sur {{ eur(savings.target) }}</span>
            </span>
            <Sparkline v-if="spark.length > 1" class="widget-spark" :values="spark" :target="savings.hasGoal ? savings.target : null" />
          </span>
          <span v-if="savings.hasGoal" class="meter"><i :style="{ '--fill': savings.ratio }" /></span>
          <span v-if="savingsFoot" class="footnote secondary">{{ savingsFoot }}</span>
        </button>

        <button v-reveal class="widget" type="button" style="--tint: var(--jobs)" @click="go('jobs')">
          <span class="widget-head">
            <Icon name="jobs" :size="18" />
            <span>Emploi</span>
          </span>
          <span class="widget-text">
            <span class="widget-figure"><AnimatedNumber :value="sent.length" :from="0" /></span>
            <span class="footnote secondary">en cours</span>
          </span>
          <span v-if="pipeline.length" class="pips" aria-hidden="true">
            <i v-for="(p, i) in pipeline" :key="p.id" :class="{ full: p.sent }" :style="{ '--n': i }" />
          </span>
          <span class="footnote" :class="due ? 'accent' : 'secondary'">{{ jobsFoot }}</span>
        </button>

        <button v-reveal class="widget" type="button" style="--tint: var(--sport)" @click="go('sport')">
          <span class="widget-head">
            <Icon name="sport" :size="18" />
            <span>Sport</span>
          </span>
          <span class="widget-text">
            <span class="widget-figure widget-figure-text">{{ todaySession ? todaySession.name : 'Repos' }}</span>
            <span class="footnote secondary">aujourd'hui</span>
          </span>
          <span class="pips pips-week" aria-hidden="true">
            <i
              v-for="(d, i) in week"
              :key="d.iso"
              :class="{ full: d.done, rest: !d.planned && !d.done, now: d.isToday }"
              :style="{ '--n': i }"
            />
          </span>
          <span class="footnote secondary">
            {{ doneCount }}<template v-if="plannedCount"> sur {{ plannedCount }}</template> cette semaine
          </span>
        </button>
      </div>

      <section v-reveal class="section">
        <div class="section-head">
          <h2 class="title2">À faire</h2>
        </div>
        <div class="group">
          <p v-if="!now.length" class="empty">Rien à faire aujourd'hui.</p>
          <template v-for="item in now" :key="item.key">
            <div v-if="item.type === 'deadline'" class="row with-lead" :class="{ 'is-done': item.done }">
              <button
                class="check"
                type="button"
                role="checkbox"
                :aria-checked="item.done ? 'true' : 'false'"
                :aria-label="`Fait : ${item.title}`"
                @click="toggleDeadline(item.source.deadline, item.source.date)"
              >
                <span class="check-ring"><Icon name="check" :size="14" /></span>
              </button>
              <div class="row-main">
                <div class="row-title">{{ item.title }}</div>
                <div v-if="item.sub" class="row-sub" :class="{ late: item.late }">{{ item.sub }}</div>
              </div>
            </div>
            <button v-else class="row with-lead" :class="{ 'is-done': item.done }" type="button" @click="go(item.tab)">
              <span class="lead"><span class="dot" :style="{ '--dot': item.color }" /></span>
              <span class="row-main">
                <span class="row-title">{{ item.title }}</span>
                <span v-if="item.sub" class="row-sub">{{ item.sub }}</span>
              </span>
              <Icon class="chevron" name="chevron" :size="14" />
            </button>
          </template>
        </div>
      </section>

      <section v-if="later.length" v-reveal class="section">
        <div class="section-head">
          <h2 class="title2">Dans les 14 jours</h2>
        </div>
        <div class="group">
          <button v-for="d in later" :key="`${d.id}-${d.date}`" class="row" type="button" @click="go('money')">
            <span class="row-main">
              <span class="row-title">{{ d.title }}</span>
              <span v-if="deadlineNote(d)" class="row-sub">{{ deadlineNote(d) }}</span>
            </span>
            <span class="row-value secondary">
              {{ d.date === tomorrow ? 'Demain' : dateShort(d.date, today) }}
            </span>
          </button>
        </div>
      </section>
    </template>
  </div>
</template>

<style>
.view-date {
  margin: 0.75rem 0 0;
}

.view-date + .large-title {
  margin-top: 0;
}

.row-sub.late,
.late {
  color: var(--alert);
}

.accent {
  color: var(--tint);
}

/* ---------- Widgets ---------- */

.widgets {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.widget {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  min-height: 10.25rem;
  padding: 0.875rem 1rem 1rem;
  border-radius: 1.375rem;
  background: var(--elev);
  box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.07);
  text-align: left;
  transition: transform 560ms var(--spring-bounce), background 200ms ease;
}

/* Le widget s'enfonce sous le doigt, puis revient en ressort. */
.widget:active {
  transform: scale(0.965);
  background: #232326;
  transition: transform 90ms ease-out, background 90ms ease-out;
}

.widget-wide {
  grid-column: 1 / -1;
  min-height: 0;
}

.widget-head {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--tint);
  font-size: 0.9375rem;
  font-weight: 600;
}

.widget-body {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: end;
  gap: 1.25rem;
}

.widget-text {
  display: grid;
  gap: 0.0625rem;
}

.widget-figure {
  font-size: 2.125rem;
  line-height: 1.05;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.widget-figure-text {
  font-size: 1.625rem;
  line-height: 1.15;
  letter-spacing: -0.018em;
  overflow-wrap: anywhere;
}

.widget > .footnote:last-child,
.widget > .pips {
  margin-top: auto;
}

.widget > .pips + .footnote:last-child {
  margin-top: 0;
}

.widget .meter {
  display: block;
}

/* Pastilles : une par candidature, ou une par jour de la semaine. Elles se posent l'une après l'autre. */
.pips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3125rem;
}

.pips i {
  width: 0.5625rem;
  height: 0.5625rem;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--label3);
  animation: pip-in 520ms var(--spring-bounce) calc(380ms + var(--n) * 45ms) both;
}

.pips i.full {
  background: var(--tint);
  box-shadow: none;
}

.pips-week {
  justify-content: space-between;
  flex-wrap: nowrap;
}

.pips-week i.rest {
  box-shadow: none;
  background: var(--fill-strong);
  transform: scale(0.5);
}

.pips-week i.now {
  outline: 1.5px solid var(--label);
  outline-offset: 2px;
}

@keyframes pip-in {
  from {
    opacity: 0;
    scale: 0;
  }
}

@media (min-width: 54rem) {
  .widgets {
    grid-template-columns: repeat(4, 1fr);
  }

  .widget-wide {
    grid-column: span 2;
    min-height: 10.25rem;
  }
}
</style>
