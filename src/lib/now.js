import { ref } from 'vue'
import { todayISO } from './dates.js'

// Date du jour, remise à jour quand l'onglet redevient visible (l'application peut rester ouverte plusieurs jours).
export const today = ref(todayISO())

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) today.value = todayISO()
  })
}
