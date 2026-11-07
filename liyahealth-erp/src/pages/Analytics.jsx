// Module « Analyses avancées » : tableaux de bord personnalisables par onglet (widgets ajoutables / réordonnables).
import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { go, useRoute } from '../lib/nav.js'
import { BarChart, Card, Donut, Icon, Kpi, LineChart, Modal, PageHead, Progress, Seg, Tabs, COLORS, SERIES } from '../components/ui.jsx'
import { docTotals, int, lastMonths, moneyK, monthLabel, payStatus, productStock } from '../lib/domain.js'

const TABS = [['home', 'Accueil'], ['sales', 'Ventes'], ['purchases', 'Achats'], ['stock', 'Stock'], ['finance', 'Finance']]
const DEFAULTS = {
  home: ['revenue', 'basket', 'cashflow', 'topClients', 'salesByCat'],
  sales: ['revenue', 'topProducts', 'payStatus', 'payMethods', 'pos'],
  purchases: ['purchBySupplier', 'topPurchased'],
  stock: ['stockByCat', 'lowStock'],
  finance: ['cashflow', 'payStatus', 'payMethods'],
}

const top = (map, n = 8) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n)
const RankTable = ({ rows, fmt = moneyK }) => (
  <div className="stack" style={{ gap: 10 }}>
    {rows.map(([name, v]) => (
      <div key={name}>
        <div className="row small"><span style={{ flex: 1 }}>{name}</span><b className="num">{fmt(v)}</b></div>
        <div style={{ marginTop: 4 }}><Progress value={v / (rows[0]?.[1] || 1)} /></div>
      </div>
    ))}
    {!rows.length && <div className="muted">Aucune donnée sur la période.</div>}
  </div>
)

// Catalogue des widgets : chacun reçoit le contexte calculé (ctx) et rend son contenu.
const WIDGETS = {
  revenue: { title: 'CA HT mensuel', icon: 'money', wide: true, render: (c) => <BarChart labels={c.months.map(monthLabel)} series={[{ name: 'CA HT', color: COLORS.teal, data: c.revByMonth }]} /> },
  cashflow: { title: 'Recettes vs dépenses', icon: 'trend', wide: true, render: (c) => <LineChart labels={c.months.map(monthLabel)} series={[{ name: 'Encaissements', color: COLORS.green, data: c.inByMonth }, { name: 'Décaissements + dépenses', color: COLORS.red, data: c.outByMonth }]} /> },
  topClients: { title: 'Meilleurs clients', icon: 'building', render: (c) => <RankTable rows={c.topClients} /> },
  topProducts: { title: 'Produits les plus vendus', icon: 'box', render: (c) => <RankTable rows={c.topSold} fmt={(v) => `${int(v)} u.`} /> },
  topPurchased: { title: 'Produits les plus achetés', icon: 'truck', render: (c) => <RankTable rows={c.topBought} fmt={(v) => `${int(v)} u.`} /> },
  salesByCat: { title: 'Ventes par catégorie', icon: 'layers', render: (c) => <Donut data={c.byCat.map(([l, v], i) => ({ label: l, value: v, color: SERIES[i % SERIES.length] }))} label={moneyK(c.totalHt)} sub="CA HT" /> },
  purchBySupplier: { title: 'Achats par fournisseur', icon: 'globe', wide: true, render: (c) => <BarChart labels={c.bySupplier.map(([l]) => l)} series={[{ name: 'Achats HT', color: COLORS.blue, data: c.bySupplier.map(([, v]) => v) }]} /> },
  stockByCat: { title: 'Valeur du stock par catégorie', icon: 'box', wide: true, render: (c) => <BarChart labels={c.stockCat.map(([l]) => l)} series={[{ name: 'Valeur (coût)', color: COLORS.green, data: c.stockCat.map(([, v]) => v) }]} /> },
  lowStock: { title: 'Produits épuisés / sous le seuil', icon: 'alert', render: (c) => (
    <table className="t"><tbody>
      {c.low.map((p) => <tr key={p.id}><td>{p.name}</td><td className="right num"><b style={{ color: productStock(p) <= 0 ? 'var(--red)' : 'var(--amber)' }}>{int(productStock(p))}</b> / {p.minStock}</td></tr>)}
      {!c.low.length && <tr><td className="muted">Tous les produits sont au-dessus du seuil.</td></tr>}
    </tbody></table>
  ) },
  payStatus: { title: 'Factures par statut de paiement', icon: 'wallet', render: (c) => <Donut data={c.payStat.map(([l, v]) => ({ label: `${l} (${v})`, value: v, color: { Payée: COLORS.green, 'En retard': COLORS.red, Partielle: COLORS.amber, 'À payer': COLORS.blue }[l] || COLORS.gray }))} label={int(c.invoices.length)} sub="factures" /> },
  payMethods: { title: 'Répartition par mode de paiement', icon: 'money', render: (c) => <Donut data={c.methods.map(([l, v], i) => ({ label: l, value: v, color: SERIES[i % SERIES.length] }))} label={moneyK(c.methods.reduce((s, x) => s + x[1], 0))} sub="encaissé" /> },
  basket: { title: 'Panier moyen & volume', icon: 'cart', render: (c) => (
    <div className="grid g2" style={{ gap: 12 }}>
      <Kpi label="Panier moyen HT" value={moneyK(c.invoices.length ? c.totalHt / c.invoices.length : 0)} icon="cart" color="teal" />
      <Kpi label="Factures émises" value={int(c.invoices.length)} icon="file" color="navy" />
    </div>
  ) },
  pos: { title: 'CA point de vente', icon: 'register', wide: true, render: (c) => <BarChart labels={c.months.map(monthLabel)} series={[{ name: 'Tickets TTC', color: COLORS.violet, data: c.posByMonth }]} /> },
}

export default function Analytics() {
  const { db, setSettings, toast } = useStore()
  const { tab } = useRoute()
  const t = TABS.some(([id]) => id === tab) ? tab : 'home'
  const [range, setRange] = useState(6)
  const [picker, setPicker] = useState(false)
  const layout = { ...DEFAULTS, ...(db.settings.analyticsWidgets || {}) }
  const ids = (layout[t] || []).filter((id) => WIDGETS[id])
  const save = (next) => setSettings({ analyticsWidgets: { ...layout, [t]: next } })
  const move = (i, d) => { const n = [...ids]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; save(n) }

  const ctx = useMemo(() => {
    const months = lastMonths(range)
    const inRange = (d) => months.includes((d || '').slice(0, 7))
    const invoices = db.documents.filter((d) => d.type === 'facture' && d.status === 'Validée' && inRange(d.date))
    const purchases = db.documents.filter((d) => d.type === 'facture_f' && d.status === 'Validée' && inRange(d.date))
    const revByMonth = months.map((m) => invoices.filter((d) => d.date.startsWith(m)).reduce((s, d) => s + docTotals(d).ht, 0))
    const inByMonth = months.map((m) => db.payments.filter((p) => p.kind === 'in' && p.date.startsWith(m)).reduce((s, p) => s + Number(p.amount), 0) + (db.posTickets || []).filter((x) => x.status === 'Payé' && x.date.startsWith(m)).reduce((s, x) => s + x.total, 0))
    const outByMonth = months.map((m) => db.payments.filter((p) => p.kind === 'out' && p.date.startsWith(m)).reduce((s, p) => s + Number(p.amount), 0) + db.expenses.filter((e) => e.paid && e.date.startsWith(m)).reduce((s, e) => s + Number(e.amount), 0))
    const byClient = {}, sold = {}, cat = {}, bought = {}, sup = {}, stockCat = {}, pay = {}, methods = {}
    let totalHt = 0
    for (const d of invoices) {
      const ht = docTotals(d).ht; totalHt += ht
      const cn = db.clients.find((c) => c.id === d.partyId)?.name || '—'
      byClient[cn] = (byClient[cn] || 0) + ht
      for (const l of d.lines) {
        sold[l.label] = (sold[l.label] || 0) + Number(l.qty)
        const ca = db.products.find((p) => p.id === l.productId)?.category || 'Autre'
        cat[ca] = (cat[ca] || 0) + l.qty * l.price * (1 - (l.discount || 0) / 100)
      }
      const st = payStatus(db, d); if (st) pay[st] = (pay[st] || 0) + 1
    }
    for (const d of purchases) {
      const sn = db.suppliers.find((s) => s.id === d.partyId)?.name || '—'
      sup[sn] = (sup[sn] || 0) + docTotals(d).ht
      for (const l of d.lines) bought[l.label] = (bought[l.label] || 0) + Number(l.qty)
    }
    for (const p of db.products) stockCat[p.category] = (stockCat[p.category] || 0) + productStock(p) * p.cost
    for (const p of db.payments) if (p.kind === 'in' && inRange(p.date)) methods[p.method || 'Autre'] = (methods[p.method || 'Autre'] || 0) + Number(p.amount)
    for (const x of db.posTickets || []) if (x.status === 'Payé' && inRange(x.date)) methods[x.method] = (methods[x.method] || 0) + x.total
    const posByMonth = months.map((m) => (db.posTickets || []).filter((x) => x.status === 'Payé' && x.date.startsWith(m)).reduce((s, x) => s + x.total, 0))
    const low = db.products.filter((p) => productStock(p) < p.minStock).sort((a, b) => productStock(a) - productStock(b))
    return { months, invoices, totalHt, revByMonth, inByMonth, outByMonth, topClients: top(byClient), topSold: top(sold), topBought: top(bought), byCat: top(cat, 7), bySupplier: top(sup, 10), stockCat: top(stockCat, 12), low, payStat: Object.entries(pay), methods: top(methods), posByMonth }
  }, [db, range])

  return (
    <div className="stack">
      <PageHead title="Analyses avancées" sub="Tableaux de bord personnalisables : ajoutez, retirez et réorganisez vos widgets." crumbs="Pilotage › Analyses avancées">
        <Seg options={[[3, '3 mois'], [6, '6 mois'], [12, '12 mois']]} value={range} onChange={setRange} />
        <button className="btn" onClick={() => { save(DEFAULTS[t]); toast('Disposition par défaut restaurée') }}><Icon name="refresh" size={15} />Réinitialiser</button>
        <button className="btn primary" onClick={() => setPicker(true)}><Icon name="plus" size={15} />Ajouter un widget</button>
      </PageHead>
      <Tabs tabs={TABS} value={t} onChange={(x) => go('analytics', x)} />
      <div className="grid g2">
        {ids.map((id, i) => {
          const w = WIDGETS[id]
          return (
            <Card key={id} title={w.title} icon={w.icon} className={w.wide ? 'span2' : ''} action={
              <span className="row" style={{ gap: 2 }}>
                <button className="btn sm ghost" title="Monter" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button className="btn sm ghost" title="Descendre" disabled={i === ids.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button className="btn sm ghost danger" title="Retirer" onClick={() => save(ids.filter((x) => x !== id))}><Icon name="x" size={14} /></button>
              </span>
            }>
              {w.render(ctx)}
            </Card>
          )
        })}
      </div>
      {!ids.length && <div className="card empty">Aucun widget dans cet onglet. Cliquez sur « Ajouter un widget ».</div>}
      {picker && (
        <Modal title="Ajouter un widget" onClose={() => setPicker(false)}>
          <div className="grid g2" style={{ gap: 10 }}>
            {Object.entries(WIDGETS).map(([id, w]) => {
              const on = ids.includes(id)
              return (
                <button key={id} className="card insight" style={{ cursor: on ? 'default' : 'pointer', textAlign: 'left', opacity: on ? 0.55 : 1 }} disabled={on}
                  onClick={() => { save([...ids, id]); toast(`Widget « ${w.title} » ajouté`); setPicker(false) }}>
                  <div className="ii" style={{ background: '#13a89e1a', color: COLORS.teal }}><Icon name={w.icon} size={17} /></div>
                  <div><b>{w.title}</b><div className="muted small">{on ? 'Déjà affiché' : w.wide ? 'Grand format' : 'Format standard'}</div></div>
                </button>
              )
            })}
          </div>
        </Modal>
      )}
    </div>
  )
}

