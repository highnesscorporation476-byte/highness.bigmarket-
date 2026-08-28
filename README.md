# HIGHNESS BIGMARKET — starter full-stack

Cette version transforme la maquette en application web full-stack locale/hébergeable.

## Fonctionnalités incluses
- Client : inscription, connexion, catalogue, panier, commandes, suivi.
- Prestataire : inscription, boutique, produits, stock, commandes, statistiques.
- Admin : comptes, boutiques, produits, commandes, commissions, statuts de livraison.
- Base SQLite persistante.
- Authentification JWT + mots de passe hashés.
- API REST.
- Notifications internes.
- Commission marketplace configurable.
- Paiement avec adaptateur `mock` prêt à remplacer par un prestataire réel.
- Responsive et identité noir/or de HIGHNESS BIGMARKET.
- Dockerfile pour déploiement.

## Lancer
1. Installer Node.js 20+.
2. Copier `.env.example` vers `.env`.
3. `npm install`
4. `npm start`
5. Ouvrir `http://localhost:3000`

Compte administrateur initial :
- email : valeur de `ADMIN_EMAIL`
- mot de passe : valeur de `ADMIN_PASSWORD`

## Paiement réel
Le code contient une abstraction de paiement. Pour encaisser réellement par Mobile Money/carte, il faut créer un compte marchand chez un prestataire de paiement et renseigner ses identifiants/API. Le mode `mock` ne débite aucun argent.

## Mise en ligne
Le projet peut être déployé sur un hébergeur Node/Docker. Pour une vraie exploitation commerciale, utiliser HTTPS, une base PostgreSQL managée, des sauvegardes, un stockage d'images, un fournisseur de paiement et un service de messagerie transactionnelle.
