import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { go, useRoute } from '../lib/nav.js'
import CrudPage from '../components/CrudPage.jsx'
import { Badge, BarChart, Card, DataTable, Field, Icon, Kpi, Modal, PageHead, Tabs, COLORS } from '../components/ui.jsx'
import { TODAY, daysBetween, fdate, int, lastMonths, money, moneyK, monthLabel, nearestExpiry, productStock, stockValue, unitsByMonth, uid } from '../lib/domain.js'
import { stockIn, stockOut } from '../lib/stock.js'

const CATEGORIES = ['Monitorage', 'Imagerie', 'Ventilation', 'Perfusion', 'Urgence', 'Hygiène', 'Communication', 'Aspiration', 'Cardiologie', 'Accessoires', 'Consommables', 'Pièces détachées']

export default function Stock() {
  const { db } = useStore()
  const { tab } = useRoute()
  const t = ['products', 'lots', 'movements', 'inventory', 'warehouses'].includes(tab) ? tab : 'products'
  const below = db.products.filter((p) => productStock(p) < p.minStock)
  const expSoon = db.products.flatMap((p) => p.lots.filter((l) => l.expiry && l.qty > 0 && daysBetween(TODAY, l.expiry) <= 90))

  return (
    <div className="stack">
      <PageHead title="Produits & stock" sub="Catalogue de dispositifs médicaux, traçabilité par lot, FEFO, multi-dépôts et inventaire.">
        <button className="btn ai" onClick={() => go('ai', 'reorder')}><Icon name="sparkles" size={15} />Plan de réappro IA</button>
      </PageHead>
      <div className="grid g4">
        <Kpi label="Références" value={db.products.length} icon="box" color="navy" foot={`${db.products.filter((p) => p.kind === 'equip').length} équipements · ${db.products.filter((p) => p.kind === 'conso').length} consommables`} />
        <Kpi label="Valeur du stock (coût)" value={moneyK(stockValue(db))} icon="wallet" color="teal" />
        <Kpi label="Sous le stock minimum" value={below.length} icon="alert" color="red" foot={below.slice(0, 2).map((p) => p.ref).join(', ')} />
        <Kpi label="Lots périmant < 90 j" value={expSoon.length} icon="clock" color="amber" />
      </div>
      <Tabs tabs={[['products', 'Produits'], ['lots', 'Lots & péremption'], ['movements', 'Mouvements'], ['inventory', 'Inventaire'], ['warehouses', 'Dépôts']]} value={t} onChange={(x) => go('stock', x)} />
      {t === 'products' && <Products />}
      {t === 'lots' && <Lots />}
      {t === 'movements' && <Movements />}
      {t === 'inventory' && <Inventory />}
      {t === 'warehouses' && <Warehouses />}
    </div>
  )
}

function Products() {
  const { db } = useStore()
  const months = lastMonths(12)
  return (
    <CrudPage col="products" entity="Produit"
      defaults={{ tva: 20, dmClass: 'IIa', kind: 'conso', unit: 'unité', lots: [], minStock: 10, warrantyMonths: 0, ce: true }}
      validate={(p) => (!p.ref || !p.name ? 'Référence et désignation obligatoires' : null)}
      fields={[
        { key: 'ref', label: 'Référence' }, { key: 'name', label: 'Désignation' },
        { key: 'category', label: 'Catégorie', type: 'select', options: CATEGORIES }, { key: 'kind', label: 'Type', type: 'select', options: [['equip', 'Équipement'], ['conso', 'Consommable / accessoire']] },
        { key: 'supplierId', label: 'Fournisseur', type: 'select', options: db.suppliers.map((s) => [s.id, s.name]) }, { key: 'dmClass', label: 'Classe DM', type: 'select', options: ['I', 'IIa', 'IIb', 'III'] },
        { key: 'ammps', label: 'N° enregistrement AMMPS' }, { key: 'unit', label: 'Unité' },
        { key: 'cost', label: 'Prix de revient HT (DH)', type: 'number' }, { key: 'price', label: 'Prix de vente HT (DH)', type: 'number' },
        { key: 'tva', label: 'TVA %', type: 'number' }, { key: 'minStock', label: 'Stock minimum', type: 'number' },
        { key: 'warrantyMonths', label: 'Garantie (mois)', type: 'number' }, { key: 'ce', label: 'Marquage CE', type: 'checkbox' },
      ]}
      filters={[{ key: 'category', label: 'Catégorie', options: CATEGORIES }, { key: 'dmClass', label: 'Classe', options: ['I', 'IIa', 'IIb', 'III'] }]}
      searchKeys={['ref', 'name', 'category', 'ammps']}
      columns={[
        { key: 'ref', label: 'Réf.', strong: true },
        { key: 'name', label: 'Désignation' },
        { key: 'category', label: 'Catégorie' },
        { key: 'dmClass', label: 'Classe', render: (p) => <Badge color={p.dmClass === 'IIb' ? 'violet' : p.dmClass === 'IIa' ? 'blue' : 'gray'}>{p.dmClass}</Badge> },
        { key: 'stock', label: 'Stock', right: true, sort: productStock, render: (p) => { const s = productStock(p); return <b style={{ color: s <= 0 ? 'var(--red)' : s < p.minStock ? 'var(--amber)' : 'var(--green)' }}>{int(s)}</b> } },
        { key: 'minStock', label: 'Min', right: true },
        { key: 'price', label: 'PV HT', right: true, render: (p) => money(p.price) },
        { key: 'margin', label: 'Marge', right: true, sort: (p) => 1 - p.cost / p.price, render: (p) => `${((1 - p.cost / p.price) * 100).toFixed(0)} %` },
        { key: 'expiry', label: 'Péremption', sort: (p) => nearestExpiry(p) || '9999', render: (p) => { const e = nearestExpiry(p); if (!e) return <span className="muted">—</span>; const d = daysBetween(TODAY, e); return <Badge color={d < 0 ? 'red' : d < 90 ? 'amber' : 'green'}>{fdate(e)}</Badge> } },
      ]}
      renderDetail={(p) => {
        const sold = unitsByMonth(db, p.id, months)
        const sup = db.suppliers.find((s) => s.id === p.supplierId)
        return (
          <div className="stack">
            <div className="grid g4">
              <Kpi label="Stock total" value={int(productStock(p))} icon="box" color="teal" foot={`minimum ${p.minStock}`} />
              <Kpi label="Valeur (coût)" value={moneyK(productStock(p) * p.cost)} icon="wallet" color="navy" />
              <Kpi label="Vendu 12 mois" value={int(sold.reduce((a, b) => a + b, 0))} icon="cart" color="green" />
              <Kpi label="Fournisseur" value={<span style={{ fontSize: 15 }}>{sup?.name}</span>} icon="globe" color="blue" foot={`délai ${sup?.leadTime} j · ${sup?.country}`} />
            </div>
            <div className="muted small">Classe {p.dmClass} · {p.ammps} · {p.ce ? 'CE' : 'non CE'} · garantie {p.warrantyMonths} mois · PV {money(p.price)} HT · PR {money(p.cost)} HT</div>
            <Card title="Ventes mensuelles (unités)"><BarChart height={180} labels={months.map(monthLabel)} series={[{ name: 'Unités', color: COLORS.teal, data: sold }]} /></Card>
            <Card title="Lots en stock" pad={false}>
              <table className="t"><thead><tr><th>Lot</th><th>Dépôt</th><th>Péremption</th><th className="right">Quantité</th></tr></thead>
                <tbody>{p.lots.map((l, i) => <tr key={i}><td className="strong">{l.lot}</td><td>{db.warehouses.find((w) => w.id === l.warehouseId)?.name}</td><td>{l.expiry ? fdate(l.expiry) : '—'}</td><td className="right num">{int(l.qty)}</td></tr>)}</tbody></table>
            </Card>
          </div>
        )
      }}
    />
  )
}

function Lots() {
  const { db } = useStore()
  const rows = useMemo(() => db.products.flatMap((p) => p.lots.map((l, i) => ({ id: `${p.id}-${i}`, p, ...l, days: l.expiry ? daysBetween(TODAY, l.expiry) : null }))), [db.products])
  return (
    <DataTable rows={rows} exportName="lots" searchKeys={['lot', (r) => r.p.name, (r) => r.p.ref]}
      filters={[{ key: 'state', label: 'État', options: ['Périmé', '< 90 j', '< 180 j', 'OK', 'Sans péremption'], get: (r) => (r.days == null ? 'Sans péremption' : r.days < 0 ? 'Périmé' : r.days < 90 ? '< 90 j' : r.days < 180 ? '< 180 j' : 'OK') }]}
      columns={[
        { key: 'lot', label: 'Lot', strong: true },
        { key: 'product', label: 'Produit', sort: (r) => r.p.name, render: (r) => r.p.name, csv: (r) => r.p.name },
        { key: 'wh', label: 'Dépôt', render: (r) => db.warehouses.find((w) => w.id === r.warehouseId)?.name },
        { key: 'qty', label: 'Qté', right: true, render: (r) => int(r.qty) },
        { key: 'value', label: 'Valeur', right: true, sort: (r) => r.qty * r.p.cost, render: (r) => money(r.qty * r.p.cost) },
        { key: 'expiry', label: 'Péremption', render: (r) => (r.expiry ? fdate(r.expiry) : '—') },
        { key: 'days', label: 'Jours restants', right: true, sort: (r) => r.days ?? 99999, render: (r) => (r.days == null ? '—' : <Badge color={r.days < 0 ? 'red' : r.days < 90 ? 'amber' : r.days < 180 ? 'blue' : 'green'}>{r.days < 0 ? 'Périmé' : `${r.days} j`}</Badge>) },
      ]} />
  )
}

function Movements() {
  const { db, mutate, toast, log } = useStore()
  const [m, setM] = useState(null)
  const submit = () => {
    if (!m.productId || !m.qty) return toast('Produit et quantité obligatoires')
    mutate((d) => {
      const ref = m.ref || `MVT-${uid().slice(0, 5).toUpperCase()}`
      if (m.type === 'Entrée') stockIn(d, m.productId, m.qty, ref, { lot: m.lot, expiry: m.expiry, warehouseId: m.warehouseId })
      else if (m.type === 'Sortie') stockOut(d, m.productId, m.qty, ref)
      else if (m.type === 'Transfert') {
        const p = d.products.find((x) => x.id === m.productId)
        const lot = p.lots.find((l) => l.lot === m.lot) || p.lots[0]
        if (lot) {
          const q = Math.min(lot.qty, Number(m.qty)); lot.qty -= q
          p.lots.push({ ...lot, qty: q, warehouseId: m.toWarehouseId })
          d.movements.unshift({ id: uid(), date: TODAY, productId: p.id, type: 'Transfert', qty: q, ref, warehouseId: m.toWarehouseId, lot: lot.lot })
        }
      }
    })
    log(`Mouvement de stock (${m.type}) enregistré`, 'box'); toast('Mouvement enregistré'); setM(null)
  }
  return (
    <>
      <DataTable rows={db.movements} exportName="mouvements" pageSize={15} searchKeys={['ref', 'lot', (r) => db.products.find((p) => p.id === r.productId)?.name]}
        filters={[{ key: 'type', label: 'Type', options: ['Entrée', 'Sortie', 'Transfert', 'Ajustement'] }]}
        actions={<button className="btn primary sm" onClick={() => setM({ type: 'Entrée', warehouseId: 'w1', toWarehouseId: 'w2', qty: 1 })}><Icon name="plus" size={14} />Mouvement</button>}
        columns={[
          { key: 'date', label: 'Date', render: (r) => fdate(r.date) },
          { key: 'type', label: 'Type', render: (r) => <Badge color={r.type === 'Entrée' ? 'green' : r.type === 'Sortie' ? 'blue' : 'amber'}>{r.type}</Badge> },
          { key: 'product', label: 'Produit', sort: (r) => db.products.find((p) => p.id === r.productId)?.name, render: (r) => db.products.find((p) => p.id === r.productId)?.name },
          { key: 'lot', label: 'Lot' },
          { key: 'qty', label: 'Qté', right: true, render: (r) => <b>{r.type === 'Sortie' ? '−' : '+'}{int(r.qty)}</b> },
          { key: 'ref', label: 'Référence' },
          { key: 'wh', label: 'Dépôt', render: (r) => db.warehouses.find((w) => w.id === r.warehouseId)?.name },
        ]} />
      {m && (
        <Modal title="Nouveau mouvement de stock" onClose={() => setM(null)} footer={<><button className="btn" onClick={() => setM(null)}>Annuler</button><button className="btn primary" onClick={submit}>Valider</button></>}>
          <div className="form">
            <Field label="Type"><select value={m.type} onChange={(e) => setM({ ...m, type: e.target.value })}>{['Entrée', 'Sortie', 'Transfert'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Produit"><select value={m.productId || ''} onChange={(e) => setM({ ...m, productId: e.target.value })}><option value="">—</option>{db.products.map((p) => <option key={p.id} value={p.id}>{p.ref} — {p.name}</option>)}</select></Field>
            <Field label="Quantité"><input type="number" value={m.qty} onChange={(e) => setM({ ...m, qty: Number(e.target.value) })} /></Field>
            <Field label="Référence (BR, BL, motif…)"><input value={m.ref || ''} onChange={(e) => setM({ ...m, ref: e.target.value })} /></Field>
            {m.type !== 'Sortie' && <Field label="Lot"><input value={m.lot || ''} onChange={(e) => setM({ ...m, lot: e.target.value })} placeholder={m.type === 'Entrée' ? 'Généré si vide' : ''} /></Field>}
            {m.type === 'Entrée' && <Field label="Péremption"><input type="date" value={m.expiry || ''} onChange={(e) => setM({ ...m, expiry: e.target.value })} /></Field>}
            {m.type === 'Entrée' && <Field label="Dépôt"><select value={m.warehouseId} onChange={(e) => setM({ ...m, warehouseId: e.target.value })}>{db.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>}
            {m.type === 'Transfert' && <Field label="Vers le dépôt"><select value={m.toWarehouseId} onChange={(e) => setM({ ...m, toWarehouseId: e.target.value })}>{db.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>}
          </div>
          {m.type === 'Sortie' && <p className="muted small" style={{ marginTop: 12 }}>Sortie en FEFO : les lots à péremption la plus proche sont consommés en premier.</p>}
        </Modal>
      )}
    </>
  )
}

function Inventory() {
  const { db, mutate, toast, log } = useStore()
  const [counts, setCounts] = useState({})
  const diffs = db.products.filter((p) => counts[p.id] !== undefined && counts[p.id] !== '' && Number(counts[p.id]) !== productStock(p))
  const apply = () => {
    mutate((d) => {
      for (const p0 of diffs) {
        const delta = Number(counts[p0.id]) - productStock(p0)
        if (delta > 0) stockIn(d, p0.id, delta, 'INVENTAIRE ' + TODAY, { lot: p0.lots[0]?.lot, expiry: p0.lots[0]?.expiry })
        else stockOut(d, p0.id, -delta, 'INVENTAIRE ' + TODAY)
        d.movements[0].type = 'Ajustement'
      }
    })
    log(`Inventaire validé : ${diffs.length} écart(s) régularisé(s)`, 'check'); toast('Inventaire validé'); setCounts({})
  }
  return (
    <Card title="Feuille d'inventaire" icon="layers" pad={false} action={<button className="btn primary sm" disabled={!diffs.length} onClick={apply}><Icon name="check" size={14} />Valider {diffs.length} écart(s)</button>}>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="t">
          <thead><tr><th>Réf.</th><th>Produit</th><th className="right">Théorique</th><th className="right">Compté</th><th className="right">Écart</th><th className="right">Valeur écart</th></tr></thead>
          <tbody>
            {db.products.map((p) => {
              const th = productStock(p)
              const c = counts[p.id]
              const diff = c === undefined || c === '' ? null : Number(c) - th
              return (
                <tr key={p.id}>
                  <td className="strong">{p.ref}</td><td>{p.name}</td><td className="right num">{int(th)}</td>
                  <td className="right"><input className="input" type="number" style={{ width: 100, textAlign: 'right' }} value={c ?? ''} placeholder={th} onChange={(e) => setCounts({ ...counts, [p.id]: e.target.value })} /></td>
                  <td className="right num" style={{ color: diff ? (diff > 0 ? 'var(--green)' : 'var(--red)') : undefined }}>{diff == null ? '—' : diff > 0 ? `+${diff}` : diff}</td>
                  <td className="right num">{diff ? money(diff * p.cost) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Warehouses() {
  const { db } = useStore()
  return (
    <div className="grid g3">
      {db.warehouses.map((w) => {
        const lots = db.products.flatMap((p) => p.lots.filter((l) => l.warehouseId === w.id).map((l) => ({ ...l, p })))
        const value = lots.reduce((s, l) => s + l.qty * l.p.cost, 0)
        return (
          <Card key={w.id} title={w.name} icon="building">
            <div className="muted small">{w.city} · Responsable : {w.manager}</div>
            <div className="row" style={{ marginTop: 14 }}>
              <div><div className="muted small">Valeur</div><div style={{ fontSize: 20, fontWeight: 800 }}>{moneyK(value)}</div></div>
              <div className="spacer" />
              <div className="right"><div className="muted small">Lots</div><div style={{ fontSize: 20, fontWeight: 800 }}>{lots.length}</div></div>
            </div>
            <div style={{ marginTop: 12 }}>
              {lots.sort((a, b) => b.qty * b.p.cost - a.qty * a.p.cost).slice(0, 5).map((l, i) => (
                <div key={i} className="row small" style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}><span style={{ flex: 1 }}>{l.p.name}</span><span className="num">{int(l.qty)}</span></div>
              ))}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
