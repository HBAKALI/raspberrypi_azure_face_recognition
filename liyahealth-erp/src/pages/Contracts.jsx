import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { Badge, DataTable, Field, Icon, Kpi, Modal, PageHead, Progress, Seg } from '../components/ui.jsx'
import { TODAY, addDays, daysBetween, fdate, int, money, moneyK, uid } from '../lib/domain.js'

const TYPES = ['Maintenance préventive', 'Full service', 'Consommables', 'Location', 'Distribution exclusive', 'Autorisation fabricant', 'Marché public']
const CLIENT_TYPES = ['CHU', 'Hôpital public', 'Clinique privée', 'Centre d\'imagerie', 'Centre spécialisé', 'Cabinet', 'Laboratoire']

export function contractStatus(k) {
  if (['Résilié', 'Brouillon'].includes(k.status)) return k.status
  if (k.end && k.end < TODAY) return 'Expiré'
  if (k.end && daysBetween(TODAY, k.end) <= 60) return 'À renouveler'
  return k.status || 'Actif'
}
const ST_COLOR = { Actif: 'green', 'À renouveler': 'amber', Expiré: 'red', Résilié: 'gray', Brouillon: 'gray' }

const addMonths = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setMonth(x.getMonth() + n); return x.toISOString().slice(0, 10) }

export default function Contracts() {
  const { db, update, toast, log } = useStore()
  const [wizard, setWizard] = useState(false)
  const [view, setView] = useState(null)
  const party = (k) => ((k.partyType === 'supplier' ? db.suppliers : db.clients).find((p) => p.id === k.clientId)?.name || '—')

  const k = useMemo(() => {
    const st = db.contracts.map((c) => ({ c, s: contractStatus(c) }))
    const active = st.filter((x) => ['Actif', 'À renouveler'].includes(x.s))
    return { active: active.length, amount: active.reduce((s, x) => s + Number(x.c.amount || 0), 0), renew: st.filter((x) => x.s === 'À renouveler').length, expired: st.filter((x) => x.s === 'Expiré').length }
  }, [db.contracts])

  const renew = (c) => {
    const end = addMonths(c.end && c.end > TODAY ? c.end : TODAY, 12)
    update('contracts', c.id, { end, status: 'Actif' })
    log(`Contrat ${c.number} renouvelé jusqu'au ${fdate(end)}`, 'repeat')
    toast('Contrat renouvelé pour 12 mois'); setView({ ...c, end, status: 'Actif' })
  }
  const terminate = (c) => {
    update('contracts', c.id, { status: 'Résilié' })
    log(`Contrat ${c.number} résilié`, 'x')
    toast('Contrat résilié'); setView({ ...c, status: 'Résilié' })
  }

  return (
    <div className="stack">
      <PageHead title="Contrats" sub="Contrats clients (maintenance, location, consommables) et fournisseurs (distribution, autorisations fabricant)." crumbs="Commercial › Contrats">
        <button className="btn primary" onClick={() => setWizard(true)}><Icon name="plus" size={15} />Nouveau contrat</button>
      </PageHead>
      <div className="grid g4">
        <Kpi label="Contrats actifs" value={int(k.active)} icon="contract" color="navy" />
        <Kpi label="Montant des contrats actifs" value={moneyK(k.amount)} icon="money" color="teal" />
        <Kpi label="À renouveler (< 60 j)" value={int(k.renew)} icon="repeat" color="amber" />
        <Kpi label="Expirés" value={int(k.expired)} icon="alert" color="red" />
      </div>
      <DataTable rows={db.contracts} exportName="contrats" onRowClick={setView}
        searchKeys={['number', 'title', 'type', party]}
        filters={[
          { key: 'type', label: 'Type', options: TYPES },
          { key: 'partyType', label: 'Tiers', options: ['Client', 'Fournisseur'], get: (c) => (c.partyType === 'supplier' ? 'Fournisseur' : 'Client') },
          { key: 'st', label: 'Statut', options: ['Actif', 'À renouveler', 'Expiré', 'Résilié'], get: contractStatus },
        ]}
        columns={[
          { key: 'number', label: 'N°', strong: true },
          { key: 'title', label: 'Titre', render: (c) => c.title || '—' },
          { key: 'party', label: 'Tiers', sort: party, csv: party, render: (c) => <span>{party(c)} <span className="muted small">· {c.partyType === 'supplier' ? 'fournisseur' : 'client'}</span></span> },
          { key: 'type', label: 'Type' },
          { key: 'amount', label: 'Montant HT', right: true, render: (c) => (c.amount ? money(c.amount) : '—') },
          { key: 'start', label: 'Début', render: (c) => fdate(c.start) },
          { key: 'end', label: 'Fin', render: (c) => fdate(c.end) },
          { key: 'status', label: 'Statut', sort: contractStatus, csv: contractStatus, render: (c) => { const s = contractStatus(c); return <Badge color={ST_COLOR[s]}>{s}</Badge> } },
        ]} />
      {wizard && <ContractWizard onClose={() => setWizard(false)} />}
      {view && (
        <Modal size="xl" title={`Contrat ${view.number}`} onClose={() => setView(null)}
          footer={<>
            {contractStatus(view) !== 'Résilié' && <button className="btn danger" onClick={() => terminate(view)}><Icon name="x" size={15} />Résilier</button>}
            <span className="spacer" />
            <button className="btn" onClick={() => window.print()}><Icon name="printer" size={15} />Imprimer</button>
            <button className="btn primary" onClick={() => renew(view)}><Icon name="repeat" size={15} />Renouveler (+12 mois)</button>
          </>}>
          <ContractSheet c={view} partyName={party(view)} />
        </Modal>
      )}
    </div>
  )
}

function ContractSheet({ c, partyName }) {
  const { db } = useStore()
  const co = db.settings.company
  const s = contractStatus(c)
  const total = c.start && c.end ? Math.max(1, daysBetween(c.start, c.end)) : 1
  const elapsed = c.start ? Math.min(1, Math.max(0, daysBetween(c.start, TODAY) / total)) : 0
  const row = (l, v) => <tr><td style={{ color: '#64748b', width: 220 }}>{l}</td><td style={{ fontWeight: 600 }}>{v}</td></tr>
  return (
    <div className="stack">
      <div className="row"><Badge color={ST_COLOR[s]}>{s}</Badge><span className="muted small">{Math.round(elapsed * 100)} % de la durée écoulée</span><span className="spacer" /><div style={{ width: 220 }}><Progress value={elapsed} color={s === 'Expiré' ? 'var(--red)' : undefined} /></div></div>
      <div className="print-area">
        <div className="print-doc" style={{ borderRadius: 12, border: '1px solid #e3e9f1' }}>
          <div className="print-band" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, flexWrap: 'wrap', gap: 12 }}>
            <div><div style={{ fontWeight: 800, fontSize: 18, color: '#0b2545' }}>LIYA HEALTH</div><div style={{ fontSize: 11, color: '#13a89e', fontWeight: 600 }}>{co.tagline}</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 20, fontWeight: 800, color: '#0b2545' }}>CONTRAT</div><div style={{ fontWeight: 700 }}>N° {c.number}</div></div>
          </div>
          <h3 style={{ marginTop: 18, color: '#0b2545' }}>{c.title || c.type}</h3>
          <table><tbody>
            {row('Entre', `${co.name} — ${co.rc} — ICE ${co.ice}`)}
            {row(c.partyType === 'supplier' ? 'Et le fournisseur' : 'Et le client', partyName)}
            {row('Type de contrat', c.type)}
            {row('Période', `du ${fdate(c.start)} au ${fdate(c.end)}`)}
            {row('Montant HT', c.amount ? money(c.amount) : 'Sans montant')}
            {c.visits ? row('Visites préventives / an', c.visits) : null}
            {row('Renouvellement', c.autoRenew ? 'Tacite reconduction (12 mois)' : 'Sur accord exprès des parties')}
            {c.notes ? row('Conditions particulières', c.notes) : null}
          </tbody></table>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 36, fontSize: 12 }}>
            <div>Pour {co.name}<br />{co.manager}</div><div style={{ textAlign: 'right' }}>Pour {partyName}<br />Signature et cachet</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContractWizard({ onClose }) {
  const { db, mutate, toast, log } = useStore()
  const year = TODAY.slice(0, 4)
  const [step, setStep] = useState(1)
  const [c, setC] = useState({ partyType: 'client', clientId: db.clients[0]?.id || '', title: '', type: 'Maintenance préventive', amount: 0, start: TODAY, end: addMonths(TODAY, 12), visits: 2, autoRenew: true, notes: '' })
  const [newClient, setNewClient] = useState(null)
  const set = (k, v) => setC({ ...c, [k]: v })
  const parties = c.partyType === 'supplier' ? db.suppliers : db.clients
  const number = `${c.partyType === 'supplier' ? 'CD' : 'CM'}-${year}-${String(db.contracts.filter((x) => (x.number || '').includes(`-${year}-`)).length + 1).padStart(3, '0')}`
  const partyName = newClient ? newClient.name : parties.find((p) => p.id === c.clientId)?.name || '—'

  const next = () => {
    if (step === 1 && !newClient && !c.clientId) return toast('Choisissez un tiers')
    if (step === 1 && newClient && !newClient.name) return toast('Nom du nouveau client obligatoire')
    if (step === 2 && !c.title) return toast('Donnez un titre au contrat')
    if (step === 3 && c.end < c.start) return toast('La date de fin précède la date de début')
    setStep(step + 1)
  }
  const save = () => {
    const clientId = newClient ? uid() : c.clientId
    const code = `CL${String(db.clients.length + 1).padStart(4, '0')}`
    mutate((d) => {
      if (newClient) d.clients.unshift({ id: clientId, code, name: newClient.name, type: newClient.type, city: newClient.city, ice: '', phone: '', email: '', contact: '', paymentTerms: 60, creditLimit: 600000, public: ['CHU', 'Hôpital public'].includes(newClient.type) })
      d.contracts.unshift({ id: uid(), number, ...c, clientId, amount: Number(c.amount) || 0, visits: Number(c.visits) || 0, status: 'Actif' })
    })
    log(`Contrat ${number} créé — ${partyName}`, 'contract')
    toast(`Contrat ${number} créé`)
    onClose()
  }

  const steps = ['Tiers', 'Détails', 'Conditions', 'Récapitulatif']
  return (
    <Modal size="xl" title={`Nouveau contrat — étape ${step} / 4`} onClose={onClose}
      footer={<>
        {step > 1 && <button className="btn" onClick={() => setStep(step - 1)}>Précédent</button>}
        <span className="spacer" />
        {step < 4 ? <button className="btn primary" onClick={next}>Suivant<Icon name="arrowRight" size={14} /></button> : <button className="btn primary" onClick={save}><Icon name="check" size={15} />Créer le contrat</button>}
      </>}>
      <div className="row" style={{ gap: 6, marginBottom: 18 }}>{steps.map((s, i) => <div key={s} style={{ flex: 1 }}><Progress value={step > i ? 1 : 0} /><div className="small muted" style={{ marginTop: 4 }}>{i + 1}. {s}</div></div>)}</div>
      {step === 1 && (
        <div className="stack">
          <Field label="Type de tiers"><Seg options={[['client', 'Client'], ['supplier', 'Fournisseur']]} value={c.partyType} onChange={(v) => { setNewClient(null); setC({ ...c, partyType: v, clientId: (v === 'supplier' ? db.suppliers : db.clients)[0]?.id || '', type: v === 'supplier' ? 'Distribution exclusive' : 'Maintenance préventive' }) }} /></Field>
          {!newClient ? (
            <div className="row wrap" style={{ alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 260 }}><Field label={c.partyType === 'supplier' ? 'Fournisseur' : 'Client'}><select className="input" value={c.clientId} onChange={(e) => set('clientId', e.target.value)}>{parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field></div>
              {c.partyType === 'client' && <button className="btn" onClick={() => setNewClient({ name: '', city: 'Casablanca', type: 'Clinique privée' })}><Icon name="plus" size={14} />Nouveau client</button>}
            </div>
          ) : (
            <div className="card" style={{ padding: 16 }}>
              <div className="row" style={{ marginBottom: 12 }}><b>Nouveau client</b><span className="spacer" /><button className="btn sm ghost" onClick={() => setNewClient(null)}>Choisir un client existant</button></div>
              <div className="form">
                <Field label="Nom"><input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} /></Field>
                <Field label="Ville"><input value={newClient.city} onChange={(e) => setNewClient({ ...newClient, city: e.target.value })} /></Field>
                <Field label="Type"><select value={newClient.type} onChange={(e) => setNewClient({ ...newClient, type: e.target.value })}>{CLIENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
              </div>
              <div className="muted small" style={{ marginTop: 8 }}>Le client sera créé à l'enregistrement du contrat.</div>
            </div>
          )}
        </div>
      )}
      {step === 2 && (
        <div className="form">
          <Field label="Numéro (automatique)"><input value={number} disabled /></Field>
          <Field label="Type de contrat"><select value={c.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Titre" full><input value={c.title} placeholder={`Ex. : ${c.type} — ${partyName}`} onChange={(e) => set('title', e.target.value)} /></Field>
        </div>
      )}
      {step === 3 && (
        <div className="form">
          <Field label="Montant HT (DH)"><input type="number" value={c.amount} onChange={(e) => set('amount', e.target.value)} /></Field>
          <Field label="Visites préventives / an"><input type="number" value={c.visits} onChange={(e) => set('visits', e.target.value)} /></Field>
          <Field label="Début"><input type="date" value={c.start} onChange={(e) => set('start', e.target.value)} /></Field>
          <Field label="Fin"><input type="date" value={c.end} onChange={(e) => set('end', e.target.value)} /></Field>
          <Field label="Renouvellement automatique"><label className="switch"><input type="checkbox" checked={c.autoRenew} onChange={(e) => set('autoRenew', e.target.checked)} /><span /></label></Field>
          <Field label="Conditions particulières" full><textarea value={c.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
      )}
      {step === 4 && <ContractSheet c={{ ...c, number }} partyName={partyName} />}
    </Modal>
  )
}
