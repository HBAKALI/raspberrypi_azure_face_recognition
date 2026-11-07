import { useMemo } from 'react'
import { useStore } from '../lib/store.jsx'
import { go } from '../lib/nav.js'
import { Badge, BarChart, Card, Donut, Icon, Kpi, LineChart, PageHead, Progress, SERIES, COLORS } from '../components/ui.jsx'
import { TODAY, docTotals, docPaid, fdate, lastMonths, money, moneyK, monthLabel, productStock, revenueByMonth, stockValue, daysBetween, int } from '../lib/domain.js'
import { insights, revenueForecast, reorderPlan } from '../ai/engine.js'
import { isEnabled } from '../lib/modules.js'

export default function Dashboard() {
  const { db } = useStore()
  const s = useMemo(() => {
    const months = lastMonths(12)
    const rev = revenueByMonth(db, months)
    const inv = db.documents.filter((d) => d.type === 'facture' && d.status === 'Validée')
    let cost = 0, net = 0
    const marginByMonth = Object.fromEntries(months.map((m) => [m, 0]))
    for (const d of inv) for (const l of d.lines) {
      const p = db.products.find((x) => x.id === l.productId)
      const v = l.qty * l.price * (1 - (l.discount || 0) / 100), c = l.qty * (p?.cost || 0)
      net += v; cost += c
      if (d.date.slice(0, 7) in marginByMonth) marginByMonth[d.date.slice(0, 7)] += v - c
    }
    const receivable = inv.reduce((t, d) => t + Math.max(0, docTotals(d).ttc - docPaid(db, d)), 0)
    const overdue = inv.filter((d) => d.dueDate < TODAY).reduce((t, d) => t + Math.max(0, docTotals(d).ttc - docPaid(db, d)), 0)
    const cur = rev.at(-2), prev = rev.at(-3) // dernier mois clos
    const quarter = rev.slice(-4, -1).reduce((a, b) => a + b, 0), prevQ = rev.slice(-7, -4).reduce((a, b) => a + b, 0)
    const byCat = {}
    for (const d of inv) for (const l of d.lines) { const c = db.products.find((p) => p.id === l.productId)?.category || 'Autre'; byCat[c] = (byCat[c] || 0) + l.qty * l.price }
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1])
    const topCats = [...cats.slice(0, 5), ['Autres', cats.slice(5).reduce((t, x) => t + x[1], 0)]].filter((x) => x[1] > 0)
    const byClient = {}
    for (const d of inv) byClient[d.partyId] = (byClient[d.partyId] || 0) + docTotals(d).ht
    const topClients = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, v]) => ({ c: db.clients.find((x) => x.id === id), v }))
    const fc = revenueForecast(db, 3)
    return { months, rev, marginByMonth: months.map((m) => marginByMonth[m]), net, cost, receivable, overdue, cur, prev, quarter, prevQ, topCats, topClients, fc }
  }, [db])

  const alerts = useMemo(() => insights(db), [db])
  const plan = useMemo(() => reorderPlan(db).filter((r) => r.qty > 0), [db])
  const pipeline = db.opportunities.filter((o) => !['Gagnée', 'Perdue'].includes(o.stage))
  const openQuotes = db.documents.filter((d) => d.type === 'devis' && ['Envoyé', 'Brouillon'].includes(d.status))
  const nextTenders = db.tenders.filter((t) => daysBetween(TODAY, t.deadline) >= 0 && !['Gagné', 'Perdu'].includes(t.status)).sort((a, b) => a.deadline.localeCompare(b.deadline))
  const upcoming = db.interventions.filter((i) => i.status !== 'Terminée').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
  const fcLabels = [...s.months.map(monthLabel), ...s.fc.futureMonths.slice(1).map(monthLabel)]
  const hour = new Date().getHours()

  return (
    <div className="stack">
      <PageHead title={`${hour < 18 ? 'Bonjour' : 'Bonsoir'}, ${db.settings.user.name.split(' ')[0]}`} sub={`Vue d'ensemble de ${db.settings.company.name} — ${fdate(TODAY)}`}>
        <button className="btn" onClick={() => go('sales', 'devis')}><Icon name="plus" size={15} />Nouveau devis</button>
        <button className="btn primary" onClick={() => go('sales', 'facture')}><Icon name="file" size={15} />Facturer</button>
      </PageHead>

      <div className="grid g4">
        <Kpi label="CA HT dernier mois clos" value={moneyK(s.cur)} icon="money" color="teal" delta={s.prev ? (s.cur - s.prev) / s.prev : undefined} foot="vs mois précédent" spark={s.rev} />
        <Kpi label="CA HT 3 derniers mois" value={moneyK(s.quarter)} icon="trend" color="navy" delta={s.prevQ ? (s.quarter - s.prevQ) / s.prevQ : undefined} foot="vs 3 mois précédents" />
        <Kpi label="Marge brute 12 mois" value={`${((1 - s.cost / (s.net || 1)) * 100).toFixed(1)} %`} icon="chart" color="green" foot={moneyK(s.net - s.cost)} spark={s.marginByMonth} />
        <Kpi label="Créances clients" value={moneyK(s.receivable)} icon="wallet" color="amber" foot={`dont ${moneyK(s.overdue)} échues`} />
      </div>

      {isEnabled(db.settings, 'ai') && alerts.length > 0 && (
        <div className="ai-hero">
          <div className="row wrap" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="row" style={{ gap: 8, color: '#b9a9ff', fontWeight: 700, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase' }}><Icon name="sparkles" size={15} />LIYA IA · Briefing du jour</div>
              <h2 style={{ marginTop: 6 }}>{alerts.length} points d'attention détectés automatiquement</h2>
              <p>Prévision du mois prochain : <b>{moneyK(s.fc.forecast[1])}</b> HT · {plan.length} produits à réapprovisionner · {nextTenders.length} appels d'offres actifs.</p>
            </div>
            <button className="btn" style={{ background: '#fff', color: 'var(--navy)', border: 0 }} onClick={() => go('ai')}>Ouvrir LIYA IA<Icon name="arrowRight" size={15} /></button>
          </div>
          <div className="grid g3" style={{ marginTop: 16 }}>
            {alerts.slice(0, 3).map((a, i) => (
              <button key={i} onClick={() => go(a.page, a.tab)} style={{ textAlign: 'left', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', color: '#fff', borderRadius: 12, padding: 12, cursor: 'pointer' }}>
                <div className="row" style={{ gap: 8, fontWeight: 700 }}><Icon name={a.icon} size={16} />{a.title}</div>
                <div style={{ fontSize: 12, color: '#cfe0f2', marginTop: 4, lineHeight: 1.45 }}>{a.text.length > 120 ? a.text.slice(0, 120) + '…' : a.text}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid g3">
        <Card title="Chiffre d'affaires & prévision IA" className="span2" icon="trend" action={<Badge color="violet">Précision {Math.round(s.fc.accuracy * 100)} %</Badge>}>
          <LineChart labels={fcLabels} series={[
            { name: 'CA HT réalisé', color: COLORS.teal, data: [...s.rev.slice(0, -1), null, null, null, null] },
            { name: 'Marge brute', color: COLORS.navy, data: [...s.marginByMonth.slice(0, -1), null, null, null, null] },
            { name: 'Prévision IA', color: COLORS.violet, dashed: true, data: [...Array(10).fill(null), s.rev.at(-2), ...s.fc.forecast.slice(0, 4)] },
          ]} />
        </Card>
        <Card title="Ventes par catégorie" icon="layers">
          <Donut data={s.topCats.map(([l, v], i) => ({ label: l, value: v, color: SERIES[i] }))} label={moneyK(s.net)} sub="CA HT 12 mois" />
        </Card>
      </div>

      <div className="grid g3">
        <Card title="Top clients" icon="building" action={<button className="btn sm ghost" onClick={() => go('reports')}>Rapports</button>}>
          <div className="stack" style={{ gap: 12 }}>
            {s.topClients.map(({ c, v }) => (
              <div key={c.id}>
                <div className="row small"><b style={{ flex: 1 }}>{c.name}</b><span className="num">{moneyK(v)}</span></div>
                <div style={{ marginTop: 5 }}><Progress value={v / s.topClients[0].v} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Stock & réapprovisionnement" icon="box" action={<button className="btn sm ghost" onClick={() => go('ai', 'reorder')}>Plan IA</button>}>
          <div className="row" style={{ marginBottom: 12 }}>
            <div><div className="muted small">Valeur du stock</div><div style={{ fontSize: 20, fontWeight: 800 }}>{moneyK(stockValue(db))}</div></div>
            <div className="spacer" />
            <div className="right"><div className="muted small">Sous le minimum</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)' }}>{db.products.filter((p) => productStock(p) < p.minStock).length}</div></div>
          </div>
          {plan.slice(0, 5).map((r) => (
            <div key={r.product.id} className="row small" style={{ padding: '7px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ flex: 1 }}>{r.product.name}</span><Badge>{r.urgency}</Badge><b className="num">+{int(r.qty)}</b>
            </div>
          ))}
          {!plan.length && <div className="muted">Aucun besoin immédiat.</div>}
        </Card>
        <Card title="Appels d'offres à venir" icon="gavel" action={<button className="btn sm ghost" onClick={() => go('tenders')}>Voir tout</button>}>
          {nextTenders.slice(0, 5).map((t) => {
            const d = daysBetween(TODAY, t.deadline)
            return (
              <div key={t.id} className="row small" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}><b>{t.ref}</b><div className="muted">{t.buyer}</div></div>
                <div className="right"><Badge color={d <= 7 ? 'red' : d <= 21 ? 'amber' : 'blue'}>J-{d}</Badge><div className="muted num" style={{ marginTop: 4 }}>{moneyK(t.estimate)}</div></div>
              </div>
            )
          })}
          {!nextTenders.length && <div className="muted">Aucun AO en cours.</div>}
        </Card>
      </div>

      <div className="grid g3">
        <Card title="Pipeline commercial" icon="target" action={<button className="btn sm ghost" onClick={() => go('crm')}>CRM</button>}>
          <BarChart height={180} labels={['Prospection', 'Qualification', 'Proposition', 'Négociation']} series={[{ name: 'Montant', color: COLORS.violet, data: ['Prospection', 'Qualification', 'Proposition', 'Négociation'].map((st) => pipeline.filter((o) => o.stage === st).reduce((t, o) => t + o.amount, 0)) }]} />
          <div className="row small"><span className="muted">Pondéré</span><span className="spacer" /><b>{moneyK(pipeline.reduce((t, o) => t + o.amount * o.probability, 0))}</b></div>
        </Card>
        <Card title="Devis en attente" icon="file" action={<button className="btn sm ghost" onClick={() => go('sales', 'devis')}>Ventes</button>}>
          {openQuotes.slice(0, 6).map((d) => (
            <div key={d.id} className="row small" style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}><b>{d.number}</b><div className="muted">{db.clients.find((c) => c.id === d.partyId)?.name}</div></div>
              <div className="right"><b className="num">{money(docTotals(d).ttc)}</b><div><Badge>{d.status}</Badge></div></div>
            </div>
          ))}
          {!openQuotes.length && <div className="muted">Aucun devis en attente.</div>}
        </Card>
        <Card title="Interventions SAV à venir" icon="wrench" action={<button className="btn sm ghost" onClick={() => go('service')}>SAV</button>}>
          {upcoming.map((i) => {
            const eq = db.equipment.find((e) => e.id === i.equipmentId)
            const p = db.products.find((x) => x.id === eq?.productId)
            return (
              <div key={i.id} className="row small" style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}><b>{i.type}</b><div className="muted">{p?.name} · {db.clients.find((c) => c.id === i.clientId)?.name}</div></div>
                <div className="right"><div className="num">{fdate(i.date)}</div><Badge>{i.status}</Badge></div>
              </div>
            )
          })}
        </Card>
      </div>
    </div>
  )
}
