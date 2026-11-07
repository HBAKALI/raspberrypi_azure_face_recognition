// Registre des modules (équivalent de « Paramètres › Modules ») : chaque module peut être activé / désactivé.
export const GROUPS = ['Pilotage', 'Commercial', 'Achats & Stock', 'Opérations', 'Finance & RH', 'Intelligence', 'Système']

export const MODULES = [
  { id: 'dashboard', label: 'Tableau de bord', icon: 'grid', group: 'Pilotage', core: true, color: 'navy', desc: 'Vue 360° : CA, marge, trésorerie, stock, alertes et activité.' },
  { id: 'reports', label: 'Rapports & analyses', icon: 'chart', group: 'Pilotage', color: 'blue', desc: 'Ventes par client, produit, catégorie, région ; balance âgée ; export CSV.' },
  { id: 'crm', label: 'CRM & opportunités', icon: 'target', group: 'Commercial', color: 'violet', desc: 'Pipeline commercial, prévision pondérée, relances et suivi des délégués.' },
  { id: 'sales', label: 'Ventes', icon: 'cart', group: 'Commercial', color: 'teal', desc: 'Devis, commandes, bons de livraison, factures, avoirs. Conversion en un clic.' },
  { id: 'clients', label: 'Clients', icon: 'building', group: 'Commercial', color: 'teal', desc: 'CHU, hôpitaux, cliniques, cabinets : fiches, encours, historique.' },
  { id: 'tenders', label: 'Appels d\'offres', icon: 'gavel', group: 'Commercial', color: 'amber', desc: 'Veille marchés publics, préparation, cautions, échéances et taux de réussite.' },
  { id: 'purchases', label: 'Achats', icon: 'truck', group: 'Achats & Stock', color: 'blue', desc: 'Bons de commande fournisseurs, réceptions, factures fournisseurs.' },
  { id: 'suppliers', label: 'Fournisseurs', icon: 'globe', group: 'Achats & Stock', color: 'blue', desc: 'Partenaires fabricants, délais, devises, évaluation.' },
  { id: 'stock', label: 'Produits & stock', icon: 'box', group: 'Achats & Stock', core: true, color: 'green', desc: 'Catalogue DM, lots, péremption, dépôts, mouvements, inventaire.' },
  { id: 'service', label: 'SAV & parc installé', icon: 'wrench', group: 'Opérations', color: 'amber', desc: 'Équipements installés, garanties, contrats, interventions et planning techniciens.' },
  { id: 'quality', label: 'Qualité & matériovigilance', icon: 'shield', group: 'Opérations', color: 'red', desc: 'Réclamations, incidents AMMPS, rappels FSCA, CAPA, traçabilité lots.' },
  { id: 'finance', label: 'Finance & trésorerie', icon: 'wallet', group: 'Finance & RH', color: 'green', desc: 'Encaissements, décaissements, dépenses, TVA, trésorerie prévisionnelle.' },
  { id: 'hr', label: 'Ressources humaines', icon: 'users', group: 'Finance & RH', color: 'violet', desc: 'Employés, congés, masse salariale, CNSS.' },
  { id: 'ai', label: 'LIYA IA', icon: 'sparkles', group: 'Intelligence', color: 'ai', desc: 'Assistant IA, prévisions de demande, réapprovisionnement, scoring AO, détection d\'anomalies, rédaction.' },
  { id: 'settings', label: 'Paramètres', icon: 'settings', group: 'Système', core: true, color: 'gray', desc: 'Société, modules, IA, données.' },
]

export const isEnabled = (settings, id) => {
  const m = MODULES.find((x) => x.id === id)
  if (!m) return false
  if (m.core) return true
  return settings.modules?.[id] ?? true
}
