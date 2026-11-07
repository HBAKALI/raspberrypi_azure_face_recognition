import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { useStore } from '../lib/store.jsx'
import { go, useRoute } from '../lib/nav.js'
import { Badge, DataTable, FormFields, Icon, Kpi, Modal, PageHead, Tabs, Confirm, COLORS } from '../components/ui.jsx'
import { TODAY, daysBetween, fdate, int, money, moneyK, pct, uid } from '../lib/domain.js'
import { Opportunities } from './Crm.jsx'

const STATUSES = ['Nouveau', 'Contacté', 'Qualifié', 'Converti', 'Perdu']
const STATUS_COLOR = { Nouveau: 'gray', Contacté: 'blue', Qualifié: 'violet', Converti: 'green', Perdu: 'red' }
const SOURCES = ['Salon / congrès', 'Site web', 'Recommandation', 'Appel d\'offres', 'Prospection terrain', 'LinkedIn']

// Score IA : potentiel du prospect (0–100) à partir de la valeur, de la source, du statut et de la fraîcheur.
export function leadScore(l) {
  if (l.status === 'Perdu') return 0
  if (l.status === 'Converti') return 100
  const value = Math.min(1, Number(l.value || 0) / 600000) * 35
  const source = { Recommandation: 25, 'Appel d\'offres': 22, 'Salon / congrès': 16, LinkedIn: 12, 'Site web': 12, 'Prospection terrain': 10 }[l.source] ?? 8
  const status = { Nouveau: 5, Contacté: 15, Qualifié: 28 }[l.status] ?? 0
  const age = l.createdAt ? daysBetween(l.createdAt, TODAY) : 60
  const fresh = Math.max(0, 12 - age / 10)
  return Math.round(Math.min(99, value + source + status + fresh))
}
const scoreColor = (s) => (s >= 65 ? COLORS.green : s >= 40 ? COLORS.amber : COLORS.red)

export default function Prospects() {
  const { tab } = useRoute()
  const t = tab === 'opportunities' ? 'opportunities' : 'leads'
  return (
    <div className="stack">
      <PageHead title="Prospects & opportunités" sub="Suivi des prospects, conversion en clients et pipeline commercial." crumbs="Commercial › Prospects" />
      <Tabs tabs={[['leads', 'Prospects'], ['opportunities', 'Opportunités']]} value={t} onChange={(x) => go('prospects', x === 'leads' ? '' : x)} />
      {t === 'leads' ? <Leads /> : <Opportunities />}
    </div>
  )
}

function Leads() {
  const { db, mutate, add, update, remove, toast, log } = useStore()
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const emp = (id) => db.employees.find((e) => e.id === id)?.name || '—'
  const sales = db.employees.filter((e) => ['Commercial', 'Direction', 'Appels d\'offres'].includes(e.dept))

  const k = useMemo(() => {
    const open = db.leads.filter((l) => !['Converti', 'Perdu'].includes(l.status))
    const conv = db.leads.filter((l) => l.status === 'Converti').length
    const lost = db.leads.filter((l) => l.status === 'Perdu').length
    return { open: open.length, value: open.reduce((s, l) => s + Number(l.value || 0), 0), rate: conv / Math.max(1, conv + lost), month: db.leads.filter((l) => (l.createdAt || '').slice(0, 7) === TODAY.slice(0, 7)).length }
  }, [db.leads])

  const fields = [
    { key: 'company', label: 'Entreprise' }, { key: 'contact', label: 'Contact' },
    { key: 'city', label: 'Ville' }, { key: 'phone', label: 'Téléphone' },
    { key: 'email', label: 'E-mail' }, { key: 'source', label: 'Source', type: 'select', options: SOURCES },
    { key: 'status', label: 'Statut', type: 'select', options: STATUSES, placeholder: false }, { key: 'ownerId', label: 'Commercial assigné', type: 'select', options: sales.map((e) => [e.id, e.name]) },
    { key: 'value', label: 'Valeur estimée HT (DH)', type: 'number' }, { key: 'createdAt', label: 'Créé le', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ]

  const save = () => {
    if (!edit.company) return toast('Le nom de l\'entreprise est obligatoire')
    if (edit.id) update('leads', edit.id, edit)
    else { add('leads', edit); log(`Prospect créé : ${edit.company}`, 'target') }
    toast('Prospect enregistré'); setEdit(null)
  }

  // Convertit un prospect en client ; renvoie l'id du client (calculé avant la mutation).
  const convert = (l, silent) => {
    if (l.clientId && db.clients.some((c) => c.id === l.clientId)) return l.clientId
    const id = uid()
    const code = `CL${String(db.clients.length + 1).padStart(4, '0')}`
    mutate((d) => {
      d.clients.unshift({ id, code, name: l.company, type: 'Clinique privée', city: l.city || '', ice: '', phone: l.phone || '', email: l.email || '', contact: l.contact || '', paymentTerms: 60, creditLimit: 600000, public: false })
      const x = d.leads.find((y) => y.id === l.id)
      if (x) { x.status = 'Converti'; x.clientId = id }
    })
    log(`Prospect converti en client : ${l.company} (${code})`, 'check')
    if (!silent) toast(`Client ${code} créé`)
    return id
  }
  const toOpportunity = (l) => {
    const clientId = convert(l, true)
    add('opportunities', { title: `Équipement — ${l.company}`, clientId, amount: Number(l.value || 0), stage: 'Qualification', probability: 0.25, owner: emp(l.ownerId), closeDate: TODAY.slice(0, 8) + '28', next: 'Visite / démonstration' })
    log(`Opportunité créée depuis le prospect ${l.company}`, 'target')
    toast('Opportunité créée (étape Qualification)')
    go('prospects', 'opportunities')
  }

  const exportXlsx = () => {
    const rows = db.leads.map((l) => ({ Entreprise: l.company, Contact: l.contact, Ville: l.city, Téléphone: l.phone, 'E-mail': l.email, Source: l.source, Statut: l.status, Commercial: emp(l.ownerId), 'Valeur estimée (DH)': Number(l.value || 0), 'Score IA': leadScore(l), 'Créé le': l.createdAt }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Prospects')
    XLSX.writeFile(wb, `prospects-${TODAY}.xlsx`)
  }

  return (
    <>
      <div className="grid g4">
        <Kpi label="Prospects ouverts" value={int(k.open)} icon="target" color="violet" />
        <Kpi label="Valeur estimée (ouverts)" value={moneyK(k.value)} icon="money" color="teal" />
        <Kpi label="Taux de conversion" value={pct(k.rate, 0)} icon="check" color="green" foot="Convertis / (convertis + perdus)" />
        <Kpi label="Nouveaux ce mois" value={int(k.month)} icon="plus" color="blue" />
      </div>
      <DataTable rows={db.leads} exportName="prospects" onRowClick={(l) => setEdit({ ...l })}
        searchKeys={['company', 'contact', 'city', 'source']}
        filters={[
          { key: 'status', label: 'Statut', options: STATUSES },
          { key: 'source', label: 'Source', options: SOURCES },
          { key: 'ownerId', label: 'Commercial', options: [...new Set(db.leads.map((l) => emp(l.ownerId)))], get: (l) => emp(l.ownerId) },
          { key: 'city', label: 'Ville', options: [...new Set(db.leads.map((l) => l.city).filter(Boolean))].sort() },
        ]}
        actions={<>
          <button className="btn sm" onClick={exportXlsx}><Icon name="download" size={14} />Excel</button>
          <button className="btn primary sm" onClick={() => setEdit({ status: 'Nouveau', source: 'Site web', createdAt: TODAY, value: 0, ownerId: sales[0]?.id })}><Icon name="plus" size={14} />Nouveau prospect</button>
        </>}
        columns={[
          { key: 'company', label: 'Entreprise', strong: true },
          { key: 'contact', label: 'Contact' },
          { key: 'city', label: 'Ville' },
          { key: 'source', label: 'Source' },
          { key: 'status', label: 'Statut', render: (l) => <Badge color={STATUS_COLOR[l.status]}>{l.status}</Badge> },
          { key: 'owner', label: 'Commercial', sort: (l) => emp(l.ownerId), render: (l) => emp(l.ownerId), csv: (l) => emp(l.ownerId) },
          { key: 'value', label: 'Valeur estimée', right: true, render: (l) => money(l.value) },
          { key: 'score', label: 'Score IA', right: true, sort: leadScore, render: (l) => { const s = leadScore(l); return <b className="num" style={{ color: scoreColor(s) }}>{s}</b> } },
          { key: 'createdAt', label: 'Créé le', render: (l) => fdate(l.createdAt) },
          {
            key: '_a', label: '', noSort: true, noExport: true, right: true, render: (l) => (
              <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                {l.status !== 'Converti' && l.status !== 'Perdu' && <button className="btn sm" title="Convertir en client" onClick={() => convert(l)}><Icon name="building" size={13} />Client</button>}
                {l.status !== 'Perdu' && <button className="btn sm" title="Créer une opportunité" onClick={() => toOpportunity(l)}><Icon name="target" size={13} />Opportunité</button>}
                <button className="btn sm ghost danger" title="Supprimer" onClick={() => setDel(l)}><Icon name="trash" size={13} /></button>
              </span>
            ),
          },
        ]} />
      {edit && (
        <Modal title={edit.id ? `Prospect — ${edit.company}` : 'Nouveau prospect'} onClose={() => setEdit(null)}
          footer={<>
            {edit.id && <span className="muted small">Score IA : <b style={{ color: scoreColor(leadScore(edit)) }}>{leadScore(edit)}/100</b></span>}
            <span className="spacer" />
            <button className="btn" onClick={() => setEdit(null)}>Annuler</button>
            <button className="btn primary" onClick={save}><Icon name="check" size={15} />Enregistrer</button>
          </>}>
          <FormFields fields={fields} value={edit} onChange={setEdit} />
        </Modal>
      )}
      {del && <Confirm text={`Supprimer le prospect « ${del.company} » ?`} onClose={() => setDel(null)} onYes={() => { remove('leads', del.id); toast('Prospect supprimé') }} />}
    </>
  )
}
