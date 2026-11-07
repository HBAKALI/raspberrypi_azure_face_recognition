// État global de l'ERP : une base locale (localStorage) avec mutations immuables.
// Pour brancher un backend, remplacer load/persist par des appels API.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { buildSeed } from '../data/seed.js'
import { DOC_TYPES, uid, TODAY } from './domain.js'

const KEY = 'liyahealth-erp-v4'
const Ctx = createContext(null)

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) { const db = JSON.parse(raw); if (db.version === 4) return db }
  } catch { /* stockage indisponible */ }
  return buildSeed()
}

export function StoreProvider({ children }) {
  const [db, setDb] = useState(load)
  const [toasts, setToasts] = useState([])
  const timer = useRef()

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* quota */ } }, 300)
  }, [db])

  useEffect(() => { document.documentElement.dataset.theme = db.settings.theme }, [db.settings.theme])

  const mutate = useCallback((fn) => setDb((prev) => { const next = structuredClone(prev); fn(next); return next }), [])

  const toast = useCallback((text) => {
    const id = uid()
    setToasts((t) => [...t, { id, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  const api = useMemo(() => ({
    db, mutate, toast, toasts,
    add: (col, obj) => { const item = { id: uid(), ...obj }; mutate((d) => { d[col].unshift(item) }); return item },
    update: (col, id, patch) => mutate((d) => { const i = d[col].findIndex((x) => x.id === id); if (i >= 0) d[col][i] = { ...d[col][i], ...patch } }),
    remove: (col, id) => mutate((d) => { d[col] = d[col].filter((x) => x.id !== id) }),
    setSettings: (patch) => mutate((d) => { d.settings = { ...d.settings, ...patch } }),
    log: (text, icon = 'activity') => mutate((d) => { d.activities.unshift({ id: uid(), date: new Date().toISOString(), text, icon }); d.activities = d.activities.slice(0, 60) }),
    reset: () => { localStorage.removeItem(KEY); setDb(buildSeed()) },
    nextNumber: (type, d) => {
      const p = DOC_TYPES[type].prefix
      const n = (d.settings.counters[type] || 0) + 1
      d.settings.counters[type] = n
      return `${p}-${TODAY.slice(0, 4)}-${String(n).padStart(4, '0')}`
    },
  }), [db, mutate, toast, toasts])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)
