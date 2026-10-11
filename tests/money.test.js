import { describe, it, expect } from 'vitest'
import { savingsTotal, budgetSummary, nextDeposit, projection, goalStatus } from '../src/lib/money.js'

const accounts = [
  { id: 'lj', name: 'Livret 1', kind: 'livret', balance: 500, cap: 1600, rate: 3.75 },
  { id: 'lep', name: 'Livret 2', kind: 'livret', balance: 0, cap: 10000, rate: 2.5 },
  { id: 'cc', name: 'Compte courant', kind: 'courant', balance: 300, inGoal: false },
]

describe('savingsTotal', () => {
  it('additionne les comptes qui comptent dans l’objectif', () => {
    expect(savingsTotal(accounts)).toBe(500)
  })
  it('vaut 0 sans compte', () => {
    expect(savingsTotal([])).toBe(0)
  })
})

describe('budgetSummary', () => {
  const lines = [
    { id: 'a', label: 'Salaire', kind: 'revenu', amount: 2000 },
    { id: 'b', label: 'Loyer', kind: 'depense', amount: 600 },
    { id: 'c', label: 'Crédit', kind: 'depense', amount: 300, until: '2027-03' },
  ]
  it('calcule revenus, dépenses et reste du mois', () => {
    expect(budgetSummary(lines, '2026-10')).toEqual({ income: 2000, expenses: 900, rest: 1100 })
  })
  it('compte une ligne jusqu’à son dernier mois inclus, plus après', () => {
    expect(budgetSummary(lines, '2027-03').expenses).toBe(900)
    expect(budgetSummary(lines, '2027-04').expenses).toBe(600)
  })
})

describe('nextDeposit', () => {
  it('remplit d’abord le livret au meilleur taux', () => {
    expect(nextDeposit(accounts, 500)).toEqual([{ accountId: 'lj', amount: 500 }])
  })
  it('déborde sur le livret suivant quand le plafond est atteint', () => {
    const acc = [{ ...accounts[0], balance: 1500 }, accounts[1]]
    expect(nextDeposit(acc, 500)).toEqual([
      { accountId: 'lj', amount: 100 },
      { accountId: 'lep', amount: 400 },
    ])
  })
  it('signale ce qui ne rentre nulle part', () => {
    const acc = [{ ...accounts[0], balance: 1600 }]
    expect(nextDeposit(acc, 200)).toEqual([{ accountId: null, amount: 200 }])
  })
  it('ne propose rien pour un montant nul', () => {
    expect(nextDeposit(accounts, 0)).toEqual([])
  })
})

describe('projection', () => {
  it('ajoute le versement à la fin de chaque mois, mois en cours compris', () => {
    const pts = projection({ total: 500, monthly: 500, fromMonth: '2026-10', months: 3 })
    expect(pts).toEqual([
      { month: '2026-10', amount: 1000 },
      { month: '2026-11', amount: 1500 },
      { month: '2026-12', amount: 2000 },
    ])
  })
  it('saute le mois en cours si le versement est déjà fait', () => {
    const pts = projection({ total: 1000, monthly: 500, fromMonth: '2026-10', months: 2, depositDoneMonth: '2026-10' })
    expect(pts.map((p) => p.amount)).toEqual([1000, 1500])
  })
  it('ajoute les rentrées prévues le mois où elles tombent', () => {
    const pts = projection({
      total: 500, monthly: 500, fromMonth: '2026-10', months: 3,
      inflows: [{ date: '2026-12-20', amount: 400 }],
    })
    expect(pts[2].amount).toBe(2400)
  })
  it('augmente le versement quand une dépense se termine', () => {
    const pts = projection({
      total: 0, monthly: 500, fromMonth: '2027-03', months: 3,
      freed: [{ from: '2027-04', amount: 300 }],
    })
    expect(pts.map((p) => p.amount)).toEqual([500, 1300, 2100])
  })
})

describe('goalStatus', () => {
  const pts = projection({ total: 500, monthly: 500, fromMonth: '2026-10', months: 12 })
  it('donne le mois où l’objectif est atteint', () => {
    expect(goalStatus(pts, { target: 4000, date: '2026-12-31' }, 500).reachedMonth).toBe('2027-04')
  })
  it('donne le montant à la date visée et ce qui manque', () => {
    const s = goalStatus(pts, { target: 4000, date: '2026-12-31' }, 500)
    expect(s.amountAtDate).toBe(2000)
    expect(s.missingAtDate).toBe(2000)
  })
  it('calcule le versement mensuel nécessaire pour tenir la date', () => {
    const s = goalStatus(pts, { target: 4000, date: '2026-12-31' }, 500)
    expect(s.neededMonthly).toBe(1167)
  })
  it('dit quand l’objectif n’est pas atteint sur la période', () => {
    const short = projection({ total: 0, monthly: 10, fromMonth: '2026-10', months: 3 })
    expect(goalStatus(short, { target: 4000, date: '2026-12-31' }, 10).reachedMonth).toBe(null)
  })
})
