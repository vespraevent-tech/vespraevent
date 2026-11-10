# Activer les e-mails de notification Vespra Event

Le code est prêt et déployé avec le site. Il reste **une seule chose à faire** :
déclarer trois variables dans Netlify. Comptez cinq minutes.

---

## 1. Les variables à créer dans Netlify

Tableau de bord Netlify → votre site →
**Site configuration** → **Environment variables** → **Add a variable**

| Nom | Valeur | Obligatoire |
|---|---|---|
| `RESEND_API_KEY` | votre clé Resend (commence par `re_`) | oui |
| `NOTIFY_TO` | `vespraevent@gmail.com` | oui |
| `NOTIFY_FROM` | `Vespra Event <devis@vespraevent.fr>` | seulement après l'étape 3 |

Choisissez la portée **All scopes** / **All deploy contexts**.

⚠️ **Point important sur `NOTIFY_TO`.** Tant que votre domaine n'est pas
validé dans Resend (étape 3), les e-mails partent de `onboarding@resend.dev`,
et Resend n'autorise l'envoi **que vers l'adresse propriétaire du compte**.
Mettez donc l'adresse de votre compte Resend, pas `vespraevent@gmail.com`.
Sinon Resend refusera l'envoi et vous ne recevrez rien.

---

## 2. Redéployer

Les variables ne sont lues qu'au déploiement.
**Deploys** → **Trigger deploy** → **Deploy site**.

---

## 3. Déclarer votre domaine (optionnel mais recommandé)

Cette étape permet d'écrire depuis `devis@vespraevent.fr`, de lever la
restriction du destinataire unique, et d'éviter le dossier « indésirables ».

1. Resend → **Domains** → **Add Domain** → `vespraevent.fr`
2. Resend affiche trois enregistrements DNS (DKIM, SPF, et un enregistrement
   de suivi). Ajoutez-les chez votre registrar.
3. Attendez la validation, puis ajoutez la variable `NOTIFY_FROM`
   et redéployez.

---

## 4. Vérifier

Envoyez une demande depuis la page réservation du site, puis :

- **L'e-mail arrive** → terminé.
- **Rien** → Netlify → **Logs** → **Functions** → `vespra-notification`.
  - `RESEND_API_KEY absente` : la variable n'a pas été lue, redéployez.
  - `Resend a refusé l'envoi : 403` : destinataire non autorisé,
    voir l'avertissement de l'étape 1.
  - Aucune ligne du tout : le formulaire n'est pas détecté par Netlify Forms.
    Vérifiez **Forms** dans le tableau de bord.

L'e-mail standard de Netlify continue d'arriver en parallèle. Une fois le
nouveau validé, coupez l'ancien dans **Forms → Settings → Form notifications**.

---

## Les cinq e-mails

| Formulaire | Pastille | Objet |
|---|---|---|
| Devis (page d'accueil, fiches produit) | Demande de devis | 📋 |
| Réservation — devis | Demande de devis | 📋 |
| Réservation — disponibilité | Disponibilité | 📅 |
| Avis produit | Avis client | ⭐ |
| Newsletter | Newsletter | — |

Chacun affiche le nom du client, ses coordonnées cliquables, les détails de
l'événement avec les dates en français, le panier avec son total quand il y
en a un, le message, et un bouton **Répondre au client**.

---

## Sécurité de la clé

La clé API Resend donne le droit d'envoyer des e-mails en votre nom.
Elle ne doit exister qu'à deux endroits : votre compte Resend et les
variables Netlify. Ne la mettez jamais dans un fichier du site, dans un
e-mail ou dans une capture d'écran. Si elle a été exposée, révoquez-la dans
Resend (**API Keys** → la clé → **Delete**) et créez-en une nouvelle : cela
prend dix secondes et n'a aucun effet de bord.

---

## Coût

- **Resend** : gratuit jusqu'à 3 000 e-mails par mois, 100 par jour.
- **Netlify** : la fonction s'exécute en moins d'une seconde,
  l'impact sur vos 300 crédits mensuels est négligeable.

---

## Modifier le design

Tout tient dans `netlify/functions/vespra-notification.mjs` :
les couleurs ligne 12, les intitulés dans `KINDS`, les noms de champs dans
`LABELS`, la mise en page dans `buildHtml`.
