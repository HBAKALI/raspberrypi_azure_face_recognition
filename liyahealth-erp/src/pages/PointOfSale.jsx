// Point de vente : caisse tactile, tickets, ouverture / clôture des caisses, rapports.
import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { go, useRoute } from '../lib/nav.js'
import { Badge, BarChart, Card, DataTable, Donut, Field, Icon, Kpi, LineChart, Modal, PageHead, Seg, Tabs, COLORS, SERIES } from '../components/ui.jsx'
import { TODAY, addDays, fdate, int, money, moneyK, productStock, uid } from '../lib/domain.js'
import { stockIn, stockOut } from '../lib/stock.js'

const METHODS = ['Espèces', 'Carte bancaire', 'Chèque', 'Virement']
const regName = (db, id) => db.registers.find((r) => r.id === id)?.name || '—'
const empName = (db, id) => db.employees.find((e) => e.id === id)?.name || '—'
const ttcOf = (l) => l.qty * l.price * (1 + (l.tva ?? 20) / 100)
const timeOf = (iso) => (iso ? iso.slice(11, 16) : '')
const openSession = (db, registerId) => db.posSessions.find((s) => s.registerId === registerId && s.status === 'Ouverte')
const sessionCash = (db, s) => db.posTickets.filter((t) => t.sessionId === s.id && t.status === 'Payé' && t.method === 'Espèces').reduce((x, t) => x + t.total, 0)
const sessionSales = (db, s) => db.posTickets.filter((t) => t.sessionId === s.id && t.status === 'Payé').reduce((x, t) => x + t.total, 0)

export default function PointOfSale() {
  const { db } = useStore()
  const { tab } = useRoute()
  const t = ['caisse', 'transactions', 'caisses', 'rapports'].includes(tab) ? tab : 'caisse'
  const open = db.registers.filter((r) => r.status === 'Ouverte').length
  return (
    <div className="stack">
      <PageHead title="Point de vente" sub="Ventes comptoir et showroom : caisse, tickets, ouverture et clôture des caisses." crumbs="Commercial › Point de vente">
        <Badge color={open ? 'green' : 'gray'}>{open ? `${open} caisse(s) ouverte(s)` : 'Toutes les caisses sont fermées'}</Badge>
      </PageHead>
      <Tabs tabs={[['caisse', 'Caisse'], ['transactions', 'Transactions'], ['caisses', 'Caisses'], ['rapports', 'Clôtures & rapports']]} value={t} onChange={(x) => go('pos', x)} />
      {t === 'caisse' && <Register />}
      {t === 'transactions' && <Transactions />}
      {t === 'caisses' && <Registers />}
      {t === 'rapports' && <Reports />}
    </div>
  )
}

// ---------- Ouverture d'une caisse ----------
function OpenForm({ registerId, onDone }) {
  const { db, mutate, toast, log } = useStore()
  const [f, setF] = useState({ registerId: registerId || db.registers.find((r) => r.status !== 'Ouverte')?.id || db.registers[0]?.id, cashierId: db.settings.user.employeeId || db.employees[0]?.id, opening: 2000 })
  const submit = () => {
    if (openSession(db, f.registerId)) return toast('Cette caisse est déjà ouverte')
    const session = { id: uid(), registerId: f.registerId, cashierId: f.cashierId, openedAt: new Date().toISOString().slice(0, 19), closedAt: '', openingBalance: Number(f.opening) || 0, closingBalance: 0, status: 'Ouverte' }
    mutate((d) => { d.posSessions.unshift(session); const r = d.registers.find((x) => x.id === f.registerId); if (r) r.status = 'Ouverte' })
    log(`Ouverture de ${regName(db, f.registerId)} (fond ${money(session.openingBalance)})`, 'register')
    toast('Caisse ouverte')
    onDone?.(f.registerId)
  }
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="form">
        <Field label="Caisse"><select value={f.registerId} onChange={(e) => setF({ ...f, registerId: e.target.value })}>{db.registers.map((r) => <option key={r.id} value={r.id}>{r.name}{r.status === 'Ouverte' ? ' (ouverte)' : ''}</option>)}</select></Field>
        <Field label="Caissier"><select value={f.cashierId} onChange={(e) => setF({ ...f, cashierId: e.target.value })}>{db.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
        <Field label="Fond de caisse (DH)"><input type="number" value={f.opening} onChange={(e) => setF({ ...f, opening: e.target.value })} /></Field>
      </div>
      <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={submit}><Icon name="register" size={15} />Ouvrir la caisse</button>
    </div>
  )
}

// ---------- Interface de caisse ----------
function Register() {
  const { db } = useStore()
  const [registerId, setRegisterId] = useState(db.registers.find((r) => r.status === 'Ouverte')?.id || db.registers[0]?.id)
  const session = openSession(db, registerId)
  return (
    <div className="stack">
      <div className="row wrap">
        <span className="muted small">Caisse :</span>
        <Seg options={db.registers.map((r) => [r.id, `${r.name}${r.status === 'Ouverte' ? ' ●' : ''}`])} value={registerId} onChange={setRegisterId} />
        {session && <span className="muted small">Ouverte à {timeOf(session.openedAt)} par {empName(db, session.cashierId)} · ventes {money(sessionSales(db, session))}</span>}
      </div>
      {session ? <Terminal session={session} /> : (
        <Card title={`${regName(db, registerId)} est fermée`} icon="lock">
          <p className="muted" style={{ marginTop: 0 }}>Ouvrez la caisse avec un fond de caisse pour commencer à encaisser.</p>
          <OpenForm key={registerId} registerId={registerId} />
        </Card>
      )}
    </div>
  )
}

function Terminal({ session }) {
  const { db, mutate, toast, log } = useStore()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [scan, setScan] = useState('')
  const [cart, setCart] = useState([])
  const [clientId, setClientId] = useState('')
  const [method, setMethod] = useState('Espèces')
  const [given, setGiven] = useState('')
  const [receipt, setReceipt] = useState(null)

  const cats = useMemo(() => [...new Set(db.products.map((p) => p.category))], [db.products])
  const catalog = useMemo(() => {
    const s = q.toLowerCase()
    return [...db.products]
      .sort((a, b) => (a.kind === 'conso' ? 0 : 1) - (b.kind === 'conso' ? 0 : 1) || a.name.localeCompare(b.name))
      .filter((p) => (!cat || p.category === cat) && (!s || `${p.name} ${p.ref} ${p.barcode || ''}`.toLowerCase().includes(s)))
  }, [db.products, q, cat])

  const add = (p) => {
    const inCart = cart.find((l) => l.productId === p.id)?.qty || 0
    if (inCart + 1 > productStock(p)) return toast(`Stock insuffisant pour ${p.ref}`)
    setCart((c) => (c.some((l) => l.productId === p.id) ? c.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l)) : [...c, { productId: p.id, label: p.name, qty: 1, price: p.price, tva: p.tva ?? 20 }]))
  }
  const setQty = (id, qty) => {
    const p = db.products.find((x) => x.id === id)
    if (qty > productStock(p)) return toast('Stock insuffisant')
    setCart((c) => (qty <= 0 ? c.filter((l) => l.productId !== id) : c.map((l) => (l.productId === id ? { ...l, qty } : l))))
  }
  const onScan = (e) => {
    if (e.key !== 'Enter') return
    const v = scan.trim().toLowerCase()
    const p = db.products.find((x) => x.ref.toLowerCase() === v || String(x.barcode || '').toLowerCase() === v)
    if (p) add(p); else toast('Référence introuvable')
    setScan('')
  }

  const ht = cart.reduce((s, l) => s + l.qty * l.price, 0)
  const ttc = cart.reduce((s, l) => s + ttcOf(l), 0)
  const total = Math.round(ttc * 100) / 100
  const change = method === 'Espèces' && given !== '' ? Number(given) - total : null

  const checkout = () => {
    if (!cart.length) return toast('Le panier est vide')
    if (change !== null && change < 0) return toast('Montant reçu insuffisant')
    const maxNo = db.posTickets.reduce((m, t) => Math.max(m, Number(t.number.replace(/\D/g, '')) || 0), 0)
    const number = `TK-${String(maxNo + 1).padStart(5, '0')}`
    const ticket = { id: uid(), number, registerId: session.registerId, sessionId: session.id, cashierId: session.cashierId, date: new Date().toISOString().slice(0, 19), lines: cart, method, total, status: 'Payé', clientId }
    const payment = { id: uid(), kind: 'in', docId: '', partyId: clientId || '', date: TODAY, amount: total, method, ref: number, category: 'Point de vente' }
    mutate((d) => {
      d.posTickets.unshift(ticket)
      for (const l of cart) stockOut(d, l.productId, l.qty, number)
      d.payments.unshift(payment)
    })
    log(`Ticket ${number} encaissé : ${money(total)} (${method})`, 'register')
    setReceipt({ ticket, given: change !== null ? Number(given) : null, change })
    setCart([]); setGiven(''); setClientId('')
  }

  return (
    <div className="grid g3" style={{ alignItems: 'start' }}>
      <div className="card span2">
        <div className="toolbar">
          <div className="search" style={{ maxWidth: 260 }}><Icon name="search" size={16} /><input placeholder="Rechercher un produit…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 36 }} /></div>
          <div className="search" style={{ maxWidth: 230 }}><Icon name="scan" size={16} /><input placeholder="Scanner / saisir une réf. + Entrée" value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={onScan} style={{ paddingLeft: 36 }} /></div>
        </div>
        <div className="chips" style={{ padding: '12px 16px 0' }}>
          <button className="chip" style={!cat ? { borderColor: 'var(--teal)', color: 'var(--teal)' } : undefined} onClick={() => setCat('')}>Tout</button>
          {cats.map((c) => <button key={c} className="chip" style={cat === c ? { borderColor: 'var(--teal)', color: 'var(--teal)' } : undefined} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, padding: 16, maxHeight: 560, overflowY: 'auto' }}>
          {catalog.map((p) => {
            const st = productStock(p)
            return (
              <button key={p.id} onClick={() => add(p)} disabled={st <= 0} className="card" style={{ textAlign: 'left', padding: 12, cursor: st > 0 ? 'pointer' : 'not-allowed', opacity: st > 0 ? 1 : 0.5, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <div className="row" style={{ gap: 6 }}><span className="muted small" style={{ flex: 1 }}>{p.ref}</span><Badge color={st <= 0 ? 'red' : st < p.minStock ? 'amber' : 'green'}>{int(st)}</Badge></div>
                <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.35, minHeight: 36 }}>{p.name}</div>
                <div style={{ fontWeight: 800, color: 'var(--teal)' }} className="num">{money(p.price * (1 + (p.tva ?? 20) / 100))}</div>
              </button>
            )
          })}
          {!catalog.length && <div className="muted">Aucun produit.</div>}
        </div>
      </div>

      <div className="card" style={{ position: 'sticky', top: 80 }}>
        <div className="card-h"><Icon name="cart" size={17} /><h3>Panier</h3><span className="spacer" />{cart.length > 0 && <button className="btn sm ghost danger" onClick={() => setCart([])}>Vider</button>}</div>
        <div className="card-b stack" style={{ gap: 12 }}>
          {!cart.length && <div className="empty" style={{ padding: 24 }}><Icon name="cart" size={28} /><div>Touchez un produit pour l'ajouter.</div></div>}
          {cart.map((l) => (
            <div key={l.productId} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{l.label}</div><div className="muted small num">{money(l.price)} HT</div></div>
              <div className="row" style={{ gap: 4 }}>
                <button className="btn sm" onClick={() => setQty(l.productId, l.qty - 1)}>−</button>
                <b className="num" style={{ minWidth: 22, textAlign: 'center' }}>{l.qty}</b>
                <button className="btn sm" onClick={() => setQty(l.productId, l.qty + 1)}>+</button>
              </div>
              <b className="num" style={{ minWidth: 86, textAlign: 'right', fontSize: 13 }}>{money(ttcOf(l))}</b>
            </div>
          ))}
          <Field label="Client (facultatif)"><select value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Client comptoir</option>{db.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div className="row small"><span className="muted">Total HT</span><span className="spacer" /><span className="num">{money(ht)}</span></div>
            <div className="row small" style={{ marginTop: 4 }}><span className="muted">TVA</span><span className="spacer" /><span className="num">{money(ttc - ht)}</span></div>
            <div className="row" style={{ marginTop: 8, fontSize: 20, fontWeight: 800 }}><span>Total TTC</span><span className="spacer" /><span className="num" style={{ color: 'var(--teal)' }}>{money(total)}</span></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {METHODS.map((m) => <button key={m} className={`btn sm ${method === m ? 'navy' : ''}`} style={{ justifyContent: 'center' }} onClick={() => setMethod(m)}>{m}</button>)}
          </div>
          {method === 'Espèces' && (
            <div className="row" style={{ gap: 10 }}>
              <Field label="Montant reçu"><input type="number" value={given} onChange={(e) => setGiven(e.target.value)} placeholder={total.toFixed(2)} /></Field>
              <div style={{ minWidth: 110 }}><div className="muted small">Rendu</div><b className="num" style={{ fontSize: 17, color: change !== null && change < 0 ? 'var(--red)' : 'var(--green)' }}>{change === null ? '—' : money(change)}</b></div>
            </div>
          )}
          <button className="btn primary" style={{ justifyContent: 'center', padding: '14px', fontSize: 15 }} disabled={!cart.length} onClick={checkout}><Icon name="check" size={17} />Encaisser {cart.length ? money(total) : ''}</button>
        </div>
      </div>
      {receipt && <Receipt ticket={receipt.ticket} given={receipt.given} change={receipt.change} onClose={() => setReceipt(null)} />}
    </div>
  )
}

// ---------- Ticket de caisse ----------
function Receipt({ ticket, given, change, onClose, onCancel }) {
  const { db } = useStore()
  const co = db.settings.company
  const ht = ticket.lines.reduce((s, l) => s + l.qty * l.price, 0)
  return (
    <Modal title={`Ticket ${ticket.number}`} onClose={onClose}
      footer={<>{onCancel && ticket.status === 'Payé' && <button className="btn danger" onClick={onCancel}><Icon name="x" size={15} />Annuler le ticket</button>}<button className="btn primary" onClick={onClose}>Fermer</button></>}>
      <div style={{ maxWidth: 340, margin: '0 auto', background: '#fff', color: '#0f1f33', border: '1px dashed #cbd5e1', borderRadius: 10, padding: '20px 18px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5 }}>
        <div style={{ textAlign: 'center', lineHeight: 1.5 }}>
          <div style={{ fontWeight: 800, fontSize: 15, fontFamily: 'Inter, sans-serif' }}>{co.name}</div>
          <div style={{ color: '#64748b' }}>{co.address}</div>
          <div style={{ color: '#64748b' }}>ICE {co.ice}</div>
        </div>
        <div style={{ borderTop: '1px dashed #cbd5e1', margin: '12px 0' }} />
        <div>{ticket.number} · {fdate(ticket.date.slice(0, 10))} {timeOf(ticket.date)}</div>
        <div>{regName(db, ticket.registerId)} · {empName(db, ticket.cashierId)}</div>
        {ticket.clientId && <div>Client : {db.clients.find((c) => c.id === ticket.clientId)?.name}</div>}
        <div style={{ borderTop: '1px dashed #cbd5e1', margin: '12px 0' }} />
        {ticket.lines.map((l, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <div>{l.label}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{l.qty} × {money(l.price * (1 + (l.tva ?? 20) / 100))}</span><span>{money(ttcOf(l))}</span></div>
          </div>
        ))}
        <div style={{ borderTop: '1px dashed #cbd5e1', margin: '12px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total HT</span><span>{money(ht)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>TVA</span><span>{money(ticket.total - ht)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, marginTop: 4 }}><span>TOTAL TTC</span><span>{money(ticket.total)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}><span>{ticket.method}</span><span>{given != null ? money(given) : ''}</span></div>
        {change != null && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Rendu</span><span>{money(change)}</span></div>}
        {ticket.status === 'Annulé' && <div style={{ textAlign: 'center', marginTop: 10, color: '#c23447', fontWeight: 800 }}>*** TICKET ANNULÉ ***</div>}
        <div style={{ textAlign: 'center', marginTop: 14, color: '#64748b' }}>Merci de votre visite<br />{co.tagline}</div>
      </div>
    </Modal>
  )
}

// ---------- Transactions ----------
function Transactions() {
  const { db, mutate, toast, log } = useStore()
  const [sel, setSel] = useState(null)
  const cancel = () => {
    const tk = sel
    mutate((d) => {
      const x = d.posTickets.find((t) => t.id === tk.id)
      if (!x || x.status !== 'Payé') return
      x.status = 'Annulé'
      for (const l of x.lines) stockIn(d, l.productId, l.qty, `${x.number} annulé`)
      d.payments = d.payments.filter((p) => p.ref !== x.number)
    })
    log(`Ticket ${tk.number} annulé`, 'x')
    toast('Ticket annulé, stock réintégré')
    setSel({ ...tk, status: 'Annulé' })
  }
  return (
    <>
      <DataTable rows={db.posTickets} exportName="tickets" pageSize={15} onRowClick={setSel}
        searchKeys={['number', (t) => empName(db, t.cashierId), (t) => t.lines.map((l) => l.label).join(' ')]}
        filters={[
          { key: 'register', label: 'Caisse', options: db.registers.map((r) => r.name), get: (t) => regName(db, t.registerId) },
          { key: 'cashier', label: 'Caissier', options: [...new Set(db.posTickets.map((t) => empName(db, t.cashierId)))], get: (t) => empName(db, t.cashierId) },
          { key: 'method', label: 'Mode', options: METHODS },
        ]}
        columns={[
          { key: 'number', label: 'Ticket', strong: true },
          { key: 'date', label: 'Date', render: (t) => `${fdate(t.date.slice(0, 10))} ${timeOf(t.date)}` },
          { key: 'register', label: 'Caisse', sort: (t) => regName(db, t.registerId), render: (t) => regName(db, t.registerId) },
          { key: 'cashier', label: 'Caissier', sort: (t) => empName(db, t.cashierId), render: (t) => empName(db, t.cashierId) },
          { key: 'items', label: 'Articles', right: true, sort: (t) => t.lines.reduce((s, l) => s + l.qty, 0), render: (t) => int(t.lines.reduce((s, l) => s + l.qty, 0)) },
          { key: 'method', label: 'Mode' },
          { key: 'total', label: 'Total TTC', right: true, render: (t) => money(t.total) },
          { key: 'status', label: 'Statut', render: (t) => <Badge color={t.status === 'Payé' ? 'green' : 'gray'}>{t.status}</Badge> },
        ]} />
      {sel && <Receipt ticket={sel} onClose={() => setSel(null)} onCancel={cancel} />}
    </>
  )
}

// ---------- Caisses (ouverture / clôture) ----------
function Registers() {
  const { db, mutate, toast, log } = useStore()
  const [opening, setOpening] = useState(null)
  const [closing, setClosing] = useState(null)
  const [counted, setCounted] = useState('')

  const close = () => {
    const s = closing
    const expected = s.openingBalance + sessionCash(db, s)
    const c = counted === '' ? expected : Number(counted)
    mutate((d) => {
      const x = d.posSessions.find((y) => y.id === s.id)
      Object.assign(x, { closedAt: new Date().toISOString().slice(0, 19), closingBalance: c, counted: c, expected, status: 'Clôturée' })
      const r = d.registers.find((y) => y.id === s.registerId); if (r) r.status = 'Fermée'
    })
    log(`Clôture de ${regName(db, s.registerId)} — écart ${money(c - expected)}`, 'lock')
    toast('Caisse clôturée')
    setClosing(null); setCounted('')
  }

  return (
    <div className="stack">
      <div className="grid g2">
        {db.registers.map((r) => {
          const s = openSession(db, r.id)
          const last = db.posSessions.find((x) => x.registerId === r.id && x.status === 'Clôturée')
          return (
            <Card key={r.id} title={r.name} icon="register" action={<Badge color={r.status === 'Ouverte' ? 'green' : 'gray'}>{r.status}</Badge>}>
              <div className="muted small">{r.location}</div>
              {s ? (
                <div className="grid g2" style={{ marginTop: 14, gap: 10 }}>
                  <div><div className="muted small">Ouverte par</div><b>{empName(db, s.cashierId)}</b><div className="muted small">à {timeOf(s.openedAt)} le {fdate(s.openedAt.slice(0, 10))}</div></div>
                  <div><div className="muted small">Fond de caisse</div><b className="num">{money(s.openingBalance)}</b></div>
                  <div><div className="muted small">Ventes de la session</div><b className="num">{money(sessionSales(db, s))}</b></div>
                  <div><div className="muted small">Espèces attendues</div><b className="num">{money(s.openingBalance + sessionCash(db, s))}</b></div>
                </div>
              ) : (
                <div className="muted small" style={{ marginTop: 14 }}>{last ? `Dernière clôture le ${fdate(last.closedAt.slice(0, 10))} à ${timeOf(last.closedAt)} — solde ${money(last.closingBalance)}` : 'Aucune session.'}</div>
              )}
              <div className="row" style={{ marginTop: 14 }}>
                {s ? <button className="btn" onClick={() => { setClosing(s); setCounted('') }}><Icon name="lock" size={15} />Clôturer</button>
                  : <button className="btn primary" onClick={() => setOpening(r.id)}><Icon name="register" size={15} />Ouvrir</button>}
                {s && <button className="btn ghost" onClick={() => go('pos', 'caisse')}>Aller à la caisse<Icon name="arrowRight" size={14} /></button>}
              </div>
            </Card>
          )
        })}
      </div>
      <DataTable rows={db.posSessions} exportName="sessions-caisse" columns={[
        { key: 'register', label: 'Caisse', sort: (s) => regName(db, s.registerId), render: (s) => regName(db, s.registerId) },
        { key: 'cashier', label: 'Caissier', render: (s) => empName(db, s.cashierId) },
        { key: 'openedAt', label: 'Ouverture', render: (s) => `${fdate(s.openedAt.slice(0, 10))} ${timeOf(s.openedAt)}` },
        { key: 'closedAt', label: 'Clôture', render: (s) => (s.closedAt ? `${fdate(s.closedAt.slice(0, 10))} ${timeOf(s.closedAt)}` : '—') },
        { key: 'openingBalance', label: 'Fond', right: true, render: (s) => money(s.openingBalance) },
        { key: 'sales', label: 'Ventes', right: true, sort: (s) => sessionSales(db, s), render: (s) => money(sessionSales(db, s)) },
        { key: 'closingBalance', label: 'Solde clôture', right: true, render: (s) => (s.status === 'Clôturée' ? money(s.closingBalance) : '—') },
        { key: 'gap', label: 'Écart', right: true, sort: (s) => (s.expected != null ? s.closingBalance - s.expected : 0), render: (s) => (s.expected != null ? <b style={{ color: Math.abs(s.closingBalance - s.expected) > 0.01 ? 'var(--red)' : 'var(--green)' }}>{money(s.closingBalance - s.expected)}</b> : '—') },
        { key: 'status', label: 'Statut', render: (s) => <Badge color={s.status === 'Ouverte' ? 'green' : 'gray'}>{s.status}</Badge> },
      ]} />
      {opening && <Modal title="Ouvrir une caisse" onClose={() => setOpening(null)}><OpenForm registerId={opening} onDone={() => setOpening(null)} /></Modal>}
      {closing && (() => {
        const expected = closing.openingBalance + sessionCash(db, closing)
        const diff = counted === '' ? 0 : Number(counted) - expected
        return (
          <Modal title={`Clôturer ${regName(db, closing.registerId)}`} onClose={() => setClosing(null)}
            footer={<><button className="btn" onClick={() => setClosing(null)}>Annuler</button><button className="btn primary" onClick={close}><Icon name="lock" size={15} />Clôturer</button></>}>
            <div className="stack" style={{ gap: 12 }}>
              <div className="row"><span className="muted">Fond de caisse</span><span className="spacer" /><b className="num">{money(closing.openingBalance)}</b></div>
              <div className="row"><span className="muted">Ventes en espèces</span><span className="spacer" /><b className="num">{money(sessionCash(db, closing))}</b></div>
              <div className="row"><span className="muted">Ventes totales (tous modes)</span><span className="spacer" /><b className="num">{money(sessionSales(db, closing))}</b></div>
              <div className="row" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}><b>Espèces attendues</b><span className="spacer" /><b className="num">{money(expected)}</b></div>
              <Field label="Espèces comptées (DH)"><input type="number" value={counted} placeholder={expected.toFixed(2)} onChange={(e) => setCounted(e.target.value)} /></Field>
              <div className="row"><span className="muted">Écart</span><span className="spacer" /><b className="num" style={{ color: Math.abs(diff) > 0.01 ? 'var(--red)' : 'var(--green)' }}>{money(diff)}</b></div>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}

// ---------- Clôtures & rapports ----------
function Reports() {
  const { db } = useStore()
  const [days, setDays] = useState('30')
  const n = Number(days)
  const from = addDays(TODAY, -(n - 1))
  const inPeriod = db.posTickets.filter((t) => t.date.slice(0, 10) >= from)
  const paid = inPeriod.filter((t) => t.status === 'Payé')
  const total = paid.reduce((s, t) => s + t.total, 0)

  const step = n <= 7 ? 1 : n <= 30 ? 3 : 7
  const buckets = []
  for (let i = 0; i < n; i += step) buckets.push(addDays(from, i))
  const trend = buckets.map((b, i) => paid.filter((t) => { const d = t.date.slice(0, 10); return d >= b && (i === buckets.length - 1 || d < buckets[i + 1]) }).reduce((s, t) => s + t.total, 0))

  const byProduct = {}
  for (const t of paid) for (const l of t.lines) byProduct[l.label] = (byProduct[l.label] || 0) + ttcOf(l)
  const top = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const byMethod = METHODS.map((m, i) => ({ label: m, value: paid.filter((t) => t.method === m).reduce((s, t) => s + t.total, 0), color: SERIES[i] })).filter((x) => x.value > 0)

  return (
    <div className="stack">
      <div className="row"><Seg options={[['7', '7 jours'], ['30', '30 jours'], ['90', '90 jours']]} value={days} onChange={setDays} /></div>
      <div className="grid g4">
        <Kpi label="Ventes totales TTC" value={moneyK(total)} icon="money" color="teal" />
        <Kpi label="Tickets" value={int(paid.length)} icon="file" color="navy" />
        <Kpi label="Panier moyen" value={money(paid.length ? total / paid.length : 0)} icon="cart" color="green" />
        <Kpi label="Tickets annulés" value={int(inPeriod.length - paid.length)} icon="x" color="red" />
      </div>
      <div className="grid g3">
        <Card title="Tendance des ventes" icon="trend" className="span2">
          <LineChart labels={buckets.map((b) => fdate(b).slice(0, 6))} series={[{ name: 'Ventes TTC', color: COLORS.teal, data: trend }]} />
        </Card>
        <Card title="Par mode de paiement" icon="wallet">
          {byMethod.length ? <Donut data={byMethod} label={moneyK(total)} sub="TTC" /> : <div className="muted">Aucune vente sur la période.</div>}
        </Card>
      </div>
      <Card title="Ventes par produit (top 8)" icon="box">
        {top.length ? <BarChart labels={top.map(([l]) => l)} series={[{ name: 'Ventes TTC', color: COLORS.navy, data: top.map(([, v]) => v) }]} /> : <div className="muted">Aucune vente sur la période.</div>}
      </Card>
    </div>
  )
}
