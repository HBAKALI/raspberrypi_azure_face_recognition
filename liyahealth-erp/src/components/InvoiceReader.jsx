// LIYA IA — lecture automatique de factures fournisseurs (PDF / image) → facture fournisseur en brouillon.
import { useRef, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { go } from '../lib/nav.js'
import { Badge, Card, Field, Icon, Kpi, Progress } from './ui.jsx'
import { TODAY, addDays, money, previewNumber, uid } from '../lib/domain.js'
import { aiConfigured, explainError } from '../ai/claude.js'
import { extractInvoice } from '../ai/invoice.js'

const QUOTA = 200
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

function matchSupplier(db, name) {
  const n = norm(name)
  if (!n) return ''
  const first = n.split(' ')[0]
  return (db.suppliers.find((s) => norm(s.name) === n) || db.suppliers.find((s) => n.includes(norm(s.name).split(' ')[0]) || norm(s.name).includes(first)))?.id || ''
}
function matchProduct(db, line) {
  const ref = norm(line.ref)
  if (ref) { const p = db.products.find((x) => norm(x.ref) === ref || ref.includes(norm(x.ref))); if (p) return p.id }
  const words = norm(line.label).split(' ').filter((w) => w.length > 3)
  let best = '', score = 0
  for (const p of db.products) {
    const pn = norm(p.name)
    const s = words.filter((w) => pn.includes(w)).length
    if (s > score) { score = s; best = p.id }
  }
  return score >= 2 ? best : ''
}

const DEMO = {
  supplier_name: 'Shenzhen Comen Medical Instruments Co., Ltd.', supplier_ice: '', invoice_number: 'CM-INV-2026-08817', date: addDays(TODAY, -3), due_date: addDays(TODAY, 57), currency: 'MAD',
  lines: [
    { ref: 'MON-C80', label: 'Multi-parameter patient monitor C80 12.1"', qty: 6, unit_price_ht: 38000, tva_rate: 20 },
    { ref: 'ECG-12', label: 'ECG machine CM1200B 12-channel', qty: 2, unit_price_ht: 16500, tva_rate: 20 },
    { ref: 'CS-SPO2', label: 'Reusable adult SpO2 sensor', qty: 40, unit_price_ht: 380, tva_rate: 20 },
  ],
  totals: { ht: 276200, tva: 55240, ttc: 331440 },
  notes: 'Exemple de démonstration (aucun fichier lu). Incoterm CIP Casablanca, montants convertis en MAD.',
}

export default function InvoiceReader() {
  const { db, mutate, toast, log, nextNumber, setSettings } = useStore()
  const input = useRef()
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState(null)
  const [drag, setDrag] = useState(false)
  const online = aiConfigured(db.settings.ai)
  const used = Number(db.settings.aiQuota?.used || 0)
  const left = Math.max(0, QUOTA - used)

  const load = (data, f) => {
    const supplierId = matchSupplier(db, data.supplier_name)
    setRes({
      ...data, supplierId, newSupplier: supplierId ? '' : data.supplier_name,
      lines: (data.lines || []).map((l) => ({ ...l, productId: matchProduct(db, l), qty: Number(l.qty) || 0, unit_price_ht: Number(l.unit_price_ht) || 0, tva_rate: Number(l.tva_rate ?? 20) })),
      fileName: f?.name || '',
    })
  }

  const pick = async (f) => {
    setErr(''); setRes(null)
    if (!f) return
    if (/\.docx?$/i.test(f.name)) return setErr('Les fichiers Word ne sont pas lus directement : exportez la facture en PDF puis déposez-la ici.')
    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(f.type)) return setErr('Format non pris en charge. Déposez un PDF, PNG ou JPG.')
    if (f.size > 20 * 1024 * 1024) return setErr('Fichier trop volumineux (20 Mo maximum).')
    setFile(f)
    if (!online) return setErr('La lecture automatique nécessite Claude : configurez une clé API ou un proxy dans Paramètres › Intelligence artificielle. Vous pouvez charger un exemple pour voir le fonctionnement.')
    if (left <= 0) return setErr('Crédits IA épuisés pour cette période.')
    setBusy(true)
    try {
      const data = await extractInvoice({ ai: db.settings.ai, file: f })
      load(data, f)
      setSettings({ aiQuota: { used: used + 1 } })
      log(`LIYA IA : facture ${data.invoice_number || f.name} lue automatiquement`, 'sparkles')
    } catch (e) { setErr(e.message?.startsWith('La lecture') ? e.message : explainError(e)) }
    setBusy(false)
  }

  const setLine = (i, patch) => setRes({ ...res, lines: res.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) })
  const sum = res ? res.lines.reduce((s, l) => s + l.qty * l.unit_price_ht, 0) : 0
  const sumTva = res ? res.lines.reduce((s, l) => s + l.qty * l.unit_price_ht * (l.tva_rate / 100), 0) : 0
  const gap = res ? Math.abs(sum - Number(res.totals?.ht || 0)) : 0
  const unmatched = res ? res.lines.filter((l) => !l.productId).length : 0

  const create = async () => {
    if (!res.supplierId && !res.newSupplier) return
    const number = previewNumber(db, 'facture_f')
    const supplierId = res.supplierId || uid()
    const docId = uid()
    const fileId = file ? uid() : null
    const sup = db.suppliers.find((s) => s.id === supplierId)
    mutate((d) => {
      if (!res.supplierId) d.suppliers.unshift({ id: supplierId, name: res.newSupplier, country: '', specialty: '', leadTime: 30, currency: res.currency || 'MAD', contact: '', email: '', phone: '', rating: 3, partner: false })
      d.documents.unshift({
        id: docId, type: 'facture_f', number: nextNumber('facture_f', d), partyId: supplierId, date: res.date || TODAY, dueDate: res.due_date || addDays(res.date || TODAY, sup?.leadTime || 60), status: 'Brouillon', paymentMethod: 'Virement',
        lines: res.lines.map((l) => ({ productId: l.productId, label: l.productId ? d.products.find((p) => p.id === l.productId)?.name : l.label, qty: l.qty, price: l.unit_price_ht, discount: 0, tva: l.tva_rate })),
        notes: `Réf. fournisseur ${res.invoice_number || '—'} · lue par LIYA IA${res.fileName ? ` (${res.fileName})` : ''}`,
      })
      if (fileId && d.files) d.files.unshift({ id: fileId, name: file.name, folderId: 'f4', size: file.size, type: file.type, note: `Facture ${res.invoice_number || ''} — ${number}`, date: TODAY, storeKey: fileId, docId })
    })
    if (fileId) { try { const m = await import('../lib/files.js'); await m.putBlob(fileId, file) } catch { /* stockage du fichier optionnel */ } }
    log(`Facture fournisseur ${number} créée depuis un document lu par l'IA`, 'file')
    toast(`Facture fournisseur ${number} créée en brouillon`)
    setRes(null); setFile(null)
    go('purchases', 'facture_f')
  }

  return (
    <div className="stack">
      <div className="grid g3">
        <Kpi label="Crédits IA" value={`${left} / ${QUOTA}`} icon="sparkles" color="violet" foot="1 crédit par facture lue" />
        <Kpi label="Moteur" value={<span style={{ fontSize: 16 }}>{online ? db.settings.ai.model : 'Non connecté'}</span>} icon="brain" color={online ? 'green' : 'amber'} />
        <Kpi label="Formats" value={<span style={{ fontSize: 16 }}>PDF · PNG · JPG</span>} icon="file" color="blue" foot="Word : exporter en PDF" />
      </div>

      <div className="card" onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]) }}
        style={{ padding: 28, textAlign: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: drag ? 'var(--violet)' : 'var(--border)', background: drag ? 'var(--soft)' : undefined }}>
        <Icon name="scan" size={34} />
        <h3 style={{ marginTop: 8 }}>Déposez une facture fournisseur</h3>
        <p className="muted" style={{ margin: '6px 0 14px' }}>LIYA IA lit le fournisseur, les lignes, la TVA et les totaux, puis prépare la facture fournisseur en brouillon.</p>
        <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn ai" disabled={busy} onClick={() => input.current?.click()}><Icon name="upload" size={15} />{busy ? 'Lecture en cours…' : 'Choisir un fichier'}</button>
          <button className="btn" onClick={() => { setErr(''); setFile(null); load(DEMO) }}><Icon name="eye" size={15} />Charger un exemple</button>
        </div>
        <input ref={input} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/*" onChange={(e) => { pick(e.target.files[0]); e.target.value = '' }} />
        {file && <div className="muted small" style={{ marginTop: 10 }}>{file.name} · {(file.size / 1024).toFixed(0)} Ko</div>}
        {busy && <div style={{ maxWidth: 320, margin: '14px auto 0' }}><span className="typing"><span /><span /><span /></span></div>}
        {err && <div className="small" style={{ marginTop: 12, color: 'var(--amber)' }}>{err}</div>}
      </div>

      {res && (
        <Card title={`Facture ${res.invoice_number || 'sans numéro'}`} icon="file" action={<Badge color={gap > 1 || unmatched ? 'amber' : 'green'}>{gap > 1 || unmatched ? 'À vérifier' : 'Cohérente'}</Badge>}>
          <div className="form" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
            <Field label="Fournisseur reconnu">
              <select value={res.supplierId} onChange={(e) => setRes({ ...res, supplierId: e.target.value })}>
                <option value="">— Créer un nouveau fournisseur —</option>
                {db.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            {!res.supplierId && <Field label="Nom du nouveau fournisseur"><input value={res.newSupplier} onChange={(e) => setRes({ ...res, newSupplier: e.target.value })} /></Field>}
            <Field label="N° facture fournisseur"><input value={res.invoice_number} onChange={(e) => setRes({ ...res, invoice_number: e.target.value })} /></Field>
            <Field label="Date"><input type="date" value={res.date} onChange={(e) => setRes({ ...res, date: e.target.value })} /></Field>
            <Field label="Échéance"><input type="date" value={res.due_date} onChange={(e) => setRes({ ...res, due_date: e.target.value })} /></Field>
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>Lu sur le document : « {res.supplier_name} »{res.supplier_ice ? ` · ICE ${res.supplier_ice}` : ''} · devise {res.currency || '—'}</div>

          <div className="table-wrap" style={{ marginTop: 14, border: '1px solid var(--border)', borderRadius: 12 }}>
            <table className="t lines">
              <thead><tr><th>Ligne lue</th><th style={{ width: '32%' }}>Produit ERP</th><th>Qté</th><th>PU HT</th><th>TVA %</th><th className="right">Total HT</th></tr></thead>
              <tbody>{res.lines.map((l, i) => (
                <tr key={i}>
                  <td><b>{l.ref || '—'}</b><div className="muted small">{l.label}</div></td>
                  <td><select value={l.productId} onChange={(e) => setLine(i, { productId: e.target.value })} style={{ borderColor: l.productId ? undefined : 'var(--amber)' }}><option value="">— Non rapproché (libellé conservé) —</option>{db.products.map((p) => <option key={p.id} value={p.id}>{p.ref} — {p.name}</option>)}</select></td>
                  <td><input type="number" value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} style={{ width: 80 }} /></td>
                  <td><input type="number" step="0.01" value={l.unit_price_ht} onChange={(e) => setLine(i, { unit_price_ht: Number(e.target.value) })} style={{ width: 110 }} /></td>
                  <td><input type="number" value={l.tva_rate} onChange={(e) => setLine(i, { tva_rate: Number(e.target.value) })} style={{ width: 70 }} /></td>
                  <td className="right num strong">{money(l.qty * l.unit_price_ht)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          <div className="grid g2" style={{ marginTop: 16 }}>
            <div className="stack" style={{ gap: 8 }}>
              <b>Contrôles</b>
              <div className="row small"><Icon name={gap > 1 ? 'alert' : 'check'} size={15} style={{ color: gap > 1 ? 'var(--amber)' : 'var(--green)' }} />{gap > 1 ? `Écart de ${money(gap)} entre la somme des lignes et le total HT lu (${money(res.totals?.ht)}).` : 'La somme des lignes correspond au total HT lu.'}</div>
              <div className="row small"><Icon name={unmatched ? 'alert' : 'check'} size={15} style={{ color: unmatched ? 'var(--amber)' : 'var(--green)' }} />{unmatched ? `${unmatched} ligne(s) non rapprochée(s) d'un produit du catalogue.` : 'Toutes les lignes sont rapprochées du catalogue.'}</div>
              <div className="row small"><Icon name={res.supplierId ? 'check' : 'alert'} size={15} style={{ color: res.supplierId ? 'var(--green)' : 'var(--amber)' }} />{res.supplierId ? 'Fournisseur reconnu.' : 'Fournisseur inconnu : il sera créé.'}</div>
              {res.notes && <div className="muted small" style={{ lineHeight: 1.5 }}>Notes de lecture : {res.notes}</div>}
              <div style={{ marginTop: 4 }}><div className="small muted">Confiance estimée</div><Progress value={Math.max(0.2, 1 - (gap > 1 ? 0.3 : 0) - unmatched * 0.1 - (res.supplierId ? 0 : 0.15))} /></div>
            </div>
            <div className="card" style={{ padding: 14, alignSelf: 'flex-start' }}>
              <div className="row"><span className="muted">Total HT</span><span className="spacer" /><b className="num">{money(sum)}</b></div>
              <div className="row" style={{ marginTop: 6 }}><span className="muted">TVA</span><span className="spacer" /><span className="num">{money(sumTva)}</span></div>
              <div className="row" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 16 }}><b>Total TTC</b><span className="spacer" /><b className="num" style={{ color: 'var(--teal)' }}>{money(sum + sumTva)}</b></div>
              <div className="muted small" style={{ marginTop: 6 }}>Total TTC lu : {money(res.totals?.ttc)}</div>
              <button className="btn primary" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} disabled={!res.supplierId && !res.newSupplier} onClick={create}><Icon name="check" size={15} />Créer la facture fournisseur ({previewNumber(db, 'facture_f')})</button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
