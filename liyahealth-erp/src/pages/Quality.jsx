import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { PageHead, Kpi, Badge, Card, Icon } from '../components/ui.jsx'
import CrudPage from '../components/CrudPage.jsx'
import { fdate, int, TODAY, daysBetween } from '../lib/domain.js'

const TYPES = ['Réclamation client', 'Incident matériovigilance', 'Rappel fabricant (FSCA)', 'Non-conformité réception', 'Audit interne']
const SEVERITIES = ['Critique', 'Majeure', 'Mineure']
const STATUSES = ['Ouvert', 'En investigation', 'CAPA en cours', 'Clôturé']

export default function Quality() {
  const { db } = useStore()
  const [lotQ, setLotQ] = useState('')
  const product = (id) => db.products.find((p) => p.id === id)
  const client = (id) => db.clients.find((c) => c.id === id)

  const open = db.quality.filter((q) => q.status !== 'Clôturé')
  const closed = db.quality.filter((q) => q.status === 'Clôturé')
  const avgClose = closed.length ? Math.round(closed.reduce((s, q) => s + Math.max(0, daysBetween(q.date, TODAY)), 0) / closed.length / 2) : 0

  const fields = [
    { key: 'number', label: 'Numéro' },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'type', label: 'Type d\'événement', type: 'select', options: TYPES },
    { key: 'productId', label: 'Produit concerné', type: 'select', options: db.products.map((p) => [p.id, `${p.ref} — ${p.name}`]) },
    { key: 'lot', label: 'N° de lot / série' },
    { key: 'clientId', label: 'Client', type: 'select', options: db.clients.map((c) => [c.id, c.name]) },
    { key: 'severity', label: 'Gravité', type: 'select', options: SEVERITIES },
    { key: 'status', label: 'Statut', type: 'select', options: STATUSES, placeholder: false },
    { key: 'owner', label: 'Responsable' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'capa', label: 'Actions correctives et préventives (CAPA)', type: 'textarea' },
  ]

  // Traçabilité : retrouve un lot, ses mouvements et les clients livrés du produit.
  const trace = useMemo(() => {
    const s = lotQ.trim().toLowerCase()
    if (s.length < 3) return null
    for (const p of db.products) {
      const lot = (p.lots || []).find((l) => l.lot.toLowerCase().includes(s))
      if (!lot) continue
      const moves = db.movements.filter((m) => m.productId === p.id && (!m.lot || m.lot === lot.lot)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
      const inv = db.documents.filter((d) => ['facture', 'bl'].includes(d.type) && d.lines.some((l) => l.productId === p.id))
      const byClient = {}
      for (const d of inv) {
        const qty = d.lines.filter((l) => l.productId === p.id).reduce((a, l) => a + Number(l.qty), 0)
        const c = byClient[d.partyId] ||= { client: client(d.partyId), qty: 0, last: d.date, docs: [] }
        c.qty += qty; c.docs.push(d.number); if (d.date > c.last) c.last = d.date
      }
      return { product: p, lot, moves, clients: Object.values(byClient).sort((a, b) => b.last.localeCompare(a.last)) }
    }
    return { notFound: true }
  }, [lotQ, db])

  return (
    <div className="stack">
      <PageHead title="Qualité & matériovigilance" sub="Réclamations, incidents AMMPS, rappels FSCA, CAPA et traçabilité des lots" crumbs="Opérations › Qualité" />
      <div className="grid g4">
        <Kpi label="Événements ouverts" value={int(open.length)} icon="shield" color="amber" />
        <Kpi label="Critiques" value={int(open.filter((q) => q.severity === 'Critique').length)} icon="alert" color="red" foot="Déclaration AMMPS sous 10 jours" />
        <Kpi label="Délai moyen de clôture" value={`${avgClose} j`} icon="clock" color="teal" foot="Estimation sur dossiers clôturés" />
        <Kpi label="Rappels fabricant" value={int(db.quality.filter((q) => q.type.startsWith('Rappel')).length)} icon="refresh" color="violet" />
      </div>

      <Card title="Traçabilité lot" icon="search">
        <input className="input" placeholder="Saisir un numéro de lot (ex. CS25…)" value={lotQ} onChange={(e) => setLotQ(e.target.value)} style={{ maxWidth: 360 }} />
        {trace?.notFound && <div className="muted" style={{ marginTop: 12 }}>Aucun lot correspondant.</div>}
        {trace && !trace.notFound && (
          <div className="grid g3" style={{ marginTop: 16 }}>
            <div className="stack" style={{ gap: 6 }}>
              <b>{trace.product.name}</b>
              <span className="muted small">{trace.product.ref} · Classe {trace.product.dmClass} · {trace.product.ammps}</span>
              <span>Lot <b>{trace.lot.lot}</b> — {int(trace.lot.qty)} en stock</span>
              <span>Péremption : <b>{trace.lot.expiry ? fdate(trace.lot.expiry) : 'Non applicable'}</b></span>
              <span>Dépôt : {db.warehouses.find((w) => w.id === trace.lot.warehouseId)?.name || '—'}</span>
            </div>
            <div>
              <div className="muted small" style={{ fontWeight: 600, marginBottom: 6 }}>DERNIERS MOUVEMENTS</div>
              {trace.moves.map((m) => <div key={m.id} className="row small" style={{ padding: '3px 0' }}><Badge color={m.type === 'Entrée' ? 'green' : 'blue'}>{m.type}</Badge><span>{int(m.qty)}</span><span className="muted">{m.ref}</span><span className="spacer" />{fdate(m.date)}</div>)}
            </div>
            <div>
              <div className="muted small" style={{ fontWeight: 600, marginBottom: 6 }}>CLIENTS À CONTACTER EN CAS DE RAPPEL ({trace.clients.length})</div>
              {trace.clients.slice(0, 10).map((c) => (
                <div key={c.client?.id} className="row small" style={{ padding: '3px 0' }}>
                  <Icon name="building" size={13} /><span style={{ flex: 1 }}>{c.client?.name}</span><b className="num">{int(c.qty)}</b><span className="muted">{fdate(c.last)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <CrudPage col="quality" entity="Événement qualité" fields={fields}
        defaults={{ number: `QA-${TODAY.slice(0, 4)}-${String(db.quality.length + 1).padStart(3, '0')}`, date: TODAY, status: 'Ouvert', severity: 'Majeure', owner: 'Omar Kettani', type: 'Réclamation client' }}
        searchKeys={['number', 'description', 'lot', (q) => product(q.productId)?.name]}
        filters={[{ key: 'status', label: 'Statut', options: STATUSES }, { key: 'severity', label: 'Gravité', options: SEVERITIES }, { key: 'type', label: 'Type', options: TYPES }]}
        validate={(q) => (!q.description ? 'La description est obligatoire' : null)}
        columns={[
          { key: 'number', label: 'N°', strong: true },
          { key: 'date', label: 'Date', render: (q) => fdate(q.date) },
          { key: 'type', label: 'Type' },
          { key: 'product', label: 'Produit / lot', sort: (q) => product(q.productId)?.name, render: (q) => <span><div>{product(q.productId)?.name || '—'}</div><div className="muted small">Lot {q.lot || '—'}</div></span> },
          { key: 'client', label: 'Client', sort: (q) => client(q.clientId)?.name || '', render: (q) => client(q.clientId)?.name || '—' },
          { key: 'severity', label: 'Gravité', render: (q) => <Badge>{q.severity}</Badge> },
          { key: 'status', label: 'Statut', render: (q) => <Badge>{q.status}</Badge> },
        ]} />
    </div>
  )
}
