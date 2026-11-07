// Lecture automatique de factures fournisseurs avec Claude (vision + sorties structurées).
import Anthropic from '@anthropic-ai/sdk'

function client(ai) {
  if (ai.proxyUrl) return new Anthropic({ apiKey: 'proxy', baseURL: ai.proxyUrl.replace(/\/$/, ''), dangerouslyAllowBrowser: true })
  return new Anthropic({ apiKey: ai.apiKey, dangerouslyAllowBrowser: true })
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['supplier_name', 'supplier_ice', 'invoice_number', 'date', 'due_date', 'currency', 'lines', 'totals', 'notes'],
  properties: {
    supplier_name: { type: 'string' },
    supplier_ice: { type: 'string', description: 'ICE à 15 chiffres si présent, sinon chaîne vide' },
    invoice_number: { type: 'string' },
    date: { type: 'string', description: 'YYYY-MM-DD' },
    due_date: { type: 'string', description: 'YYYY-MM-DD ou chaîne vide' },
    currency: { type: 'string', description: 'MAD, EUR, USD…' },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ref', 'label', 'qty', 'unit_price_ht', 'tva_rate'],
        properties: { ref: { type: 'string' }, label: { type: 'string' }, qty: { type: 'number' }, unit_price_ht: { type: 'number' }, tva_rate: { type: 'number' } },
      },
    },
    totals: { type: 'object', additionalProperties: false, required: ['ht', 'tva', 'ttc'], properties: { ht: { type: 'number' }, tva: { type: 'number' }, ttc: { type: 'number' } } },
    notes: { type: 'string', description: 'Doutes de lecture, champs illisibles ou incohérences' },
  },
}

export const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result).split(',')[1])
  r.onerror = () => reject(r.error)
  r.readAsDataURL(file)
})

export async function extractInvoice({ ai, file }) {
  const data = await fileToBase64(file)
  const isPdf = file.type === 'application/pdf'
  const media = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
    : { type: 'image', source: { type: 'base64', media_type: file.type === 'image/jpg' ? 'image/jpeg' : file.type, data } }
  const res = await client(ai).messages.create({
    model: ai.model || 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{
      role: 'user',
      content: [
        media,
        { type: 'text', text: 'Extrais les données de cette facture fournisseur (dispositifs médicaux) pour LIYA HEALTH. Montants hors taxes par ligne, taux de TVA en pourcentage (20 si non précisé et facture marocaine, 0 pour une facture export étrangère). Dates au format YYYY-MM-DD. N\'invente rien : laisse vide ce qui est illisible et signale-le dans notes.' },
      ],
    }],
  })
  if (res.stop_reason === 'refusal') throw new Error('La lecture de ce document a été refusée par le modèle.')
  const text = res.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('Réponse vide du modèle.')
  return JSON.parse(text)
}
