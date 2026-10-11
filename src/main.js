import { createApp } from 'vue'
// La feuille de base passe en premier : les styles des composants peuvent ainsi la préciser.
import './styles.css'
import App from './App.vue'
import { init } from './store/index.js'

init()
createApp(App).mount('#app')
