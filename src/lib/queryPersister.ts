import { createStore, get, set, del } from 'idb-keyval'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'

const idbStore = createStore('pendy-cache', 'query-cache')

export const queryPersister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get<string>(key, idbStore),
    setItem: (key, value) => set(key, value, idbStore),
    removeItem: (key) => del(key, idbStore),
  },
  throttleTime: 2000,
})
