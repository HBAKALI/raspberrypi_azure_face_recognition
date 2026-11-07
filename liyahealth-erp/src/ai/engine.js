// Moteur IA embarqué (fonctionne hors ligne, sans clé API) :
// prévision de la demande, réapprovisionnement, péremption, risque client, anomalies, scoring AO.
// Ces résultats alimentent aussi le contexte envoyé à Claude lorsque l'assistant en ligne est activé.
import {
  TODAY, addDays, daysBetween, docTotals, docPaid, lastMonths, monthLabel, productStock, revenueByMonth, unitsByMonth, money, moneyK, int, fdate, payStatus,
} from '../lib/domain.js'

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))) }

// Lissage exponentiel double (Holt) : niveau + tendance, avec intervalle d'erreur empirique.
export function holt(series, horizon = 3, alpha = 0.5, beta = 0.3) {
  if (series.length < 2) return { forecast: Array(horizon).fill(series[0] || 0), fitted: series, error: 0 }
  let level = series[0], trend = series[1] - series[0]
  const fitted = [series[0]]
  for (let i = 1; i < series.length; i++) {
    const prev = level
    fitted.push(level + trend)
    level = alpha * series[i] + (1 - alpha) * (level + trend)
    trend = beta * (level - prev) + (1 - beta) * trend
  }
  const residuals = series.map((v, i) => v - fitted[i]).slice(1)
  const error = std(residuals)
  const forecast = Array.from({ length: horizon }, (_, h) => Math.max(0, level + (h + 1) * trend))
  // WAPE : erreur absolue pondérée, plus robuste que le MAPE sur des ventes irrégulières
  const mape = series.slice(1).reduce((s, v, i) => s + Math.abs(v - fitted[i + 1]), 0) / Math.max(1, series.slice(1).reduce((s, v) => s + v, 0))
  return { forecast, fitted, error, trend, mape }
}

export function revenueForecast(db, horizon = 3) {
  const months = lastMonths(12)
  const hist = revenueByMonth(db, months)
  const { forecast, error, mape, trend } = holt(hist.slice(0, -1), horizon + 1) // le mois en cours est incomplet
  const future = []
  const d = new Date(months.at(-1) + '-01T00:00:00')
  for (let i = 0; i <= horizon; i++) { const x = new Date(d); x.setMonth(d.getMonth() + i); future.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`) }
  return { months, hist, futureMonths: future, forecast, error, accuracy: Math.max(0, 1 - (mape || 0)), trend }
}

export function onOrder(db, productId) {
  return db.documents.filter((d) => d.type === 'bc' && ['Envoyé', 'Confirmé', 'Brouillon'].includes(d.status))
    .reduce((s, d) => s + d.lines.filter((l) => l.productId === productId).reduce((x, l) => x + Number(l.qty), 0), 0)
}

// Plan de réapprovisionnement : point de commande = demande pendant le délai + stock de sécurité (service 95 %).
export function reorderPlan(db) {
  const months = lastMonths(7).slice(0, -1)
  return db.products.map((p) => {
    const hist = unitsByMonth(db, p.id, months)
    const { forecast } = holt(hist, 2)
    const monthly = Math.max(mean(hist.slice(-3)), forecast[0])
    const sup = db.suppliers.find((s) => s.id === p.supplierId)
    const lead = sup?.leadTime || 30
    const daily = monthly / 30
    const safety = Math.ceil(1.65 * std(hist) * Math.sqrt(lead / 30))
    const reorderPoint = Math.ceil(daily * lead + safety)
    const stock = productStock(p)
    const incoming = onOrder(db, p.id)
    const cover = daily > 0 ? Math.floor(stock / daily) : Infinity
    const target = Math.ceil(daily * (lead + 60) + safety)
    const qty = Math.max(0, target - stock - incoming, stock + incoming < p.minStock ? p.minStock - stock - incoming : 0)
    const urgency = stock <= 0 ? 'Critique' : stock + incoming <= reorderPoint ? (cover < lead ? 'Haute' : 'Moyenne') : 'Basse'
    return { product: p, supplier: sup, hist, monthly, forecast, lead, safety, reorderPoint, stock, incoming, cover, qty: stock + incoming <= Math.max(reorderPoint, p.minStock) ? qty : 0, urgency, value: qty * p.cost }
  }).sort((a, b) => ['Critique', 'Haute', 'Moyenne', 'Basse'].indexOf(a.urgency) - ['Critique', 'Haute', 'Moyenne', 'Basse'].indexOf(b.urgency) || a.cover - b.cover)
}

// Lots à risque de péremption : quantité qui ne sera pas consommée avant la date limite.
export function expiryRisks(db) {
  const months = lastMonths(4).slice(0, -1)
  const out = []
  for (const p of db.products) {
    const daily = mean(unitsByMonth(db, p.id, months)) / 30
    for (const l of p.lots || []) {
      if (!l.expiry || l.qty <= 0) continue
      const days = daysBetween(TODAY, l.expiry)
      if (days > 240) continue
      const consumable = Math.max(0, Math.floor(daily * Math.max(days, 0)))
      const atRisk = Math.max(0, l.qty - consumable)
      if (days < 0 || atRisk > 0) out.push({ product: p, lot: l, days, atRisk: days < 0 ? l.qty : atRisk, value: (days < 0 ? l.qty : atRisk) * p.cost, expired: days < 0 })
    }
  }
  return out.sort((a, b) => a.days - b.days)
}

// Risque client : retards de paiement, encours, échu.
export function clientRisk(db) {
  return db.clients.map((c) => {
    const inv = db.documents.filter((d) => d.type === 'facture' && d.status === 'Validée' && d.partyId === c.id)
    let outstanding = 0, overdue = 0, delays = []
    for (const d of inv) {
      const ttc = docTotals(d).ttc, paid = docPaid(db, d)
      outstanding += ttc - paid
      if (ttc - paid > 1 && d.dueDate < TODAY) overdue += ttc - paid
      const pays = db.payments.filter((p) => p.docId === d.id)
      if (pays.length) delays.push(daysBetween(d.dueDate, pays.at(-1).date))
    }
    const avgDelay = mean(delays)
    const revenue = inv.reduce((s, d) => s + docTotals(d).ht, 0)
    const last = inv.map((d) => d.date).sort().at(-1)
    const score = Math.min(100, Math.round((overdue / Math.max(outstanding, 1)) * 45 + Math.max(0, avgDelay) * 0.6 + (outstanding / c.creditLimit) * 30))
    return { client: c, outstanding, overdue, avgDelay, revenue, last, invoices: inv.length, score, level: score >= 60 ? 'Haute' : score >= 30 ? 'Moyenne' : 'Basse' }
  }).sort((a, b) => b.score - a.score)
}

// Détection d'anomalies sur les documents commerciaux.
export function anomalies(db) {
  const out = []
  const inv = db.documents.filter((d) => d.type === 'facture')
  const qtyStats = {}
  for (const d of inv) for (const l of d.lines) (qtyStats[l.productId] ||= []).push(Number(l.qty))
  const seen = {}
  for (const d of inv) {
    for (const l of d.lines) {
      const p = db.products.find((x) => x.id === l.productId)
      const net = l.price * (1 - (l.discount || 0) / 100)
      if (p && net < p.cost) out.push({ severity: 'Haute', doc: d, title: 'Vente sous le prix de revient', text: `${d.number} — ${p.name} vendu ${money(net)} pour un coût de ${money(p.cost)}.` })
      if ((l.discount || 0) > 12) out.push({ severity: 'Moyenne', doc: d, title: 'Remise inhabituelle', text: `${d.number} — remise de ${l.discount} % sur ${l.label}.` })
      const s = qtyStats[l.productId]
      if (s.length > 8) { const m = mean(s), sd = std(s); if (sd > 0 && (l.qty - m) / sd > 3.2) out.push({ severity: 'Basse', doc: d, title: 'Quantité atypique', text: `${d.number} — ${int(l.qty)} × ${l.label} (moyenne ${int(m)}).` }) }
    }
    const key = `${d.partyId}|${d.date}|${Math.round(docTotals(d).ttc)}`
    if (seen[key]) out.push({ severity: 'Haute', doc: d, title: 'Doublon possible', text: `${d.number} et ${seen[key]} : même client, même date, même montant.` })
    seen[key] = d.number
    const paid = docPaid(db, d), ttc = docTotals(d).ttc
    if (paid > ttc + 1) out.push({ severity: 'Moyenne', doc: d, title: 'Trop-perçu', text: `${d.number} — encaissé ${money(paid)} pour ${money(ttc)} TTC.` })
  }
  return out
}

// Scoring d'un appel d'offres (0–100) avec facteurs explicatifs.
const KEYWORDS = { moniteur: 'Monitorage', monitorage: 'Monitorage', échograph: 'Imagerie', ventil: 'Ventilation', anesthés: 'Ventilation', seringue: 'Perfusion', perfusion: 'Perfusion', défibrill: 'Urgence', urgence: 'Urgence', désinfection: 'Hygiène', uv: 'Hygiène', 'appel malade': 'Communication', consommable: 'Consommables', circuit: 'Consommables', filtre: 'Consommables', aspirat: 'Aspiration', ecg: 'Cardiologie', électrocardio: 'Cardiologie' }
export function tenderScore(db, t) {
  const obj = t.object.toLowerCase()
  const cats = [...new Set(Object.entries(KEYWORDS).filter(([k]) => obj.includes(k)).map(([, v]) => v))]
  const catalogFit = cats.length ? Math.min(1, cats.filter((c) => db.products.some((p) => p.category === c)).length / cats.length) : 0.3
  const buyerClient = db.clients.find((c) => t.buyer.toLowerCase().includes(c.name.toLowerCase().replace(/^(chu|hôpital|chr) /, '').slice(0, 8)) || c.name.toLowerCase() === t.buyer.toLowerCase())
  const history = buyerClient ? db.documents.filter((d) => d.type === 'facture' && d.partyId === buyerClient.id).reduce((s, d) => s + docTotals(d).ht, 0) : 0
  const days = daysBetween(TODAY, t.deadline)
  const closed = db.tenders.filter((x) => ['Gagné', 'Perdu'].includes(x.status))
  const winRate = closed.length ? closed.filter((x) => x.status === 'Gagné').length / closed.length : 0.4
  const factors = [
    { label: 'Adéquation catalogue', value: catalogFit, weight: 35, note: cats.length ? `Catégories : ${cats.join(', ')}` : 'Catégorie non identifiée' },
    { label: 'Historique acheteur', value: Math.min(1, history / 500000), weight: 20, note: history ? `${moneyK(history)} facturés` : 'Pas d\'historique' },
    { label: 'Temps de préparation', value: days < 0 ? 1 : Math.min(1, days / 21), weight: 15, note: days < 0 ? 'Offre déposée' : `${days} jours restants` },
    { label: 'Taux de réussite AO', value: winRate, weight: 15, note: `${Math.round(winRate * 100)} % sur ${closed.length} AO clôturés` },
    { label: 'Taille vs capacité', value: t.estimate > 3e6 ? 0.4 : t.estimate > 1.5e6 ? 0.7 : 1, weight: 15, note: `Estimation ${moneyK(t.estimate)}` },
  ]
  const score = Math.round(factors.reduce((s, f) => s + f.value * f.weight, 0))
  return { score, factors, recommendation: score >= 65 ? 'Soumissionner' : score >= 45 ? 'Soumissionner sous conditions' : 'Ne pas soumissionner', cats }
}

// Synthèse des alertes et recommandations (centre de notifications + page IA).
export function insights(db) {
  const out = []
  const plan = reorderPlan(db)
  const crit = plan.filter((r) => r.urgency === 'Critique' || r.urgency === 'Haute')
  if (crit.length) out.push({ severity: 'Haute', icon: 'box', color: 'red', page: 'ai', tab: 'reorder', title: `${crit.length} produit(s) à réapprovisionner en urgence`, text: crit.slice(0, 3).map((r) => `${r.product.name} (${int(r.stock)} en stock, couverture ${Number.isFinite(r.cover) ? r.cover + ' j' : '—'})`).join(' · ') })
  const exp = expiryRisks(db)
  if (exp.length) out.push({ severity: exp.some((e) => e.expired) ? 'Haute' : 'Moyenne', icon: 'clock', color: 'amber', page: 'ai', tab: 'expiry', title: `${exp.length} lot(s) à risque de péremption`, text: `Valeur exposée ${money(exp.reduce((s, e) => s + e.value, 0))}. Prioriser l'écoulement (FEFO) ou proposer en promotion.` })
  const risk = clientRisk(db).filter((r) => r.overdue > 1000)
  if (risk.length) out.push({ severity: 'Moyenne', icon: 'wallet', color: 'amber', page: 'ai', tab: 'clients', title: `${money(risk.reduce((s, r) => s + r.overdue, 0))} de créances échues`, text: risk.slice(0, 3).map((r) => `${r.client.name} : ${moneyK(r.overdue)}`).join(' · ') })
  const an = anomalies(db)
  if (an.length) out.push({ severity: an.some((a) => a.severity === 'Haute') ? 'Haute' : 'Basse', icon: 'alert', color: 'violet', page: 'ai', tab: 'anomalies', title: `${an.length} anomalie(s) détectée(s) sur les factures`, text: an.slice(0, 2).map((a) => a.title).join(' · ') })
  const soon = db.tenders.filter((t) => ['Veille', 'En préparation AO'].includes(t.status) && daysBetween(TODAY, t.deadline) <= 21 && daysBetween(TODAY, t.deadline) >= 0)
  for (const t of soon) out.push({ severity: 'Haute', icon: 'gavel', color: 'blue', page: 'tenders', title: `${t.ref} — dépôt dans ${daysBetween(TODAY, t.deadline)} jours`, text: `${t.buyer} · ${t.object}. Caution provisoire : ${money(t.caution)}.` })
  const maint = db.equipment.filter((e) => e.nextMaintenance && e.nextMaintenance < TODAY)
  if (maint.length) out.push({ severity: 'Moyenne', icon: 'wrench', color: 'teal', page: 'service', title: `${maint.length} maintenance(s) préventive(s) en retard`, text: 'Planifier les visites et proposer un contrat de maintenance aux clients hors contrat.' })
  const warranty = db.equipment.filter((e) => e.warrantyEnd && daysBetween(TODAY, e.warrantyEnd) >= 0 && daysBetween(TODAY, e.warrantyEnd) <= 90 && e.contract === 'Garantie constructeur')
  if (warranty.length) out.push({ severity: 'Basse', icon: 'trend', color: 'green', page: 'service', title: `${warranty.length} fin(s) de garantie sous 90 jours : opportunité contrats`, text: 'Proposer un contrat Standard ou Premium avant l\'échéance.' })
  const qa = db.quality.filter((q) => q.status !== 'Clôturé' && q.severity === 'Critique')
  if (qa.length) out.push({ severity: 'Haute', icon: 'shield', color: 'red', page: 'quality', title: `${qa.length} événement(s) de matériovigilance critique(s) ouvert(s)`, text: qa.map((q) => q.description).join(' · ') })
  const months = lastMonths(13)
  const last90 = new Set(months.slice(-3))
  const dormant = db.clients.filter((c) => {
    const ds = db.documents.filter((d) => d.type === 'facture' && d.partyId === c.id)
    return ds.length >= 4 && !ds.some((d) => last90.has(d.date.slice(0, 7)))
  })
  if (dormant.length) out.push({ severity: 'Basse', icon: 'users', color: 'violet', page: 'clients', title: `${dormant.length} client(s) réguliers sans commande depuis 90 jours`, text: dormant.slice(0, 4).map((c) => c.name).join(' · ') })
  return out.sort((a, b) => ['Haute', 'Moyenne', 'Basse'].indexOf(a.severity) - ['Haute', 'Moyenne', 'Basse'].indexOf(b.severity))
}

// Contexte compact transmis à Claude (aucune donnée personnelle d'employé).
export function buildContext(db) {
  const f = revenueForecast(db, 3)
  const plan = reorderPlan(db).filter((r) => r.qty > 0).slice(0, 10)
  const risk = clientRisk(db).slice(0, 8)
  const ins = insights(db)
  const inv = db.documents.filter((d) => d.type === 'facture' && d.status === 'Validée')
  const topProducts = {}
  for (const d of inv) for (const l of d.lines) topProducts[l.label] = (topProducts[l.label] || 0) + l.qty * l.price
  return {
    societe: db.settings.company.name, date: TODAY, devise: 'MAD (DH)', tva: '20 %',
    chiffre_affaires_ht_12_mois: Math.round(f.hist.reduce((s, v) => s + v, 0)),
    ca_mensuel_ht: Object.fromEntries(f.months.map((m, i) => [monthLabel(m), Math.round(f.hist[i])])),
    prevision_ca_ht: Object.fromEntries(f.futureMonths.map((m, i) => [monthLabel(m), Math.round(f.forecast[i])])),
    top_produits_ca_ht: Object.entries(topProducts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ produit: k, ca: Math.round(v) })),
    stock: db.products.map((p) => ({ ref: p.ref, produit: p.name, categorie: p.category, classe_dm: p.dmClass, stock: productStock(p), stock_min: p.minStock, cout: p.cost, prix: p.price })),
    reappro_suggere: plan.map((r) => ({ produit: r.product.name, stock: r.stock, en_commande: r.incoming, conso_mensuelle: Math.round(r.monthly), delai_fournisseur_j: r.lead, qte_suggeree: r.qty, urgence: r.urgency })),
    peremption: expiryRisks(db).slice(0, 8).map((e) => ({ produit: e.product.name, lot: e.lot.lot, expiration: e.lot.expiry, qte_a_risque: e.atRisk })),
    clients_risque: risk.map((r) => ({ client: r.client.name, type: r.client.type, encours: Math.round(r.outstanding), echu: Math.round(r.overdue), retard_moyen_j: Math.round(r.avgDelay), ca_ht: Math.round(r.revenue) })),
    appels_offres: db.tenders.map((t) => ({ ref: t.ref, acheteur: t.buyer, objet: t.object, estimation: t.estimate, offre: t.ourBid, statut: t.status, date_limite: t.deadline, score_ia: tenderScore(db, t).score })),
    pipeline_crm: db.opportunities.map((o) => ({ opportunite: o.title, client: db.clients.find((c) => c.id === o.clientId)?.name, montant: o.amount, etape: o.stage, probabilite: o.probability })),
    sav: { equipements_installes: db.equipment.length, maintenances_en_retard: db.equipment.filter((e) => e.nextMaintenance < TODAY).length, interventions_planifiees: db.interventions.filter((i) => i.status !== 'Terminée').length },
    qualite_ouverts: db.quality.filter((q) => q.status !== 'Clôturé').map((q) => ({ type: q.type, gravite: q.severity, description: q.description, statut: q.status })),
    alertes: ins.map((i) => `${i.severity} — ${i.title}`),
  }
}

// Assistant hors ligne : réponses calculées à partir des données locales (aucun appel réseau).
export function localAnswer(db, question) {
  const q = question.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const has = (...w) => w.some((x) => q.includes(x))
  if (has('reappro', 'rupture', 'commander', 'stock')) {
    const plan = reorderPlan(db).filter((r) => r.qty > 0).slice(0, 8)
    if (!plan.length) return 'Aucun réapprovisionnement nécessaire : tous les produits sont au-dessus de leur point de commande.'
    return `Plan de réapprovisionnement recommandé (${plan.length} produits, ${money(plan.reduce((s, r) => s + r.value, 0))} HT) :\n\n` +
      plan.map((r) => `• ${r.product.name} — stock ${int(r.stock)}, conso ≈ ${int(r.monthly)}/mois, délai ${r.lead} j → commander ${int(r.qty)} (${r.urgency.toLowerCase()})`).join('\n') +
      '\n\nAstuce : générez les bons de commande en un clic depuis LIYA IA › Réapprovisionnement.'
  }
  if (has('peremp', 'expir', 'lot')) {
    const e = expiryRisks(db)
    if (!e.length) return 'Aucun lot à risque de péremption dans les 8 prochains mois.'
    return `Lots à risque :\n\n${e.slice(0, 8).map((x) => `• ${x.product.name} — lot ${x.lot.lot}, ${x.expired ? 'PÉRIMÉ' : `expire le ${fdate(x.lot.expiry)}`} : ${int(x.atRisk)} unités à risque (${money(x.value)})`).join('\n')}\n\nRecommandation : appliquer le FEFO, proposer ces lots aux clients à forte rotation et bloquer les lots périmés (quarantaine).`
  }
  if (has('impaye', 'creance', 'recouvr', 'paiement', 'retard')) {
    const r = clientRisk(db).filter((x) => x.overdue > 0).slice(0, 8)
    return `Créances échues : ${money(r.reduce((s, x) => s + x.overdue, 0))}\n\n${r.map((x) => `• ${x.client.name} — échu ${money(x.overdue)}, retard moyen ${Math.round(x.avgDelay)} j (risque ${x.level.toLowerCase()})`).join('\n')}\n\nPriorité : relancer les 3 premiers ; pour les établissements publics, vérifier l'ordonnancement auprès de la trésorerie.`
  }
  if (has('prevision', 'previs', 'forecast', 'prochain mois', 'futur')) {
    const f = revenueForecast(db, 3)
    return `Prévision du chiffre d'affaires HT (lissage de Holt, précision historique ≈ ${Math.round(f.accuracy * 100)} %) :\n\n${f.futureMonths.map((m, i) => `• ${monthLabel(m)} : ${money(f.forecast[i])} (± ${moneyK(f.error)})`).join('\n')}\n\nTendance : ${f.trend >= 0 ? 'hausse' : 'baisse'} de ${moneyK(Math.abs(f.trend))} par mois.`
  }
  if (has('appel', 'ao', 'marche', 'tender')) {
    const ts = db.tenders.filter((t) => !['Gagné', 'Perdu'].includes(t.status)).map((t) => ({ t, s: tenderScore(db, t) }))
    return `Appels d'offres en cours :\n\n${ts.map(({ t, s }) => `• ${t.ref} — ${t.buyer} (${t.status}, limite ${fdate(t.deadline)}) : score ${s.score}/100 → ${s.recommendation}`).join('\n')}`
  }
  if (has('client', 'top', 'meilleur')) {
    const r = clientRisk(db).sort((a, b) => b.revenue - a.revenue).slice(0, 8)
    return `Top clients (CA HT 12 mois) :\n\n${r.map((x, i) => `${i + 1}. ${x.client.name} — ${money(x.revenue)} (${x.invoices} factures)`).join('\n')}`
  }
  if (has('maintenance', 'sav', 'garantie', 'intervention')) {
    const late = db.equipment.filter((e) => e.nextMaintenance < TODAY)
    return `Parc installé : ${db.equipment.length} équipements.\n• Maintenances préventives en retard : ${late.length}\n• Interventions à venir : ${db.interventions.filter((i) => i.status !== 'Terminée').length}\n\nRecommandation : regrouper les visites par ville pour réduire les déplacements et proposer des contrats aux équipements hors contrat.`
  }
  if (has('marge', 'rentab', 'chiffre', 'ca ', 'vente')) {
    const f = revenueForecast(db, 1)
    const total = f.hist.reduce((s, v) => s + v, 0)
    let cost = 0, rev = 0
    for (const d of db.documents) if (d.type === 'facture' && d.status === 'Validée') for (const l of d.lines) { const p = db.products.find((x) => x.id === l.productId); rev += l.qty * l.price * (1 - (l.discount || 0) / 100); cost += l.qty * (p?.cost || 0) }
    return `CA HT 12 mois : ${money(total)}\nMarge brute : ${money(rev - cost)} (${((rev - cost) / (rev || 1) * 100).toFixed(1)} %)\nMois en cours : ${money(f.hist.at(-1))}\nPrévision mois prochain : ${money(f.forecast[1])}`
  }
  const ins = insights(db).slice(0, 5)
  return `Voici les points d'attention du jour :\n\n${ins.map((i) => `• ${i.title}`).join('\n')}\n\nVous pouvez me demander : prévisions de ventes, réapprovisionnement, lots à risque, impayés, appels d'offres, top clients, marge, maintenance.\n(Mode hors ligne — ajoutez une clé API dans Paramètres › IA pour l'assistant Claude complet.)`
}

export const QUICK_PROMPTS = [
  'Quels produits dois-je commander cette semaine ?',
  'Quelle est la prévision de CA pour les 3 prochains mois ?',
  'Quels clients ont des impayés à relancer en priorité ?',
  'Quels lots risquent de périmer ?',
  'Sur quels appels d\'offres devons-nous soumissionner ?',
  'Analyse ma marge et propose 3 actions pour l\'améliorer.',
]

export { addDays, payStatus }
