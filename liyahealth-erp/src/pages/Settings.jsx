import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { go, useRoute } from '../lib/nav.js'
import { Badge, Card, Confirm, Field, FormFields, Icon, PageHead, Tabs, COLORS } from '../components/ui.jsx'
import { GROUPS, MODULES, isEnabled } from '../lib/modules.js'
import { aiConfigured, askClaude, explainError } from '../ai/claude.js'

const MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 — recommandé'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 — rapide'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 — économique'],
  ['claude-fable-5-1', 'Claude Fable 5.1 — le plus puissant'],
]

export default function Settings() {
  const { tab } = useRoute()
  const t = ['modules', 'company', 'ai', 'data'].includes(tab) ? tab : 'modules'
  return (
    <div className="stack">
      <PageHead title="Paramètres" sub="Configuration de l'ERP LIYA HEALTH." />
      <Tabs tabs={[['modules', 'Modules'], ['company', 'Société'], ['ai', 'Intelligence artificielle'], ['data', 'Données']]} value={t} onChange={(x) => go('settings', x)} />
      {t === 'modules' && <Modules />}
      {t === 'company' && <Company />}
      {t === 'ai' && <AiSettings />}
      {t === 'data' && <Data />}
    </div>
  )
}

function Modules() {
  const { db, setSettings, toast } = useStore()
  const toggle = (id, on) => { setSettings({ modules: { ...(db.settings.modules || {}), [id]: on } }); toast(`Module ${on ? 'activé' : 'désactivé'}`) }
  const active = MODULES.filter((m) => isEnabled(db.settings, m.id)).length
  return (
    <div className="stack">
      <div className="muted">{active} modules actifs sur {MODULES.length}. Les modules désactivés disparaissent du menu ; leurs données sont conservées.</div>
      {GROUPS.map((g) => (
        <div key={g}>
          <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', margin: '8px 0 12px' }}>{g}</h3>
          <div className="grid g3">
            {MODULES.filter((m) => m.group === g).map((m) => {
              const on = isEnabled(db.settings, m.id)
              const c = m.color === 'ai' ? COLORS.violet : COLORS[m.color] || COLORS.gray
              return (
                <div key={m.id} className="card module-card" style={{ opacity: on ? 1 : 0.7 }}>
                  <div className="row">
                    <div className="mi" style={{ background: m.color === 'ai' ? 'linear-gradient(135deg,#7b61ff,#13a89e)' : c + '1a', color: m.color === 'ai' ? '#fff' : c }}><Icon name={m.icon} size={20} /></div>
                    <div style={{ flex: 1 }}><b>{m.label}</b><div>{m.core ? <Badge color="gray">Module de base</Badge> : on ? <Badge color="green">Actif</Badge> : <Badge color="gray">Inactif</Badge>}</div></div>
                    <label className="switch"><input type="checkbox" checked={on} disabled={m.core} onChange={(e) => toggle(m.id, e.target.checked)} /><span /></label>
                  </div>
                  <div className="muted small" style={{ lineHeight: 1.5 }}>{m.desc}</div>
                  {on && <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => go(m.id)}>Ouvrir<Icon name="arrowRight" size={13} /></button>}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function Company() {
  const { db, setSettings, toast } = useStore()
  const [co, setCo] = useState(db.settings.company)
  const [user, setUser] = useState(db.settings.user)
  return (
    <div className="grid g3">
      <Card title="Identité de la société" className="span2" icon="building">
        <FormFields value={co} onChange={setCo} fields={[
          { key: 'name', label: 'Raison sociale' }, { key: 'tagline', label: 'Signature' },
          { key: 'rc', label: 'Registre de commerce' }, { key: 'ice', label: 'ICE' },
          { key: 'tp', label: 'Taxe professionnelle' }, { key: 'cnss', label: 'CNSS' },
          { key: 'capital', label: 'Capital' }, { key: 'manager', label: 'Gérant / signataire' },
          { key: 'phone', label: 'Téléphone' }, { key: 'email', label: 'E-mail' },
          { key: 'address', label: 'Adresse', full: true }, { key: 'bank', label: 'Banque (cautions, virements)', full: true }, { key: 'ammps', label: 'Statut AMMPS', full: true },
        ]} />
        <button className="btn primary" style={{ marginTop: 16 }} onClick={() => { setSettings({ company: co }); toast('Société mise à jour') }}><Icon name="check" size={15} />Enregistrer</button>
      </Card>
      <Card title="Utilisateur connecté" icon="users">
        <FormFields value={user} onChange={setUser} fields={[{ key: 'name', label: 'Nom', full: true }, { key: 'role', label: 'Fonction', full: true }]} />
        <button className="btn primary" style={{ marginTop: 16 }} onClick={() => { setSettings({ user }); toast('Profil mis à jour') }}>Enregistrer</button>
      </Card>
    </div>
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
      try { const data = JSON.parse(r.result); if (data.version !== 3 || !data.products) throw new Error(); mutate((d) => { Object.assign(d, data) }); toast('Données importées') } catch { toast('Fichier invalide') }
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
