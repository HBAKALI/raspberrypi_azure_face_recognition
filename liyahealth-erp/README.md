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

## Modules (activables dans Paramètres › Modules)

| Groupe | Module | Fonctionnalités |
|---|---|---|
| Pilotage | Tableau de bord | CA, marge, créances, prévision IA, ventes par catégorie, top clients, stock, AO, pipeline, SAV |
| | Rapports & analyses | CA/marge par mois, client, produit, catégorie, ville, public/privé ; export CSV ; rapport mensuel imprimable |
| Commercial | CRM | Pipeline Kanban (glisser-déposer), prévision pondérée, taux de conversion |
| | Ventes | Devis → commande → BL → facture → avoir ; conversion en un clic ; impression PDF ; montant en lettres ; paiements |
| | Clients | CHU, hôpitaux, cliniques ; encours, échu, historique, parc installé |
| | Appels d'offres | Pipeline marchés publics, score IA, check-list des pièces, cautions, calendrier des échéances |
| Achats & Stock | Achats | BC fournisseurs → réception (lots, péremption) → facture fournisseur |
| | Fournisseurs | Partenaires fabricants, devises, délais, notation |
| | Produits & stock | Catalogue DM (classe, AMMPS, CE), lots, FEFO, multi-dépôts, mouvements, transferts, inventaire |
| Opérations | SAV & parc installé | Équipements livrés ajoutés automatiquement, garanties, contrats, interventions, planning techniciens |
| | Qualité & matériovigilance | Réclamations, incidents AMMPS, rappels FSCA, CAPA, traçabilité lot → clients à contacter |
| Finance & RH | Finance & trésorerie | Encaissements, décaissements, dépenses, TVA, balance âgée, trésorerie prévisionnelle 13 semaines |
| | Ressources humaines | Employés, congés (validation), masse salariale, CNSS/AMO (estimation) |
| Intelligence | **LIYA IA** | Voir ci-dessous |

## Module IA — LIYA IA

Fonctionne **sans clé API** grâce à un moteur local (`src/ai/engine.js`), et devient conversationnel avec **Claude** :

- **Assistant** : questions en langage naturel sur toutes les données (ventes, stock, AO, créances, SAV). Réponses en streaming via l'API Claude, ou calculées localement hors ligne.
- **Prévisions** : lissage de Holt (niveau + tendance) sur 12 mois, global et par produit, avec intervalle d'erreur et précision (1 − WAPE).
- **Réapprovisionnement** : point de commande, stock de sécurité (service 95 %), délais fournisseurs → **génération automatique des bons de commande** par fournisseur.
- **Anti-péremption** : lots qui ne seront pas écoulés avant leur date limite, valeur exposée, actions FEFO.
- **Risque clients** : score à partir de l'échu, de l'encours et des retards moyens → relance rédigée par l'IA.
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
