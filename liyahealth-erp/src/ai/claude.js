// Connexion à Claude (API Anthropic) pour l'assistant LIYA IA.
// Deux modes :
//  - Proxy (recommandé en production) : `npm run ai-proxy` garde la clé côté serveur ; renseigner l'URL du proxy.
//  - Clé directe (démo / poste unique) : la clé reste dans le navigateur de l'utilisateur.
import Anthropic from '@anthropic-ai/sdk'
import { buildContext } from './engine.js'

export const aiConfigured = (ai) => Boolean(ai?.proxyUrl || ai?.apiKey)

function client(ai) {
  if (ai.proxyUrl) return new Anthropic({ apiKey: 'proxy', baseURL: ai.proxyUrl.replace(/\/$/, ''), dangerouslyAllowBrowser: true })
  return new Anthropic({ apiKey: ai.apiKey, dangerouslyAllowBrowser: true })
}

const SYSTEM = `Tu es LIYA IA, l'assistant intégré à l'ERP de LIYA HEALTH SARL (Casablanca), importateur et distributeur de dispositifs médicaux (classes I à IIb, enregistrement AMMPS) auprès des CHU, hôpitaux publics, cliniques privées et cabinets au Maroc.
Domaines : ventes, appels d'offres publics (décret 2-22-431, marchespublics.gov.ma, cautions BANK OF AFRICA), achats import (Chine, Europe, États-Unis), stock et lots (FEFO, péremption), SAV biomédical, matériovigilance AMMPS, finance (MAD, TVA 20 %), RH.
Règles :
- Réponds en français professionnel, conclusion d'abord, puis 3 à 6 points concrets et chiffrés.
- Appuie-toi uniquement sur les données JSON fournies ; si une information manque, dis-le au lieu d'inventer.
- Montants en DH avec séparateur de milliers ; dates au format JJ/MM/AAAA.
- Propose des actions réalisables dans l'ERP (créer un BC, relancer un client, planifier une intervention…).`

// Envoie la conversation à Claude en streaming. `onText` reçoit le texte au fil de l'eau.
export async function askClaude({ ai, db, messages, onText, task }) {
  const c = client(ai)
  const context = JSON.stringify(buildContext(db))
  const params = {
    model: ai.model || 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: ai.effort || 'medium' },
    system: [
      { type: 'text', text: SYSTEM },
      { type: 'text', text: `Données ERP (instantané JSON) :\n${context}`, cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      ...(task ? [{ role: 'user', content: task }] : []),
    ],
  }
  // Repli automatique côté serveur si une requête est refusée par les garde-fous du modèle (API Claude uniquement).
  const useFallback = !ai.proxyUrl && /claude-(opus-5-5|opus-5|sonnet-5-5|fable-5-1)/.test(params.model)
  const stream = useFallback
    ? c.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
    : c.messages.stream(params)
  stream.on('text', (t) => onText?.(t))
  const final = await stream.finalMessage()
  if (final.stop_reason === 'refusal') return 'Cette demande n\'a pas pu être traitée par l\'assistant. Reformulez-la ou contactez l\'administrateur.'
  return final.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
}

export function explainError(e) {
  if (e instanceof Anthropic.AuthenticationError) return 'Clé API invalide. Vérifiez-la dans Paramètres › IA.'
  if (e instanceof Anthropic.RateLimitError) return 'Limite de requêtes atteinte. Réessayez dans un instant.'
  if (e instanceof Anthropic.BadRequestError) return `Requête refusée par l'API : ${e.message}`
  if (e instanceof Anthropic.APIConnectionError) return 'Connexion à l\'API impossible (réseau ou proxy). L\'assistant bascule en mode hors ligne.'
  if (e instanceof Anthropic.APIError) return `Erreur API ${e.status} : ${e.message}`
  return `Erreur : ${e.message || e}`
}
