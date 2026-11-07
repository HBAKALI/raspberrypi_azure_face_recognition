// Registre des modules, aligné sur GStocky (Réglages › Modules) + modules métier LIYA HEALTH.
// Un module peut regrouper plusieurs pages du menu ; seuls les modules « noyau » ne se désactivent pas.
export const GROUPS = ['Pilotage', 'Commercial', 'Achats & Stock', 'Opérations', 'Finance & RH', 'Outils', 'Système']

export const MODULES = [
  { id: 'dashboard', label: 'Tableau de bord', icon: 'grid', group: 'Pilotage', core: true, color: 'navy', desc: 'Vue d\'ensemble des performances de l\'entreprise.', pages: [['dashboard', 'Tableau de bord', 'grid']] },
  { id: 'analytics', label: 'Analyses avancées', icon: 'chart', group: 'Pilotage', color: 'blue', desc: 'Tableaux de bord personnalisables (widgets) et rapports détaillés.', pages: [['analytics', 'Analyses avancées', 'chart'], ['reports', 'Rapports', 'file']] },
  { id: 'crm', label: 'CRM', icon: 'building', group: 'Commercial', color: 'teal', desc: 'Gestion des clients et des fournisseurs.', pages: [['clients', 'Clients', 'building'], ['suppliers', 'Fournisseurs', 'globe']] },
  { id: 'prospects', label: 'Prospects', icon: 'target', group: 'Commercial', color: 'violet', desc: 'Prospects, opportunités et pipeline commercial.', pages: [['prospects', 'Prospects & opportunités', 'target']] },
  { id: 'sales', label: 'Ventes', icon: 'cart', group: 'Commercial', color: 'teal', desc: 'Devis, commandes, livraisons, factures et retours.', pages: [['sales', 'Ventes', 'cart']] },
  { id: 'pos', label: 'Point de vente', icon: 'register', group: 'Commercial', color: 'green', desc: 'Transactions en caisse et caisses enregistreuses.', pages: [['pos', 'Point de vente', 'register']] },
  { id: 'tenders', label: 'Appels d\'offres', icon: 'gavel', group: 'Commercial', color: 'amber', desc: 'Marchés publics : veille, dossiers, cautions, scoring IA. (LIYA HEALTH)', pages: [['tenders', 'Appels d\'offres', 'gavel']] },
  { id: 'contracts', label: 'Contrats', icon: 'contract', group: 'Commercial', color: 'navy', desc: 'Contrats clients et fournisseurs : maintenance, distribution, autorisations.', pages: [['contracts', 'Contrats', 'contract']] },
  { id: 'subscriptions', label: 'Abonnements', icon: 'repeat', group: 'Commercial', color: 'blue', desc: 'Location de matériel et forfaits récurrents (consommables, maintenance).', pages: [['subscriptions', 'Abonnements', 'repeat']] },
  { id: 'marketing', label: 'Marketing', icon: 'megaphone', group: 'Commercial', color: 'red', desc: 'Campagnes e-mail et WhatsApp ciblées, rédigées avec l\'IA.', pages: [['marketing', 'Marketing', 'megaphone']] },
  { id: 'purchases', label: 'Achats', icon: 'truck', group: 'Achats & Stock', color: 'blue', desc: 'Commandes, réceptions, factures et retours fournisseurs.', pages: [['purchases', 'Achats', 'truck']] },
  { id: 'inventory', label: 'Inventaire', icon: 'box', group: 'Achats & Stock', core: true, color: 'green', desc: 'Produits, codes-barres, lots, péremption, entrepôts, inventaire.', pages: [['stock', 'Inventaire', 'box']] },
  { id: 'planning', label: 'Planning', icon: 'calendar', group: 'Opérations', color: 'amber', desc: 'Planification des interventions des techniciens et rendez-vous.', pages: [['planning', 'Planning', 'calendar']] },
  { id: 'service', label: 'SAV & parc installé', icon: 'wrench', group: 'Opérations', color: 'amber', desc: 'Équipements installés, garanties, interventions. (LIYA HEALTH)', pages: [['service', 'SAV & parc installé', 'wrench']] },
  { id: 'quality', label: 'Qualité & matériovigilance', icon: 'shield', group: 'Opérations', color: 'red', desc: 'Réclamations, incidents AMMPS, rappels, CAPA, traçabilité. (LIYA HEALTH)', pages: [['quality', 'Qualité', 'shield']] },
  { id: 'bookings', label: 'Réservations', icon: 'clock', group: 'Opérations', color: 'violet', desc: 'Démonstrations et prêts de matériel : calendrier et suivi.', pages: [['bookings', 'Réservations', 'clock']] },
  { id: 'projects', label: 'Gestion des projets', icon: 'layers', group: 'Opérations', color: 'teal', desc: 'Projets et tâches (tableau Kanban).', pages: [['projects', 'Projets', 'layers']] },
  { id: 'finance', label: 'Finance', icon: 'wallet', group: 'Finance & RH', color: 'green', desc: 'Suivi des paiements, dépenses et trésorerie.', pages: [['finance', 'Finance', 'wallet']] },
  { id: 'accounting', label: 'Comptable', icon: 'calculator', group: 'Finance & RH', color: 'navy', desc: 'Espace comptable : TVA, situation financière, revue de clôture, exports.', pages: [['accounting', 'Comptable', 'calculator']] },
  { id: 'hr', label: 'Ressources humaines', icon: 'users', group: 'Finance & RH', color: 'violet', desc: 'Employés, présence, congés et salaires.', pages: [['hr', 'Ressources humaines', 'users']] },
  { id: 'ai', label: 'LIYA IA', icon: 'sparkles', group: 'Outils', color: 'ai', desc: 'Assistant, prévisions, réappro, lecture de factures, scoring, rédaction.', pages: [['ai', 'LIYA IA', 'sparkles']] },
  { id: 'attachments', label: 'Pièces jointes', icon: 'folder', group: 'Outils', color: 'gray', desc: 'Classement des documents : dossiers, notes, fichiers.', pages: [['attachments', 'Pièces jointes', 'folder']] },
  { id: 'importer', label: 'Importer', icon: 'upload', group: 'Outils', color: 'blue', desc: 'Import Excel / CSV : clients, fournisseurs, produits, factures…', pages: [['importer', 'Importer', 'upload']] },
  { id: 'settings', label: 'Système & réglages', icon: 'settings', group: 'Système', core: true, color: 'gray', desc: 'Paramètres du système, utilisateurs, sécurité, intégrations, journaux.', pages: [['settings', 'Réglages', 'settings']] },
]

export const moduleOfPage = (page) => MODULES.find((m) => m.pages.some((p) => p[0] === page))

export const isModuleOn = (settings, id) => {
  const m = MODULES.find((x) => x.id === id)
  if (!m) return false
  if (m.core) return true
  return settings.modules?.[id] ?? true
}

// Une page est visible si son module est actif (et, pour un utilisateur restreint, autorisé).
export const isEnabled = (settings, page) => {
  const m = moduleOfPage(page)
  return m ? isModuleOn(settings, m.id) : false
}
