// Moteur de documents commerciaux partagé par Ventes et Achats.
import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { go, useRoute } from '../lib/nav.js'
import { Badge, DataTable, Field, Icon, Kpi, Modal, PageHead, Tabs, Confirm } from './ui.jsx'
import { DOC_TYPES, PAYMENT_METHODS, previewNumber, TODAY, addDays, docTotals, docPaid, fdate, inWords, lineTotal, money, moneyK, payStatus, productStock, uid } from '../lib/domain.js'
import { stockIn, stockOut } from '../lib/stock.js'

export default function Documents({ kind, title, sub }) {
  const { db, mutate, toast, log, nextNumber } = useStore()
  const route = useRoute()
  const types = Object.entries(DOC_TYPES).filter(([, t]) => t.kind === kind).map(([id]) => id)
  const type = types.includes(route.tab) ? route.tab : types[kind === 'sale' ? 3 : 0]
  const T = DOC_TYPES[type]
  const parties = kind === 'sale' ? db.clients : db.suppliers
  const [edit, setEdit] = useState(null)
  const [view, setView] = useState(null)
  const [pay, setPay] = useState(null)
  const [del, setDel] = useState(null)

  const rows = useMemo(() => db.documents.filter((d) => d.type === type).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)), [db.documents, type])
  const stats = useMemo(() => {
    const valid = rows.filter((d) => !['Annulé', 'Annulée', 'Refusé', 'Brouillon'].includes(d.status))
    const total = valid.reduce((s, d) => s + docTotals(d).ht, 0)
    const month = valid.filter((d) => d.date.slice(0, 7) === TODAY.slice(0, 7)).reduce((s, d) => s + docTotals(d).ht, 0)
    const unpaid = ['facture', 'facture_f'].includes(type) ? valid.reduce((s, d) => s + Math.max(0, docTotals(d).ttc - docPaid(db, d)), 0) : null
    const conv = type === 'devis' ? rows.filter((d) => d.status === 'Accepté').length / Math.max(1, rows.filter((d) => ['Accepté', 'Refusé', 'Expiré'].includes(d.status)).length) : null
    return { total, month, unpaid, conv, count: rows.length, drafts: rows.filter((d) => d.status === 'Brouillon').length }
  }, [rows, db, type])

  const blank = () => {
    const p = parties[0]
    return { type, paymentMethod: 'Virement', partyId: p?.id || '', date: TODAY, dueDate: addDays(TODAY, type === 'devis' ? 30 : p?.paymentTerms || p?.leadTime || 60), status: T.statuses[0], lines: [], notes: type === 'devis' ? 'Offre valable 30 jours. Livraison, installation et formation incluses. Garantie 24 mois pièces et main-d\'œuvre.' : '' }
  }

  // Effets métier lorsqu'un document change de statut
  const applyEffects = (d, doc) => {
    if (doc.stockApplied) return
    if (doc.type === 'bl' && doc.status === 'Livré') { doc.lines.forEach((l) => stockOut(d, l.productId, l.qty, doc.number)); doc.stockApplied = true; registerEquipment(d, doc) }
    if (doc.type === 'reception' && doc.status === 'Reçu') { doc.lines.forEach((l) => stockIn(d, l.productId, l.qty, doc.number, { lot: l.lot, expiry: l.expiry })); doc.stockApplied = true }
    if (doc.type === 'retour' && doc.status === 'Reçu') { doc.lines.forEach((l) => l.productId && stockIn(d, l.productId, l.qty, doc.number, { lot: l.lot || 'RETOUR', expiry: l.expiry, warehouseId: 'w1' })); doc.stockApplied = true }
    if (doc.type === 'retour_f' && doc.status === 'Expédié') { doc.lines.forEach((l) => l.productId && stockOut(d, l.productId, l.qty, doc.number)); doc.stockApplied = true }
  }
  // Les équipements livrés rejoignent automatiquement le parc installé (SAV)
  const registerEquipment = (d, doc) => {
    for (const l of doc.lines) {
      const p = d.products.find((x) => x.id === l.productId)
      if (p?.kind !== 'equip') continue
      for (let i = 0; i < l.qty; i++) d.equipment.unshift({ id: uid(), serial: `${p.ref}-${Math.floor(Math.random() * 900000 + 100000)}`, productId: p.id, clientId: doc.partyId, installDate: TODAY, warrantyEnd: addDays(TODAY, (p.warrantyMonths || 24) * 30), contract: 'Garantie constructeur', nextMaintenance: addDays(TODAY, 180), location: '', status: 'Actif' })
    }
  }

  const save = () => {
    if (!edit.partyId) return toast('Sélectionnez un tiers')
    if (!edit.lines.length) return toast('Ajoutez au moins une ligne')
    mutate((d) => {
      if (edit.id) { const i = d.documents.findIndex((x) => x.id === edit.id); d.documents[i] = { ...edit }; applyEffects(d, d.documents[i]) }
      else { const doc = { ...edit, id: uid(), number: nextNumber(type, d) }; d.documents.unshift(doc); applyEffects(d, doc) }
    })
    log(`${T.label} ${edit.id ? 'modifié' : 'créé'} — ${parties.find((p) => p.id === edit.partyId)?.name}`, 'file')
    toast(`${T.label} enregistré`)
    setEdit(null)
  }

  const setStatus = (doc, status) => {
    mutate((d) => { const x = d.documents.find((y) => y.id === doc.id); x.status = status; applyEffects(d, x) })
    setView({ ...doc, status })
    toast(`Statut : ${status}`)
  }

  const convert = (doc, target) => {
    const nt = target || T.next
    const party = parties.find((p) => p.id === doc.partyId)
    const number = previewNumber(db, nt)
    const created = { ...structuredClone(doc), id: uid(), type: nt, date: TODAY, dueDate: addDays(TODAY, party?.paymentTerms || 60), status: DOC_TYPES[nt].statuses[0], sourceId: doc.id, stockApplied: false, notes: `Réf. ${doc.number}` }
    mutate((d) => {
      d.documents.unshift({ ...created, number: nextNumber(nt, d) })
      const src = d.documents.find((x) => x.id === doc.id)
      if (!target) src.status = { devis: 'Accepté', commande: 'Livrée', bc: 'Reçu' }[doc.type] || src.status
    })
    toast(`${DOC_TYPES[nt].label} ${number} créé`)
    log(`${T.label} ${doc.number} converti en ${DOC_TYPES[nt].label.toLowerCase()} ${number}`, 'arrowRight')
    setView(null)
    go(kind === 'sale' ? 'sales' : 'purchases', nt)
  }

  const duplicate = (doc) => { setView(null); setEdit({ ...structuredClone(doc), id: undefined, number: undefined, date: TODAY, status: T.statuses[0], stockApplied: false }) }

  const columns = [
    { key: 'number', label: 'Numéro', strong: true },
    { key: 'party', label: kind === 'sale' ? 'Client' : 'Fournisseur', sort: (d) => parties.find((p) => p.id === d.partyId)?.name || '', render: (d) => parties.find((p) => p.id === d.partyId)?.name || '—' },
    { key: 'date', label: 'Date', render: (d) => fdate(d.date) },
    { key: 'dueDate', label: type === 'devis' ? 'Validité' : 'Échéance', render: (d) => fdate(d.dueDate) },
    { key: 'ht', label: 'Total HT', right: true, sort: (d) => docTotals(d).ht, render: (d) => money(docTotals(d).ht) },
    { key: 'ttc', label: 'Total TTC', right: true, sort: (d) => docTotals(d).ttc, render: (d) => money(docTotals(d).ttc) },
    { key: 'status', label: 'Statut', render: (d) => <span className="row" style={{ gap: 4 }}><Badge>{d.status}</Badge>{payStatus(db, d) && <Badge>{payStatus(db, d)}</Badge>}</span>, csv: (d) => d.status },
  ]

  return (
    <div className="stack">
      <PageHead title={title} sub={sub}>
        <button className="btn primary" onClick={() => setEdit(blank())}><Icon name="plus" size={15} />{T.label}</button>
      </PageHead>
      <Tabs tabs={types.map((t) => [t, DOC_TYPES[t].plural])} value={type} onChange={(t) => go(kind === 'sale' ? 'sales' : 'purchases', t)} />
      <div className="grid g4">
        <Kpi label={`${T.plural} (HT)`} value={moneyK(stats.total)} icon="file" color="navy" foot={`${stats.count} documents`} />
        <Kpi label="Ce mois-ci (HT)" value={moneyK(stats.month)} icon="calendar" color="teal" />
        {stats.unpaid !== null ? <Kpi label="Reste à régler (TTC)" value={moneyK(stats.unpaid)} icon="wallet" color="amber" /> : stats.conv !== null ? <Kpi label="Taux de transformation" value={`${Math.round(stats.conv * 100)} %`} icon="target" color="green" /> : <Kpi label="En cours" value={rows.filter((d) => !['Livré', 'Livrée', 'Reçu', 'Annulé', 'Annulée'].includes(d.status)).length} icon="clock" color="amber" />}
        <Kpi label="Brouillons" value={stats.drafts} icon="edit" color="gray" />
      </div>
      <DataTable rows={rows} columns={columns} onRowClick={setView} exportName={T.plural} searchKeys={['number', (d) => parties.find((p) => p.id === d.partyId)?.name]} filters={[{ key: 'status', label: 'Statut', options: T.statuses }]} />

      {edit && <Editor doc={edit} setDoc={setEdit} kind={kind} T={T} parties={parties} onSave={save} onClose={() => setEdit(null)} />}

      {view && (
        <Modal size="xl" title={`${T.label} ${view.number}`} onClose={() => setView(null)}
          footer={<>
            <button className="btn danger" onClick={() => setDel(view)}><Icon name="trash" size={15} /></button>
            <button className="btn" onClick={() => duplicate(view)}><Icon name="copy" size={15} />Dupliquer</button>
            <div className="spacer" />
            <select className="input" style={{ width: 'auto' }} value={view.status} onChange={(e) => setStatus(view, e.target.value)}>{T.statuses.map((s) => <option key={s}>{s}</option>)}</select>
            {['facture', 'facture_f'].includes(view.type) && view.status === 'Validée' && payStatus(db, view) !== 'Payée' && <button className="btn" onClick={() => setPay(view)}><Icon name="money" size={15} />Paiement</button>}
            <button className="btn" onClick={() => { setEdit(structuredClone(view)); setView(null) }} disabled={view.stockApplied}><Icon name="edit" size={15} />Modifier</button>
            <button className="btn" onClick={() => window.print()}><Icon name="printer" size={15} />Imprimer / PDF</button>
            {(view.type === 'facture' || view.type === 'facture_f' || view.type === 'bl' || view.type === 'reception') && <button className="btn" onClick={() => convert(view, kind === 'sale' ? 'retour' : 'retour_f')}><Icon name="refresh" size={15} />Retour</button>}
            {T.next && <button className="btn primary" onClick={() => convert(view)}><Icon name="arrowRight" size={15} />{DOC_TYPES[T.next].label}</button>}
          </>}>
          <PrintDoc doc={db.documents.find((x) => x.id === view.id) || view} />
        </Modal>
      )}
      {pay && <PaymentModal doc={pay} onClose={() => setPay(null)} />}
      {del && <Confirm text={`Supprimer ${del.number} ? Les mouvements de stock déjà passés ne sont pas annulés.`} onClose={() => setDel(null)} onYes={() => { mutate((d) => { d.documents = d.documents.filter((x) => x.id !== del.id); d.payments = d.payments.filter((p) => p.docId !== del.id) }); setView(null); toast('Document supprimé') }} />}
    </div>
  )
}

function Editor({ doc, setDoc, kind, T, parties, onSave, onClose }) {
  const { db } = useStore()
  const set = (k, v) => setDoc({ ...doc, [k]: v })
  const setLine = (i, patch) => setDoc({ ...doc, lines: doc.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) })
  const addLine = () => setDoc({ ...doc, lines: [...doc.lines, { productId: '', label: '', qty: 1, price: 0, discount: 0, tva: 20 }] })
  const pickProduct = (i, id) => { const p = db.products.find((x) => x.id === id); setLine(i, { productId: id, label: p?.name || '', price: kind === 'sale' ? p?.price : p?.cost, tva: p?.tva ?? 20 }) }
  const tot = docTotals(doc)
  const party = parties.find((p) => p.id === doc.partyId)
  const products = kind === 'purchase' && doc.partyId ? [...db.products].sort((a, b) => (b.supplierId === doc.partyId) - (a.supplierId === doc.partyId)) : db.products

  return (
    <Modal size="xl" title={doc.id ? `Modifier ${doc.number}` : `Nouveau — ${T.label}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={onSave}><Icon name="check" size={15} />Enregistrer</button></>}>
      <div className="form" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
        <Field label={kind === 'sale' ? 'Client' : 'Fournisseur'}>
          <select value={doc.partyId} onChange={(e) => { const p = parties.find((x) => x.id === e.target.value); setDoc({ ...doc, partyId: e.target.value, dueDate: addDays(doc.date, p?.paymentTerms || p?.leadTime || 60) }) }}>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Date"><input type="date" value={doc.date} onChange={(e) => set('date', e.target.value)} /></Field>
        <Field label={T.label === 'Devis' ? 'Valable jusqu\'au' : 'Échéance'}><input type="date" value={doc.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></Field>
        <Field label="Statut"><select value={doc.status} onChange={(e) => set('status', e.target.value)}>{T.statuses.map((s) => <option key={s}>{s}</option>)}</select></Field>
        {['facture', 'facture_f', 'devis', 'commande', 'bc'].includes(doc.type) && <Field label="Mode de paiement"><select value={doc.paymentMethod || 'Virement'} onChange={(e) => set('paymentMethod', e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>}
      </div>
      {party && <div className="muted small" style={{ marginTop: 8 }}>{party.city || party.country} · {kind === 'sale' ? `ICE ${party.ice} · paiement ${party.paymentTerms} j` : `${party.currency} · délai ${party.leadTime} j`}</div>}

      <div className="table-wrap" style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 12 }}>
        <table className="t lines">
          <thead><tr><th style={{ width: '34%' }}>Produit</th><th>Qté</th><th>PU HT</th><th>Remise %</th><th>TVA %</th>{doc.type === 'reception' && <><th>Lot</th><th>Péremption</th></>}<th className="right">Total HT</th><th /></tr></thead>
          <tbody>
            {doc.lines.map((l, i) => {
              const p = db.products.find((x) => x.id === l.productId)
              const short = kind === 'sale' && p && ['bl', 'commande', 'facture'].includes(doc.type) && Number(l.qty) > productStock(p)
              return (
                <tr key={i}>
                  <td>
                    <select value={l.productId} onChange={(e) => pickProduct(i, e.target.value)}>
                      <option value="">— Choisir —</option>
                      {products.map((x) => <option key={x.id} value={x.id}>{x.ref} — {x.name}</option>)}
                    </select>
                    {short && <div className="small" style={{ color: 'var(--red)', marginTop: 3 }}>Stock disponible : {productStock(p)}</div>}
                  </td>
                  <td><input type="number" min="0" value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} style={{ width: 80 }} /></td>
                  <td><input type="number" min="0" step="0.01" value={l.price} onChange={(e) => setLine(i, { price: Number(e.target.value) })} style={{ width: 110 }} /></td>
                  <td><input type="number" min="0" max="100" value={l.discount} onChange={(e) => setLine(i, { discount: Number(e.target.value) })} style={{ width: 70 }} /></td>
                  <td><select value={l.tva} onChange={(e) => setLine(i, { tva: Number(e.target.value) })} style={{ width: 70 }}>{[20, 14, 10, 7, 0].map((t) => <option key={t} value={t}>{t}</option>)}</select></td>
                  {doc.type === 'reception' && <><td><input value={l.lot || ''} onChange={(e) => setLine(i, { lot: e.target.value })} style={{ width: 100 }} placeholder="Auto" /></td><td><input type="date" value={l.expiry || ''} onChange={(e) => setLine(i, { expiry: e.target.value })} /></td></>}
                  <td className="right num strong">{money(lineTotal(l).ht)}</td>
                  <td><button className="btn sm ghost danger" onClick={() => setDoc({ ...doc, lines: doc.lines.filter((_, j) => j !== i) })}><Icon name="x" size={14} /></button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button className="btn sm" style={{ marginTop: 10 }} onClick={addLine}><Icon name="plus" size={14} />Ajouter une ligne</button>

      <div className="row wrap" style={{ marginTop: 16, alignItems: 'flex-start' }}>
        <Field label="Notes / conditions"><textarea value={doc.notes} onChange={(e) => set('notes', e.target.value)} style={{ minWidth: 320 }} /></Field>
        <div className="spacer" />
        <div className="card" style={{ padding: 14, minWidth: 260 }}>
          <div className="row"><span className="muted">Total HT</span><span className="spacer" /><b className="num">{money(tot.ht)}</b></div>
          <div className="row" style={{ marginTop: 6 }}><span className="muted">TVA</span><span className="spacer" /><span className="num">{money(tot.tva)}</span></div>
          <div className="row" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 16 }}><b>Total TTC</b><span className="spacer" /><b className="num" style={{ color: 'var(--teal)' }}>{money(tot.ttc)}</b></div>
        </div>
      </div>
    </Modal>
  )
}

// Modèles de document : « moderne » (bandeau couleur), « classique » (encadrés), « minimal » (sobre).
export const INVOICE_TEMPLATES = [
  ['moderne', 'Moderne', 'Bandeau navy / teal / vert, en-têtes de tableau foncés'],
  ['classique', 'Classique', 'Encadrés noirs, typographie sobre, idéal marchés publics'],
  ['minimal', 'Minimal', 'Épuré, beaucoup d\'espace, filet d\'accent'],
]

export function PrintDoc({ doc, template }) {
  const { db } = useStore()
  const T = DOC_TYPES[doc.type]
  const co = db.settings.company
  const g = db.settings.general || {}
  const tpl = template || db.settings.invoiceTemplate || 'moderne'
  const party = (T.kind === 'sale' ? db.clients : db.suppliers).find((p) => p.id === doc.partyId)
  const tot = docTotals(doc)
  const paid = docPaid(db, doc)
  const ink = tpl === 'classique' ? '#111' : '#0b2545'
  const accent = tpl === 'classique' ? '#111' : '#13a89e'
  const th = tpl === 'moderne' ? { background: '#0b2545', color: '#fff' } : tpl === 'classique' ? { background: '#fff', color: '#111', border: '1px solid #111' } : { background: 'transparent', color: '#64748b', borderBottom: '2px solid #13a89e' }
  const td = tpl === 'classique' ? { border: '1px solid #111' } : {}
  const font = tpl === 'classique' ? 'Georgia, "Times New Roman", serif' : 'inherit'
  const box = tpl === 'classique' ? { border: '1px solid #111', borderRadius: 0, background: '#fff' } : tpl === 'minimal' ? { background: 'transparent', borderLeft: '3px solid #13a89e', borderRadius: 0 } : { background: '#f4f7fb', borderRadius: 10 }
  const Logo = () => (g.logo
    ? <img src={g.logo} alt="Logo" style={{ maxHeight: 54, maxWidth: 180, objectFit: 'contain' }} />
    : <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: tpl === 'classique' ? 4 : 10, background: tpl === 'classique' ? '#111' : 'linear-gradient(135deg,#13a89e,#3bb273)', display: 'grid', placeItems: 'center', color: '#fff' }}><Icon name="pulse" size={22} stroke={2.6} /></div>
        <div><div style={{ fontWeight: 800, fontSize: 18, color: ink }}>LIYA HEALTH</div><div style={{ fontSize: 11, color: accent, fontWeight: 600 }}>{co.tagline}</div></div>
      </div>)
  return (
    <div className="print-area">
      <div className="print-doc" style={{ borderRadius: 12, border: '1px solid #e3e9f1', fontFamily: font }}>
        {tpl === 'moderne' && <div className="print-band" />}
        {tpl === 'minimal' && <div style={{ height: 2, width: 64, background: '#13a89e' }} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, gap: 20, flexWrap: 'wrap' }}>
          <div>
            <Logo />
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 10, lineHeight: 1.6 }}>{co.address}<br />{co.phone} · {co.email}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: tpl === 'minimal' ? 28 : 22, fontWeight: tpl === 'minimal' ? 300 : 800, color: ink, textTransform: tpl === 'minimal' ? 'none' : 'uppercase', letterSpacing: tpl === 'classique' ? '.08em' : 0 }}>{T.label}</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>N° {doc.number}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Date : {fdate(doc.date)}<br />{doc.type === 'devis' ? 'Validité' : 'Échéance'} : {fdate(doc.dueDate)}{doc.paymentMethod ? <><br />Règlement : {doc.paymentMethod}</> : null}</div>
          </div>
        </div>
        <div style={{ marginTop: 20, padding: 14, maxWidth: 380, marginLeft: 'auto', ...box }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>{T.kind === 'sale' ? 'Client' : 'Fournisseur'}</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>{party?.name}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{party?.contact}<br />{party?.city || party?.country}{party?.ice ? <><br />ICE : {party.ice}</> : null}</div>
        </div>
        <table>
          <thead><tr>{['Réf.', 'Désignation', 'Qté', 'PU HT', 'Remise', 'Total HT'].map((h, i) => <th key={h} style={{ ...th, textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
          <tbody>
            {doc.lines.map((l, i) => {
              const p = db.products.find((x) => x.id === l.productId)
              return <tr key={i}><td style={td}>{p?.ref}</td><td style={td}>{l.label}{p?.dmClass ? <div style={{ fontSize: 10.5, color: '#64748b' }}>DM classe {p.dmClass} · {p.ammps}{l.lot ? ` · Lot ${l.lot}` : ''}</div> : null}</td><td style={{ ...td, textAlign: 'right' }}>{l.qty}</td><td style={{ ...td, textAlign: 'right' }}>{money(l.price)}</td><td style={{ ...td, textAlign: 'right' }}>{l.discount ? `${l.discount} %` : '—'}</td><td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{money(lineTotal(l).ht)}</td></tr>
            })}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, gap: 20, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, maxWidth: 420 }}>
            <div style={{ fontWeight: 700 }}>Arrêté le présent document à la somme de :</div>
            <div style={{ fontStyle: 'italic', marginTop: 4 }}>{inWords(Math.abs(tot.ttc))} TTC</div>
            {doc.notes && <div style={{ marginTop: 12, color: '#64748b', whiteSpace: 'pre-wrap' }}>{doc.notes}</div>}
            {T.kind === 'sale' && g.paymentTerms && <div style={{ marginTop: 10, color: '#64748b' }}>{g.paymentTerms}</div>}
            {T.kind === 'sale' && g.rib && <div style={{ marginTop: 6 }}><b>RIB :</b> {g.rib} — {co.bank}</div>}
          </div>
          <div style={{ minWidth: 240 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Total HT</span><b>{money(tot.ht)}</b></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>TVA</span><span>{money(tot.tva)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: tpl === 'minimal' ? 'transparent' : ink, color: tpl === 'minimal' ? ink : '#fff', borderTop: tpl === 'minimal' ? '2px solid #13a89e' : 0, borderRadius: tpl === 'moderne' ? 8 : 0, marginTop: 6 }}><b>Total TTC</b><b>{money(tot.ttc)}</b></div>
            {paid > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#23874f' }}><span>Déjà réglé</span><b>{money(paid)}</b></div>}
            <div style={{ marginTop: 18, textAlign: 'center', fontSize: 11, color: '#64748b' }}>
              Cachet et signature
              <div style={{ height: 80, border: '1px dashed #cbd5e1', borderRadius: 8, marginTop: 6, display: 'grid', placeItems: 'center' }}>{g.stamp ? <img src={g.stamp} alt="Cachet" style={{ maxHeight: 74, maxWidth: 200, objectFit: 'contain' }} /> : null}</div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 28, paddingTop: 10, borderTop: `1px solid ${tpl === 'classique' ? '#111' : '#e3e9f1'}`, fontSize: 10.5, color: '#64748b', textAlign: 'center', lineHeight: 1.6 }}>
          {g.footer && <div style={{ color: ink, fontWeight: 600, marginBottom: 4 }}>{g.footer}</div>}
          {co.name} — Capital {co.capital} — {co.rc} — ICE {co.ice} — TP {co.tp} — CNSS {co.cnss}<br />{co.ammps} · Banque : {co.bank}
        </div>
      </div>
    </div>
  )
}

export function PaymentModal({ doc, onClose }) {
  const { db, add, toast, log } = useStore()
  const rest = Math.max(0, docTotals(doc).ttc - docPaid(db, doc))
  const [f, setF] = useState({ amount: Math.round(rest * 100) / 100, date: TODAY, method: 'Virement' })
  const ok = () => {
    add('payments', { docId: doc.id, partyId: doc.partyId, kind: doc.type === 'facture' ? 'in' : 'out', ...f, amount: Number(f.amount) })
    log(`Paiement de ${money(f.amount)} enregistré sur ${doc.number}`, 'money')
    toast('Paiement enregistré'); onClose()
  }
  return (
    <Modal title={`Paiement — ${doc.number}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={ok}>Enregistrer</button></>}>
      <div className="muted" style={{ marginBottom: 12 }}>Reste à régler : <b>{money(rest)}</b></div>
      <div className="form">
        <Field label="Montant (DH)"><input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Date"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Mode"><select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{['Virement', 'Chèque', 'Effet', 'Espèces', 'Virement international'].map((m) => <option key={m}>{m}</option>)}</select></Field>
      </div>
    </Modal>
  )
}
