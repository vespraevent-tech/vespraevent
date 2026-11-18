# Produits à ajouter (brouillons)

**Ce dossier n'est PAS dans le zip du site** : le zip est construit uniquement à partir de `site/`.
Rien ici n'est publié tant que les prix et les photos ne sont pas fournis.

## Comment ça marche
1. Thomas annonce des produits au fil des jours → je les note dans `produits.json` (une entrée par produit) et dans la liste ci-dessous.
2. Pour chaque produit : brouillon de description, catégorie, options possibles, et **questions à lui poser** (dimensions, prix, photos…).
3. Quand les prix et les photos arrivent : je génère la fiche produit complète (page, catalogue, devis, back-office…) et seulement alors le produit entre dans le zip.

## Liste (mise à jour au fil de l'eau)
| # | Produit | Catégorie visée | État |
|---|---------|-----------------|------|
| 1 | Chiffres et lettres géants en bois | Panneau de bienvenue et décoration | idée notée — prix, tailles, photos à fournir |
| 2 | Arche de ballons | Panneau de bienvenue et décoration | idée notée — prix, tailles, photos à fournir |
| 3 | Fonds de photobooth (fleurs, squelettes, sequins, etc.) | Photobooth et Vidéobooth + Décoration | idée notée — thèmes, tailles, prix, photos à fournir |
| 4 | Effets spéciaux : lance-flammes, confettis, CO2, canon à mousse, canon à neige | Effets spéciaux (nouvelle catégorie) | idée notée |
| 6 | Chiffres et lettres géants lumineux | Décoration | idée notée |
| 5 | **Mise en avant : organisation d'événements clé en main (pros, mariages, soirées à thème) avec prestataires : vidéo, photo, traiteur, pâtisserie…** | Section accueil + page dédiée | idée notée, à valoriser |

## Où un produit doit apparaître quand il est mis en ligne (à vérifier à chaque ajout)
- `site/produit-<nom>.html` (fiche, modèle : `produit-panneau-bienvenue.html`)
- `site/catalogue.html` (tableau `PRODUCTS`), `site/vm-popup.js`, `site/accueil-sections.js`, `site/index.html` (si le produit est mis en avant)
- `site/prix-registre.js` (prix et options), `site/netlify/functions/_produits-pages.json`
- Back-office : catalogue (`studio/index.html`, fonction `catalogue()`), planning (`studio/reservation.html`, tableau `P` et quantités)
- Référencement : `site/sitemap.xml`, `site/llms.txt`, `site/plan-du-site.html`, éventuellement `_redirects`
- Images : fichiers `.webp` + registre d'images (`images-registre.js`)
- Règle de la maison : quantités (qteMax), options, pas de promotion du M-Fog 1500, boutons à ~8 px de rayon, identité visuelle inchangée.

## Règles données par Thomas (à respecter)
- Les produits ci-dessus restent **en attente** (pas de fiche, pas de prix) tant qu'il n'a pas les photos et les prix.
- **Exception** : on peut les **citer dans les textes** des pages d'organisation d'événements, avec la mention « sur demande » : arche de ballons, chiffres et lettres géants lumineux, fonds photobooth. Quand ces produits seront mis en ligne, retirer « sur demande » et ajouter un lien vers leur fiche (textes concernés : cartes « décor » / « ambiance » dans `outils/pages_evenements_data.py`, carte « Soirée à thème » de `site/evenements.html`).
- **Photos** : sur les pages d'**organisation d'événements**, uniquement des photos avec un beau décor (pas de fonds blancs). Sur les pages de **location** (catalogue, fiches produit, carrousels « meilleures locations », carrousels « à louer »), les fonds blancs sont acceptés.
