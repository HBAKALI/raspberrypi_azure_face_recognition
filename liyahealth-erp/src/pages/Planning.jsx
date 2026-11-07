import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { Badge, DataTable, Field, Icon, Kpi, Modal, PageHead, Seg, COLORS } from '../components/ui.jsx'
import { TODAY, addDays, fdate, MONTHS } from '../lib/domain.js'

export const STATUSES = ['Planifiée', 'En cours', 'Terminée', 'Échouée', 'Reportée']
const STATUS_COLOR = { Planifiée: COLORS.blue, 'En cours': COLORS.amber, Terminée: COLORS.green, Échouée: COLORS.red, Reportée: COLORS.gray }
const STATUS_BADGE = { Planifiée: 'blue', 'En cours': 'amber', Terminée: 'green', Échouée: 'red', Reportée: 'gray' }
const TYPES = ['Maintenance préventive', 'Corrective', 'Installation', 'Formation utilisateurs', 'Contrôle qualité']
const PRIORITIES = ['Basse', 'Moyenne', 'Haute']
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s) => new Date(s + 'T00:00:00')
export const mondayOf = (s) => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d) }

// Grille mensuelle réutilisable (lundi en premier) : renderDay(date) affiche le contenu d'une case.
export function MonthGrid({ month, renderDay, onDayClick }) {
  const first = parse(month + '-01')
  const start = addDays(month + '-01', -((first.getDay() + 6) % 7))
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  return (
    <div className="table-wrap">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(110px, 1fr))', gap: 6, minWidth: 780 }}>
        {DAYS.map((d) => <div key={d} className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', padding: '4px 6px' }}>{d}</div>)}
        {cells.map((d) => {
          const inMonth = d.slice(0, 7) === month
          return (
            <div key={d} onClick={() => onDayClick?.(d)} style={{ minHeight: 104, padding: 6, borderRadius: 10, cursor: onDayClick ? 'pointer' : 'default', border: `1px solid ${d === TODAY ? 'var(--teal)' : 'var(--border)'}`, background: inMonth ? 'var(--surface)' : 'var(--surface-2)', opacity: inMonth ? 1 : 0.55, display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: d === TODAY ? 'var(--teal)' : 'var(--muted)' }}>{Number(d.slice(8))}</div>
              {renderDay(d)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Chip({ color, children, onClick, title }) {
  return (
    <div title={title} onClick={(e) => { if (onClick) { e.stopPropagation(); onClick() } }}
      style={{ fontSize: 11, padding: '2px 6px', borderRadius: 6, background: color + '22', color: 'var(--text)', borderLeft: `3px solid ${color}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: onClick ? 'pointer' : 'default' }}>
      {children}
    </div>
  )
}

export default function Planning() {
  const { db, add, update, toast, log } = useStore()
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(TODAY)
  const [f, setF] = useState({ priority: '', techId: '', clientId: '', city: '' })
  const [edit, setEdit] = useState(null)
  const [day, setDay] = useState(null)
  const techs = db.employees.filter((e) => e.dept === 'SAV / Technique')
  const [me, setMe] = useState(techs[0]?.id || '')
  const [finish, setFinish] = useState(null)

  const client = (id) => db.clients.find((c) => c.id === id)
  const eqLabel = (id) => { const e = db.equipment.find((x) => x.id === id); const p = db.products.find((x) => x.id === e?.productId); return e ? `${e.serial} — ${p?.name || ''}` : '—' }
  const tech = (id) => db.employees.find((e) => e.id === id)?.name || '—'
  const items = useMemo(() => db.interventions.filter((i) =>
    (!f.priority || i.priority === f.priority) && (!f.techId || i.techId === f.techId) && (!f.clientId || i.clientId === f.clientId) && (!f.city || client(i.clientId)?.city === f.city),
  ).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))), [db.interventions, f]) // eslint-disable-line
  const onDay = (d) => items.filter((i) => i.date === d)

  const blank = (date = TODAY) => ({ number: `INT-${String(db.interventions.length + 1).padStart(4, '0')}`, equipmentId: '', clientId: '', type: TYPES[0], date, time: '09:00', techId: techs[0]?.id || '', priority: 'Moyenne', status: 'Planifiée', duration: 2, address: '', report: '' })
  const save = () => {
    if (!edit.equipmentId || !edit.date) return toast('Équipement et date obligatoires')
    if (edit.id) update('interventions', edit.id, edit)
    else { add('interventions', edit); log(`Intervention planifiée le ${fdate(edit.date)} — ${tech(edit.techId)}`, 'calendar') }
    toast('Intervention enregistrée'); setEdit(null)
  }
  const setStatus = (i, status, extra = {}) => { update('interventions', i.id, { status, ...extra }); toast(`Intervention : ${status}`) }

  const month = cursor.slice(0, 7)
  const weekStart = mondayOf(cursor)
  const move = (n) => {
    if (view === 'week') setCursor(addDays(cursor, n * 7))
    else { const d = parse(month + '-01'); d.setMonth(d.getMonth() + n); setCursor(iso(d)) }
  }
  const cities = [...new Set(db.clients.map((c) => c.city))].sort()
  const label = view === 'week' ? `Semaine du ${fdate(weekStart)}` : `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`
  const todays = db.interventions.filter((i) => i.date === TODAY && i.techId === me).sort((a, b) => (a.time || '').localeCompare(b.time || ''))

  return (
    <div className="stack">
      <PageHead title="Planning" sub="Planification des interventions des techniciens biomédicaux et des rendez-vous clients." crumbs="Opérations">
        <button className="btn primary" onClick={() => setEdit(blank())}><Icon name="plus" size={15} />Planifier une intervention</button>
      </PageHead>
      <div className="grid g4">
        <Kpi label="Prévues (à venir)" value={db.interventions.filter((i) => i.status === 'Planifiée' && i.date >= TODAY).length} icon="calendar" color="blue" />
        <Kpi label="En cours" value={db.interventions.filter((i) => i.status === 'En cours').length} icon="clock" color="amber" />
        <Kpi label="Aujourd'hui" value={db.interventions.filter((i) => i.date === TODAY).length} icon="wrench" color="teal" />
        <Kpi label="Échouées / reportées" value={db.interventions.filter((i) => ['Échouée', 'Reportée'].includes(i.status)).length} icon="alert" color="red" />
      </div>

      <div className="card toolbar" style={{ borderBottom: 0 }}>
        <Seg value={view} onChange={setView} options={[['month', 'Mois'], ['week', 'Semaine'], ['list', 'Liste'], ['me', 'Mon planning']]} />
        {(view === 'month' || view === 'week') && (
          <span className="row" style={{ gap: 6 }}>
            <button className="btn sm" onClick={() => move(-1)} aria-label="Précédent">‹</button>
            <button className="btn sm" onClick={() => setCursor(TODAY)}>Aujourd'hui</button>
            <button className="btn sm" onClick={() => move(1)} aria-label="Suivant">›</button>
            <b style={{ marginLeft: 6 }}>{label}</b>
          </span>
        )}
        <div className="spacer" />
        {view !== 'me' && <>
          <select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="">Priorité : toutes</option>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
          <select value={f.techId} onChange={(e) => setF({ ...f, techId: e.target.value })}><option value="">Technicien : tous</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <select value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })}><option value="">Client : tous</option>{db.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}><option value="">Ville : toutes</option>{cities.map((c) => <option key={c}>{c}</option>)}</select>
        </>}
      </div>

      {view === 'month' && (
        <div className="card" style={{ padding: 12 }}>
          <MonthGrid month={month} onDayClick={setDay} renderDay={(d) => {
            const list = onDay(d)
            return <>
              {list.slice(0, 3).map((i) => <Chip key={i.id} color={STATUS_COLOR[i.status] || COLORS.gray} onClick={() => setEdit({ ...i })} title={`${i.type} — ${client(i.clientId)?.name}`}>{i.time ? i.time + ' ' : ''}{client(i.clientId)?.name}</Chip>)}
              {list.length > 3 && <div className="muted" style={{ fontSize: 11 }}>+{list.length - 3} autre(s)</div>}
            </>
          }} />
          <div className="legend" style={{ marginTop: 10 }}>{STATUSES.map((s) => <span key={s}><i style={{ background: STATUS_COLOR[s] }} />{s}</span>)}</div>
        </div>
      )}

      {view === 'week' && (
        <div className="table-wrap">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(150px, 1fr))', gap: 10, minWidth: 1050 }}>
            {Array.from({ length: 7 }, (_, k) => addDays(weekStart, k)).map((d, k) => (
              <div key={d} className="kcol" style={{ minHeight: 260, borderColor: d === TODAY ? 'var(--teal)' : undefined }}>
                <div className="kcol-h"><span>{DAYS[k]} {Number(d.slice(8))}</span><span className="spacer" /><button className="btn sm ghost" onClick={() => setEdit(blank(d))} aria-label="Ajouter"><Icon name="plus" size={13} /></button></div>
                {onDay(d).map((i) => (
                  <div key={i.id} className="kcard" onClick={() => setEdit({ ...i })} style={{ borderLeft: `3px solid ${STATUS_COLOR[i.status]}` }}>
                    <div className="row small"><b style={{ flex: 1 }}>{i.time || '—'}</b><Badge color={STATUS_BADGE[i.status]}>{i.status}</Badge></div>
                    <div style={{ fontWeight: 600, marginTop: 4, fontSize: 13 }}>{i.type}</div>
                    <div className="muted small">{client(i.clientId)?.name}</div>
                    <div className="muted small">{tech(i.techId)}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'list' && (
        <DataTable rows={items} exportName="planning" onRowClick={(r) => setEdit({ ...r })} searchKeys={['number', 'type', (r) => client(r.clientId)?.name, (r) => eqLabel(r.equipmentId)]}
          filters={[{ key: 'status', label: 'Statut', options: STATUSES }, { key: 'type', label: 'Type', options: TYPES }]}
          columns={[
            { key: 'date', label: 'Date', sort: (r) => r.date + (r.time || ''), render: (r) => `${fdate(r.date)}${r.time ? ' · ' + r.time : ''}` },
            { key: 'number', label: 'N°', strong: true },
            { key: 'type', label: 'Type' },
            { key: 'client', label: 'Client', sort: (r) => client(r.clientId)?.name, render: (r) => <>{client(r.clientId)?.name}<div className="muted small">{r.address || client(r.clientId)?.city}</div></>, csv: (r) => client(r.clientId)?.name },
            { key: 'eq', label: 'Équipement', render: (r) => eqLabel(r.equipmentId), csv: (r) => eqLabel(r.equipmentId) },
            { key: 'tech', label: 'Technicien', sort: (r) => tech(r.techId), render: (r) => tech(r.techId), csv: (r) => tech(r.techId) },
            { key: 'priority', label: 'Priorité', render: (r) => <Badge>{r.priority}</Badge>, csv: (r) => r.priority },
            { key: 'status', label: 'Statut', render: (r) => <Badge color={STATUS_BADGE[r.status]}>{r.status}</Badge>, csv: (r) => r.status },
          ]} />
      )}

      {view === 'me' && (
        <div className="card card-b">
          <div className="row wrap" style={{ marginBottom: 14 }}>
            <b>Mon planning du {fdate(TODAY)}</b><span className="spacer" />
            <select className="input" style={{ width: 'auto' }} value={me} onChange={(e) => setMe(e.target.value)}>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          </div>
          {!todays.length && <div className="empty">Aucune intervention prévue aujourd'hui pour ce technicien.</div>}
          <div className="stack" style={{ gap: 12 }}>
            {todays.map((i) => (
              <div key={i.id} className="row wrap" style={{ alignItems: 'flex-start', gap: 14, padding: 12, borderRadius: 12, border: '1px solid var(--border)', borderLeft: `4px solid ${STATUS_COLOR[i.status]}` }}>
                <div style={{ fontWeight: 800, fontSize: 18, minWidth: 56 }}>{i.time || '—'}</div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="row"><b>{i.type}</b><Badge color={STATUS_BADGE[i.status]}>{i.status}</Badge><Badge>{i.priority}</Badge></div>
                  <div className="muted small" style={{ marginTop: 4 }}>{client(i.clientId)?.name} · {i.address || client(i.clientId)?.city} · {i.duration} h</div>
                  <div className="small" style={{ marginTop: 2 }}>{eqLabel(i.equipmentId)}</div>
                  {i.report && <div className="muted small" style={{ marginTop: 4 }}>Rapport : {i.report}</div>}
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  {i.status === 'Planifiée' && <button className="btn sm primary" onClick={() => setStatus(i, 'En cours')}>Démarrer</button>}
                  {['Planifiée', 'En cours'].includes(i.status) && <>
                    <button className="btn sm" onClick={() => setFinish({ i, report: i.report || '' })}><Icon name="check" size={13} />Terminer</button>
                    <button className="btn sm" onClick={() => setStatus(i, 'Reportée', { date: addDays(TODAY, 1) })}>Reporter</button>
                    <button className="btn sm danger" onClick={() => setStatus(i, 'Échouée')}>Échec</button>
                  </>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {day && (
        <Modal title={`Interventions du ${fdate(day)}`} onClose={() => setDay(null)} footer={<><button className="btn" onClick={() => setDay(null)}>Fermer</button><button className="btn primary" onClick={() => { setEdit(blank(day)); setDay(null) }}><Icon name="plus" size={15} />Ajouter</button></>}>
          {!onDay(day).length && <div className="muted">Aucune intervention ce jour.</div>}
          {onDay(day).map((i) => (
            <div key={i.id} className="row" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => { setEdit({ ...i }); setDay(null) }}>
              <b style={{ minWidth: 48 }}>{i.time || '—'}</b>
              <div style={{ flex: 1 }}><b>{i.type}</b><div className="muted small">{client(i.clientId)?.name} · {tech(i.techId)}</div></div>
              <Badge color={STATUS_BADGE[i.status]}>{i.status}</Badge>
            </div>
          ))}
        </Modal>
      )}

      {finish && (
        <Modal title="Terminer l'intervention" onClose={() => setFinish(null)} footer={<><button className="btn" onClick={() => setFinish(null)}>Annuler</button><button className="btn primary" onClick={() => { setStatus(finish.i, 'Terminée', { report: finish.report }); setFinish(null) }}>Valider</button></>}>
          <Field label="Rapport d'intervention"><textarea value={finish.report} placeholder="Travaux réalisés, pièces remplacées, contrôles effectués…" onChange={(e) => setFinish({ ...finish, report: e.target.value })} /></Field>
        </Modal>
      )}

      {edit && (
        <Modal title={edit.id ? `Intervention ${edit.number}` : 'Nouvelle intervention'} onClose={() => setEdit(null)} footer={<><button className="btn" onClick={() => setEdit(null)}>Annuler</button><button className="btn primary" onClick={save}><Icon name="check" size={15} />Enregistrer</button></>}>
          <div className="form">
            <Field label="Équipement" full>
              <select value={edit.equipmentId} onChange={(e) => { const eq = db.equipment.find((x) => x.id === e.target.value); setEdit({ ...edit, equipmentId: e.target.value, clientId: eq?.clientId || edit.clientId, address: edit.address || [eq?.location, client(eq?.clientId)?.city].filter(Boolean).join(', ') }) }}>
                <option value="">—</option>{db.equipment.map((e) => <option key={e.id} value={e.id}>{eqLabel(e.id)} · {client(e.clientId)?.name}</option>)}
              </select>
            </Field>
            <Field label="Client"><select value={edit.clientId} onChange={(e) => setEdit({ ...edit, clientId: e.target.value })}><option value="">—</option>{db.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Type"><select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Date"><input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></Field>
            <Field label="Heure"><input type="time" value={edit.time || ''} onChange={(e) => setEdit({ ...edit, time: e.target.value })} /></Field>
            <Field label="Technicien"><select value={edit.techId} onChange={(e) => setEdit({ ...edit, techId: e.target.value })}>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
            <Field label="Priorité"><select value={edit.priority} onChange={(e) => setEdit({ ...edit, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Statut"><select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Durée (h)"><input type="number" min="0" step="0.5" value={edit.duration} onChange={(e) => setEdit({ ...edit, duration: Number(e.target.value) })} /></Field>
            <Field label="Adresse / service" full><input value={edit.address || ''} placeholder={client(edit.clientId)?.city || ''} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></Field>
            <Field label="Rapport" full><textarea value={edit.report || ''} onChange={(e) => setEdit({ ...edit, report: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  )
}
