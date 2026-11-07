// Module « Comptable » : espace de travail du comptable (TVA, situation financière, revue de clôture, journaux).
import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { useStore } from '../lib/store.jsx'
import { go, useRoute } from '../lib/nav.js'
import { Badge, Card, DataTable, Icon, Kpi, Modal, PageHead, Seg, Tabs } from '../components/ui.jsx'
import { TODAY, docPaid, docTotals, fdate, lastMonths, money, moneyK, monthLabel } from '../lib/domain.js'

const TABS = [['summary', 'Synthèse'], ['review', 'Revue de clôture'], ['sales', 'Ventes'], ['purchases', 'Achats'], ['ledger', 'Grand livre simplifié']]

// Mois couverts par la période choisie
function periodMonths(anchor, mode) {
  if (mode === 'month') return [anchor]
  const y = Number(anchor.slice(0, 4)), m = Number(anchor.slice(5, 7))
  if (mode === 'quarter') {
    const q0 = Math.floor((m - 1) / 3) * 3 + 1
    return [0, 1, 2].map((i) => `${y}-${String(q0 + i).padStart(2, '0')}`)
  }
  return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`)
}

function exportXlsx(sheets, name) {
  const wb = XLSX.utils.book_new()
  for (const [title, rows] of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), title.slice(0, 31))
  XLSX.writeFile(wb, `${name}.xlsx`)
}

export default function Accounting() {
  const { db } = useStore()
  const { tab } = useRoute()
  const t = TABS.some(([id]) => id === tab) ? tab : 'summary'
  const months = lastMonths(12)
  const [anchor, setAnchor] = useState(months.at(-2))
  const [mode, setMode] = useState('month')
  const pm = periodMonths(anchor, mode)
  const inPeriod = (d) => pm.includes((d || '').slice(0, 7))
  const label = mode === 'month' ? monthLabel(anchor) : mode === 'quarter' ? `T${Math.floor((Number(anchor.slice(5, 7)) - 1) / 3) + 1} ${anchor.slice(0, 4)}` : `Année ${anchor.slice(0, 4)}`

  const data = useMemo(() => {
    const sales = db.documents.filter((d) => ['facture', 'avoir'].includes(d.type) && ['Validée', 'Validé'].includes(d.status) && inPeriod(d.date))
    const purch = db.documents.filter((d) => d.type === 'facture_f' && d.status === 'Validée' && inPeriod(d.date))
    const exps = db.expenses.filter((e) => inPeriod(e.date))
    let ht = 0, tvaC = 0, cogs = 0
    for (const d of sales) {
      const t = docTotals(d); ht += t.ht; tvaC += t.tva
      const sign = d.type === 'avoir' ? -1 : 1
      for (const l of d.lines) cogs += sign * l.qty * (db.products.find((p) => p.id === l.productId)?.cost || 0)
    }
    let achHt = 0, tvaA = 0
    for (const d of purch) { const t = docTotals(d); achHt += t.ht; tvaA += t.tva }
    const chHt = exps.reduce((s, e) => s + Number(e.amount), 0)
    const tvaCh = exps.reduce((s, e) => s + Number(e.amount) * (Number(e.tva) || 0) / 100, 0)
    const allSales = db.documents.filter((d) => d.type === 'facture' && d.status === 'Validée')
    const allPurch = db.documents.filter((d) => d.type === 'facture_f' && d.status === 'Validée')
    const receivables = allSales.reduce((s, d) => s + Math.max(0, docTotals(d).ttc - docPaid(db, d)), 0)
    const payables = allPurch.reduce((s, d) => s + Math.max(0, docTotals(d).ttc - docPaid(db, d)), 0)
    return { sales, purch, exps, ht, tvaC, cogs, achHt, tvaA, chHt, tvaCh, tvaDue: tvaC - tvaA - tvaCh, receivables, payables }
  }, [db, anchor, mode]) // eslint-disable-line

  return (
    <div className="stack">
      <PageHead title="Comptable" sub="Espace de travail du comptable : TVA, situation financière, revue de clôture et journaux." crumbs="Finance & RH › Comptable">
        <Seg options={[['month', 'Mois'], ['quarter', 'Trimestre'], ['year', 'Année']]} value={mode} onChange={setMode} />
        <select className="input" style={{ width: 'auto' }} value={anchor} onChange={(e) => setAnchor(e.target.value)}>
          {[...months].reverse().map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </PageHead>
      <Tabs tabs={TABS} value={t} onChange={(x) => go('accounting', x)} />
      {t === 'summary' && <Summary data={data} label={label} />}
      {t === 'review' && <Review data={data} />}
      {t === 'sales' && <Journal kind="sale" docs={data.sales} label={label} />}
      {t === 'purchases' && <Journal kind="purchase" docs={data.purch} label={label} />}
      {t === 'ledger' && <Ledger data={data} label={label} />}
    </div>
  )
}

function Summary({ data, label }) {
  const { db } = useStore()
  const [pdf, setPdf] = useState(false)
  const co = db.settings.company
  const marge = data.ht - data.cogs
  const lines = [
    ['Chiffre d\'affaires taxable à 20 % (HT)', data.ht],
    ['TVA collectée', data.tvaC],
    ['TVA récupérable sur achats (immobilisations exclues)', data.tvaA],
    ['TVA récupérable sur charges', data.tvaCh],
    [data.tvaDue >= 0 ? 'TVA due' : 'Crédit de TVA', Math.abs(data.tvaDue)],
  ]
  const exportX = () => exportXlsx([
    ['Déclaration TVA', lines.map(([l, v]) => ({ Rubrique: l, Montant: Math.round(v * 100) / 100 }))],
    ['Situation', [
      { Indicateur: 'CA HT', Montant: data.ht }, { Indicateur: 'Marge brute', Montant: marge }, { Indicateur: 'Achats HT', Montant: data.achHt },
      { Indicateur: 'Charges HT', Montant: data.chHt }, { Indicateur: 'Créances clients TTC', Montant: data.receivables }, { Indicateur: 'Dettes fournisseurs TTC', Montant: data.payables },
    ]],
  ], `declaration-tva-${label.replace(/\s+/g, '-')}`)

  return (
    <>
      <div className="grid g4">
        <Kpi label={`CA HT — ${label}`} value={moneyK(data.ht)} icon="money" color="teal" foot={`${data.sales.length} facture(s)`} />
        <Kpi label="Marge brute" value={moneyK(marge)} icon="chart" color="green" foot={data.ht ? `${((marge / data.ht) * 100).toFixed(1)} % du CA` : '—'} />
        <Kpi label={data.tvaDue >= 0 ? 'TVA à payer' : 'Crédit de TVA'} value={moneyK(Math.abs(data.tvaDue))} icon="calculator" color={data.tvaDue >= 0 ? 'amber' : 'blue'} foot={`collectée ${moneyK(data.tvaC)}`} />
        <Kpi label="TVA déductible" value={moneyK(data.tvaA + data.tvaCh)} icon="file" color="navy" foot={`achats ${moneyK(data.tvaA)} · charges ${moneyK(data.tvaCh)}`} />
        <Kpi label="Créances clients" value={moneyK(data.receivables)} icon="wallet" color="amber" foot="TTC, toutes périodes" />
        <Kpi label="Dettes fournisseurs" value={moneyK(data.payables)} icon="truck" color="red" foot="TTC, toutes périodes" />
        <Kpi label="Achats HT" value={moneyK(data.achHt)} icon="cart" color="blue" foot={`${data.purch.length} facture(s) fournisseur`} />
        <Kpi label="Charges HT" value={moneyK(data.chHt)} icon="layers" color="violet" foot={`${data.exps.length} dépense(s)`} />
      </div>
      <Card title={`Déclaration de TVA — ${label}`} icon="calculator" action={<><Badge color="blue">Régime : débit</Badge><button className="btn sm" onClick={exportX}><Icon name="download" size={13} />Exporter Excel</button><button className="btn sm" onClick={() => setPdf(true)}><Icon name="printer" size={13} />Exporter PDF</button></>}>
        <table className="t">
          <tbody>
            {lines.map(([l, v], i) => (
              <tr key={l} style={i === lines.length - 1 ? { background: 'var(--soft)' } : undefined}>
                <td className={i === lines.length - 1 ? 'strong' : ''}>{l}</td>
                <td className="right num strong">{money(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="muted small" style={{ marginTop: 10 }}>Calcul indicatif à partir des factures validées et des dépenses saisies. À valider par l'expert-comptable avant télédéclaration (SIMPL-TVA).</div>
      </Card>
      {pdf && (
        <Modal title="Déclaration de TVA" onClose={() => setPdf(false)} footer={<><button className="btn" onClick={() => setPdf(false)}>Fermer</button><button className="btn primary" onClick={() => window.print()}><Icon name="printer" size={15} />Imprimer / PDF</button></>}>
          <div className="print-area">
            <div className="print-doc">
              <div className="print-band" />
              <h2 style={{ marginTop: 16, color: '#0b2545' }}>Déclaration de TVA — {label}</h2>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{co.name} · ICE {co.ice} · {co.rc} · Régime du débit</div>
              <table>
                <thead><tr><th>Rubrique</th><th style={{ textAlign: 'right' }}>Montant</th></tr></thead>
                <tbody>{lines.map(([l, v]) => <tr key={l}><td>{l}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{money(v)}</td></tr>)}</tbody>
              </table>
              <div style={{ marginTop: 20, fontSize: 11, color: '#64748b' }}>Édité le {fdate(TODAY)} — document de travail, non contractuel.</div>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

function Review({ data }) {
  const { db } = useStore()
  const [open, setOpen] = useState(null)
  const client = (id) => db.clients.find((c) => c.id === id)
  const supplier = (id) => db.suppliers.find((c) => c.id === id)
  const items = useMemo(() => {
    const drafts = db.documents.filter((d) => d.type === 'facture' && d.status === 'Brouillon')
    const noIce = db.documents.filter((d) => d.type === 'facture' && d.status === 'Validée' && !/^\d{15}$/.test(client(d.partyId)?.ice || ''))
    const noRef = db.documents.filter((d) => d.type === 'facture_f' && d.status === 'Validée' && docPaid(db, d) > 0 && db.payments.some((p) => p.docId === d.id && !p.method && !p.ref))
    const overdue = db.documents.filter((d) => d.type === 'facture' && d.status === 'Validée' && d.dueDate < TODAY && docTotals(d).ttc - docPaid(db, d) > 1 && !d.remindedAt)
    const unpaidExp = db.expenses.filter((e) => !e.paid)
    const cashGaps = (db.posSessions || []).filter((s) => s.counted != null && Math.abs(Number(s.counted) - Number(s.closingBalance)) > 0.5)
    const doc = (d, party) => ({ key: d.id, a: d.number, b: party?.name || '—', c: fdate(d.date), d: money(docTotals(d).ttc) })
    return [
      { id: 'drafts', title: 'Factures de vente en brouillon', level: drafts.length ? 'alerte' : 'ok', rows: drafts.map((d) => doc(d, client(d.partyId))), hint: 'À valider ou supprimer avant la clôture.' },
      { id: 'ice', title: 'Factures sans ICE client valide', level: noIce.length ? 'bloquant' : 'ok', rows: noIce.map((d) => doc(d, client(d.partyId))), hint: 'L\'ICE du client (15 chiffres) est obligatoire sur les factures.' },
      { id: 'ref', title: 'Factures fournisseurs payées sans référence de paiement', level: noRef.length ? 'alerte' : 'ok', rows: noRef.map((d) => doc(d, supplier(d.partyId))), hint: 'Renseigner le mode et la référence du règlement.' },
      { id: 'overdue', title: 'Factures échues non relancées', level: overdue.length > 10 ? 'bloquant' : overdue.length ? 'alerte' : 'ok', rows: overdue.map((d) => doc(d, client(d.partyId))), hint: 'Lancer les relances (LIYA IA › Risque clients).' },
      { id: 'exp', title: 'Dépenses non payées', level: unpaidExp.length ? 'alerte' : 'ok', rows: unpaidExp.map((e) => ({ key: e.id, a: e.label, b: e.category, c: fdate(e.date), d: money(e.amount) })), hint: 'Vérifier les échéances et les justificatifs.' },
      { id: 'cash', title: 'Écarts de caisse', level: cashGaps.length ? 'bloquant' : 'ok', rows: cashGaps.map((s) => ({ key: s.id, a: db.registers.find((r) => r.id === s.registerId)?.name || s.registerId, b: `Compté ${money(s.counted)}`, c: fdate(s.openedAt.slice(0, 10)), d: `Écart ${money(Number(s.counted) - Number(s.closingBalance))}` })), hint: 'Justifier chaque écart entre le solde compté et le solde théorique.' },
    ]
  }, [db]) // eslint-disable-line
  const ICON = { ok: ['check', 'green'], alerte: ['alert', 'amber'], bloquant: ['x', 'red'] }
  const score = items.filter((i) => i.level === 'ok').length
  return (
    <>
      <div className="grid g3">
        <Kpi label="Points conformes" value={`${score} / ${items.length}`} icon="check" color="green" />
        <Kpi label="Alertes" value={items.filter((i) => i.level === 'alerte').length} icon="alert" color="amber" />
        <Kpi label="Points bloquants" value={items.filter((i) => i.level === 'bloquant').length} icon="x" color="red" />
      </div>
      <Card title="Revue de clôture" icon="check" pad={false}>
        <div style={{ marginTop: 8 }}>
          {items.map((it) => {
            const [ic, col] = ICON[it.level]
            return (
              <div key={it.id} style={{ borderTop: '1px solid var(--border)', padding: '12px 18px' }}>
                <div className="row">
                  <div className="kpi-ico" style={{ background: `var(--${col === 'amber' ? 'amber' : col === 'red' ? 'red' : 'green'})`, color: '#fff', width: 28, height: 28, borderRadius: 8 }}><Icon name={ic} size={15} /></div>
                  <div style={{ flex: 1 }}><b>{it.title}</b><div className="muted small">{it.hint}</div></div>
                  <Badge color={col}>{it.rows.length}</Badge>
                  <button className="btn sm" disabled={!it.rows.length} onClick={() => setOpen(open === it.id ? null : it.id)}>{open === it.id ? 'Masquer' : 'Voir'}</button>
                </div>
                {open === it.id && (
                  <div className="table-wrap" style={{ marginTop: 10, maxHeight: 280, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <table className="t"><tbody>{it.rows.map((r) => <tr key={r.key}><td className="strong">{r.a}</td><td>{r.b}</td><td>{r.c}</td><td className="right num">{r.d}</td></tr>)}</tbody></table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>
    </>
  )
}

function Journal({ kind, docs, label }) {
  const { db } = useStore()
  const parties = kind === 'sale' ? db.clients : db.suppliers
  const rows = useMemo(() => docs.map((d) => {
    const t = docTotals(d), paid = docPaid(db, d), p = parties.find((x) => x.id === d.partyId)
    const lastPay = db.payments.filter((x) => x.docId === d.id).at(-1)
    return { id: d.id, date: d.date, number: d.number, party: p?.name || '—', ice: p?.ice || '—', ht: t.ht, tva: t.tva, ttc: t.ttc, paid, rest: Math.max(0, t.ttc - paid), method: lastPay?.method || d.paymentMethod || '—' }
  }).sort((a, b) => a.date.localeCompare(b.date)), [docs, db, parties])
  const tot = rows.reduce((s, r) => ({ ht: s.ht + r.ht, tva: s.tva + r.tva, ttc: s.ttc + r.ttc, paid: s.paid + r.paid, rest: s.rest + r.rest }), { ht: 0, tva: 0, ttc: 0, paid: 0, rest: 0 })
  const title = kind === 'sale' ? 'Journal des ventes' : 'Journal des achats'
  const exportX = () => exportXlsx([[title, [
    ...rows.map((r) => ({ Date: r.date, Numéro: r.number, Tiers: r.party, ICE: r.ice, HT: r.ht, TVA: r.tva, TTC: r.ttc, Payé: r.paid, Reste: r.rest, Mode: r.method })),
    { Date: 'TOTAL', HT: tot.ht, TVA: tot.tva, TTC: tot.ttc, Payé: tot.paid, Reste: tot.rest },
  ]]], `${kind === 'sale' ? 'journal-ventes' : 'journal-achats'}-${label.replace(/\s+/g, '-')}`)
  return (
    <>
      <div className="grid g4">
        <Kpi label="Total HT" value={moneyK(tot.ht)} icon="file" color="navy" foot={`${rows.length} facture(s) — ${label}`} />
        <Kpi label="TVA" value={moneyK(tot.tva)} icon="calculator" color="teal" />
        <Kpi label="Total TTC" value={moneyK(tot.ttc)} icon="money" color="green" />
        <Kpi label="Reste à régler" value={moneyK(tot.rest)} icon="wallet" color="amber" />
      </div>
      <DataTable rows={rows} exportName={title} searchKeys={['number', 'party', 'ice']}
        actions={<button className="btn sm" onClick={exportX}><Icon name="download" size={14} />Excel</button>}
        columns={[
          { key: 'date', label: 'Date', render: (r) => fdate(r.date) },
          { key: 'number', label: 'N°', strong: true },
          { key: 'party', label: kind === 'sale' ? 'Client' : 'Fournisseur' },
          { key: 'ice', label: 'ICE', render: (r) => (/^\d{15}$/.test(r.ice) ? r.ice : <Badge color="red">manquant</Badge>), csv: (r) => r.ice },
          { key: 'ht', label: 'HT', right: true, render: (r) => money(r.ht) },
          { key: 'tva', label: 'TVA', right: true, render: (r) => money(r.tva) },
          { key: 'ttc', label: 'TTC', right: true, render: (r) => money(r.ttc) },
          { key: 'paid', label: 'Payé', right: true, render: (r) => money(r.paid) },
          { key: 'rest', label: 'Reste', right: true, render: (r) => <b style={{ color: r.rest > 1 ? 'var(--amber)' : undefined }}>{money(r.rest)}</b> },
          { key: 'method', label: 'Mode' },
        ]} />
      <div className="card" style={{ padding: '12px 18px' }}>
        <div className="row wrap small" style={{ gap: 20 }}>
          <b>Totaux de la période</b><span className="spacer" />
          <span>HT <b className="num">{money(tot.ht)}</b></span><span>TVA <b className="num">{money(tot.tva)}</b></span>
          <span>TTC <b className="num">{money(tot.ttc)}</b></span><span>Payé <b className="num">{money(tot.paid)}</b></span><span>Reste <b className="num">{money(tot.rest)}</b></span>
        </div>
      </div>
    </>
  )
}

// Écritures dérivées : ventes 3421/4455/7111, achats 6111/34552/4411, charges 61xx/34552/4411 (PCGE marocain)
function Ledger({ data, label }) {
  const { db } = useStore()
  const rows = useMemo(() => {
    const out = []
    let n = 0
    const push = (date, piece, account, lib, debit, credit) => out.push({ id: `l${n++}`, date, piece, account, lib, debit, credit })
    for (const d of data.sales) {
      const t = docTotals(d), c = db.clients.find((x) => x.id === d.partyId)?.name || ''
      const s = t.ttc >= 0
      push(d.date, d.number, '3421 Clients', c, s ? t.ttc : 0, s ? 0 : -t.ttc)
      push(d.date, d.number, '7111 Ventes de marchandises', c, s ? 0 : -t.ht, s ? t.ht : 0)
      push(d.date, d.number, '4455 État, TVA facturée', c, s ? 0 : -t.tva, s ? t.tva : 0)
    }
    for (const d of data.purch) {
      const t = docTotals(d), f = db.suppliers.find((x) => x.id === d.partyId)?.name || ''
      push(d.date, d.number, '6111 Achats de marchandises', f, t.ht, 0)
      push(d.date, d.number, '34552 État, TVA récupérable', f, t.tva, 0)
      push(d.date, d.number, '4411 Fournisseurs', f, 0, t.ttc)
    }
    for (const e of data.exps) {
      const tva = Number(e.amount) * (Number(e.tva) || 0) / 100
      push(e.date, e.label, `61xx ${e.category}`, e.label, Number(e.amount), 0)
      if (tva) push(e.date, e.label, '34552 État, TVA récupérable', e.label, tva, 0)
      push(e.date, e.label, '4411 Fournisseurs', e.label, 0, Number(e.amount) + tva)
    }
    return out.sort((a, b) => a.date.localeCompare(b.date))
  }, [data, db])
  const totD = rows.reduce((s, r) => s + r.debit, 0), totC = rows.reduce((s, r) => s + r.credit, 0)
  return (
    <>
      <div className="row wrap muted small">Écritures générées automatiquement — {label}. Total débit <b className="num">{money(totD)}</b> · total crédit <b className="num">{money(totC)}</b> {Math.abs(totD - totC) < 1 ? <Badge color="green">Équilibré</Badge> : <Badge color="red">Déséquilibré</Badge>}</div>
      <DataTable rows={rows} exportName={`grand-livre-${label}`} pageSize={20} searchKeys={['piece', 'account', 'lib']}
        filters={[{ key: 'account', label: 'Compte', options: [...new Set(rows.map((r) => r.account))] }]}
        actions={<button className="btn sm" onClick={() => exportXlsx([['Grand livre', rows.map((r) => ({ Date: r.date, Pièce: r.piece, Compte: r.account, Libellé: r.lib, Débit: r.debit, Crédit: r.credit }))]], `grand-livre-${label.replace(/\s+/g, '-')}`)}><Icon name="download" size={14} />Excel</button>}
        columns={[
          { key: 'date', label: 'Date', render: (r) => fdate(r.date) },
          { key: 'piece', label: 'Pièce', strong: true },
          { key: 'account', label: 'Compte' },
          { key: 'lib', label: 'Libellé' },
          { key: 'debit', label: 'Débit', right: true, render: (r) => (r.debit ? money(r.debit) : '') },
          { key: 'credit', label: 'Crédit', right: true, render: (r) => (r.credit ? money(r.credit) : '') },
        ]} />
    </>
  )
}
