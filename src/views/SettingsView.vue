<script setup>
import { computed, ref } from 'vue'
import { state, signOut, exportAll, importAll, clearAll, COLLECTIONS } from '../store/index.js'
import { today } from '../lib/now.js'
import BottomSheet from '../components/BottomSheet.vue'

const cloud = computed(() => state.mode === 'cloud')
const count = computed(() => COLLECTIONS.reduce((n, c) => n + state.data[c].length, 0))
const message = ref('')
const picker = ref(null)
const erasing = ref(false)

function download() {
  const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cockpit-${today.value}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  message.value = 'Fichier exporté. Garde-le dans un endroit privé.'
}

async function onFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  try {
    const n = importAll(JSON.parse(await file.text()))
    message.value = `${n} éléments importés.`
  } catch (err) {
    message.value = err instanceof SyntaxError ? "Ce fichier n'est pas lisible : il faut un export Cockpit au format JSON." : err.message
  }
}

function erase() {
  clearAll()
  erasing.value = false
  message.value = 'Toutes les données ont été effacées.'
}
</script>

<template>
  <div class="view">
    <h1 class="large-title">Réglages</h1>

    <section class="section">
      <div class="section-head">
        <h2 class="title2">Synchronisation</h2>
      </div>
      <div class="group">
        <div class="row">
          <div class="row-main">
            <div class="row-title">{{ cloud ? 'Activée' : 'Désactivée' }}</div>
            <div class="row-sub">
              {{
                cloud
                  ? 'Tes données sont dans ton compte et se mettent à jour sur tous tes appareils.'
                  : 'Tes données restent dans ce navigateur, sur cet appareil.'
              }}
            </div>
          </div>
        </div>
        <template v-if="cloud && state.user">
          <div class="row">
            <div class="row-main">
              <div class="row-title">{{ state.user.name || 'Compte' }}</div>
              <div class="row-sub">{{ state.user.email }}</div>
            </div>
          </div>
          <button class="row link-row" type="button" @click="signOut">Se déconnecter</button>
        </template>
      </div>
      <p v-if="!cloud" class="section-note footnote">
        Pour retrouver les mêmes données sur ton téléphone et ton ordinateur, suis le guide « docs/firebase.md » du dépôt.
        En attendant, tu peux passer d'un appareil à l'autre avec un export puis un import.
      </p>
    </section>

    <section class="section">
      <div class="section-head">
        <h2 class="title2">Données</h2>
        <span class="subhead secondary num">{{ count }} éléments</span>
      </div>
      <div class="group">
        <button class="row link-row" type="button" @click="picker.click()">Importer un fichier</button>
        <button class="row link-row" type="button" :disabled="!count" @click="download">Exporter mes données</button>
      </div>
      <input ref="picker" class="visually-hidden" type="file" accept="application/json,.json" tabindex="-1" @change="onFile" />
      <p class="section-note footnote" role="status">
        {{ message || "L'import ajoute les éléments du fichier et remplace ceux qui portent le même identifiant." }}
      </p>
    </section>

    <section class="section">
      <div class="group">
        <button class="row btn-danger" type="button" :disabled="!count" @click="erasing = true">Tout effacer</button>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2 class="title2">Sur ton téléphone</h2>
      </div>
      <p class="section-note subhead install">
        Sur iPhone, ouvre ce site dans Safari, touche Partager puis « Sur l'écran d'accueil ». Sur Android, ouvre le menu
        de Chrome puis « Installer l'application ». Cockpit s'ouvre ensuite comme une application, même sans réseau.
      </p>
    </section>

    <BottomSheet v-model:open="erasing" label="Tout effacer">
      <template #left>
        <button class="btn-plain" type="button" @click="erasing = false">Annuler</button>
      </template>
      <p class="erase-text">
        Comptes, budget, échéances, candidatures, séances et pesées seront supprimés{{ cloud ? ' de ton compte, sur tous tes appareils' : ' de cet appareil' }}.
        Exporte tes données avant si tu veux pouvoir revenir en arrière.
      </p>
      <button class="btn btn-block erase-btn" type="button" @click="erase">Effacer {{ count }} éléments</button>
    </BottomSheet>
  </div>
</template>

<style>
.row:disabled {
  opacity: 0.35;
  pointer-events: none;
}

.install {
  margin-top: 0;
}

.erase-text {
  margin: 0.25rem 0.25rem 1.25rem;
  color: var(--label2);
}

.erase-btn {
  background: var(--alert);
  color: #000;
}
</style>
