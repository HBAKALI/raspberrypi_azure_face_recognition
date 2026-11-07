import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { useRoute } from '../lib/nav.js'
import { PageHead, Kpi, Tabs, Badge, Card, Icon, Empty } from '../components/ui.jsx'
import CrudPage from '../components/CrudPage.jsx'
import { TODAY, addDays, daysBetween, fdate, money, pct, int } from '../lib/domain.js'

const CONTRACTS = ['Garantie constructeur', 'Contrat Standard', 'Contrat Premium', 'Hors contrat']
const EQ_STATUS = ['Actif', 'En maintenance', 'Hors service']
const IV_TYPES = ['Maintenance préventive', 'Corrective', 'Installation', 'Formation utilisateurs', 'Contrôle qualité']

export default function Service() {
  const { db, add, update, toast, log } = useStore()
  const route = useRoute()
  const [tab, setTab] = useState(['parc', 'interventions', 'planning', 'contrats'].includes(route.tab) ? route.tab : 'parc')

  const prod = (id) => db.products.find((p) => p.id === id)
  const cli = (id) => db.clients.find((c) => c.id === id)
  const emp = (id) => db.employees.find((e) => e.id === id)
  const eqOf = (id) => db.equipment.find((e) => e.id === id)
  const techs = db.employees.filter((e) => e.dept === 'SAV / Technique')
  const productOpts = db.products.filter((p) => p.kind === 'equip').map((p) => [p.id, p.name])
  const clientOpts = db.clients.map((c) => [c.id, c.name])

  const total = db.equipment.length
  const underWarranty = db.equipment.filter((e) => e.warrantyEnd && e.warrantyEnd >= TODAY).length
  const late = db.equipment.filter((e) => e.nextMaintenance && e.nextMaintenance < TODAY)
  const upcoming = db.interventions.filter((i) => i.status !== 'Terminée' && i.date >= TODAY).length
  const availability = total ? db.equipment.filter((e) => e.status === 'Actif').length / total : 0

  const plan = (eq) => {
    const date = addDays(TODAY, 7)
    const n = db.interventions.length + 1
    add('interventions', { number: `INT-${String(n).padStart(4, '0')}`, equipmentId: eq.id, clientId: eq.clientId, type: 'Maintenance préventive', date, techId: techs[n % Math.max(techs.length, 1)]?.id || '', status: 'Planifiée', priority: 'Moyenne', duration: 2, report: '' })
    update('equipment', eq.id, { nextMaintenance: date })
    log(`Maintenance préventive planifiée : ${eq.serial}`, 'wrench')
    toast(`Intervention planifiée le ${fdate(date)}`)
  }

  const horizon = addDays(TODAY, 30)
  const next = db.interventions.filter((i) => i.status !== 'Terminée' && i.date >= TODAY && i.date <= horizon).sort((a, b) => a.date.localeCompare(b.date))
  const byDate = next.reduce((m, i) => { (m[i.date] ||= []).push(i); return m }, {})

  return (
    <div className="stack">
      <PageHead title="SAV & parc installé" sub="Équipements installés, garanties, contrats de maintenance et interventions biomédicales." crumbs="Opérations" />
      <div className="grid g4">
        <Kpi label="Équipements installés" value={int(total)} icon="layers" color="navy" foot={`${db.clients.filter((c) => db.equipment.some((e) => e.clientId === c.id)).length} sites clients`} />
        <Kpi label="Sous garantie" value={int(underWarranty)} icon="shield" color="teal" foot={pct(total ? underWarranty / total : 0, 0) + ' du parc'} />
        <Kpi label="Maintenances en retard" value={int(late.length)} icon="alert" color="red" foot={`${upcoming} intervention(s) à venir`} />
        <Kpi label="Taux de disponibilité" value={pct(availability)} icon="activity" color="green" foot="Équipements actifs / parc total" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['parc', 'Parc installé'], ['interventions', 'Interventions'], ['planning', 'Planning'], ['contrats', 'Contrats']]} />

      {tab === 'parc' && (
        <CrudPage col="equipment" entity="Équipement" defaults={{ status: 'Actif', contract: 'Garantie constructeur', installDate: TODAY, warrantyEnd: addDays(TODAY, 730), nextMaintenance: addDays(TODAY, 180) }}
          searchKeys={['serial', 'location', (r) => prod(r.productId)?.name, (r) => cli(r.clientId)?.name]}
          filters={[{ key: 'status', label: 'Statut', options: EQ_STATUS }, { key: 'contract', label: 'Contrat', options: CONTRACTS }]}
          fields={[
            { key: 'serial', label: 'N° de série' }, { key: 'productId', label: 'Produit', type: 'select', options: productOpts },
            { key: 'clientId', label: 'Client', type: 'select', options: clientOpts }, { key: 'location', label: 'Service / localisation' },
            { key: 'installDate', label: 'Date d\'installation', type: 'date' }, { key: 'warrantyEnd', label: 'Fin de garantie', type: 'date' },
            { key: 'contract', label: 'Contrat', type: 'select', options: CONTRACTS }, { key: 'nextMaintenance', label: 'Prochaine maintenance', type: 'date' },
            { key: 'status', label: 'Statut', type: 'select', options: EQ_STATUS, placeholder: false },
          ]}
          columns={[
            { key: 'serial', label: 'N° série', strong: true },
            { key: 'productId', label: 'Équipement', render: (r) => prod(r.productId)?.name || '—', sort: (r) => prod(r.productId)?.name || '' },
            { key: 'clientId', label: 'Client', render: (r) => <div>{cli(r.clientId)?.name || '—'}<div className="muted small">{r.location}</div></div>, sort: (r) => cli(r.clientId)?.name || '' },
            { key: 'warrantyEnd', label: 'Garantie', render: (r) => (r.warrantyEnd >= TODAY ? <Badge color="teal">Sous garantie</Badge> : <span className="muted">{fdate(r.warrantyEnd)}</span>) },
            { key: 'contract', label: 'Contrat' },
            { key: 'nextMaintenance', label: 'Proch. maintenance', render: (r) => <span style={{ color: r.nextMaintenance < TODAY ? 'var(--red)' : undefined, fontWeight: r.nextMaintenance < TODAY ? 700 : 400 }}>{fdate(r.nextMaintenance)}</span> },
            { key: 'status', label: 'Statut', render: (r) => <Badge>{r.status}</Badge> },
          ]}
        />
      )}

      {tab === 'interventions' && (
        <CrudPage col="interventions" entity="Intervention" defaults={{ number: `INT-${String(db.interventions.length + 1).padStart(4, '0')}`, type: 'Maintenance préventive', date: TODAY, status: 'Planifiée', priority: 'Moyenne', duration: 2 }}
          searchKeys={['number', 'type', (r) => eqOf(r.equipmentId)?.serial, (r) => cli(r.clientId)?.name]}
          filters={[{ key: 'status', label: 'Statut', options: ['Planifiée', 'En cours', 'Terminée'] }, { key: 'type', label: 'Type', options: IV_TYPES }]}
          fields={[
            { key: 'number', label: 'N° intervention' },
            { key: 'equipmentId', label: 'Équipement', type: 'select', options: db.equipment.map((e) => [e.id, `${e.serial} — ${prod(e.productId)?.name || ''}`]) },
            { key: 'clientId', label: 'Client', type: 'select', options: clientOpts }, { key: 'type', label: 'Type', type: 'select', options: IV_TYPES, placeholder: false },
            { key: 'date', label: 'Date', type: 'date' }, { key: 'techId', label: 'Technicien', type: 'select', options: techs.map((t) => [t.id, t.name]) },
            { key: 'status', label: 'Statut', type: 'select', options: ['Planifiée', 'En cours', 'Terminée'], placeholder: false },
            { key: 'priority', label: 'Priorité', type: 'select', options: ['Basse', 'Moyenne', 'Haute'], placeholder: false },
            { key: 'duration', label: 'Durée (h)', type: 'number' }, { key: 'report', label: 'Rapport d\'intervention', type: 'textarea' },
          ]}
          columns={[
            { key: 'number', label: 'N°', strong: true }, { key: 'date', label: 'Date', render: (r) => fdate(r.date) },
            { key: 'type', label: 'Type' },
            { key: 'equipmentId', label: 'Équipement', render: (r) => { const e = eqOf(r.equipmentId); return e ? <div>{prod(e.productId)?.name}<div className="muted small">{e.serial}</div></div> : '—' } },
            { key: 'clientId', label: 'Client', render: (r) => cli(r.clientId)?.name || '—', sort: (r) => cli(r.clientId)?.name || '' },
            { key: 'techId', label: 'Technicien', render: (r) => emp(r.techId)?.name || '—' },
            { key: 'priority', label: 'Priorité', render: (r) => <Badge>{r.priority}</Badge> },
            { key: 'status', label: 'Statut', render: (r) => <Badge>{r.status}</Badge> },
          ]}
        />
      )}

      {tab === 'planning' && (
        <div className="grid g2">
          <Card title="Interventions des 30 prochains jours" icon="calendar">
            {!next.length && <Empty icon="calendar" title="Aucune intervention planifiée">Le planning des 30 prochains jours est vide.</Empty>}
            <div className="stack" style={{ gap: 14 }}>
              {Object.entries(byDate).map(([date, list]) => {
                const byTech = list.reduce((m, i) => { (m[i.techId] ||= []).push(i); return m }, {})
                return (
                  <div key={date}>
                    <div className="row" style={{ fontWeight: 700, marginBottom: 6 }}><Icon name="calendar" size={15} />{fdate(date)}<span className="muted small">· dans {daysBetween(TODAY, date)} j</span></div>
                    {Object.entries(byTech).map(([tid, ivs]) => (
                      <div key={tid} style={{ paddingLeft: 22, marginBottom: 6 }}>
                        <div className="small muted" style={{ fontWeight: 600 }}>{emp(tid)?.name || 'Non assigné'}</div>
                        {ivs.map((i) => { const e = eqOf(i.equipmentId); return <div key={i.id} className="row small" style={{ gap: 8, padding: '4px 0' }}><Badge>{i.status}</Badge><span>{i.type} — {prod(e?.productId)?.name || '—'} · {cli(i.clientId)?.name}</span></div> })}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </Card>
          <Card title={`Maintenances préventives en retard (${late.length})`} icon="alert">
            {!late.length && <Empty icon="check" title="Parc à jour">Aucune maintenance en retard.</Empty>}
            <div className="stack" style={{ gap: 8 }}>
              {late.sort((a, b) => a.nextMaintenance.localeCompare(b.nextMaintenance)).map((e) => (
                <div key={e.id} className="insight">
                  <div className="ii" style={{ background: '#e052631a', color: 'var(--red)' }}><Icon name="wrench" size={16} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{prod(e.productId)?.name}</div>
                    <div className="muted small">{e.serial} · {cli(e.clientId)?.name} · prévue le {fdate(e.nextMaintenance)} ({daysBetween(e.nextMaintenance, TODAY)} j de retard)</div>
                  </div>
                  <button className="btn sm primary" onClick={() => plan(e)}><Icon name="calendar" size={14} />Planifier</button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'contrats' && (
        <CrudPage col="contracts" entity="Contrat" defaults={{ number: `CM-${TODAY.slice(0, 4)}-${String(db.contracts.length + 1).padStart(3, '0')}`, type: 'Maintenance préventive', start: TODAY, end: addDays(TODAY, 365), visits: 2 }}
          searchKeys={['number', 'type', (r) => cli(r.clientId)?.name]}
          fields={[
            { key: 'number', label: 'N° contrat' }, { key: 'clientId', label: 'Client', type: 'select', options: clientOpts },
            { key: 'type', label: 'Type', type: 'select', options: ['Maintenance préventive', 'Full service', 'Consommables'], placeholder: false },
            { key: 'amount', label: 'Montant annuel HT (DH)', type: 'number' }, { key: 'start', label: 'Début', type: 'date' }, { key: 'end', label: 'Fin', type: 'date' },
            { key: 'visits', label: 'Visites / an', type: 'number' },
          ]}
          columns={[
            { key: 'number', label: 'N°', strong: true },
            { key: 'clientId', label: 'Client', render: (r) => cli(r.clientId)?.name || '—', sort: (r) => cli(r.clientId)?.name || '' },
            { key: 'type', label: 'Type' }, { key: 'start', label: 'Début', render: (r) => fdate(r.start) }, { key: 'end', label: 'Fin', render: (r) => fdate(r.end) },
            { key: 'visits', label: 'Visites', right: true }, { key: 'amount', label: 'Montant HT', right: true, render: (r) => money(r.amount) },
            { key: '_s', label: 'État', noSort: true, render: (r) => (r.end < TODAY ? <Badge color="red">Expiré</Badge> : daysBetween(TODAY, r.end) <= 60 ? <Badge color="amber">À renouveler</Badge> : <Badge color="green">Actif</Badge>) },
          ]}
        />
      )}
    </div>
  )
}
