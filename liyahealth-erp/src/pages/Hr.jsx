import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { useRoute } from '../lib/nav.js'
import { PageHead, Kpi, Tabs, Card, BarChart, Modal, Field, Icon, Badge, Empty, COLORS } from '../components/ui.jsx'
import CrudPage from '../components/CrudPage.jsx'
import { TODAY, addDays, daysBetween, fdate, money, moneyK, int } from '../lib/domain.js'

const DEPTS = ['Direction', 'Commercial', 'SAV / Technique', 'Appels d\'offres', 'Logistique', 'Finance', 'Qualité']
const LEAVE_TYPES = ['Congé annuel', 'Congé maladie', 'Congé maternité / paternité', 'Congé exceptionnel', 'Sans solde']
// Estimations des charges patronales (Maroc) — à valider avec le cabinet social.
const CNSS_RATE = 0.2109, CNSS_CAP = 6000, AMO_RATE = 0.0411

const employerCost = (salary) => {
  const cnss = Math.min(salary, CNSS_CAP) * CNSS_RATE
  const amo = salary * AMO_RATE
  return { cnss, amo, total: salary + cnss + amo }
}

export default function Hr() {
  const { db, add, update, toast, log } = useStore()
  const route = useRoute()
  const [tab, setTab] = useState(['employees', 'leaves', 'payroll'].includes(route.tab) ? route.tab : 'employees')
  const [leave, setLeave] = useState(null)

  const active = db.employees.filter((e) => e.status !== 'Inactif')
  const payroll = active.reduce((s, e) => s + Number(e.salary || 0), 0)
  const pending = db.leaves.filter((l) => l.status === 'En attente')
  const seniority = active.length ? active.reduce((s, e) => s + daysBetween(e.hireDate, TODAY), 0) / active.length / 365 : 0
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

  const byDept = DEPTS.map((d) => active.filter((e) => e.dept === d))
  const totals = active.reduce((acc, e) => { const c = employerCost(Number(e.salary || 0)); acc.brut += Number(e.salary || 0); acc.cnss += c.cnss; acc.amo += c.amo; acc.total += c.total; return acc }, { brut: 0, cnss: 0, amo: 0, total: 0 })

  return (
    <div className="stack">
      <PageHead title="Ressources humaines" sub="Équipe LIYA HEALTH : employés, congés et masse salariale." crumbs="Finance & RH">
        <button className="btn primary" onClick={() => setLeave({ employeeId: '', type: 'Congé annuel', from: addDays(TODAY, 7), to: addDays(TODAY, 11) })}><Icon name="calendar" size={15} />Demande de congé</button>
      </PageHead>
      <div className="grid g4">
        <Kpi label="Effectif" value={int(active.length)} icon="users" color="navy" foot={`${DEPTS.filter((d) => active.some((e) => e.dept === d)).length} départements`} />
        <Kpi label="Masse salariale mensuelle" value={moneyK(payroll)} icon="wallet" color="teal" foot={`Coût employeur estimé ${moneyK(totals.total)}`} />
        <Kpi label="Congés en attente" value={int(pending.length)} icon="clock" color="amber" foot="Demandes à valider" />
        <Kpi label="Ancienneté moyenne" value={`${seniority.toFixed(1).replace('.', ',')} ans`} icon="activity" color="violet" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['employees', 'Employés'], ['leaves', 'Congés'], ['payroll', 'Masse salariale']]} />

      {tab === 'employees' && (
        <CrudPage col="employees" entity="Employé" defaults={{ matricule: `LH${String(db.employees.length + 1).padStart(3, '0')}`, status: 'Actif', hireDate: TODAY, leaveBalance: 18 }}
          searchKeys={['name', 'role', 'dept', 'matricule', 'email']}
          filters={[{ key: 'dept', label: 'Département', options: DEPTS }, { key: 'status', label: 'Statut', options: ['Actif', 'En congé', 'Inactif'] }]}
          fields={[
            { key: 'matricule', label: 'Matricule' }, { key: 'name', label: 'Nom complet' }, { key: 'role', label: 'Fonction' },
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
            <BarChart labels={DEPTS.map((d) => d.split(' ')[0])} series={[{ name: 'Brut mensuel', data: byDept.map((l) => l.reduce((s, e) => s + Number(e.salary || 0), 0)), color: COLORS.teal }]} />
          </Card>
          <Card title="Coût employeur mensuel (estimation)" icon="wallet" pad={false}>
            <div className="table-wrap"><table className="t">
              <thead><tr><th>Département</th><th className="right">Brut</th><th className="right">CNSS patr.</th><th className="right">AMO</th><th className="right">Coût total</th></tr></thead>
              <tbody>
                {DEPTS.map((d, i) => {
                  const t = byDept[i].reduce((acc, e) => { const c = employerCost(Number(e.salary || 0)); acc.brut += Number(e.salary || 0); acc.cnss += c.cnss; acc.amo += c.amo; acc.total += c.total; return acc }, { brut: 0, cnss: 0, amo: 0, total: 0 })
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
