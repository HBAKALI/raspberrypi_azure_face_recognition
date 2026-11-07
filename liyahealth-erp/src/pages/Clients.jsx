import { useMemo } from 'react'
import { useStore } from '../lib/store.jsx'
import { PageHead, Kpi, Badge, Card } from '../components/ui.jsx'
import CrudPage from '../components/CrudPage.jsx'
import { clientRisk } from '../ai/engine.js'
import { docTotals, money, moneyK, fdate, payStatus, int } from '../lib/domain.js'

const TYPES = ['CHU', 'Hôpital public', 'Clinique privée', "Centre d'imagerie", 'Centre spécialisé', 'Cabinet', 'Urgences', 'Laboratoire', 'Distributeur']

const FIELDS = [
  { key: 'code', label: 'Code client' },
  { key: 'name', label: 'Raison sociale' },
  { key: 'type', label: 'Type d\'établissement', type: 'select', options: TYPES },
  { key: 'city', label: 'Ville' },
  { key: 'ice', label: 'ICE' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'email', label: 'E-mail', type: 'email' },
  { key: 'contact', label: 'Interlocuteur / service' },
  { key: 'paymentTerms', label: 'Délai de paiement (jours)', type: 'number' },
  { key: 'creditLimit', label: 'Plafond d\'encours (DH)', type: 'number' },
  { key: 'public', label: 'Établissement public', type: 'checkbox' },
]

export default function Clients() {
  const { db } = useStore()
  const risk = useMemo(() => clientRisk(db), [db])
  const byId = useMemo(() => Object.fromEntries(risk.map((r) => [r.client.id, r])), [risk])
  const tot = (k) => risk.reduce((s, r) => s + r[k], 0)

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Client', strong: true },
    { key: 'type', label: 'Type', render: (c) => <Badge color={c.public ? 'blue' : 'teal'}>{c.type}</Badge> },
    { key: 'city', label: 'Ville' },
    { key: 'ca', label: 'CA HT 12 mois', right: true, sort: (c) => byId[c.id]?.revenue || 0, render: (c) => money(byId[c.id]?.revenue) },
    { key: 'enc', label: 'Encours', right: true, sort: (c) => byId[c.id]?.outstanding || 0, render: (c) => money(byId[c.id]?.outstanding) },
    { key: 'risk', label: 'Risque', sort: (c) => byId[c.id]?.score || 0, csv: (c) => byId[c.id]?.level, render: (c) => <Badge>{byId[c.id]?.level || 'Basse'}</Badge> },
  ]

  const detail = (c) => {
    const r = byId[c.id] || {}
    const inv = db.documents.filter((d) => d.type === 'facture' && d.partyId === c.id).sort((a, b) => b.date.localeCompare(a.date))
    const eq = db.equipment.filter((e) => e.clientId === c.id)
    const opps = db.opportunities.filter((o) => o.clientId === c.id)
    return (
      <div className="stack">
        <div className="grid g4">
          <Kpi label="CA HT 12 mois" value={moneyK(r.revenue)} icon="trend" />
          <Kpi label="Encours" value={moneyK(r.outstanding)} icon="wallet" color="blue" />
          <Kpi label="Échu" value={moneyK(r.overdue)} icon="alert" color={r.overdue > 0 ? 'red' : 'green'} />
          <Kpi label="Équipements installés" value={int(eq.length)} icon="wrench" color="amber" />
        </div>
        <div className="grid g2">
          <Card title="Informations" icon="building">
            <div className="stack" style={{ gap: 8 }}>
              {[['Code', c.code], ['Type', c.type], ['Ville', c.city], ['ICE', c.ice], ['Téléphone', c.phone], ['E-mail', c.email], ['Interlocuteur', c.contact], ['Délai de paiement', `${c.paymentTerms} jours`], ['Plafond d\'encours', money(c.creditLimit)], ['Retard moyen', `${Math.round(r.avgDelay || 0)} jours`]].map(([k, v]) => (
                <div key={k} className="row"><span className="muted" style={{ width: 150 }}>{k}</span><b>{v || '—'}</b></div>
              ))}
            </div>
          </Card>
          <Card title="Opportunités" icon="target">
            {opps.length ? opps.map((o) => (
              <div key={o.id} className="row" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ flex: 1 }}>{o.title}</span><b className="num">{moneyK(o.amount)}</b><Badge>{o.stage}</Badge>
              </div>
            )) : <div className="muted">Aucune opportunité en cours.</div>}
          </Card>
        </div>
        <Card title={`Dernières factures (${inv.length})`} icon="file" pad={false}>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Numéro</th><th>Date</th><th>Échéance</th><th className="right">TTC</th><th>Paiement</th></tr></thead>
              <tbody>
                {inv.slice(0, 10).map((d) => (
                  <tr key={d.id}><td className="strong">{d.number}</td><td>{fdate(d.date)}</td><td>{fdate(d.dueDate)}</td><td className="right num">{money(docTotals(d).ttc)}</td><td>{payStatus(db, d) ? <Badge>{payStatus(db, d)}</Badge> : <Badge>{d.status}</Badge>}</td></tr>
                ))}
              </tbody>
            </table>
            {!inv.length && <div className="empty">Aucune facture.</div>}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="stack">
      <PageHead title="Clients" sub="CHU, hôpitaux, cliniques et cabinets : fiches, encours et historique" crumbs="Commercial › Clients" />
      <div className="grid g4">
        <Kpi label="Clients actifs" value={int(db.clients.length)} icon="building" color="navy" foot={`${db.clients.filter((c) => c.public).length} établissements publics`} />
        <Kpi label="CA HT 12 mois" value={moneyK(tot('revenue'))} icon="trend" />
        <Kpi label="Encours clients" value={moneyK(tot('outstanding'))} icon="wallet" color="blue" />
        <Kpi label="Créances échues" value={moneyK(tot('overdue'))} icon="alert" color="red" foot={`${risk.filter((r) => r.level === 'Haute').length} client(s) à risque élevé`} />
      </div>
      <CrudPage col="clients" entity="Client" fields={FIELDS} columns={columns} renderDetail={detail}
        defaults={{ code: `CL${String(db.clients.length + 1).padStart(4, '0')}`, type: 'Clinique privée', paymentTerms: 60, creditLimit: 600000, public: false }}
        searchKeys={['code', 'name', 'city', 'type', 'ice']}
        filters={[{ key: 'type', label: 'Type', options: TYPES }, { key: 'city', label: 'Ville', options: [...new Set(db.clients.map((c) => c.city))].sort() }]}
        validate={(c) => (!c.name ? 'La raison sociale est obligatoire' : null)} />
    </div>
  )
}
