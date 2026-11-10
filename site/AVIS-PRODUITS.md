> **Depuis la version actuelle :** les avis ne sont plus stockés dans Netlify Forms. Les demandes et les avis publiés sont enregistrés dans **Netlify Blobs**. Le formulaire public d'avis appelle directement `/api/avis/demande`, puis le bouton reçu par e-mail publie l'avis dans Blobs.

# Avis clients sur les fiches produit

Un client laisse un avis → **vous recevez un e-mail avec un bouton vert
« Publier cet avis sur le site »**. Vous cliquez, c'est en ligne. Vous ne
cliquez pas, rien ne se passe. C'est tout.

Aucun tableur, aucun code à copier, aucun compte externe.

---

## Mise en service — deux variables à créer, une seule fois

Netlify → votre site → **Site configuration** → **Environment variables**

| Nom | Valeur | À quoi ça sert |
|---|---|---|
| `NETLIFY_ACCESS_TOKEN` | un jeton personnel Netlify | lire et écrire les avis publiés |
| `AVIS_SECRET` | une longue phrase au hasard, que vous inventez | signer le lien du bouton pour que personne d'autre ne puisse publier un avis |

**Pour créer le jeton :** en haut à droite de Netlify, votre avatar →
**User settings** → **Applications** → **Personal access tokens** →
**New access token**. Donnez-lui un nom (« Avis Vespra »), copiez la valeur
affichée — elle ne sera plus visible ensuite — et collez-la dans la variable.

**Pour `AVIS_SECRET`,** n'importe quelle suite de caractères longue et
imprévisible fait l'affaire, par exemple `vespra-avis-2026-Kj8mQp3xZr7t`.
Elle ne sert qu'à empêcher quelqu'un de fabriquer un faux lien de publication.

Choisissez la portée **All scopes / All deploy contexts**, puis
**Deploys → Trigger deploy → Deploy site** : les variables ne sont lues
qu'au déploiement.

---

## Au quotidien

1. Un client laisse un avis sur une fiche produit.
2. Vous recevez l'e-mail « Nouvel avis à valider — *nom du produit* » avec le
   prénom, la note en étoiles et le texte.
3. **Vous cliquez sur le bouton vert.** Une page de confirmation s'affiche :
   « Avis publié ». L'avis apparaît sur la fiche produit dans la minute.
4. L'avis ne vous convient pas ? **Ne cliquez pas.** Rien n'est publié.

Le même lien cliqué deux fois ne crée pas de doublon : la page vous répond
simplement que l'avis est déjà en ligne.

---

## Retirer un avis publié

Netlify Blobs → store **vespra-reviews** → supprimez la
soumission correspondante. L'avis disparaît du site dans la minute.

---

## Ce qui se met à jour tout seul

Sur chaque fiche produit, la **note moyenne**, le **nombre d'avis vérifiés** et
les étoiles se recalculent à partir des seuls avis publiés. Tant qu'un produit
n'en a aucun, la fiche affiche « Soyez le premier à laisser un avis ».

---

## Si les variables ne sont pas encore créées

Le site continue de fonctionner normalement. L'e-mail affiche alors, à la place
du bouton, une ligne à coller dans le fichier `avis.js` — c'est la méthode de
secours, elle marche aussi. Dès que les deux variables existent, le bouton
apparaît automatiquement dans les e-mails suivants.

---

## À savoir

- Les avis Google de la page d'accueil sont un système séparé, inscrit
  directement dans le code du site.
- N'affichez pas ces avis produits comme des avis Google : ce sont deux
  sources distinctes, et Google interdit de rebaliser ses propres avis.
- Les 18 fiches produit ont désormais leur bloc avis.
