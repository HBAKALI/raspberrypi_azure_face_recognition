// Mouvements de stock appliqués sur un brouillon de base (à utiliser dans mutate()).
import { TODAY, addDays, uid } from './domain.js'

// Sortie FEFO : on consomme d'abord les lots qui expirent le plus tôt.
export function stockOut(d, productId, qty, ref) {
  const p = d.products.find((x) => x.id === productId)
  if (!p) return
  let left = Number(qty)
  const lots = [...p.lots].sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999'))
  for (const l of lots) {
    if (left <= 0) break
    const take = Math.min(l.qty, left)
    if (take <= 0) continue
    l.qty -= take; left -= take
    d.movements.unshift({ id: uid(), date: TODAY, productId, type: 'Sortie', qty: take, ref, warehouseId: l.warehouseId, lot: l.lot })
  }
  if (left > 0) { // stock négatif autorisé mais tracé
    p.lots.push({ lot: 'NEGATIF', expiry: '', qty: -left, warehouseId: 'w1' })
    d.movements.unshift({ id: uid(), date: TODAY, productId, type: 'Sortie', qty: left, ref: ref + ' (stock insuffisant)', warehouseId: 'w1', lot: '' })
  }
  p.lots = p.lots.filter((l) => l.qty !== 0 || l.lot === 'NEGATIF')
}

export function stockIn(d, productId, qty, ref, { lot, expiry, warehouseId = 'w1' } = {}) {
  const p = d.products.find((x) => x.id === productId)
  if (!p) return
  const lotNo = lot || `${p.ref.split('-')[0]}${TODAY.slice(2, 4)}${String(Math.floor(Math.random() * 900) + 100)}`
  const neg = p.lots.find((l) => l.lot === 'NEGATIF')
  let q = Number(qty)
  if (neg) { const cover = Math.min(q, -neg.qty); neg.qty += cover; q -= cover; if (neg.qty === 0) p.lots = p.lots.filter((l) => l !== neg) }
  if (q > 0) {
    const existing = p.lots.find((l) => l.lot === lotNo && l.warehouseId === warehouseId)
    if (existing) existing.qty += q
    else p.lots.push({ lot: lotNo, expiry: expiry ?? (p.kind === 'conso' ? addDays(TODAY, 730) : ''), qty: q, warehouseId })
  }
  d.movements.unshift({ id: uid(), date: TODAY, productId, type: 'Entrée', qty: Number(qty), ref, warehouseId, lot: lotNo })
}
