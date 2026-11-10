# Audit SEO — vespraevent.fr (138 pages analysées)

Aucune modification SEO n'a été appliquée : ce document est à valider.

## Déjà solide
- URLs propres sans `.html`, sitemap complet (aucune page indexable absente, aucune entrée sans page), `robots.txt` correct (panier et `/studio/` exclus).
- Aucun titre ni meta description dupliqué ; titres ≤ 65 caractères ; `lang`, `viewport`, canonical présents sur les pages publiques.
- Schema.org riche : LocalBusiness (80 pages), FAQPage (102), BreadcrumbList (79), Product/Offer (48–62).
- Pages villes avec GeoCircle / zone desservie : bon socle de SEO local.

## Priorités (impact décroissant)

### P1 — Structure Hn de l'accueil et de 28 pages
Les titres de section (« Quel événement préparez-vous ? », « Meilleures locations », « Avis clients », « Questions fréquentes »…) sont des `<div class="sec-h">`, pas des `<h2>`. Google ne les lit pas comme titres.
Correction : remplacer `div.sec-h` par `h2.sec-h` (même style) sur 28 pages. Risque : nul visuellement.
De plus, les 8 `<h2>` du carrousel d'accueil (« Photobooth en bois », « Vous hésitez ? »…) tournent et diluent la page : les passer en `<p role="presentation">` ou `<div>` ; garder un seul `<h1>`.

### P1 — Performance / Core Web Vitals (images)
- 1 138 images sur 1 600 sans `width`/`height` → décalages de mise en page (CLS). 
- 57 images sans `loading="lazy"`.
- 803 `alt=""` : légitime pour du décor, à vérifier pour les photos produit/articles (mots-clés + accessibilité).
Correction : ajouter dimensions et `loading="lazy"` automatiquement (script de build ou passe unique), compléter les alt des photos de contenu.

### P1 — Maillage interne
- 14 pages sans aucun lien entrant, dont 3 articles (`article-canons-poudre`, `article-fontaine-cocktail`, `article-voiture-collection`) et 3 fiches (`produit-palet-breton`, `produit-passe-trappe`, `produit-puissance-4-geant`).
- 26 pages avec 1 ou 2 liens entrants seulement (la plupart des articles).
Correction : bloc « À lire aussi / Produits associés » sur chaque article et fiche, liens article ↔ produit ↔ page ville.

### P2 — Pages à corriger
- `produit-jeux-bois.html` : pas de description, pas de H1, canonique vers une URL à paramètre (`/catalogue?cat=…`), `noindex`. À fusionner ou rediriger.
- `espace-client.html` : 7 H1, pas de description (page privée : garder `noindex`, ramener à 1 H1).
- `guide.html` : 4 H1 et 18 mots visibles hors scripts (contenu injecté en JavaScript) + 1 lien généré cassé (`${PAGE[r.id]}.html`). Le contenu doit être présent dans le HTML pour être indexé.
- `nos-prestataires` et `prestations` : description un peu longue (164 / 161 caractères, limite ~155).
- `rendez-vous`, `notices` : sans données structurées.

### P2 — Contenu et mots-clés
- 7 pages à moins de 250 mots (hors pages techniques) : `prestations` (158 mots) à étoffer.
- Intentions à couvrir en priorité : « location photobooth Vitré / Rennes / Ille-et-Vilaine », « location sono mariage Bretagne », « location barnum Vitré », « location matériel événementiel Grand Ouest ». Les pages villes existent ; vérifier que chacune a un H1 contenant « location + produit + ville » et un texte unique (> 400 mots) plutôt qu'un gabarit.
- Ajouter des pages de catégorie par intention (mariage, anniversaire, entreprise) si elles n'existent pas déjà en URL propre.

### P3 — Technique
- `og:` manquant sur 7 pages (surtout techniques) ; image Open Graph à vérifier sur les pages villes.
- Fichiers de page volumineux (jusqu'à 140 Ko de HTML avec CSS/JS en ligne) : externaliser le CSS commun en un seul fichier mis en cache.
- Préconnexions Google Fonts dupliquées, trois familles de polices chargées (Archivo, Bebas Neue, Inter) : réduire aux poids réellement utilisés.
- Hreflang inutile (site mono-langue).

## Plan proposé
1. P1 Hn + images (dimensions/lazy) + maillage interne : gain SEO et CWV le plus net, risque faible.
2. P2 pages à corriger.
3. P2 contenu local, rédaction par page ville (je peux proposer les textes avant publication).

Dis-moi ce que je peux appliquer.
