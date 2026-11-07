import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { PageHead, Kpi, Badge, Tabs, Modal, FormFields, DataTable, Icon, Progress } from '../components/ui.jsx'
import { money, moneyK, fdate, int, pct, TODAY } from '../lib/domain.js'

const STAGES = ['Prospection', 'Qualification', 'Proposition', 'Négociation', 'Gagnée', 'Perdue']
const PROBA = { Prospection: 0.1, Qualification: 0.25, Proposition: 0.45, Négociation: 0.7, Gagnée: 1, Perdue: 0 }
const STAGE_COLOR = { Prospection: '#64748b', Qualification: '#3d7be0', Proposition: '#7b61ff', Négociation: '#e8a33d', Gagnée: '#3bb273', Perdue: '#e05263' }

export function Opportunities() {
  const { db, add, update, remove, toast, log } = useStore()
  const [tab, setTab] = useState('kanban')
  const [edit, setEdit] = useState(null)
  const [over, setOver] = useState(null)
  const opps = db.opportunities
  const client = (id) => db.clients.find((c) => c.id === id)?.name || '—'

  const open = opps.filter((o) => !['Gagnée', 'Perdue'].includes(o.stage))
  const pipeline = open.reduce((s, o) => s + Number(o.amount), 0)
  const weighted = open.reduce((s, o) => s + Number(o.amount) * Number(o.probability), 0)
  const won = opps.filter((o) => o.stage === 'Gagnée').length
  const lost = opps.filter((o) => o.stage === 'Perdue').length

  const fields = [
    { key: 'title', label: 'Opportunité', full: true },
    { key: 'clientId', label: 'Client', type: 'select', options: db.clients.map((c) => [c.id, c.name]) },
    { key: 'amount', label: 'Montant estimé HT (DH)', type: 'number' },
    { key: 'stage', label: 'Étape', type: 'select', options: STAGES, placeholder: false },
    { key: 'probability', label: 'Probabilité (0 à 1)', type: 'number', step: 0.05 },
    { key: 'owner', label: 'Responsable' },
    { key: 'closeDate', label: 'Date de clôture prévue', type: 'date' },
    { key: 'next', label: 'Prochaine action', full: true },
  ]

  const save = () => {
    if (!edit.title || !edit.clientId) return toast('Titre et client obligatoires')
    if (edit.id) update('opportunities', edit.id, edit)
    else { add('opportunities', edit); log(`Opportunité créée : ${edit.title}`, 'target') }
    toast('Opportunité enregistrée')
    setEdit(null)
  }
  const move = (id, stage) => {
    const o = opps.find((x) => x.id === id)
    if (!o || o.stage === stage) return
    update('opportunities', id, { stage, probability: PROBA[stage] })
    log(`${o.title} → ${stage}`, 'target')
    toast(`Déplacée vers « ${stage} »`)
  }

  return (
    <div className="stack">
      <div className="grid g4">
        <Kpi label="Pipeline ouvert" value={moneyK(pipeline)} icon="target" color="violet" foot={`${open.length} opportunités actives`} />
        <Kpi label="Prévision pondérée" value={moneyK(weighted)} icon="trend" color="teal" foot="Montant × probabilité" />
        <Kpi label="Taux de conversion" value={pct(won / Math.max(won + lost, 1), 0)} icon="check" color="green" foot={`${won} gagnée(s) / ${lost} perdue(s)`} />
        <Kpi label="Opportunités" value={int(opps.length)} icon="layers" color="navy" />
      </div>
      <div className="row wrap">
        <div style={{ flex: 1, minWidth: 240 }}><Tabs tabs={[['kanban', 'Pipeline'], ['list', 'Liste']]} value={tab} onChange={setTab} /></div>
        <button className="btn primary" onClick={() => setEdit({ stage: 'Prospection', probability: 0.1, closeDate: TODAY, owner: db.settings.user.name })}><Icon name="plus" size={15} />Nouvelle opportunité</button>
      </div>
      {tab === 'kanban' ? (
        <div className="kanban">
          {STAGES.map((s) => {
            const items = opps.filter((o) => o.stage === s)
            return (
              <div key={s} className={`kcol ${over === s ? 'drop' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setOver(s) }} onDragLeave={() => setOver(null)}
                onDrop={(e) => { e.preventDefault(); setOver(null); move(e.dataTransfer.getData('text/plain'), s) }}>
                <div className="kcol-h"><i style={{ width: 10, height: 10, borderRadius: 3, background: STAGE_COLOR[s] }} />{s}<span className="spacer" /><span className="muted small">{items.length} · {moneyK(items.reduce((a, o) => a + Number(o.amount), 0))}</span></div>
                {items.map((o) => (
                  <div key={o.id} className="kcard" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', o.id)} onClick={() => setEdit({ ...o })}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{o.title}</div>
                    <div className="muted small">{client(o.clientId)}</div>
                    <div className="row" style={{ margin: '8px 0 6px' }}><b className="num">{money(o.amount)}</b><span className="spacer" /><span className="small muted">{Math.round(o.probability * 100)} %</span></div>
                    <Progress value={o.probability} color={STAGE_COLOR[s]} />
                    <div className="row small muted" style={{ marginTop: 8 }}><Icon name="calendar" size={13} />{fdate(o.closeDate)}<span className="spacer" />{o.owner?.split(' ')[0]}</div>
                    {o.next && <div className="small" style={{ marginTop: 6, color: 'var(--teal)' }}>→ {o.next}</div>}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <DataTable rows={opps} exportName="opportunites" onRowClick={(o) => setEdit({ ...o })}
          searchKeys={['title', 'owner', (o) => client(o.clientId)]}
          filters={[{ key: 'stage', label: 'Étape', options: STAGES }]}
          columns={[
            { key: 'title', label: 'Opportunité', strong: true },
            { key: 'client', label: 'Client', sort: (o) => client(o.clientId), render: (o) => client(o.clientId) },
            { key: 'amount', label: 'Montant HT', right: true, render: (o) => money(o.amount) },
            { key: 'probability', label: 'Proba.', right: true, render: (o) => `${Math.round(o.probability * 100)} %` },
            { key: 'stage', label: 'Étape', render: (o) => <Badge>{o.stage}</Badge> },
            { key: 'owner', label: 'Responsable' },
            { key: 'closeDate', label: 'Clôture', render: (o) => fdate(o.closeDate) },
          ]} />
      )}
      {edit && (
        <Modal title={edit.id ? 'Modifier l\'opportunité' : 'Nouvelle opportunité'} onClose={() => setEdit(null)}
          footer={<>
            {edit.id && <button className="btn danger" onClick={() => { remove('opportunities', edit.id); setEdit(null); toast('Opportunité supprimée') }}><Icon name="trash" size={15} />Supprimer</button>}
            <span className="spacer" />
            <button className="btn" onClick={() => setEdit(null)}>Annuler</button>
            <button className="btn primary" onClick={save}><Icon name="check" size={15} />Enregistrer</button>
          </>}>
          <FormFields fields={fields} value={edit} onChange={(v) => setEdit(v.stage !== edit.stage ? { ...v, probability: PROBA[v.stage] } : v)} />
        </Modal>
      )}
    </div>
  )
}

// Compatibilité : page autonome « CRM & opportunités »
export default function Crm() {
  return (
    <div className="stack">
      <PageHead title="CRM & opportunités" sub="Pipeline commercial, prévision pondérée et suivi des délégués" crumbs="Commercial › CRM" />
      <Opportunities />
    </div>
  )
}
