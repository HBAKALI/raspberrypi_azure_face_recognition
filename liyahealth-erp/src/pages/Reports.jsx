import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { PageHead, Card, Seg, BarChart, Donut, Progress, Modal, Icon, Kpi, COLORS, SERIES } from '../components/ui.jsx'
import { TODAY, lastMonths, monthLabel, monthKey, money, moneyK, pct, int, fdate, lineTotal } from '../lib/domain.js'

const csv = (name, head, rows) => {
  const body = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }))
  a.download = `${name}.csv`; a.click()
}
const ExportBtn = ({ onClick }) => <button className="btn sm" onClick={onClick}><Icon name="download" size={14} />CSV</button>

export default function Reports() {
  const { db } = useStore()
  const [period, setPeriod] = useState('12')
  const [print, setPrint] = useState(false)

  const r = useMemo(() => {
    const months = lastMonths(Number(period))
    const set = new Set(months)
    const byMonth = Object.fromEntries(months.map((m) => [m, { ca: 0, marge: 0 }]))
    const clients = {}, products = {}, cats = {}, cities = {}, sector = { Public: 0, Privé: 0 }
    let ca = 0, marge = 0, count = 0
    for (const d of db.documents) {
      if (!['facture', 'avoir'].includes(d.type) || !['Validée', 'Validé'].includes(d.status) || !set.has(monthKey(d.date))) continue
      const sign = d.type === 'avoir' ? -1 : 1
      const c = db.clients.find((x) => x.id === d.partyId)
      if (d.type === 'facture') count++
      for (const l of d.lines) {
        const p = db.products.find((x) => x.id === l.productId)
        const ht = lineTotal(l).ht * sign
        const mg = ht - sign * Number(l.qty) * (p?.cost || 0)
        ca += ht; marge += mg
        byMonth[monthKey(d.date)].ca += ht; byMonth[monthKey(d.date)].marge += mg
        const cat = p?.category || 'Autre'
        cats[cat] ||= { ca: 0, marge: 0 }; cats[cat].ca += ht; cats[cat].marge += mg
        products[l.productId] ||= { name: l.label, qty: 0, ca: 0, marge: 0 }
        products[l.productId].qty += Number(l.qty) * sign; products[l.productId].ca += ht; products[l.productId].marge += mg
        if (c) {
          clients[c.id] ||= { name: c.name, type: c.type, city: c.city, ca: 0, n: new Set() }
          clients[c.id].ca += ht; clients[c.id].n.add(d.id)
          cities[c.city] = (cities[c.city] || 0) + ht
          sector[c.public ? 'Public' : 'Privé'] += ht
        }
      }
    }
    const sortDesc = (o) => Object.values(o).sort((a, b) => b.ca - a.ca)
    return {
      months, byMonth, ca, marge, count, activeClients: Object.keys(clients).length,
      clients: sortDesc(clients).slice(0, 10), products: sortDesc(products).slice(0, 10),
      cats: Object.entries(cats).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.ca - a.ca),
      cities: Object.entries(cities).sort((a, b) => b[1] - a[1]), sector,
    }
  }, [db, period])

  const topMax = r.clients[0]?.ca || 1
  const prodMax = r.products[0]?.ca || 1
  const lastM = r.months.at(-1), prevM = r.months.at(-2)

  return (
    <div className="stack">
      <PageHead title="Rapports & analyses" sub="Performance commerciale, rentabilité et répartition du chiffre d'affaires." crumbs="Pilotage">
        <Seg value={period} onChange={setPeriod} options={[['3', '3 mois'], ['6', '6 mois'], ['12', '12 mois']]} />
        <button className="btn navy" onClick={() => setPrint(true)}><Icon name="printer" size={15} />Rapport mensuel</button>
      </PageHead>

      <div className="grid g4">
        <Kpi label="CA HT" value={moneyK(r.ca)} icon="money" color="teal" foot={`${period} derniers mois`} spark={r.months.map((m) => r.byMonth[m].ca)} />
        <Kpi label="Marge brute" value={moneyK(r.marge)} icon="trend" color="green" foot={`Taux ${pct(r.ca ? r.marge / r.ca : 0)}`} />
        <Kpi label="Factures émises" value={int(r.count)} icon="file" color="navy" foot={`Panier moyen ${moneyK(r.count ? r.ca / r.count : 0)}`} />
        <Kpi label="Clients actifs" value={int(r.activeClients)} icon="building" color="violet" foot={`${r.cities.length} ville(s)`} />
      </div>

      <Card title="Chiffre d'affaires et marge brute par mois" icon="chart" action={<ExportBtn onClick={() => csv('ca-mensuel', ['Mois', 'CA HT', 'Marge brute', 'Taux'], r.months.map((m) => [monthLabel(m), r.byMonth[m].ca.toFixed(2), r.byMonth[m].marge.toFixed(2), r.byMonth[m].ca ? (r.byMonth[m].marge / r.byMonth[m].ca * 100).toFixed(1) + ' %' : '']))} />}>
        <BarChart labels={r.months.map(monthLabel)} series={[{ name: 'CA HT', data: r.months.map((m) => r.byMonth[m].ca), color: COLORS.teal }, { name: 'Marge brute', data: r.months.map((m) => r.byMonth[m].marge), color: COLORS.navy }]} />
      </Card>

      <div className="grid g2">
        <Card title="Top 10 clients" icon="building" action={<ExportBtn onClick={() => csv('top-clients', ['Client', 'Type', 'Ville', 'CA HT', 'Factures'], r.clients.map((c) => [c.name, c.type, c.city, c.ca.toFixed(2), c.n.size]))} />}>
          <div className="stack" style={{ gap: 12 }}>
            {r.clients.map((c, i) => (
              <div key={c.name}>
                <div className="row small"><b style={{ width: 18 }}>{i + 1}</b><span style={{ fontWeight: 600 }}>{c.name}</span><span className="muted">· {c.city}</span><span className="spacer" /><b className="num">{money(c.ca)}</b></div>
                <Progress value={c.ca / topMax} color={SERIES[i % SERIES.length]} />
              </div>
            ))}
          </div>
        </Card>
        <Card title="Top 10 produits" icon="box" action={<ExportBtn onClick={() => csv('top-produits', ['Produit', 'Quantité', 'CA HT', 'Marge'], r.products.map((p) => [p.name, p.qty, p.ca.toFixed(2), p.marge.toFixed(2)]))} />}>
          <div className="stack" style={{ gap: 12 }}>
            {r.products.map((p, i) => (
              <div key={p.name}>
                <div className="row small"><b style={{ width: 18 }}>{i + 1}</b><span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{p.name}</span><span className="muted">· {int(p.qty)} u.</span><span className="spacer" /><b className="num">{money(p.ca)}</b></div>
                <Progress value={p.ca / prodMax} color={COLORS.navy} />
              </div>
            ))}
          </div>
        </Card>
        <Card title="CA par catégorie" icon="layers">
          <Donut data={r.cats.map((c, i) => ({ label: c.name, value: Math.max(c.ca, 0), color: SERIES[i % SERIES.length] }))} label={moneyK(r.ca)} sub="CA HT" />
        </Card>
        <Card title="Secteur public vs privé" icon="shield">
          <Donut data={[{ label: 'Public (CHU, hôpitaux, urgences)', value: r.sector.Public, color: COLORS.navy }, { label: 'Privé (cliniques, cabinets, centres)', value: r.sector['Privé'], color: COLORS.teal }]} label={pct(r.ca ? r.sector.Public / r.ca : 0, 0)} sub="part du public" />
        </Card>
        <Card title="CA par ville" icon="globe" action={<ExportBtn onClick={() => csv('ca-villes', ['Ville', 'CA HT'], r.cities.map(([c, v]) => [c, v.toFixed(2)]))} />}>
          <BarChart labels={r.cities.map(([c]) => c)} series={[{ name: 'CA HT', data: r.cities.map(([, v]) => v), color: COLORS.green }]} />
        </Card>
        <Card title="Marge par catégorie" icon="trend" pad={false} action={<ExportBtn onClick={() => csv('marge-categories', ['Catégorie', 'CA HT', 'Marge', 'Taux'], r.cats.map((c) => [c.name, c.ca.toFixed(2), c.marge.toFixed(2), (c.ca ? c.marge / c.ca * 100 : 0).toFixed(1) + ' %']))} />}>
          <div className="table-wrap" style={{ marginTop: 12 }}><table className="t">
            <thead><tr><th>Catégorie</th><th className="right">CA HT</th><th className="right">Marge</th><th className="right">Taux</th></tr></thead>
            <tbody>{r.cats.map((c) => <tr key={c.name}><td className="strong">{c.name}</td><td className="right num">{money(c.ca)}</td><td className="right num">{money(c.marge)}</td><td className="right num">{pct(c.ca ? c.marge / c.ca : 0)}</td></tr>)}</tbody>
          </table></div>
        </Card>
      </div>

      {print && (
        <Modal size="xl" title="Rapport mensuel" onClose={() => setPrint(false)}
          footer={<><button className="btn" onClick={() => setPrint(false)}>Fermer</button><button className="btn primary" onClick={() => window.print()}><Icon name="printer" size={15} />Imprimer / PDF</button></>}>
          <div className="print-area print-doc">
            <div className="print-band" />
            <div className="row" style={{ marginTop: 18, alignItems: 'flex-start' }}>
              <div><h2 style={{ color: '#0b2545' }}>{db.settings.company.name}</h2><div style={{ color: '#64748b' }}>{db.settings.company.tagline}</div></div>
              <div className="spacer" />
              <div style={{ textAlign: 'right' }}><b>Rapport d'activité — {monthLabel(lastM)}</b><div style={{ color: '#64748b' }}>Édité le {fdate(TODAY)}</div></div>
            </div>
            <table>
              <thead><tr><th>Indicateur</th><th style={{ textAlign: 'right' }}>{monthLabel(prevM)}</th><th style={{ textAlign: 'right' }}>{monthLabel(lastM)} (en cours)</th><th style={{ textAlign: 'right' }}>Cumul {period} mois</th></tr></thead>
              <tbody>
                <tr><td>Chiffre d'affaires HT</td><td style={{ textAlign: 'right' }}>{money(r.byMonth[prevM]?.ca)}</td><td style={{ textAlign: 'right' }}>{money(r.byMonth[lastM]?.ca)}</td><td style={{ textAlign: 'right' }}>{money(r.ca)}</td></tr>
                <tr><td>Marge brute</td><td style={{ textAlign: 'right' }}>{money(r.byMonth[prevM]?.marge)}</td><td style={{ textAlign: 'right' }}>{money(r.byMonth[lastM]?.marge)}</td><td style={{ textAlign: 'right' }}>{money(r.marge)}</td></tr>
                <tr><td>Taux de marge</td><td style={{ textAlign: 'right' }}>{pct(r.byMonth[prevM]?.ca ? r.byMonth[prevM].marge / r.byMonth[prevM].ca : 0)}</td><td style={{ textAlign: 'right' }}>{pct(r.byMonth[lastM]?.ca ? r.byMonth[lastM].marge / r.byMonth[lastM].ca : 0)}</td><td style={{ textAlign: 'right' }}>{pct(r.ca ? r.marge / r.ca : 0)}</td></tr>
              </tbody>
            </table>
            <table>
              <thead><tr><th>Top 5 clients</th><th style={{ textAlign: 'right' }}>CA HT</th><th>Top 5 produits</th><th style={{ textAlign: 'right' }}>CA HT</th></tr></thead>
              <tbody>{[0, 1, 2, 3, 4].map((i) => (
                <tr key={i}><td>{r.clients[i]?.name}</td><td style={{ textAlign: 'right' }}>{r.clients[i] ? money(r.clients[i].ca) : ''}</td><td>{r.products[i]?.name}</td><td style={{ textAlign: 'right' }}>{r.products[i] ? money(r.products[i].ca) : ''}</td></tr>
              ))}</tbody>
            </table>
            <table>
              <thead><tr><th>Catégorie</th><th style={{ textAlign: 'right' }}>CA HT</th><th style={{ textAlign: 'right' }}>Marge</th><th style={{ textAlign: 'right' }}>Taux</th></tr></thead>
              <tbody>{r.cats.map((c) => <tr key={c.name}><td>{c.name}</td><td style={{ textAlign: 'right' }}>{money(c.ca)}</td><td style={{ textAlign: 'right' }}>{money(c.marge)}</td><td style={{ textAlign: 'right' }}>{pct(c.ca ? c.marge / c.ca : 0)}</td></tr>)}</tbody>
            </table>
            <p style={{ marginTop: 24, color: '#64748b', fontSize: 11 }}>{db.settings.company.name} — {db.settings.company.address} — ICE {db.settings.company.ice}</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
