// Données de démonstration réalistes pour LIYA HEALTH (distributeur de dispositifs médicaux, Casablanca).
// Générées de façon déterministe : 12 mois d'historique pour alimenter tableaux de bord et prévisions IA.
import { TODAY, addDays, DOC_TYPES } from '../lib/domain.js'

function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

export const COMPANY = {
  name: 'LIYA HEALTH SARL',
  tagline: 'Surveiller · Protéger · Accompagner',
  rc: 'RC Casablanca 691321', ice: '003788124000071', tp: '36209628', cnss: '6927035', capital: '500 000 DH',
  address: 'Ichrak Center, Imm n°16, Showroom n°2, Route El Jadida, Hay Hassani, Casablanca',
  phone: '+212 5 22 00 00 00', email: 'contact@liyahealth.ma', manager: 'M. BAKALI Lahsen',
  bank: 'BANK OF AFRICA — agence Casa Marina, Casablanca', ammps: 'Importateur / distributeur DM classes I–IIb',
}

const SUPPLIERS = [
  ['ZONCARE / ZONDAN', 'Chine', 'Échographie', 45], ['Comen', 'Chine', 'Monitorage', 40], ['Aeonmed', 'Chine', 'Ventilation & anesthésie', 50],
  ['ESHERO', 'Chine', 'Consommables', 35], ['ENMIND', 'Chine', 'Pousse-seringues & pompes', 40], ['UVDI', 'États-Unis', 'Désinfection UV', 60],
  ['Ascom', 'Suisse', 'Appel malade', 55], ['EMTEL', 'Pologne', 'Défibrillation', 45], ['CA-MI', 'Italie', 'Aspiration & aérosol', 30], ['WITLEAF', 'Chine', 'Capteurs & accessoires', 30],
]

// [ref, désignation, catégorie, fournisseur idx, classe DM, coût, prix, stock min, type]
const PRODUCTS = [
  ['MON-C80', 'Moniteur multiparamétrique Comen C80 12"', 'Monitorage', 1, 'IIb', 38000, 52000, 3, 'equip'],
  ['MON-STAR8000', 'Moniteur patient Comen STAR8000E', 'Monitorage', 1, 'IIb', 22000, 31500, 4, 'equip'],
  ['ECO-Z50', 'Échographe portable ZONCARE Z50', 'Imagerie', 0, 'IIa', 145000, 198000, 1, 'equip'],
  ['ECO-Q7', 'Échographe chariot ZONCARE Q7', 'Imagerie', 0, 'IIa', 265000, 359000, 1, 'equip'],
  ['VEN-SH300', 'Ventilateur de réanimation Aeonmed SH300', 'Ventilation', 2, 'IIb', 210000, 289000, 1, 'equip'],
  ['ANE-7500', 'Station d\'anesthésie Aeonmed 7500A', 'Ventilation', 2, 'IIb', 320000, 435000, 1, 'equip'],
  ['PSE-SP600', 'Pousse-seringue ENMIND SP600', 'Perfusion', 4, 'IIb', 7200, 10900, 6, 'equip'],
  ['POM-IP700', 'Pompe à perfusion volumétrique ENMIND IP700', 'Perfusion', 4, 'IIb', 9800, 14500, 5, 'equip'],
  ['DEF-DX', 'Défibrillateur EMTEL DEFIMAX DX', 'Urgence', 7, 'IIb', 42000, 61000, 2, 'equip'],
  ['UV-INF', 'Robot de désinfection UVDI-360', 'Hygiène', 5, 'IIa', 380000, 520000, 1, 'equip'],
  ['APM-TELL', 'Système appel malade Ascom Telligence (chambre)', 'Communication', 6, 'I', 4100, 6900, 10, 'equip'],
  ['ASP-NEW', 'Aspirateur chirurgical CA-MI New Hospivac', 'Aspiration', 8, 'IIa', 8900, 13200, 3, 'equip'],
  ['ECG-12', 'Électrocardiographe 12 pistes Comen CM1200B', 'Cardiologie', 1, 'IIa', 16500, 24900, 2, 'equip'],
  ['CS-SPO2', 'Capteur SpO2 adulte réutilisable WITLEAF', 'Accessoires', 9, 'IIa', 380, 690, 40, 'conso'],
  ['BR-PNI', 'Brassard PNI adulte (boîte de 10)', 'Accessoires', 9, 'I', 520, 890, 30, 'conso'],
  ['EL-ECG', 'Électrodes ECG gel solide (sachet 50)', 'Consommables', 3, 'I', 48, 95, 200, 'conso'],
  ['PAP-ECG', 'Papier ECG thermique 210 mm (rouleau)', 'Consommables', 3, 'I', 35, 72, 150, 'conso'],
  ['CIR-PAT', 'Circuit patient ventilation adulte usage unique', 'Consommables', 3, 'IIa', 85, 165, 120, 'conso'],
  ['FIL-HME', 'Filtre HME antibactérien', 'Consommables', 3, 'IIa', 14, 32, 400, 'conso'],
  ['GEL-ECO', 'Gel échographie 5 L', 'Consommables', 3, 'I', 75, 140, 80, 'conso'],
  ['SER-50', 'Seringue 50 ml luer-lock pousse-seringue (boîte 50)', 'Consommables', 3, 'IIa', 210, 380, 60, 'conso'],
  ['TUB-PERF', 'Tubulure de perfusion pompe IP700', 'Consommables', 4, 'IIa', 28, 58, 300, 'conso'],
  ['ELP-DEF', 'Électrodes de défibrillation adulte (paire)', 'Consommables', 7, 'IIa', 260, 450, 40, 'conso'],
  ['LAMP-UV', 'Lampe UV-C de rechange UVDI', 'Pièces détachées', 5, 'I', 6200, 9800, 4, 'conso'],
]

const CLIENTS = [
  ['CHU Ibn Rochd', 'CHU', 'Casablanca'], ['CHU Ibn Sina', 'CHU', 'Rabat'], ['CHU Mohammed VI', 'CHU', 'Marrakech'], ['CHU Hassan II', 'CHU', 'Fès'],
  ['Hôpital Moulay Youssef', 'Hôpital public', 'Casablanca'], ['Hôpital Provincial El Jadida', 'Hôpital public', 'El Jadida'], ['CHR Settat', 'Hôpital public', 'Settat'],
  ['Clinique Al Madina', 'Clinique privée', 'Casablanca'], ['Clinique Les Iris', 'Clinique privée', 'Casablanca'], ['Clinique Agdal', 'Clinique privée', 'Rabat'],
  ['Clinique Atlas', 'Clinique privée', 'Marrakech'], ['Polyclinique du Nord', 'Clinique privée', 'Tanger'], ['Clinique Badr', 'Clinique privée', 'Casablanca'],
  ['Centre d\'Imagerie Anfa', 'Centre d\'imagerie', 'Casablanca'], ['Centre de Dialyse Zerktouni', 'Centre spécialisé', 'Casablanca'],
  ['Cabinet Dr. Alaoui (Cardiologie)', 'Cabinet', 'Casablanca'], ['SAMU 141 Casablanca', 'Urgences', 'Casablanca'], ['Hôpital Militaire Avicenne', 'Hôpital public', 'Marrakech'],
]

const EMPLOYEES = [
  ['Hassan BAKALI', 'Directeur Général', 'Direction', 42000], ['Lahsen BAKALI', 'Gérant', 'Direction', 38000], ['Salma Idrissi', 'Responsable commerciale', 'Commercial', 22000],
  ['Youssef Benali', 'Délégué médical', 'Commercial', 12500], ['Imane Tazi', 'Déléguée médicale', 'Commercial', 12500], ['Karim Ouazzani', 'Ingénieur biomédical', 'SAV / Technique', 17000],
  ['Mehdi Rachidi', 'Technicien biomédical', 'SAV / Technique', 10500], ['Nadia El Fassi', 'Responsable marchés publics', 'Appels d\'offres', 16000],
  ['Rachid Amrani', 'Magasinier', 'Logistique', 7500], ['Fatima Zahra Lahlou', 'Comptable', 'Finance', 13000], ['Omar Kettani', 'Responsable qualité & réglementaire', 'Qualité', 18000],
]

export function buildSeed() {
  const r = rng(20261107)
  const pick = (a) => a[Math.floor(r() * a.length)]
  const between = (a, b) => Math.round(a + r() * (b - a))
  const counters = {}
  const num = (type, date) => { const p = DOC_TYPES[type].prefix; counters[type] = (counters[type] || 0) + 1; return `${p}-${date.slice(0, 4)}-${String(counters[type]).padStart(4, '0')}` }

  const warehouses = [
    { id: 'w1', name: 'Dépôt principal — Hay Hassani', city: 'Casablanca', manager: 'Rachid Amrani' },
    { id: 'w2', name: 'Showroom Route El Jadida', city: 'Casablanca', manager: 'Salma Idrissi' },
    { id: 'w3', name: 'Stock SAV / pièces détachées', city: 'Casablanca', manager: 'Karim Ouazzani' },
  ]
  const suppliers = SUPPLIERS.map(([name, country, specialty, lead], i) => ({
    id: `s${i + 1}`, name, country, specialty, leadTime: lead, currency: country === 'Suisse' || country === 'Italie' || country === 'Pologne' ? 'EUR' : 'USD',
    contact: `Export manager ${name.split(' ')[0]}`, email: `export@${name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')}.com`, phone: '', rating: between(3, 5), partner: true,
  }))
  const products = PRODUCTS.map(([ref, name, category, si, dmClass, cost, price, minStock, kind], i) => {
    const isConso = kind === 'conso'
    const lots = []
    const nLots = isConso ? between(1, 3) : 1
    for (let k = 0; k < nLots; k++) {
      lots.push({
        lot: `${ref.split('-')[0]}${between(24, 26)}${String(between(100, 999))}`,
        expiry: isConso ? addDays(TODAY, between(-20, 720)) : '',
        qty: isConso ? between(Math.round(minStock * 0.2), minStock * 2) : between(0, minStock + 2),
        warehouseId: ref === 'LAMP-UV' ? 'w3' : k === 1 ? 'w2' : 'w1',
      })
    }
    return {
      id: `p${i + 1}`, ref, name, category, supplierId: `s${si + 1}`, dmClass, ammps: `AMMPS-DM-${between(10000, 99999)}`, ce: true,
      cost, price, tva: 20, minStock, unit: isConso ? 'unité' : 'appareil', kind, lots, warrantyMonths: isConso ? 0 : 24,
    }
  })
  const clients = CLIENTS.map(([name, type, city], i) => ({
    id: `c${i + 1}`, code: `CL${String(i + 1).padStart(4, '0')}`, name, type, city, ice: String(between(1e14, 9e14)).padStart(15, '0'),
    phone: `+212 5 ${between(22, 39)} ${between(10, 99)} ${between(10, 99)} ${between(10, 99)}`, email: `achats@${name.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '').slice(0, 14)}.ma`,
    contact: pick(['Service économat', 'Pharmacie centrale', 'Service biomédical', 'Direction des achats']), paymentTerms: type.includes('public') || type === 'CHU' ? 90 : 60,
    creditLimit: type === 'CHU' ? 3000000 : 600000, public: ['CHU', 'Hôpital public', 'Urgences'].includes(type),
  }))
  const employees = EMPLOYEES.map(([name, role, dept, salary], i) => ({
    id: `e${i + 1}`, matricule: `LH${String(i + 1).padStart(3, '0')}`, name, role, dept, salary, hireDate: addDays(TODAY, -between(120, 2400)),
    phone: `+212 6 ${between(10, 99)} ${between(10, 99)} ${between(10, 99)} ${between(10, 99)}`, email: `${name.split(' ')[0].toLowerCase()}@liyahealth.ma`,
    cnss: String(between(1e8, 9e8)), leaveBalance: between(4, 22), status: 'Actif',
  }))

  // ---------- 12 mois d'historique commercial ----------
  const documents = [], payments = [], movements = [], equipment = [], interventions = []
  const start = addDays(TODAY, -365)
  const conso = products.filter((p) => p.kind === 'conso')
  const equip = products.filter((p) => p.kind === 'equip')
  for (let day = 0; day < 365; day += between(2, 5)) {
    const date = addDays(start, day)
    const month = Number(date.slice(5, 7))
    const season = 1 + 0.35 * Math.sin(((month - 3) / 12) * 2 * Math.PI) + day / 900 // tendance haussière + saisonnalité (budgets publics)
    const client = pick(clients)
    const lines = []
    const nConso = between(1, 4)
    for (let k = 0; k < nConso; k++) {
      const p = pick(conso)
      if (lines.some((l) => l.productId === p.id)) continue
      lines.push({ productId: p.id, label: p.name, qty: Math.max(1, Math.round(between(2, 18) * season * (p.price < 100 ? 6 : 1))), price: p.price, discount: client.public ? 0 : pick([0, 0, 5]), tva: 20 })
    }
    if (r() < 0.32) {
      const p = pick(equip)
      lines.push({ productId: p.id, label: p.name, qty: between(1, p.price > 100000 ? 1 : 4), price: p.price, discount: pick([0, 3, 5]), tva: 20 })
    }
    const dueDate = addDays(date, client.paymentTerms)
    const inv = { id: `d${documents.length + 1}`, type: 'facture', number: num('facture', date), partyId: client.id, date, dueDate, status: 'Validée', lines, notes: '' }
    documents.push(inv)
    const ttc = lines.reduce((s, l) => s + l.qty * l.price * (1 - l.discount / 100) * 1.2, 0)
    const age = 365 - day
    if (age > client.paymentTerms + between(-25, 40) || (age > 30 && r() < 0.35)) {
      payments.push({ id: `pay${payments.length + 1}`, docId: inv.id, partyId: client.id, kind: 'in', date: addDays(date, Math.min(age - 1, client.paymentTerms + between(-20, 30))), amount: Math.round(ttc * 100) / 100, method: pick(['Virement', 'Virement', 'Chèque', 'Effet']) })
    } else if (age > 20 && r() < 0.3) {
      payments.push({ id: `pay${payments.length + 1}`, docId: inv.id, partyId: client.id, kind: 'in', date: addDays(date, 15), amount: Math.round(ttc * 0.4), method: 'Virement' })
    }
    for (const l of lines) {
      movements.push({ id: `m${movements.length + 1}`, date, productId: l.productId, type: 'Sortie', qty: l.qty, ref: inv.number, warehouseId: 'w1', lot: '' })
      const p = products.find((x) => x.id === l.productId)
      if (p.kind === 'equip') {
        for (let q = 0; q < l.qty; q++) {
          const eq = { id: `eq${equipment.length + 1}`, serial: `${p.ref.split('-')[1] || p.ref}-${between(100000, 999999)}`, productId: p.id, clientId: client.id, installDate: addDays(date, between(3, 15)), warrantyEnd: addDays(date, 730), contract: pick(['Garantie constructeur', 'Contrat Premium', 'Contrat Standard', 'Garantie constructeur']), nextMaintenance: addDays(TODAY, between(-30, 180)), location: pick(['Réanimation', 'Urgences', 'Bloc opératoire', 'Cardiologie', 'Radiologie', 'Hospitalisation']), status: r() < 0.08 ? 'En maintenance' : 'Actif' }
          equipment.push(eq)
        }
      }
    }
  }
  // Devis, commandes et BL en cours
  const openDocs = [['devis', 'Envoyé'], ['devis', 'Brouillon'], ['devis', 'Accepté'], ['devis', 'Envoyé'], ['commande', 'Confirmée'], ['commande', 'En préparation'], ['bl', 'Brouillon'], ['facture', 'Brouillon']]
  openDocs.forEach(([type, status], i) => {
    const date = addDays(TODAY, -between(1, 20))
    const c = pick(clients)
    const lines = [pick(equip), pick(conso)].map((p) => ({ productId: p.id, label: p.name, qty: p.kind === 'equip' ? between(1, 3) : between(10, 80), price: p.price, discount: 0, tva: 20 }))
    documents.push({ id: `d${documents.length + 1}`, type, number: num(type, date), partyId: c.id, date, dueDate: addDays(date, type === 'devis' ? 30 : c.paymentTerms), status, lines, notes: i === 0 ? 'Offre valable 30 jours — livraison et formation incluses.' : '' })
  })
  // Achats : BC, réceptions, factures fournisseurs
  for (let i = 0; i < 16; i++) {
    const date = addDays(TODAY, -between(5, 330))
    const s = pick(suppliers)
    const ps = products.filter((p) => p.supplierId === s.id)
    if (!ps.length) continue
    const lines = ps.slice(0, 3).map((p) => ({ productId: p.id, label: p.name, qty: p.kind === 'equip' ? between(2, 6) : between(100, 600), price: p.cost, discount: 0, tva: 20 }))
    const recent = i < 3
    documents.push({ id: `d${documents.length + 1}`, type: 'bc', number: num('bc', date), partyId: s.id, date: recent ? addDays(TODAY, -between(2, 12)) : date, dueDate: addDays(date, s.leadTime), status: recent ? pick(['Envoyé', 'Confirmé']) : 'Reçu', lines, notes: `Incoterm CIP Casablanca — délai ${s.leadTime} j` })
    if (!recent) {
      const ff = { id: `d${documents.length + 1}`, type: 'facture_f', number: num('facture_f', date), partyId: s.id, date: addDays(date, s.leadTime), dueDate: addDays(date, s.leadTime + 60), status: 'Validée', lines, notes: '' }
      documents.push(ff)
      for (const l of lines) movements.push({ id: `m${movements.length + 1}`, date: ff.date, productId: l.productId, type: 'Entrée', qty: l.qty, ref: ff.number, warehouseId: 'w1', lot: '' })
      if (ff.dueDate < TODAY) payments.push({ id: `pay${payments.length + 1}`, docId: ff.id, partyId: s.id, kind: 'out', date: ff.dueDate, amount: lines.reduce((x, l) => x + l.qty * l.price * 1.2, 0), method: 'Virement international' })
    }
  }

  // Interventions SAV
  const techs = employees.filter((e) => e.dept === 'SAV / Technique')
  equipment.slice(0, 40).forEach((eq, i) => {
    const past = i % 3 !== 0
    interventions.push({
      id: `iv${i + 1}`, number: `INT-${String(i + 1).padStart(4, '0')}`, equipmentId: eq.id, clientId: eq.clientId, type: pick(['Maintenance préventive', 'Maintenance préventive', 'Corrective', 'Installation', 'Formation utilisateurs']),
      date: past ? addDays(TODAY, -between(2, 200)) : addDays(TODAY, between(1, 40)), techId: pick(techs).id, status: past ? 'Terminée' : pick(['Planifiée', 'Planifiée', 'En cours']),
      priority: pick(['Basse', 'Moyenne', 'Moyenne', 'Haute']), duration: between(1, 6), report: past ? 'Contrôle qualité électrique et fonctionnel OK. Remplacement accessoires si nécessaire.' : '', cost: 0,
    })
  })

  const tenders = [
    ['AO n°12/2026/CHUIR', 'CHU Ibn Rochd', 'Acquisition de moniteurs multiparamétriques pour la réanimation', 1850000, 'En préparation AO', 18, 0.55],
    ['AO n°45/2026/MS-DRS', 'Direction Régionale de la Santé Casablanca-Settat', 'Fourniture de pousse-seringues et pompes à perfusion', 980000, 'Déposé', -3, 0.6],
    ['AO n°07/2026/CHUM6', 'CHU Mohammed VI Marrakech', 'Échographes polyvalents — 3 lots', 2400000, 'Veille', 35, 0.35],
    ['AO n°31/2026/HMA', 'Hôpital Militaire Avicenne', 'Robots de désinfection UV-C', 1100000, 'Déposé', -12, 0.5],
    ['AO n°19/2026/CHUHII', 'CHU Hassan II Fès', 'Consommables de ventilation (circuits, filtres)', 640000, 'Gagné', -60, 1],
    ['AO n°22/2026/CHRS', 'CHR Settat', 'Défibrillateurs et chariots d\'urgence', 520000, 'Perdu', -80, 0],
    ['AO n°03/2027/CHUIS', 'CHU Ibn Sina Rabat', 'Système d\'appel malade — nouveau pavillon', 1350000, 'Veille', 52, 0.4],
  ].map(([ref, buyer, object, estimate, status, dl, prob], i) => ({
    id: `t${i + 1}`, ref, buyer, object, estimate, ourBid: status === 'Veille' ? 0 : Math.round(estimate * (0.86 + r() * 0.1)), status, deadline: addDays(TODAY, dl),
    caution: Math.round(estimate * 0.015 / 1000) * 1000, probability: prob, owner: 'Nadia El Fassi', portal: 'marchespublics.gov.ma', lots: between(1, 4), notes: '',
  }))

  const quality = [
    ['Réclamation client', 'p14', 'Capteur SpO2 — mesures instables signalées par la réanimation', 'Majeure', 'En investigation', 'c1'],
    ['Incident matériovigilance', 'p7', 'Alarme d\'occlusion non déclenchée — déclaration AMMPS', 'Critique', 'CAPA en cours', 'c8'],
    ['Non-conformité réception', 'p18', 'Lot de circuits patient : emballage endommagé (12 unités)', 'Mineure', 'Clôturé', ''],
    ['Rappel fabricant (FSCA)', 'p9', 'Mise à jour logicielle préventive DEFIMAX DX v2.3', 'Majeure', 'Ouvert', ''],
    ['Réclamation client', 'p20', 'Gel échographie : délai de livraison dépassé', 'Mineure', 'Clôturé', 'c14'],
  ].map(([type, productId, description, severity, status, clientId], i) => ({
    id: `q${i + 1}`, number: `QA-2026-${String(i + 1).padStart(3, '0')}`, date: addDays(TODAY, -between(3, 120)), type, productId, clientId, lot: products.find((p) => p.id === productId).lots[0].lot,
    description, severity, status, owner: 'Omar Kettani', capa: status === 'Clôturé' ? 'Action corrective réalisée et vérifiée.' : '',
  }))

  const opportunities = [
    ['Rééquipement réanimation 12 lits', 'c8', 780000, 'Proposition', 0.5], ['Parc pousse-seringues', 'c9', 220000, 'Négociation', 0.7], ['Échographe cardiologie', 'c16', 198000, 'Qualification', 0.3],
    ['Contrat consommables annuel', 'c15', 360000, 'Négociation', 0.75], ['Désinfection UV bloc', 'c11', 520000, 'Prospection', 0.15], ['Monitorage urgences', 'c12', 410000, 'Proposition', 0.45],
    ['Remplacement défibrillateurs', 'c17', 305000, 'Gagnée', 1], ['Appel malade 40 chambres', 'c10', 276000, 'Perdue', 0],
  ].map(([title, clientId, amount, stage, probability], i) => ({ id: `o${i + 1}`, title, clientId, amount, stage, probability, owner: pick(['Salma Idrissi', 'Youssef Benali', 'Imane Tazi']), closeDate: addDays(TODAY, between(-20, 90)), next: pick(['Démo produit', 'Relance devis', 'Visite site', 'Présentation technique']) }))

  const expenseCats = ['Loyer & charges', 'Salaires', 'Transport & logistique', 'Transit & dédouanement', 'Marketing & congrès', 'Télécom & IT', 'Carburant', 'Honoraires', 'Formation']
  const expenses = []
  for (let m = 0; m < 12; m++) {
    const base = addDays(start, m * 30 + 2)
    expenses.push({ id: `x${expenses.length + 1}`, date: base, category: 'Loyer & charges', label: 'Loyer showroom & dépôt', amount: 28000, tva: 20, paid: true })
    expenses.push({ id: `x${expenses.length + 1}`, date: addDays(base, 25), category: 'Salaires', label: 'Masse salariale', amount: employees.reduce((s, e) => s + e.salary, 0), tva: 0, paid: true })
    for (let k = 0; k < 3; k++) {
      const cat = pick(expenseCats.slice(2))
      expenses.push({ id: `x${expenses.length + 1}`, date: addDays(base, between(1, 27)), category: cat, label: cat, amount: between(1500, cat === 'Transit & dédouanement' ? 45000 : 14000), tva: 20, paid: r() < 0.9 })
    }
  }
  const leaves = [
    { id: 'l1', employeeId: 'e4', from: addDays(TODAY, 6), to: addDays(TODAY, 12), type: 'Congé annuel', status: 'En attente' },
    { id: 'l2', employeeId: 'e9', from: addDays(TODAY, -3), to: addDays(TODAY, 2), type: 'Congé maladie', status: 'Approuvé' },
    { id: 'l3', employeeId: 'e7', from: addDays(TODAY, 20), to: addDays(TODAY, 24), type: 'Congé annuel', status: 'En attente' },
  ]
  const contracts = clients.slice(0, 7).map((c, i) => ({ id: `k${i + 1}`, number: `CM-2026-${String(i + 1).padStart(3, '0')}`, clientId: c.id, type: pick(['Maintenance préventive', 'Full service', 'Consommables']), start: addDays(TODAY, -between(30, 300)), end: addDays(TODAY, between(-10, 330)), amount: between(40, 260) * 1000, visits: between(2, 4), title: `Contrat ${c.name}`, partyType: 'client', status: 'Actif' }))
  contracts.push({ id: 'k8', number: 'CD-2026-001', clientId: 's2', partyType: 'supplier', title: 'Accord de distribution exclusive Comen — Maroc', type: 'Distribution exclusive', start: addDays(TODAY, -400), end: addDays(TODAY, 330), amount: 0, visits: 0, status: 'Actif' }, { id: 'k9', number: 'CD-2026-002', clientId: 's1', partyType: 'supplier', title: 'Autorisation fabricant ZONCARE (marchés publics)', type: 'Autorisation fabricant', start: addDays(TODAY, -200), end: addDays(TODAY, 45), amount: 0, visits: 0, status: 'Actif' })

  // ---------- Modules alignés sur GStocky (v4) ----------
  // Point de vente : caisses, sessions, tickets
  const registers = [
    { id: 'r1', name: 'Caisse showroom', location: 'Showroom Route El Jadida', status: 'Fermée' },
    { id: 'r2', name: 'Caisse comptoir dépôt', location: 'Dépôt Hay Hassani', status: 'Fermée' },
  ]
  const posSessions = [], posTickets = []
  const cashiers = ['e3', 'e9']
  for (let k = 0; k < 24; k++) {
    const day = addDays(TODAY, -(24 - k))
    const reg = registers[k % 2]
    const sess = { id: `ps${k + 1}`, registerId: reg.id, cashierId: cashiers[k % 2], openedAt: `${day}T08:30:00`, closedAt: `${day}T18:30:00`, openingBalance: 2000, closingBalance: 0, status: 'Clôturée' }
    let cash = 0
    const nT = between(2, 7)
    for (let t = 0; t < nT; t++) {
      const items = [pick(conso), pick(conso)].filter((p, i, a) => a.indexOf(p) === i).map((p) => ({ productId: p.id, label: p.name, qty: between(1, 6), price: p.price, tva: 20 }))
      const total = items.reduce((x, l) => x + l.qty * l.price * 1.2, 0)
      const method = pick(['Espèces', 'Espèces', 'Carte bancaire', 'Chèque'])
      if (method === 'Espèces') cash += total
      posTickets.push({ id: `tk${posTickets.length + 1}`, number: `TK-${String(posTickets.length + 1).padStart(5, '0')}`, registerId: reg.id, sessionId: sess.id, cashierId: sess.cashierId, date: `${day}T${String(between(9, 18)).padStart(2, '0')}:${String(between(0, 59)).padStart(2, '0')}:00`, lines: items, method, total: Math.round(total * 100) / 100, status: r() < 0.05 ? 'Annulé' : 'Payé', clientId: '' })
    }
    sess.closingBalance = Math.round((2000 + cash) * 100) / 100
    posSessions.push(sess)
  }

  // Pièces jointes : dossiers (les fichiers eux-mêmes sont stockés dans IndexedDB)
  const folders = [
    { id: 'f1', name: 'Appels d\'offres', parentId: '' }, { id: 'f2', name: 'Certificats CE & ISO 13485', parentId: '' },
    { id: 'f3', name: 'Fiches techniques', parentId: '' }, { id: 'f4', name: 'Factures fournisseurs', parentId: '' }, { id: 'f5', name: 'Contrats', parentId: '' },
  ]
  const files = []

  // Gestion des projets
  const projects = [
    ['Installation réanimation CHU Ibn Rochd', 'c1', 'En cours', 'Haute'], ['Déploiement appel malade Clinique Agdal', 'c10', 'Planifié', 'Moyenne'],
    ['Renouvellement certification ISO 13485', '', 'En cours', 'Urgente'], ['Ouverture agence Marrakech', '', 'Planifié', 'Faible'], ['Formation biomédicale CHU Mohammed VI', 'c3', 'Terminé', 'Moyenne'],
  ].map(([name, clientId, status, priority], i) => ({ id: `pj${i + 1}`, name, clientId, status, priority, start: addDays(TODAY, -between(10, 90)), end: addDays(TODAY, between(-5, 120)), team: employees.slice(2 + i, 5 + i).map((e) => e.id), description: '' }))
  const TASKS = [
    [0, 'Réception et contrôle des moniteurs', 'Terminé'], [0, 'Installation des bras plafonniers', 'En cours'], [0, 'Formation infirmiers réanimation', 'À faire'], [0, 'PV de réception provisoire', 'À faire'],
    [1, 'Relevé des chambres et câblage', 'En revue'], [1, 'Commande Ascom Telligence', 'En cours'], [2, 'Audit interne processus achats', 'En cours'], [2, 'Mise à jour revue de direction', 'À faire'],
    [2, 'Dossier technique DM classe IIb', 'En revue'], [3, 'Recherche local commercial', 'À faire'], [3, 'Recrutement délégué Marrakech', 'Annulé'], [4, 'Sessions de formation échographie', 'Terminé'],
  ]
  const tasks = TASKS.map(([pi, title, status], i) => ({ id: `tsk${i + 1}`, projectId: projects[pi].id, title, status, priority: pick(['Faible', 'Moyenne', 'Haute', 'Urgente']), assigneeId: pick(employees).id, due: addDays(TODAY, between(-5, 40)), description: '' }))

  // RH : pointage et paie
  const attendance = []
  for (let k = 0; k < 7; k++) {
    const day = addDays(TODAY, -k)
    const wd = new Date(day + 'T00:00:00').getDay()
    if (wd === 0) continue
    for (const e of employees) {
      const absent = r() < 0.06
      const late = !absent && r() < 0.12
      attendance.push({ id: `at${attendance.length + 1}`, employeeId: e.id, date: day, in: absent ? '' : late ? `09:${between(10, 45)}` : `08:${between(25, 59)}`, out: absent || k === 0 ? '' : wd === 6 ? '13:00' : `${between(17, 19)}:${String(between(0, 59)).padStart(2, '0')}`, status: absent ? 'Absent' : late ? 'Retard' : wd === 6 ? 'Demi-journée' : 'Présent' })
    }
  }
  const payslips = []
  for (const m of [1, 2, 3]) {
    const d = new Date(TODAY.slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() - m)
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    for (const e of employees) {
      const bonus = e.dept === 'Commercial' ? between(0, 4000) : 0
      const gross = e.salary + bonus
      const deductions = Math.round(Math.min(gross, 6000) * 0.0448 + gross * 0.0226 + gross * 0.12)
      payslips.push({ id: `pa${payslips.length + 1}`, employeeId: e.id, period, base: e.salary, bonus, deductions, net: gross - deductions, status: 'Payé' })
    }
  }

  // Abonnements (adapté : location de matériel et contrats de consommables récurrents)
  const plans = [
    { id: 'pl1', name: 'Location concentrateur O2 domicile', price: 1500, months: 1, items: ['Concentrateur 5 L', 'Livraison & installation', 'Maintenance', 'Astreinte 7j/7'] },
    { id: 'pl2', name: 'Pack consommables monitorage', price: 4200, months: 1, items: ['Électrodes ECG', 'Papier ECG', 'Capteurs SpO2 (remplacement)'] },
    { id: 'pl3', name: 'Contrat maintenance Premium', price: 36000, months: 12, items: ['2 visites préventives', 'Pièces incluses', 'Délai d\'intervention 24 h', 'Matériel de prêt'] },
    { id: 'pl4', name: 'Location échographe portable', price: 9500, months: 1, items: ['Échographe Z50', '2 sondes', 'Formation', 'Assurance'] },
  ]
  const subscriptions = clients.slice(5, 14).map((c, i) => ({ id: `sb${i + 1}`, clientId: c.id, planId: plans[i % plans.length].id, start: addDays(TODAY, -between(20, 300)), end: addDays(TODAY, between(-15, 300)), status: r() < 0.1 ? 'Annulé' : 'Actif', autoRenew: r() < 0.7, lastBilled: addDays(TODAY, -between(1, 30)) }))

  // Réservations (adapté : démonstrations et prêts de matériel)
  const bookings = Array.from({ length: 14 }, (_, i) => {
    const p = pick(equip)
    const start = addDays(TODAY, between(-25, 35))
    return { id: `bk${i + 1}`, title: `${pick(['Démonstration', 'Démonstration', 'Prêt de matériel', 'Essai clinique'])} — ${p.name.split(' ').slice(0, 3).join(' ')}`, productId: p.id, clientId: pick(clients).id, start, end: addDays(start, between(0, 5)), status: start < TODAY ? pick(['Réalisée', 'Réalisée', 'Annulée']) : pick(['En attente', 'Confirmée', 'Confirmée']), ownerId: pick(['e3', 'e4', 'e5', 'e6']), notes: '' }
  })

  // Prospects
  const SOURCES = ['Salon / congrès', 'Site web', 'Recommandation', 'Appel d\'offres', 'Prospection terrain', 'LinkedIn']
  const LEADS = [['Clinique Ibn Khaldoun', 'Tanger'], ['Centre Oncologie Al Azhar', 'Rabat'], ['Clinique Yasmine', 'Marrakech'], ['Hôpital Provincial Khouribga', 'Khouribga'], ['Polyclinique Atlas Agadir', 'Agadir'], ['Clinique Dar Salam', 'Casablanca'], ['Laboratoire BioLab', 'Fès'], ['Centre de rééducation Anfa', 'Casablanca'], ['Clinique Les Orangers', 'Meknès'], ['Clinique du Détroit', 'Tétouan']]
  const leads = LEADS.map(([company, city], i) => ({ id: `ld${i + 1}`, company, contact: pick(['Dr. Benjelloun', 'M. Chraibi', 'Mme Bennani', 'Dr. El Idrissi', 'M. Tazi']), city, phone: `+212 6 ${between(10, 99)} ${between(10, 99)} ${between(10, 99)} ${between(10, 99)}`, email: '', source: pick(SOURCES), status: pick(['Nouveau', 'Contacté', 'Qualifié', 'Qualifié', 'Converti', 'Perdu']), ownerId: pick(['e3', 'e4', 'e5']), value: between(40, 900) * 1000, createdAt: addDays(TODAY, -between(1, 120)), notes: '' }))

  // Marketing
  const campaigns = [
    { id: 'cp1', name: 'Lancement échographe ZONCARE Q7', channel: 'E-mail', segment: 'Cliniques privées', subject: 'Découvrez le ZONCARE Q7 en démonstration', body: '', status: 'Envoyée', sentAt: addDays(TODAY, -21), recipients: 7, opens: 5, clicks: 2 },
    { id: 'cp2', name: 'Relance consommables trimestrielle', channel: 'WhatsApp', segment: 'Tous les clients', subject: '', body: '', status: 'Planifiée', sentAt: addDays(TODAY, 5), recipients: 18, opens: 0, clicks: 0 },
  ]

  // Utilisateurs & rôles
  const ALL = ['dashboard', 'crm', 'inventory', 'sales', 'purchases', 'pos', 'finance', 'attachments', 'accounting', 'projects', 'hr', 'subscriptions', 'contracts', 'analytics', 'bookings', 'prospects', 'planning', 'marketing', 'ai', 'importer', 'tenders', 'service', 'quality']
  const users = [
    { id: 'u1', name: 'Hassan BAKALI', email: 'hassan@liyahealth.ma', role: 'Propriétaire', modules: ALL, active: true, lastLogin: `${TODAY}T08:12:00` },
    { id: 'u2', name: 'Salma Idrissi', email: 'salma@liyahealth.ma', role: 'Commercial', modules: ['dashboard', 'crm', 'sales', 'prospects', 'tenders', 'marketing', 'ai'], active: true, lastLogin: addDays(TODAY, -1) + 'T09:40:00' },
    { id: 'u3', name: 'Fatima Zahra Lahlou', email: 'fz@liyahealth.ma', role: 'Comptable', modules: ['dashboard', 'finance', 'accounting', 'purchases', 'sales', 'attachments'], active: true, lastLogin: addDays(TODAY, -2) + 'T10:05:00' },
    { id: 'u4', name: 'Karim Ouazzani', email: 'karim@liyahealth.ma', role: 'Technicien', modules: ['planning', 'service', 'inventory', 'quality'], active: true, lastLogin: addDays(TODAY, -1) + 'T07:58:00' },
    { id: 'u5', name: 'Rachid Amrani', email: 'rachid@liyahealth.ma', role: 'Magasinier', modules: ['inventory', 'purchases', 'pos'], active: true, lastLogin: addDays(TODAY, -3) + 'T08:30:00' },
  ]
  // Documents : mode de paiement prévu sur les factures
  for (const d of documents) if (d.type === 'facture' || d.type === 'facture_f') d.paymentMethod = d.paymentMethod || pick(['Virement', 'Virement', 'Chèque', 'Effet'])
  for (const iv of interventions) if (iv.status === 'Terminée' && r() < 0.06) iv.status = pick(['Échouée', 'Reportée'])

  return {
    version: 4,
    settings: {
      company: COMPANY,
      modules: null, // null => valeurs par défaut du registre
      ai: { apiKey: '', proxyUrl: '', model: 'claude-opus-5-5', effort: 'medium', autoInsights: true },
      theme: 'light',
      counters,
      user: { name: 'Hassan BAKALI', role: 'Directeur Général', userId: 'u1', employeeId: 'e1' },
      general: { currency: 'MAD', defaultTva: 20, language: 'fr', rib: '011 780 0000123456789012 34', paymentTerms: 'Paiement à 60 jours fin de mois. Pénalités de retard selon la loi 69-21.', footer: 'Merci de votre confiance.', logo: '', stamp: '' },
      invoiceTemplate: 'moderne',
      onboarding: { dismissed: false },
      security: { twoFactor: false, sessions: [{ id: 'sess1', device: 'Chrome · Windows', location: 'Casablanca', lastSeen: new Date().toISOString(), current: true }, { id: 'sess2', device: 'Safari · iPhone', location: 'Casablanca', lastSeen: addDays(TODAY, -1) + 'T21:10:00', current: false }] },
      integrations: { apiKey: '', webhooks: [] },
      analyticsWidgets: null,
    },
    warehouses, suppliers, products, clients, employees, documents, payments, movements, equipment, interventions, tenders, quality,
    opportunities, expenses, leaves, contracts,
    registers, posSessions, posTickets, folders, files, projects, tasks, attendance, payslips, plans, subscriptions, bookings, leads, campaigns, users,
    activities: [], aiChats: [],
  }
}
