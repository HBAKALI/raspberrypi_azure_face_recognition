import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { useRoute } from '../lib/nav.js'
import { PageHead, Kpi, Tabs, Card, DataTable, LineChart, BarChart, Modal, Field, Icon, Badge, Progress, COLORS, SERIES } from '../components/ui.jsx'
import CrudPage from '../components/CrudPage.jsx'
import { TODAY, addDays, daysBetween, docTotals, docPaid, fdate, money, moneyK, lastMonths, monthLabel, monthKey, payStatus } from '../lib/domain.js'

const OPENING = 1250000
const EXP_CATS = ['Loyer & charges', 'Salaires', 'Transport & logistique', 'Transit & dédouanement', 'Marketing & congrès', 'Télécom & IT', 'Carburant', 'Honoraires', 'Formation']
const METHODS = ['Virement', 'Chèque', 'Effet', 'Espèces', 'Virement international']

export default function Finance() {
  const { db, add, toast, log } = useStore()
  const route = useRoute()
  const [tab, setTab] = useState(['overview', 'in', 'out', 'expenses', 'tva', 'forecast'].includes(route.tab) ? route.tab : 'overview')
  const [pay, setPay] = useState(null)

  const months = lastMonths(12)
  const party = (p) => (p.kind === 'in' ? db.clients : db.suppliers).find((x) => x.id === p.partyId)
  const docOf = (id) => db.documents.find((d) => d.id === id)
  const unpaid = (type) => db.documents.filter((d) => d.type === type && d.status === 'Validée').map((d) => ({ d, rest: docTotals(d).ttc - docPaid(db, d) })).filter((x) => x.rest > 0.01)

  const k = useMemo(() => {
    const inSum = db.payments.filter((p) => p.kind === 'in').reduce((s, p) => s + Number(p.amount), 0)
    const outSum = db.payments.filter((p) => p.kind === 'out').reduce((s, p) => s + Number(p.amount), 0)
    const exp = db.expenses.filter((e) => e.paid).reduce((s, e) => s + Number(e.amount) * (1 + (e.tva || 0) / 100), 0)
    const recv = unpaid('facture').reduce((s, x) => s + x.rest, 0)
    const debt = unpaid('facture_f').reduce((s, x) => s + x.rest, 0)
    return { cash: OPENING + inSum - outSum - exp, recv, debt }
  }, [db]) // eslint-disable-line react-hooks/exhaustive-deps

  const tva = useMemo(() => months.map((m) => {
    let coll = 0, ded = 0
    for (const d of db.documents) {
      if (monthKey(d.date) !== m) continue
      if (['facture', 'avoir'].includes(d.type) && ['Validée', 'Validé'].includes(d.status)) coll += docTotals(d).tva
      if (d.type === 'facture_f' && d.status === 'Validée') ded += docTotals(d).tva
    }
    for (const e of db.expenses) if (monthKey(e.date) === m) ded += Number(e.amount) * (e.tva || 0) / 100
    return { m, coll, ded, due: coll - ded }
  }), [db, months])

  const flows = months.map((m) => ({
    in: db.payments.filter((p) => p.kind === 'in' && monthKey(p.date) === m).reduce((s, p) => s + Number(p.amount), 0),
    out: db.payments.filter((p) => p.kind === 'out' && monthKey(p.date) === m).reduce((s, p) => s + Number(p.amount), 0) + db.expenses.filter((e) => e.paid && monthKey(e.date) === m).reduce((s, e) => s + Number(e.amount), 0),
  }))
  const expByCat = EXP_CATS.map((c) => db.expenses.filter((e) => e.category === c).reduce((s, e) => s + Number(e.amount), 0))

  const aging = useMemo(() => {
    const b = { 'Non échu': 0, '0–30 j': 0, '31–60 j': 0, '61–90 j': 0, '> 90 j': 0 }
    for (const { d, rest } of unpaid('facture')) {
      const late = daysBetween(d.dueDate, TODAY)
      const key = late <= 0 ? 'Non échu' : late <= 30 ? '0–30 j' : late <= 60 ? '31–60 j' : late <= 90 ? '61–90 j' : '> 90 j'
      b[key] += rest
    }
    return b
  }, [db]) // eslint-disable-line react-hooks/exhaustive-deps
  const agingTotal = Object.values(aging).reduce((s, v) => s + v, 0) || 1

  const forecast = useMemo(() => {
    const avgExp = db.expenses.filter((e) => daysBetween(e.date, TODAY) <= 180).reduce((s, e) => s + Number(e.amount), 0) / 6
    const weeks = Array.from({ length: 13 }, (_, i) => addDays(TODAY, i * 7))
    let bal = k.cash
    const ins = [], outs = [], bals = []
    weeks.forEach((w, i) => {
      const end = addDays(w, 7)
      const inp = unpaid('facture').filter((x) => (i === 0 ? x.d.dueDate < end : x.d.dueDate >= w && x.d.dueDate < end)).reduce((s, x) => s + x.rest * (i === 0 ? 0.5 : 0.85), 0)
      const outp = unpaid('facture_f').filter((x) => (i === 0 ? x.d.dueDate < end : x.d.dueDate >= w && x.d.dueDate < end)).reduce((s, x) => s + x.rest, 0) + avgExp / 4.33
      bal += inp - outp
      ins.push(inp); outs.push(outp); bals.push(bal)
    })
    return { labels: weeks.map((w) => fdate(w).slice(0, 6)), ins, outs, bals, avgExp }
  }, [db, k.cash]) // eslint-disable-line react-hooks/exhaustive-deps

  const savePay = () => {
    const d = docOf(pay.docId)
    if (!d || !(pay.amount > 0)) return toast('Sélectionnez une facture et un montant')
    add('payments', { docId: d.id, partyId: d.partyId, kind: pay.kind, date: pay.date, amount: Number(pay.amount), method: pay.method })
    log(`${pay.kind === 'in' ? 'Encaissement' : 'Règlement'} ${money(pay.amount)} — ${d.number}`, 'money')
    toast('Paiement enregistré'); setPay(null)
  }
  const openPay = (kind) => setPay({ kind, docId: '', amount: '', date: TODAY, method: kind === 'in' ? 'Virement' : 'Virement international' })
  const payList = pay ? unpaid(pay.kind === 'in' ? 'facture' : 'facture_f') : []

  const payTable = (kind) => (
    <DataTable rows={db.payments.filter((p) => p.kind === kind).sort((a, b) => b.date.localeCompare(a.date))} exportName={kind === 'in' ? 'encaissements' : 'decaissements'}
      searchKeys={[(r) => party(r)?.name, (r) => docOf(r.docId)?.number, 'method']}
      filters={[{ key: 'method', label: 'Mode', options: METHODS }]}
      actions={<button className="btn primary sm" onClick={() => openPay(kind)}><Icon name="plus" size={14} />Enregistrer un paiement</button>}
      columns={[
        { key: 'date', label: 'Date', render: (r) => fdate(r.date) },
        { key: 'partyId', label: kind === 'in' ? 'Client' : 'Fournisseur', render: (r) => party(r)?.name || '—', sort: (r) => party(r)?.name || '', strong: true },
        { key: 'docId', label: 'Facture', render: (r) => docOf(r.docId)?.number || '—', sort: (r) => docOf(r.docId)?.number || '' },
        { key: 'method', label: 'Mode' },
        { key: 'amount', label: 'Montant', right: true, render: (r) => <b>{money(r.amount)}</b> },
      ]} />
  )

  const cur = tva.at(-1)
  return (
    <div className="stack">
      <PageHead title="Finance & trésorerie" sub="Encaissements, décaissements, dépenses, TVA et trésorerie prévisionnelle." crumbs="Finance & RH">
        <button className="btn primary" onClick={() => openPay('in')}><Icon name="money" size={15} />Encaisser</button>
      </PageHead>
      <div className="grid g4">
        <Kpi label="Trésorerie disponible" value={moneyK(k.cash)} icon="wallet" color="green" foot={`Solde d'ouverture ${moneyK(OPENING)}`} spark={forecast.bals} />
        <Kpi label="Créances clients" value={moneyK(k.recv)} icon="trend" color="teal" foot={`dont échu ${moneyK(agingTotal - aging['Non échu'])}`} />
        <Kpi label="Dettes fournisseurs" value={moneyK(k.debt)} icon="truck" color="amber" foot={`${unpaid('facture_f').length} facture(s) à régler`} />
        <Kpi label={`TVA due — ${monthLabel(cur.m)}`} value={moneyK(cur.due)} icon="file" color="violet" foot={`Collectée ${moneyK(cur.coll)} · déductible ${moneyK(cur.ded)}`} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['overview', 'Vue d\'ensemble'], ['in', 'Encaissements'], ['out', 'Décaissements'], ['expenses', 'Dépenses'], ['tva', 'TVA'], ['forecast', 'Trésorerie prévisionnelle']]} />

      {tab === 'overview' && (
        <div className="grid g2">
          <Card title="Flux de trésorerie — 12 mois" icon="activity" className="span2">
            <LineChart labels={months.map(monthLabel)} series={[{ name: 'Encaissements', data: flows.map((f) => f.in), color: COLORS.teal }, { name: 'Décaissements', data: flows.map((f) => f.out), color: COLORS.red }]} />
          </Card>
          <Card title="Dépenses par catégorie" icon="chart">
            <BarChart labels={EXP_CATS.map((c) => c.split(' ')[0])} series={[{ name: 'Dépenses', data: expByCat, color: COLORS.navy }]} />
          </Card>
          <Card title="Balance âgée clients" icon="clock">
            <div className="stack" style={{ gap: 12 }}>
              {Object.entries(aging).map(([k2, v], i) => (
                <div key={k2}>
                  <div className="row small"><span style={{ fontWeight: 600 }}>{k2}</span><span className="spacer" /><b className="num">{money(v)}</b></div>
                  <Progress value={v / agingTotal} color={[COLORS.green, COLORS.teal, COLORS.amber, '#e07a3d', COLORS.red][i]} />
                </div>
              ))}
              <div className="row small muted"><span>Total créances TTC</span><span className="spacer" /><b className="num">{money(agingTotal)}</b></div>
            </div>
          </Card>
        </div>
      )}
      {tab === 'in' && payTable('in')}
      {tab === 'out' && payTable('out')}
      {tab === 'expenses' && (
        <CrudPage col="expenses" entity="Dépense" defaults={{ date: TODAY, tva: 20, paid: true }}
          searchKeys={['label', 'category']} filters={[{ key: 'category', label: 'Catégorie', options: EXP_CATS }]}
          fields={[
            { key: 'date', label: 'Date', type: 'date' }, { key: 'category', label: 'Catégorie', type: 'select', options: EXP_CATS },
            { key: 'label', label: 'Libellé', full: true }, { key: 'amount', label: 'Montant HT (DH)', type: 'number' },
            { key: 'tva', label: 'TVA (%)', type: 'number' }, { key: 'paid', label: 'Payée', type: 'checkbox' },
          ]}
          columns={[
            { key: 'date', label: 'Date', render: (r) => fdate(r.date) }, { key: 'category', label: 'Catégorie' }, { key: 'label', label: 'Libellé', strong: true },
            { key: 'amount', label: 'Montant HT', right: true, render: (r) => money(r.amount) },
            { key: 'tva', label: 'TVA', right: true, render: (r) => money(r.amount * (r.tva || 0) / 100), sort: (r) => r.amount * (r.tva || 0) },
            { key: 'paid', label: 'Statut', render: (r) => <Badge color={r.paid ? 'green' : 'amber'}>{r.paid ? 'Payée' : 'À payer'}</Badge> },
          ]} />
      )}
      {tab === 'tva' && (
        <Card title="Déclarations de TVA (régime mensuel)" icon="file" pad={false}>
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Période</th><th className="right">TVA collectée</th><th className="right">TVA déductible</th><th className="right">TVA à payer / crédit</th></tr></thead>
            <tbody>{[...tva].reverse().map((r) => (
              <tr key={r.m}><td className="strong">{monthLabel(r.m)}</td><td className="right num">{money(r.coll)}</td><td className="right num">{money(r.ded)}</td>
                <td className="right num" style={{ fontWeight: 700, color: r.due < 0 ? 'var(--green)' : undefined }}>{r.due < 0 ? `Crédit ${money(-r.due)}` : money(r.due)}</td></tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}
      {tab === 'forecast' && (
        <div className="grid g2">
          <Card title="Solde de trésorerie projeté — 13 semaines" icon="trend" className="span2">
            <LineChart labels={forecast.labels} series={[{ name: 'Solde projeté', data: forecast.bals, color: COLORS.teal }, { name: 'Entrées attendues', data: forecast.ins, color: COLORS.green, dashed: true }, { name: 'Sorties attendues', data: forecast.outs, color: COLORS.red, dashed: true }]} />
            <p className="muted small" style={{ marginBottom: 0 }}>Hypothèses : encaissement de 85 % des factures clients à échéance (50 % pour l'échu), règlement intégral des fournisseurs, dépenses courantes ≈ {money(forecast.avgExp)} / mois.</p>
          </Card>
          <Card title="Entrées attendues (90 j)" icon="up"><b className="kpi-val num" style={{ color: SERIES[2] }}>{money(forecast.ins.reduce((s, v) => s + v, 0))}</b></Card>
          <Card title="Sorties attendues (90 j)" icon="down"><b className="kpi-val num" style={{ color: COLORS.red }}>{money(forecast.outs.reduce((s, v) => s + v, 0))}</b></Card>
        </div>
      )}

      {pay && (
        <Modal title={pay.kind === 'in' ? 'Enregistrer un encaissement' : 'Enregistrer un règlement fournisseur'} onClose={() => setPay(null)}
          footer={<><button className="btn" onClick={() => setPay(null)}>Annuler</button><button className="btn primary" onClick={savePay}><Icon name="check" size={15} />Enregistrer</button></>}>
          <div className="form">
            <Field label="Facture" full>
              <select value={pay.docId} onChange={(e) => { const x = payList.find((y) => y.d.id === e.target.value); setPay({ ...pay, docId: e.target.value, amount: x ? Math.round(x.rest * 100) / 100 : '' }) }}>
                <option value="">— Sélectionner une facture non soldée —</option>
                {payList.map(({ d, rest }) => <option key={d.id} value={d.id}>{d.number} · {(pay.kind === 'in' ? db.clients : db.suppliers).find((p) => p.id === d.partyId)?.name} · reste {money(rest)}{payStatus(db, d) === 'En retard' ? ' (en retard)' : ''}</option>)}
              </select>
            </Field>
            <Field label="Montant (DH)"><input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
            <Field label="Date"><input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
            <Field label="Mode de paiement"><select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
          </div>
        </Modal>
      )}
    </div>
  )
}
