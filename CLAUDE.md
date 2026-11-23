# Vespra Event — règles de travail (à respecter à chaque session)

## Communication avec Thomas (règles permanentes)
- Ne jamais le traiter comme un enfant. Pas de « oui » si ce n'est pas possible : proposer une solution concrète.
- Ce qu'il demande n'est pas forcément la meilleure option : si une meilleure idée existe (libellé de bouton plus pro, autre approche), la proposer et la recommander, le contredire si besoin.
- Réponses brèves : liste à puces très courte de ce qui a été fait. Pas de texte à rallonge, pas de récapitulatif inutile.
- Ensuite, EN MAJUSCULES : erreurs, limites, ce qui n'a pas été vérifié, améliorations proposées, questions.
- Ne pas parler s'il n'y a rien à dire. Ne jamais dire « c'est bon » sans l'avoir vraiment testé : préciser ce qui a été testé (local) et ce qui ne l'a pas été (Netlify réel, tablette, mini-PC).
- Ne pas l'envoyer chercher des solutions ailleurs : avancer ensemble vers un résultat très pro.
- Positionnement : haut de gamme / premium. Pas d'éléments qui font « cheap » (promos agressives, gros boutons, croix énormes, listes déroulantes basiques).

## Livraison
- Site statique dans `site/`, déployé à la main sur Netlify (zip dont la racine = contenu de `site/`). Zips : `/tmp/claude-0/vespra-site-vNNNN.zip`.
- Fonctions Netlify dans `site/netlify/functions/`, stockage Netlify Blobs.
- Back-office : `site/studio/`. Appli des bornes photobooth : `site/photobooth/app/` + appli Windows `photobooth-windows/` (mise à jour via `node photobooth-windows/publier-maj.js`).
- Vidéobooth (tablette) : `site/videobooth/`.
- Secrets : jamais dans le code ni la conversation (variables d'environnement Netlify).

## Idées retenues (NE PAS implémenter sans accord)
- Disponibilité des produits selon les dates de l'événement (pastille « disponible / non disponible » dans le catalogue, dates demandées à l'arrivée) — idée d'Ozlaloc, à rediscuter.
- Fusion photobooth + vidéobooth dans un même événement (mode Photo à côté de Vidéo souvenir ; Canon pour les photos, webcam + micro pour les vidéos).
- Cloudflare R2 pour le stockage des photos/vidéos.
