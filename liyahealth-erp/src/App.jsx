import { useMemo, useState } from 'react'
import { useStore } from './lib/store.jsx'
import { GROUPS, MODULES, isEnabled } from './lib/modules.js'
import { go, NavCtx, useHashRoute } from './lib/nav.js'
import { Icon, Badge } from './components/ui.jsx'
import { insights } from './ai/engine.js'
import { docTotals, money, DOC_TYPES } from './lib/domain.js'
import Dashboard from './pages/Dashboard.jsx'
import Sales from './pages/Sales.jsx'
import Purchases from './pages/Purchases.jsx'
import Clients from './pages/Clients.jsx'
import Suppliers from './pages/Suppliers.jsx'
import Stock from './pages/Stock.jsx'
import Tenders from './pages/Tenders.jsx'
import Crm from './pages/Crm.jsx'
import Service from './pages/Service.jsx'
import Quality from './pages/Quality.jsx'
import Finance from './pages/Finance.jsx'
import Hr from './pages/Hr.jsx'
import Reports from './pages/Reports.jsx'
import AI from './pages/AI.jsx'
import Settings from './pages/Settings.jsx'

const PAGES = { dashboard: Dashboard, sales: Sales, purchases: Purchases, clients: Clients, suppliers: Suppliers, stock: Stock, tenders: Tenders, crm: Crm, service: Service, quality: Quality, finance: Finance, hr: Hr, reports: Reports, ai: AI, settings: Settings }

export default function App() {
  const { db, setSettings, toasts } = useStore()
  const route = useHashRoute()
  const [open, setOpen] = useState(false)
  const [bell, setBell] = useState(false)
  const alerts = useMemo(() => insights(db), [db])
  const enabled = (id) => isEnabled(db.settings, id)
  const page = enabled(route.page) && PAGES[route.page] ? route.page : 'dashboard'
  const Page = PAGES[page]
  const user = db.settings.user

  const nav = (id) => { go(id); setOpen(false) }

  return (
    <NavCtx.Provider value={{ ...route, page }}>
      <div className="app">
        {open && <div className="backdrop" onClick={() => setOpen(false)} />}
        <aside className={`sidebar ${open ? 'open' : ''}`}>
          <div className="brand">
            <div className="brand-logo"><Icon name="pulse" size={22} stroke={2.6} /></div>
            <div>
              <div className="brand-name">LIYA HEALTH</div>
              <div className="brand-sub">ERP · Dispositifs médicaux</div>
            </div>
          </div>
          {GROUPS.map((g) => {
            const items = MODULES.filter((m) => m.group === g && enabled(m.id))
            if (!items.length) return null
            return (
              <div className="nav-group" key={g}>
                <div className="nav-title">{g}</div>
                {items.map((m) => (
                  <button key={m.id} className={`nav-item ${page === m.id ? 'active' : ''}`} onClick={() => nav(m.id)}>
                    <Icon name={m.icon} size={17} />{m.label}
                    {m.id === 'ai' && <span className="ai-pill">IA</span>}
                    {m.id === 'tenders' && <span className="count">{db.tenders.filter((t) => ['Veille', 'En préparation AO'].includes(t.status)).length}</span>}
                  </button>
                ))}
              </div>
            )
          })}
          <div className="sidebar-foot">
            {db.settings.company.tagline}<br />© {new Date().getFullYear()} {db.settings.company.name}
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Menu"><Icon name="menu" /></button>
            <GlobalSearch />
            <div className="spacer" />
            {enabled('ai') && <button className="btn ai hide-sm" onClick={() => go('ai', 'chat')}><Icon name="sparkles" size={16} />Demander à LIYA IA</button>}
            <button className="icon-btn" onClick={() => setSettings({ theme: db.settings.theme === 'dark' ? 'light' : 'dark' })} aria-label="Thème"><Icon name={db.settings.theme === 'dark' ? 'sun' : 'moon'} /></button>
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" onClick={() => setBell(!bell)} aria-label="Alertes"><Icon name="bell" />{alerts.length > 0 && <span className="dot" />}</button>
              {bell && (
                <div className="search-results" style={{ width: 380, left: 'auto', right: 0 }} onMouseLeave={() => setBell(false)}>
                  <div className="row" style={{ padding: '8px 10px' }}><b>Alertes intelligentes</b><span className="spacer" /><Badge color="violet">{alerts.length}</Badge></div>
                  {alerts.map((a, i) => (
                    <button key={i} onClick={() => { go(a.page, a.tab); setBell(false) }}>
                      <Icon name={a.icon} size={16} />
                      <div><div style={{ fontWeight: 600 }}>{a.title}</div><div className="muted small">{a.severity}</div></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="row hide-sm" style={{ gap: 10 }}>
              <div className="avatar">{user.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</div>
              <div style={{ lineHeight: 1.2 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{user.name}</div><div className="muted small">{user.role}</div></div>
            </div>
          </header>
          <main className="content">
            <Page />
          </main>
        </div>
        <div className="toasts">{toasts.map((t) => <div key={t.id} className="toast"><Icon name="check" size={16} />{t.text}</div>)}</div>
      </div>
    </NavCtx.Provider>
  )
}

function GlobalSearch() {
  const { db } = useStore()
  const [q, setQ] = useState('')
  const results = useMemo(() => {
    if (q.length < 2) return []
    const s = q.toLowerCase()
    const r = []
    db.products.filter((p) => (p.name + p.ref).toLowerCase().includes(s)).slice(0, 5).forEach((p) => r.push({ icon: 'box', title: p.name, sub: `Produit · ${p.ref}`, page: 'stock' }))
    db.clients.filter((c) => c.name.toLowerCase().includes(s)).slice(0, 5).forEach((c) => r.push({ icon: 'building', title: c.name, sub: `Client · ${c.city}`, page: 'clients' }))
    db.documents.filter((d) => d.number.toLowerCase().includes(s)).slice(0, 6).forEach((d) => r.push({ icon: 'file', title: d.number, sub: `${DOC_TYPES[d.type].label} · ${money(docTotals(d).ttc)}`, page: DOC_TYPES[d.type].kind === 'sale' ? 'sales' : 'purchases', tab: d.type }))
    db.tenders.filter((t) => (t.ref + t.object + t.buyer).toLowerCase().includes(s)).slice(0, 4).forEach((t) => r.push({ icon: 'gavel', title: t.ref, sub: t.object, page: 'tenders' }))
    db.equipment.filter((e) => e.serial.toLowerCase().includes(s)).slice(0, 4).forEach((e) => r.push({ icon: 'wrench', title: e.serial, sub: 'Équipement installé', page: 'service' }))
    return r
  }, [q, db])
  return (
    <div className="search">
      <Icon name="search" size={17} />
      <input placeholder="Rechercher produit, client, facture, AO, n° de série…" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => setTimeout(() => setQ(''), 200)} />
      {results.length > 0 && (
        <div className="search-results">
          {results.map((r, i) => (
            <button key={i} onMouseDown={() => go(r.page, r.tab)}>
              <Icon name={r.icon} size={16} />
              <div><div style={{ fontWeight: 600 }}>{r.title}</div><div className="muted small">{r.sub}</div></div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
