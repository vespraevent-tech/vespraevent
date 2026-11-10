# Passer Vespra Event sur Supabase

Rien ne change tant que la variable `STOCKAGE` n'existe pas : le site continue sur Netlify Blobs.
On copie d'abord, on vérifie, et on ne bascule qu'à la fin. Retour en arrière possible à chaque étape.

## 1. Créer le projet (toi)
1. supabase.com > New project. Nom : `vespra-event`. Région : **West EU (Paris)** si proposée, sinon Frankfurt.
2. Note le mot de passe de la base dans ton gestionnaire (on n'en a pas besoin ici).
3. Attends que le projet soit prêt.

## 2. Créer la table
1. Menu **SQL Editor > New query**.
2. Colle tout le contenu de `supabase/schema.sql` > **Run**. Message « Success ».
3. Contrôle : **Table Editor** doit montrer une table `kv` avec un cadenas (sécurité RLS active).

## 3. Récupérer 2 valeurs
- **Project Settings > API** : copie « Project URL » (https://xxxx.supabase.co).
- Même page : la clé secrète `service_role` (ou « Secret key » `sb_secret_…`). **Jamais la clé publique `anon`.** Cette clé ne doit apparaître nulle part ailleurs que dans Netlify.

## 4. Variables Netlify
Netlify > Site configuration > Environment variables, ajouter :
- `SUPABASE_URL` = l'URL du projet
- `SUPABASE_SERVICE_ROLE_KEY` = la clé secrète
- `MIGRATION_KEY` = une phrase longue inventée (12 caractères minimum)

⚠ Ne pas encore ajouter `STOCKAGE`.
Si le déploiement bloque pour « secrets détectés », ajouter les 2 premiers noms dans `SECRETS_SCAN_OMIT_KEYS` (séparés par une virgule : `ADMIN_USER,SUPABASE_URL`) — la clé secrète, elle, ne doit jamais être écrite dans un fichier.

## 5. Déployer ce zip
Importer le zip complet dans Netlify comme d'habitude. Le site reste sur Blobs.

## 6. Copier les données
1. Ouvrir `https://vespraevent.com/migration-supabase.html`, saisir la `MIGRATION_KEY`.
2. **Copier les données** : la barre défile store par store. Sans danger, on peut relancer : ce qui est déjà copié n'est pas écrasé.
3. **Vérifier les comptes** : chaque ligne doit afficher `OK` (même nombre côté Netlify et Supabase).

## 7. Basculer
Ajouter la variable `STOCKAGE` = `supabase`, puis **Deploys > Trigger deploy > Clear cache and deploy**.
Tester dans le back-office : ouvrir une réservation, en créer une, envoyer/afficher un document, voir une photo.

## Retour en arrière
Supprimer `STOCKAGE` (ou la mettre à `blobs`) et redéployer : le site relit Netlify Blobs.
⚠ Tout ce qui a été saisi *après* la bascule est dans Supabase seulement. Pour le récupérer avant de revenir en arrière, le plus sûr est de me le dire : on le recopie dans l'autre sens.

## Après la bascule
- Garde Netlify Blobs intact quelques semaines, comme filet de sécurité.
- Les sauvegardes quotidiennes automatiques continuent de fonctionner (elles sont rangées dans Supabase aussi).
- Plan gratuit Supabase : 500 Mo de base et mise en pause après 7 jours sans activité — avec le back-office utilisé tous les jours c'est sans risque, mais les photos/PDF pèsent vite : surveiller **Settings > Usage**. Les sauvegardes automatiques Supabase sont réservées au plan Pro.
