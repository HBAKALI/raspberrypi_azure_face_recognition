import { useMemo } from 'react'
import { useStore } from '../lib/store.jsx'
import { PageHead, Kpi, Badge } from '../components/ui.jsx'
import CrudPage from '../components/CrudPage.jsx'
import { docTotals, money, moneyK, int } from '../lib/domain.js'

const FIELDS = [
  { key: 'name', label: 'Fabricant / fournisseur' },
  { key: 'country', label: 'Pays' },
  { key: 'specialty', label: 'Spécialité' },
  { key: 'currency', label: 'Devise', type: 'select', options: ['USD', 'EUR', 'MAD', 'CNY', 'CHF'] },
  { key: 'leadTime', label: 'Délai d\'approvisionnement (jours)', type: 'number' },
  { key: 'contact', label: 'Contact' },
  { key: 'email', label: 'E-mail', type: 'email' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'rating', label: 'Évaluation (1 à 5)', type: 'select', options: ['1', '2', '3', '4', '5'], placeholder: false },
  { key: 'partner', label: 'Partenaire officiel', type: 'checkbox' },
]

const stars = (n) => '★'.repeat(Number(n) || 0) + '☆'.repeat(5 - (Number(n) || 0))

export default function Suppliers() {
  const { db } = useStore()
  const stats = useMemo(() => {
    const s = {}
    for (const sup of db.suppliers) s[sup.id] = { products: db.products.filter((p) => p.supplierId === sup.id).length, purchases: 0 }
    for (const d of db.documents) if (d.type === 'facture_f' && d.status === 'Validée' && s[d.partyId]) s[d.partyId].purchases += docTotals(d).ht
    return s
  }, [db])
  const total = Object.values(stats).reduce((a, x) => a + x.purchases, 0)
  const avgLead = db.suppliers.reduce((a, s) => a + Number(s.leadTime || 0), 0) / (db.suppliers.length || 1)

  const columns = [
    { key: 'name', label: 'Fournisseur', strong: true, render: (s) => <span>{s.name} {s.partner && <Badge color="teal">Partenaire</Badge>}</span>, csv: (s) => s.name },
    { key: 'country', label: 'Pays' },
    { key: 'specialty', label: 'Spécialité' },
    { key: 'currency', label: 'Devise' },
    { key: 'leadTime', label: 'Délai', right: true, render: (s) => `${s.leadTime} j` },
    { key: 'np', label: 'Produits', right: true, sort: (s) => stats[s.id]?.products || 0, render: (s) => int(stats[s.id]?.products) },
    { key: 'ach', label: 'Achats HT', right: true, sort: (s) => stats[s.id]?.purchases || 0, render: (s) => money(stats[s.id]?.purchases) },
    { key: 'rating', label: 'Note', render: (s) => <span style={{ color: 'var(--amber)', letterSpacing: 1 }}>{stars(s.rating)}</span>, csv: (s) => s.rating },
  ]

  return (
    <div className="stack">
      <PageHead title="Fournisseurs" sub="Fabricants partenaires, délais d'approvisionnement, devises et évaluation" crumbs="Achats & Stock › Fournisseurs" />
      <div className="grid g4">
        <Kpi label="Fournisseurs" value={int(db.suppliers.length)} icon="globe" color="navy" foot={`${db.suppliers.filter((s) => s.partner).length} partenaires officiels`} />
        <Kpi label="Achats HT 12 mois" value={moneyK(total)} icon="truck" color="blue" />
        <Kpi label="Délai moyen" value={`${Math.round(avgLead)} j`} icon="clock" color="amber" />
        <Kpi label="Pays d'origine" value={int(new Set(db.suppliers.map((s) => s.country)).size)} icon="layers" color="teal" />
      </div>
      <CrudPage col="suppliers" entity="Fournisseur" fields={FIELDS} columns={columns}
        defaults={{ currency: 'USD', leadTime: 45, rating: '4', partner: true }}
        searchKeys={['name', 'country', 'specialty']}
        filters={[{ key: 'country', label: 'Pays', options: [...new Set(db.suppliers.map((s) => s.country))].sort() }]}
        validate={(s) => (!s.name ? 'Le nom du fournisseur est obligatoire' : null)} />
    </div>
  )
}
