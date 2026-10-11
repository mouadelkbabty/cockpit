// Stockage synchronisé : Firestore + connexion Google. Chargé seulement si une configuration existe.
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, onSnapshot, setDoc, deleteDoc,
} from 'firebase/firestore'

export function createCloud(config) {
  const app = initializeApp(config)
  const auth = getAuth(app)
  const db = initializeFirestore(app, {
    // Copie locale : le site reste consultable hors connexion et se resynchronise ensuite.
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  })

  return {
    onUser(cb) {
      return onAuthStateChanged(auth, cb)
    },
    async signIn() {
      const provider = new GoogleAuthProvider()
      try {
        await signInWithPopup(auth, provider)
      } catch (e) {
        if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, provider)
        } else if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') {
          throw e
        }
      }
    },
    signOut() {
      return signOut(auth)
    },
    backendFor(uid) {
      const col = (name) => collection(db, 'users', uid, name)
      return {
        kind: 'cloud',
        subscribe(name, cb, onError) {
          return onSnapshot(col(name), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError)
        },
        set(name, id, data) {
          const { id: _drop, ...rest } = data
          return setDoc(doc(col(name), id), rest)
        },
        remove(name, id) {
          return deleteDoc(doc(col(name), id))
        },
      }
    },
  }
}
