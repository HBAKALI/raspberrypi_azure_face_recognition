import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { go, useRoute } from '../lib/nav.js'
import { Badge, Card, Confirm, DataTable, Field, FormFields, Icon, Modal, PageHead, Tabs, COLORS } from '../components/ui.jsx'
import { GROUPS, MODULES, isModuleOn } from '../lib/modules.js'
import { aiConfigured, askClaude, explainError } from '../ai/claude.js'
import { INVOICE_TEMPLATES, PrintDoc } from '../components/Documents.jsx'
import { imageToDataUrl } from '../lib/image.js'
import { uid } from '../lib/domain.js'

const MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 — recommandé'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 — rapide'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 — économique'],
  ['claude-fable-5-1', 'Claude Fable 5.1 — le plus puissant'],
]
const TABS = [['general', 'Général'], ['modules', 'Modules'], ['integrations', 'Intégrations'], ['security', 'Sécurité'], ['users', 'Utilisateurs'], ['logs', 'Journal'], ['data', 'Données']]

export default function Settings() {
  const { tab } = useRoute()
  const t = TABS.some(([id]) => id === tab) ? tab : tab === 'ai' ? 'integrations' : 'general'
  return (
    <div className="stack">
      <PageHead title="Système & réglages" sub="Société, modules, intégrations, sécurité, utilisateurs et journal d'activité." />
      <Tabs tabs={TABS} value={t} onChange={(x) => go('settings', x)} />
      {t === 'general' && <General />}
      {t === 'modules' && <Modules />}
      {t === 'integrations' && <Integrations />}
      {t === 'security' && <Security />}
      {t === 'users' && <Users />}
      {t === 'logs' && <Logs />}
      {t === 'data' && <Data />}
    </div>
  )
}

function ImagePick({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div className="row" style={{ gap: 12 }}>
        <div style={{ width: 120, height: 64, border: '1px dashed var(--border)', borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', overflow: 'hidden' }}>
          {value ? <img src={value} alt={label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span className="muted small">Aucun</span>}
        </div>
        <label className="btn sm"><Icon name="upload" size={14} />Choisir<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files[0]; if (f) onChange(await imageToDataUrl(f)) }} /></label>
        {value && <button className="btn sm ghost danger" onClick={() => onChange('')}><Icon name="trash" size={14} /></button>}
      </div>
    </Field>
  )
}

function General() {
  const { db, setSettings, toast, log } = useStore()
  const [co, setCo] = useState(db.settings.company)
  const [g, setG] = useState(db.settings.general)
  const [tpl, setTpl] = useState(db.settings.invoiceTemplate)
  const [user, setUser] = useState(db.settings.user)
  const sample = db.documents.find((d) => d.type === 'facture')
  const save = () => { setSettings({ company: co, general: g, invoiceTemplate: tpl, user, onboarding: { ...db.settings.onboarding, templateChosen: true } }); log('Réglages généraux mis à jour', 'settings'); toast('Réglages enregistrés') }
  return (
    <div className="stack">
      <div className="grid g3">
        <Card title="Coordonnées de l'entreprise" className="span2" icon="building">
          <FormFields value={co} onChange={setCo} fields={[
            { key: 'name', label: 'Raison sociale' }, { key: 'tagline', label: 'Signature' },
            { key: 'phone', label: 'Téléphone' }, { key: 'email', label: 'E-mail' },
            { key: 'address', label: 'Adresse', full: true },
            { key: 'rc', label: 'Registre de commerce' }, { key: 'ice', label: 'ICE' },
            { key: 'tp', label: 'Taxe professionnelle' }, { key: 'cnss', label: 'CNSS' },
            { key: 'capital', label: 'Capital' }, { key: 'manager', label: 'Gérant / signataire' },
            { key: 'bank', label: 'Banque', full: true }, { key: 'ammps', label: 'Statut AMMPS', full: true },
          ]} />
        </Card>
        <Card title="Identité visuelle" icon="eye">
          <div className="stack" style={{ gap: 14 }}>
            <ImagePick label="Logo" value={g.logo} onChange={(v) => setG({ ...g, logo: v })} />
            <ImagePick label="Cachet électronique / signature" value={g.stamp} onChange={(v) => setG({ ...g, stamp: v })} />
            <FormFields value={user} onChange={setUser} fields={[{ key: 'name', label: 'Votre nom', full: true }, { key: 'role', label: 'Fonction', full: true }]} />
          </div>
        </Card>
      </div>
      <Card title="Facturation & préférences" icon="file">
        <FormFields value={g} onChange={setG} fields={[
          { key: 'defaultTva', label: 'Taux de TVA par défaut (%)', type: 'select', placeholder: false, options: [['20', '20 %'], ['14', '14 %'], ['10', '10 %'], ['7', '7 %'], ['0', 'Exonéré']] },
          { key: 'currency', label: 'Devise', type: 'select', placeholder: false, options: [['MAD', 'Dirham marocain (DH)'], ['EUR', 'Euro (€)'], ['USD', 'Dollar US ($)']] },
          { key: 'language', label: 'Langue', type: 'select', placeholder: false, options: [['fr', 'Français'], ['en', 'English'], ['ar', 'العربية (bêta)']] },
          { key: 'rib', label: 'RIB (affiché sur les factures)' },
          { key: 'paymentTerms', label: 'Conditions de paiement', type: 'textarea' },
          { key: 'footer', label: 'Pied de page des documents', full: true },
        ]} />
      </Card>
      <Card title="Modèle de facture" icon="printer" action={<button className="btn primary" onClick={save}><Icon name="check" size={15} />Enregistrer les réglages</button>}>
        <div className="grid g3">
          {INVOICE_TEMPLATES.map(([id, label, desc]) => (
            <button key={id} className="card insight" onClick={() => setTpl(id)} style={{ cursor: 'pointer', textAlign: 'left', outline: tpl === id ? '2px solid var(--teal)' : 'none' }}>
              <div className="ii" style={{ background: tpl === id ? 'var(--teal)' : 'var(--soft)', color: tpl === id ? '#fff' : 'var(--muted)' }}><Icon name={tpl === id ? 'check' : 'file'} size={16} /></div>
              <div><b>{label}</b><div className="muted small">{desc}</div></div>
            </button>
          ))}
        </div>
        {sample && <div style={{ marginTop: 16, maxHeight: 520, overflow: 'auto', borderRadius: 12 }}><PrintDoc doc={sample} template={tpl} /></div>}
      </Card>
    </div>
  )
}

function Modules() {
  const { db, setSettings, toast, log } = useStore()
  const toggle = (m, on) => { setSettings({ modules: { ...(db.settings.modules || {}), [m.id]: on } }); log(`Module ${m.label} ${on ? 'activé' : 'désactivé'}`, 'settings'); toast(`${m.label} ${on ? 'activé' : 'désactivé'}`) }
  const active = MODULES.filter((m) => isModuleOn(db.settings, m.id)).length
  return (
    <div className="stack">
      <div className="muted">{active} modules actifs sur {MODULES.length}. Un module désactivé disparaît du menu ; ses données sont conservées. Les modules « LIYA HEALTH » sont spécifiques aux dispositifs médicaux.</div>
      {GROUPS.map((g) => {
        const mods = MODULES.filter((m) => m.group === g)
        if (!mods.length) return null
        return (
          <div key={g}>
            <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', margin: '8px 0 12px' }}>{g}</h3>
            <div className="grid g3">
              {mods.map((m) => {
                const on = isModuleOn(db.settings, m.id)
                const c = m.color === 'ai' ? COLORS.violet : COLORS[m.color] || COLORS.gray
                return (
                  <div key={m.id} className="card module-card" style={{ opacity: on ? 1 : 0.7 }}>
                    <div className="row">
                      <div className="mi" style={{ background: m.color === 'ai' ? 'linear-gradient(135deg,#7b61ff,#13a89e)' : c + '1a', color: m.color === 'ai' ? '#fff' : c }}><Icon name={m.icon} size={20} /></div>
                      <div style={{ flex: 1 }}><b>{m.label}</b><div className="row" style={{ gap: 4, marginTop: 3 }}>{m.core ? <Badge color="gray">Noyau</Badge> : on ? <Badge color="green">Installé</Badge> : <Badge color="gray">Désactivé</Badge>}{m.id === 'ai' && <Badge color="violet">IA</Badge>}</div></div>
                      <label className="switch" title={m.core ? 'Module noyau : ne peut pas être désactivé' : ''}><input type="checkbox" checked={on} disabled={m.core} onChange={(e) => toggle(m, e.target.checked)} /><span /></label>
                    </div>
                    <div className="muted small" style={{ lineHeight: 1.5 }}>{m.desc}</div>
                    {on && <div className="row wrap" style={{ gap: 6 }}>{m.pages.map(([id, label]) => <button key={id} className="btn sm" onClick={() => go(id)}>{label}<Icon name="arrowRight" size={13} /></button>)}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Integrations() {
  const { db, setSettings, toast, log } = useStore()
  const integ = db.settings.integrations || { apiKey: '', webhooks: [] }
  const [hook, setHook] = useState({ url: '', event: 'facture.validée' })
  const genKey = () => { const k = 'lh_live_' + Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => b.toString(16).padStart(2, '0')).join(''); setSettings({ integrations: { ...integ, apiKey: k } }); log('Clé API régénérée', 'key'); toast('Nouvelle clé API générée') }
  const addHook = () => { if (!/^https:\/\//.test(hook.url)) return toast('L\'URL doit commencer par https://'); setSettings({ integrations: { ...integ, webhooks: [...integ.webhooks, { id: uid(), ...hook, active: true }] } }); setHook({ ...hook, url: '' }); toast('Webhook ajouté') }
  return (
    <div className="stack">
      <AiSettings />
      <div className="grid g2">
        <Card title="API LIYA HEALTH ERP" icon="key">
          <p className="muted small" style={{ marginTop: 0 }}>Clé d'accès pour connecter un outil externe (BI, site web, agent Claude ou ChatGPT) afin de créer devis et factures. À brancher sur un backend lors du passage en multi-utilisateurs.</p>
          <div className="row">
            <input className="input" readOnly value={integ.apiKey ? integ.apiKey.slice(0, 14) + '••••••••••••••••' : 'Aucune clé générée'} />
            {integ.apiKey && <button className="btn sm" onClick={() => navigator.clipboard?.writeText(integ.apiKey).then(() => toast('Clé copiée'), () => toast('Copie impossible'))}><Icon name="copy" size={14} /></button>}
            <button className="btn sm primary" onClick={genKey}><Icon name="refresh" size={14} />{integ.apiKey ? 'Régénérer' : 'Générer'}</button>
          </div>
        </Card>
        <Card title="Webhooks" icon="link">
          <div className="row wrap">
            <input className="input" style={{ flex: 2, minWidth: 180 }} placeholder="https://exemple.ma/webhook" value={hook.url} onChange={(e) => setHook({ ...hook, url: e.target.value })} />
            <select className="input" style={{ flex: 1, minWidth: 140 }} value={hook.event} onChange={(e) => setHook({ ...hook, event: e.target.value })}>{['facture.validée', 'paiement.reçu', 'stock.seuil', 'devis.accepté', 'ticket.encaissé'].map((x) => <option key={x}>{x}</option>)}</select>
            <button className="btn sm primary" onClick={addHook}><Icon name="plus" size={14} />Ajouter</button>
          </div>
          {integ.webhooks.map((w) => (
            <div key={w.id} className="row small" style={{ padding: '8px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
              <Badge color="blue">{w.event}</Badge><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.url}</span>
              <button className="btn sm ghost danger" onClick={() => setSettings({ integrations: { ...integ, webhooks: integ.webhooks.filter((x) => x.id !== w.id) } })}><Icon name="trash" size={13} /></button>
            </div>
          ))}
          {!integ.webhooks.length && <div className="muted small" style={{ marginTop: 10 }}>Aucun webhook configuré.</div>}
        </Card>
      </div>
    </div>
  )
}

function Security() {
  const { db, setSettings, toast, log } = useStore()
  const sec = db.settings.security
  const [setup, setSetup] = useState(null)
  const [code, setCode] = useState('')
  const start = () => { const secret = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[b % 32]).join(''); setSetup({ secret }); setCode('') }
  const confirm2fa = () => { if (!/^\d{6}$/.test(code)) return toast('Saisissez le code à 6 chiffres de votre application'); setSettings({ security: { ...sec, twoFactor: true } }); log('Double authentification activée', 'lock'); toast('Double authentification activée'); setSetup(null) }
  return (
    <div className="grid g2">
      <Card title="Double authentification (2FA)" icon="lock">
        <div className="row"><div style={{ flex: 1 }}><b>{sec.twoFactor ? 'Activée' : 'Désactivée'}</b><div className="muted small">Un code à usage unique (Google Authenticator, Microsoft Authenticator…) est demandé à chaque connexion.</div></div>
          {sec.twoFactor ? <button className="btn danger" onClick={() => { setSettings({ security: { ...sec, twoFactor: false } }); log('Double authentification désactivée', 'lock') }}>Désactiver</button> : <button className="btn primary" onClick={start}>Activer</button>}
        </div>
        {!sec.twoFactor && <div className="insight" style={{ marginTop: 14, borderColor: 'var(--amber)' }}><Icon name="alert" size={18} /><div className="small">Recommandé avant de saisir des données réelles (clients, factures, RIB).</div></div>}
      </Card>
      <Card title="Sessions ouvertes" icon="eye">
        {sec.sessions.map((s) => (
          <div key={s.id} className="row small" style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}><b>{s.device}</b>{s.current && <> <Badge color="green">Cette session</Badge></>}<div className="muted">{s.location} · {new Date(s.lastSeen).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</div></div>
            {!s.current && <button className="btn sm danger" onClick={() => { setSettings({ security: { ...sec, sessions: sec.sessions.filter((x) => x.id !== s.id) } }); toast('Session révoquée') }}>Révoquer</button>}
          </div>
        ))}
      </Card>
      {setup && (
        <Modal title="Activer la double authentification" onClose={() => setSetup(null)} footer={<><button className="btn" onClick={() => setSetup(null)}>Annuler</button><button className="btn primary" onClick={confirm2fa}>Vérifier et activer</button></>}>
          <ol className="small" style={{ lineHeight: 1.8, paddingLeft: 18, marginTop: 0 }}>
            <li>Ouvrez votre application d'authentification et ajoutez un compte manuellement.</li>
            <li>Saisissez la clé : <code style={{ fontWeight: 700, letterSpacing: '.1em' }}>{setup.secret}</code></li>
            <li>Entrez le code à 6 chiffres affiché.</li>
          </ol>
          <input className="input" inputMode="numeric" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} style={{ fontSize: 22, letterSpacing: '.3em', textAlign: 'center' }} />
          <p className="muted small">Démo locale : la vérification serveur du code sera branchée avec le backend d'authentification.</p>
        </Modal>
      )}
    </div>
  )
}

function Users() {
  const { db, add, update, remove, toast, log } = useStore()
  const [edit, setEdit] = useState(null)
  const ROLES = { Propriétaire: MODULES.map((m) => m.id), Administrateur: MODULES.map((m) => m.id), Commercial: ['dashboard', 'crm', 'prospects', 'sales', 'tenders', 'marketing', 'contracts', 'ai'], Comptable: ['dashboard', 'finance', 'accounting', 'sales', 'purchases', 'attachments'], Technicien: ['planning', 'service', 'inventory', 'quality'], Magasinier: ['inventory', 'purchases', 'pos'], Caissier: ['pos', 'inventory'] }
  const save = () => {
    if (!edit.name || !/@/.test(edit.email || '')) return toast('Nom et e-mail valides obligatoires')
    if (edit.id) update('users', edit.id, edit); else { add('users', { ...edit, active: true, lastLogin: '' }); log(`Utilisateur invité : ${edit.email}`, 'users') }
    toast('Utilisateur enregistré'); setEdit(null)
  }
  const toggleMod = (id) => setEdit({ ...edit, modules: edit.modules.includes(id) ? edit.modules.filter((x) => x !== id) : [...edit.modules, id] })
  return (
    <>
      <DataTable rows={db.users} exportName="utilisateurs" onRowClick={(u) => setEdit({ ...u })}
        actions={<button className="btn primary sm" onClick={() => setEdit({ name: '', email: '', role: 'Commercial', modules: ROLES.Commercial })}><Icon name="plus" size={14} />Inviter</button>}
        columns={[
          { key: 'name', label: 'Nom', strong: true },
          { key: 'email', label: 'E-mail' },
          { key: 'role', label: 'Rôle', render: (u) => <Badge color={u.role === 'Propriétaire' ? 'violet' : 'blue'}>{u.role}</Badge> },
          { key: 'modules', label: 'Accès', sort: (u) => u.modules.length, render: (u) => `${u.modules.length} module(s)` },
          { key: 'active', label: 'Statut', render: (u) => <Badge color={u.active ? 'green' : 'gray'}>{u.active ? 'Actif' : 'Suspendu'}</Badge> },
          { key: 'lastLogin', label: 'Dernière connexion', render: (u) => (u.lastLogin ? new Date(u.lastLogin).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'Invitation envoyée') },
        ]} />
      {edit && (
        <Modal size="xl" title={edit.id ? edit.name : 'Inviter un utilisateur'} onClose={() => setEdit(null)}
          footer={<>{edit.id && edit.role !== 'Propriétaire' && <button className="btn danger" onClick={() => { remove('users', edit.id); setEdit(null); toast('Utilisateur supprimé') }}><Icon name="trash" size={15} /></button>}<div className="spacer" /><button className="btn" onClick={() => setEdit(null)}>Annuler</button><button className="btn primary" onClick={save}>Enregistrer</button></>}>
          <div className="form">
            <Field label="Nom"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="E-mail"><input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Rôle"><select value={edit.role} disabled={edit.role === 'Propriétaire'} onChange={(e) => setEdit({ ...edit, role: e.target.value, modules: ROLES[e.target.value] || edit.modules })}>{Object.keys(ROLES).map((r) => <option key={r}>{r}</option>)}</select></Field>
            <Field label="Compte actif"><label className="switch"><input type="checkbox" checked={edit.active !== false} disabled={edit.role === 'Propriétaire'} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /><span /></label></Field>
          </div>
          <h4 style={{ margin: '18px 0 10px' }}>Accès par module</h4>
          <div className="grid g3" style={{ gap: 8 }}>
            {MODULES.map((m) => (
              <label key={m.id} className="row small" style={{ gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 9, cursor: 'pointer' }}>
                <input type="checkbox" checked={edit.modules.includes(m.id) || !!m.core} disabled={!!m.core || edit.role === 'Propriétaire'} onChange={() => toggleMod(m.id)} />
                <Icon name={m.icon} size={15} />{m.label}
              </label>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}

function Logs() {
  const { db } = useStore()
  const rows = db.activities.map((a) => ({ ...a, user: db.settings.user.name }))
  return (
    <DataTable rows={rows} exportName="journal" pageSize={20} empty="Aucune action enregistrée pour l'instant. Les créations, modifications et validations apparaîtront ici."
      columns={[
        { key: 'date', label: 'Date', render: (a) => new Date(a.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' }) },
        { key: 'user', label: 'Utilisateur' },
        { key: 'text', label: 'Action', strong: true },
      ]} />
  )
}

function AiSettings() {
  const { db, setSettings, toast } = useStore()
  const [ai, setAi] = useState(db.settings.ai)
  const [test, setTest] = useState('')
  const [busy, setBusy] = useState(false)
  const save = () => { setSettings({ ai }); toast('Configuration IA enregistrée') }
  const run = async () => {
    setBusy(true); setTest('')
    try {
      let acc = ''
      await askClaude({ ai, db, messages: [{ role: 'user', content: 'Test de connexion : réponds en une phrase avec le CA HT des 12 derniers mois.' }], onText: (t) => { acc += t; setTest(acc) } })
    } catch (e) { setTest(explainError(e)) }
    setBusy(false)
  }
  return (
    <div className="grid g3">
      <Card title="Connexion à Claude (Anthropic)" className="span2" icon="sparkles">
        <div className="form">
          <Field label="Modèle" full><select value={ai.model} onChange={(e) => setAi({ ...ai, model: e.target.value })}>{MODELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Niveau de réflexion"><select value={ai.effort} onChange={(e) => setAi({ ...ai, effort: e.target.value })}>{[['low', 'Rapide'], ['medium', 'Équilibré'], ['high', 'Approfondi']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="URL du proxy IA (recommandé)"><input placeholder="http://localhost:8787" value={ai.proxyUrl} onChange={(e) => setAi({ ...ai, proxyUrl: e.target.value })} /></Field>
          <Field label="Ou clé API Anthropic (stockée dans ce navigateur uniquement)" full><input type="password" placeholder="sk-ant-…" value={ai.apiKey} onChange={(e) => setAi({ ...ai, apiKey: e.target.value })} /></Field>
        </div>
        <div className="row wrap" style={{ marginTop: 16 }}>
          <button className="btn primary" onClick={save}><Icon name="check" size={15} />Enregistrer</button>
          <button className="btn ai" disabled={busy || !aiConfigured(ai)} onClick={run}><Icon name="pulse" size={15} />{busy ? 'Test…' : 'Tester la connexion'}</button>
          <Badge color={aiConfigured(db.settings.ai) ? 'green' : 'amber'}>{aiConfigured(db.settings.ai) ? 'Connecté' : 'Hors ligne'}</Badge>
        </div>
        {test && <div className="msg assistant" style={{ marginTop: 14, maxWidth: '100%' }}>{test}</div>}
      </Card>
      <Card title="Fonctionnement" icon="shield">
        <div className="muted small" style={{ lineHeight: 1.65 }}>
          <p style={{ marginTop: 0 }}><b>Sans clé</b> : prévisions, réapprovisionnement, péremption, scoring, anomalies et assistant fonctionnent avec le moteur local, sans envoi de données.</p>
          <p><b>Avec Claude</b> : l'assistant et la rédaction utilisent l'API Anthropic. Seul un résumé agrégé est transmis (pas de données RH nominatives).</p>
          <p style={{ marginBottom: 0 }}><b>Production</b> : lancez <code>npm run ai-proxy</code> avec <code>ANTHROPIC_API_KEY</code> côté serveur et renseignez l'URL du proxy, pour que la clé ne soit jamais exposée dans le navigateur.</p>
        </div>
      </Card>
    </div>
  )
}

function Data() {
  const { db, reset, toast, mutate } = useStore()
  const [confirm, setConfirm] = useState(false)
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ ...db, settings: { ...db.settings, ai: { ...db.settings.ai, apiKey: '' } } }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `liyahealth-erp-${new Date().toISOString().slice(0, 10)}.json`; a.click()
  }
  const importJson = (file) => {
    const r = new FileReader()
    r.onload = () => {
      try { const data = JSON.parse(r.result); if (data.version !== 4 || !data.products) throw new Error(); mutate((d) => { Object.assign(d, data) }); toast('Données importées') } catch { toast('Fichier invalide') }
    }
    r.readAsText(file)
  }
  const counts = [['Produits', db.products.length], ['Clients', db.clients.length], ['Fournisseurs', db.suppliers.length], ['Documents', db.documents.length], ['Paiements', db.payments.length], ['Mouvements', db.movements.length], ['Équipements', db.equipment.length], ['Interventions', db.interventions.length]]
  return (
    <div className="grid g2">
      <Card title="Sauvegarde & restauration" icon="download">
        <p className="muted">Les données sont enregistrées localement dans ce navigateur. Exportez régulièrement une sauvegarde.</p>
        <div className="row wrap">
          <button className="btn primary" onClick={exportJson}><Icon name="download" size={15} />Exporter (JSON)</button>
          <label className="btn"><Icon name="refresh" size={15} />Importer<input type="file" accept="application/json" hidden onChange={(e) => e.target.files[0] && importJson(e.target.files[0])} /></label>
          <button className="btn danger" onClick={() => setConfirm(true)}><Icon name="trash" size={15} />Réinitialiser la démo</button>
        </div>
      </Card>
      <Card title="Volumétrie" icon="layers">
        <div className="grid g2" style={{ gap: 10 }}>{counts.map(([l, n]) => <div key={l} className="row"><span className="muted">{l}</span><span className="spacer" /><b className="num">{n}</b></div>)}</div>
      </Card>
      {confirm && <Confirm text="Réinitialiser toutes les données avec le jeu de démonstration ? Cette action efface vos saisies." onClose={() => setConfirm(false)} onYes={() => { reset(); toast('Données réinitialisées') }} />}
    </div>
  )
}
