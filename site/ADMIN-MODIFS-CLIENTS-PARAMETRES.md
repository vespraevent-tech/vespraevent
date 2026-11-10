# Vespra Event — corrections back-office

## Corrections incluses

- La suppression des anciens Netlify Forms ne bloque plus sur de simples erreurs signalées pendant la migration. Le nettoyage reste protégé par la présence d'une migration initiale et conserve toujours `devis`, `reservation` et `newsletter`.
- Dans le module Réservation, la sous-page « Produits & tarifs » est masquée du menu.
- Dans Réservation > Paramètres, il ne reste que « Base clients ».
- Les clients existants du planning sont repris automatiquement dans la base clients si la base locale est vide, puis synchronisés dans Netlify Blobs.
- Les nouveaux clients et les modifications de clients sont enregistrés dans Netlify Blobs.
- Une page « Paramètres admin » a été ajoutée au back-office principal pour modifier l'identifiant administrateur et le mot de passe.
- Le nouveau mot de passe est stocké sous forme de dérivé scrypt avec sel, jamais en clair.

## Important

Le premier déploiement doit conserver les variables Netlify `ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_SECRET` et `NETLIFY_ACCESS_TOKEN`. Elles servent de secours initial et au fonctionnement de l'API Netlify. Après modification des identifiants depuis « Paramètres admin », les nouveaux identifiants deviennent prioritaires.
