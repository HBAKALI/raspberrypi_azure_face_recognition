// Pièces jointes : gestionnaire de fichiers (dossiers, notes, déplacement), contenu stocké dans IndexedDB.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { Badge, Card, Confirm, Field, Icon, Modal, PageHead, Progress, Seg, COLORS } from '../components/ui.jsx'
import { TODAY, fdate, uid } from '../lib/domain.js'
import { STORAGE_LIMIT, deleteBlob, fileKind, fmtSize, getBlob, putBlob } from '../lib/files.js'

const KIND = {
  image: { icon: 'eye', color: COLORS.violet, label: 'Image' },
  pdf: { icon: 'file', color: COLORS.red, label: 'PDF' },
  sheet: { icon: 'grid', color: COLORS.green, label: 'Tableur' },
  doc: { icon: 'file', color: COLORS.blue, label: 'Document' },
  other: { icon: 'layers', color: COLORS.gray, label: 'Fichier' },
}

function Thumb({ file, size = 120 }) {
  const [url, setUrl] = useState('')
  const kind = fileKind(file.type, file.name)
  useEffect(() => {
    if (kind !== 'image') return
    let u = '', alive = true
    getBlob(file.id).then((b) => { if (b && alive) { u = URL.createObjectURL(b); setUrl(u) } })
    return () => { alive = false; if (u) URL.revokeObjectURL(u) }
  }, [file.id, kind])
  const k = KIND[kind]
  if (url) return <img src={url} alt="" style={{ width: '100%', height: size, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
  return <div style={{ height: size, borderRadius: 10, background: k.color + '14', color: k.color, display: 'grid', placeItems: 'center' }}><Icon name={k.icon} size={30} /></div>
}

export default function Attachments() {
  const { db, mutate, toast, log } = useStore()
  const [folder, setFolder] = useState('all')
  const [q, setQ] = useState('')
  const [view, setView] = useState('grid')
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [folderEdit, setFolderEdit] = useState(null)
  const [fileEdit, setFileEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [delFolder, setDelFolder] = useState(null)
  const input = useRef()

  const used = db.files.reduce((s, f) => s + (f.size || 0), 0)
  const current = db.folders.find((f) => f.id === folder)
  const crumbs = useMemo(() => {
    const out = []
    let f = current
    while (f) { out.unshift(f); f = db.folders.find((x) => x.id === f.parentId) }
    return out
  }, [current, db.folders])
  const files = useMemo(() => {
    const s = q.toLowerCase()
    return db.files
      .filter((f) => folder === 'all' || (folder === 'none' ? !f.folderId : f.folderId === folder))
      .filter((f) => !s || `${f.name} ${f.note || ''} ${(f.tags || []).join(' ')}`.toLowerCase().includes(s))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [db.files, folder, q])

  const upload = async (list) => {
    const arr = [...list]
    if (!arr.length) return
    const total = arr.reduce((s, f) => s + f.size, 0)
    if (used + total > STORAGE_LIMIT) return toast('Espace insuffisant (limite 500 Mo)')
    setBusy(true)
    const metas = []
    for (const f of arr) {
      const id = uid()
      if (await putBlob(id, f)) metas.push({ id, name: f.name, folderId: ['all', 'none'].includes(folder) ? '' : folder, size: f.size, type: f.type, note: '', date: new Date().toISOString().slice(0, 19), tags: [] })
    }
    setBusy(false)
    if (!metas.length) return toast('Enregistrement impossible : stockage du navigateur indisponible')
    mutate((d) => { d.files.unshift(...metas) })
    log(`${metas.length} fichier(s) ajouté(s) aux pièces jointes`, 'folder')
    toast(`${metas.length} fichier(s) ajouté(s)`)
  }

  const openFile = async (f, download) => {
    const blob = await getBlob(f.id)
    if (!blob) return toast('Fichier introuvable sur cet appareil')
    const url = URL.createObjectURL(blob)
    if (download) { const a = document.createElement('a'); a.href = url; a.download = f.name; a.click() } else window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const saveFolder = () => {
    const name = folderEdit.name.trim()
    if (!name) return toast('Nom obligatoire')
    if (folderEdit.id) mutate((d) => { d.folders.find((x) => x.id === folderEdit.id).name = name })
    else { const f = { id: uid(), name, parentId: folderEdit.parentId || '' }; mutate((d) => { d.folders.push(f) }); setFolder(f.id) }
    toast('Dossier enregistré'); setFolderEdit(null)
  }
  const tryDeleteFolder = (f) => {
    if (db.files.some((x) => x.folderId === f.id) || db.folders.some((x) => x.parentId === f.id)) return toast('Le dossier doit être vide pour être supprimé')
    setDelFolder(f)
  }
  const saveFile = () => {
    const tags = String(fileEdit.tagsText || '').split(',').map((t) => t.trim()).filter(Boolean)
    mutate((d) => { const x = d.files.find((y) => y.id === fileEdit.id); Object.assign(x, { name: fileEdit.name, note: fileEdit.note, folderId: fileEdit.folderId, tags }) })
    toast('Fichier mis à jour'); setFileEdit(null)
  }

  const tree = (parentId, depth) => db.folders.filter((f) => (f.parentId || '') === parentId).map((f) => (
    <div key={f.id}>
      <button className={`nav-item ${folder === f.id ? 'active' : ''}`} style={{ color: folder === f.id ? 'var(--teal)' : 'var(--text)', background: folder === f.id ? 'var(--soft)' : undefined, boxShadow: 'none', paddingLeft: 10 + depth * 16 }} onClick={() => setFolder(f.id)}>
        <Icon name="folder" size={16} /><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
        <span className="muted small">{db.files.filter((x) => x.folderId === f.id).length}</span>
      </button>
      {tree(f.id, depth + 1)}
    </div>
  ))

  const actions = (f) => (
    <span className="row" style={{ gap: 2 }} onClick={(e) => e.stopPropagation()}>
      <button className="btn sm ghost" title="Ouvrir" onClick={() => openFile(f)}><Icon name="eye" size={14} /></button>
      <button className="btn sm ghost" title="Télécharger" onClick={() => openFile(f, true)}><Icon name="download" size={14} /></button>
      <button className="btn sm ghost" title="Modifier / déplacer" onClick={() => setFileEdit({ ...f, tagsText: (f.tags || []).join(', ') })}><Icon name="edit" size={14} /></button>
      <button className="btn sm ghost danger" title="Supprimer" onClick={() => setDel(f)}><Icon name="trash" size={14} /></button>
    </span>
  )

  return (
    <div className="stack">
      <PageHead title="Pièces jointes" sub="Dossiers d'AO, certificats CE / ISO 13485, fiches techniques, factures et contrats au même endroit." crumbs="Outils › Pièces jointes">
        <button className="btn" onClick={() => setFolderEdit({ name: '', parentId: ['all', 'none'].includes(folder) ? '' : folder })}><Icon name="folder" size={15} />Nouveau dossier</button>
        <button className="btn primary" onClick={() => input.current?.click()} disabled={busy}><Icon name="upload" size={15} />{busy ? 'Envoi…' : 'Ajouter des fichiers'}</button>
        <input ref={input} type="file" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
      </PageHead>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <div className="stack" style={{ flex: '1 1 230px', maxWidth: 'min(100%, 320px)', minWidth: 0 }}>
          <Card title="Dossiers" icon="folder">
            <div className="stack" style={{ gap: 2 }}>
              {[['all', 'Tous les fichiers', 'layers', db.files.length], ['none', 'Non classés', 'file', db.files.filter((f) => !f.folderId).length]].map(([id, label, icon, n]) => (
                <button key={id} className="nav-item" style={{ color: folder === id ? 'var(--teal)' : 'var(--text)', background: folder === id ? 'var(--soft)' : undefined }} onClick={() => setFolder(id)}>
                  <Icon name={icon} size={16} /><span style={{ flex: 1 }}>{label}</span><span className="muted small">{n}</span>
                </button>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
              {tree('', 0)}
            </div>
          </Card>
          <Card title="Stockage" icon="layers">
            <div className="row small" style={{ marginBottom: 8 }}><b className="num">{fmtSize(used)}</b><span className="spacer" /><span className="muted">500 Mo</span></div>
            <Progress value={used / STORAGE_LIMIT} color={used / STORAGE_LIMIT > 0.85 ? COLORS.red : COLORS.teal} />
            <div className="muted small" style={{ marginTop: 8 }}>Extensible sur demande. Les fichiers sont conservés dans ce navigateur.</div>
          </Card>
        </div>

        <div className="card" style={{ flex: '999 1 420px', minWidth: 0, outline: drag ? '2px dashed var(--teal)' : 'none' }}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files) }}>
          <div className="toolbar">
            <div className="row small" style={{ gap: 6, flexWrap: 'wrap' }}>
              <button className="btn sm ghost" onClick={() => setFolder('all')}>Pièces jointes</button>
              {folder === 'none' && <><span className="muted">›</span><b>Non classés</b></>}
              {crumbs.map((c) => <span key={c.id} className="row" style={{ gap: 6 }}><span className="muted">›</span><button className="btn sm ghost" onClick={() => setFolder(c.id)}>{c.name}</button></span>)}
              {current && <>
                <button className="btn sm ghost" title="Renommer" onClick={() => setFolderEdit({ ...current })}><Icon name="edit" size={13} /></button>
                <button className="btn sm ghost danger" title="Supprimer le dossier" onClick={() => tryDeleteFolder(current)}><Icon name="trash" size={13} /></button>
              </>}
            </div>
            <div className="spacer" />
            <div className="search" style={{ maxWidth: 220 }}><Icon name="search" size={16} /><input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 36 }} /></div>
            <Seg options={[['grid', 'Grille'], ['list', 'Liste']]} value={view} onChange={setView} />
          </div>

          {!files.length ? (
            <div className="empty" style={{ padding: '56px 24px' }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, margin: '0 auto', background: 'var(--soft)', display: 'grid', placeItems: 'center', color: 'var(--teal)' }}><Icon name="upload" size={28} /></div>
              <div style={{ fontWeight: 700, color: 'var(--text)', marginTop: 14, fontSize: 15 }}>{q ? 'Aucun fichier ne correspond' : 'Déposez vos fichiers ici'}</div>
              <div style={{ maxWidth: 380, margin: '6px auto 16px' }}>{q ? 'Essayez un autre mot-clé.' : 'Glissez-déposez des PDF, images, tableurs ou documents, ou utilisez le bouton ci-dessous.'}</div>
              {!q && <button className="btn primary" onClick={() => input.current?.click()}><Icon name="upload" size={15} />Choisir des fichiers</button>}
            </div>
          ) : view === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, padding: 16 }}>
              {files.map((f) => (
                <div key={f.id} className="card" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', minWidth: 0 }} onClick={() => openFile(f)}>
                  <Thumb file={f} />
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.name}>{f.name}</div>
                  <div className="row small muted" style={{ gap: 6 }}><span>{fmtSize(f.size)}</span><span>·</span><span>{fdate((f.date || TODAY).slice(0, 10))}</span></div>
                  {f.note && <div className="small" style={{ color: 'var(--muted)', lineHeight: 1.4 }}>{f.note.length > 70 ? f.note.slice(0, 70) + '…' : f.note}</div>}
                  <div className="row" style={{ justifyContent: 'space-between' }}>{folder === 'all' && f.folderId ? <Badge color="gray">{db.folders.find((x) => x.id === f.folderId)?.name}</Badge> : <span />}{actions(f)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>Nom</th><th>Type</th><th>Dossier</th><th>Note</th><th className="right">Taille</th><th>Date</th><th /></tr></thead>
                <tbody>
                  {files.map((f) => {
                    const k = KIND[fileKind(f.type, f.name)]
                    return (
                      <tr key={f.id} className="click" onClick={() => openFile(f)}>
                        <td className="strong"><span className="row" style={{ gap: 8 }}><span style={{ color: k.color }}><Icon name={k.icon} size={16} /></span>{f.name}</span></td>
                        <td>{k.label}</td>
                        <td>{db.folders.find((x) => x.id === f.folderId)?.name || <span className="muted">Non classé</span>}</td>
                        <td className="muted small">{f.note || '—'}</td>
                        <td className="right num">{fmtSize(f.size)}</td>
                        <td>{fdate((f.date || TODAY).slice(0, 10))}</td>
                        <td className="right">{actions(f)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {folderEdit && (
        <Modal title={folderEdit.id ? 'Renommer le dossier' : 'Nouveau dossier'} onClose={() => setFolderEdit(null)}
          footer={<><button className="btn" onClick={() => setFolderEdit(null)}>Annuler</button><button className="btn primary" onClick={saveFolder}>Enregistrer</button></>}>
          <div className="form">
            <Field label="Nom du dossier" full><input autoFocus value={folderEdit.name} onChange={(e) => setFolderEdit({ ...folderEdit, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && saveFolder()} /></Field>
            {!folderEdit.id && <Field label="Dossier parent" full><select value={folderEdit.parentId || ''} onChange={(e) => setFolderEdit({ ...folderEdit, parentId: e.target.value })}><option value="">Racine</option>{db.folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>}
          </div>
        </Modal>
      )}
      {fileEdit && (
        <Modal title="Modifier le fichier" onClose={() => setFileEdit(null)}
          footer={<><button className="btn" onClick={() => setFileEdit(null)}>Annuler</button><button className="btn primary" onClick={saveFile}><Icon name="check" size={15} />Enregistrer</button></>}>
          <div className="form">
            <Field label="Nom" full><input value={fileEdit.name} onChange={(e) => setFileEdit({ ...fileEdit, name: e.target.value })} /></Field>
            <Field label="Déplacer vers"><select value={fileEdit.folderId || ''} onChange={(e) => setFileEdit({ ...fileEdit, folderId: e.target.value })}><option value="">Non classé</option>{db.folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
            <Field label="Étiquettes (séparées par des virgules)"><input value={fileEdit.tagsText} onChange={(e) => setFileEdit({ ...fileEdit, tagsText: e.target.value })} placeholder="AO, CHU, 2026" /></Field>
            <Field label="Note" full><textarea value={fileEdit.note || ''} onChange={(e) => setFileEdit({ ...fileEdit, note: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {del && <Confirm text={`Supprimer définitivement « ${del.name} » ?`} onClose={() => setDel(null)} onYes={() => { const id = del.id; deleteBlob(id); mutate((d) => { d.files = d.files.filter((f) => f.id !== id) }); toast('Fichier supprimé') }} />}
      {delFolder && <Confirm text={`Supprimer le dossier « ${delFolder.name} » ?`} onClose={() => setDelFolder(null)} onYes={() => { const id = delFolder.id; mutate((d) => { d.folders = d.folders.filter((f) => f.id !== id) }); setFolder('all'); toast('Dossier supprimé') }} />}
    </div>
  )
}
