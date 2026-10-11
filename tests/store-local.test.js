import { describe, it, expect } from 'vitest'
import { createLocalBackend } from '../src/store/local.js'

function fakeStorage() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}

describe('stockage local', () => {
  it('enregistre, relit et supprime des documents', async () => {
    const b = createLocalBackend(fakeStorage())
    await b.set('accounts', 'lj', { name: 'Livret Jeune', balance: 500 })
    await b.set('accounts', 'lep', { name: 'LEP', balance: 0 })
    let seen = null
    const stop = b.subscribe('accounts', (docs) => { seen = docs })
    expect(seen.map((d) => d.id).sort()).toEqual(['lep', 'lj'])
    await b.remove('accounts', 'lep')
    expect(seen.map((d) => d.id)).toEqual(['lj'])
    stop()
    await b.set('accounts', 'x', { name: 'X' })
    expect(seen.map((d) => d.id)).toEqual(['lj'])
  })
  it('garde les données entre deux ouvertures', async () => {
    const storage = fakeStorage()
    await createLocalBackend(storage).set('budget', 'a', { label: 'Loyer', amount: 600 })
    let seen = null
    createLocalBackend(storage).subscribe('budget', (docs) => { seen = docs })
    expect(seen).toEqual([{ id: 'a', label: 'Loyer', amount: 600 }])
  })
  it('sépare les collections', async () => {
    const b = createLocalBackend(fakeStorage())
    await b.set('budget', 'a', { label: 'Loyer' })
    let seen = null
    b.subscribe('accounts', (docs) => { seen = docs })
    expect(seen).toEqual([])
  })
})
