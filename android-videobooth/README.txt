Vespra Vidéobooth — application Android (WebView plein écran)

Ouvre https://www.vespraevent.fr/videobooth/ en plein écran, avec caméra et micro autorisés.
Le site se met à jour tout seul : l'application, elle, ne change presque jamais.

Démarrage automatique : à la première ouverture, choisir « Vespra Vidéobooth » puis « Toujours » (application d’accueil). Sortie : 5 appuis rapides en haut à gauche, puis le code.

Compiler (Android SDK + JDK 17 ou plus) :
  export ANDROID_HOME=/chemin/du/sdk
  gradle assembleRelease            (fichier : app/build/outputs/apk/release/)
Signature : variables VB_KEYSTORE, VB_KEYSTORE_PASS, VB_KEY_ALIAS (la clé n'est jamais dans le dépôt).
