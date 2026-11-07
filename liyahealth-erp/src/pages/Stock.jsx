import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { go, useRoute } from '../lib/nav.js'
import CrudPage from '../components/CrudPage.jsx'
import { Badge, BarChart, Card, DataTable, Field, Icon, Kpi, Modal, PageHead, Tabs, COLORS } from '../components/ui.jsx'
import { TODAY, daysBetween, fdate, int, lastMonths, money, moneyK, monthLabel, nearestExpiry, productStock, stockValue, unitsByMonth, uid } from '../lib/domain.js'
import { stockIn, stockOut } from '../lib/stock.js'
import { Barcode, makeEan13 } from '../lib/barcode.jsx'
import { imageToDataUrl } from '../lib/image.js'

const CATEGORIES = ['Monitorage', 'Imagerie', 'Ventilation', 'Perfusion', 'Urgence', 'Hygiène', 'Communication', 'Aspiration', 'Cardiologie', 'Accessoires', 'Consommables', 'Pièces détachées']

export default function Stock() {
  const { db } = useStore()
  const { tab } = useRoute()
  const t = ['products', 'categories', 'lots', 'movements', 'inventory', 'warehouses'].includes(tab) ? tab : 'products'
  const below = db.products.filter((p) => productStock(p) < p.minStock)
  const expSoon = db.products.flatMap((p) => p.lots.filter((l) => l.expiry && l.qty > 0 && daysBetween(TODAY, l.expiry) <= 90))

  return (
    <div className="stack">
      <PageHead title="Inventaire" sub="Produits, codes-barres, catégories, lots et péremption (FEFO), entrepôts, mouvements et inventaire.">
        <Scanner />
        <button className="btn ai" onClick={() => go('ai', 'reorder')}><Icon name="sparkles" size={15} />Plan de réappro IA</button>
      </PageHead>
      <div className="grid g4">
        <Kpi label="Références" value={db.products.length} icon="box" color="navy" foot={`${db.products.filter((p) => p.kind === 'equip').length} équipements · ${db.products.filter((p) => p.kind === 'conso').length} consommables`} />
        <Kpi label="Valeur du stock (coût)" value={moneyK(stockValue(db))} icon="wallet" color="teal" />
        <Kpi label="Sous le stock minimum" value={below.length} icon="alert" color="red" foot={below.slice(0, 2).map((p) => p.ref).join(', ')} />
        <Kpi label="Lots périmant < 90 j" value={expSoon.length} icon="clock" color="amber" />
      </div>
      <Tabs tabs={[['products', 'Produits'], ['categories', 'Catégories'], ['lots', 'Lots & péremption'], ['movements', 'Mouvements'], ['inventory', 'Inventaire physique'], ['warehouses', 'Entrepôts']]} value={t} onChange={(x) => go('stock', x)} />
      {t === 'products' && <Products />}
      {t === 'categories' && <Categories />}
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
      validate={(p) => { if (!p.ref || !p.name) return 'Référence et désignation obligatoires'; if (!p.barcode) p.barcode = makeEan13(Date.now() % 1e9); return null }}
      fields={[
        { key: 'ref', label: 'Référence' }, { key: 'name', label: 'Désignation' },
        { key: 'category', label: 'Catégorie', type: 'select', options: CATEGORIES }, { key: 'kind', label: 'Type', type: 'select', options: [['equip', 'Équipement'], ['conso', 'Consommable / accessoire']] },
        { key: 'supplierId', label: 'Fournisseur', type: 'select', options: db.suppliers.map((s) => [s.id, s.name]) }, { key: 'dmClass', label: 'Classe DM', type: 'select', options: ['I', 'IIa', 'IIb', 'III'] },
        { key: 'ammps', label: 'N° enregistrement AMMPS' }, { key: 'unit', label: 'Unité' },
        { key: 'cost', label: 'Prix de revient HT (DH)', type: 'number' }, { key: 'price', label: 'Prix de vente HT (DH)', type: 'number' },
        { key: 'tva', label: 'TVA %', type: 'number' }, { key: 'minStock', label: 'Stock minimum', type: 'number' },
        { key: 'warrantyMonths', label: 'Garantie (mois)', type: 'number' }, { key: 'barcode', label: 'Code-barres (EAN-13, généré si vide)' },
        { key: 'ce', label: 'Marquage CE', type: 'checkbox' },
      ]}
      filters={[{ key: 'category', label: 'Catégorie', options: CATEGORIES }, { key: 'dmClass', label: 'Classe', options: ['I', 'IIa', 'IIb', 'III'] }]}
      searchKeys={['ref', 'name', 'category', 'ammps', (p) => p.barcode || makeEan13(p.id.replace(/\D/g, '') + p.ref.length)]}
      columns={[
        { key: 'img', label: '', noSort: true, noExport: true, render: (p) => <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--soft)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>{p.image ? <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="box" size={16} />}</div> },
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
            <ProductMedia p={p} />
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

const codeOf = (p) => p.barcode || makeEan13(p.id.replace(/\D/g, '') + String(p.ref.length))

function ProductMedia({ p }) {
  const { db, update, toast } = useStore()
  const cur = db.products.find((x) => x.id === p.id) || p
  const [labels, setLabels] = useState(false)
  return (
    <div className="grid g2">
      <Card title="Photo produit" icon="eye">
        <div className="row" style={{ gap: 14 }}>
          <div style={{ width: 120, height: 120, borderRadius: 12, background: 'var(--soft)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>{cur.image ? <img src={cur.image} alt={cur.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="box" size={30} />}</div>
          <div className="stack" style={{ gap: 8 }}>
            <label className="btn sm"><Icon name="upload" size={14} />Importer une photo<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files[0]; if (f) { update('products', cur.id, { image: await imageToDataUrl(f, 320) }); toast('Photo enregistrée') } }} /></label>
            {cur.image && <button className="btn sm danger" onClick={() => update('products', cur.id, { image: '' })}>Retirer</button>}
          </div>
        </div>
      </Card>
      <Card title="Code-barres" icon="barcode" action={<button className="btn sm" onClick={() => setLabels(true)}><Icon name="printer" size={14} />Étiquettes</button>}>
        <Barcode code={codeOf(cur)} />
        {!cur.barcode && <button className="btn sm" style={{ marginTop: 8 }} onClick={() => update('products', cur.id, { barcode: codeOf(cur) })}>Enregistrer ce code</button>}
      </Card>
      {labels && (
        <Modal size="xl" title={`Étiquettes — ${cur.name}`} onClose={() => setLabels(false)} footer={<button className="btn primary" onClick={() => window.print()}><Icon name="printer" size={15} />Imprimer</button>}>
          <div className="print-area"><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, background: '#fff', padding: 10 }}>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} style={{ border: '1px dashed #cbd5e1', borderRadius: 6, padding: 8, color: '#000', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 11 }}>{cur.name.slice(0, 40)}</div>
                <div style={{ fontSize: 10 }}>{cur.ref} · {money(cur.price * (1 + cur.tva / 100))} TTC</div>
                <Barcode code={codeOf(cur)} height={40} width={1.5} />
              </div>
            ))}
          </div></div>
        </Modal>
      )}
    </div>
  )
}

// Recherche par code-barres / référence, avec la caméra quand le navigateur le permet (BarcodeDetector).
function Scanner() {
  const { db } = useStore()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  const found = q ? db.products.find((p) => codeOf(p) === q.trim() || p.ref.toLowerCase() === q.trim().toLowerCase()) : null
  const camera = async () => {
    setErr('')
    if (!('BarcodeDetector' in window)) return setErr('La lecture par caméra n\'est pas prise en charge par ce navigateur : utilisez une douchette USB ou saisissez le code.')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      const video = document.getElementById('scan-video')
      video.srcObject = stream; await video.play()
      const det = new window.BarcodeDetector({ formats: ['ean_13', 'code_128', 'qr_code'] })
      const tick = async () => {
        if (!video.srcObject) return
        const codes = await det.detect(video).catch(() => [])
        if (codes[0]) { setQ(codes[0].rawValue); stream.getTracks().forEach((t) => t.stop()); video.srcObject = null } else requestAnimationFrame(tick)
      }
      tick()
    } catch { setErr('Accès à la caméra refusé.') }
  }
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}><Icon name="scan" size={15} />Scanner</button>
      {open && (
        <Modal title="Scanner un produit" onClose={() => { const v = document.getElementById('scan-video'); v?.srcObject?.getTracks().forEach((t) => t.stop()); setOpen(false) }}>
          <div className="row"><input className="input" autoFocus placeholder="Scannez avec la douchette ou saisissez le code / la référence" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn" onClick={camera}><Icon name="eye" size={15} />Caméra</button></div>
          <video id="scan-video" muted playsInline style={{ width: '100%', maxHeight: 240, marginTop: 10, borderRadius: 10, background: '#000', display: 'block' }} />
          {err && <div className="muted small" style={{ marginTop: 8 }}>{err}</div>}
          {q && (found ? (
            <div className="insight" style={{ marginTop: 12 }}>
              <div className="ii" style={{ background: 'var(--soft)' }}><Icon name="box" size={16} /></div>
              <div style={{ flex: 1 }}><b>{found.name}</b><div className="muted small">{found.ref} · stock {int(productStock(found))} · {money(found.price)} HT</div></div>
            </div>
          ) : <div className="muted small" style={{ marginTop: 10 }}>Aucun produit pour « {q} ».</div>)}
        </Modal>
      )}
    </>
  )
}

function Categories() {
  const { db, mutate, toast, log } = useStore()
  const [ren, setRen] = useState(null)
  const cats = [...new Set(db.products.map((p) => p.category))].sort().map((c) => {
    const ps = db.products.filter((p) => p.category === c)
    return { id: c, name: c, count: ps.length, units: ps.reduce((s, p) => s + productStock(p), 0), value: ps.reduce((s, p) => s + productStock(p) * p.cost, 0), low: ps.filter((p) => productStock(p) < p.minStock).length }
  })
  return (
    <>
      <DataTable rows={cats} exportName="categories" onRowClick={(c) => setRen({ from: c.name, to: c.name })}
        columns={[
          { key: 'name', label: 'Catégorie', strong: true },
          { key: 'count', label: 'Produits', right: true },
          { key: 'units', label: 'Unités en stock', right: true, render: (c) => int(c.units) },
          { key: 'value', label: 'Valeur (coût)', right: true, render: (c) => money(c.value) },
          { key: 'low', label: 'Sous le seuil', right: true, render: (c) => (c.low ? <Badge color="red">{c.low}</Badge> : '—') },
        ]} />
      {ren && (
        <Modal title="Renommer la catégorie" onClose={() => setRen(null)} footer={<><button className="btn" onClick={() => setRen(null)}>Annuler</button><button className="btn primary" onClick={() => { mutate((d) => { d.products.forEach((p) => { if (p.category === ren.from) p.category = ren.to }) }); log(`Catégorie « ${ren.from} » renommée en « ${ren.to} »`, 'layers'); toast('Catégorie renommée'); setRen(null) }}>Renommer</button></>}>
          <Field label="Nouveau nom"><input className="input" value={ren.to} onChange={(e) => setRen({ ...ren, to: e.target.value })} /></Field>
          <p className="muted small">Le nouveau nom s'applique à tous les produits de la catégorie. Pour créer une catégorie, saisissez-la sur la fiche d'un produit.</p>
        </Modal>
      )}
    </>
  )
}
