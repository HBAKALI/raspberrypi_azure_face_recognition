# LIYA HEALTH ERP

ERP complet pour **LIYA HEALTH SARL** (importateur / distributeur de dispositifs médicaux, Casablanca), construit en **React + Vite**, avec un module d'intelligence artificielle **LIYA IA**.

> *Surveiller · Protéger · Accompagner*

## Démarrage

```bash
cd liyahealth-erp
npm install
npm run dev            # http://localhost:5173
npm run build          # build de production dans dist/
npm run build:single   # un seul fichier HTML autonome (démo hors ligne) dans dist-single/
```

Les données de démonstration (12 mois d'historique réaliste) sont générées au premier lancement et enregistrées dans le navigateur (`localStorage`). Paramètres › Données permet d'exporter / importer / réinitialiser.

## Modules (Réglages › Modules) — alignés sur GStocky

Les 20 modules de GStocky sont repris, plus 3 modules métier propres aux dispositifs médicaux. Chaque module s'active ou se désactive ; le tableau de bord, l'inventaire et les réglages forment le noyau.

| # | Module | Fonctionnalités |
|---|---|---|
| 1 | Tableau de bord | Assistant de démarrage, CA, marge, état des factures (payées, en attente, partielles, en retard, annulées, à échéance), moyens de paiement, briefing IA |
| 2 | CRM | Clients et fournisseurs : solde dû, retards, historique, parc installé |
| 3 | Inventaire | Produits avec photo, codes-barres EAN-13 (génération, étiquettes, scan douchette ou caméra), catégories, lots et péremption (FEFO), entrepôts, mouvements, inventaire physique |
| 4 | Ventes | Devis → commandes → livraisons → factures → retours / avoirs, documents liés, mode de paiement, 3 modèles de facture |
| 5 | Achats | Commandes → réceptions (lots) → factures fournisseurs → retours fournisseurs |
| 6 | Point de vente | Caisse (catalogue, panier, scan, encaissement, rendu monnaie, ticket), transactions, ouverture / clôture de caisse, rapports |
| 7 | Finance | Paiements, dépenses, balance âgée, TVA, trésorerie prévisionnelle |
| 8 | Pièces jointes | Gestionnaire de fichiers : dossiers, notes, déplacement, stockage local (IndexedDB) |
| 9 | Comptable | Période, déclaration de TVA (Excel / PDF), situation financière, revue de clôture (ICE manquants, références de paiement…), journaux, grand livre simplifié |
| 10 | Gestion des projets | Tâches en Kanban (À faire → Terminé), projets avec équipe, priorité, avancement |
| 11 | Ressources humaines | Tableau de bord RH, Mon espace, employés, congés, pointage et absences, paie |
| 12 | Abonnements | Adapté : location de matériel et forfaits récurrents (MRR, renouvellements, facturation de période) |
| 13 | Contrats | Création en étapes, contrats clients et fournisseurs (maintenance, distribution, autorisation fabricant), renouvellement |
| 14 | Analyses avancées | Tableaux de bord à widgets personnalisables + rapports détaillés |
| 15 | Réservations | Adapté : démonstrations et prêts de matériel, calendrier, contrôle de disponibilité |
| 16 | Prospects | Prospects (source, statut, commercial, valeur, score IA), conversion en client, pipeline d'opportunités |
| 17 | Planning | Calendrier des interventions techniciens (mois, semaine, liste, Mon planning), statuts prévu / en cours / terminé / échoué / reporté |
| 18 | Marketing | Campagnes e-mail et WhatsApp par segment, message rédigé par l'IA, automatisations (verrouillé dans GStocky, inclus ici) |
| 19 | LIYA IA | Assistant, prévisions, réapprovisionnement, lecture automatique de factures, scoring, anomalies, rédaction |
| 20 | Importer | Import Excel / CSV en 3 étapes (type, association des colonnes, aperçu) : clients, fournisseurs, produits, factures, livraisons, factures fournisseurs |
| — | Système & réglages | Général (logo, cachet, TVA, devise, langue, RIB, conditions, pied de page, modèle de facture), modules, intégrations (Claude, API, webhooks), sécurité (2FA, sessions), utilisateurs et accès par module, journal |
| + | Appels d'offres | Spécifique LIYA HEALTH : marchés publics, score IA, check-list des pièces, cautions |
| + | SAV & parc installé | Spécifique LIYA HEALTH : équipements, garanties, interventions |
| + | Qualité & matériovigilance | Spécifique LIYA HEALTH : réclamations, incidents AMMPS, rappels, CAPA, traçabilité lot |

## Module IA — LIYA IA

Fonctionne **sans clé API** grâce à un moteur local (`src/ai/engine.js`), et devient conversationnel avec **Claude** :

- **Assistant** : questions en langage naturel sur toutes les données (ventes, stock, AO, créances, SAV). Réponses en streaming via l'API Claude, ou calculées localement hors ligne.
- **Prévisions** : lissage de Holt (niveau + tendance) sur 12 mois, global et par produit, avec intervalle d'erreur et précision (1 − WAPE).
- **Réapprovisionnement** : point de commande, stock de sécurité (service 95 %), délais fournisseurs → **génération automatique des bons de commande** par fournisseur.
- **Anti-péremption** : lots qui ne seront pas écoulés avant leur date limite, valeur exposée, actions FEFO.
- **Risque clients** : score à partir de l'échu, de l'encours et des retards moyens → relance rédigée par l'IA.
- **Lecture de factures** : déposez une facture fournisseur (PDF, image) ; Claude extrait fournisseur, lignes et totaux, puis l'ERP crée la facture fournisseur.
- **Détection d'anomalies** : ventes sous le prix de revient, remises atypiques, quantités hors norme, doublons, trop-perçus.
- **Scoring des appels d'offres** : adéquation catalogue, historique acheteur, délai, taux de réussite, taille → recommandation.
- **Rédaction IA** : relances de paiement, mémoires techniques d'AO, fiches produits, demandes de cotation fournisseurs, e-mails d'accompagnement de devis.
- **Alertes intelligentes** : centre de notifications et briefing quotidien sur le tableau de bord.

### Connecter Claude

Paramètres › Intelligence artificielle :

- **Production (recommandé)** — la clé reste sur le serveur :
  ```bash
  ANTHROPIC_API_KEY=sk-ant-... ALLOWED_ORIGIN=https://erp.example.ma npm run ai-proxy
  ```
  puis renseigner l'URL du proxy (`http://<hôte>:8787`).
- **Démo / poste unique** : coller la clé API directement (stockée uniquement dans ce navigateur).

Modèle par défaut : `claude-opus-5-5` (Sonnet 5.5, Haiku 5.5 et Fable 5.1 sélectionnables). Seul un résumé agrégé est envoyé (CA, stock, AO, créances) — aucune donnée RH nominative.

## Architecture

```
src/
  ai/engine.js        moteur IA local (prévisions, réappro, scoring, anomalies, assistant hors ligne)
  ai/claude.js        connexion Claude (SDK Anthropic, streaming, proxy ou clé)
  components/         kit UI (tableaux, graphiques SVG, modales), moteur de documents commerciaux
  data/seed.js        données de démonstration LIYA HEALTH
  lib/                store (localStorage), domaine (TVA, totaux, montants en lettres), stock FEFO, modules, navigation
  pages/              un fichier par module
server/ai-proxy.mjs   proxy API Claude (clé côté serveur)
```

Pour passer en multi-utilisateurs, remplacer `load` / persistance de `src/lib/store.jsx` par des appels à une API (Supabase, Node/PostgreSQL…) : les pages n'accèdent aux données qu'à travers ce store.
