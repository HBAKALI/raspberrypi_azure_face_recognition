// Domain helpers shared by every module: formatting, document types, totals, statuses.

export const TODAY = new Date().toISOString().slice(0, 10)

const nf = new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const nf0 = new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 })
export const money = (v) => `${nf.format(Number(v) || 0)} DH`
export const moneyK = (v) => {
  const n = Number(v) || 0
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2).replace('.', ',')} M DH`
  if (Math.abs(n) >= 1e3) return `${nf0.format(n / 1e3)} k DH`
  return `${nf0.format(n)} DH`
}
export const int = (v) => nf0.format(Number(v) || 0)
export const pct = (v, d = 1) => `${((Number(v) || 0) * 100).toFixed(d).replace('.', ',')} %`
export const fdate = (d) => (d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
export const addDays = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10) }
export const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000)
export const monthKey = (d) => d.slice(0, 7)
export const MONTHS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']
export const monthLabel = (k) => `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`
export const lastMonths = (n, from = TODAY) => {
  const out = []
  const d = new Date(from.slice(0, 7) + '-01T00:00:00')
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d); x.setMonth(d.getMonth() - i)
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

// Montant en lettres (français) — utile pour factures et actes d'engagement.
const U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
const T = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt']
function below100(n) {
  if (n < 20) return U[n]
  const t = Math.floor(n / 10), u = n % 10
  if (t === 7 || t === 9) return T[t] + (t === 7 && u === 1 ? '-et-' : '-') + U[10 + u]
  if (u === 0) return T[t] + (t === 8 ? 's' : '')
  return T[t] + (u === 1 && t !== 8 ? '-et-' : '-') + U[u]
}
function below1000(n) {
  const c = Math.floor(n / 100), r = n % 100
  let s = c === 0 ? '' : c === 1 ? 'cent' : U[c] + '-cent' + (r === 0 ? 's' : '')
  if (r) s += (s ? '-' : '') + below100(r)
  return s || 'zéro'
}
export function inWords(amount) {
  const n = Math.floor(Math.abs(amount))
  const cts = Math.round((Math.abs(amount) - n) * 100)
  const parts = []
  const mil = Math.floor(n / 1e6), th = Math.floor((n % 1e6) / 1000), rest = n % 1000
  if (mil) parts.push(below1000(mil) + (mil > 1 ? '-millions' : '-million'))
  if (th) parts.push(th === 1 ? 'mille' : below1000(th).replace(/s$/, '') + '-mille')
  if (rest || !parts.length) parts.push(below1000(rest))
  let s = parts.join('-') + ' dirhams'
  if (cts) s += ' et ' + below100(cts) + ' centimes'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ---------- Documents commerciaux ----------
export const DOC_TYPES = {
  devis: { kind: 'sale', label: 'Devis', plural: 'Devis', prefix: 'DV', next: 'commande', statuses: ['Brouillon', 'Envoyé', 'Accepté', 'Refusé', 'Expiré'] },
  commande: { kind: 'sale', label: 'Commande client', plural: 'Commandes', prefix: 'CC', next: 'bl', statuses: ['Confirmée', 'En préparation', 'Livrée', 'Annulée'] },
  bl: { kind: 'sale', label: 'Bon de livraison', plural: 'Bons de livraison', prefix: 'BL', next: 'facture', statuses: ['Brouillon', 'Livré', 'Annulé'] },
  facture: { kind: 'sale', label: 'Facture', plural: 'Factures', prefix: 'FA', next: null, statuses: ['Brouillon', 'Validée', 'Annulée'] },
  avoir: { kind: 'sale', label: 'Avoir', plural: 'Avoirs', prefix: 'AV', next: null, statuses: ['Brouillon', 'Validé'] },
  bc: { kind: 'purchase', label: 'Bon de commande', plural: 'Bons de commande', prefix: 'BC', next: 'reception', statuses: ['Brouillon', 'Envoyé', 'Confirmé', 'Reçu', 'Annulé'] },
  reception: { kind: 'purchase', label: 'Bon de réception', plural: 'Réceptions', prefix: 'BR', next: 'facture_f', statuses: ['Brouillon', 'Reçu', 'Annulé'] },
  facture_f: { kind: 'purchase', label: 'Facture fournisseur', plural: 'Factures fournisseurs', prefix: 'FF', next: null, statuses: ['Brouillon', 'Validée', 'Annulée'] },
}

// Numéro que recevra le prochain document de ce type (affichage uniquement)
export const previewNumber = (db, type) => `${DOC_TYPES[type].prefix}-${TODAY.slice(0, 4)}-${String((db.settings.counters[type] || 0) + 1).padStart(4, '0')}`

export function lineTotal(l) {
  const ht = (Number(l.qty) || 0) * (Number(l.price) || 0) * (1 - (Number(l.discount) || 0) / 100)
  return { ht, tva: ht * ((l.tva ?? 20) / 100) }
}
export function docTotals(doc) {
  let ht = 0, tva = 0
  for (const l of doc.lines || []) { const t = lineTotal(l); ht += t.ht; tva += t.tva }
  const sign = doc.type === 'avoir' ? -1 : 1
  return { ht: ht * sign, tva: tva * sign, ttc: (ht + tva) * sign }
}
export function docPaid(db, doc) {
  return db.payments.filter((p) => p.docId === doc.id).reduce((s, p) => s + Number(p.amount), 0)
}
// Statut de paiement calculé pour les factures (client ou fournisseur)
export function payStatus(db, doc) {
  if (!['facture', 'facture_f'].includes(doc.type) || doc.status !== 'Validée') return null
  const { ttc } = docTotals(doc)
  const paid = docPaid(db, doc)
  if (paid >= ttc - 0.01) return 'Payée'
  if (doc.dueDate && doc.dueDate < TODAY) return 'En retard'
  return paid > 0 ? 'Partielle' : 'À payer'
}

const STATUS_COLORS = {
  Brouillon: 'gray', Envoyé: 'blue', Accepté: 'green', Refusé: 'red', Expiré: 'gray', Confirmée: 'blue', Confirmé: 'blue',
  'En préparation': 'amber', Livrée: 'green', Livré: 'green', Annulée: 'gray', Annulé: 'gray', Validée: 'teal', Validé: 'teal',
  Reçu: 'green', Payée: 'green', 'En retard': 'red', Partielle: 'amber', 'À payer': 'blue',
  Veille: 'gray', 'En préparation AO': 'amber', Déposé: 'blue', Gagné: 'green', Perdu: 'red', Infructueux: 'gray',
  Actif: 'green', 'En maintenance': 'amber', 'Hors service': 'red', 'Sous garantie': 'teal', Planifiée: 'blue', 'En cours': 'amber', Terminée: 'green',
  Ouvert: 'red', 'En investigation': 'amber', Clôturé: 'green', 'CAPA en cours': 'violet',
  Critique: 'red', Majeure: 'amber', Mineure: 'blue', Haute: 'red', Moyenne: 'amber', Basse: 'gray',
  'En attente': 'amber', Approuvé: 'green', Rejeté: 'red', 'En congé': 'amber', Inactif: 'gray',
  Prospection: 'gray', Qualification: 'blue', Proposition: 'violet', Négociation: 'amber', 'Gagnée': 'green', Perdue: 'red',
}
export const statusColor = (s) => STATUS_COLORS[s] || 'gray'

export const partyOf = (db, doc) => (DOC_TYPES[doc.type]?.kind === 'purchase' ? db.suppliers : db.clients).find((p) => p.id === doc.partyId)
export const productOf = (db, id) => db.products.find((p) => p.id === id)
export const productStock = (p) => (p.lots || []).reduce((s, l) => s + Number(l.qty || 0), 0)
export const stockValue = (db) => db.products.reduce((s, p) => s + productStock(p) * Number(p.cost || 0), 0)
export const nearestExpiry = (p) => (p.lots || []).filter((l) => l.qty > 0 && l.expiry).map((l) => l.expiry).sort()[0]

export function salesInvoices(db) {
  return db.documents.filter((d) => d.type === 'facture' && d.status === 'Validée')
}
export function revenueByMonth(db, months) {
  const map = Object.fromEntries(months.map((m) => [m, 0]))
  for (const d of db.documents) {
    if (!['facture', 'avoir'].includes(d.type) || !['Validée', 'Validé'].includes(d.status)) continue
    const k = monthKey(d.date)
    if (k in map) map[k] += docTotals(d).ht
  }
  return months.map((m) => map[m])
}
// Quantités vendues par produit et par mois (base des prévisions IA)
export function unitsByMonth(db, productId, months) {
  const map = Object.fromEntries(months.map((m) => [m, 0]))
  for (const d of db.documents) {
    if (d.type !== 'facture' || d.status !== 'Validée') continue
    const k = monthKey(d.date)
    if (!(k in map)) continue
    for (const l of d.lines) if (l.productId === productId) map[k] += Number(l.qty)
  }
  return months.map((m) => map[m])
}
