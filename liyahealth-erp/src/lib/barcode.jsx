// Codes-barres EAN-13 (préfixe GS1 Maroc 611) : génération, contrôle et rendu SVG.
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = L.map((c) => c.replace(/./g, (b) => (b === '0' ? '1' : '0')))
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

export const ean13Check = (d12) => { const s = d12.split('').reduce((t, c, i) => t + Number(c) * (i % 2 ? 3 : 1), 0); return String((10 - (s % 10)) % 10) }
export const isEan13 = (code) => /^\d{13}$/.test(code) && ean13Check(code.slice(0, 12)) === code[12]
export function makeEan13(seed) {
  const digits = String(seed).replace(/\D/g, '').padStart(9, '0').slice(-9)
  const d12 = '611' + digits
  return d12 + ean13Check(d12)
}

export function Barcode({ code, height = 60, width = 2 }) {
  if (!isEan13(code)) return <div className="muted small">Code « {code} » (non EAN-13)</div>
  const first = Number(code[0])
  let bits = '101'
  for (let i = 1; i <= 6; i++) bits += (PARITY[first][i - 1] === 'L' ? L : G)[Number(code[i])]
  bits += '01010'
  for (let i = 7; i <= 12; i++) bits += R[Number(code[i])]
  bits += '101'
  const guard = new Set([0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94])
  const W = bits.length * width + 20
  return (
    <svg width={W} height={height + 18} viewBox={`0 0 ${W} ${height + 18}`} style={{ background: '#fff', maxWidth: '100%' }} role="img" aria-label={`Code-barres ${code}`}>
      {bits.split('').map((b, i) => b === '1' && <rect key={i} x={10 + i * width} y={4} width={width} height={guard.has(i) ? height + 6 : height} fill="#000" />)}
      <text x={W / 2} y={height + 16} textAnchor="middle" style={{ fontSize: 12, fontFamily: 'monospace', fill: '#000', letterSpacing: 2 }}>{code}</text>
    </svg>
  )
}
