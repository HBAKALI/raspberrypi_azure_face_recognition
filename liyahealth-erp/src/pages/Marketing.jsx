import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { go, useRoute } from '../lib/nav.js'
import { Badge, Card, DataTable, Field, Icon, Kpi, Modal, PageHead, Tabs, Seg, Progress } from '../components/ui.jsx'
import { TODAY, addDays, fdate, int, pct, uid } from '../lib/domain.js'
import { clientRisk } from '../ai/engine.js'
import { aiConfigured, askClaude, explainError } from '../ai/claude.js'

const CHANNELS = ['E-mail', 'WhatsApp', 'SMS']
const CH_COLOR = { 'E-mail': 'blue', WhatsApp: 'green', SMS: 'violet' }
const SEGMENTS = ['Tous les clients', 'CHU & hôpitaux publics', 'Cliniques privées', 'Clients inactifs depuis 90 jours', 'Clients avec impayés', 'Prospects qualifiés']
const ST_COLOR = { Brouillon: 'gray', Planifiée: 'amber', Envoyée: 'green' }
const RULES = [
  ['quoteFollowup', 'Relance devis J+7', 'E-mail automatique 7 jours après l\'envoi d\'un devis resté sans réponse.'],
  ['maintenanceReminder', 'Rappel maintenance J-15', 'WhatsApp au service biomédical 15 jours avant une maintenance préventive.'],
  ['contractAnniversary', 'Anniversaire de contrat', 'Proposition de renouvellement 60 jours avant la fin d\'un contrat.'],
  ['expiryPromo', 'Écoulement lots courts', 'Offre ciblée aux clients consommateurs quand un lot approche de sa péremption.'],
]

// Destinataires d'un segment, au format commun { id, nom, ville, contact, phone, email }
export function segmentRecipients(db, segment) {
  const fromClient = (c) => ({ id: c.id, nom: c.name, ville: c.city, contact: c.contact, phone: c.phone, email: c.email })
  const lastInvoice = (id) => db.documents.filter((d) => d.type === 'facture' && d.partyId === id).map((d) => d.date).sort().at(-1)
  switch (segment) {
    case 'CHU & hôpitaux publics': return db.clients.filter((c) => c.public || ['CHU', 'Hôpital public'].includes(c.type)).map(fromClient)
    case 'Cliniques privées': return db.clients.filter((c) => c.type === 'Clinique privée').map(fromClient)
    case 'Clients inactifs depuis 90 jours': return db.clients.filter((c) => { const l = lastInvoice(c.id); return !l || l < addDays(TODAY, -90) }).map(fromClient)
    case 'Clients avec impayés': { const ids = new Set(clientRisk(db).filter((r) => r.overdue > 1).map((r) => r.client.id)); return db.clients.filter((c) => ids.has(c.id)).map(fromClient) }
    case 'Prospects qualifiés': return db.leads.filter((l) => l.status === 'Qualifié').map((l) => ({ id: l.id, nom: l.company, ville: l.city, contact: l.contact, phone: l.phone, email: l.email }))
    default: return db.clients.map(fromClient)
  }
}
const fill = (txt, r) => (txt || '').replaceAll('{nom}', r?.nom || '').replaceAll('{ville}', r?.ville || '').replaceAll('{contact}', r?.contact || '')
const digits = (p) => (p || '').replace(/\D/g, '')

function localTemplate(db, channel, segment) {
  const co = db.settings.company
  if (segment === 'Clients avec impayés') return { subject: 'Point sur vos factures en attente', body: `Bonjour {contact},\n\nNous nous permettons de revenir vers {nom} au sujet de quelques factures arrivées à échéance. Notre service comptable reste à votre disposition pour transmettre les justificatifs (BL signés, PV de réception) et faciliter l'ordonnancement.\n\nMerci pour votre confiance.\n${co.name} — ${co.tagline}` }
  if (segment === 'Clients inactifs depuis 90 jours') return { subject: 'Vos consommables et accessoires disponibles à Casablanca', body: `Bonjour {contact},\n\nCela fait quelque temps que nous n'avons pas eu le plaisir de servir {nom}. Nos consommables (électrodes ECG, capteurs SpO2, circuits patient, filtres HME) sont disponibles en stock à Casablanca, avec livraison sous 48 h à {ville}.\n\nRépondez simplement à ce message pour recevoir une offre personnalisée.\n\n${co.name} — ${co.tagline}` }
  if (channel !== 'E-mail') return { subject: '', body: `Bonjour {contact}, ici ${co.name}. Nous organisons des démonstrations de nos nouveaux équipements (monitorage Comen, échographie ZONCARE) à {ville}. Souhaitez-vous un créneau pour {nom} ? Répondez OUI et nous vous rappelons.` }
  return { subject: 'Démonstration gratuite de nos nouveaux équipements', body: `Bonjour {contact},\n\n${co.name} présente ses nouveautés pour {nom} : moniteurs multiparamétriques Comen, échographes ZONCARE et solutions de désinfection UV-C, avec installation, formation et SAV biomédical local.\n\nNous proposons une démonstration sur site à {ville}, sans engagement. Quel créneau vous conviendrait ?\n\nCordialement,\n${db.settings.user.name}\n${co.name} — ${co.phone}\n${co.tagline}` }
}

export default function Marketing() {
  const { tab } = useRoute()
  const t = tab === 'new' ? 'new' : 'campaigns'
  return (
    <div className="stack">
      <PageHead title="Marketing" sub="Campagnes e-mail et WhatsApp ciblées, rédigées avec LIYA IA." crumbs="Commercial › Marketing">
        {t === 'campaigns' && <button className="btn primary" onClick={() => go('marketing', 'new')}><Icon name="plus" size={15} />Nouvelle campagne</button>}
      </PageHead>
      <Tabs tabs={[['campaigns', 'Campagnes'], ['new', 'Nouvelle campagne']]} value={t} onChange={(x) => go('marketing', x === 'campaigns' ? '' : x)} />
      {t === 'campaigns' ? <Campaigns /> : <Wizard />}
    </div>
  )
}

function Campaigns() {
  const { db, setSettings, toast } = useStore()
  const [view, setView] = useState(null)
  const sent = db.campaigns.filter((c) => c.status === 'Envoyée')
  const recip = sent.reduce((s, c) => s + Number(c.recipients || 0), 0)
  const opens = sent.reduce((s, c) => s + Number(c.opens || 0), 0)
  const rules = db.settings.marketingRules || {}
  return (
    <>
      <div className="grid g4">
        <Kpi label="Campagnes" value={int(db.campaigns.length)} icon="megaphone" color="red" />
        <Kpi label="Envoyées" value={int(sent.length)} icon="send" color="green" />
        <Kpi label="Destinataires touchés" value={int(recip)} icon="users" color="blue" />
        <Kpi label="Taux d'ouverture moyen" value={pct(opens / Math.max(recip, 1), 0)} icon="eye" color="violet" foot="E-mails suivis uniquement" />
      </div>
      <div className="grid g3">
        <div className="span2">
          <DataTable rows={db.campaigns} exportName="campagnes" onRowClick={setView}
            filters={[{ key: 'channel', label: 'Canal', options: CHANNELS }, { key: 'status', label: 'Statut', options: ['Brouillon', 'Planifiée', 'Envoyée'] }]}
            columns={[
              { key: 'name', label: 'Campagne', strong: true },
              { key: 'channel', label: 'Canal', render: (c) => <Badge color={CH_COLOR[c.channel]}>{c.channel}</Badge> },
              { key: 'segment', label: 'Segment' },
              { key: 'status', label: 'Statut', render: (c) => <Badge color={ST_COLOR[c.status]}>{c.status}</Badge> },
              { key: 'sentAt', label: 'Date', render: (c) => fdate(c.sentAt) },
              { key: 'recipients', label: 'Dest.', right: true },
              { key: 'opens', label: 'Ouv.', right: true },
              { key: 'clicks', label: 'Clics', right: true },
              { key: 'rate', label: 'Taux ouv.', right: true, sort: (c) => (c.opens || 0) / Math.max(c.recipients || 0, 1), render: (c) => (c.status === 'Envoyée' && c.channel === 'E-mail' ? pct((c.opens || 0) / Math.max(c.recipients, 1), 0) : '—') },
            ]} />
        </div>
        <Card title="Automatisations" icon="repeat">
          <div className="stack" style={{ gap: 14 }}>
            {RULES.map(([k, title, desc]) => (
              <div key={k} className="row" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}><b>{title}</b><div className="muted small" style={{ marginTop: 2 }}>{desc}</div></div>
                <label className="switch"><input type="checkbox" checked={!!rules[k]} onChange={(e) => { setSettings({ marketingRules: { ...rules, [k]: e.target.checked } }); toast(`${title} : ${e.target.checked ? 'activée' : 'désactivée'}`) }} /><span /></label>
              </div>
            ))}
            <div className="muted small">Les règles actives génèrent des suggestions d'envoi ; l'envoi reste validé par un utilisateur.</div>
          </div>
        </Card>
      </div>
      {view && (
        <Modal title={view.name} onClose={() => setView(null)} footer={<button className="btn primary" onClick={() => setView(null)}>Fermer</button>}>
          <div className="row wrap" style={{ marginBottom: 12 }}><Badge color={CH_COLOR[view.channel]}>{view.channel}</Badge><Badge color={ST_COLOR[view.status]}>{view.status}</Badge><span className="muted small">{view.segment} · {view.recipients} destinataires · {fdate(view.sentAt)}</span></div>
          {view.subject && <div><b>Objet :</b> {view.subject}</div>}
          <div className="msg assistant" style={{ maxWidth: '100%', marginTop: 10 }}>{view.body || 'Contenu non enregistré.'}</div>
          {view.status === 'Envoyée' && view.channel === 'E-mail' && <div style={{ marginTop: 14 }}><div className="row small"><span>Taux d'ouverture</span><span className="spacer" /><b>{pct((view.opens || 0) / Math.max(view.recipients, 1), 0)}</b></div><Progress value={(view.opens || 0) / Math.max(view.recipients, 1)} /></div>}
        </Modal>
      )}
    </>
  )
}

function Wizard() {
  const { db, add, toast, log } = useStore()
  const [step, setStep] = useState(1)
  const [c, setC] = useState({ channel: 'E-mail', name: '', segment: 'Tous les clients', subject: '', body: '', date: addDays(TODAY, 1) })
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState(null)
  const recipients = useMemo(() => segmentRecipients(db, c.segment), [db, c.segment])
  const first = recipients[0]
  const set = (k, v) => setC({ ...c, [k]: v })

  const draftAI = async () => {
    const tpl = localTemplate(db, c.channel, c.segment)
    if (!aiConfigured(db.settings.ai)) { setC({ ...c, ...tpl }); toast('Modèle local appliqué (Claude non connecté)'); return }
    setBusy(true)
    try {
      let acc = ''
      const task = `Rédige une campagne ${c.channel} pour LIYA HEALTH, segment « ${c.segment} »${c.name ? `, thème « ${c.name} »` : ''}. ${c.channel === 'E-mail' ? 'Première ligne : « Objet : … », puis le corps.' : 'Message court (max 600 caractères), sans objet.'} Utilise les variables {nom}, {ville}, {contact}. Ton professionnel, adapté aux établissements de santé marocains. Réponds uniquement avec le message.`
      await askClaude({ ai: db.settings.ai, db, messages: [], task, onText: (t) => { acc += t; set('body', acc) } })
      const m = acc.match(/^\s*Objet\s*:\s*(.+)\n+/i)
      setC((x) => ({ ...x, subject: m ? m[1].trim() : x.subject, body: m ? acc.slice(m[0].length) : acc }))
    } catch (e) { setC({ ...c, ...tpl }); toast(explainError(e)) }
    setBusy(false)
  }

  const finish = (now) => {
    if (!c.name) return toast('Donnez un nom à la campagne')
    if (!c.body) return toast('Le message est vide')
    add('campaigns', { id: uid(), name: c.name, channel: c.channel, segment: c.segment, subject: c.subject, body: c.body, status: now ? 'Envoyée' : 'Planifiée', sentAt: now ? TODAY : c.date, recipients: recipients.length, opens: 0, clicks: 0 })
    log(`Campagne ${now ? 'envoyée' : 'planifiée'} : ${c.name} (${recipients.length} destinataires)`, 'megaphone')
    if (now) setOut(recipients)
    else { toast(`Campagne planifiée le ${fdate(c.date)}`); go('marketing') }
  }

  const links = (r) => {
    const body = fill(c.body, r)
    if (c.channel === 'E-mail') return { href: `mailto:${r.email || ''}?subject=${encodeURIComponent(fill(c.subject, r))}&body=${encodeURIComponent(body)}`, label: 'Ouvrir l\'e-mail', ok: !!r.email }
    if (c.channel === 'SMS') return { href: `sms:${digits(r.phone)}?body=${encodeURIComponent(body)}`, label: 'Ouvrir le SMS', ok: !!digits(r.phone) }
    return { href: `https://wa.me/${digits(r.phone)}?text=${encodeURIComponent(body)}`, label: 'Ouvrir dans WhatsApp', ok: !!digits(r.phone) }
  }
  const copyAll = () => {
    const txt = recipients.map((r) => `${r.nom} — ${c.channel === 'E-mail' ? r.email : r.phone}\n${fill(c.body, r)}`).join('\n\n----\n\n')
    navigator.clipboard?.writeText(txt).then(() => toast('Messages copiés'), () => toast('Copie impossible dans ce navigateur'))
  }

  const steps = ['Canal', 'Segment', 'Message', 'Envoi']
  return (
    <div className="grid g3">
      <Card className="span2" title={`Étape ${step} / 4 — ${steps[step - 1]}`} icon="megaphone">
        <div className="row" style={{ gap: 6, marginBottom: 18 }}>{steps.map((s, i) => <div key={s} style={{ flex: 1 }}><Progress value={step > i ? 1 : 0} color={step > i ? 'var(--teal)' : undefined} /><div className="small muted" style={{ marginTop: 4 }}>{i + 1}. {s}</div></div>)}</div>

        {step === 1 && (
          <div className="stack">
            <Field label="Canal"><Seg options={CHANNELS.map((x) => [x, x])} value={c.channel} onChange={(v) => set('channel', v)} /></Field>
            <Field label="Nom de la campagne"><input className="input" value={c.name} placeholder="Ex. : Démonstrations échographie — printemps" onChange={(e) => set('name', e.target.value)} /></Field>
          </div>
        )}
        {step === 2 && (
          <div className="stack">
            <Field label="Segment"><select className="input" value={c.segment} onChange={(e) => set('segment', e.target.value)}>{SEGMENTS.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <div className="row"><b>{recipients.length} destinataire(s)</b><span className="spacer" /><span className="muted small">{recipients.filter((r) => (c.channel === 'E-mail' ? r.email : digits(r.phone))).length} joignable(s) par {c.channel}</span></div>
            <div className="table-wrap" style={{ maxHeight: 280, border: '1px solid var(--border)', borderRadius: 12 }}>
              <table className="t"><thead><tr><th>Nom</th><th>Ville</th><th>Contact</th><th>{c.channel === 'E-mail' ? 'E-mail' : 'Téléphone'}</th></tr></thead>
                <tbody>{recipients.slice(0, 50).map((r) => <tr key={r.id}><td className="strong">{r.nom}</td><td>{r.ville}</td><td>{r.contact}</td><td>{(c.channel === 'E-mail' ? r.email : r.phone) || <span className="muted">—</span>}</td></tr>)}</tbody></table>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="stack">
            <div className="row wrap"><span className="muted small">Variables : {'{nom}'} {'{ville}'} {'{contact}'}</span><span className="spacer" /><button className="btn ai" disabled={busy} onClick={draftAI}><Icon name="sparkles" size={15} />{busy ? 'Rédaction…' : 'Rédiger avec LIYA IA'}</button></div>
            {c.channel === 'E-mail' && <Field label="Objet"><input className="input" value={c.subject} onChange={(e) => set('subject', e.target.value)} /></Field>}
            <Field label="Message"><textarea className="input" style={{ minHeight: 220, lineHeight: 1.55 }} value={c.body} onChange={(e) => set('body', e.target.value)} /></Field>
            {c.channel !== 'E-mail' && <div className="muted small">{c.body.length} caractères{c.channel === 'SMS' && c.body.length > 160 ? ` · ${Math.ceil(c.body.length / 153)} SMS` : ''}</div>}
          </div>
        )}
        {step === 4 && (
          <div className="stack">
            <div className="grid g3">
              <div><div className="muted small">Canal</div><b>{c.channel}</b></div>
              <div><div className="muted small">Segment</div><b>{c.segment}</b></div>
              <div><div className="muted small">Destinataires</div><b>{recipients.length}</b></div>
            </div>
            <Field label="Date d'envoi planifiée"><input className="input" type="date" value={c.date} onChange={(e) => set('date', e.target.value)} /></Field>
            <div className="insight"><div className="ii" style={{ background: 'var(--soft)' }}><Icon name="alert" size={16} /></div><div className="small muted" style={{ lineHeight: 1.55 }}>Aucun serveur d'envoi automatique n'est connecté. « Envoyer maintenant » prépare un message personnalisé par destinataire : chaque lien ouvre votre application {c.channel === 'E-mail' ? 'de messagerie' : c.channel === 'SMS' ? 'SMS' : 'WhatsApp'} avec le texte prêt, à valider un par un.</div></div>
          </div>
        )}

        <div className="row" style={{ marginTop: 20 }}>
          {step > 1 && <button className="btn" onClick={() => setStep(step - 1)}>Précédent</button>}
          <span className="spacer" />
          {step < 4 && <button className="btn primary" onClick={() => (step === 1 && !c.name ? toast('Donnez un nom à la campagne') : setStep(step + 1))}>Suivant<Icon name="arrowRight" size={14} /></button>}
          {step === 4 && <><button className="btn" onClick={() => finish(false)}><Icon name="calendar" size={15} />Planifier</button><button className="btn primary" onClick={() => finish(true)}><Icon name="send" size={15} />Envoyer maintenant</button></>}
        </div>
      </Card>

      <Card title="Aperçu" icon="eye">
        {first ? <div className="muted small" style={{ marginBottom: 8 }}>Pour : {first.nom} ({first.ville})</div> : <div className="muted small">Aucun destinataire.</div>}
        {c.channel === 'E-mail' && c.subject && <div style={{ fontWeight: 700, marginBottom: 6 }}>{fill(c.subject, first)}</div>}
        <div className="msg assistant" style={{ maxWidth: '100%', background: c.channel === 'WhatsApp' ? '#dcf8c6' : undefined, color: c.channel === 'WhatsApp' ? '#0f1f33' : undefined }}>{fill(c.body, first) || 'Le message apparaîtra ici.'}</div>
      </Card>

      {out && (
        <Modal size="xl" title={`Envoi — ${c.name}`} onClose={() => { setOut(null); go('marketing') }}
          footer={<><button className="btn" onClick={copyAll}><Icon name="copy" size={15} />Copier tous les messages</button><button className="btn primary" onClick={() => { setOut(null); go('marketing') }}>Terminer</button></>}>
          <p className="muted small" style={{ marginTop: 0 }}>Cliquez sur chaque lien pour ouvrir {c.channel === 'E-mail' ? 'votre messagerie' : c.channel} avec le message personnalisé. Aucun envoi n'est fait automatiquement.</p>
          <div className="table-wrap"><table className="t"><thead><tr><th>Destinataire</th><th>Ville</th><th>{c.channel === 'E-mail' ? 'E-mail' : 'Téléphone'}</th><th /></tr></thead>
            <tbody>{out.map((r) => { const l = links(r); return <tr key={r.id}><td className="strong">{r.nom}</td><td>{r.ville}</td><td>{(c.channel === 'E-mail' ? r.email : r.phone) || '—'}</td><td className="right">{l.ok ? <a className="btn sm" href={l.href} target="_blank" rel="noreferrer"><Icon name={c.channel === 'E-mail' ? 'mail' : 'send'} size={13} />{l.label}</a> : <span className="muted small">Coordonnée manquante</span>}</td></tr> })}</tbody></table></div>
        </Modal>
      )}
    </div>
  )
}
