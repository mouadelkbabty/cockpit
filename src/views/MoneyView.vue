<script setup>
import { computed, reactive, ref } from 'vue'
import { state, save, remove, saveSetting } from '../store/index.js'
import { useSavings } from '../store/savings.js'
import { toggleDeadline } from '../store/actions.js'
import { today } from '../lib/now.js'
import { tap } from '../lib/haptic.js'
import { monthKey, addMonthKey, diffDays } from '../lib/dates.js'
import { budgetSummary, nextDeposit } from '../lib/money.js'
import { upcoming, occurrences, REPEATS } from '../lib/deadlines.js'
import { eur, percent, dateShort, relativeDay, monthLabel, monthName, monthShort } from '../lib/format.js'
import Icon from '../components/Icon.vue'
import EditSheet from '../components/EditSheet.vue'
import TrendChart from '../components/TrendChart.vue'
import AnimatedNumber from '../components/AnimatedNumber.vue'

const KINDS = [
  { id: 'livret', label: 'Livret' },
  { id: 'bourse', label: 'Bourse (PEA, CTO)' },
  { id: 'courant', label: 'Compte courant' },
]
const KIND_ORDER = { livret: 0, bourse: 1, courant: 2 }

const { goal, savings } = useSavings()
const month = computed(() => monthKey(today.value))
const monthly = computed(() => savings.value.monthly)
const hasGoal = computed(() => savings.value.hasGoal)

const accounts = computed(() =>
  [...state.data.accounts].sort(
    (a, b) =>
      (a.inGoal === false) - (b.inGoal === false) ||
      (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9) ||
      (Number(b.rate) || 0) - (Number(a.rate) || 0),
  ),
)
const total = computed(() => savings.value.total)

// ---------- Prévision ----------

const inflows = computed(() => savings.value.inflows)
const long = computed(() => savings.value.points)
const status = computed(() => savings.value.status)
const goalIndex = computed(() => savings.value.goalIndex)

const chartPoints = computed(() => {
  const reached = long.value.findIndex((p) => p.month === status.value.reachedMonth)
  const count = Math.min(36, Math.max(6, Math.max(goalIndex.value, reached) + 2))
  return [
    { label: 'Auj.', title: "Aujourd'hui", value: total.value },
    ...long.value.slice(0, count).map((p) => ({ label: monthShort(p.month), title: `Fin ${monthLabel(p.month)}`, value: p.amount })),
  ]
})

const chartSummary = computed(() => {
  const end = chartPoints.value[chartPoints.value.length - 1]
  return `Prévision d'épargne : ${eur(total.value)} aujourd'hui, ${eur(end.value)} ${end.title.toLowerCase()}.`
})

const verdict = computed(() => {
  if (!hasGoal.value) return null
  const g = goal.value
  const s = status.value
  if (total.value >= g.target) return { main: 'Objectif atteint.', rest: `Tu as ${eur(total.value - g.target)} d'avance.` }
  if (s.amountAtDate == null) {
    return {
      main: 'La date visée est passée.',
      rest: s.reachedMonth ? `À ce rythme, tu y arrives en ${monthLabel(s.reachedMonth)}.` : 'Choisis une nouvelle date ou un nouveau montant.',
    }
  }
  if (s.missingAtDate === 0) {
    return { main: `Tu seras à ${eur(s.amountAtDate)} le ${dateShort(g.date, today.value)}.`, rest: "C'est au-dessus de ton objectif." }
  }
  const parts = []
  if (s.neededMonthly) parts.push(`Pour y être à temps, il faudrait mettre ${eur(s.neededMonthly)} par mois.`)
  if (s.reachedMonth && monthly.value > 0) parts.push(`À ${eur(monthly.value)} par mois, tu y arrives en ${monthLabel(s.reachedMonth)}.`)
  return {
    main: `Le ${dateShort(g.date, today.value)}, tu auras ${eur(s.amountAtDate)}. Il manquera ${eur(s.missingAtDate)}.`,
    rest: parts.join(' '),
  }
})

// ---------- Versement du mois ----------

const plan = computed(() =>
  nextDeposit(accounts.value, monthly.value).map((p) => ({ ...p, account: accounts.value.find((a) => a.id === p.accountId) || null })),
)
const depositDone = computed(() => goal.value?.depositDoneMonth === month.value)

function confirmDeposit() {
  const moves = []
  for (const p of plan.value) {
    if (!p.account) continue
    save('accounts', { ...p.account, balance: (Number(p.account.balance) || 0) + p.amount })
    moves.push({ accountId: p.account.id, amount: p.amount })
  }
  saveSetting('goal', { ...goal.value, depositDoneMonth: month.value, lastDeposit: { month: month.value, moves } })
  tap()
}

function undoDeposit() {
  const last = goal.value?.lastDeposit
  if (last?.month === month.value) {
    for (const m of last.moves || []) {
      const account = state.data.accounts.find((a) => a.id === m.accountId)
      if (account) save('accounts', { ...account, balance: (Number(account.balance) || 0) - m.amount })
    }
  }
  saveSetting('goal', { ...goal.value, depositDoneMonth: null, lastDeposit: null })
}

// ---------- Budget ----------

const budget = computed(() => budgetSummary(state.data.budget, month.value))
const budgetLines = computed(() =>
  state.data.budget
    .filter((l) => !l.until || l.until >= month.value)
    .sort((a, b) => (b.kind === 'revenu') - (a.kind === 'revenu') || (Number(b.amount) || 0) - (Number(a.amount) || 0)),
)
const showAllBudget = ref(false)
const BUDGET_SHORT = 6
const visibleBudget = computed(() => (showAllBudget.value ? budgetLines.value : budgetLines.value.slice(0, BUDGET_SHORT)))

const budgetNotes = computed(() => {
  const out = []
  if (monthly.value > 0 && state.data.budget.length) {
    const margin = budget.value.rest - monthly.value
    out.push(
      margin >= 0
        ? `Après ton versement de ${eur(monthly.value)}, il te reste ${eur(margin)} de marge.`
        : `Ton versement de ${eur(monthly.value)} dépasse ce qu'il te reste de ${eur(-margin)}.`,
    )
  }
  for (const l of budgetLines.value) {
    if (l.until && l.kind !== 'revenu') out.push(`${l.label} s'arrête fin ${monthLabel(l.until)} : ${eur(l.amount)} de plus chaque mois ensuite.`)
  }
  return out
})

// ---------- Échéances ----------

const scope = ref('soon')
const soon = computed(() => upcoming(state.data.deadlines, today.value, 90))
const everything = computed(() =>
  state.data.deadlines
    .map((d) => {
      const next = (d.repeat || 'none') === 'none' ? d.date : occurrences(d, today.value, addMonthKey(month.value, 14) + '-28')[0] || null
      return { deadline: d, next }
    })
    .sort((a, b) => String(a.next || '9').localeCompare(String(b.next || '9'))),
)

function amountNote(d) {
  if (!d.amount) return ''
  if (d.kind === 'recevoir') return `${eur(d.amount)} à recevoir`
  if (d.kind === 'payer') return `${eur(d.amount)} à payer`
  return eur(d.amount)
}

function when(date) {
  const gap = diffDays(today.value, date)
  return gap <= 14 ? relativeDay(date, today.value) : dateShort(date, today.value)
}

function repeatLabel(d) {
  const r = REPEATS.find((x) => x.id === (d.repeat || 'none'))
  return r && r.id !== 'none' ? r.label : ''
}

// ---------- Feuilles d'édition ----------

const sheet = reactive({ open: false, type: '', title: '', groups: [], value: {}, canDelete: false })

function openSheet(type, title, groups, value, canDelete) {
  Object.assign(sheet, { type, title, groups, value, canDelete, open: true })
}

function editGoal() {
  openSheet(
    'goal',
    'Objectif',
    [
      {
        fields: [
          { key: 'target', label: 'Montant visé', type: 'number', placeholder: '0', required: true },
          { key: 'date', label: 'Pour le', type: 'date' },
          { key: 'monthly', label: 'Versement par mois', type: 'number', placeholder: '0' },
        ],
        note: "La prévision ajoute ton versement chaque mois, plus les sommes « à recevoir » notées dans tes échéances.",
      },
    ],
    goal.value || {},
    false,
  )
}

function editAccount(account) {
  openSheet(
    'account',
    account ? account.name : 'Nouveau compte',
    [
      {
        fields: [
          { key: 'name', label: 'Nom', placeholder: 'Livret A', required: true },
          { key: 'kind', label: 'Type', type: 'select', options: KINDS, default: 'livret' },
          { key: 'balance', label: 'Solde', type: 'number', placeholder: '0' },
        ],
      },
      {
        fields: [
          { key: 'rate', label: 'Taux en %', type: 'number', placeholder: 'Aucun' },
          { key: 'cap', label: 'Plafond', type: 'number', placeholder: 'Aucun' },
        ],
        note: 'Le versement du mois va d\'abord sur le livret le mieux rémunéré, jusqu\'à son plafond.',
      },
      {
        fields: [{ key: 'inGoal', label: "Compte dans l'épargne", type: 'switch', default: true }],
        note: 'Désactive pour un compte courant : son solde ne sera pas ajouté à ton épargne.',
      },
    ],
    account || {},
    Boolean(account),
  )
}

function editLine(line) {
  openSheet(
    'budget',
    line ? line.label : 'Nouvelle ligne',
    [
      {
        fields: [
          { key: 'label', label: 'Nom', placeholder: 'Loyer', required: true },
          {
            key: 'kind',
            label: 'Type',
            type: 'select',
            default: 'depense',
            options: [
              { id: 'depense', label: 'Dépense' },
              { id: 'revenu', label: 'Revenu' },
            ],
          },
          { key: 'amount', label: 'Montant par mois', type: 'number', placeholder: '0', required: true },
        ],
      },
      {
        fields: [{ key: 'untilDate', label: "S'arrête en", type: 'date' }],
        note: 'Laisse vide si la ligne continue sans date de fin. Seul le mois compte.',
      },
    ],
    line ? { ...line, untilDate: line.until ? `${line.until}-01` : '' } : {},
    Boolean(line),
  )
}

function editDeadline(deadline) {
  openSheet(
    'deadline',
    deadline ? deadline.title : 'Nouvelle échéance',
    [
      {
        fields: [
          { key: 'title', label: 'Titre', placeholder: 'Facture, rappel…', required: true },
          { key: 'date', label: 'Date', type: 'date', required: true, default: today.value },
          { key: 'repeat', label: 'Répétition', type: 'select', options: REPEATS, default: 'none' },
          { key: 'until', label: "Jusqu'au", type: 'date' },
        ],
      },
      {
        fields: [
          {
            key: 'kind',
            label: 'Type',
            type: 'select',
            default: 'rappel',
            options: [
              { id: 'rappel', label: 'Simple rappel' },
              { id: 'payer', label: 'À payer' },
              { id: 'recevoir', label: 'À recevoir' },
            ],
          },
          { key: 'amount', label: 'Montant', type: 'number', placeholder: 'Aucun' },
        ],
        note: "Une somme « à recevoir » est ajoutée à ta prévision d'épargne tant qu'elle n'est pas cochée.",
      },
      { fields: [{ key: 'note', label: 'Notes', type: 'textarea', rows: 3 }] },
    ],
    deadline || {},
    Boolean(deadline),
  )
}

function onSave(value) {
  if (sheet.type === 'goal') {
    saveSetting('goal', value)
  } else if (sheet.type === 'account') {
    save('accounts', { ...value, balance: value.balance ?? 0 })
  } else if (sheet.type === 'budget') {
    const { untilDate, ...line } = value
    save('budget', { ...line, until: untilDate ? untilDate.slice(0, 7) : '' })
  } else if (sheet.type === 'deadline') {
    save('deadlines', value)
  }
}

function onDelete() {
  const collection = { account: 'accounts', budget: 'budget', deadline: 'deadlines' }[sheet.type]
  if (collection && sheet.value.id) remove(collection, sheet.value.id)
}

function accountNote(a) {
  const parts = []
  if (a.rate) parts.push(percent(a.rate))
  if (a.cap) parts.push(`plafond ${eur(a.cap)}`)
  if (a.inGoal === false) parts.push('hors épargne')
  return parts.join(', ')
}

function fill(a) {
  return a.cap ? Math.min(1, (Number(a.balance) || 0) / a.cap) : 0
}
</script>

<template>
  <div class="view">
    <h1 v-reveal class="large-title">Argent</h1>

    <section v-reveal class="hero">
      <p class="display"><AnimatedNumber :value="total" :format="eur" :from="0" /></p>
      <p class="subhead secondary hero-sub">
        <template v-if="hasGoal">
          épargnés sur {{ eur(goal.target) }} visés<template v-if="goal.date"> pour le {{ dateShort(goal.date, today) }}</template>
        </template>
        <template v-else>épargnés</template>
      </p>

      <TrendChart
        v-if="monthly > 0 || inflows.length"
        class="hero-chart"
        :points="chartPoints"
        :format="eur"
        :target="hasGoal ? Number(goal.target) : null"
        :target-label="hasGoal ? `Objectif ${eur(goal.target)}` : ''"
        :mark-index="goalIndex >= 0 ? goalIndex + 1 : null"
        :mark-label="goalIndex >= 0 ? dateShort(goal.date, today) : ''"
        :summary="chartSummary"
        :columns="['Moment', 'Épargne prévue']"
        zero
      />

      <div v-if="verdict" class="verdict">
        <p class="headline">{{ verdict.main }}</p>
        <p v-if="verdict.rest" class="subhead secondary">{{ verdict.rest }}</p>
      </div>
      <button class="btn-plain hero-edit" type="button" @click="editGoal">
        {{ hasGoal ? "Modifier l'objectif" : 'Fixer un objectif' }}
      </button>
    </section>

    <section v-if="monthly > 0 && accounts.length" v-reveal class="section">
      <div class="section-head">
        <h2 class="title2">Versement de {{ monthName(month) }}</h2>
      </div>
      <Transition name="swap" mode="out-in">
        <div v-if="depositDone" key="done" class="group">
          <div class="row with-lead">
            <span class="lead drawn" style="color: var(--money)"><Icon name="check" :size="20" /></span>
            <div class="row-main">
              <div class="row-title">Versement enregistré</div>
              <div class="row-sub">Le prochain sera proposé en {{ monthName(addMonthKey(month, 1)) }}.</div>
            </div>
          </div>
          <button class="row link-row" type="button" @click="undoDeposit">Annuler ce versement</button>
        </div>
        <div v-else key="plan" class="group">
          <div v-for="p in plan" :key="p.accountId || 'reste'" class="row">
            <div class="row-main">
              <div class="row-title">{{ p.account ? p.account.name : 'À placer ailleurs' }}</div>
              <div class="row-sub">
                <template v-if="p.account">
                  {{ p.account.rate ? percent(p.account.rate) : 'Livret' }}<template v-if="p.account.cap">, encore {{ eur(p.account.cap - p.account.balance) }} de place</template>
                </template>
                <template v-else>Tes livrets sont pleins : ajoute ce montant toi-même au compte choisi.</template>
              </div>
            </div>
            <span class="row-value">{{ eur(p.amount) }}</span>
          </div>
          <div class="row row-action">
            <button class="btn btn-filled btn-block" type="button" @click="confirmDeposit">C'est versé</button>
          </div>
        </div>
      </Transition>
      <p v-if="!depositDone" class="section-note footnote">Les soldes de tes livrets sont mis à jour quand tu confirmes.</p>
    </section>

    <section v-reveal class="section">
      <div class="section-head">
        <h2 class="title2">Comptes</h2>
      </div>
      <div class="group">
        <button v-for="a in accounts" :key="a.id" class="row" type="button" @click="editAccount(a)">
          <span class="row-main">
            <span class="row-title">{{ a.name }}</span>
            <span v-if="accountNote(a)" class="row-sub">{{ accountNote(a) }}</span>
            <span v-if="a.cap" class="meter account-meter"><i :style="{ '--fill': fill(a) }" /></span>
          </span>
          <AnimatedNumber class="row-value" :value="Number(a.balance) || 0" :format="eur" />
          <Icon class="chevron" name="chevron" :size="14" />
        </button>
        <button class="row link-row" type="button" @click="editAccount(null)">Ajouter un compte</button>
      </div>
    </section>

    <section v-reveal class="section">
      <div class="section-head">
        <h2 class="title2">Budget du mois</h2>
      </div>
      <div v-if="budgetLines.length" class="group figures">
        <div>
          <span class="footnote secondary">Revenus</span>
          <AnimatedNumber :value="budget.income" :format="eur" />
        </div>
        <div>
          <span class="footnote secondary">Dépenses</span>
          <AnimatedNumber :value="budget.expenses" :format="eur" />
        </div>
        <div>
          <span class="footnote secondary">Reste</span>
          <AnimatedNumber class="headline" :class="{ late: budget.rest < 0 }" :value="budget.rest" :format="eur" />
        </div>
      </div>
      <p v-for="n in budgetNotes" :key="n" class="section-note footnote">{{ n }}</p>
      <div class="group budget-lines">
        <button v-for="l in visibleBudget" :key="l.id" class="row" type="button" @click="editLine(l)">
          <span class="row-main">
            <span class="row-title">{{ l.label }}</span>
            <span v-if="l.until" class="row-sub">Jusqu'à fin {{ monthLabel(l.until) }}</span>
          </span>
          <span class="row-value" :class="{ income: l.kind === 'revenu' }">
            {{ l.kind === 'revenu' ? '+' : '' }}{{ eur(l.amount) }}
          </span>
        </button>
        <button
          v-if="budgetLines.length > BUDGET_SHORT"
          class="row link-row"
          type="button"
          @click="showAllBudget = !showAllBudget"
        >
          {{ showAllBudget ? 'Réduire la liste' : `Afficher les ${budgetLines.length - BUDGET_SHORT} autres lignes` }}
        </button>
        <button class="row link-row" type="button" @click="editLine(null)">Ajouter une ligne</button>
      </div>
    </section>

    <section v-reveal class="section">
      <div class="section-head">
        <h2 class="title2">Échéances</h2>
      </div>
      <div class="segmented scope" role="group" aria-label="Période affichée" :style="{ '--i': scope === 'soon' ? 0 : 1, '--n': 2 }">
        <button type="button" :aria-pressed="scope === 'soon'" @click="scope = 'soon'">90 jours</button>
        <button type="button" :aria-pressed="scope === 'all'" @click="scope = 'all'">Toutes</button>
      </div>

      <Transition name="swap" mode="out-in">
      <div v-if="scope === 'soon'" key="soon" class="group">
        <p v-if="!soon.length" class="empty">Rien dans les 90 prochains jours.</p>
        <div v-for="d in soon" :key="`${d.id}-${d.date}`" class="row with-lead" :class="{ 'is-done': d.done }">
          <button
            class="check"
            type="button"
            role="checkbox"
            :aria-checked="d.done ? 'true' : 'false'"
            :aria-label="`Fait : ${d.title}`"
            @click="toggleDeadline(d.deadline, d.date)"
          >
            <span class="check-ring"><Icon name="check" :size="14" /></span>
          </button>
          <button class="row-main row-tap" type="button" @click="editDeadline(d.deadline)">
            <span class="row-title">{{ d.title }}</span>
            <span v-if="amountNote(d.deadline)" class="row-sub">{{ amountNote(d.deadline) }}</span>
          </button>
          <span class="row-value secondary" :class="{ late: d.overdue }">{{ when(d.date) }}</span>
        </div>
        <button class="row link-row" type="button" @click="editDeadline(null)">Ajouter une échéance</button>
      </div>

      <div v-else key="all" class="group">
        <p v-if="!everything.length" class="empty">Aucune échéance enregistrée.</p>
        <button v-for="e in everything" :key="e.deadline.id" class="row" type="button" @click="editDeadline(e.deadline)">
          <span class="row-main">
            <span class="row-title">{{ e.deadline.title }}</span>
            <span v-if="repeatLabel(e.deadline) || amountNote(e.deadline)" class="row-sub">
              {{ [repeatLabel(e.deadline), amountNote(e.deadline)].filter(Boolean).join(', ') }}
            </span>
          </span>
          <span class="row-value secondary">{{ e.next ? dateShort(e.next, today) : 'Terminée' }}</span>
          <Icon class="chevron" name="chevron" :size="14" />
        </button>
        <button class="row link-row" type="button" @click="editDeadline(null)">Ajouter une échéance</button>
      </div>
      </Transition>
    </section>

    <EditSheet
      v-model:open="sheet.open"
      :title="sheet.title"
      :groups="sheet.groups"
      :value="sheet.value"
      :can-delete="sheet.canDelete"
      @save="onSave"
      @delete="onDelete"
    />
  </div>
</template>

<style>
/* La coche de confirmation se dessine. */
.drawn path {
  stroke-dasharray: 1;
  animation: draw-check 380ms ease-out 160ms both;
}

@keyframes draw-check {
  from {
    stroke-dashoffset: 1;
  }
}

.hero {
  margin-top: 1.25rem;
}

.hero .display {
  margin: 0;
}

.hero-sub {
  margin: 0.375rem 0 0;
}

.hero-chart {
  margin-top: 1.5rem;
}

.verdict {
  margin-top: 0.5rem;
  max-width: 34rem;
}

.verdict p {
  margin: 0;
}

.verdict p + p {
  margin-top: 0.25rem;
}

.hero-edit {
  padding-left: 0;
}

.account-meter {
  display: block;
  margin-top: 0.4375rem;
}

.figures {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 0.75rem 1rem;
  gap: 0.75rem;
}

.figures > div {
  display: grid;
  gap: 0.125rem;
}

.budget-lines {
  margin-top: 0.75rem;
}

.income {
  color: var(--money);
}

.scope {
  margin-bottom: 0.75rem;
}

.row-action {
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
}

.row-tap {
  text-align: left;
  align-self: stretch;
}

.row-tap:active {
  opacity: 0.5;
}
</style>
