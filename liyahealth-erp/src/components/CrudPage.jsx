import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { DataTable, FormFields, Icon, Modal, Confirm } from './ui.jsx'

// Liste + formulaire de création / modification pour une collection simple.
export default function CrudPage({ col, entity, fields, columns, filters, defaults = {}, searchKeys, rows, extraActions, renderDetail, validate, onSaved }) {
  const { db, add, update, remove, toast, log } = useStore()
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [detail, setDetail] = useState(null)
  const data = rows || db[col]

  const save = () => {
    const err = validate?.(edit)
    if (err) return toast(err)
    if (edit.id) { update(col, edit.id, edit); toast(`${entity} mis à jour`) }
    else { const item = add(col, edit); log(`${entity} créé : ${edit.name || edit.title || edit.number || edit.ref || ''}`, 'plus'); onSaved?.(item) ; toast(`${entity} créé`) }
    setEdit(null)
  }

  return (
    <>
      <DataTable
        rows={data}
        columns={[...columns, {
          key: '_a', label: '', noSort: true, noExport: true, right: true, render: (r) => (
            <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
              <button className="btn sm ghost" title="Modifier" onClick={() => setEdit({ ...r })}><Icon name="edit" size={14} /></button>
              <button className="btn sm ghost danger" title="Supprimer" onClick={() => setDel(r)}><Icon name="trash" size={14} /></button>
            </span>
          ),
        }]}
        filters={filters}
        searchKeys={searchKeys}
        exportName={col}
        onRowClick={(r) => (renderDetail ? setDetail(r) : setEdit({ ...r }))}
        actions={<>{extraActions}<button className="btn primary sm" onClick={() => setEdit({ ...defaults })}><Icon name="plus" size={14} />Nouveau</button></>}
      />
      {edit && (
        <Modal title={edit.id ? `Modifier — ${entity}` : `Nouveau — ${entity}`} onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Annuler</button><button className="btn primary" onClick={save}><Icon name="check" size={15} />Enregistrer</button></>}>
          <FormFields fields={fields} value={edit} onChange={setEdit} />
        </Modal>
      )}
      {detail && (
        <Modal size="xl" title={detail.name || detail.title || detail.number || entity} onClose={() => setDetail(null)}
          footer={<><button className="btn" onClick={() => { setEdit({ ...detail }); setDetail(null) }}><Icon name="edit" size={15} />Modifier</button><button className="btn primary" onClick={() => setDetail(null)}>Fermer</button></>}>
          {renderDetail(detail)}
        </Modal>
      )}
      {del && <Confirm text={`Supprimer définitivement « ${del.name || del.title || del.number || del.ref} » ?`} onClose={() => setDel(null)} onYes={() => { remove(col, del.id); toast(`${entity} supprimé`) }} />}
    </>
  )
}
