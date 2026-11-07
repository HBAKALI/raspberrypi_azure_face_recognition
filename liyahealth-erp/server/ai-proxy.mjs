// Proxy minimal pour l'API Claude : la clé reste côté serveur.
// Usage : ANTHROPIC_API_KEY=sk-ant-... ALLOWED_ORIGIN=https://erp.liyahealth.ma npm run ai-proxy
// Puis dans l'ERP : Paramètres › Intelligence artificielle › URL du proxy = http://<hôte>:8787
import http from 'node:http'

const PORT = Number(process.env.PORT || 8787)
const KEY = process.env.ANTHROPIC_API_KEY
const ORIGIN = process.env.ALLOWED_ORIGIN || '*'
if (!KEY) { console.error('ANTHROPIC_API_KEY manquant'); process.exit(1) }

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN)
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.end()
  if (req.method !== 'POST' || !req.url.startsWith('/v1/messages')) { res.statusCode = 404; return res.end() }
  const chunks = []
  for await (const c of req) chunks.push(c)
  const headers = { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': req.headers['anthropic-version'] || '2023-06-01' }
  if (req.headers['anthropic-beta']) headers['anthropic-beta'] = req.headers['anthropic-beta']
  try {
    const upstream = await fetch(`https://api.anthropic.com${req.url}`, { method: 'POST', headers, body: Buffer.concat(chunks) })
    res.statusCode = upstream.status
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json')
    for await (const c of upstream.body) res.write(c)
    res.end()
  } catch (e) {
    res.statusCode = 502; res.end(JSON.stringify({ type: 'error', error: { type: 'proxy_error', message: String(e) } }))
  }
}).listen(PORT, () => console.log(`Proxy IA LIYA HEALTH sur http://localhost:${PORT}`))
