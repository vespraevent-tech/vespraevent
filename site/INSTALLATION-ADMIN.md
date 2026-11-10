> **Architecture actuelle (Netlify Blobs)** — Le back-office utilise désormais **Netlify Blobs** pour ses données internes (produits, blog, apparence, textes, notices, planning, logistique, avis et fichiers). Les seuls formulaires Netlify conservés sont **`devis`**, **`reservation`** et **`newsletter`**. Après le premier déploiement, connectez-vous au back-office et cliquez sur **« Migrer vers Blobs »**. Vérifiez ensuite les données puis utilisez **« Nettoyer Forms »** pour supprimer les anciens formulaires internes.

# Activer le back-office Vespra Event

Le code est prêt et déployé avec le site. Il reste **une seule chose à faire** :
déclarer une variable dans Netlify. Comptez deux minutes.

---

## 1. Les variables à créer dans Netlify

Tableau de bord Netlify → votre site →
**Site configuration** → **Environment variables** → **Add a variable**

| Nom | Valeur | Obligatoire |
|---|---|---|
| `ADMIN_USER` | votre identifiant de connexion | oui |
| `ADMIN_PASSWORD` | votre mot de passe de connexion | oui |
| `ADMIN_SECRET` | une longue chaîne aléatoire (ex : générée sur [1password.com/password-generator](https://1password.com/password-generator/)) | oui |

⚠️ **`ADMIN_SECRET` : à créer une fois, puis à ne plus jamais changer.**
Cette clé sert à signer chaque produit et chaque article enregistré, et le
site n'affiche que le contenu correctement signé (voir plus bas). Si vous la
changez, les produits et articles déjà enregistrés cesseront d'apparaître sur
le site — ils ne seront pas perdus, mais il faudra les ré-enregistrer depuis
l'admin. Le mot de passe, lui, peut être changé quand vous voulez sans risque.

Choisissez la portée **All scopes** / **All deploy contexts**.

⚠️ **L'identifiant et le mot de passe ne sont écrits nulle part dans le code
du site.** Ils existent uniquement dans ces variables Netlify, et le code les
lit au moment de la connexion. C'est ce qui fait qu'ils restent secrets même
si quelqu'un regarde le code source du site.

Vous avez déjà `NETLIFY_ACCESS_TOKEN` configuré (utilisé pour les avis) —
le back-office s'en sert aussi, rien à faire de ce côté.

---

## 2. Redéployer

Les variables ne sont lues qu'au déploiement.
**Deploys** → **Trigger deploy** → **Deploy site**.

---

## 3. Se connecter

Rendez-vous sur **vespraevent.fr/admin** et entrez l'identifiant et le mot
de passe définis à l'étape 1. La session reste ouverte 12 heures, puis il
faudra vous reconnecter.

Ce qui protège l'accès :

- identifiant **et** mot de passe exigés, vérifiés côté serveur uniquement ;
- comparaison à temps constant et délai d'attente à chaque échec, pour qu'un
  robot ne puisse pas tester des milliers de mots de passe ;
- cookie de session signé (HMAC), `HttpOnly` + `Secure` + `SameSite=Strict` :
  il n'est pas lisible par du JavaScript et ne part jamais vers un autre site ;
- toutes les routes qui écrivent (produits, blog, avis) vérifient ce cookie,
  la page `/studio` n'est qu'une coquille vide tant qu'on n'est pas connecté ;
- la page `/studio` est en `noindex` : elle ne remontera pas dans Google ;
- **chaque produit et chaque article est signé** avec `ADMIN_SECRET` au moment
  de l'enregistrement, et le site public n'affiche que le contenu dont la
  signature est valide. C'est ce qui empêche quelqu'un qui découvrirait le nom
  des formulaires Netlify d'injecter un faux produit ou un faux article sur le
  site : son envoi serait stocké, mais jamais affiché — et il apparaîtrait dans
  l'admin avec la mention rouge **⚠ non vérifié**, prêt à être supprimé ;
- les fichiers internes (`INSTALLATION-*.md`, code des fonctions) renvoient
  désormais une page 404 s'ils sont demandés depuis l'extérieur.

⚠️ Ne partagez jamais ces identifiants : quiconque les connaît peut ajouter,
modifier ou supprimer des produits, articles et avis.

---

## 4. Ce que vous pouvez faire depuis `/studio`

### Onglet Produits

La liste de vos 18 produits, avec leur photo. Cliquez sur l'un d'eux pour
ouvrir sa fiche et modifier :

- **le prix de chaque variante** (les 5 formules photobooth, les 3 tailles de
  barnum, les 5 packs sono…) ou le prix simple du produit s'il n'a pas de
  variante ;
- **le nom de chaque variante** ;
- **l'image** du produit : choisissez-la sur votre ordinateur, elle est
  envoyée et reliée au produit sans redéployer le site. Vous pouvez aussi
  saisir le nom d'une image déjà présente sur le site. L'image change sur la
  fiche produit comme sur la carte du catalogue ;
- sa **description courte** ;
- les **notices PDF** : vous pouvez en masquer et en ajouter (voir ci-dessous).

Un prix modifié s'affiche en jaune avec son prix d'origine à côté, et
**Tout réinitialiser** remet le produit dans son état d'origine. Une
modification est répercutée partout : fiche produit, carte du catalogue,
fenêtre de choix des variantes, et montant ajouté au devis.

Le bouton **+ Nouveau produit** sert pour du matériel qui n'existe pas encore
sur le site. Il apparaît comme une carte supplémentaire au catalogue (sans
fiche produit détaillée). Pour lui créer une vraie fiche, demandez-la moi.

### Onglet Blog

Deux parties.

**Articles de blog** — ajouter, modifier ou supprimer un article écrit depuis
le back-office. Il apparaît en haut de la page Blog et s'ouvre sur sa propre
page.

**Articles déjà sur le site** — les 9 articles rédigés dans les pages du
site. Trois boutons : **Voir** l'article, **Modifier** son texte (cela vous
bascule sur l'onglet Textes avec la bonne page déjà choisie), et **Masquer**
pour le retirer de la page Blog sans le supprimer.

### Onglet Avis

Deux parties :

**Avis produit sur le site** — publier un avis client directement, sans
passer par le lien de validation envoyé par e-mail, ou en supprimer un. Ces
avis s'affichent sur la fiche du produit concerné.

**Avis Google** — la liste des avis recopiés depuis votre fiche Google Maps,
affichés en bandeau sur la page d'accueil. Vous pouvez en **masquer** un
(il disparaît du site, le bouton « Réafficher » le remet) ou en **ajouter**
un nouveau quand vous en recevez un sur Google. Les avis d'origine ne sont
jamais supprimés : masquer ne fait que les retirer de l'affichage.

### Onglet Textes

Choisissez une page dans la liste, et tous ses titres et paragraphes
s'affichent, prêts à être réécrits. Vous modifiez, vous enregistrez, et le
texte change sur le site. Un bouton **Texte d'origine** annule la
modification.

Les blocs qui contiennent un lien ou du gras sont affichés mais verrouillés :
les réécrire ferait disparaître cette mise en forme. Pour ceux-là,
demandez-les moi.

Un texte n'est remplacé sur le site que si le texte d'origine s'y trouve
toujours à l'identique. Si une page change, votre modification est ignorée
plutôt que d'être écrite au mauvais endroit.

### Onglet Notices

Les notices affichées sur la page **Notices** du site : vous pouvez en
masquer une (elle disparaît du site, un bouton la remet) ou en ajouter.
Les notices qui apparaissent dans la liste déroulante d'une fiche produit se
gèrent depuis l'onglet **Produits**, sur la fiche concernée.

**Ajouter une notice.** Trois façons de fournir le PDF :

1. **Envoyer un fichier** — vous choisissez le PDF sur votre ordinateur. Il
   est déposé sur votre espace Netlify et relié à la notice. C'est le plus
   simple : aucun redéploiement du site n'est nécessaire.
2. **Un PDF déjà sur le site** — la liste des PDF présents dans le site.
3. **Une adresse internet** — si le PDF est hébergé ailleurs. Le site utilise
   déjà ce procédé pour la notice du barnum 6×10 m.

ℹ️ Les fichiers envoyés depuis le back-office (PDF de notice, images de
produit ou d'article) passent par les formulaires Netlify, gratuits et
illimités sur les offres à crédits. Ils évitent surtout un déploiement, qui
lui coûte 15 crédits.

### Onglet Apparence

Couleur principale, couleur d'accent, couleur du texte, police des titres,
police du texte, taille du texte et arrondi des angles — appliqués à
l'ensemble des pages du site.

À droite, **l'aperçu en direct** montre votre site tel qu'il deviendrait :
chaque modification s'y affiche en quelques secondes, et le menu déroulant
permet de vérifier plusieurs pages (accueil, catalogue, fiche produit, blog,
réservation).

Rien n'est visible par vos visiteurs tant que vous n'avez pas décidé :

- **Enregistrer le brouillon** conserve votre travail sans rien changer sur
  le site public. La pastille affiche alors « brouillon non publié », et vous
  pouvez y revenir plus tard.
- **Mettre en ligne** applique l'apparence à tout le site, après une
  confirmation. La pastille passe à « en ligne ».
- **Réinitialiser** remet l'apparence d'origine.

Quand vous changez la couleur principale, toutes les nuances de bleu du site
(survols, dégradés, aplats foncés) sont recalculées automatiquement en
gardant leur écart d'origine : le site reste cohérent, il ne devient pas
d'une seule couleur plate.

---

## Comment tout cela fonctionne (et ce qui n'est pas couvert)

Les prix, les couleurs et les polices restent écrits en dur dans les pages
du site. Trois fichiers (`prix-registre.js`, `prix.js`, `theme.js`) appliquent
par-dessus ce que vous avez modifié depuis l'admin. Conséquence utile : si le
back-office est indisponible, le site affiche simplement son contenu et son
apparence d'origine — il ne casse pas et n'affiche jamais de page vide.

**Les prix cités dans le texte suivent aussi.** Quand vous changez un prix,
161 mentions rédigées dans les phrases du site sont mises à jour en même
temps : articles de blog, pages de villes, FAQ, paragraphes des fiches
produit (« Le Pack Vespra va de 70 € pour 60 personnes à 150 € pour 200
personnes »). Chacune a été repérée à l'avance avec le texte qui la précède,
pour ne jamais remplacer un montant à la place d'un autre. Les montants dont
le rattachement était ambigu — frais de livraison, chiffres sans produit
clairement identifiable — ont volontairement été laissés de côté : mieux vaut
un prix non mis à jour qu'un prix faux au mauvais endroit.

Ce qui n'est pas modifiable depuis l'admin :

- **Le nom d'un produit** et le texte détaillé de sa fiche (paragraphes, FAQ,
  caractéristiques) : ils sont rédigés dans la page. Demandez-les moi.
- **Les quelques mentions de prix laissées de côté** (celles dont le contexte
  était ambigu) et les titres de pages destinés aux moteurs de recherche.
- **Les données structurées destinées à Google** et les descriptions de
  partage : elles gardent les valeurs d'origine.
- **Le catalogue PDF** : c'est un document séparé, à régénérer.
- **Ajouter ou supprimer une variante** sur une fiche existante, et **ajouter
  une notice PDF** : le fichier doit être déposé sur le site au préalable.

Concrètement : après avoir changé un prix, dites-le moi si vous voulez que je
mette aussi à jour le catalogue PDF et les mentions de prix dans les textes.

⚠️ **Ne modifiez pas `prix-registre.js` à la main.** Ce fichier décrit le site
tel qu'il est écrit. Si on ajoute ou retire une variante sur une fiche
produit, il faut le régénérer — demandez-le moi à ce moment-là.

---

## Sécurité

`ADMIN_USER`, `ADMIN_PASSWORD` et `ADMIN_SECRET` donnent un accès complet au
contenu du site. Ne les mettez jamais dans un fichier du site, un e-mail ou
une capture d'écran — uniquement dans les variables d'environnement Netlify.
Si le mot de passe a été exposé, changez simplement `ADMIN_PASSWORD` dans
Netlify et redéployez : tous les accès existants sont coupés immédiatement,
y compris les sessions ouvertes.

Changer le mot de passe est une opération de dix secondes sans effet de bord :
en cas de doute, faites-le plutôt deux fois qu'une.

---

## Coût et crédits Netlify

Sur les offres à crédits, **les envois de formulaires sont gratuits et
illimités**. Vos modifications depuis le back-office — prix, textes, avis,
notices, apparence — ne consomment donc pas de crédits à ce titre.

Ce qui consomme des crédits, c'est le temps de calcul des fonctions et le
nombre de requêtes web, et cela dépend de **vos visiteurs**, pas de vos
modifications. Sans précaution, chaque page vue aurait réveillé la fonction
plusieurs fois, et chaque réveil interroge l'API de Netlify.

Trois mesures limitent cela :

- **Le CDN de Netlify garde les réponses en mémoire** (une heure, avec
  réutilisation prolongée) : la réponse est servie directement, sans réveiller
  la fonction. La directive « durable » partage ce cache entre tous les
  serveurs de Netlify, au lieu d'un cache par serveur.
- **Le navigateur du visiteur les garde deux minutes** : en naviguant de page
  en page, il ne redemande rien.
- **Aucune requête n'est faite quand il n'y a rien à demander** : une fiche
  produit sans notice n'appelle pas la partie notices.

Et pour que le cache ne retarde jamais vos changements, **il est vidé
automatiquement à chaque enregistrement** depuis le back-office : ce que vous
modifiez est visible immédiatement.

Pour donner un ordre de grandeur, une page vue déclenche aujourd'hui entre
zéro et quatre petites requêtes, presque toujours servies par le cache. Le
poste de dépense principal de votre site reste le déploiement (15 crédits) et
la bande passante, comme avant l'ajout du back-office.

---

## Réservation

Le menu **Réservation** de la barre de gauche regroupe six pages.

### Liste des réservations

Toutes les demandes de devis envoyées depuis le site arrivent ici, la plus
récente en haut. Chacune porte un statut :

- **Nouvelle** — vous ne l'avez pas encore traitée (statut de départ) ;
- **En cours** — vous avez commencé à répondre ;
- **Validée** — la réservation a été ajoutée au planning.

La page s'appelle « Liste des réservations » et non « demandes de devis » :
elle contient aussi bien les demandes à traiter que les réservations déjà
confirmées.

**Par période.** La liste montre par défaut ce qui arrive dans les **trois
prochaines semaines**. La première liste déroulante propose trois autres
vues : *Plus tard* (au-delà de trois semaines), *Archivées* (événements
déjà passés) et *Toutes les périodes*. Le nombre de réservations de chaque
vue est indiqué dans son intitulé.
Rien n'est supprimé : une réservation lointaine apparaît d'elle-même dans
la vue par défaut à mesure que la date approche, et une réservation passée
bascule toute seule dans les archives le lendemain. Une demande sans date
reste dans la vue courante, puisque c'est justement ce qu'il faut préciser.

**Recherche.** Le champ en haut de page cherche dans le nom, le téléphone,
l'e-mail, la date, le type d'événement, l'adresse et le matériel. Les
accents, les majuscules et les espaces sont ignorés : « dupont » trouve
« Dupont », et « 06 12 34 56 78 » trouve « 0612345678 ». Une recherche
ignore le filtre de période — sinon chercher un client dont l'événement est
en décembre ne donnerait rien.

La liste reste volontairement sobre : **nom du client, matériel demandé,
date de l'événement**, et l'étiquette du statut. Un clic sur une demande
ouvre sa fiche complète — coordonnées cliquables (appel, e-mail,
itinéraire), adresse de livraison, nombre de convives, type d'événement,
message du client — avec le bouton **Supprimer**.

**Modifier une réservation.** Le bouton *Modifier* de la fiche ouvre un
formulaire où **tout est modifiable** : nom, téléphone, e-mail, date,
convives, type d'événement, livraison (oui/non), adresse, matériel et
options, message. La demande envoyée par le client n'est jamais réécrite —
vos corrections sont enregistrées à côté et appliquées par-dessus, si bien
qu'un champ laissé vide reprend la valeur d'origine.

Si la réservation est déjà au planning, la correction y est reportée
aussitôt : nom, téléphone, e-mail, lieu, livraison et date. Elle vaut donc
partout — liste, fiche, planning et Départs & retours.

Le statut se change depuis la liste déroulante à droite de chaque ligne,
comme dans la fiche : la demande bascule aussitôt dans la catégorie
correspondante. La deuxième liste déroulante en haut de page n'affiche
qu'un statut à la fois.

Dans **Produits & tarifs** du menu principal, chaque fiche produit affiche
désormais, sous ses variantes, la rubrique **Options proposées sur la
fiche** : sacs de lestage, éclairage, caisson de basse, cadre
personnalisable, déguisements, maïs à éclater. Leur tarif se modifie comme
celui d'une variante, et le changement s'applique sur le site — étiquette
« + 45 € », prix affiché et montant ajouté au devis. Une option « sur
devis » est rappelée sans prix à saisir.

Le résumé du matériel reprend la **formule choisie et toutes les options**
(livraison et installation, sacs de lestage, fond personnalisé…), avec le
prix total de la ligne — ce sont elles qui changent le tarif et la
préparation.

**L'ordre par défaut est chronologique** : l'événement le plus proche en
haut. Viennent ensuite les événements déjà passés, puis les demandes sans
date. La liste déroulante à droite permet de changer d'ordre à tout moment
(demandes les plus récentes, les plus anciennes, nom du client).

**Cadre photobooth.** Une demande validée qui comporte un photobooth
affiche un second menu, *Cadre photobooth* : **À créer** (valeur de départ)
ou **Réalisé**. Une petite pastille le rappelle dans la liste : violette
tant que le cadre reste à faire, **verte une fois réalisé**. Le filtre *Validées* fait alors apparaître une
ligne de sous-filtres pour retrouver d'un coup d'œil les cadres qu'il reste
à faire. Ce suivi n'apparaît que sur les photobooths, et seulement une fois
la demande validée.

Passer une demande en **Validée** crée la réservation correspondante dans le
planning, avec le nom, le téléphone, l'e-mail, la date et le lieu. Revenir
ensuite à un autre statut ne retire pas la réservation du planning : si vous
voulez l'annuler, supprimez-la depuis le planning. Le matériel demandé
est recopié dans les notes de la réservation, et non coché dans la liste des
produits : les intitulés choisis sur le site ne correspondent pas forcément
aux produits de votre outil de réservation, c'est donc à vous de les
sélectionner dans la fiche pour que le chiffre d'affaires soit juste.

Supprimer une demande est définitif. Si elle avait déjà été validée, la
réservation reste dans le planning.

### Départs & retours

Une location n'est pas un événement à une date : c'est un aller et un
retour. Cette page les sépare, jour par jour, sur les **sept prochains
jours** — elle sert à préparer le week-end qui arrive. Pour voir plus loin,
c'est le planning.

**Une carte par réservation**, rangée au jour de la prochaine action à
faire : l'aller et le retour d'un même client restent côte à côte plutôt
que dispersés à deux dates. Avec huit locations le même week-end, cela fait
huit cartes et non seize lignes.

Chaque carte indique le client, le matériel, et **comment il circule**.
L'aller et le retour se règlent séparément, dans leur propre menu :

| Départ | Retour |
|---|---|
| Je livre | Je vais rechercher |
| Le client vient chercher | Le client rapporte |

Les quatre combinaisons sont donc possibles : vous pouvez livrer un client
qui rapportera lui-même, ou remettre le matériel en main propre et aller le
récupérer. Les valeurs de départ viennent de la case « livraison » cochée à
la réservation ; vous les changez d'un menu, ligne par ligne.

Quand c'est vous qui vous déplacez, l'adresse s'affiche une seule fois par
carte et ouvre l'itinéraire ; si elle manque, la carte l'indique en rouge
(« adresse à demander »).

La **livraison** figure sur toutes les fiches, systématiquement, même quand
le client n'a rien coché — l'absence de réponse vaut retrait sur place, et
c'est justement ce qu'il faut savoir.

Un badge en haut de chaque carte dit l'essentiel : **Livraison** ou
**Sur place**. Un clic sur le nom du client ouvre sa **fiche de
réservation** — téléphone, e-mail et lieu cliquables, matériel, total
estimé, source et notes — avec un bouton pour aller la modifier dans le
planning. Les menus et les boutons d'étape restent utilisables sans ouvrir
la fiche.

Trois boutons suivent l'avancement : **Préparé**, **Remis** (livré ou
retiré par le client, selon le cas), **Rendu**. Un clic coche l'étape, un
second clic revient en arrière. L'état est enregistré sur le serveur : il
est le même sur tous vos appareils.

Les réservations rendues disparaissent de la liste ; la case en haut permet
de les réafficher. Les départs passent avant les retours d'une même
journée : on charge avant de décharger.

### Planning

Chaque réservation du calendrier est colorée selon la catégorie du matériel
loué (photobooth, sonorisation, lumière, barnum, restauration). Une
**légende** sous le calendrier rappelle quelle couleur correspond à quoi, en
ne listant que les catégories réellement présentes. Une réservation qui
mêle plusieurs catégories affiche plusieurs couleurs.

Un clic sur une réservation ouvre sa fiche. L'essentiel s'affiche d'abord —
dates, montant, téléphone, e-mail, lieu et matériel — et **Voir plus**
déplie le reste (source, acompte, livraison, validé par, notes). Le
téléphone, l'e-mail et l'adresse sont cliquables : appel direct, nouveau
message, ou itinéraire dans Google Maps. Les boutons **Modifier** et
**Supprimer** sont en bas de la fiche.

### Produits & tarifs, Chiffre d'affaires, Documents, Paramètres

Ce sont les pages de votre outil de gestion, affichées directement dans le
back-office : son bandeau et son menu d'origine sont masqués, puisque le
titre, la navigation et la déconnexion sont déjà ceux du back-office. Une
seule connexion suffit, celle du back-office.

**Les données sont enregistrées sur le serveur**, et non plus seulement dans
le navigateur : vous retrouvez le même planning depuis votre téléphone et
depuis votre ordinateur, et rien n'est perdu si vous videz les données de
votre navigateur. La pastille en bas à gauche indique l'état :
*Synchronisé* (tout est enregistré), *Sync…* (envoi en cours) ou
*Hors ligne* (la dernière modification n'est pas partie — vérifiez votre
connexion et refaites-la).

À la première ouverture, si des réservations existent déjà dans le
navigateur, elles sont envoyées au serveur plutôt qu'effacées.

Dans Netlify → **Forms**, deux formulaires techniques apparaissent après le
déploiement : `reservations-admin` (le planning et sa configuration) et
`suivi-demandes-admin` (le statut des demandes). Comme les autres, ils sont
gratuits et illimités.

---

## Crédits Netlify et rapidité

Le site n'interroge le serveur **qu'une seule fois par page**. Auparavant,
chaque affichage demandait séparément l'apparence, les textes, les notices,
les prix et les avis Google : jusqu'à cinq allers-retours. Tout arrive
désormais d'un coup, par `/api/site`.

Conséquences : quatre requêtes de moins par page vue (les requêtes sont
facturées par tranches de 10 000), quatre attentes de moins pour le
visiteur, et une fonction qui tourne d'autant moins. La réponse est mise en
cache par le CDN pendant une heure et vidée dès que vous modifiez quelque
chose : au-delà du premier visiteur, la fonction ne s'exécute même pas.

Les anciennes adresses (`/api/theme`, `/api/textes`…) restent en service :
une page encore en cache chez un visiteur continue de fonctionner.

Mesures actuelles : **299 Ko et 17 requêtes en moyenne par page**, la plus
lourde étant une fiche produit à 674 Ko. Les images sont en WebP, chargées
au défilement et mises en cache une semaine ; les pages HTML ne sont jamais
mises en cache, pour que vos modifications soient visibles aussitôt.

---

## Entretien automatique

Chaque modification ajoute un enregistrement plutôt que d'en remplacer un.
C'est ce qui rend le back-office simple et sans base de données, mais dix
modifications d'une même réservation laissent dix enregistrements alors
qu'un seul fait foi.

Le ménage se fait tout seul : à la consultation d'une page, les versions
dépassées sont supprimées, **jamais la version courante**. Le nettoyage ne
démarre qu'à partir de quarante versions périmées et s'arrête à soixante
suppressions par consultation, pour ne jamais ralentir l'affichage. Vous
n'avez rien à faire et vous ne verrez rien changer — sinon que le
back-office reste rapide dans le temps.

Dans Netlify → **Forms**, le nombre de soumissions cesse donc de grossir
indéfiniment.

---

## Sauvegarde

Le bouton **Tout exporter**, en haut à droite (dans le tiroir sur
téléphone), télécharge un fichier
`vespra-event-sauvegarde-AAAA-MM-JJ.json` contenant tout ce que le
back-office a enregistré : produits et prix, articles, avis, textes,
apparence, notices, planning et sa configuration, demandes, statuts et
suivi des départs et retours.

Ce fichier ne contient pas les pages du site elles-mêmes (HTML, images,
PDF) : celles-ci sont dans l'archive de déploiement Netlify. **Gardez les
deux** — l'archive du site et l'export des données — et vous pouvez tout
remonter. Le fichier le rappelle en clair dans son en-tête.

Un export par trimestre suffit ; il ne consomme aucun crédit de
déploiement.

---

## Sur téléphone et tablette

En dessous de 860 px de large, la barre de gauche se referme en tiroir. Une
barre compacte rappelle la page en cours avec un bouton menu ; le menu
complet s'ouvre par-dessus le contenu et se referme dès qu'une page est
choisie, en touchant à côté, ou avec la touche Échap. « Voir le site » et
« Déconnexion » s'y trouvent également, pour que le titre garde toute la
largeur de l'en-tête.

Au-dessus de 860 px, rien ne change : la barre de gauche reste affichée en
permanence.

---

## En cas de souci

- **"ADMIN_USER et/ou ADMIN_PASSWORD ne sont pas configurés"** → l'étape 1
  n'a pas été faite, ou le site n'a pas été redéployé après.
- **Identifiant ou mot de passe refusé** → vérifiez qu'il n'y a pas d'espace
  avant/après dans les variables Netlify (c'est la cause la plus fréquente,
  surtout en copiant-collant), et que les majuscules sont respectées.
- **Un produit/article ajouté n'apparaît pas sur le site** → Netlify →
  **Forms**, vérifiez que `produits-admin` et `blog-admin` apparaissent dans
  la liste (ils ne sont détectés qu'après un déploiement qui contient le
  fichier `merci.html` mis à jour).
- **Un prix modifié ne change pas sur le site** → videz le cache du
  navigateur (Ctrl+Maj+R). Si le prix est correct dans l'admin mais pas sur
  le site, vérifiez que `prix.js` et `prix-registre.js` sont bien déployés à
  la racine du site.
- **Le planning est vide sur un autre appareil** → vérifiez que la pastille
  en bas à gauche indique *Synchronisé* sur l'appareil où vous avez saisi
  les réservations. Si elle indique *Hors ligne*, la modification n'est pas
  partie sur le serveur.
- **Une demande du site n'apparaît pas dans Demandes** → Netlify → **Forms**,
  vérifiez que le formulaire `reservation` contient bien la soumission. Les
  demandes affichées ici sont exactement celles que Netlify a reçues.
- **Une réservation ou un produit ancien a disparu** → ce défaut est corrigé
  depuis la version de septembre 2026 : la lecture ne s'arrêtait qu'aux 200
  enregistrements les plus récents. Redéployez le site avec la dernière
  archive : rien n'avait été perdu, seulement caché.

## Reprise du planning tenu sous Excel

Les réservations de **2026, 2027 et 2028** du fichier `Planning location.xlsx`
sont livrées avec le site (`admin/reservations-historique.json` : 114
réservations, feuille *Tarifs* exclue).

**Il n'y a rien à faire** : la reprise se lance toute seule à la première
ouverture de **Réservation → Planning**, et n'a lieu qu'une fois. Elle
n'ajoute jamais deux fois la même ligne, ne touche pas aux réservations
saisies dans le back-office, et une réservation reprise puis supprimée à la
main ne revient pas. Si la reprise échoue (serveur injoignable), un bandeau
propose de réessayer.

Deux locations manquaient au catalogue du planning : le **vidéoprojecteur**
(ajouté à *Sonorisation*, avec les variantes « Seul » et « Avec écran »,
comme sur le site où il figure dans *Son et vidéo*) et le **livre d'or
audio** (nouvelle catégorie *Animation*). La **shampouineuse** est retirée :
les deux réservations qui ne portaient que ce matériel ne sont pas reprises,
d'où 114 réservations et non 116. Les photobooths sont répartis sur les
quatre appareils selon les dates, de façon à ce que les disponibilités
restent justes.

Les montants repris sont ceux du fichier : quand le total d'une ligne ne
correspond pas à la somme des tarifs du catalogue, c'est le total du fichier
qui fait foi.

## Une modification n'apparaît pas sur le site

Le back-office vérifie maintenant lui-même que ce qu'il enregistre est bien
publié, et le dit :

- **« Modifications enregistrées et publiées »** → c'est en ligne.
- **« Le site affichera la nouvelle valeur d'ici une heure »** → la variable
  `NETLIFY_ACCESS_TOKEN` n'est pas configurée dans Netlify. Tout est
  enregistré, mais le cache du CDN n'a pas pu être vidé. Ajoutez la variable
  pour un affichage immédiat.
- **« Enregistré, mais non publié sur le site »** → un champ n'a pas été
  accepté par le formulaire Netlify. C'est le cas quand `merci.html` déployé
  est plus ancien que le back-office : redéployez le site entier (et pas
  seulement le dossier `admin`).

Ce dernier point expliquait qu'une modification déclenche bien le mail de
notification Netlify sans rien changer sur le site : le champ manquant
invalidait la signature, et le site ignorait l'enregistrement. Les champs
`variantes` (produits), `url` (blog) et `ref` (textes) manquaient ; ils sont
désormais déclarés.

## La pastille en bas à gauche

Les boutons « Actualiser » ont disparu des pages. À leur place, deux petits
carrés discrets en bas à gauche de l'écran, les mêmes partout :

- la **LED** : verte quand le back-office parle au serveur, orange pendant un
  échange, rouge si le serveur est injoignable ;
- la **flèche** : recharge la page affichée (liste des réservations, départs
  et retours, produits, planning…).

## Le planning : déplacer et créer

- **Déplacer une réservation** : à la souris, attrapez la barre et déposez-la
  sur un autre jour. Au doigt (tablette, écran tactile), **maintenez** la
  barre une demi-seconde — l'appareil vibre — puis glissez et relâchez.
- **Créer une réservation** : glissez la souris sur les jours concernés, du
  premier au dernier ; le formulaire s'ouvre avec les dates déjà remplies.
  Au doigt, maintenez sur le premier jour puis glissez jusqu'au dernier.
- **Sur téléphone**, le planning est une liste par jour. Le bouton **+** en bas
  à droite ouvre le formulaire : c'est là qu'on saisit les demandes reçues par
  téléphone ou sur Le Bon Coin. Les dates se choisissent dans le formulaire.
  Il est long — produits, options, livraison, acompte, notes — alors il se
  remplit en faisant glisser le doigt, le titre restant en haut et les boutons
  Annuler / Créer en bas.

## Location et livraison : deux montants distincts

Le prix de la **location** (matériel et options) et celui de la **livraison /
installation** sont comptés séparément — c'est déjà le cas des réservations
reprises de l'Excel, où les deux colonnes existaient.

- Sur la fiche du planning, le montant total est suivi du détail :
  « Location 70 € + Livraison / installation 15 € ».
- Sur la fiche du back-office, la livraison a sa propre ligne sous le
  matériel, avant le total.
- Dans le formulaire, un seul champ **Livraison / installation (€)**, où l'on
  tape le montant ; le symbole € s'affiche au bout.
- Sur la page **Chiffre d'affaires**, le total affiché comprend tout — c'est
  ce que l'entreprise a encaissé — avec le détail en dessous : « dont locations
  … · livraisons … ». La case **Livraisons à part** sépare les deux en deux
  cartes distinctes. Dans les deux cas, le **panier moyen se calcule sur les
  seules locations** : c'est ce qu'une réservation rapporte vraiment.
  Le carburant se saisit dans l'onglet **Charges**, et le résultat net en tient
  compte.

Sur le site, la livraison reste annoncée **sur devis** : aucun prix n'est
affiché aux visiteurs.

## Ne plus recevoir un mail à chaque modification

Chaque enregistrement du back-office passe par un formulaire Netlify, et
Netlify envoie un mail à chaque envoi. Cela se règle chez Netlify, pas dans le
site :

**Project configuration → Notifications → Emails and webhooks → Form
submission notifications**

Supprimez la notification qui porte sur « any form » (tous les formulaires), et
créez-en une seule, limitée au formulaire **`reservation`** : vous continuez à
recevoir les demandes des clients, mais plus rien pour `produits-admin`,
`reservations-admin`, `textes-admin`, `suivi-demandes-admin`, etc.

Cela ne change rien à l'enregistrement : les données sont stockées de la même
façon, qu'il y ait un mail ou non.

## Les formulaires Netlify : à quoi sert chacun

Aucun n'est à supprimer — supprimer un formulaire efface les données qu'il
contient.

| Formulaire | Contenu |
|---|---|
| `reservation` | les demandes envoyées depuis la page Réservation du site |
| `devis` | le formulaire de contact en bas de la page d'accueil |
| `newsletter` | les inscriptions depuis le blog |
| `avis-produit` | les avis déposés par les clients, en attente de validation |
| `avis-valides` | les avis publiés sur le site |
| `produits-admin` | prix, images et descriptions modifiés depuis le back-office |
| `reservations-admin` | **le planning** (toutes les réservations) |
| `suivi-demandes-admin` | statut des demandes et corrections saisies |
| `logistique-admin` | départs & retours |
| `textes-admin`, `theme-admin`, `notices-admin`, `blog-admin`, `google-admin`, `fichiers-admin` | textes réécrits, apparence, notices, articles masqués, avis Google, fichiers |

### « No submissions yet » alors qu'il y a eu un envoi

C'est le filtre anti-spam de Netlify : l'enregistrement est arrivé, mais il a
été classé en **Spam** au lieu de **Verified**. Il n'apparaît plus dans la
liste, et le site continuait d'afficher l'ancienne valeur. Le menu au-dessus
de la liste des envois permet de basculer sur *Spam* pour le vérifier.

Depuis cette version, le site lit aussi la corbeille à spam. C'est sans risque :
seuls les enregistrements portant une signature valide sont publiés, et cette
signature ne peut pas être fabriquée sans `ADMIN_SECRET`.


## Publication automatique avec Netlify Blobs

Après la migration initiale, le back-office n'effectue plus de migration lors d'un enregistrement. Chaque clic sur **Enregistrer** écrit directement la donnée dans Netlify Blobs. La fonction purge ensuite le cache tagué `vespra-contenu` afin que la modification soit visible immédiatement lorsque `NETLIFY_ACCESS_TOKEN` est configuré.

Les trois formulaires publics `devis`, `reservation` et `newsletter` restent dans Netlify Forms : ils servent uniquement à recevoir les demandes des visiteurs.


## Les montants repris du fichier Excel

Les réservations reprises reproduisent **exactement** les montants du fichier,
ligne par ligne : le total d'une ligne est celui de la colonne « Prix », et la
livraison reste à part (colonne « Prix livraison »). Aucun tarif du catalogue
n'est appliqué par-dessus.

Totaux du fichier repris (119 réservations) :

| Année | Réservations | Location | Livraison |
|---|---|---|---|
| 2026 | 107 | 16 648 € | 926 € |
| 2027 | 11 | 2 980 € | 175 € |
| 2028 | 1 | 190 € | 0 € |

Sur la page Chiffre d'affaires, la carte « Chiffre d'affaires » additionne les
deux colonnes : pour 2026, 17 574 € dont 926 € de livraison, soit bien
**16 648 € de location**.

### Reprendre le fichier après une mise à jour

Quand des lignes sont ajoutées ou des montants corrigés dans l'Excel, le bouton
**Mettre à jour depuis l'Excel**, en haut de la page Planning, reprend le
fichier : il ajoute les lignes nouvelles et réaligne les réservations déjà
reprises (dates, matériel, montants, livraison). Les réservations saisies à la
main dans le planning ne portent pas l'identifiant du fichier : elles ne sont
jamais touchées.

Les prix du planning restent ceux du planning : ils ne sont jamais réécrits
depuis le catalogue du site.
