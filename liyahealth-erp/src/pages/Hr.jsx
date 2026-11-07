import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { go, useRoute } from '../lib/nav.js'
import { PageHead, Kpi, Tabs, Card, BarChart, LineChart, Modal, Field, Icon, Badge, Empty, DataTable, COLORS } from '../components/ui.jsx'
import CrudPage from '../components/CrudPage.jsx'
import { TODAY, addDays, daysBetween, fdate, money, moneyK, int, MONTHS } from '../lib/domain.js'

const DEPTS = ['Direction', 'Commercial', 'SAV / Technique', 'Appels d\'offres', 'Logistique', 'Finance', 'Qualité']
const LEAVE_TYPES = ['Congé annuel', 'Congé maladie', 'Congé sans solde', 'Congé maternité', 'Congé paternité', 'Congé exceptionnel']
// Estimations des charges patronales (Maroc) — à valider avec le cabinet social.
const CNSS_RATE = 0.2109, CNSS_CAP = 6000, AMO_RATE = 0.0411
// Retenues salariales (estimation) : CNSS 4,48 % plafonnée à 6 000 DH, AMO 2,26 %, IR estimé 12 %.
const salaryDeductions = (gross) => Math.round(Math.min(gross, CNSS_CAP) * 0.0448 + gross * 0.0226 + gross * 0.12)

const employerCost = (salary) => {
  const cnss = Math.min(salary, CNSS_CAP) * CNSS_RATE
  const amo = salary * AMO_RATE
  return { cnss, amo, total: salary + cnss + amo }
}
const toMin = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m }
const worked = (a) => { const i = toMin(a.in), o = toMin(a.out); return i != null && o != null && o > i ? (o - i) / 60 : null }
const nowHM = () => new Date().toTimeString().slice(0, 5)
const periodLabel = (p) => `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`
const TABS = [['dashboard', 'Tableau de bord RH'], ['me', 'Mon espace'], ['employees', 'Employés'], ['attendance', 'Absences'], ['leaves', 'Congés'], ['payslips', 'Paie'], ['payroll', 'Masse salariale']]

export default function Hr() {
  const { db, add, update, toast, log } = useStore()
  const route = useRoute()
  const tab = TABS.some(([id]) => id === route.tab) ? route.tab : 'dashboard'
  const setTab = (t) => go('hr', t)
  const [leave, setLeave] = useState(null)

  const active = db.employees.filter((e) => e.status !== 'Inactif')
  const payroll = active.reduce((s, e) => s + Number(e.salary || 0), 0)
  const pending = db.leaves.filter((l) => l.status === 'En attente')
  const emp = (id) => db.employees.find((e) => e.id === id)
  const days = (l) => daysBetween(l.from, l.to) + 1

  const decide = (l, status) => {
    update('leaves', l.id, { status })
    if (status === 'Approuvé') {
      const e = emp(l.employeeId)
      if (e && l.type === 'Congé annuel') update('employees', e.id, { leaveBalance: Math.max(0, Number(e.leaveBalance || 0) - days(l)) })
    }
    log(`Congé ${status.toLowerCase()} : ${emp(l.employeeId)?.name}`, 'calendar')
    toast(`Demande ${status === 'Approuvé' ? 'approuvée' : 'rejetée'}`)
  }
  const saveLeave = () => {
    if (!leave.employeeId || !leave.from || !leave.to || leave.to < leave.from) return toast('Renseignez un employé et des dates valides')
    add('leaves', { ...leave, status: 'En attente' })
    toast('Demande de congé enregistrée'); setLeave(null)
  }
  const newLeave = (employeeId = '') => setLeave({ employeeId, type: 'Congé annuel', from: addDays(TODAY, 7), to: addDays(TODAY, 11) })

  const totals = active.reduce((acc, e) => { const c = employerCost(Number(e.salary || 0)); acc.brut += Number(e.salary || 0); acc.cnss += c.cnss; acc.amo += c.amo; acc.total += c.total; return acc }, { brut: 0, cnss: 0, amo: 0, total: 0 })
  const today = db.attendance.filter((a) => a.date === TODAY)
  const present = today.filter((a) => a.in).length

  return (
    <div className="stack">
      <PageHead title="Ressources humaines" sub="Équipe LIYA HEALTH : employés, présence, congés et salaires." crumbs="Finance & RH">
        <button className="btn primary" onClick={() => newLeave()}><Icon name="calendar" size={15} />Demande de congé</button>
      </PageHead>
      <div className="grid g4">
        <Kpi label="Effectif" value={int(active.length)} icon="users" color="navy" foot={`${DEPTS.filter((d) => active.some((e) => e.dept === d)).length} départements`} />
        <Kpi label="Présents aujourd'hui" value={`${present} / ${active.length}`} icon="check" color="green" foot={`Taux de présence ${active.length ? Math.round((present / active.length) * 100) : 0} %`} />
        <Kpi label="Congés en attente" value={int(pending.length)} icon="clock" color="amber" foot="Demandes à valider" />
        <Kpi label="Masse salariale mensuelle" value={moneyK(payroll)} icon="wallet" color="teal" foot={`Coût employeur estimé ${moneyK(totals.total)}`} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={TABS} />

      {tab === 'dashboard' && <HrDashboard active={active} />}
      {tab === 'me' && <MySpace onLeave={newLeave} />}
      {tab === 'attendance' && <Attendance active={active} />}
      {tab === 'payslips' && <Payslips active={active} />}

      {tab === 'employees' && (
        <CrudPage col="employees" entity="Employé" defaults={{ matricule: `LH${String(db.employees.length + 1).padStart(3, '0')}`, status: 'Actif', hireDate: TODAY, leaveBalance: 18 }}
          searchKeys={['name', 'role', 'dept', 'matricule', 'email']}
          filters={[{ key: 'dept', label: 'Département', options: DEPTS }, { key: 'status', label: 'Statut', options: ['Actif', 'En congé', 'Inactif'] }]}
          fields={[
            { key: 'matricule', label: 'Matricule' }, { key: 'name', label: 'Nom complet' }, { key: 'role', label: 'Poste' },
            { key: 'dept', label: 'Département', type: 'select', options: DEPTS }, { key: 'phone', label: 'Téléphone' }, { key: 'email', label: 'E-mail', type: 'email' },
            { key: 'hireDate', label: 'Date d\'embauche', type: 'date' }, { key: 'salary', label: 'Salaire brut mensuel (DH)', type: 'number' },
            { key: 'cnss', label: 'N° CNSS' }, { key: 'leaveBalance', label: 'Solde de congés (j)', type: 'number' },
            { key: 'status', label: 'Statut', type: 'select', options: ['Actif', 'En congé', 'Inactif'], placeholder: false },
          ]}
          columns={[
            { key: 'matricule', label: 'Matricule' },
            { key: 'name', label: 'Employé', strong: true, render: (r) => <div className="row"><div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{r.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</div><div>{r.name}<div className="muted small">{r.role}</div></div></div> },
            { key: 'dept', label: 'Département' }, { key: 'hireDate', label: 'Embauche', render: (r) => fdate(r.hireDate) },
            { key: 'salary', label: 'Salaire brut', right: true, render: (r) => money(r.salary) },
            { key: 'leaveBalance', label: 'Congés (j)', right: true },
            { key: 'status', label: 'Statut', render: (r) => <Badge>{r.status}</Badge> },
          ]} />
      )}

      {tab === 'leaves' && (
        <Card title="Demandes de congés" icon="calendar" pad={false}>
          {!db.leaves.length ? <Empty icon="calendar" title="Aucune demande">Les demandes de congés apparaîtront ici.</Empty> : (
            <div className="table-wrap"><table className="t">
              <thead><tr><th>Employé</th><th>Type</th><th>Du</th><th>Au</th><th className="right">Jours</th><th>Solde</th><th>Statut</th><th /></tr></thead>
              <tbody>{[...db.leaves].sort((a, b) => b.from.localeCompare(a.from)).map((l) => (
                <tr key={l.id}>
                  <td className="strong">{emp(l.employeeId)?.name || '—'}<div className="muted small">{emp(l.employeeId)?.dept}</div></td>
                  <td>{l.type}</td><td>{fdate(l.from)}</td><td>{fdate(l.to)}</td><td className="right num">{days(l)}</td>
                  <td>{emp(l.employeeId)?.leaveBalance ?? '—'} j</td>
                  <td><Badge>{l.status}</Badge></td>
                  <td className="right">{l.status === 'En attente' && (
                    <span className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn sm primary" onClick={() => decide(l, 'Approuvé')}><Icon name="check" size={14} />Approuver</button>
                      <button className="btn sm danger" onClick={() => decide(l, 'Rejeté')}><Icon name="x" size={14} />Rejeter</button>
                    </span>
                  )}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      )}

      {tab === 'payroll' && (
        <div className="grid g2">
          <Card title="Masse salariale par département" icon="chart">
            <BarChart labels={DEPTS.map((d) => d.split(' ')[0])} series={[{ name: 'Brut mensuel', data: DEPTS.map((d) => active.filter((e) => e.dept === d).reduce((s, e) => s + Number(e.salary || 0), 0)), color: COLORS.teal }]} />
          </Card>
          <Card title="Coût employeur mensuel (estimation)" icon="wallet" pad={false}>
            <div className="table-wrap"><table className="t">
              <thead><tr><th>Département</th><th className="right">Brut</th><th className="right">CNSS patr.</th><th className="right">AMO</th><th className="right">Coût total</th></tr></thead>
              <tbody>
                {DEPTS.map((d) => {
                  const t = active.filter((e) => e.dept === d).reduce((acc, e) => { const c = employerCost(Number(e.salary || 0)); acc.brut += Number(e.salary || 0); acc.cnss += c.cnss; acc.amo += c.amo; acc.total += c.total; return acc }, { brut: 0, cnss: 0, amo: 0, total: 0 })
                  if (!t.brut) return null
                  return <tr key={d}><td className="strong">{d}</td><td className="right num">{money(t.brut)}</td><td className="right num">{money(t.cnss)}</td><td className="right num">{money(t.amo)}</td><td className="right num strong">{money(t.total)}</td></tr>
                })}
                <tr><td className="strong">Total</td><td className="right num strong">{money(totals.brut)}</td><td className="right num strong">{money(totals.cnss)}</td><td className="right num strong">{money(totals.amo)}</td><td className="right num strong">{money(totals.total)}</td></tr>
              </tbody>
            </table></div>
            <p className="muted small" style={{ padding: '0 18px 14px', margin: 0 }}>Estimation : CNSS patronale ≈ 21,09 % plafonnée à 6 000 DH, AMO 4,11 % ; hors taxe de formation professionnelle et allocations familiales. À valider avec le cabinet social.</p>
          </Card>
        </div>
      )}

      {leave && (
        <Modal title="Nouvelle demande de congé" onClose={() => setLeave(null)}
          footer={<><button className="btn" onClick={() => setLeave(null)}>Annuler</button><button className="btn primary" onClick={saveLeave}><Icon name="check" size={15} />Enregistrer</button></>}>
          <div className="form">
            <Field label="Employé" full><select value={leave.employeeId} onChange={(e) => setLeave({ ...leave, employeeId: e.target.value })}><option value="">—</option>{active.map((e) => <option key={e.id} value={e.id}>{e.name} — solde {e.leaveBalance} j</option>)}</select></Field>
            <Field label="Type"><select value={leave.type} onChange={(e) => setLeave({ ...leave, type: e.target.value })}>{LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Durée">{leave.from && leave.to && leave.to >= leave.from ? `${daysBetween(leave.from, leave.to) + 1} jour(s)` : '—'}</Field>
            <Field label="Du"><input type="date" value={leave.from} onChange={(e) => setLeave({ ...leave, from: e.target.value })} /></Field>
            <Field label="Au"><input type="date" value={leave.to} onChange={(e) => setLeave({ ...leave, to: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  )
}

function HrDashboard({ active }) {
  const { db } = useStore()
  const emp = (id) => db.employees.find((e) => e.id === id)
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(TODAY, i - 6))
  const trend = last7.map((d) => db.attendance.filter((a) => a.date === d && a.in).length)
  const absents = last7.map((d) => db.attendance.filter((a) => a.date === d && a.status === 'Absent').length)
  const onLeaveToday = db.leaves.filter((l) => l.status === 'Approuvé' && l.from <= TODAY && l.to >= TODAY)
  const upcoming = db.leaves.filter((l) => l.status !== 'Rejeté' && l.to >= TODAY).sort((a, b) => a.from.localeCompare(b.from))
  const todayAtt = db.attendance.filter((a) => a.date === TODAY)
  const absentToday = active.filter((e) => !todayAtt.some((a) => a.employeeId === e.id && a.in))
  return (
    <div className="grid g3">
      <Card title="Présence sur 7 jours" icon="activity" className="span2">
        <LineChart labels={last7.map((d) => fdate(d).slice(0, 6))} format={(v) => int(v)} series={[{ name: 'Présents', color: COLORS.green, data: trend }, { name: 'Absents', color: COLORS.red, data: absents }]} />
      </Card>
      <Card title="Aujourd'hui" icon="users">
        <div className="muted small" style={{ marginBottom: 8 }}>En congé</div>
        {onLeaveToday.length ? onLeaveToday.map((l) => <div key={l.id} className="row small" style={{ padding: '5px 0' }}><b style={{ flex: 1 }}>{emp(l.employeeId)?.name}</b><Badge color="amber">{l.type}</Badge></div>) : <div className="muted small">Personne en congé.</div>}
        <div className="muted small" style={{ margin: '14px 0 8px' }}>Non pointés / absents</div>
        {absentToday.length ? absentToday.map((e) => <div key={e.id} className="row small" style={{ padding: '5px 0' }}><span style={{ flex: 1 }}>{e.name}</span><span className="muted">{e.dept}</span></div>) : <div className="muted small">Tout le monde a pointé.</div>}
      </Card>
      <Card title="Calendrier des congés" icon="calendar" className="span2" pad={false}>
        <div className="table-wrap" style={{ marginTop: 12 }}><table className="t">
          <thead><tr><th>Employé</th><th>Type</th><th>Période</th><th className="right">Jours</th><th>Statut</th></tr></thead>
          <tbody>{upcoming.map((l) => (
            <tr key={l.id}><td className="strong">{emp(l.employeeId)?.name}</td><td>{l.type}</td><td>{fdate(l.from)} → {fdate(l.to)}{l.from <= TODAY && <Badge color="teal">en cours</Badge>}</td><td className="right num">{daysBetween(l.from, l.to) + 1}</td><td><Badge>{l.status}</Badge></td></tr>
          ))}</tbody>
        </table>{!upcoming.length && <div className="empty">Aucun congé à venir.</div>}</div>
      </Card>
      <Card title="Répartition par département" icon="layers">
        {DEPTS.map((d) => { const n = active.filter((e) => e.dept === d).length; return n ? <div key={d} className="row small" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}><span style={{ flex: 1 }}>{d}</span><b className="num">{n}</b></div> : null })}
      </Card>
    </div>
  )
}

function MySpace({ onLeave }) {
  const { db, setSettings } = useStore()
  const user = db.settings.user
  const me = db.employees.find((e) => e.id === user.employeeId)
  const [pick, setPick] = useState('')
  const [slip, setSlip] = useState(null)
  if (!me) {
    return (
      <Card title="Mon espace" icon="users">
        <p className="muted">Votre compte n'est pas encore lié à une fiche employé. Choisissez votre fiche pour accéder à vos congés, votre présence et vos bulletins de paie.</p>
        <div className="row wrap">
          <select className="input" style={{ maxWidth: 320 }} value={pick} onChange={(e) => setPick(e.target.value)}><option value="">— Choisir ma fiche —</option>{db.employees.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}</select>
          <button className="btn primary" disabled={!pick} onClick={() => setSettings({ user: { ...user, employeeId: pick } })}>Lier mon compte</button>
        </div>
      </Card>
    )
  }
  const myLeaves = db.leaves.filter((l) => l.employeeId === me.id).sort((a, b) => b.from.localeCompare(a.from))
  const week = Array.from({ length: 7 }, (_, i) => addDays(TODAY, i - 6))
  const myAtt = week.map((d) => ({ d, a: db.attendance.find((x) => x.employeeId === me.id && x.date === d) }))
  const mySlips = db.payslips.filter((p) => p.employeeId === me.id).sort((a, b) => b.period.localeCompare(a.period))
  return (
    <div className="grid g3">
      <Card title="Mon profil" icon="users">
        <div className="row" style={{ gap: 14 }}>
          <div className="avatar" style={{ width: 52, height: 52, fontSize: 17 }}>{me.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</div>
          <div><b style={{ fontSize: 16 }}>{me.name}</b><div className="muted">{me.role} · {me.dept}</div><div className="muted small">Matricule {me.matricule} · depuis le {fdate(me.hireDate)}</div></div>
        </div>
        <div className="grid g2" style={{ marginTop: 16, gap: 10 }}>
          <div><div className="muted small">Solde de congés</div><div style={{ fontSize: 22, fontWeight: 800 }}>{me.leaveBalance} j</div></div>
          <div><div className="muted small">Statut</div><Badge>{me.status}</Badge></div>
        </div>
        <div className="row wrap" style={{ marginTop: 14 }}>
          <button className="btn primary sm" onClick={() => onLeave(me.id)}><Icon name="calendar" size={14} />Demander un congé</button>
          <button className="btn sm ghost" onClick={() => setSettings({ user: { ...user, employeeId: '' } })}>Changer de fiche</button>
        </div>
      </Card>
      <Card title="Ma présence (7 jours)" icon="clock">
        {myAtt.map(({ d, a }) => (
          <div key={d} className="row small" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ flex: 1 }}>{fdate(d)}</span><span className="num muted">{a?.in || '—'} → {a?.out || '—'}</span>{a ? <Badge>{a.status}</Badge> : <Badge color="gray">—</Badge>}
          </div>
        ))}
      </Card>
      <Card title="Mes demandes de congés" icon="calendar">
        {myLeaves.length ? myLeaves.map((l) => <div key={l.id} className="row small" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}><div style={{ flex: 1 }}><b>{l.type}</b><div className="muted">{fdate(l.from)} → {fdate(l.to)}</div></div><Badge>{l.status}</Badge></div>) : <div className="muted small">Aucune demande.</div>}
      </Card>
      <Card title="Mes bulletins de paie" icon="file" className="span2" pad={false}>
        <div className="table-wrap" style={{ marginTop: 12 }}><table className="t">
          <thead><tr><th>Période</th><th className="right">Brut</th><th className="right">Retenues</th><th className="right">Net</th><th>Statut</th><th /></tr></thead>
          <tbody>{mySlips.map((p) => <tr key={p.id}><td className="strong">{periodLabel(p.period)}</td><td className="right num">{money(p.base + p.bonus)}</td><td className="right num">{money(p.deductions)}</td><td className="right num strong">{money(p.net)}</td><td><Badge color={p.status === 'Payé' ? 'green' : 'gray'}>{p.status}</Badge></td><td className="right"><button className="btn sm" onClick={() => setSlip(p)}>Voir</button></td></tr>)}</tbody>
        </table>{!mySlips.length && <div className="empty">Aucun bulletin.</div>}</div>
      </Card>
      {slip && <PayslipModal slip={slip} onClose={() => setSlip(null)} />}
    </div>
  )
}

function Attendance({ active }) {
  const { db, add, update, toast } = useStore()
  const emp = (id) => db.employees.find((e) => e.id === id)
  const checkIn = (e) => {
    const t = nowHM()
    const ex = db.attendance.find((a) => a.employeeId === e.id && a.date === TODAY)
    const status = toMin(t) > 9 * 60 ? 'Retard' : 'Présent'
    if (ex) update('attendance', ex.id, { in: t, status })
    else add('attendance', { employeeId: e.id, date: TODAY, in: t, out: '', status })
    toast(`Arrivée pointée : ${e.name} à ${t}`)
  }
  const checkOut = (a) => { const t = nowHM(); update('attendance', a.id, { out: t }); toast(`Départ pointé à ${t}`) }
  const rows = useMemo(() => [...db.attendance].sort((a, b) => b.date.localeCompare(a.date)), [db.attendance])
  return (
    <div className="stack">
      <Card title={`Feuille de pointage — ${fdate(TODAY)}`} icon="clock" pad={false}>
        <div className="table-wrap" style={{ marginTop: 12 }}><table className="t">
          <thead><tr><th>Employé</th><th>Arrivée</th><th>Départ</th><th>Statut</th><th className="right">Actions</th></tr></thead>
          <tbody>{active.map((e) => {
            const a = db.attendance.find((x) => x.employeeId === e.id && x.date === TODAY)
            return (
              <tr key={e.id}>
                <td className="strong">{e.name}<div className="muted small">{e.dept}</div></td>
                <td className="num">{a?.in || '—'}</td><td className="num">{a?.out || '—'}</td>
                <td>{a ? <Badge>{a.status}</Badge> : <span className="muted">Non pointé</span>}</td>
                <td className="right"><span className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                  {!a?.in && <button className="btn sm primary" onClick={() => checkIn(e)}><Icon name="check" size={13} />Pointer l'arrivée</button>}
                  {a?.in && !a.out && <button className="btn sm" onClick={() => checkOut(a)}><Icon name="logout" size={13} />Pointer le départ</button>}
                </span></td>
              </tr>
            )
          })}</tbody>
        </table></div>
      </Card>
      <DataTable rows={rows} exportName="presence" searchKeys={[(r) => emp(r.employeeId)?.name]}
        filters={[{ key: 'employeeId', label: 'Employé', options: db.employees.map((e) => e.name), get: (r) => emp(r.employeeId)?.name }, { key: 'status', label: 'Statut', options: ['Présent', 'Retard', 'Absent', 'Demi-journée'] }]}
        columns={[
          { key: 'date', label: 'Date', render: (r) => fdate(r.date) },
          { key: 'emp', label: 'Employé', strong: true, sort: (r) => emp(r.employeeId)?.name, render: (r) => emp(r.employeeId)?.name, csv: (r) => emp(r.employeeId)?.name },
          { key: 'in', label: 'Arrivée', render: (r) => r.in || '—' },
          { key: 'out', label: 'Départ', render: (r) => r.out || '—' },
          { key: 'hours', label: 'Heures', right: true, sort: (r) => worked(r) ?? -1, render: (r) => { const h = worked(r); return h == null ? '—' : `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}` }, csv: (r) => worked(r)?.toFixed(2) ?? '' },
          { key: 'status', label: 'Statut', render: (r) => <Badge color={r.status === 'Absent' ? 'red' : r.status === 'Retard' ? 'amber' : r.status === 'Demi-journée' ? 'blue' : 'green'}>{r.status}</Badge>, csv: (r) => r.status },
        ]} />
    </div>
  )
}

function Payslips({ active }) {
  const { db, mutate, update, toast, log } = useStore()
  const [slip, setSlip] = useState(null)
  const period = TODAY.slice(0, 7)
  const emp = (id) => db.employees.find((e) => e.id === id)
  const current = db.payslips.filter((p) => p.period === period)
  const missing = active.filter((e) => !current.some((p) => p.employeeId === e.id))
  const lastPeriod = [...new Set(db.payslips.map((p) => p.period))].sort().at(-1)
  const monthCost = db.payslips.filter((p) => p.period === (current.length ? period : lastPeriod)).reduce((s, p) => s + p.base + p.bonus + employerCost(p.base + p.bonus).cnss + employerCost(p.base + p.bonus).amo, 0)
  const generate = () => {
    const n = missing.length
    mutate((d) => {
      for (const e of missing) {
        const gross = Number(e.salary || 0)
        const deductions = salaryDeductions(gross)
        d.payslips.unshift({ id: `pa-${period}-${e.id}`, employeeId: e.id, period, base: gross, bonus: 0, deductions, net: gross - deductions, status: 'Brouillon' })
      }
    })
    log(`Paie ${periodLabel(period)} générée (${n} bulletins)`, 'wallet')
    toast(`${n} bulletin(s) générés en brouillon`)
  }
  const rows = useMemo(() => [...db.payslips].sort((a, b) => b.period.localeCompare(a.period)), [db.payslips])
  return (
    <div className="stack">
      <div className="grid g3">
        <Kpi label="Coût total mensuel (estimation)" value={moneyK(monthCost)} icon="wallet" color="teal" foot={`Période ${periodLabel(current.length ? period : lastPeriod || period)}`} />
        <Kpi label="Net à payer (brouillons)" value={moneyK(db.payslips.filter((p) => p.status === 'Brouillon').reduce((s, p) => s + p.net, 0))} icon="money" color="amber" foot={`${db.payslips.filter((p) => p.status === 'Brouillon').length} bulletin(s)`} />
        <Kpi label={`Paie ${periodLabel(period)}`} value={`${current.length} / ${active.length}`} icon="file" color="navy" foot={missing.length ? `${missing.length} à générer` : 'Complète'} />
      </div>
      <DataTable rows={rows} exportName="paie" searchKeys={[(r) => emp(r.employeeId)?.name, 'period']}
        filters={[{ key: 'status', label: 'Statut', options: ['Brouillon', 'Payé'] }, { key: 'period', label: 'Période', options: [...new Set(db.payslips.map((p) => p.period))].sort().reverse() }]}
        actions={<button className="btn primary sm" disabled={!missing.length} onClick={generate}><Icon name="plus" size={14} />Générer la paie du mois</button>}
        onRowClick={setSlip}
        columns={[
          { key: 'period', label: 'Période', render: (r) => periodLabel(r.period) },
          { key: 'emp', label: 'Employé', strong: true, sort: (r) => emp(r.employeeId)?.name, render: (r) => emp(r.employeeId)?.name, csv: (r) => emp(r.employeeId)?.name },
          { key: 'base', label: 'Base', right: true, render: (r) => money(r.base) },
          { key: 'bonus', label: 'Primes', right: true, render: (r) => money(r.bonus) },
          { key: 'deductions', label: 'Retenues', right: true, render: (r) => money(r.deductions) },
          { key: 'net', label: 'Net', right: true, render: (r) => <b>{money(r.net)}</b> },
          { key: 'status', label: 'Statut', render: (r) => <Badge color={r.status === 'Payé' ? 'green' : 'gray'}>{r.status}</Badge>, csv: (r) => r.status },
          { key: 'act', label: '', noSort: true, noExport: true, render: (r) => r.status === 'Brouillon' && <button className="btn sm" onClick={(e) => { e.stopPropagation(); update('payslips', r.id, { status: 'Payé' }); toast('Bulletin marqué payé') }}><Icon name="check" size={13} />Marquer payé</button> },
        ]} />
      <p className="muted small" style={{ margin: 0 }}>Retenues estimées : CNSS salariale 4,48 % (plafonnée à 6 000 DH) + AMO 2,26 % + IR estimé à 12 %. À valider avec le cabinet social.</p>
      {slip && <PayslipModal slip={slip} onClose={() => setSlip(null)} />}
    </div>
  )
}

function PayslipModal({ slip, onClose }) {
  const { db } = useStore()
  const e = db.employees.find((x) => x.id === slip.employeeId)
  const co = db.settings.company
  const gross = slip.base + slip.bonus
  const cnss = Math.round(Math.min(gross, CNSS_CAP) * 0.0448), amo = Math.round(gross * 0.0226)
  const ir = Math.max(0, slip.deductions - cnss - amo)
  const row = (l, v, b) => <tr><td>{l}</td><td style={{ textAlign: 'right', fontWeight: b ? 700 : 400 }}>{money(v)}</td></tr>
  return (
    <Modal title={`Bulletin de paie — ${e?.name}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Fermer</button><button className="btn primary" onClick={() => window.print()}><Icon name="printer" size={15} />Imprimer / PDF</button></>}>
      <div className="print-area">
        <div className="print-doc" style={{ borderRadius: 12, border: '1px solid #e3e9f1' }}>
          <div className="print-band" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, gap: 16, flexWrap: 'wrap' }}>
            <div><div style={{ fontWeight: 800, fontSize: 17, color: '#0b2545' }}>{co.name}</div><div style={{ fontSize: 11.5, color: '#64748b' }}>{co.address}<br />CNSS {co.cnss} · ICE {co.ice}</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 800, fontSize: 18, color: '#0b2545' }}>BULLETIN DE PAIE</div><div>{periodLabel(slip.period)}</div><div style={{ fontSize: 12, color: '#64748b' }}>{slip.status}</div></div>
          </div>
          <div style={{ marginTop: 14, padding: 12, background: '#f4f7fb', borderRadius: 10, fontSize: 12.5 }}>
            <b>{e?.name}</b> — {e?.role} ({e?.dept})<br />Matricule {e?.matricule} · N° CNSS {e?.cnss} · Embauche {fdate(e?.hireDate)}
          </div>
          <table><thead><tr><th>Rubrique</th><th style={{ textAlign: 'right' }}>Montant</th></tr></thead>
            <tbody>{row('Salaire de base', slip.base)}{row('Primes', slip.bonus)}{row('Salaire brut', gross, true)}{row('CNSS salariale (4,48 %)', -cnss)}{row('AMO (2,26 %)', -amo)}{row('IR (estimation)', -ir)}{row('Total retenues', -slip.deductions, true)}</tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><div style={{ padding: '8px 14px', background: '#0b2545', color: '#fff', borderRadius: 8, fontWeight: 700 }}>Net à payer : {money(slip.net)}</div></div>
          <div style={{ marginTop: 16, fontSize: 10.5, color: '#64748b', textAlign: 'center' }}>Retenues estimées — document indicatif à valider par le cabinet social.</div>
        </div>
      </div>
    </Modal>
  )
}
