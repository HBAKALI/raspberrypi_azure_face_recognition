import { createContext, useContext, useEffect, useState } from 'react'

// Navigation par hash : #/page/onglet
const parse = () => { const [page = 'dashboard', tab = ''] = location.hash.replace(/^#\/?/, '').split('/'); return { page, tab } }
export function useHashRoute() {
  const [route, setRoute] = useState(parse)
  useEffect(() => { const f = () => setRoute(parse()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return route
}
export const go = (page, tab = '') => { location.hash = `/${page}${tab ? '/' + tab : ''}`; window.scrollTo({ top: 0 }) }
export const NavCtx = createContext({ page: 'dashboard', tab: '' })
export const useRoute = () => useContext(NavCtx)

// Accès sessionStorage tolérant (navigation privée, iframes restreintes)
export const ss = {
  get: (k) => { try { return sessionStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { sessionStorage.setItem(k, v) } catch { /* ignoré */ } },
  del: (k) => { try { sessionStorage.removeItem(k) } catch { /* ignoré */ } },
}
