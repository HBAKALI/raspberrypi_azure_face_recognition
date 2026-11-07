// Stockage local des pièces jointes : le contenu des fichiers va dans IndexedDB,
// les métadonnées (nom, dossier, note…) restent dans le store de l'ERP.
const DB_NAME = 'liyahealth-files'
const STORE = 'blobs'
export const STORAGE_LIMIT = 500 * 1024 * 1024 // 500 Mo

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { resolve(req?.result); db.close() }
    tx.onerror = () => { reject(tx.error); db.close() }
  })
}

export async function putBlob(id, blob) {
  try { await run('readwrite', (s) => s.put(blob, id)); return true } catch { return false }
}
export async function getBlob(id) {
  try { return (await run('readonly', (s) => s.get(id))) || null } catch { return null }
}
export async function deleteBlob(id) {
  try { await run('readwrite', (s) => s.delete(id)) } catch { /* déjà absent */ }
}

export function fmtSize(bytes) {
  const b = Number(bytes) || 0
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
  if (b >= 1024) return `${Math.round(b / 1024)} Ko`
  return `${b} o`
}

export function fileKind(type = '', name = '') {
  const ext = name.split('.').pop().toLowerCase()
  if (type.startsWith('image/')) return 'image'
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'sheet'
  if (['doc', 'docx', 'odt', 'txt', 'rtf'].includes(ext)) return 'doc'
  return 'other'
}
