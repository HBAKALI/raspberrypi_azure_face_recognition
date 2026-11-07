import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { go, useRoute } from '../lib/nav.js'
import { Badge, BarChart, Card, Confirm, DataTable, Field, Icon, Kpi, Modal, PageHead, Tabs, COLORS } from '../components/ui.jsx'
import { TODAY, addDays, daysBetween, fdate, money, moneyK, previewNumber, uid, MONTHS } from '../lib/domain.js'

const mrrOf = (plan) => (plan ? Number(plan.price) / Math.max(1, Number(plan.months) || 1) : 0)

export default function Subscriptions() {
  const { db, add, update, remove, mutate, toast, log, nextNumber } = useStore()
  const { tab } = useRoute()
  const t = ['overview', 'subs', 'plans'].includes(tab) ? tab : 'overview'
  const [edit, setEdit] = useState(null)
  const [plan, setPlan] = useState(null)
  const [del, setDel] = useState(null)
  const planOf = (id) => db.plans.find((p) => p.id === id)
  const client = (id) => db.clients.find((c) => c.id === id)
  const active = db.subscriptions.filter((s) => s.status === 'Actif')
  const mrr = active.reduce((s, x) => s + mrrOf(planOf(x.planId)), 0)
  const renewSoon = active.filter((s) => s.end && daysBetween(TODAY, s.end) >= 0 && daysBetween(TODAY, s.end) <= 30)
  const expiring = active.filter((s) => s.end && daysBetween(TODAY, s.end) <= 60).sort((a, b) => a.end.localeCompare(b.end))

  const bill = (s) => {
    const p = planOf(s.planId)
    if (!p) return toast('Forfait introuvable')
    const number = previewNumber(db, 'facture')
    const period = `${MONTHS[Number(TODAY.slice(5, 7)) - 1]} ${TODAY.slice(0, 4)}`
    const doc = { id: uid(), type: 'facture', status: 'Brouillon', partyId: s.clientId, date: TODAY, dueDate: addDays(TODAY, 30), notes: `Abonnement ${p.name}`, lines: [{ productId: '', label: `${p.name} — ${p.months > 1 ? `${p.months} mois à compter de ${period}` : period}`, qty: 1, price: Number(p.price), discount: 0, tva: 20 }] }
    mutate((d) => {
      d.documents.unshift({ ...doc, number: nextNumber('facture', d) })
      const x = d.subscriptions.find((y) => y.id === s.id)
      if (x) x.lastBilled = TODAY
    })
    log(`Abonnement facturé : ${client(s.clientId)?.name} (${number})`, 'repeat')
    toast(`Facture ${number} créée en brouillon`)
  }
  const saveSub = () => {
    if (!edit.clientId || !edit.planId || !edit.start) return toast('Client, forfait et date de début obligatoires')
    if (edit.id) update('subscriptions', edit.id, edit)
    else { add('subscriptions', edit); log(`Abonnement créé : ${client(edit.clientId)?.name}`, 'repeat') }
    toast('Abonnement enregistré'); setEdit(null)
  }
  const savePlan = () => {
    if (!plan.name || !plan.price) return toast('Nom et prix obligatoires')
    const data = { ...plan, price: Number(plan.price), months: Number(plan.months) || 1, items: String(plan.itemsText || '').split('\n').map((x) => x.trim()).filter(Boolean) }
    delete data.itemsText
    if (data.id) update('plans', data.id, data)
    else add('plans', data)
    toast('Forfait enregistré'); setPlan(null)
  }
  const newSub = () => { const p = db.plans[0]; setEdit({ clientId: db.clients[0]?.id || '', planId: p?.id || '', start: TODAY, end: addDays(TODAY, 30 * (p?.months || 12)), status: 'Actif', autoRenew: true, lastBilled: '' }) }

  const rows = useMemo(() => [...db.subscriptions].sort((a, b) => (a.end || '').localeCompare(b.end || '')), [db.subscriptions])

  return (
    <div className="stack">
      <PageHead title="Abonnements" sub="Location de matériel médical et forfaits récurrents (consommables, maintenance)." crumbs="Commercial">
        <button className="btn" onClick={() => setPlan({ name: '', price: '', months: 1, itemsText: '' })}><Icon name="layers" size={15} />Nouveau forfait</button>
        <button className="btn primary" onClick={newSub}><Icon name="plus" size={15} />Nouvel abonnement</button>
      </PageHead>
      <div className="grid g4">
        <Kpi label="Abonnements actifs" value={active.length} icon="repeat" color="teal" />
        <Kpi label="Revenu récurrent mensuel" value={moneyK(mrr)} icon="money" color="green" foot={`${moneyK(mrr * 12)} / an`} />
        <Kpi label="Renouvellements sous 30 j" value={renewSoon.length} icon="clock" color="amber" />
        <Kpi label="Annulés" value={db.subscriptions.filter((s) => s.status === 'Annulé').length} icon="x" color="gray" />
      </div>
      <Tabs value={t} onChange={(x) => go('subscriptions', x)} tabs={[['overview', 'Aperçu'], ['subs', 'Abonnements'], ['plans', 'Forfaits']]} />

      {t === 'overview' && (
        <div className="grid g2">
          <Card title="Revenu récurrent mensuel par forfait" icon="chart">
            <BarChart labels={db.plans.map((p) => p.name.split(' ').slice(0, 2).join(' '))} format={(v) => moneyK(v)} series={[{ name: 'MRR', color: COLORS.teal, data: db.plans.map((p) => active.filter((s) => s.planId === p.id).length * mrrOf(p)) }]} />
          </Card>
          <Card title="Échéances à venir (60 jours)" icon="calendar">
            {!expiring.length && <div className="muted">Aucune échéance proche.</div>}
            {expiring.map((s) => {
              const dl = daysBetween(TODAY, s.end)
              return (
                <div key={s.id} className="row small" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}><b>{client(s.clientId)?.name}</b><div className="muted">{planOf(s.planId)?.name} · fin {fdate(s.end)}{s.autoRenew ? ' · renouvellement auto' : ''}</div></div>
                  <Badge color={dl < 0 ? 'red' : dl <= 30 ? 'amber' : 'blue'}>{dl < 0 ? 'Échu' : `J-${dl}`}</Badge>
                </div>
              )
            })}
          </Card>
        </div>
      )}

      {t === 'subs' && (
        <DataTable rows={rows} exportName="abonnements" onRowClick={(r) => setEdit({ ...r })} searchKeys={[(r) => client(r.clientId)?.name, (r) => planOf(r.planId)?.name]}
          filters={[{ key: 'status', label: 'Statut', options: ['Actif', 'Suspendu', 'Annulé'] }, { key: 'planId', label: 'Forfait', options: db.plans.map((p) => p.name), get: (r) => planOf(r.planId)?.name }]}
          columns={[
            { key: 'client', label: 'Client', strong: true, sort: (r) => client(r.clientId)?.name, render: (r) => client(r.clientId)?.name, csv: (r) => client(r.clientId)?.name },
            { key: 'plan', label: 'Forfait', sort: (r) => planOf(r.planId)?.name, render: (r) => <>{planOf(r.planId)?.name}<div className="muted small">{money(planOf(r.planId)?.price)} / {planOf(r.planId)?.months} mois</div></>, csv: (r) => planOf(r.planId)?.name },
            { key: 'start', label: 'Début', render: (r) => fdate(r.start) },
            { key: 'end', label: 'Fin', render: (r) => <span style={{ color: r.end < TODAY && r.status === 'Actif' ? 'var(--red)' : undefined }}>{fdate(r.end)}</span>, csv: (r) => r.end },
            { key: 'status', label: 'Statut', render: (r) => <Badge color={r.status === 'Actif' ? 'green' : r.status === 'Annulé' ? 'gray' : 'amber'}>{r.status}</Badge>, csv: (r) => r.status },
            { key: 'autoRenew', label: 'Renouv. auto', render: (r) => (r.autoRenew ? 'Oui' : 'Non') },
            { key: 'lastBilled', label: 'Dernière facturation', render: (r) => fdate(r.lastBilled) },
            { key: 'act', label: '', noSort: true, noExport: true, render: (r) => r.status === 'Actif' && <button className="btn sm" onClick={(e) => { e.stopPropagation(); bill(r) }}><Icon name="file" size={13} />Facturer la période</button> },
          ]} />
      )}

      {t === 'plans' && (
        <div className="grid g3">
          {db.plans.map((p) => {
            const n = active.filter((s) => s.planId === p.id).length
            return (
              <div key={p.id} className="card module-card">
                <div className="row"><b style={{ flex: 1, fontSize: 15 }}>{p.name}</b><Badge color="teal">{n} actif(s)</Badge></div>
                <div><span style={{ fontSize: 24, fontWeight: 800 }}>{money(p.price)}</span><span className="muted"> / {p.months} mois</span></div>
                <div className="stack" style={{ gap: 6 }}>{(p.items || []).map((it) => <div key={it} className="row small" style={{ gap: 6 }}><Icon name="check" size={14} style={{ color: 'var(--green)' }} />{it}</div>)}</div>
                <div className="row" style={{ marginTop: 'auto' }}>
                  <button className="btn sm" onClick={() => setPlan({ ...p, itemsText: (p.items || []).join('\n') })}><Icon name="edit" size={13} />Modifier</button>
                  <button className="btn sm ghost danger" onClick={() => setDel(p)} disabled={n > 0} title={n ? 'Forfait utilisé par des abonnements actifs' : 'Supprimer'}><Icon name="trash" size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {edit && (
        <Modal title={edit.id ? 'Modifier l\'abonnement' : 'Nouvel abonnement'} onClose={() => setEdit(null)}
          footer={<>{edit.id && <button className="btn danger" onClick={() => { remove('subscriptions', edit.id); toast('Abonnement supprimé'); setEdit(null) }}><Icon name="trash" size={15} /></button>}<span className="spacer" /><button className="btn" onClick={() => setEdit(null)}>Annuler</button><button className="btn primary" onClick={saveSub}><Icon name="check" size={15} />Enregistrer</button></>}>
          <div className="form">
            <Field label="Client" full><select value={edit.clientId} onChange={(e) => setEdit({ ...edit, clientId: e.target.value })}>{db.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Forfait" full><select value={edit.planId} onChange={(e) => { const p = planOf(e.target.value); setEdit({ ...edit, planId: e.target.value, end: edit.id ? edit.end : addDays(edit.start, 30 * (p?.months || 1)) }) }}>{db.plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.price)} / {p.months} mois</option>)}</select></Field>
            <Field label="Début"><input type="date" value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })} /></Field>
            <Field label="Fin"><input type="date" value={edit.end} onChange={(e) => setEdit({ ...edit, end: e.target.value })} /></Field>
            <Field label="Statut"><select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{['Actif', 'Suspendu', 'Annulé'].map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Renouvellement automatique"><label className="switch"><input type="checkbox" checked={!!edit.autoRenew} onChange={(e) => setEdit({ ...edit, autoRenew: e.target.checked })} /><span /></label></Field>
          </div>
        </Modal>
      )}
      {plan && (
        <Modal title={plan.id ? 'Modifier le forfait' : 'Nouveau forfait'} onClose={() => setPlan(null)} footer={<><button className="btn" onClick={() => setPlan(null)}>Annuler</button><button className="btn primary" onClick={savePlan}><Icon name="check" size={15} />Enregistrer</button></>}>
          <div className="form">
            <Field label="Nom" full><input value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })} /></Field>
            <Field label="Prix HT (DH)"><input type="number" value={plan.price} onChange={(e) => setPlan({ ...plan, price: e.target.value })} /></Field>
            <Field label="Durée (mois)"><input type="number" min="1" value={plan.months} onChange={(e) => setPlan({ ...plan, months: e.target.value })} /></Field>
            <Field label="Prestations incluses (une par ligne)" full><textarea value={plan.itemsText} onChange={(e) => setPlan({ ...plan, itemsText: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {del && <Confirm text={`Supprimer le forfait « ${del.name} » ?`} onClose={() => setDel(null)} onYes={() => { remove('plans', del.id); toast('Forfait supprimé') }} />}
    </div>
  )
}
