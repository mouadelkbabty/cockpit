import { monthKey, addMonthKey } from './dates.js'

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

export function savingsTotal(accounts) {
  return accounts.filter((a) => a.inGoal !== false).reduce((s, a) => s + num(a.balance), 0)
}

// Une ligne avec `until` ('AAAA-MM') compte jusqu'à ce mois inclus.
export function budgetSummary(lines, month) {
  let income = 0
  let expenses = 0
  for (const l of lines) {
    if (l.until && l.until < month) continue
    if (l.kind === 'revenu') income += num(l.amount)
    else expenses += num(l.amount)
  }
  return { income, expenses, rest: income - expenses }
}

// Répartit un versement : livret au meilleur taux d'abord, dans la limite de son plafond.
export function nextDeposit(accounts, amount) {
  let left = num(amount)
  if (left <= 0) return []
  const livrets = accounts
    .filter((a) => a.kind === 'livret' && a.inGoal !== false)
    .sort((a, b) => num(b.rate) - num(a.rate))
  const out = []
  for (const a of livrets) {
    if (left <= 0) break
    const room = a.cap == null || a.cap === '' ? Infinity : Math.max(0, num(a.cap) - num(a.balance))
    const put = Math.min(room, left)
    if (put > 0) {
      out.push({ accountId: a.id, amount: put })
      left -= put
    }
  }
  if (left > 0) out.push({ accountId: null, amount: left })
  return out
}

// Montant prévu à la fin de chaque mois.
// inflows : rentrées ponctuelles [{date, amount}] ; freed : dépenses qui s'arrêtent [{from:'AAAA-MM', amount}].
export function projection({ total, monthly, fromMonth, months, depositDoneMonth = null, inflows = [], freed = [] }) {
  const points = []
  let amount = num(total)
  for (let i = 0; i < months; i++) {
    const month = addMonthKey(fromMonth, i)
    if (!(i === 0 && depositDoneMonth === month)) {
      amount += num(monthly)
      for (const f of freed) if (f.from <= month) amount += num(f.amount)
    }
    for (const inflow of inflows) if (monthKey(inflow.date) === month) amount += num(inflow.amount)
    points.push({ month, amount })
  }
  return points
}

export function goalStatus(points, goal, monthly, depositDoneMonth = null) {
  const target = num(goal?.target)
  const reached = points.find((p) => p.amount >= target)
  const dateMonth = goal?.date ? monthKey(goal.date) : null
  let amountAtDate = null
  let missingAtDate = null
  let neededMonthly = null
  if (dateMonth) {
    const idx = points.findIndex((p) => p.month === dateMonth)
    if (idx >= 0) {
      amountAtDate = points[idx].amount
      missingAtDate = Math.max(0, target - amountAtDate)
      const deposits = idx + 1 - (depositDoneMonth === points[0].month ? 1 : 0)
      if (deposits > 0) neededMonthly = Math.ceil(num(monthly) + missingAtDate / deposits)
    }
  }
  return { reachedMonth: reached ? reached.month : null, amountAtDate, missingAtDate, neededMonthly }
}
