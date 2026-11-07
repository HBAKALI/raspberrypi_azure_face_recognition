// Importer : assistant en 3 étapes (type → correspondance des colonnes → aperçu & import) pour Excel / CSV.
import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useStore } from '../lib/store.jsx'
import { Badge, Card, Icon, Kpi, PageHead, COLORS } from '../components/ui.jsx'
import { DOC_TYPES, TODAY, addDays, int, uid } from '../lib/domain.js'

// [clé, libellé, obligatoire, type, synonymes]
const TYPES = {
  clients: {
    label: 'Clients', icon: 'building', desc: 'CHU, hôpitaux, cliniques, cabinets…',
    fields: [['name', 'Nom / raison sociale', true, 'text', ['nom', 'name', 'raison sociale', 'societe', 'client', 'etablissement']], ['code', 'Code client', false, 'text', ['code', 'code client', 'reference']], ['type', 'Type', false, 'text', ['type', 'categorie', 'segment']], ['city', 'Ville', false, 'text', ['ville', 'city', 'localite']], ['ice', 'ICE', false, 'text', ['ice', 'identifiant commun']], ['phone', 'Téléphone', false, 'text', ['tel', 'telephone', 'phone', 'mobile', 'gsm']], ['email', 'E-mail', false, 'text', ['email', 'e mail', 'mail', 'courriel']], ['contact', 'Contact', false, 'text', ['contact', 'interlocuteur', 'responsable']], ['address', 'Adresse', false, 'text', ['adresse', 'address']], ['paymentTerms', 'Délai de paiement (jours)', false, 'number', ['delai', 'delai de paiement', 'echeance', 'payment terms']], ['creditLimit', 'Plafond de crédit', false, 'number', ['plafond', 'encours max', 'credit limit']]],
  },
  suppliers: {
    label: 'Fournisseurs', icon: 'globe', desc: 'Fabricants et partenaires',
    fields: [['name', 'Nom / raison sociale', true, 'text', ['nom', 'name', 'raison sociale', 'societe', 'fournisseur', 'fabricant']], ['country', 'Pays', false, 'text', ['pays', 'country']], ['specialty', 'Spécialité', false, 'text', ['specialite', 'activite', 'domaine']], ['currency', 'Devise', false, 'text', ['devise', 'currency', 'monnaie']], ['leadTime', 'Délai (jours)', false, 'number', ['delai', 'lead time', 'delai livraison']], ['contact', 'Contact', false, 'text', ['contact', 'interlocuteur']], ['email', 'E-mail', false, 'text', ['email', 'mail', 'courriel']], ['phone', 'Téléphone', false, 'text', ['tel', 'telephone', 'phone']]],
  },
  products: {
    label: 'Produits', icon: 'box', desc: 'Catalogue, prix et stock initial',
    fields: [['ref', 'Référence', true, 'text', ['reference', 'ref', 'sku', 'code', 'code article']], ['name', 'Désignation', true, 'text', ['designation', 'nom', 'name', 'libelle', 'produit', 'article']], ['category', 'Catégorie', false, 'text', ['categorie', 'category', 'famille']], ['cost', 'Prix d\'achat HT', false, 'number', ['cout', 'prix achat', 'prix de revient', 'cost', 'pa']], ['price', 'Prix de vente HT', true, 'number', ['prix', 'price', 'pu', 'prix vente', 'prix unitaire', 'pv']], ['tva', 'TVA %', false, 'number', ['tva', 'vat', 'taxe']], ['minStock', 'Stock minimum', false, 'number', ['stock min', 'minimum', 'seuil', 'stock minimum']], ['stock', 'Stock initial', false, 'number', ['stock', 'quantite', 'qty', 'qte']], ['barcode', 'Code-barres', false, 'text', ['code barre', 'code barres', 'barcode', 'ean', 'gtin']], ['dmClass', 'Classe DM', false, 'text', ['classe', 'classe dm', 'class']]],
  },
}
const DOC_FIELDS = (partyLabel) => [['number', 'N° document', false, 'text', ['numero', 'n', 'no', 'num', 'numero facture', 'facture', 'document', 'reference document']], ['date', 'Date', false, 'date', ['date', 'date facture', 'date document']], ['party', partyLabel, true, 'text', partyLabel === 'Client' ? ['client', 'nom client', 'tiers', 'raison sociale'] : ['fournisseur', 'nom fournisseur', 'tiers', 'raison sociale']], ['ref', 'Réf. produit', false, 'text', ['reference', 'ref', 'sku', 'code article', 'code']], ['product', 'Désignation', true, 'text', ['designation', 'produit', 'article', 'libelle', 'description']], ['qty', 'Quantité', true, 'number', ['quantite', 'qty', 'qte']], ['price', 'Prix unitaire HT', true, 'number', ['prix', 'pu', 'prix unitaire', 'price', 'pu ht']], ['discount', 'Remise %', false, 'number', ['remise', 'discount']], ['tva', 'TVA %', false, 'number', ['tva', 'vat']]]
TYPES.facture = { label: 'Factures (ventes)', icon: 'file', desc: 'Une ligne par article, groupées par n°', doc: true, fields: DOC_FIELDS('Client') }
TYPES.bl = { label: 'Livraisons', icon: 'truck', desc: 'Bons de livraison clients', doc: true, fields: DOC_FIELDS('Client') }
TYPES.facture_f = { label: 'Factures fournisseurs', icon: 'wallet', desc: 'Achats, groupés par n°', doc: true, fields: DOC_FIELDS('Fournisseur') }
const ORDER = ['clients', 'suppliers', 'products', 'facture', 'bl', 'facture_f']

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const parseNum = (v) => { if (v === '' || v == null) return null; const n = Number(String(v).replace(/\s| /g, '').replace(',', '.').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : NaN }
function parseDate(v) {
  if (v === '' || v == null) return null
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` }
  return NaN
}

function autoMap(fields, columns) {
  const used = new Set(), map = {}
  for (const [key, label, , , syn] of fields) {
    const cands = [key, label, ...syn].map(norm)
    let best = '', score = 0
    for (const c of columns) {
      if (used.has(c)) continue
      const n = norm(c)
      const sc = cands.includes(n) ? 3 : cands.some((x) => x.length > 2 && (n.includes(x) || x.includes(n))) ? 2 : 0
      if (sc > score) { score = sc; best = c }
    }
    if (best) { used.add(best); map[key] = best }
  }
  return map
}

export default function Importer() {
  const { db, mutate, toast, log } = useStore()
  const [step, setStep] = useState(1)
  const [type, setType] = useState('')
  const [file, setFile] = useState(null) // { name, columns, rows }
  const [map, setMap] = useState({})
  const [report, setReport] = useState(null)
  const input = useRef()
  const T = TYPES[type]

  const template = (k) => {
    const t = TYPES[k]
    const sample = Object.fromEntries(t.fields.map(([key, label]) => [label, {
      name: 'Clinique Exemple', ref: 'EL-ECG', product: 'Électrodes ECG gel solide (sachet 50)', category: 'Consommables', cost: 48, price: 95, tva: 20, minStock: 200, stock: 500,
      qty: 10, discount: 0, number: `${DOC_TYPES[k]?.prefix || 'XX'}-2026-0001`, date: TODAY, party: k === 'facture_f' ? 'ESHERO' : 'Clinique Exemple', city: 'Casablanca', country: 'Chine', currency: 'USD', leadTime: 35, paymentTerms: 60,
    }[key] ?? '']))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([sample]), t.label.slice(0, 30))
    XLSX.writeFile(wb, `modele-import-${k}.xlsx`)
  }

  const onFile = async (f) => {
    if (!f) return
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true })
      if (!rows.length) return toast('Le fichier ne contient aucune ligne')
      const columns = Object.keys(rows[0])
      setFile({ name: f.name, columns, rows })
      setMap(autoMap(T.fields, columns))
    } catch { toast('Fichier illisible : utilisez un .xlsx, .xls ou .csv') }
  }

  // Lignes mappées + validation
  const mapped = useMemo(() => {
    if (!file || !T) return []
    const existingRefs = new Set(db.products.map((p) => p.ref.toLowerCase()))
    return file.rows.map((r, i) => {
      const v = {}, errors = []
      for (const [key, label, req, kind] of T.fields) {
        const raw = map[key] ? r[map[key]] : ''
        let val = typeof raw === 'string' ? raw.trim() : raw
        if (kind === 'number') { val = parseNum(val); if (Number.isNaN(val)) errors.push(`${label} invalide`) }
        if (kind === 'date') { val = parseDate(val); if (Number.isNaN(val)) errors.push(`${label} invalide`) }
        if (kind === 'text' && val instanceof Date) val = val.toISOString().slice(0, 10)
        if (req && (val === '' || val == null)) errors.push(`${label} manquant`)
        v[key] = val
      }
      if (type === 'products' && v.ref && existingRefs.has(String(v.ref).toLowerCase())) errors.push('Référence déjà existante')
      return { i, v, errors }
    })
  }, [file, map, T, type, db.products])
  const valid = mapped.filter((r) => !r.errors.length)
  const missingRequired = T ? T.fields.filter(([k, , req]) => req && !map[k]) : []

  const runImport = () => {
    const rows = valid.map((r) => r.v)
    if (!rows.length) return toast('Aucune ligne valide à importer')
    const created = []
    let imported = 0, skipped = mapped.length - valid.length
    const sameName = (a, b) => norm(a) === norm(b)

    if (type === 'clients' || type === 'suppliers') {
      const col = type
      const items = []
      for (const r of rows) {
        if (db[col].some((x) => sameName(x.name, r.name)) || items.some((x) => sameName(x.name, r.name))) { skipped++; continue }
        items.push(type === 'clients'
          ? { id: uid(), code: r.code || `CL${String(db.clients.length + items.length + 1).padStart(4, '0')}`, name: String(r.name), type: r.type || 'Clinique privée', city: r.city || '', ice: String(r.ice || ''), phone: String(r.phone || ''), email: r.email || '', contact: r.contact || '', address: r.address || '', paymentTerms: r.paymentTerms ?? 60, creditLimit: r.creditLimit ?? 500000, public: /chu|hopital|hôpital|public/i.test(r.type || '') }
          : { id: uid(), name: String(r.name), country: r.country || '', specialty: r.specialty || '', currency: r.currency || 'MAD', leadTime: r.leadTime ?? 30, contact: r.contact || '', email: r.email || '', phone: String(r.phone || ''), rating: 3, partner: false })
      }
      mutate((d) => { d[col].push(...items) })
      imported = items.length
    } else if (type === 'products') {
      const items = rows.map((r) => {
        const cost = r.cost ?? Math.round(r.price * 0.7 * 100) / 100
        return { id: uid(), ref: String(r.ref), name: String(r.name), category: r.category || 'Consommables', supplierId: '', dmClass: r.dmClass || 'I', ammps: '', ce: true, cost, price: r.price, tva: r.tva ?? 20, minStock: r.minStock ?? 0, unit: 'unité', kind: cost > 3000 ? 'equip' : 'conso', barcode: String(r.barcode || ''), warrantyMonths: cost > 3000 ? 24 : 0, lots: r.stock > 0 ? [{ lot: `IMP${TODAY.replace(/-/g, '').slice(2)}`, expiry: '', qty: r.stock, warehouseId: 'w1' }] : [] }
      })
      mutate((d) => { d.products.push(...items) })
      imported = items.length
    } else {
      // Documents : une ligne = un article ; regroupement par n° (ou client + date si pas de n°)
      const kind = DOC_TYPES[type].kind
      const partyCol = kind === 'sale' ? 'clients' : 'suppliers'
      const parties = [...db[partyCol]]
      const newParties = []
      const groups = new Map()
      for (const r of rows) {
        const key = r.number ? `n:${r.number}` : `p:${norm(r.party)}|${r.date || TODAY}`
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(r)
      }
      let counter = db.settings.counters[type] || 0
      const existingNumbers = new Set(db.documents.map((d) => d.number))
      const docs = []
      for (const lines of groups.values()) {
        const first = lines[0]
        if (first.number && existingNumbers.has(String(first.number))) { skipped += lines.length; continue }
        let party = parties.find((p) => sameName(p.name, first.party))
        if (!party) {
          party = kind === 'sale'
            ? { id: uid(), code: `CL${String(parties.length + 1).padStart(4, '0')}`, name: String(first.party), type: 'Clinique privée', city: '', ice: '', phone: '', email: '', contact: '', paymentTerms: 60, creditLimit: 500000, public: false }
            : { id: uid(), name: String(first.party), country: '', specialty: '', currency: 'MAD', leadTime: 30, contact: '', email: '', phone: '', rating: 3, partner: false }
          parties.push(party); newParties.push(party); created.push(party.name)
        }
        const date = first.date || TODAY
        const number = first.number ? String(first.number) : `${DOC_TYPES[type].prefix}-${TODAY.slice(0, 4)}-${String(++counter).padStart(4, '0')}`
        docs.push({
          id: uid(), type, number, partyId: party.id, date, dueDate: addDays(date, party.paymentTerms || party.leadTime || 60), status: type === 'bl' ? 'Livré' : 'Validée', stockApplied: true, notes: `Importé depuis ${file.name}`,
          ...(type !== 'bl' ? { paymentMethod: 'Virement' } : {}),
          lines: lines.map((l) => {
            const p = db.products.find((x) => (l.ref && x.ref.toLowerCase() === String(l.ref).toLowerCase()) || norm(x.name) === norm(l.product))
            return { productId: p?.id || '', label: p?.name || String(l.product), qty: l.qty, price: l.price, discount: l.discount || 0, tva: l.tva ?? 20 }
          }),
        })
        imported += lines.length
      }
      mutate((d) => { d[partyCol].push(...newParties); d.documents.unshift(...docs); d.settings.counters[type] = counter })
      setReport({ imported, skipped, created, docs: docs.length })
      log(`Import : ${docs.length} ${T.label.toLowerCase()} (${imported} lignes) depuis ${file.name}`, 'upload')
      toast('Import terminé')
      setStep(4)
      return
    }
    setReport({ imported, skipped, created })
    log(`Import : ${imported} ${T.label.toLowerCase()} depuis ${file.name}`, 'upload')
    toast('Import terminé')
    setStep(4)
  }

  const reset = () => { setStep(1); setType(''); setFile(null); setMap({}); setReport(null) }
  const steps = ['Type de données', 'Correspondance des colonnes', 'Aperçu & import']

  return (
    <div className="stack">
      <PageHead title="Importer" sub="Importez vos données Excel ou CSV en 3 étapes : type, correspondance des colonnes, vérification." crumbs="Outils › Importer">
        {step > 1 && <button className="btn" onClick={reset}><Icon name="refresh" size={15} />Recommencer</button>}
      </PageHead>

      <div className="card" style={{ padding: '16px 20px' }}>
        <div className="row wrap" style={{ gap: 0 }}>
          {steps.map((s, i) => {
            const n = i + 1, done = step > n, cur = step === n
            return (
              <div key={s} className="row" style={{ flex: '1 1 180px', gap: 10, padding: '6px 0' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0, background: done ? COLORS.green : cur ? COLORS.teal : 'var(--soft)', color: done || cur ? '#fff' : 'var(--muted)' }}>{done ? <Icon name="check" size={15} /> : n}</div>
                <div style={{ fontWeight: cur ? 700 : 500, color: cur ? 'var(--text)' : 'var(--muted)' }}>{s}</div>
                {n < 3 && <div style={{ flex: 1, height: 2, background: done ? COLORS.green : 'var(--border)', margin: '0 12px', minWidth: 20 }} />}
              </div>
            )
          })}
        </div>
      </div>

      {step === 1 && (
        <div className="grid g3">
          {ORDER.map((k) => {
            const t = TYPES[k]
            return (
              <div key={k} className="card module-card" style={{ outline: type === k ? '2px solid var(--teal)' : 'none' }}>
                <div className="row">
                  <div className="mi" style={{ background: COLORS.teal + '1a', color: COLORS.teal }}><Icon name={t.icon} size={20} /></div>
                  <div style={{ flex: 1 }}><b>{t.label}</b><div className="muted small">{t.desc}</div></div>
                </div>
                <div className="muted small" style={{ lineHeight: 1.5 }}>Champs : {t.fields.map(([, l, req]) => (req ? `${l}*` : l)).join(', ')}</div>
                <div className="row" style={{ marginTop: 'auto' }}>
                  <button className="btn primary sm" onClick={() => { setType(k); setFile(null); setMap({}); setStep(2) }}>Choisir<Icon name="arrowRight" size={13} /></button>
                  <button className="btn sm" onClick={() => template(k)}><Icon name="download" size={13} />Télécharger un modèle</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {step === 2 && T && (
        <div className="stack">
          <div className="card" style={{ padding: 22, border: '2px dashed var(--border)', textAlign: 'center' }}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
            <Icon name="upload" size={28} style={{ color: 'var(--teal)' }} />
            <div style={{ fontWeight: 700, marginTop: 8 }}>{file ? file.name : `Déposez votre fichier de ${T.label.toLowerCase()}`}</div>
            <div className="muted small" style={{ margin: '4px 0 12px' }}>{file ? `${int(file.rows.length)} lignes · ${file.columns.length} colonnes détectées` : 'Formats acceptés : .xlsx, .xls, .csv — la première feuille est lue.'}</div>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn primary sm" onClick={() => input.current?.click()}><Icon name="upload" size={14} />{file ? 'Changer de fichier' : 'Choisir un fichier'}</button>
              <button className="btn sm" onClick={() => template(type)}><Icon name="download" size={14} />Modèle {T.label}</button>
            </div>
            <input ref={input} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { onFile(e.target.files[0]); e.target.value = '' }} />
          </div>

          {file && (
            <Card title="Correspondance des colonnes" icon="link" pad={false} action={<span className="muted small">Détection automatique — ajustez si nécessaire</span>}>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="t">
                  <thead><tr><th>Champ de l'ERP</th><th>Colonne du fichier</th><th>Exemple (1re ligne)</th></tr></thead>
                  <tbody>
                    {T.fields.map(([key, label, req]) => (
                      <tr key={key}>
                        <td className="strong">{label}{req && <span style={{ color: 'var(--red)' }}> *</span>}</td>
                        <td><select className="input" style={{ maxWidth: 280, borderColor: req && !map[key] ? 'var(--red)' : undefined }} value={map[key] || ''} onChange={(e) => setMap({ ...map, [key]: e.target.value })}>
                          <option value="">— Ignorer —</option>
                          {file.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select></td>
                        <td className="muted small">{map[key] ? String(file.rows[0][map[key]] instanceof Date ? file.rows[0][map[key]].toISOString().slice(0, 10) : file.rows[0][map[key]]) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row" style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
                {missingRequired.length > 0 && <span className="small" style={{ color: 'var(--red)' }}>Champs obligatoires non associés : {missingRequired.map((f) => f[1]).join(', ')}</span>}
                <span className="spacer" />
                <button className="btn" onClick={() => setStep(1)}>Retour</button>
                <button className="btn primary" disabled={missingRequired.length > 0} onClick={() => setStep(3)}>Aperçu<Icon name="arrowRight" size={14} /></button>
              </div>
            </Card>
          )}
        </div>
      )}

      {step === 3 && T && file && (
        <div className="stack">
          <div className="grid g3">
            <Kpi label="Lignes lues" value={int(mapped.length)} icon="file" color="navy" />
            <Kpi label="Lignes valides" value={int(valid.length)} icon="check" color="green" />
            <Kpi label="Lignes en erreur" value={int(mapped.length - valid.length)} icon="alert" color="red" foot={mapped.length - valid.length ? 'Elles seront ignorées' : ''} />
          </div>
          <Card title={`Aperçu — ${T.label}`} icon="eye" pad={false} action={<span className="muted small">20 premières lignes</span>}>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="t">
                <thead><tr><th>#</th>{T.fields.filter(([k]) => map[k]).map(([k, l]) => <th key={k}>{l}</th>)}<th>Contrôle</th></tr></thead>
                <tbody>
                  {mapped.slice(0, 20).map((r) => (
                    <tr key={r.i} style={{ background: r.errors.length ? 'color-mix(in srgb, var(--red) 9%, transparent)' : undefined }}>
                      <td className="muted">{r.i + 2}</td>
                      {T.fields.filter(([k]) => map[k]).map(([k]) => <td key={k}>{r.v[k] == null || Number.isNaN(r.v[k]) ? '—' : String(r.v[k])}</td>)}
                      <td>{r.errors.length ? <span className="small" style={{ color: 'var(--red)' }}>{r.errors.join(' · ')}</span> : <Badge color="green">OK</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row" style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
              {T.doc && <span className="muted small">Les lignes sont regroupées par n° de document ; un tiers inconnu est créé automatiquement.</span>}
              <span className="spacer" />
              <button className="btn" onClick={() => setStep(2)}>Retour</button>
              <button className="btn primary" disabled={!valid.length} onClick={runImport}><Icon name="upload" size={15} />Importer {int(valid.length)} ligne(s)</button>
            </div>
          </Card>
        </div>
      )}

      {step === 4 && report && (
        <Card title="Import terminé" icon="check">
          <div className="grid g3">
            <Kpi label={T?.doc ? 'Lignes importées' : 'Éléments importés'} value={int(report.imported)} icon="check" color="green" foot={report.docs != null ? `${report.docs} document(s) créé(s)` : ''} />
            <Kpi label="Lignes ignorées" value={int(report.skipped)} icon="x" color="amber" foot="Erreurs ou doublons" />
            <Kpi label="Tiers créés" value={int(report.created.length)} icon="users" color="blue" foot={report.created.slice(0, 3).join(', ')} />
          </div>
          <div className="row" style={{ marginTop: 16 }}><button className="btn primary" onClick={reset}><Icon name="upload" size={15} />Nouvel import</button></div>
        </Card>
      )}
    </div>
  )
}
