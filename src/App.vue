<script setup>
import { ref, computed, watch, provide, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { state, signIn } from './store/index.js'
import Icon from './components/Icon.vue'
import TodayView from './views/TodayView.vue'
import MoneyView from './views/MoneyView.vue'
import JobsView from './views/JobsView.vue'
import SportView from './views/SportView.vue'
import SettingsView from './views/SettingsView.vue'

const TABS = [
  { id: 'today', hash: '', label: "Aujourd'hui", icon: 'today', color: 'var(--label)', view: TodayView },
  { id: 'money', hash: 'argent', label: 'Argent', icon: 'money', color: 'var(--money)', view: MoneyView },
  { id: 'jobs', hash: 'emploi', label: 'Emploi', icon: 'jobs', color: 'var(--jobs)', view: JobsView },
  { id: 'sport', hash: 'sport', label: 'Sport', icon: 'sport', color: 'var(--sport)', view: SportView },
  { id: 'settings', hash: 'reglages', label: 'Réglages', icon: 'settings', color: 'var(--label)', view: SettingsView },
]

function tabFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, '')
  return (TABS.find((t) => t.hash === hash) || TABS[0]).id
}

const icon = `${import.meta.env.BASE_URL}icon.svg`
const current = ref(tabFromHash())
const tab = computed(() => TABS.find((t) => t.id === current.value))
const scrolled = ref(false)
const view = ref(null)

function go(id) {
  const target = TABS.find((t) => t.id === id)
  if (!target) return
  if (id === current.value) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  window.location.hash = target.hash ? `#/${target.hash}` : '#/'
}
provide('go', go)

function onHash() {
  current.value = tabFromHash()
}

function onScroll() {
  scrolled.value = window.scrollY > 44
}

watch(
  tab,
  (t) => {
    document.documentElement.style.setProperty('--tint', t.color)
    document.title = t.id === 'today' ? 'Cockpit' : `${t.label} · Cockpit`
    nextTick(() => {
      window.scrollTo(0, 0)
      onScroll()
    })
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('hashchange', onHash)
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('hashchange', onHash)
  window.removeEventListener('scroll', onScroll)
})

const needsSignIn = computed(() => state.mode === 'cloud' && state.authReady && !state.user)
const loading = computed(() => state.mode === 'cloud' && (!state.authReady || (state.user && !state.ready)))
</script>

<template>
  <div v-if="needsSignIn" class="gate">
    <div class="gate-inner">
      <img :src="icon" width="72" height="72" alt="" />
      <h1 class="large-title">Cockpit</h1>
      <p class="secondary">Connecte-toi pour retrouver tes données sur tous tes appareils.</p>
      <button class="btn btn-filled btn-block" type="button" @click="signIn">Se connecter avec Google</button>
      <p v-if="state.error" class="banner footnote" role="alert">{{ state.error }}</p>
    </div>
  </div>

  <div v-else class="shell">
    <header class="topbar" :class="{ scrolled }">
      <span />
      <span class="topbar-title" aria-hidden="true">{{ tab.label }}</span>
      <div class="topbar-actions">
        <button v-if="view?.add" class="icon-btn" type="button" :aria-label="view.addLabel || 'Ajouter'" @click="view.add()">
          <Icon name="plus" />
        </button>
        <button
          v-if="current !== 'settings'"
          class="icon-btn settings-btn"
          type="button"
          aria-label="Réglages"
          @click="go('settings')"
        >
          <Icon name="settings" />
        </button>
      </div>
    </header>

    <nav class="tabbar" aria-label="Sections">
      <div class="tabbar-brand">Cockpit</div>
      <button
        v-for="t in TABS"
        :key="t.id"
        class="tab"
        :class="{ 'tab-settings': t.id === 'settings' }"
        type="button"
        :style="{ '--tab-color': t.color }"
        :aria-current="current === t.id ? 'page' : undefined"
        @click="go(t.id)"
      >
        <Icon :name="t.icon" />
        <span>{{ t.label }}</span>
      </button>
    </nav>

    <main class="main">
      <p v-if="state.error" class="banner footnote" role="alert">
        {{ state.error }}
        <button class="btn-plain footnote" type="button" @click="state.error = null">Masquer</button>
      </p>
      <p v-if="loading" class="secondary loading">Chargement de tes données</p>
      <component :is="tab.view" v-else ref="view" />
    </main>
  </div>
</template>

<style>
.gate {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 2rem 1.5rem;
}

.gate-inner {
  width: 100%;
  max-width: 22rem;
  display: grid;
  gap: 0.75rem;
  justify-items: start;
}

.gate-inner img {
  border-radius: 1rem;
  margin-bottom: 0.5rem;
}

.gate-inner .btn {
  margin-top: 0.75rem;
}

.loading {
  margin-top: 4rem;
  text-align: center;
}

.banner .btn-plain {
  min-height: 0;
  padding: 0;
  margin-left: 0.5rem;
  text-decoration: underline;
  color: inherit;
}
</style>
