import { createApp } from 'vue'
// La feuille de base passe en premier : les styles des composants peuvent ainsi la préciser.
import './styles.css'
import App from './App.vue'
import { init } from './store/index.js'
import reveal from './directives/reveal.js'

init()
createApp(App).directive('reveal', reveal).mount('#app')

// Sur iOS, :active ne s'applique au toucher que si un écouteur tactile existe.
document.addEventListener('touchstart', () => {}, { passive: true })
