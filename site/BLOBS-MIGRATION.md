# Migration Netlify Forms → Netlify Blobs — Vespra Event

## Ce qui reste dans Netlify Forms

- `devis`
- `reservation`
- `newsletter`

## Ce qui passe dans Netlify Blobs

- produits
- blog
- apparence / thème
- textes
- notices
- avis Google administrés
- planning / réservations du back-office
- suivi des demandes
- logistique
- avis clients publiés et avis en attente
- images et PDF envoyés depuis le back-office

## Procédure

La migration ci-dessous est **une opération initiale, à faire une seule fois**. Après cette migration, les enregistrements du back-office ne repassent plus par Netlify Forms : un clic sur **Enregistrer** écrit directement dans Netlify Blobs et invalide le cache du site. Il n’y a donc **aucune migration à refaire après chaque modification**.


1. Déployer cette version sur le même site Netlify.
2. Vérifier que `NETLIFY_ACCESS_TOKEN`, `ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_SECRET`, `AVIS_SECRET` et `RESEND_API_KEY` sont toujours configurés.
3. Ouvrir `/studio/` et se connecter.
4. Cliquer **Migrer vers Blobs**.
5. Vérifier les produits, articles, notices, avis et planning.
6. Une fois la vérification terminée, cliquer **Nettoyer Forms**.
7. Ensuite, pour les modifications courantes (produits, blog, tarifs, textes, etc.), utilisez simplement **Enregistrer** : la donnée est écrite directement dans Blobs et le site est actualisé automatiquement.

Le bouton de nettoyage refuse de supprimer les anciens formulaires si la migration n'a pas laissé un marqueur sans erreur.

Les trois formulaires publics `devis`, `reservation` et `newsletter` ne sont jamais supprimés par ce nettoyage.


## Pourquoi les modifications ne s'enregistraient pas (corrigé)

La fonction `admin.mjs` importait la bibliothèque Netlify Blobs par son nom
(`@netlify/blobs`), déclarée dans `package.json`. Or ce site se déploie par
simple dépôt du dossier : Netlify n'exécute aucune installation de paquets,
la bibliothèque était donc **introuvable au moment de l'exécution** et
chaque enregistrement échouait.

Elle est maintenant **incluse dans le dossier** (`netlify/functions/_blobs.mjs`)
et importée par son chemin. Plus aucune installation n'est nécessaire, que le
site soit déposé à la main ou déployé depuis un dépôt Git.

## Liste des réservations vide

La page lisait d'abord les demandes du site (API Netlify Forms). Si cet appel
échouait — jeton absent, panne passagère — **toute la page** restait vide, y
compris les réservations du planning qui, elles, viennent des Blobs. Les deux
lectures sont désormais indépendantes : ce qui est disponible s'affiche.
