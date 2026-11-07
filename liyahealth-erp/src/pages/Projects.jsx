// Module « Gestion des projets » : tâches (Kanban) et projets.
import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { go, useRoute } from '../lib/nav.js'
import { Badge, Card, Confirm, Field, FormFields, Icon, Kpi, Modal, PageHead, Progress, Tabs } from '../components/ui.jsx'
import { TODAY, fdate } from '../lib/domain.js'

const COLS = ['À faire', 'En cours', 'En revue', 'Terminé', 'Annulé']
const COL_COLOR = { 'À faire': 'gray', 'En cours': 'blue', 'En revue': 'violet', Terminé: 'green', Annulé: 'red' }
const PRIORITIES = ['Faible', 'Moyenne', 'Haute', 'Urgente']
const PRIO_COLOR = { Faible: 'gray', Moyenne: 'blue', Haute: 'amber', Urgente: 'red' }
const P_STATUSES = ['Planifié', 'En cours', 'En pause', 'Terminé', 'Annulé']
const P_COLOR = { Planifié: 'blue', 'En cours': 'amber', 'En pause': 'gray', Terminé: 'green', Annulé: 'red' }

const initials = (n = '') => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()
const Avatar = ({ name, size = 26 }) => <div className="avatar" title={name} style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials(name)}</div>

export default function Projects() {
  const { db } = useStore()
  const { tab } = useRoute()
  const t = tab === 'projects' ? 'projects' : 'tasks'
  const active = db.projects.filter((p) => ['Planifié', 'En cours'].includes(p.status))
  const open = db.tasks.filter((x) => !['Terminé', 'Annulé'].includes(x.status))
  const late = open.filter((x) => x.due && x.due < TODAY)
  const counted = db.tasks.filter((x) => x.status !== 'Annulé')
  const done = counted.filter((x) => x.status === 'Terminé').length
  return (
    <div className="stack">
      <PageHead title="Gestion des projets" sub="Projets d'installation, chantiers qualité et tâches de l'équipe." crumbs="Opérations › Projets" />
      <div className="grid g4">
        <Kpi label="Projets actifs" value={active.length} icon="layers" color="teal" foot={`${db.projects.length} projets au total`} />
        <Kpi label="Tâches ouvertes" value={open.length} icon="clock" color="blue" />
        <Kpi label="Tâches en retard" value={late.length} icon="alert" color="red" />
        <Kpi label="Taux d'achèvement" value={`${counted.length ? Math.round((done / counted.length) * 100) : 0} %`} icon="check" color="green" foot={`${done} / ${counted.length} tâches`} />
      </div>
      <Tabs tabs={[['tasks', 'Tâches'], ['projects', 'Projets']]} value={t} onChange={(x) => go('projects', x)} />
      {t === 'tasks' ? <Tasks /> : <ProjectsGrid />}
    </div>
  )
}

function TaskModal({ task, onClose }) {
  const { db, add, update, remove, toast, log } = useStore()
  const [f, setF] = useState(task)
  const [del, setDel] = useState(false)
  const save = () => {
    if (!f.title) return toast('Le titre est obligatoire')
    if (f.id) update('tasks', f.id, f)
    else { add('tasks', f); log(`Tâche créée : ${f.title}`, 'plus') }
    toast('Tâche enregistrée'); onClose()
  }
  return (
    <Modal title={f.id ? 'Modifier la tâche' : 'Nouvelle tâche'} onClose={onClose}
      footer={<>{f.id && <button className="btn danger" onClick={() => setDel(true)}><Icon name="trash" size={15} /></button>}<div className="spacer" /><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={save}><Icon name="check" size={15} />Enregistrer</button></>}>
      <FormFields value={f} onChange={setF} fields={[
        { key: 'title', label: 'Titre', full: true },
        { key: 'projectId', label: 'Projet', type: 'select', options: db.projects.map((p) => [p.id, p.name]) },
        { key: 'status', label: 'Statut', type: 'select', options: COLS, placeholder: false },
        { key: 'priority', label: 'Priorité', type: 'select', options: PRIORITIES, placeholder: false },
        { key: 'assigneeId', label: 'Assignée à', type: 'select', options: db.employees.map((e) => [e.id, e.name]) },
        { key: 'due', label: 'Échéance', type: 'date' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]} />
      {del && <Confirm text={`Supprimer la tâche « ${f.title} » ?`} onClose={() => setDel(false)} onYes={() => { remove('tasks', f.id); toast('Tâche supprimée'); onClose() }} />}
    </Modal>
  )
}

function Tasks() {
  const { db, update, toast } = useStore()
  const [proj, setProj] = useState('')
  const [who, setWho] = useState('')
  const [edit, setEdit] = useState(null)
  const [over, setOver] = useState(null)
  const rows = db.tasks.filter((x) => (!proj || x.projectId === proj) && (!who || x.assigneeId === who))
  const drop = (status, e) => {
    const id = e.dataTransfer.getData('text/plain')
    setOver(null)
    const task = db.tasks.find((x) => x.id === id)
    if (task && task.status !== status) { update('tasks', id, { status }); toast(`« ${task.title} » → ${status}`) }
  }
  return (
    <>
      <div className="row wrap">
        <select className="input" style={{ width: 'auto' }} value={proj} onChange={(e) => setProj(e.target.value)}><option value="">Tous les projets</option>{db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className="input" style={{ width: 'auto' }} value={who} onChange={(e) => setWho(e.target.value)}><option value="">Toute l'équipe</option>{db.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setEdit({ title: '', projectId: proj || db.projects[0]?.id || '', status: 'À faire', priority: 'Moyenne', assigneeId: who, due: '', description: '' })}><Icon name="plus" size={15} />Nouvelle tâche</button>
      </div>
      <div className="kanban">
        {COLS.map((c) => {
          const items = rows.filter((x) => x.status === c)
          return (
            <div key={c} className={`kcol ${over === c ? 'drop' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(c) }} onDragLeave={() => setOver(null)} onDrop={(e) => drop(c, e)}>
              <div className="kcol-h"><Badge color={COL_COLOR[c]}>{c}</Badge><span className="spacer" /><span className="muted small">{items.length}</span></div>
              {items.map((x) => {
                const p = db.projects.find((y) => y.id === x.projectId)
                const a = db.employees.find((e) => e.id === x.assigneeId)
                const isLate = x.due && x.due < TODAY && !['Terminé', 'Annulé'].includes(x.status)
                return (
                  <div key={x.id} className="kcard" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', x.id)} onClick={() => setEdit({ ...x })}>
                    <div style={{ fontWeight: 600, lineHeight: 1.35 }}>{x.title}</div>
                    <div className="muted small" style={{ marginTop: 4 }}>{p?.name || 'Sans projet'}</div>
                    <div className="row" style={{ marginTop: 10, gap: 6 }}>
                      <Badge color={PRIO_COLOR[x.priority]}>{x.priority}</Badge>
                      <span className="spacer" />
                      {x.due && <span className="small num" style={{ color: isLate ? 'var(--red)' : 'var(--muted)', fontWeight: isLate ? 700 : 400 }}><Icon name="clock" size={12} /> {fdate(x.due)}</span>}
                      {a && <Avatar name={a.name} size={24} />}
                    </div>
                  </div>
                )
              })}
              {!items.length && <div className="muted small" style={{ textAlign: 'center', padding: 16 }}>Glissez une tâche ici</div>}
            </div>
          )
        })}
      </div>
      {edit && <TaskModal task={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function ProjectsGrid() {
  const { db, add, update, remove, toast, log } = useStore()
  const [edit, setEdit] = useState(null)
  const [view, setView] = useState(null)
  const [del, setDel] = useState(null)
  const [taskEdit, setTaskEdit] = useState(null)
  const stats = useMemo(() => Object.fromEntries(db.projects.map((p) => {
    const ts = db.tasks.filter((x) => x.projectId === p.id && x.status !== 'Annulé')
    return [p.id, { n: ts.length, done: ts.filter((x) => x.status === 'Terminé').length }]
  })), [db.projects, db.tasks])
  const save = () => {
    if (!edit.name) return toast('Le nom du projet est obligatoire')
    if (edit.id) update('projects', edit.id, edit)
    else { add('projects', edit); log(`Projet créé : ${edit.name}`, 'layers') }
    toast('Projet enregistré'); setEdit(null)
  }
  const toggleTeam = (id) => setEdit({ ...edit, team: edit.team.includes(id) ? edit.team.filter((x) => x !== id) : [...edit.team, id] })
  return (
    <>
      <div className="row"><div className="spacer" /><button className="btn primary" onClick={() => setEdit({ name: '', clientId: '', status: 'Planifié', priority: 'Moyenne', start: TODAY, end: '', team: [], description: '' })}><Icon name="plus" size={15} />Nouveau projet</button></div>
      <div className="grid g3">
        {db.projects.map((p) => {
          const s = stats[p.id] || { n: 0, done: 0 }
          const client = db.clients.find((c) => c.id === p.clientId)
          const team = p.team.map((id) => db.employees.find((e) => e.id === id)).filter(Boolean)
          return (
            <div key={p.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}><b style={{ fontSize: 15 }}>{p.name}</b><div className="muted small">{client?.name || 'Projet interne'}</div></div>
                <Badge color={P_COLOR[p.status]}>{p.status}</Badge>
              </div>
              <div className="row small"><Badge color={PRIO_COLOR[p.priority]}>{p.priority}</Badge><span className="spacer" /><span className="muted">{fdate(p.start)} → {p.end ? fdate(p.end) : '—'}</span></div>
              <div>
                <div className="row small"><span className="muted">{s.done} / {s.n} tâches terminées</span><span className="spacer" /><b>{s.n ? Math.round((s.done / s.n) * 100) : 0} %</b></div>
                <div style={{ marginTop: 5 }}><Progress value={s.n ? s.done / s.n : 0} color={p.status === 'Terminé' ? 'var(--green)' : undefined} /></div>
              </div>
              <div className="row">
                <div className="row" style={{ gap: 0 }}>{team.slice(0, 5).map((e, i) => <div key={e.id} style={{ marginLeft: i ? -8 : 0, border: '2px solid var(--surface)', borderRadius: '50%' }}><Avatar name={e.name} size={28} /></div>)}</div>
                <span className="muted small">{team.length} membre(s)</span>
                <span className="spacer" />
                <button className="btn sm ghost" onClick={() => setEdit({ ...p, team: [...p.team] })}><Icon name="edit" size={13} /></button>
                <button className="btn sm" onClick={() => setView(p)}>Ouvrir<Icon name="arrowRight" size={13} /></button>
              </div>
            </div>
          )
        })}
      </div>
      {!db.projects.length && <div className="card empty">Aucun projet. Créez le premier projet.</div>}

      {edit && (
        <Modal title={edit.id ? 'Modifier le projet' : 'Nouveau projet'} onClose={() => setEdit(null)}
          footer={<>{edit.id && <button className="btn danger" onClick={() => setDel(edit)}><Icon name="trash" size={15} /></button>}<div className="spacer" /><button className="btn" onClick={() => setEdit(null)}>Annuler</button><button className="btn primary" onClick={save}><Icon name="check" size={15} />Enregistrer</button></>}>
          <FormFields value={edit} onChange={setEdit} fields={[
            { key: 'name', label: 'Nom du projet', full: true },
            { key: 'clientId', label: 'Client', type: 'select', options: db.clients.map((c) => [c.id, c.name]) },
            { key: 'status', label: 'Statut', type: 'select', options: P_STATUSES, placeholder: false },
            { key: 'priority', label: 'Priorité', type: 'select', options: PRIORITIES, placeholder: false },
            { key: 'start', label: 'Début', type: 'date' },
            { key: 'end', label: 'Fin prévue', type: 'date' },
            { key: 'description', label: 'Description', type: 'textarea' },
          ]} />
          <Field label="Équipe">
            <div className="grid g2" style={{ gap: 6, marginTop: 4 }}>
              {db.employees.map((e) => (
                <label key={e.id} className="row small" style={{ gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={edit.team.includes(e.id)} onChange={() => toggleTeam(e.id)} />{e.name} <span className="muted">· {e.role}</span>
                </label>
              ))}
            </div>
          </Field>
        </Modal>
      )}
      {view && (
        <Modal size="xl" title={view.name} onClose={() => setView(null)}
          footer={<><button className="btn" onClick={() => setTaskEdit({ title: '', projectId: view.id, status: 'À faire', priority: 'Moyenne', assigneeId: '', due: '', description: '' })}><Icon name="plus" size={15} />Ajouter une tâche</button><button className="btn primary" onClick={() => setView(null)}>Fermer</button></>}>
          {view.description && <p className="muted" style={{ marginTop: 0 }}>{view.description}</p>}
          <Card title="Tâches du projet" icon="layers" pad={false}>
            <table className="t" style={{ marginTop: 10 }}>
              <thead><tr><th>Tâche</th><th>Statut</th><th>Priorité</th><th>Assignée</th><th>Échéance</th></tr></thead>
              <tbody>
                {db.tasks.filter((x) => x.projectId === view.id).map((x) => (
                  <tr key={x.id} className="click" onClick={() => setTaskEdit({ ...x })}>
                    <td className="strong">{x.title}</td><td><Badge color={COL_COLOR[x.status]}>{x.status}</Badge></td><td><Badge color={PRIO_COLOR[x.priority]}>{x.priority}</Badge></td>
                    <td>{db.employees.find((e) => e.id === x.assigneeId)?.name || '—'}</td>
                    <td style={{ color: x.due && x.due < TODAY && !['Terminé', 'Annulé'].includes(x.status) ? 'var(--red)' : undefined }}>{x.due ? fdate(x.due) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!db.tasks.some((x) => x.projectId === view.id) && <div className="empty">Aucune tâche pour ce projet.</div>}
          </Card>
        </Modal>
      )}
      {taskEdit && <TaskModal task={taskEdit} onClose={() => setTaskEdit(null)} />}
      {del && <Confirm text={`Supprimer le projet « ${del.name} » et ses tâches ?`} onClose={() => setDel(null)} onYes={() => { db.tasks.filter((x) => x.projectId === del.id).forEach((x) => remove('tasks', x.id)); remove('projects', del.id); setEdit(null); toast('Projet supprimé') }} />}
    </>
  )
}
