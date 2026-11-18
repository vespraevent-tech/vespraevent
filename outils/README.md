# Outils (hors site, jamais dans le zip)

## Pages « Organisation d'événements »
Les pages `organisation-*.html` (particuliers, entreprises, mariage, anniversaire, gender reveal, soirée d'entreprise, séminaire, anniversaire d'entreprise) sont **générées**.

- Contenu (textes, photos, FAQ, produits) : `pages_evenements_data.py`
- Gabarit (entête, menu, formulaire, pied de page) : repris de `site/evenements.html`
- Génération : `python3 outils/gen_pages_evenements.py` (depuis la racine du dépôt)

Ne pas modifier à la main les fichiers `site/organisation-*.html` : ils sont réécrits à chaque génération. Modifier les données ou le gabarit, puis relancer la génération.

Les photos agrandies `*-hd.webp` sont réservées à ces pages (liste `HD` dans le générateur).
