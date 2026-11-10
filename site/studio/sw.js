/* Service worker minimal : permet l'installation du back-office comme
   application. Il ne met rien en cache — les données (planning, factures)
   doivent toujours venir du serveur, jamais d'une copie périmée. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () { /* le navigateur gère la requête normalement */ });
