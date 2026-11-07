import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { go, useRoute } from '../lib/nav.js'
import { Badge, Card, DataTable, Field, Icon, Kpi, Modal, PageHead, Tabs, Confirm, COLORS } from '../components/ui.jsx'
import { TODAY, fdate, daysBetween, MONTHS } from '../lib/domain.js'
import { MonthGrid, Chip, iso } from './Planning.jsx'

const STATUSES = ['En attente', 'Confirmée', 'Annulée', 'Réalisée']
const COLOR = { 'En attente': COLORS.amber, Confirmée: COLORS.blue, Annulée: COLORS.gray, Réalisée: COLORS.green }
const BADGE = { 'En attente': 'amber', Confirmée: 'blue', Annulée: 'gray', Réalisée: 'green' }

export default function Bookings() {
  const { db, add, update, remove, toast, log } = useStore()
  const { tab } = useRoute()
  const t = tab === 'overview' ? 'overview' : 'calendar'
  const [cursor, setCursor] = useState(TODAY.slice(0, 7))
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const equip = db.products.filter((p) => p.kind === 'equip')
  const product = (id) => db.products.find((p) => p.id === id)
  const client = (id) => db.clients.find((c) => c.id === id)
  const owner = (id) => db.employees.find((e) => e.id === id)?.name || '—'
  const onDay = (d) => db.bookings.filter((b) => b.start <= d && (b.end || b.start) >= d)

  const blank = (d = TODAY) => ({ title: 'Démonstration', productId: equip[0]?.id || '', clientId: db.clients[0]?.id || '', start: d, end: d, status: 'En attente', ownerId: 'e3', notes: '' })
  // Conflit : même matériel réservé sur des dates qui se chevauchent (hors annulées)
  const conflicts = edit ? db.bookings.filter((b) => b.id !== edit.id && b.productId === edit.productId && b.status !== 'Annulée' && b.start <= (edit.end || edit.start) && (b.end || b.start) >= edit.start) : []
  const save = () => {
    if (!edit.title || !edit.start || (edit.end && edit.end < edit.start)) return toast('Titre et dates valides obligatoires')
    if (edit.id) update('bookings', edit.id, edit)
    else { add('bookings', edit); log(`Réservation créée : ${edit.title}`, 'clock') }
    toast(conflicts.length ? 'Réservation enregistrée (chevauchement signalé)' : 'Réservation enregistrée'); setEdit(null)
  }
  const move = (n) => { const d = new Date(cursor + '-01T00:00:00'); d.setMonth(d.getMonth() + n); setCursor(iso(d).slice(0, 7)) }

  const done = db.bookings.filter((b) => b.status === 'Réalisée').length
  const cancelled = db.bookings.filter((b) => b.status === 'Annulée').length
  const rows = useMemo(() => [...db.bookings].sort((a, b) => b.start.localeCompare(a.start)), [db.bookings])

  return (
    <div className="stack">
      <PageHead title="Réservations" sub="Démonstrations produits et prêts de matériel aux établissements de santé." crumbs="Opérations">
        <button className="btn primary" onClick={() => setEdit(blank())}><Icon name="plus" size={15} />Nouvelle réservation</button>
      </PageHead>
      <div className="grid g4">
        <Kpi label="En attente" value={db.bookings.filter((b) => b.status === 'En attente').length} icon="clock" color="amber" />
        <Kpi label="Confirmées" value={db.bookings.filter((b) => b.status === 'Confirmée').length} icon="check" color="blue" />
        <Kpi label="Annulées" value={cancelled} icon="x" color="gray" />
        <Kpi label="Taux de réalisation" value={`${done + cancelled ? Math.round((done / (done + cancelled)) * 100) : 0} %`} icon="target" color="green" foot={`${done} réalisée(s)`} />
      </div>
      <Tabs value={t} onChange={(x) => go('bookings', x)} tabs={[['calendar', 'Calendrier'], ['overview', 'Aperçu']]} />

      {t === 'calendar' && (
        <div className="card" style={{ padding: 12 }}>
          <div className="row wrap" style={{ marginBottom: 10 }}>
            <button className="btn sm" onClick={() => move(-1)} aria-label="Mois précédent">‹</button>
            <button className="btn sm" onClick={() => setCursor(TODAY.slice(0, 7))}>Aujourd'hui</button>
            <button className="btn sm" onClick={() => move(1)} aria-label="Mois suivant">›</button>
            <b style={{ marginLeft: 6 }}>{MONTHS[Number(cursor.slice(5)) - 1]} {cursor.slice(0, 4)}</b>
            <span className="spacer" />
            <span className="muted small">Cliquez sur un jour pour réserver</span>
          </div>
          <MonthGrid month={cursor} onDayClick={(d) => setEdit(blank(d))} renderDay={(d) => {
            const list = onDay(d)
            return <>
              {list.slice(0, 3).map((b) => <Chip key={b.id} color={COLOR[b.status]} onClick={() => setEdit({ ...b })} title={`${b.title} — ${client(b.clientId)?.name}`}>{b.title}</Chip>)}
              {list.length > 3 && <div className="muted" style={{ fontSize: 11 }}>+{list.length - 3} autre(s)</div>}
            </>
          }} />
          <div className="legend" style={{ marginTop: 10 }}>{STATUSES.map((s) => <span key={s}><i style={{ background: COLOR[s] }} />{s}</span>)}</div>
        </div>
      )}

      {t === 'overview' && (
        <div className="grid g3">
          <Card title="Prochaines réservations" icon="calendar">
            {db.bookings.filter((b) => b.start >= TODAY && b.status !== 'Annulée').sort((a, b) => a.start.localeCompare(b.start)).slice(0, 8).map((b) => (
              <div key={b.id} className="row small" style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setEdit({ ...b })}>
                <div style={{ flex: 1 }}><b>{b.title}</b><div className="muted">{client(b.clientId)?.name} · {fdate(b.start)}</div></div>
                <Badge color={BADGE[b.status]}>J-{daysBetween(TODAY, b.start)}</Badge>
              </div>
            ))}
          </Card>
          <div className="span2">
            <DataTable rows={rows} exportName="reservations" onRowClick={(r) => setEdit({ ...r })} searchKeys={['title', (r) => client(r.clientId)?.name, (r) => product(r.productId)?.name]}
              filters={[{ key: 'status', label: 'Statut', options: STATUSES }]}
              columns={[
                { key: 'start', label: 'Période', render: (r) => `${fdate(r.start)}${r.end && r.end !== r.start ? ' → ' + fdate(r.end) : ''}` },
                { key: 'title', label: 'Réservation', strong: true },
                { key: 'product', label: 'Matériel', sort: (r) => product(r.productId)?.name, render: (r) => product(r.productId)?.name || '—', csv: (r) => product(r.productId)?.name },
                { key: 'client', label: 'Client', sort: (r) => client(r.clientId)?.name, render: (r) => client(r.clientId)?.name, csv: (r) => client(r.clientId)?.name },
                { key: 'owner', label: 'Responsable', render: (r) => owner(r.ownerId), csv: (r) => owner(r.ownerId) },
                { key: 'status', label: 'Statut', render: (r) => <Badge color={BADGE[r.status]}>{r.status}</Badge>, csv: (r) => r.status },
              ]} />
          </div>
        </div>
      )}

      {edit && (
        <Modal title={edit.id ? 'Modifier la réservation' : 'Nouvelle réservation'} onClose={() => setEdit(null)}
          footer={<>{edit.id && <button className="btn danger" onClick={() => { setDel(edit); setEdit(null) }}><Icon name="trash" size={15} /></button>}<span className="spacer" /><button className="btn" onClick={() => setEdit(null)}>Annuler</button><button className="btn primary" onClick={save}><Icon name="check" size={15} />Enregistrer</button></>}>
          <div className="form">
            <Field label="Titre" full><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="Matériel"><select value={edit.productId} onChange={(e) => setEdit({ ...edit, productId: e.target.value })}>{equip.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Client"><select value={edit.clientId} onChange={(e) => setEdit({ ...edit, clientId: e.target.value })}>{db.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Du"><input type="date" value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value, end: edit.end < e.target.value ? e.target.value : edit.end })} /></Field>
            <Field label="Au"><input type="date" value={edit.end} onChange={(e) => setEdit({ ...edit, end: e.target.value })} /></Field>
            <Field label="Statut"><select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Responsable"><select value={edit.ownerId} onChange={(e) => setEdit({ ...edit, ownerId: e.target.value })}>{db.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
            <Field label="Notes" full><textarea value={edit.notes || ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
          </div>
          {conflicts.length > 0 && (
            <div className="insight" style={{ marginTop: 14, borderColor: 'var(--amber)' }}>
              <div className="ii" style={{ background: COLORS.amber + '1a', color: COLORS.amber }}><Icon name="alert" size={16} /></div>
              <div className="small"><b>Matériel déjà réservé sur ces dates</b>{conflicts.map((b) => <div key={b.id} className="muted">{b.title} — {client(b.clientId)?.name} ({fdate(b.start)} → {fdate(b.end || b.start)}, {b.status})</div>)}</div>
            </div>
          )}
        </Modal>
      )}
      {del && <Confirm text={`Supprimer la réservation « ${del.title} » ?`} onClose={() => setDel(null)} onYes={() => { remove('bookings', del.id); toast('Réservation supprimée') }} />}
    </div>
  )
}

