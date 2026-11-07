import { ss } from '../lib/nav.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { go, useRoute } from '../lib/nav.js'
import { Badge, Card, DataTable, Field, Icon, Kpi, LineChart, PageHead, Progress, Tabs, COLORS } from '../components/ui.jsx'
import { TODAY, addDays, daysBetween, docTotals, fdate, int, lastMonths, money, moneyK, monthLabel, unitsByMonth, uid } from '../lib/domain.js'
import { QUICK_PROMPTS, anomalies, clientRisk, expiryRisks, holt, insights, localAnswer, reorderPlan, revenueForecast, tenderScore } from '../ai/engine.js'
import { aiConfigured, askClaude, explainError } from '../ai/claude.js'

const TABS = [['overview', 'Vue d\'ensemble'], ['chat', 'Assistant'], ['forecast', 'Prévisions'], ['reorder', 'Réapprovisionnement'], ['expiry', 'Péremption'], ['clients', 'Risque clients'], ['anomalies', 'Anomalies'], ['write', 'Rédaction IA']]

export default function AI() {
  const { db } = useStore()
  const { tab } = useRoute()
  const t = TABS.some(([id]) => id === tab) ? tab : 'overview'
  const online = aiConfigured(db.settings.ai)
  return (
    <div className="stack">
      <PageHead title="LIYA IA" sub="Intelligence artificielle intégrée : assistant conversationnel, prévisions, recommandations et rédaction.">
        <Badge color={online ? 'green' : 'amber'}>{online ? `Claude connecté · ${db.settings.ai.model}` : 'Mode hors ligne (moteur local)'}</Badge>
        <button className="btn" onClick={() => go('settings', 'ai')}><Icon name="key" size={15} />Configurer</button>
      </PageHead>
      <Tabs tabs={TABS} value={t} onChange={(x) => go('ai', x)} />
      {t === 'overview' && <Overview />}
      {t === 'chat' && <Chat />}
      {t === 'forecast' && <Forecast />}
      {t === 'reorder' && <Reorder />}
      {t === 'expiry' && <Expiry />}
      {t === 'clients' && <ClientsRisk />}
      {t === 'anomalies' && <Anomalies />}
      {t === 'write' && <Writer />}
    </div>
  )
}

function Overview() {
  const { db } = useStore()
  const ins = useMemo(() => insights(db), [db])
  const f = useMemo(() => revenueForecast(db, 3), [db])
  const plan = useMemo(() => reorderPlan(db).filter((r) => r.qty > 0), [db])
  const risk = useMemo(() => clientRisk(db), [db])
  const tenders = db.tenders.filter((x) => !['Gagné', 'Perdu'].includes(x.status)).map((x) => ({ x, s: tenderScore(db, x) }))
  const caps = [
    ['chat', 'brain', 'Assistant conversationnel', 'Questions en langage naturel sur toutes les données de l\'ERP.'],
    ['forecast', 'trend', 'Prévision de la demande', 'Lissage de Holt sur 12 mois, par produit et global, avec marge d\'erreur.'],
    ['reorder', 'box', 'Réapprovisionnement', 'Point de commande, stock de sécurité, délais fournisseurs → BC en un clic.'],
    ['expiry', 'clock', 'Anti-péremption', 'Lots qui ne seront pas écoulés à temps, valeur exposée, actions FEFO.'],
    ['clients', 'wallet', 'Scoring risque client', 'Retards, encours, échu : priorités de recouvrement.'],
    ['anomalies', 'alert', 'Détection d\'anomalies', 'Ventes à perte, remises atypiques, doublons, trop-perçus.'],
    ['write', 'edit', 'Rédaction IA', 'Relances, mémoires techniques AO, fiches produits, e-mails fournisseurs.'],
  ]
  return (
    <>
      <div className="ai-hero">
        <div className="row" style={{ gap: 8, color: '#b9a9ff', fontWeight: 700, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase' }}><Icon name="sparkles" size={15} />Analyse automatique</div>
        <h2 style={{ marginTop: 6 }}>Prévision CA HT du mois prochain : {moneyK(f.forecast[1])}</h2>
        <p>Tendance {f.trend >= 0 ? 'haussière' : 'baissière'} ({f.trend >= 0 ? '+' : '−'}{moneyK(Math.abs(f.trend))}/mois) · précision historique {Math.round(f.accuracy * 100)} % · {plan.length} réappros recommandés ({moneyK(plan.reduce((s, r) => s + r.value, 0))}) · {risk.filter((r) => r.level === 'Haute').length} clients à risque élevé.</p>
        <div className="chips" style={{ marginTop: 14 }}>
          {QUICK_PROMPTS.slice(0, 4).map((q) => <button key={q} className="chip" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', borderColor: 'rgba(255,255,255,.2)' }} onClick={() => { ss.set('liya-q', q); go('ai', 'chat') }}>{q}</button>)}
        </div>
      </div>
      <div className="grid g2">
        <Card title="Recommandations prioritaires" icon="sparkles">
          <div className="stack" style={{ gap: 10 }}>
            {ins.map((i, k) => (
              <div key={k} className="insight">
                <div className="ii" style={{ background: COLORS[i.color] + '1a', color: COLORS[i.color] }}><Icon name={i.icon} size={17} /></div>
                <div style={{ flex: 1 }}>
                  <div className="row"><b style={{ flex: 1 }}>{i.title}</b><Badge>{i.severity}</Badge></div>
                  <div className="muted small" style={{ marginTop: 4, lineHeight: 1.5 }}>{i.text}</div>
                  <button className="btn sm" style={{ marginTop: 8 }} onClick={() => go(i.page, i.tab)}>Agir<Icon name="arrowRight" size={13} /></button>
                </div>
              </div>
            ))}
            {!ins.length && <div className="muted">Aucune alerte : tout est sous contrôle.</div>}
          </div>
        </Card>
        <div className="stack">
          <Card title="Scoring des appels d'offres" icon="gavel">
            {tenders.map(({ x, s }) => (
              <div key={x.id} className="row" style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                <ScoreRing value={s.score} />
                <div style={{ flex: 1 }}><b>{x.ref}</b><div className="muted small">{x.object}</div></div>
                <Badge color={s.score >= 65 ? 'green' : s.score >= 45 ? 'amber' : 'red'}>{s.recommendation}</Badge>
              </div>
            ))}
          </Card>
          <div className="grid g2">
            {caps.map(([id, icon, title, desc]) => (
              <button key={id} className="card insight" style={{ cursor: 'pointer', textAlign: 'left' }} onClick={() => go('ai', id)}>
                <div className="ii" style={{ background: '#7b61ff1a', color: COLORS.violet }}><Icon name={icon} size={17} /></div>
                <div><b>{title}</b><div className="muted small" style={{ marginTop: 3 }}>{desc}</div></div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export function ScoreRing({ value, size = 46 }) {
  const c = value >= 65 ? COLORS.green : value >= 45 ? COLORS.amber : COLORS.red
  const r = 18, L = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" style={{ flexShrink: 0 }}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--soft)" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={c} strokeWidth="4" strokeDasharray={`${(value / 100) * L} ${L}`} strokeLinecap="round" transform="rotate(-90 22 22)" />
      <text x="22" y="26" textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, fill: 'var(--text)' }}>{value}</text>
    </svg>
  )
}

function Chat() {
  const { db, mutate } = useStore()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [streaming, setStreaming] = useState('')
  const log = useRef()
  const msgs = db.aiChats
  const online = aiConfigured(db.settings.ai)

  useEffect(() => { log.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [msgs.length, streaming])
  useEffect(() => { const q = ss.get('liya-q'); if (q) { ss.del('liya-q'); send(q) } }, []) // eslint-disable-line

  const push = (m) => mutate((d) => { d.aiChats.push({ id: uid(), date: new Date().toISOString(), ...m }); d.aiChats = d.aiChats.slice(-40) })

  async function send(text) {
    const q = (text ?? input).trim()
    if (!q || busy) return
    setInput('')
    push({ role: 'user', content: q })
    setBusy(true)
    let answer, source = 'local'
    if (online) {
      try {
        let acc = ''
        const history = [...msgs.slice(-10), { role: 'user', content: q }].map((m) => ({ role: m.role, content: m.content }))
        answer = await askClaude({ ai: db.settings.ai, db, messages: history, onText: (t) => { acc += t; setStreaming(acc) } })
        source = 'claude'
      } catch (e) {
        answer = `${explainError(e)}\n\n${localAnswer(db, q)}`
      }
    } else {
      await new Promise((r) => setTimeout(r, 450))
      answer = localAnswer(db, q)
    }
    setStreaming('')
    push({ role: 'assistant', content: answer, source })
    setBusy(false)
  }

  return (
    <div className="grid g3">
      <div className="card chat span2">
        <div className="chat-log" ref={log}>
          {!msgs.length && (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 460 }}>
              <div className="brand-logo" style={{ margin: '0 auto 12px', width: 52, height: 52, background: 'linear-gradient(135deg,#7b61ff,#13a89e)' }}><Icon name="sparkles" size={26} /></div>
              <h3>Bonjour, je suis LIYA IA</h3>
              <p className="muted">Posez une question sur vos ventes, stocks, appels d'offres, clients ou SAV. Je réponds à partir des données de l'ERP.</p>
            </div>
          )}
          {msgs.map((m) => (
            <div key={m.id} className={`msg ${m.role}`}>
              {m.content}
              <div className="meta">{new Date(m.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}{m.role === 'assistant' && ` · ${m.source === 'claude' ? 'Claude' : 'moteur local'}`}</div>
            </div>
          ))}
          {busy && <div className="msg assistant">{streaming || <span className="typing"><span /><span /><span /></span>}</div>}
        </div>
        <div className="chat-input">
          <textarea value={input} placeholder="Ex. : Quels produits commander avant l'AO du CHU Ibn Rochd ?" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
          <button className="btn ai" onClick={() => send()} disabled={busy}><Icon name="send" size={16} /></button>
        </div>
      </div>
      <div className="stack">
        <Card title="Suggestions" icon="sparkles">
          <div className="chips">{QUICK_PROMPTS.map((q) => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}</div>
        </Card>
        <Card title="Confidentialité" icon="shield">
          <div className="muted small" style={{ lineHeight: 1.6 }}>
            {online ? 'Un résumé agrégé des données (CA, stock, AO, créances — sans données RH nominatives) est envoyé à l\'API Claude à chaque question.' : 'Mode hors ligne : toutes les réponses sont calculées localement, aucune donnée ne quitte le navigateur.'}
          </div>
          {msgs.length > 0 && <button className="btn sm" style={{ marginTop: 10 }} onClick={() => mutate((d) => { d.aiChats = [] })}><Icon name="trash" size={13} />Effacer la conversation</button>}
        </Card>
      </div>
    </div>
  )
}

function Forecast() {
  const { db } = useStore()
  const f = useMemo(() => revenueForecast(db, 3), [db])
  const [pid, setPid] = useState(db.products.find((p) => p.kind === 'conso')?.id)
  const months = lastMonths(12)
  const hist = useMemo(() => unitsByMonth(db, pid, months), [db, pid]) // eslint-disable-line
  const pf = holt(hist.slice(0, -1), 4)
  const labels = [...months.map(monthLabel), ...f.futureMonths.slice(1).map(monthLabel)]
  const nul = (n) => Array(n).fill(null)
  return (
    <>
      <div className="grid g4">
        {f.futureMonths.slice(1).map((m, i) => <Kpi key={m} label={`Prévision ${monthLabel(m)}`} value={moneyK(f.forecast[i + 1])} icon="trend" color="violet" foot={`± ${moneyK(f.error)}`} />)}
        <Kpi label="Précision du modèle" value={`${Math.round(f.accuracy * 100)} %`} icon="target" color="green" foot="1 − WAPE sur 11 mois clos" />
      </div>
      <Card title="Chiffre d'affaires HT : réalisé et prévu" icon="trend">
        <LineChart labels={labels} series={[
          { name: 'Réalisé', color: COLORS.teal, data: [...f.hist.slice(0, -1), ...nul(4)] },
          { name: 'Prévision', color: COLORS.violet, dashed: true, data: [...nul(10), f.hist.at(-2), ...f.forecast.slice(0, 4)] },
          { name: 'Borne haute', color: '#b9a9ff', dashed: true, data: [...nul(11), ...f.forecast.slice(0, 4).map((v) => v + f.error)] },
          { name: 'Borne basse', color: '#b9a9ff', dashed: true, data: [...nul(11), ...f.forecast.slice(0, 4).map((v) => Math.max(0, v - f.error))] },
        ]} />
      </Card>
      <Card title="Demande par produit (unités)" icon="box" action={<select className="input" style={{ width: 'auto', maxWidth: 320 }} value={pid} onChange={(e) => setPid(e.target.value)}>{db.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}>
        <LineChart format={(v) => int(v)} labels={labels} series={[
          { name: 'Ventes', color: COLORS.navy, data: [...hist.slice(0, -1), ...nul(4)] },
          { name: 'Prévision', color: COLORS.violet, dashed: true, data: [...nul(10), hist.at(-2), ...pf.forecast.slice(0, 4)] },
        ]} />
        <div className="muted small">Mois en cours partiel exclu de l'apprentissage. Prochains mois : {pf.forecast.slice(1, 4).map((v) => int(v)).join(' · ')} unités.</div>
      </Card>
    </>
  )
}

function Reorder() {
  const { db, mutate, toast, log, nextNumber } = useStore()
  const plan = useMemo(() => reorderPlan(db), [db])
  const need = plan.filter((r) => r.qty > 0)
  const [sel, setSel] = useState(() => new Set(need.map((r) => r.product.id)))
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const generate = () => {
    const bySup = {}
    for (const r of need) if (sel.has(r.product.id)) (bySup[r.product.supplierId] ||= []).push(r)
    const n = Object.keys(bySup).length
    mutate((d) => {
      for (const [sid, rows] of Object.entries(bySup)) {
        const sup = d.suppliers.find((s) => s.id === sid)
        d.documents.unshift({ id: uid(), type: 'bc', number: nextNumber('bc', d), partyId: sid, date: TODAY, dueDate: addDays(TODAY, sup?.leadTime || 30), status: 'Brouillon', notes: 'Généré par LIYA IA — plan de réapprovisionnement.', lines: rows.map((r) => ({ productId: r.product.id, label: r.product.name, qty: r.qty, price: r.product.cost, discount: 0, tva: 20 })) })
      }
    })
    log(`LIYA IA : ${n} bon(s) de commande générés`, 'sparkles')
    toast(`${n} bon(s) de commande créés en brouillon`)
    go('purchases', 'bc')
  }
  const total = need.filter((r) => sel.has(r.product.id)).reduce((s, r) => s + r.value, 0)
  return (
    <>
      <div className="grid g4">
        <Kpi label="Produits à commander" value={need.length} icon="box" color="violet" />
        <Kpi label="Ruptures / urgences" value={need.filter((r) => ['Critique', 'Haute'].includes(r.urgency)).length} icon="alert" color="red" />
        <Kpi label="Montant sélectionné (HT)" value={moneyK(total)} icon="wallet" color="teal" />
        <Kpi label="Fournisseurs concernés" value={new Set(need.filter((r) => sel.has(r.product.id)).map((r) => r.product.supplierId)).size} icon="globe" color="blue" />
      </div>
      <Card title="Plan de réapprovisionnement recommandé" icon="sparkles" pad={false} action={<button className="btn ai" disabled={!sel.size} onClick={generate}><Icon name="file" size={15} />Générer les bons de commande</button>}>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="t">
            <thead><tr><th /><th>Produit</th><th>Fournisseur</th><th className="right">Stock</th><th className="right">En cde</th><th className="right">Conso/mois</th><th className="right">Délai</th><th className="right">Stock sécu.</th><th className="right">Pt de cde</th><th className="right">Couverture</th><th>Urgence</th><th className="right">Qté conseillée</th></tr></thead>
            <tbody>
              {plan.map((r) => (
                <tr key={r.product.id} style={{ opacity: r.qty ? 1 : 0.55 }}>
                  <td>{r.qty > 0 && <input type="checkbox" checked={sel.has(r.product.id)} onChange={() => toggle(r.product.id)} />}</td>
                  <td className="strong">{r.product.name}</td><td>{r.supplier?.name}</td>
                  <td className="right num">{int(r.stock)}</td><td className="right num">{int(r.incoming)}</td><td className="right num">{int(r.monthly)}</td>
                  <td className="right num">{r.lead} j</td><td className="right num">{int(r.safety)}</td><td className="right num">{int(r.reorderPoint)}</td>
                  <td className="right num">{Number.isFinite(r.cover) ? `${r.cover} j` : '∞'}</td>
                  <td><Badge>{r.urgency}</Badge></td>
                  <td className="right num"><b>{r.qty ? int(r.qty) : '—'}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="muted small" style={{ padding: 14 }}>Méthode : demande = max(moyenne 3 mois, prévision Holt) ; stock de sécurité = 1,65 × σ × √(délai/30) (taux de service 95 %) ; cible = délai + 60 jours de couverture.</div>
      </Card>
    </>
  )
}

function Expiry() {
  const { db } = useStore()
  const rows = useMemo(() => expiryRisks(db).map((e, i) => ({ id: i, ...e })), [db])
  return (
    <>
      <div className="grid g3">
        <Kpi label="Lots à risque" value={rows.length} icon="clock" color="amber" />
        <Kpi label="Valeur exposée (coût)" value={moneyK(rows.reduce((s, r) => s + r.value, 0))} icon="wallet" color="red" />
        <Kpi label="Lots périmés" value={rows.filter((r) => r.expired).length} icon="alert" color="red" foot="À mettre en quarantaine" />
      </div>
      <DataTable rows={rows} exportName="peremption" columns={[
        { key: 'p', label: 'Produit', strong: true, sort: (r) => r.product.name, render: (r) => r.product.name, csv: (r) => r.product.name },
        { key: 'lot', label: 'Lot', render: (r) => r.lot.lot, csv: (r) => r.lot.lot },
        { key: 'exp', label: 'Péremption', sort: (r) => r.lot.expiry, render: (r) => fdate(r.lot.expiry) },
        { key: 'days', label: 'Jours', right: true, render: (r) => <Badge color={r.days < 0 ? 'red' : r.days < 90 ? 'amber' : 'blue'}>{r.days < 0 ? 'Périmé' : `${r.days} j`}</Badge> },
        { key: 'qty', label: 'En stock', right: true, render: (r) => int(r.lot.qty) },
        { key: 'atRisk', label: 'Qté à risque', right: true, render: (r) => <b>{int(r.atRisk)}</b> },
        { key: 'value', label: 'Valeur', right: true, render: (r) => money(r.value) },
        { key: 'action', label: 'Action recommandée', noSort: true, render: (r) => (r.expired ? 'Quarantaine + destruction tracée' : r.days < 60 ? 'Remise ciblée / échange fournisseur' : 'Prioriser en FEFO, proposer aux CHU') },
      ]} />
    </>
  )
}

function ClientsRisk() {
  const { db } = useStore()
  const rows = useMemo(() => clientRisk(db).map((r) => ({ id: r.client.id, ...r })), [db])
  return (
    <DataTable rows={rows} exportName="risque-clients" columns={[
      { key: 'c', label: 'Client', strong: true, sort: (r) => r.client.name, render: (r) => r.client.name, csv: (r) => r.client.name },
      { key: 't', label: 'Type', render: (r) => r.client.type },
      { key: 'revenue', label: 'CA HT 12 mois', right: true, render: (r) => money(r.revenue) },
      { key: 'outstanding', label: 'Encours TTC', right: true, render: (r) => money(r.outstanding) },
      { key: 'overdue', label: 'Échu', right: true, render: (r) => <b style={{ color: r.overdue > 0 ? 'var(--red)' : undefined }}>{money(r.overdue)}</b> },
      { key: 'avgDelay', label: 'Retard moyen', right: true, render: (r) => `${Math.round(r.avgDelay)} j` },
      { key: 'score', label: 'Score risque', render: (r) => <div style={{ minWidth: 120 }}><div className="row small"><b>{r.score}</b><span className="spacer" /><Badge>{r.level}</Badge></div><Progress value={r.score / 100} color={r.score >= 60 ? COLORS.red : r.score >= 30 ? COLORS.amber : COLORS.green} /></div> },
      { key: 'act', label: '', noSort: true, noExport: true, render: (r) => r.overdue > 0 && <button className="btn sm" onClick={(e) => { e.stopPropagation(); ss.set('liya-write', JSON.stringify({ kind: 'relance', id: r.client.id })); go('ai', 'write') }}><Icon name="mail" size={13} />Relance IA</button> },
    ]} />
  )
}

function Anomalies() {
  const { db } = useStore()
  const rows = useMemo(() => anomalies(db).map((a, i) => ({ id: i, ...a })), [db])
  return (
    <DataTable rows={rows} exportName="anomalies" empty="Aucune anomalie détectée." filters={[{ key: 'severity', label: 'Gravité', options: ['Haute', 'Moyenne', 'Basse'] }, { key: 'title', label: 'Type', options: [...new Set(rows.map((r) => r.title))] }]}
      onRowClick={() => go('sales', 'facture')}
      columns={[
        { key: 'severity', label: 'Gravité', render: (r) => <Badge>{r.severity}</Badge> },
        { key: 'title', label: 'Anomalie', strong: true },
        { key: 'text', label: 'Détail' },
        { key: 'date', label: 'Date', sort: (r) => r.doc.date, render: (r) => fdate(r.doc.date) },
      ]} />
  )
}

// ---------- Rédaction IA ----------
const WRITE_KINDS = [
  ['relance', 'Relance de paiement', 'client'],
  ['memoire', 'Mémoire technique d\'appel d\'offres', 'tender'],
  ['fiche', 'Fiche produit commerciale', 'product'],
  ['cotation', 'Demande de cotation fournisseur', 'supplier'],
  ['offre', 'E-mail d\'accompagnement de devis', 'quote'],
]

function localDraft(db, kind, id) {
  const co = db.settings.company
  const sign = `\n\nCordialement,\n\n${db.settings.user.name}\n${db.settings.user.role} — ${co.name}\n${co.phone} · ${co.email}\n${co.tagline}`
  if (kind === 'relance') {
    const c = db.clients.find((x) => x.id === id)
    const r = clientRisk(db).find((x) => x.client.id === id)
    const inv = db.documents.filter((d) => d.type === 'facture' && d.partyId === id && d.status === 'Validée' && d.dueDate < TODAY).filter((d) => docTotals(d).ttc - db.payments.filter((p) => p.docId === d.id).reduce((s, p) => s + p.amount, 0) > 1).slice(0, 8)
    return `Objet : Relance — factures échues (${money(r?.overdue)})\n\nMadame, Monsieur,\n\nSauf erreur de notre part, les factures suivantes adressées à ${c.name} restent à ce jour impayées :\n\n${inv.map((d) => `• ${d.number} du ${fdate(d.date)} — échéance ${fdate(d.dueDate)} — ${money(docTotals(d).ttc)} TTC (${daysBetween(d.dueDate, TODAY)} jours de retard)`).join('\n')}\n\nMontant total échu : ${money(r?.overdue)}.\n\nNous vous serions reconnaissants de bien vouloir procéder à leur règlement par virement sur notre compte ${co.bank}, ou de nous indiquer la date prévisionnelle de paiement${c.public ? ' (référence d\'ordonnancement / mandat)' : ''}.\n\nNous restons à votre disposition pour tout justificatif complémentaire (bons de livraison signés, PV de réception).${sign}`
  }
  if (kind === 'memoire') {
    const t = db.tenders.find((x) => x.id === id)
    const s = tenderScore(db, t)
    const prods = db.products.filter((p) => s.cats.includes(p.category) && p.kind === 'equip')
    return `MÉMOIRE TECHNIQUE — ${t.ref}\nMaître d'ouvrage : ${t.buyer}\nObjet : ${t.object}\nSoumissionnaire : ${co.name}\n\n1. PRÉSENTATION DU SOUMISSIONNAIRE\n${co.name}, capital ${co.capital}, ${co.rc}, ICE ${co.ice}. ${co.ammps}. Siège et showroom : ${co.address}. Équipe biomédicale interne assurant installation, formation et maintenance sur l'ensemble du territoire.\n\n2. MATÉRIEL PROPOSÉ\n${(prods.length ? prods : db.products.filter((p) => p.kind === 'equip').slice(0, 2)).map((p) => `• ${p.name} — fabricant ${db.suppliers.find((x) => x.id === p.supplierId)?.name} — DM classe ${p.dmClass}, marquage CE, ${p.ammps} — garantie ${p.warrantyMonths} mois`).join('\n')}\n\n3. CONFORMITÉ AUX SPÉCIFICATIONS DU CPS\nUn tableau « Exigence du CPS | Réponse LIYA HEALTH | Conforme » est fourni pour chaque article, accompagné des fiches techniques et certificats (CE, ISO 13485).\n\n4. DÉLAIS ET LOGISTIQUE\nLivraison sous 45 à 60 jours après notification de l'ordre de service ; installation et mise en service sous 7 jours après livraison ; PV de réception provisoire.\n\n5. FORMATION\nFormation des utilisateurs (médecins, infirmiers) et des techniciens biomédicaux sur site, avec attestations et supports en français.\n\n6. SERVICE APRÈS-VENTE\nIntervention sous 24 à 48 h ouvrées, maintenance préventive selon les recommandations constructeur, stock de pièces détachées à Casablanca, hotline technique.\n\n7. GARANTIE\nGarantie pièces et main-d'œuvre de 24 mois à compter de la réception provisoire, extensible par contrat.\n\nFait à Casablanca, le ${fdate(TODAY)}\nLe gérant, ${co.manager}`
  }
  if (kind === 'fiche') {
    const p = db.products.find((x) => x.id === id)
    const sup = db.suppliers.find((x) => x.id === p.supplierId)
    return `${p.name.toUpperCase()}\nRéf. ${p.ref} · Fabricant : ${sup?.name} (${sup?.country})\n\nPrésentation\n${p.name} : solution ${p.category.toLowerCase()} fiable et ergonomique, conçue pour un usage intensif en milieu hospitalier marocain (CHU, cliniques, urgences).\n\nPoints forts\n• Dispositif médical de classe ${p.dmClass}, marquage CE, enregistré AMMPS (${p.ammps})\n• Prise en main rapide, interface en français\n• ${p.kind === 'equip' ? `Garantie ${p.warrantyMonths} mois, installation et formation incluses` : 'Disponible en stock à Casablanca, livraison rapide'}\n• SAV local LIYA HEALTH : techniciens biomédicaux certifiés\n\nConditions\nPrix public HT : ${money(p.price)} — TVA ${p.tva} %\n\n${co.name} — ${co.tagline}`
  }
  if (kind === 'cotation') {
    const s = db.suppliers.find((x) => x.id === id)
    const plan = reorderPlan(db).filter((r) => r.product.supplierId === id)
    return `Subject: Request for quotation — ${co.name} (Morocco)\n\nDear ${s.contact},\n\nPlease send us your best CIP Casablanca offer for the following items:\n\n${plan.map((r) => `• ${r.product.ref} — ${r.product.name} — qty ${Math.max(r.qty, r.product.minStock)}`).join('\n')}\n\nPlease include: unit price (${s.currency}), production lead time, shelf life for consumables, CE certificate and ISO 13485 certificate validity, and the manufacturer authorization letter for public tenders.\n\nBest regards,\n\n${db.settings.user.name}\n${co.name} — ${co.address}`
  }
  const d = db.documents.find((x) => x.id === id)
  const c = db.clients.find((x) => x.id === d.partyId)
  return `Objet : Notre offre ${d.number}\n\nMadame, Monsieur,\n\nSuite à votre demande, nous avons le plaisir de vous transmettre notre offre n° ${d.number} d'un montant de ${money(docTotals(d).ttc)} TTC pour ${c.name}.\n\nElle comprend :\n${d.lines.map((l) => `• ${l.qty} × ${l.label}`).join('\n')}\n\nLivraison, installation, mise en service et formation de vos équipes sont incluses. Notre service biomédical reste à votre disposition pour une démonstration sur site.\n\nCette offre est valable jusqu'au ${fdate(d.dueDate)}.${sign}`
}

function Writer() {
  const { db } = useStore()
  const preset = useMemo(() => { try { const x = JSON.parse(ss.get('liya-write') || 'null'); ss.del('liya-write'); return x } catch { return null } }, [])
  const [kind, setKind] = useState(preset?.kind || 'relance')
  const target = WRITE_KINDS.find((k) => k[0] === kind)[2]
  const options = target === 'client' ? clientRisk(db).filter((r) => r.overdue > 0).map((r) => [r.client.id, `${r.client.name} — échu ${moneyK(r.overdue)}`])
    : target === 'tender' ? db.tenders.filter((t) => !['Gagné', 'Perdu'].includes(t.status)).map((t) => [t.id, `${t.ref} — ${t.buyer}`])
    : target === 'product' ? db.products.map((p) => [p.id, p.name])
    : target === 'supplier' ? db.suppliers.map((s) => [s.id, s.name])
    : db.documents.filter((d) => d.type === 'devis').map((d) => [d.id, `${d.number} — ${db.clients.find((c) => c.id === d.partyId)?.name}`])
  const [id, setId] = useState(preset?.id || options[0]?.[0])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const online = aiConfigured(db.settings.ai)

  useEffect(() => { if (!options.some((o) => o[0] === id)) setId(options[0]?.[0]) }, [kind]) // eslint-disable-line

  const generate = async () => {
    if (!id) return
    const draft = localDraft(db, kind, id)
    if (!online) { setText(draft); setNote('Brouillon généré par le moteur local (modèle structuré). Connectez Claude pour une rédaction personnalisée.'); return }
    setBusy(true); setText(''); setNote('')
    try {
      let acc = ''
      const label = WRITE_KINDS.find((k) => k[0] === kind)[1]
      await askClaude({ ai: db.settings.ai, db, messages: [], task: `Rédige un(e) « ${label} » prêt(e) à envoyer, au nom de LIYA HEALTH. Base-toi sur ce brouillon factuel (ne change pas les chiffres, améliore le style, la structure et la persuasion, garde la langue du brouillon) :\n\n${draft}`, onText: (t) => { acc += t; setText(acc) } })
      setNote('Rédigé par Claude à partir des données de l\'ERP. Relisez avant envoi.')
    } catch (e) { setText(draft); setNote(explainError(e) + ' — brouillon local affiché.') }
    setBusy(false)
  }

  return (
    <div className="grid g3">
      <Card title="Paramètres" icon="edit">
        <div className="stack" style={{ gap: 14 }}>
          <Field label="Type de document"><select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>{WRITE_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Concerne"><select className="input" value={id || ''} onChange={(e) => setId(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <button className="btn ai" onClick={generate} disabled={busy || !id}><Icon name="sparkles" size={15} />{busy ? 'Rédaction…' : 'Générer'}</button>
          {note && <div className="muted small">{note}</div>}
        </div>
      </Card>
      <Card title="Document" icon="file" className="span2" action={text && <><button className="btn sm" onClick={() => navigator.clipboard?.writeText(text)}><Icon name="copy" size={13} />Copier</button><a className="btn sm" href={`mailto:?body=${encodeURIComponent(text.slice(0, 1800))}`}><Icon name="mail" size={13} />E-mail</a></>}>
        <textarea className="input" style={{ minHeight: 460, fontFamily: 'inherit', lineHeight: 1.6 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Choisissez un type de document puis cliquez sur « Générer »." />
      </Card>
    </div>
  )
}
