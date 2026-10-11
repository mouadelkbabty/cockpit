// Stockage sur l'appareil : une clé par collection, { id: document }.

export function createLocalBackend(storage, prefix = 'cockpit:') {
  const listeners = new Map()

  function read(collection) {
    try {
      return JSON.parse(storage.getItem(prefix + collection) || '{}')
    } catch {
      return {}
    }
  }

  function list(collection) {
    return Object.entries(read(collection)).map(([id, data]) => ({ id, ...data }))
  }

  function emit(collection) {
    const docs = list(collection)
    for (const cb of listeners.get(collection) || []) cb(docs)
  }

  function write(collection, map) {
    storage.setItem(prefix + collection, JSON.stringify(map))
    emit(collection)
  }

  return {
    kind: 'local',
    subscribe(collection, cb) {
      if (!listeners.has(collection)) listeners.set(collection, new Set())
      listeners.get(collection).add(cb)
      cb(list(collection))
      return () => listeners.get(collection).delete(cb)
    },
    async set(collection, id, data) {
      const map = read(collection)
      const { id: _drop, ...rest } = data
      map[id] = rest
      write(collection, map)
    },
    async remove(collection, id) {
      const map = read(collection)
      delete map[id]
      write(collection, map)
    },
    refresh(collection) {
      emit(collection)
    },
  }
}
