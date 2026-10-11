// Apparition au défilement : un bloc monte et se précise la première fois qu'il entre à l'écran.
// Les blocs qui arrivent ensemble se suivent avec un léger décalage, du haut vers le bas.
// Avec « réduire les animations », rien ne bouge : le contenu est là d'emblée.

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

let observer = null

function settle(el) {
  el.classList.remove('reveal', 'reveal-in')
  el.style.transitionDelay = ''
}

function show(el, delay) {
  el.style.transitionDelay = `${delay}ms`
  el.classList.add('reveal-in')
  // Une fois en place, le bloc redevient un élément ordinaire (plus de transformation résiduelle).
  window.setTimeout(() => settle(el), delay + 900)
}

function ensureObserver() {
  if (observer) return observer
  observer = new IntersectionObserver(
    (entries) => {
      const entering = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      entering.forEach((entry, i) => {
        observer.unobserve(entry.target)
        show(entry.target, Math.min(i * 55, 330))
      })
    },
    { rootMargin: '0px 0px -5% 0px', threshold: 0.01 },
  )
  return observer
}

export default {
  mounted(el) {
    if (reduced() || !('IntersectionObserver' in window)) return
    el.classList.add('reveal')
    ensureObserver().observe(el)
  },
  unmounted(el) {
    observer?.unobserve(el)
  },
}
