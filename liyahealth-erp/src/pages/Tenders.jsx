import { ss } from '../lib/nav.js'
import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { go } from '../lib/nav.js'
import { PageHead, Kpi, Badge, Tabs, Modal, Icon, Progress, Card } from '../components/ui.jsx'
import CrudPage from '../components/CrudPage.jsx'
import { tenderScore } from '../ai/engine.js'
import { money, moneyK, fdate, daysBetween, TODAY, pct, int } from '../lib/domain.js'

const STATUSES = ['Veille', 'En préparation AO', 'Déposé', 'Gagné', 'Perdu']
const PIECES = [
  'Déclaration sur l\'honneur', 'Caution provisoire BANK OF AFRICA', 'Attestation CNSS', 'Attestation fiscale', 'Registre de commerce (modèle 7)',
  'Fiches techniques', 'Certificats CE / ISO 13485', 'Autorisation du fabricant', 'Enregistrement AMMPS',
]
const scoreColor = (s) => (s >= 65 ? 'var(--green)' : s >= 45 ? 'var(--amber)' : 'var(--red)')

function Ring({ score, size = 46 }) {
  const r = 18, c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox="0 0 44 44">
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--soft)" strokeWidth="5" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={scoreColor(score)} strokeWidth="5" strokeDasharray={`${(score / 100) * c} ${c}`} strokeLinecap="round" transform="rotate(-90 22 22)" />
      <text x="22" y="26" textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, fill: 'var(--text)' }}>{score}</text>
    </svg>
  )
}

const FIELDS = [
  { key: 'ref', label: 'Référence AO' },
  { key: 'buyer', label: 'Maître d\'ouvrage' },
  { key: 'object', label: 'Objet', type: 'textarea' },
  { key: 'estimate', label: 'Estimation administrative (DH TTC)', type: 'number' },
  { key: 'ourBid', label: 'Notre offre (DH TTC)', type: 'number' },
  { key: 'status', label: 'Statut', type: 'select', options: STATUSES, placeholder: false },
  { key: 'deadline', label: 'Date limite de dépôt', type: 'date' },
  { key: 'caution', label: 'Caution provisoire (DH)', type: 'number' },
  { key: 'probability', label: 'Probabilité (0 à 1)', type: 'number', step: 0.05 },
  { key: 'owner', label: 'Responsable' },
  { key: 'portal', label: 'Portail / mode de dépôt' },
  { key: 'lots', label: 'Nombre de lots', type: 'number' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
]

export default function Tenders() {
  const { db, update, toast } = useStore()
  const [tab, setTab] = useState('pipeline')
  const [sel, setSel] = useState(null)
  const scores = useMemo(() => Object.fromEntries(db.tenders.map((t) => [t.id, tenderScore(db, t)])), [db])
  const current = sel && db.tenders.find((t) => t.id === sel)

  const active = db.tenders.filter((t) => ['Veille', 'En préparation AO', 'Déposé'].includes(t.status))
  const submitted = db.tenders.filter((t) => ['Déposé', 'Gagné', 'Perdu'].includes(t.status))
  const won = db.tenders.filter((t) => t.status === 'Gagné').length
  const closed = db.tenders.filter((t) => ['Gagné', 'Perdu'].includes(t.status)).length
  const cautions = db.tenders.filter((t) => ['En préparation AO', 'Déposé'].includes(t.status)).reduce((s, t) => s + Number(t.caution || 0), 0)

  const toggle = (t, p) => {
    const cl = { ...(t.checklist || {}), [p]: !(t.checklist || {})[p] }
    update('tenders', t.id, { checklist: cl })
  }

  const card = (t) => {
    const s = scores[t.id]
    const days = daysBetween(TODAY, t.deadline)
    return (
      <div key={t.id} className="kcard" onClick={() => setSel(t.id)}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{t.ref}</div>
            <div className="muted small">{t.buyer}</div>
          </div>
          <Ring score={s.score} size={42} />
        </div>
        <div className="small" style={{ margin: '8px 0' }}>{t.object}</div>
        <div className="row small"><b className="num">{moneyK(t.estimate)}</b><span className="spacer" />
          <span style={{ color: days >= 0 && days <= 7 ? 'var(--red)' : 'var(--muted)', fontWeight: 600 }}><Icon name="clock" size={12} /> {days >= 0 ? `J-${days}` : fdate(t.deadline)}</span>
        </div>
        <div className="small" style={{ marginTop: 6, color: scoreColor(s.score), fontWeight: 600 }}>IA : {s.recommendation}</div>
      </div>
    )
  }

  const upcoming = db.tenders.filter((t) => daysBetween(TODAY, t.deadline) >= 0).sort((a, b) => a.deadline.localeCompare(b.deadline))

  return (
    <div className="stack">
      <PageHead title="Appels d'offres" sub="Veille marchés publics, préparation des dossiers, cautions et échéances" crumbs="Commercial › Appels d'offres">
        <button className="btn ai" onClick={() => { ss.set('liya-write', JSON.stringify({ kind: 'memoire' })); go('ai', 'write') }}><Icon name="sparkles" size={15} />Rédiger avec LIYA IA</button>
      </PageHead>
      <div className="grid g4">
        <Kpi label="AO en cours" value={int(active.length)} icon="gavel" color="amber" foot={moneyK(active.reduce((s, t) => s + t.estimate, 0)) + ' estimés'} />
        <Kpi label="Montant soumis" value={moneyK(submitted.reduce((s, t) => s + Number(t.ourBid || 0), 0))} icon="file" color="blue" foot={`${submitted.length} offre(s) déposée(s)`} />
        <Kpi label="Taux de réussite" value={pct(won / Math.max(closed, 1), 0)} icon="check" color="green" foot={`${won} gagné(s) sur ${closed}`} />
        <Kpi label="Cautions engagées" value={moneyK(cautions)} icon="wallet" color="violet" foot="BANK OF AFRICA — Casa Marina" />
      </div>
      <Tabs tabs={[['pipeline', 'Pipeline'], ['list', 'Liste'], ['calendar', 'Calendrier']]} value={tab} onChange={setTab} />
      {tab === 'pipeline' && (
        <div className="kanban">
          {STATUSES.map((st) => {
            const items = db.tenders.filter((t) => t.status === st)
            return (
              <div key={st} className="kcol">
                <div className="kcol-h"><Badge>{st}</Badge><span className="spacer" /><span className="muted small">{items.length} · {moneyK(items.reduce((s, t) => s + t.estimate, 0))}</span></div>
                {items.map(card)}
              </div>
            )
          })}
        </div>
      )}
      {tab === 'list' && (
        <CrudPage col="tenders" entity="Appel d'offres" fields={FIELDS}
          defaults={{ status: 'Veille', deadline: TODAY, probability: 0.4, owner: 'Nadia El Fassi', portal: 'marchespublics.gov.ma', lots: 1 }}
          searchKeys={['ref', 'buyer', 'object']}
          filters={[{ key: 'status', label: 'Statut', options: STATUSES }]}
          validate={(t) => (!t.ref || !t.buyer ? 'Référence et maître d\'ouvrage obligatoires' : null)}
          columns={[
            { key: 'ref', label: 'Référence', strong: true },
            { key: 'buyer', label: 'Acheteur' },
            { key: 'object', label: 'Objet', render: (t) => <span className="small">{t.object}</span> },
            { key: 'estimate', label: 'Estimation', right: true, render: (t) => money(t.estimate) },
            { key: 'deadline', label: 'Limite', render: (t) => fdate(t.deadline) },
            { key: 'status', label: 'Statut', render: (t) => <Badge>{t.status}</Badge> },
            { key: 'score', label: 'Score IA', right: true, sort: (t) => scores[t.id]?.score || 0, render: (t) => <b style={{ color: scoreColor(scores[t.id]?.score || 0) }}>{scores[t.id]?.score ?? '—'}</b> },
          ]} />
      )}
      {tab === 'calendar' && (
        <Card title="Échéances à venir" icon="calendar" pad={false}>
          {upcoming.map((t) => {
            const d = daysBetween(TODAY, t.deadline)
            return (
              <div key={t.id} className="row" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setSel(t.id)}>
                <div style={{ width: 64, textAlign: 'center', fontWeight: 800, fontSize: 18, color: d <= 7 ? 'var(--red)' : 'var(--teal)' }}>J-{d}</div>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{t.ref} — {t.buyer}</div><div className="muted small">{t.object} · dépôt le {fdate(t.deadline)}</div></div>
                <Badge>{t.status}</Badge>
              </div>
            )
          })}
          {!upcoming.length && <div className="empty">Aucune échéance à venir.</div>}
        </Card>
      )}
      {current && (() => {
        const s = scores[current.id]
        const cl = current.checklist || {}
        const done = PIECES.filter((p) => cl[p]).length
        return (
          <Modal size="xl" title={`${current.ref} — ${current.buyer}`} onClose={() => setSel(null)}
            footer={<><button className="btn" onClick={() => setSel(null)}>Fermer</button><button className="btn ai" onClick={() => { ss.set('liya-write', JSON.stringify({ kind: 'memoire', id: sel.id })); setSel(null); go('ai', 'write') }}><Icon name="sparkles" size={15} />Préparer la réponse avec LIYA IA</button></>}>
            <div className="stack">
              <div className="muted">{current.object}</div>
              <div className="grid g4">
                <Kpi label="Estimation" value={moneyK(current.estimate)} icon="money" color="navy" />
                <Kpi label="Notre offre" value={current.ourBid ? moneyK(current.ourBid) : '—'} icon="file" color="blue" foot={current.ourBid ? `${pct(current.ourBid / current.estimate - 1)} vs estimation` : 'À chiffrer'} />
                <Kpi label="Caution provisoire" value={money(current.caution)} icon="wallet" color="violet" />
                <Kpi label="Date limite" value={fdate(current.deadline)} icon="calendar" color="amber" />
              </div>
              <div className="grid g2">
                <Card title="Analyse LIYA IA" icon="sparkles" action={<Ring score={s.score} />}>
                  <div style={{ fontWeight: 700, color: scoreColor(s.score), marginBottom: 12 }}>Recommandation : {s.recommendation}</div>
                  <div className="stack" style={{ gap: 12 }}>
                    {s.factors.map((f) => (
                      <div key={f.label}>
                        <div className="row small"><b>{f.label}</b><span className="spacer" /><span className="muted">{Math.round(f.value * 100)} % · poids {f.weight}</span></div>
                        <Progress value={f.value} color={scoreColor(f.value * 100)} />
                        <div className="muted small" style={{ marginTop: 3 }}>{f.note}</div>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card title={`Pièces du dossier (${done}/${PIECES.length})`} icon="file">
                  <Progress value={done / PIECES.length} />
                  <div className="stack" style={{ gap: 8, marginTop: 12 }}>
                    {PIECES.map((p) => (
                      <label key={p} className="row" style={{ cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!cl[p]} onChange={() => toggle(current, p)} />
                        <span style={{ textDecoration: cl[p] ? 'line-through' : 'none', color: cl[p] ? 'var(--muted)' : 'inherit' }}>{p}</span>
                      </label>
                    ))}
                  </div>
                  <div className="row" style={{ marginTop: 14 }}>
                    <span className="muted small">Statut</span>
                    <select className="input" style={{ width: 'auto' }} value={current.status} onChange={(e) => { update('tenders', current.id, { status: e.target.value }); toast(`Statut : ${e.target.value}`) }}>
                      {STATUSES.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                </Card>
              </div>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}
