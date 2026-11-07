import { useMemo, useState } from 'react'
import { statusColor } from '../lib/domain.js'

// ---------- Icônes (tracés type « lucide », MIT) ----------
const P = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  chart: 'M3 3v18h18M7 16l4-4 4 4 5-6',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  cart: 'M6 6h15l-1.5 9h-12zM6 6 5 3H2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h4M8 11h4M8 15h4',
  gavel: 'm14 13-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10M16 16l6-6M8 8l6-6M9 7l8 8M21 11l-8-8',
  truck: 'M1 4h14v12H1zM15 9h4l3 3v4h-7M5.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
  box: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  wrench: 'M14.7 6.3a4 4 0 0 0 5 5L22 14l-8 8-2.3-2.3a4 4 0 0 0-5-5L2 10l8-8z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  wallet: 'M20 7H5a2 2 0 0 1 0-4h13v4M3 5v14a2 2 0 0 0 2 2h15V7M16 14h.01',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9zM5 2l.6 1.4L7 4l-1.4.6L5 6l-.6-1.4L3 4l1.4-.6z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  plus: 'M12 5v14M5 12h14',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  printer: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
  up: 'M7 17 17 7M7 7h10v10',
  down: 'M7 7l10 10M17 7v10H7',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  calendar: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  menu: 'M3 12h18M3 6h18M3 18h18',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  trend: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  layers: 'M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
  copy: 'M9 9h13v13H9zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  money: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  pulse: 'M3 12h4l2-5 4 10 2-5h6',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  brain: 'M9.5 2A2.5 2.5 0 0 0 7 4.5v.1A3 3 0 0 0 4.5 9a3 3 0 0 0 0 5A3 3 0 0 0 7 19.4v.1A2.5 2.5 0 0 0 12 20V4.5A2.5 2.5 0 0 0 9.5 2zM14.5 2A2.5 2.5 0 0 1 17 4.5v.1A3 3 0 0 1 19.5 9a3 3 0 0 1 0 5 3 3 0 0 1-2.5 5.4v.1A2.5 2.5 0 0 1 12 20',
  key: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zM15.5 7.5l3 3L22 7l-3-3',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  register: 'M3 10h18v10H3zM6 10V5h12v5M7 14h2M11 14h2M15 14h2M7 17h10',
  contract: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5M15 19l2-2 3 3',
  repeat: 'M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h3l6 5V5L7 10H4a1 1 0 0 0-1 1zM17 8a5 5 0 0 1 0 8M20 5a9 9 0 0 1 0 14',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  calculator: 'M5 2h14v20H5zM8 6h8v4H8zM8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01',
  barcode: 'M3 5v14M7 5v14M10 5v14M14 5v14M17 5v14M21 5v14',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  scan: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
}
export function Icon({ name, size = 18, stroke = 2, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      <path d={P[name] || P.grid} />
    </svg>
  )
}

export const COLORS = { navy: '#0b2545', teal: '#13a89e', green: '#3bb273', amber: '#e8a33d', red: '#e05263', violet: '#7b61ff', blue: '#3d7be0', gray: '#64748b' }
export const SERIES = ['#13a89e', '#0b2545', '#3bb273', '#e8a33d', '#7b61ff', '#3d7be0', '#e05263', '#64748b']

export const Badge = ({ children, color }) => <span className={`badge b-${color || statusColor(children)}`}>{children}</span>

export function Card({ title, action, children, className = '', pad = true, icon }) {
  return (
    <div className={`card ${className}`}>
      {(title || action) && (
        <div className="card-h">
          {icon && <Icon name={icon} size={17} />}
          <h3>{title}</h3>
          <div className="spacer" />
          {action}
        </div>
      )}
      {pad ? <div className="card-b">{children}</div> : children}
    </div>
  )
}

export function Kpi({ label, value, icon, color = 'teal', delta, foot, spark }) {
  const c = COLORS[color] || color
  return (
    <div className="card kpi">
      <div className="kpi-top">
        <div className="kpi-ico" style={{ background: c + '1a', color: c }}><Icon name={icon} size={17} /></div>
        {label}
      </div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="kpi-val num">{value}</div>
        <div className="spacer" />
        {spark && <Sparkline data={spark} color={c} />}
      </div>
      {(delta !== undefined || foot) && (
        <div className="kpi-foot">
          {delta !== undefined && Number.isFinite(delta) && (
            <span className={delta >= 0 ? 'up' : 'down'} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 700 }}>
              <Icon name={delta >= 0 ? 'up' : 'down'} size={13} />{Math.abs(delta * 100).toFixed(1)} %
            </span>
          )}
          <span className="muted">{foot}</span>
        </div>
      )}
    </div>
  )
}

export function PageHead({ title, sub, crumbs, children }) {
  return (
    <div className="page-head">
      <div>
        {crumbs && <div className="crumbs">{crumbs}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className="spacer" />
      <div className="row wrap">{children}</div>
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => {
        const [id, label] = Array.isArray(t) ? t : [t, t]
        return <button key={id} role="tab" className={`tab ${value === id ? 'active' : ''}`} onClick={() => onChange(id)}>{label}</button>
      })}
    </div>
  )
}

export function Seg({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map(([id, label]) => <button key={id} className={value === id ? 'active' : ''} onClick={() => onChange(id)}>{label}</button>)}
    </div>
  )
}

export function Modal({ title, onClose, children, footer, size }) {
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size || ''}`} role="dialog" aria-modal="true">
        <div className="modal-h">
          <h3>{title}</h3>
          <div className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Fermer"><Icon name="x" /></button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children, full }) {
  return <div className={`field ${full ? 'full' : ''}`}><label>{label}</label>{children}</div>
}

// Formulaire générique piloté par une liste de champs
export function FormFields({ fields, value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  return (
    <div className="form">
      {fields.map((f) => (
        <Field key={f.key} label={f.label} full={f.full || f.type === 'textarea'}>
          {f.type === 'select' ? (
            <select value={value[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}>
              {f.placeholder !== false && <option value="">—</option>}
              {f.options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>))}
            </select>
          ) : f.type === 'textarea' ? (
            <textarea value={value[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
          ) : f.type === 'checkbox' ? (
            <label className="switch"><input type="checkbox" checked={!!value[f.key]} onChange={(e) => set(f.key, e.target.checked)} /><span /></label>
          ) : (
            <input type={f.type || 'text'} value={value[f.key] ?? ''} step={f.step} onChange={(e) => set(f.key, f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />
          )}
        </Field>
      ))}
    </div>
  )
}

// Tableau de données : recherche, filtres, tri, pagination, export CSV.
export function DataTable({ rows, columns, onRowClick, searchKeys, filters = [], actions, pageSize = 12, empty = 'Aucun élément', exportName }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState(null)
  const [page, setPage] = useState(0)
  const [fv, setFv] = useState({})

  const filtered = useMemo(() => {
    let r = rows
    if (q) {
      const s = q.toLowerCase()
      r = r.filter((row) => (searchKeys ? searchKeys.map((k) => (typeof k === 'function' ? k(row) : row[k])) : Object.values(row)).some((v) => String(v ?? '').toLowerCase().includes(s)))
    }
    for (const f of filters) if (fv[f.key]) r = r.filter((row) => String(f.get ? f.get(row) : row[f.key]) === fv[f.key])
    if (sort) {
      const col = columns.find((c) => c.key === sort.key)
      const get = col.sort || ((x) => x[col.key])
      r = [...r].sort((a, b) => { const A = get(a), B = get(b); return (A > B ? 1 : A < B ? -1 : 0) * sort.dir })
    }
    return r
  }, [rows, q, sort, fv, filters, columns, searchKeys])

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const cur = Math.min(page, pages - 1)
  const slice = filtered.slice(cur * pageSize, cur * pageSize + pageSize)

  const exportCsv = () => {
    const head = columns.filter((c) => !c.noExport).map((c) => c.label)
    const lines = filtered.map((row) => columns.filter((c) => !c.noExport).map((c) => {
      const v = c.csv ? c.csv(row) : c.sort ? c.sort(row) : row[c.key]
      return `"${String(v ?? '').replace(/"/g, '""')}"`
    }).join(';'))
    const blob = new Blob(['﻿' + [head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${exportName || 'export'}.csv`; a.click()
  }

  return (
    <div className="card">
      <div className="toolbar">
        <div className="search" style={{ maxWidth: 300 }}>
          <Icon name="search" size={16} />
          <input placeholder="Rechercher…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} style={{ paddingLeft: 36 }} />
        </div>
        {filters.map((f) => (
          <select key={f.key} value={fv[f.key] || ''} onChange={(e) => { setFv({ ...fv, [f.key]: e.target.value }); setPage(0) }}>
            <option value="">{f.label} : tous</option>
            {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <div className="spacer" />
        <span className="muted small">{filtered.length} résultat(s)</span>
        <button className="btn sm" onClick={exportCsv} title="Exporter en CSV"><Icon name="download" size={14} />CSV</button>
        {actions}
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.right ? 'right' : ''} onClick={() => !c.noSort && setSort((s) => ({ key: c.key, dir: s?.key === c.key ? -s.dir : 1 }))}>
                  {c.label}{sort?.key === c.key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => (
              <tr key={row.id} className={onRowClick ? 'click' : ''} onClick={() => onRowClick?.(row)}>
                {columns.map((c) => <td key={c.key} className={`${c.right ? 'right num' : ''} ${c.strong ? 'strong' : ''}`}>{c.render ? c.render(row) : row[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {!slice.length && <div className="empty">{empty}</div>}
      </div>
      {pages > 1 && (
        <div className="pager">
          Page {cur + 1} / {pages}
          <div className="spacer" />
          <button className="btn sm" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Précédent</button>
          <button className="btn sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Suivant</button>
        </div>
      )}
    </div>
  )
}

// ---------- Graphiques SVG (sans dépendance) ----------
export function Sparkline({ data, color = '#13a89e', w = 90, h = 30 }) {
  if (!data?.length) return null
  const max = Math.max(...data, 1), min = Math.min(...data, 0)
  const pts = data.map((v, i) => `${(i / (data.length - 1 || 1)) * w},${h - ((v - min) / (max - min || 1)) * (h - 4) - 2}`).join(' ')
  return <svg width={w} height={h}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>
}

const niceMax = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / p) * p }
const short = (v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}k` : `${Math.round(v)}`)

// Courbes / aires — series: [{ name, data, color, dashed }]
export function LineChart({ labels, series, height = 240, area = true, format = short }) {
  const [hover, setHover] = useState(null)
  const W = 640, H = height, L = 44, R = 12, T = 12, B = 28
  const all = series.flatMap((s) => s.data.filter((v) => v != null))
  const max = niceMax(Math.max(...all, 0))
  const x = (i) => L + (i / Math.max(labels.length - 1, 1)) * (W - L - R)
  const y = (v) => T + (1 - v / max) * (H - T - B)
  return (
    <div style={{ position: 'relative' }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} onMouseLeave={() => setHover(null)}>
        <defs>{series.map((s, i) => <linearGradient key={i} id={`g${i}${s.name.length}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity=".28" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient>)}</defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}><line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="var(--border)" strokeDasharray={f ? '3 4' : ''} /><text x={L - 8} y={y(max * f) + 4} textAnchor="end">{format(max * f)}</text></g>
        ))}
        {labels.map((l, i) => (labels.length <= 12 || i % 2 === 0) && <text key={i} x={x(i)} y={H - 8} textAnchor="middle">{l}</text>)}
        {series.map((s, si) => {
          const pts = s.data.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean)
          if (!pts.length) return null
          const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')
          return (
            <g key={si}>
              {area && !s.dashed && <path d={`${d} L${pts.at(-1)[0]},${y(0)} L${pts[0][0]},${y(0)} Z`} fill={`url(#g${si}${s.name.length})`} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? '6 5' : ''} strokeLinejoin="round" strokeLinecap="round" />
              {hover != null && s.data[hover] != null && <circle cx={x(hover)} cy={y(s.data[hover])} r="4.5" fill="var(--surface)" stroke={s.color} strokeWidth="2.5" />}
            </g>
          )
        })}
        {labels.map((_, i) => <rect key={i} x={x(i) - (W - L - R) / labels.length / 2} y={T} width={(W - L - R) / labels.length} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} />)}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--muted)" strokeDasharray="3 3" opacity=".5" />}
      </svg>
      {hover != null && (
        <div className="card" style={{ position: 'absolute', top: 4, left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > labels.length / 2 ? '-105%' : '5%'})`, padding: '8px 12px', pointerEvents: 'none', fontSize: 12, minWidth: 140 }}>
          <div className="strong" style={{ fontWeight: 700, marginBottom: 4 }}>{labels[hover]}</div>
          {series.map((s) => s.data[hover] != null && <div key={s.name} className="row" style={{ gap: 6 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />{s.name}<span className="spacer" /><b className="num">{format(s.data[hover])}</b></div>)}
        </div>
      )}
      <div className="legend" style={{ marginTop: 6 }}>{series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}</div>
    </div>
  )
}

export function BarChart({ labels, series, height = 240, stacked = false, format = short }) {
  const W = 640, H = height, L = 44, R = 8, T = 10, B = 28
  const totals = labels.map((_, i) => (stacked ? series.reduce((s, x) => s + Math.max(0, x.data[i] || 0), 0) : Math.max(...series.map((x) => x.data[i] || 0))))
  const max = niceMax(Math.max(...totals, 0))
  const bw = (W - L - R) / labels.length
  const y = (v) => T + (1 - v / max) * (H - T - B)
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
        {[0, 0.5, 1].map((f) => <g key={f}><line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="var(--border)" strokeDasharray={f ? '3 4' : ''} /><text x={L - 8} y={y(max * f) + 4} textAnchor="end">{format(max * f)}</text></g>)}
        {labels.map((l, i) => {
          let acc = 0
          const inner = stacked ? bw * 0.56 : (bw * 0.7) / series.length
          return (
            <g key={i}>
              {series.map((s, si) => {
                const v = Math.max(0, s.data[i] || 0)
                const bx = stacked ? L + i * bw + (bw - inner) / 2 : L + i * bw + bw * 0.15 + si * inner
                const top = stacked ? y(acc + v) : y(v)
                const hgt = stacked ? y(acc) - y(acc + v) : y(0) - y(v)
                acc += v
                return <rect key={si} x={bx} y={top} width={Math.max(inner - 2, 2)} height={Math.max(hgt, 0)} rx="4" fill={s.color}><title>{`${l} — ${s.name} : ${format(v)}`}</title></rect>
              })}
              {(labels.length <= 12 || i % 2 === 0) && <text x={L + i * bw + bw / 2} y={H - 8} textAnchor="middle">{l.length > 12 ? l.slice(0, 11) + '…' : l}</text>}
            </g>
          )
        })}
      </svg>
      {series.length > 1 && <div className="legend">{series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}</div>}
    </div>
  )
}

export function Donut({ data, size = 170, label, sub }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = 60, c = 2 * Math.PI * r
  let off = 0
  return (
    <div className="row" style={{ gap: 20, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--soft)" strokeWidth="20" />
        {data.map((d, i) => {
          const len = (d.value / total) * c
          const el = <circle key={i} cx="80" cy="80" r={r} fill="none" stroke={d.color} strokeWidth="20" strokeDasharray={`${Math.max(len - 2, 0)} ${c}`} strokeDashoffset={-off} transform="rotate(-90 80 80)"><title>{d.label}</title></circle>
          off += len
          return el
        })}
        <text x="80" y="78" textAnchor="middle" style={{ fontSize: 17, fontWeight: 800, fill: 'var(--text)' }}>{label}</text>
        <text x="80" y="96" textAnchor="middle" style={{ fontSize: 10 }}>{sub}</text>
      </svg>
      <div className="stack" style={{ gap: 8, flex: 1, minWidth: 140 }}>
        {data.map((d) => (
          <div key={d.label} className="row small" style={{ gap: 8 }}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{d.label}</span>
            <b className="num">{((d.value / total) * 100).toFixed(0)} %</b>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Progress({ value, color = 'var(--teal)' }) {
  return <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, background: color }} /></div>
}

export function Empty({ icon = 'layers', title, children }) {
  return <div className="empty"><Icon name={icon} size={32} /><div style={{ fontWeight: 700, marginTop: 8, color: 'var(--text)' }}>{title}</div><div>{children}</div></div>
}

export function Confirm({ text, onYes, onClose }) {
  return (
    <Modal title="Confirmation" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={() => { onYes(); onClose() }}>Confirmer</button></>}>
      {text}
    </Modal>
  )
}
