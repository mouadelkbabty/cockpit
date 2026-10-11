import { computed } from 'vue'
import { state, setting } from './index.js'
import { today } from '../lib/now.js'
import { outlook } from '../lib/money.js'

// Vue d'ensemble de l'épargne, recalculée dès qu'un compte, l'objectif ou une échéance change.
export function useSavings() {
  const goal = setting('goal')
  const savings = computed(() =>
    outlook({ accounts: state.data.accounts, goal: goal.value, deadlines: state.data.deadlines, today: today.value }),
  )
  return { goal, savings }
}
