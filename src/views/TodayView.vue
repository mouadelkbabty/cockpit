<script setup>
import { computed, inject } from 'vue'
import { state, setting } from '../store/index.js'
import { toggleDeadline } from '../store/actions.js'
import { today } from '../lib/now.js'
import { monthKey, addDays } from '../lib/dates.js'
import { upcoming } from '../lib/deadlines.js'
import { followUps, isActive } from '../lib/jobs.js'
import { dayForDate, weekDone } from '../lib/sport.js'
import { savingsTotal } from '../lib/money.js'
import { eur, dateLong, dateShort, relativeDay, monthName } from '../lib/format.js'
import Icon from '../components/Icon.vue'

const go = inject('go')

const goal = setting('goal')
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

const total = computed(() => savingsTotal(state.data.accounts))
const ratio = computed(() => {
  const target = Number(goal.value?.target) || 0
  return target > 0 ? Math.min(1, total.value / target) : 0
})
const active = computed(() => state.data.applications.filter((a) => isActive(a) && a.stage !== 'a_postuler'))
const due = computed(() => followUps(state.data.applications, today.value).length)
const week = computed(() => weekDone(state.data.sessions, today.value).length)
const planned = computed(() => (program.value?.week || []).filter(Boolean).length)
const tomorrow = computed(() => addDays(today.value, 1))
</script>

<template>
  <div class="view">
    <p class="subhead secondary view-date">{{ dateLong(today) }}</p>
    <h1 class="large-title">Aujourd'hui</h1>

    <section v-if="empty" class="section">
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
      <section class="section">
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

      <section v-if="later.length" class="section">
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

      <section class="section">
        <div class="section-head">
          <h2 class="title2">Où tu en es</h2>
        </div>
        <div class="group">
          <button class="row with-lead" type="button" @click="go('money')">
            <span class="lead" style="color: var(--money)"><Icon name="money" :size="22" /></span>
            <span class="row-main">
              <span class="row-title">Épargne</span>
              <span v-if="goal?.target" class="row-sub">{{ Math.round(ratio * 100) }} % de {{ eur(goal.target) }}</span>
              <span v-if="goal?.target" class="meter overview-meter" style="--tint: var(--money)">
                <i :style="{ width: `${ratio * 100}%` }" />
              </span>
            </span>
            <span class="row-value">{{ eur(total) }}</span>
            <Icon class="chevron" name="chevron" :size="14" />
          </button>
          <button class="row with-lead" type="button" @click="go('jobs')">
            <span class="lead" style="color: var(--jobs)"><Icon name="jobs" :size="22" /></span>
            <span class="row-main">
              <span class="row-title">Candidatures en cours</span>
              <span class="row-sub">{{ due ? `${due} à relancer` : 'Rien à relancer' }}</span>
            </span>
            <span class="row-value">{{ active.length }}</span>
            <Icon class="chevron" name="chevron" :size="14" />
          </button>
          <button class="row with-lead" type="button" @click="go('sport')">
            <span class="lead" style="color: var(--sport)"><Icon name="sport" :size="22" /></span>
            <span class="row-main">
              <span class="row-title">Séances cette semaine</span>
              <span v-if="planned" class="row-sub">{{ planned }} prévues</span>
            </span>
            <span class="row-value">{{ week }}</span>
            <Icon class="chevron" name="chevron" :size="14" />
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

.overview-meter {
  display: block;
  margin-top: 0.4375rem;
}
</style>
