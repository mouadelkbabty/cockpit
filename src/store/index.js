import { reactive, computed } from 'vue'
import firebaseConfig from '../firebase-config.js'
import { createLocalBackend } from './local.js'

export const COLLECTIONS = ['settings', 'accounts', 'budget', 'deadlines', 'applications', 'sessions', 'weights']

export const state = reactive({
  mode: firebaseConfig ? 'cloud' : 'local',
  authReady: !firebaseConfig,
  user: null,
  ready: false,
  error: null,
  data: Object.fromEntries(COLLECTIONS.map((c) => [c, []])),
})

let backend = null
let cloud = null
let stops = []
const loaded = new Set()

function detach() {
  for (const stop of stops) stop()
  stops = []
  loaded.clear()
  backend = null
  state.ready = false
  for (const c of COLLECTIONS) state.data[c] = []
}

function attach(next) {
  detach()
  backend = next
  for (const c of COLLECTIONS) {
    stops.push(
      next.subscribe(
        c,
        (docs) => {
          state.data[c] = docs
          loaded.add(c)
          if (loaded.size === COLLECTIONS.length) state.ready = true
        },
        (err) => {
          state.error = describeError(err)
        },
      ),
    )
  }
}

function describeError(err) {
  if (err?.code === 'permission-denied') return "Ce compte n'a pas accès aux données. Vérifie l'adresse autorisée dans les règles Firestore."
  if (err?.code === 'auth/unauthorized-domain') return "Ce site n'est pas dans les domaines autorisés de Firebase (Authentication, Paramètres, Domaines autorisés)."
  return err?.message || String(err)
}

export async function init() {
  if (!firebaseConfig) {
    attach(createLocalBackend(window.localStorage))
    window.addEventListener('storage', (e) => {
      if (e.key?.startsWith('cockpit:')) backend?.refresh?.(e.key.slice('cockpit:'.length))
    })
    return
  }
  try {
    const { createCloud } = await import('./firestore.js')
    cloud = createCloud(firebaseConfig)
    cloud.onUser((user) => {
      state.authReady = true
      if (user) {
        state.user = { uid: user.uid, name: user.displayName || '', email: user.email || '' }
        attach(cloud.backendFor(user.uid))
      } else {
        state.user = null
        detach()
      }
    })
  } catch (err) {
    state.authReady = true
    state.error = describeError(err)
  }
}

export async function signIn() {
  state.error = null
  try {
    await cloud.signIn()
  } catch (err) {
    state.error = describeError(err)
  }
}

export function signOut() {
  return cloud?.signOut()
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function clean(doc) {
  return JSON.parse(JSON.stringify(doc))
}

// Enregistre un document ; renvoie son identifiant. Hors connexion, l'écriture part plus tard.
export function save(collection, doc) {
  const id = doc.id || newId()
  Promise.resolve(backend.set(collection, id, clean({ ...doc, id }))).catch((err) => {
    state.error = describeError(err)
  })
  return id
}

export function remove(collection, id) {
  Promise.resolve(backend.remove(collection, id)).catch((err) => {
    state.error = describeError(err)
  })
}

export function setting(id) {
  return computed(() => state.data.settings.find((s) => s.id === id) || null)
}

export function saveSetting(id, data) {
  return save('settings', { ...data, id })
}

export function exportAll() {
  return { app: 'cockpit', version: 1, exportedAt: new Date().toISOString(), data: clean(state.data) }
}

// Importe un fichier d'export : chaque document remplace celui qui porte le même identifiant.
export function importAll(file) {
  if (file?.app !== 'cockpit' || typeof file.data !== 'object') throw new Error("Ce fichier n'est pas un export Cockpit.")
  let count = 0
  for (const c of COLLECTIONS) {
    for (const doc of file.data[c] || []) {
      if (!doc || typeof doc !== 'object') continue
      save(c, doc)
      count++
    }
  }
  return count
}

export function clearAll() {
  for (const c of COLLECTIONS) for (const doc of [...state.data[c]]) remove(c, doc.id)
}

export function isEmpty() {
  return COLLECTIONS.every((c) => state.data[c].length === 0)
}
