/* ─────────────────────────────────────────────────────────────
   Pont entre la page Réservation et le back-office.

   La page de gestion des réservations a été conçue pour fonctionner
   seule : elle enregistre tout dans le navigateur et possède sa propre
   connexion. Intégrée au back-office, deux choses changent :

   1. Les réservations et leur configuration sont enregistrées sur le
      serveur Netlify, comme le reste du back-office. Le planning est
      donc le même depuis le téléphone et depuis l'ordinateur, et il
      survit à un vidage du navigateur.

   2. La connexion du back-office suffit : la page ne redemande pas
      d'identifiants quand elle est ouverte à l'intérieur.

   Le code de la page n'est pas modifié : ce fichier remplace seulement
   les quatre fonctions de synchronisation qu'elle prévoyait déjà pour
   Firebase, et les redirige vers l'API du back-office.

   Ouverte seule (hors du back-office), la page retrouve son
   fonctionnement d'origine.
   ───────────────────────────────────────────────────────────── */
(function () {
  var DANS_LE_BO = window.parent !== window;

  /* Ouverte directement, hors du back-office, cette page présenterait son
     ancien écran de connexion — trompeur, puisque les données sont
     protégées par celle du back-office et qu'elle n'afficherait rien.
     On renvoie donc simplement vers le back-office. */
  if (!DANS_LE_BO) {
    location.replace('/studio/');
    return;
  }

  /* Page demandée par le back-office. Le voile est posé tout de suite,
     avant que la page ne dessine quoi que ce soit : sinon le planning
     apparaît une fraction de seconde avant le chiffre d'affaires. */
  var demandee = new URLSearchParams(location.search).get('page');
  if (demandee && typeof window.page !== 'undefined') window.page = demandee;
  var voile = null;
  if (demandee && document.head) {
    voile = document.createElement('style');
    voile.textContent = 'main{visibility:hidden}';
    document.head.appendChild(voile);
    setTimeout(function () { devoiler(); }, 5000);
  }
  function devoiler() {
    if (voile && voile.parentNode) voile.parentNode.removeChild(voile);
    voile = null;
  }

  function api(chemin, options) {
    return fetch('/api/admin' + chemin, Object.assign({
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
    }, options || {})).then(function (r) {
      if (r.status === 401) { throw new Error('session'); }
      /* une erreur du serveur n'est plus prise pour un enregistrement réussi */
      if (!r.ok) { throw new Error('serveur ' + r.status); }
      return r.json();
    });
  }

  /* ── enregistrement d'une réservation ───────────────────── */
  /* Fusion champ par champ : on part de la version du serveur et on n'y reporte que
     ce qui a changé ici depuis la dernière version connue (base). Une copie ancienne
     n'efface donc jamais la modification faite entre-temps sur un autre appareil. */
  function fusionResa(base, loc, srv) {
    var res = JSON.parse(JSON.stringify(srv)), k;
    for (k in loc) if (JSON.stringify(loc[k]) !== JSON.stringify(base[k])) res[k] = loc[k];
    for (k in base) if (!(k in loc)) delete res[k];
    return res;
  }
  function poster(r) {
    return api('/data', {
      method: 'POST',
      body: JSON.stringify({ collection: 'reservations', item: { id: String(r.id), d: JSON.stringify(r) } }),
    });
  }
  function enregistrer(r) {
    if (!r || !r.id) return Promise.resolve();
    var id = String(r.id), base = connuR[id];
    if (!base) return poster(r).then(function () { return { brut: JSON.stringify(r) }; });
    return api('/data?collection=reservations').then(function (items) {
      var ligne = null;
      (items || []).forEach(function (it) { if (it && String(it.id) === id && it.d) ligne = it; });
      var envoye = r;
      if (ligne) {
        var srv, b;
        try { srv = JSON.parse(ligne.d); b = JSON.parse(base); } catch (e) { srv = null; }
        if (srv && JSON.stringify(srv) !== JSON.stringify(b)) envoye = fusionResa(b, r, srv);
      }
      return poster(envoye).then(function () {
        var brut = JSON.stringify(envoye);
        if (envoye !== r) {
          /* la copie d'ici reprend ce qui a été fusionné */
          try {
            var liste = JSON.parse(localStorage.getItem('vespraR') || '[]');
            for (var i = 0; i < liste.length; i++) if (liste[i] && String(liste[i].id) === id) liste[i] = envoye;
            connuR[id] = brut;
            if (Array.isArray(window.R)) for (var j = 0; j < window.R.length; j++) if (window.R[j] && String(window.R[j].id) === id) window.R[j] = envoye;
            localStorage.setItem('vespraR', JSON.stringify(liste));
          } catch (e) {}
        }
        return { brut: brut };
      });
    });
  }

  function supprimer(id) {
    return api('/data?collection=reservations&id=' + encodeURIComponent(id), { method: 'DELETE' });
  }

  /* ── configuration (produits, tarifs, clients, achats, couleurs…) ──
     Elle est enregistrée en un seul bloc, comme le faisait déjà la page
     pour Firebase : c'est le même contenu, au même endroit. */
  var CLES = {
    prods: 'vespraProds', cats: 'vespraCats', src: 'vespraSrc', frais: 'vespraFrais',
    fraisCats: 'vespraFraisCats', colors: 'vespraColors', clients: 'vespraClients',
    purchases: 'vespraPurchases', equipGroups: 'vespraEquipGroups',
    factAchat: 'vespraFactAchat', tvaDecl: 'vespraTvaDecl', mandats: 'vespraMandats',
  };

  function configLocale() {
    var cfg = {};
    for (var k in CLES) {
      try { cfg[k] = JSON.parse(localStorage.getItem(CLES[k]) || 'null'); } catch (e) { cfg[k] = null; }
    }
    return cfg;
  }

  /* ── fusion à trois voies (état connu / local / serveur) ────────
     Deux appareils qui modifient la configuration en même temps ne
     s'écrasent plus : chaque ajout, modification ou suppression est
     conservé. */
  function egal(x, y) { return JSON.stringify(x) === JSON.stringify(y); }
  function clef(x) {
    if (x && typeof x === 'object') {
      if (x.id !== undefined && x.id !== null) return 'i:' + x.id;
      if (x.name !== undefined && x.name !== null) return 'n:' + x.name;
    }
    return 'j:' + JSON.stringify(x);
  }
  function objet(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  function fus(base, loc, srv) {
    if (srv === undefined || srv === null) return loc;
    if (loc === undefined || loc === null) return srv;
    if (egal(loc, base)) return srv;
    if (egal(srv, base)) return loc;
    if (egal(loc, srv)) return loc;
    if (Array.isArray(loc) && Array.isArray(srv)) {
      var bs = Array.isArray(base) ? base : [];
      var bm = {}, sm = {}, lm = {}, sortie = [];
      bs.forEach(function (x) { bm[clef(x)] = x; });
      srv.forEach(function (x) { sm[clef(x)] = x; });
      loc.forEach(function (x) { lm[clef(x)] = x; });
      loc.forEach(function (x) {
        var k = clef(x);
        if (k in sm) sortie.push(fus(bm[k], x, sm[k]));
        else if (k in bm) { if (!egal(x, bm[k])) sortie.push(x); }
        else sortie.push(x);
      });
      srv.forEach(function (x) {
        var k = clef(x);
        if (k in lm) return;
        if (k in bm) { if (!egal(x, bm[k])) sortie.push(x); }
        else sortie.push(x);
      });
      return sortie;
    }
    if (objet(loc) && objet(srv)) {
      var bo = objet(base) ? base : {}, res = {}, k2;
      for (k2 in loc) res[k2] = fus(bo[k2], loc[k2], srv[k2]);
      for (k2 in srv) if (!(k2 in res)) res[k2] = srv[k2];
      return res;
    }
    return loc;
  }

  var CLE_BASE = 'vespraCfgBase';
  function lireBase() { try { return JSON.parse(localStorage.getItem(CLE_BASE) || 'null'); } catch (e) { return null; } }
  function ecrireBase(c) { try { localStorage.setItem(CLE_BASE, JSON.stringify(c)); } catch (e) {} }
  var appliquant = false;

  function appliquerConfig(cfg) {
    appliquant = true;
    try { if (typeof window.applyConfig === 'function') window.applyConfig(cfg); }
    finally { appliquant = false; }
  }

  /* lit le serveur, fusionne avec les réglages locaux, applique, et
     renvoie la configuration fusionnée + si elle diffère du serveur */
  function fusionnerConfig(cfgServeur) {
    var loc = configLocale();
    if (!cfgServeur) return { cfg: loc, aEnvoyer: true, modifLocale: false };
    var base = lireBase();
    if (!base) { base = {}; }   /* première fois : on réunit les deux, sans rien retirer */
    var fusion = fus(base, loc, cfgServeur);
    var modifLocale = !egal(fusion, loc);
    if (modifLocale) appliquerConfig(fusion);
    return { cfg: fusion, aEnvoyer: !egal(fusion, cfgServeur), modifLocale: modifLocale };
  }

  function srvAvantEnvoi(srv) { return srv || {}; }
  /* relit la configuration : si elle n'est pas celle qu'on vient d'envoyer,
     quelqu'un d'autre a écrit au même moment — on refusionne et on renvoie */
  function verifierConfig(envoyee) {
    api('/data?collection=reservations').then(function (items) {
      var srv = null;
      (items || []).forEach(function (it) { if (it && it.id === 'cfg' && it.d) { try { srv = JSON.parse(it.d); } catch (e) {} } });
      if (srv && egal(srv, envoyee)) ecrireBase(envoyee);
      else if (srv) envoyerConfig();
    }).catch(function () {});
  }

  var enAttente = null;
  var cfgEnCours = false, cfgRepasse = false;
  function envoyerConfig() {
    if (cfgEnCours) { cfgRepasse = true; return Promise.resolve(); }
    cfgEnCours = true;
    return api('/data?collection=reservations').then(function (items) {
      if (!Array.isArray(items)) throw new Error('lecture');
      var srv = null;
      items.forEach(function (it) { if (it && it.id === 'cfg' && it.d) { try { srv = JSON.parse(it.d); } catch (e) {} } });
      var r = fusionnerConfig(srv);
      if (!r.aEnvoyer) { ecrireBase(r.cfg); return r; }
      return api('/data', {
        method: 'POST',
        body: JSON.stringify({ collection: 'reservations', item: { id: 'cfg', d: JSON.stringify(r.cfg) } }),
      }).then(function (rep) {
        if (rep && rep.ok === false) throw new Error('refus');
        /* base provisoire : l'état d'avant, tant qu'on n'a pas vérifié que
           personne n'a écrit en même temps que nous */
        ecrireBase(srvAvantEnvoi(srv));
        setTimeout(function () { verifierConfig(r.cfg); }, 2000);
        return r;
      });
    }).then(function (r) {
      badge('ok');
      if (r && r.modifLocale && typeof window.nav === 'function' && !modalOuverte()) window.nav();
    }).catch(function () { badge('err'); setTimeout(enregistrerConfig, 5000); })
      .then(function () { cfgEnCours = false; if (cfgRepasse) { cfgRepasse = false; enregistrerConfig(); } });
  }
  function enregistrerConfig() {
    /* plusieurs réglages changent souvent d'affilée : on n'envoie
       qu'une fois, une seconde après le dernier changement */
    clearTimeout(enAttente);
    enAttente = setTimeout(function () { enAttente = null; envoyerConfig(); }, 1000);
  }
  /* Ce que le back-office consulte avant de laisser fermer la page : tout
     changement qui n'est pas encore confirmé par le serveur (réglage dans
     sa seconde d'attente, envoi en cours, réservation en route). */
  var resEnRoute = 0;
  window.VESPRA_SAUVEGARDE = {
    enAttente: function () { return !!enAttente || cfgEnCours || cfgRepasse || resEnRoute > 0; },
    vider: function () {
      if (enAttente) { clearTimeout(enAttente); enAttente = null; envoyerConfig(); }
    },
  };
  window.addEventListener('message', function (e) {
    if (e.origin === location.origin && e.data && e.data.type === 'vespra-vider') window.VESPRA_SAUVEGARDE.vider();
  });
  window.addEventListener('pagehide', function () { window.VESPRA_SAUVEGARDE.vider(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) window.VESPRA_SAUVEGARDE.vider(); });
  /* tout envoi direct du planning vers /api/ (infos entreprise, justificatifs…) allume aussi le témoin */
  (function () {
    var brut = window.fetch.bind(window), n = 0;
    window.fetch = function (url, opts) {
      var m = ((opts && opts.method) || 'GET').toUpperCase(), u = typeof url === 'string' ? url : (url && url.url) || '';
      if (m === 'GET' || !/\/api\//.test(u)) return brut(url, opts);
      n++; resEnRoute++; try { window.parent.postMessage({ type: 'vespra-sync', etat: 'sync' }, location.origin); } catch (e) {}
      var fin = function (ok) { n--; resEnRoute = Math.max(0, resEnRoute - 1); if (!n) { try { window.parent.postMessage({ type: 'vespra-sync', etat: ok ? 'ok' : 'err' }, location.origin); } catch (e) {} } };
      return brut(url, opts).then(function (r) { fin(r.ok); return r; }, function (e) { fin(false); throw e; });
    };
  })();
  function modalOuverte() { return !!document.querySelector('.modalbg.open'); }

  function badge(etat) {
    if (typeof window.updateSyncBadge === 'function') window.updateSyncBadge(etat);
    /* le back-office affiche cet état sur sa LED, en bas à gauche */
    if (window.parent !== window) {
      try { window.parent.postMessage({ type: 'vespra-sync', etat: etat }, location.origin); } catch (e) {}
    }
  }

  /* ── remplacement des fonctions de synchronisation ───────── */
  function brancher() {
    /* une adresse non vide suffit à réactiver les appels de synchronisation
       déjà écrits dans la page ; ils passent maintenant par les fonctions
       ci-dessous, et plus par Firebase */
    window.FIREBASE_URL = '/api/admin';

    window.fbPutRes = function (r) {
      badge('sync');
      resEnRoute++;
      enregistrer(r).then(function () { resEnRoute--; badge('ok'); }).catch(function () { resEnRoute--; badge('err'); });
    };
    window.fbDeleteRes = function (id) { supprimer(id).catch(function () { badge('err'); }); };
    window.fbPutCfg = function () { badge('sync'); enregistrerConfig(); };
    /* La page appelait « fbWrite » pour enregistrer ses réglages — le
       catalogue, les couleurs, les clients, les charges… — mais cette
       fonction appartenait à Firebase et n'existait plus : modifier une
       réservation affichait « fbWrite is not defined » et s'arrêtait là.
       Tous ces réglages voyagent ensemble dans la configuration, il
       suffit donc de la ré-enregistrer. */
    window.fbWrite = function () { badge('sync'); enregistrerConfig(); };
    window.pushToFirebase = function (cb) { window.fbPutCfg(); if (cb) cb(true); };
    /* la page vérifiait la présence d'une base Firebase : inutile ici */
    window.startSSE = function () {};
    window.stopSSE = function () {};

    /* Les appels passés avant que ce fichier soit chargé ont été mis de
       côté par les garde-fous en tête de page : on les rejoue. */
    var enAttente = window.VESPRA_SYNC_EN_ATTENTE;
    if (Array.isArray(enAttente) && enAttente.length) {
      var aRejouer = enAttente.splice(0, enAttente.length);
      aRejouer.forEach(function (appel) {
        try {
          if (typeof window[appel.nom] === 'function' && !window[appel.nom].provisoire) {
            window[appel.nom].apply(null, appel.args);
          }
        } catch (e) { console.error('Synchronisation différée :', appel.nom, e.message); }
      });
    }
  }

  /* ── tout changement enregistré dans le navigateur part au serveur ──
     La page enregistre ses données dans le navigateur, et ne prévoyait
     de les envoyer ailleurs qu'au moment d'un « envoi » manuel. On
     surveille donc ses écritures : dès qu'une réservation ou un réglage
     change, la modification part au serveur toute seule. */
  /* ce que le serveur a confirmé, réservation par réservation : conservé
     dans le navigateur pour retrouver, après une coupure ou un
     rechargement, ce qui n'est pas encore parti */
  var CLE_CONNU = 'vespraConnu';
  var connuR = {};
  var connuExiste = false;
  try {
    var _c = localStorage.getItem(CLE_CONNU);
    if (_c) { connuR = JSON.parse(_c) || {}; connuExiste = true; }
  } catch (e) { connuR = {}; }
  var attenteConnu = null;
  function sauverConnu() {
    clearTimeout(attenteConnu);
    attenteConnu = setTimeout(function () {
      try { localStorage.setItem(CLE_CONNU, JSON.stringify(connuR)); } catch (e) {}
    }, 300);
  }
  var charge = false;   /* le premier échange avec le serveur est fait */

  /* File d'attente des enregistrements.

     Une réservation n'est considérée comme enregistrée qu'une fois le
     serveur l'a confirmée : auparavant, elle était marquée comme envoyée
     avant même la réponse, si bien qu'un envoi refusé (serveur occupé,
     coupure de réseau) n'était jamais retenté — la réservation restait
     dans le navigateur mais manquait sur le serveur, et le chiffre
     d'affaires s'en trouvait amputé.

     Les envois partent aussi quatre par quatre plutôt que tous à la fois :
     la reprise du planning Excel en envoyait plus de cent d'un coup. */
  var file = [];
  var enCours = 0;
  var MAX = 4;
  var aRetenter = false;

  function defiler() {
    while (enCours < MAX && file.length) {
      var tache = file.shift();
      enCours++;
      (function (t) {
        var action = t.suppression ? supprimer(t.id) : enregistrer(t.r);
        action.then(function (res) {
          if (!t.suppression) connuR[t.id] = (res && res.brut) || t.brut;
          else delete connuR[t.id];
          sauverConnu();
          /* le back-office relit sa liste tout de suite */
          try { window.parent.postMessage({ type: 'vespra-resas-changees' }, location.origin); } catch (e) {}
        }).catch(function () {
          badge('err');
          /* on laisse la réservation « non enregistrée » : le prochain
             passage la représentera au serveur */
          aRetenter = true;
        }).then(function () {
          enCours--;
          if (file.length) defiler();
          else if (!enCours) {
            if (aRetenter) { aRetenter = false; setTimeout(pousserReservations, 4000); }
            else badge('ok');
          }
        });
      })(tache);
    }
  }

  function pousserReservations() {
    /* tant que le serveur n'a pas été lu, on ne sait pas ce qui est
       nouveau : envoyer maintenant risquerait d'écraser des données
       plus récentes par celles, périmées, de ce navigateur */
    var liste = [];
    try { liste = JSON.parse(localStorage.getItem('vespraR') || '[]'); } catch (e) { return; }
    var vus = {};
    var enFile = {};
    file.forEach(function (t) { enFile[t.id] = true; });

    liste.forEach(function (r) {
      if (!r || !r.id) return;
      var brut = JSON.stringify(r);
      vus[r.id] = true;
      if (connuR[r.id] === brut || enFile[r.id]) return;
      /* serveur pas encore lu : on n'envoie que les réservations toutes neuves
         (identifiant r + horodatage récent), jamais d'anciennes qui pourraient
         écraser une version plus récente du serveur */
      if (!charge) {
        var ts = /^r(\d{12,})$/.exec(String(r.id));
        if (!ts || Date.now() - Number(ts[1]) > 3 * 86400000 || connuR[r.id] !== undefined) return;
      }
      file.push({ id: r.id, r: r, brut: brut });
    });
    if (!charge) { if (file.length) { badge('sync'); defiler(); } return; }
    /* une réservation qui a disparu de la liste a été supprimée */
    var aSupprimer = Object.keys(connuR).filter(function (id) { return !vus[id] && !enFile[id]; });
    /* garde-fou : une liste soudain vide ou presque (navigateur vidé,
       données corrompues) ne doit jamais effacer le serveur */
    var total = Object.keys(connuR).length;
    if (aSupprimer.length > 3 && aSupprimer.length > total * 0.3) {
      badge('err');
      synchroniser();   /* on reprend le serveur au lieu d'y supprimer */
      return;
    }
    aSupprimer.forEach(function (id) { file.push({ id: id, suppression: true }); });

    if (file.length) { badge('sync'); defiler(); }
  }

  var attenteR = null;
  function surveiller() {
    var brut = Storage.prototype.setItem;
    var clesCfg = Object.keys(CLES).map(function (k) { return CLES[k]; });
    Storage.prototype.setItem = function (cle, valeur) {
      brut.call(this, cle, valeur);
      if (this !== window.localStorage) return;
      if (cle === 'vespraR') {
        clearTimeout(attenteR);
        attenteR = setTimeout(function () { attenteR = null; pousserReservations(); }, 400);
      } else if (clesCfg.indexOf(cle) !== -1 && !appliquant) {
        enregistrerConfig();
      }
    };
  }

  /* ── lecture du serveur et fusion, sans rien perdre ──────────
     Pour chaque réservation :
       - modifiée ici et pas encore envoyée → on garde la version d'ici
         (elle partira au serveur) ;
       - sinon → on prend la version du serveur ;
       - disparue du serveur alors qu'elle y était → supprimée ailleurs ;
       - nouvelle sur le serveur → ajoutée ailleurs ;
       - nouvelle ici, jamais envoyée → on la garde et on l'envoie. */
  function lireLocal() {
    try { return JSON.parse(localStorage.getItem('vespraR') || '[]') || []; } catch (e) { return null; }
  }
  function modalOuverte() { return !!document.querySelector('.modalbg.open'); }

  var synchro = false;
  var supprimees = {};
  var manque = {}, empreinte = null, empreinteEnAttente = null, derniereLecture = 0;
  var relancer = false;
  function synchroniser() {
    if (synchro) { relancer = true; return Promise.resolve(); }
    synchro = true;
    /* lecture légère : le serveur renvoie une empreinte de la liste ; si elle
       n'a pas changé, il n'y a rien à relire (au lieu de relire toutes les
       réservations toutes les 8 secondes) */
    var rapide = api('/data?collection=reservations&empreinte=1').then(function (e) { return e && e.h ? e : null; }).catch(function () { return null; });
    return rapide.then(function (e) {
      /* réservations supprimées ailleurs : le serveur les signale, on les retire tout de suite */
      supprimees = {};
      var aRetirerTout = false;
      if (e && Array.isArray(e.sup) && e.sup.length) {
        var loc0 = lireLocal() || [];
        e.sup.forEach(function (id) {
          supprimees[String(id)] = true;
          if (loc0.some(function (r) { return r && String(r.id) === String(id); })) aRetirerTout = true;
        });
      }
      if (!aRetirerTout && e && empreinte && e.h === empreinte && charge && !Object.keys(manque).length && Date.now() - derniereLecture < 120000) {
        pousserReservations();
        badge('ok');
        return 'identique';
      }
      return api('/data?collection=reservations').then(function (items) {
        if (e && e.h) empreinteEnAttente = e.h; else empreinteEnAttente = null;
        return items;
      });
    }).then(function (items) {
      if (items === 'identique') return 'identique';
      if (!Array.isArray(items)) throw new Error('lecture');
      var srv = {}, cfg = null;
      items.forEach(function (it) {
        if (!it || !it.d) return;
        var v; try { v = JSON.parse(it.d); } catch (e) { return; }
        if (it.id === 'cfg') cfg = v; else if (v && v.id) srv[v.id] = v;
      });
      var local = lireLocal();
      if (local === null) local = [];
      var premiere = !connuExiste;
      var sortie = [], vus = {}, change = false;

      local.forEach(function (r) {
        if (!r || !r.id) return;
        vus[r.id] = true;
        var brut = JSON.stringify(r);
        var s = srv[r.id];
        var enAttente = premiere ? false : connuR[r.id] !== brut;
        if (s) {
          if (enAttente) {
            /* modifiée ici ET changée sur le serveur depuis : on fusionne champ par champ */
            var fus2 = r;
            try {
              var sbr = JSON.stringify(s);
              if (connuR[r.id] && sbr !== connuR[r.id]) { fus2 = fusionResa(JSON.parse(connuR[r.id]), r, s); connuR[r.id] = sbr; change = true; }
            } catch (e) { fus2 = r; }
            sortie.push(fus2);
          }
          else {
            var sb = JSON.stringify(s);
            connuR[r.id] = sb;
            if (sb !== brut) change = true;
            sortie.push(s);
          }
        } else if (supprimees[String(r.id)] && connuR[r.id] !== undefined && !enAttente) {
          /* supprimée ailleurs, et signalée comme telle par le serveur : retrait immédiat */
          delete connuR[r.id]; delete manque[r.id]; change = true;
        } else if (premiere || connuR[r.id] === undefined || enAttente) {
          sortie.push(r);                      /* jamais envoyée : on la garde */
          delete connuR[r.id];
        } else {
          /* absente du serveur alors qu'elle y avait été envoyée : soit elle a été
             supprimée ailleurs, soit le serveur ne la liste pas encore (la liste
             du serveur peut avoir quelques secondes de retard). On ne la retire
             donc qu'après plusieurs lectures successives sur au moins une minute. */
          var m = manque[r.id] || (manque[r.id] = { n: 0, t: Date.now() });
          m.n++;
          if (m.n >= 4 && Date.now() - m.t >= 60000) {
            delete connuR[r.id]; delete manque[r.id]; change = true;  /* supprimée ailleurs */
          } else {
            sortie.push(r);
          }
        }
        if (s) delete manque[r.id];
      });
      Object.keys(srv).forEach(function (id) {
        if (vus[id]) return;
        if (connuR[id] !== undefined) return;  /* supprimée ici, suppression en route */
        connuR[id] = JSON.stringify(srv[id]);
        sortie.push(srv[id]); change = true;
      });
      connuExiste = true;
      sauverConnu();

      if (change || premiere) {
        var avantR = (window.R || []).slice();
        window.R = sortie;
        try { localStorage.setItem('vespraR', JSON.stringify(sortie)); } catch (e) {}
        /* le nom ou les coordonnées d'un client ont changé ailleurs : la base clients suit */
        try { if (typeof window.vespraClientsSuivre === 'function') window.vespraClientsSuivre(avantR, sortie); } catch (e) {}
        /* le back-office relit sa liste tout de suite */
        if (!premiere) { try { window.parent.postMessage({ type: 'vespra-resas-changees' }, location.origin); } catch (e) {} }
      }
      /* la configuration : fusion à trois voies */
      var rc = fusionnerConfig(cfg);
      if (rc.aEnvoyer) enregistrerConfig(); else ecrireBase(rc.cfg);
      if (!cfg || rc.aEnvoyer) { /* rien d'autre à faire : l'envoi est lancé */ }
      charge = true;
      derniereLecture = Date.now();
      empreinte = empreinteEnAttente;
      pousserReservations();
      badge('ok');
      return change || rc.modifLocale;
    }).catch(function () { badge('err'); return false; })
      .then(function (maj) { synchro = false; if (relancer) { relancer = false; setTimeout(function () { derniereLecture = 0; synchroniser(); }, 50); } return maj === 'identique' ? false : maj; });
  }
  var charger = synchroniser;

  var compteurErreurs = 0;
  function actualiser(force) {
    if (!window.__vespraPret || document.hidden) return Promise.resolve();
    return synchroniser().then(function (maj) {
      if (!maj) return;
      if (modalOuverte()) {
        /* une fenêtre est ouverte : on la laisse, mais la liste des
           disponibilités doit refléter ce qui vient d'arriver */
        if (typeof window.renderAccordion === 'function') { try { window.renderAccordion(); } catch (e) {} }
        /* la fiche d'une réservation ouverte à l'écran reflète ce qui vient d'être changé ailleurs */
        try {
          var dm = document.getElementById('detailMb');
          if (dm && dm.classList.contains('open') && window.currentDetailId && !window.editMode) {
            var encore = (window.R || []).some(function (x) { return x && String(x.id) === String(window.currentDetailId); });
            if (encore && typeof window.openDetail === 'function') window.openDetail(window.currentDetailId);
            else if (!encore) dm.classList.remove('open');
          }
        } catch (e) {}
      } else if (typeof window.nav === 'function') window.nav();
    });
  }
  window.vespraActualiser = function () { return synchroniser(); };
  setInterval(function () { if (!document.hidden) actualiser(); }, 3500);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) actualiser(); });
  window.addEventListener('focus', actualiser);
  window.addEventListener('pageshow', actualiser);
  window.addEventListener('online', actualiser);

  /* ── fondu dans le back-office ───────────────────────────────
     Intégré, l'outil n'a plus besoin de son propre bandeau bleu ni de
     son menu de gauche : le titre, la déconnexion et la navigation sont
     déjà ceux du back-office, et les afficher deux fois est déroutant.
     Seul le contenu de la page reste, calé sur toute la largeur du
     cadre. L'indicateur de synchronisation est conservé, discrètement,
     car il dit si les modifications sont bien parties sur le serveur.

     Rien n'est supprimé de la page : tout est masqué par une feuille de
     style. Ouverte seule, la page reste complète. */
  function fondre() {
    var st = document.createElement('style');
    st.textContent = [
      'header{display:none!important}',
      '.layout{height:100vh!important}',
      'aside{display:none!important}',
      'main{overflow:auto!important}',
      '.page{padding:20px 22px 40px!important;max-width:none!important}',
      'body{background:#fff!important}',
      /* l\'état de synchronisation est repris par la LED du back-office,
         en bas à gauche : l\'afficher deux fois n\'apporte rien */
      '#sync-badge{display:none!important}',
      '@media(max-width:860px){.page{padding:16px 14px 34px!important}}',
    ].join('');
    document.head.appendChild(st);


  }

  /* ── ouverture d'une page depuis le menu du back-office ──── */
  window.addEventListener('message', function (e) {
    if (e.source !== window.parent) return;
    var m = e.data;
    if (!m) return;
    if (m.type === 'vespra-page' && m.page) {
      /* Si la synchronisation initiale n'est pas terminée, on mémorise la
         page demandée et on la dessine seulement après le chargement des
         données. Sinon une navigation vers CA/Documents pouvait être
         remplacée par le Planning encore affiché au démarrage. */
      demandee = String(m.page);
      window.page = demandee;
      if (!window.__vespraPret) return;
      if (typeof window.nav === 'function') window.nav();
      return;
    }
    /* la flèche d'actualisation du back-office : on redemande au serveur */
    if (m.type === 'vespra-recharger') {
      charger().then(function () { window.__vespraPret = true; if (typeof window.nav === 'function') window.nav(); if (window.__vespraMontre) window.__vespraMontre(); });
      return;
    }
    /* le back-office demande d'ouvrir une réservation précise */
    if (m.type === 'vespra-ouvrir' && m.id) {
      window.page = 'planning';
      if (typeof window.nav === 'function') window.nav();
      var cible = m.id;
      /* l'identifiant doit désigner le bon client ; sinon on retrouve la
         réservation par son nom et sa date de début */
      try {
        var norm = function (t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); };
        var liste = (typeof R !== 'undefined' && Array.isArray(R)) ? R : [];
        var par = liste.find(function (x) { return String(x.id) === String(m.id); });
        if (m.client && (!par || norm(par.client) !== norm(m.client))) {
          var alt = liste.filter(function (x) { return norm(x.client) === norm(m.client); });
          var exacte = alt.find(function (x) { return !m.debut || x.dateStart === m.debut; }) || alt[0];
          if (exacte) cible = exacte.id;
        }
      } catch (err) { /* on garde l'identifiant reçu */ }
      try {
        var rr = (typeof R !== 'undefined' && Array.isArray(R)) ? R.find(function (x) { return String(x.id) === String(cible); }) : null;
        if (rr && rr.dateStart && typeof isoToDate === 'function') { window.cur = isoToDate(rr.dateStart); if (typeof window.nav === 'function') window.nav(); }
      } catch (err) { /* sans effet */ }
      /* le back-office a sa propre fiche : ici on se contente d'afficher la bonne date */
      var fiche = false;
      try { fiche = !!(window.parent && window.parent !== window && typeof window.parent.ficheResa === 'function'); } catch (err) { /* sans effet */ }
      if ((!fiche || m.forcer) && typeof window.openDetail === 'function') { window.__ancienForce = !!m.forcer; try { window.openDetail(cible); } finally { window.__ancienForce = false; } }
      return;
    }
    /* le planning à une date donnée, pour voir ce qui est réservé en même temps */
    if (m.type === 'vespra-aller-date') {
      window.page = 'planning';
      try { if (m.date && typeof isoToDate === 'function') window.cur = isoToDate(m.date); window.calView = 'month'; } catch (err) { /* sans effet */ }
      if (typeof window.nav === 'function') window.nav();
    }
  });

  function demarrer() {
    brancher();
    surveiller();

    /* La page demandée par le back-office est appliquée AVANT le premier
       affichage : sans cela, l'outil dessinait le planning, puis sautait
       sur la page voulue — on voyait le planning clignoter en ouvrant
       « Chiffre d'affaires ». */
    if (demandee) window.page = demandee;

    /* Filet de sécurité : la page se redessine plusieurs fois au
       démarrage (affichage initial, retour du serveur, reprise du
       planning). Tant que la page demandée n'a pas été réellement
       affichée, on la réimpose juste avant chaque redessin — sinon
       « Chiffre d'affaires » ouvrait sur le planning. Dès qu'elle est
       affichée une fois, la navigation redevient libre. */
    var pageVoulue = demandee;
    if (pageVoulue && typeof window.nav === 'function' && !window.nav._vp) {
      var vraiNav = window.nav;
      var enveloppe = function () {
        if (pageVoulue && window.page !== pageVoulue) window.page = pageVoulue;
        var res = vraiNav.apply(this, arguments);
        if (pageVoulue && window.page === pageVoulue) { pageVoulue = null; }
        return res;
      };
      enveloppe._vp = true;
      window.nav = enveloppe;
    }
    setTimeout(function () {
      if (pageVoulue && typeof window.nav === 'function') window.nav();
    }, 400);

    if (DANS_LE_BO) {
      fondre();
      /* la connexion du back-office fait foi */
      if (typeof window.hideAuthScreens === 'function') window.hideAuthScreens();
      var o = document.getElementById('auth-overlay');
      if (o) o.style.display = 'none';
      if (!window.currentUser) {
        window.currentUser = { firstName: 'Vespra', lastName: 'Event', email: '', role: 'admin' };
        if (typeof window.updateHeaderUser === 'function') window.updateHeaderUser();
      }
    }

    /* le planning ne se dessine qu'avec les données du serveur : jamais une copie
       périmée du navigateur qui se corrige deux secondes plus tard */
    charger().catch(function () {}).then(function () {
      window.__vespraPret = true;
      if (demandee) window.page = demandee;
      if (typeof window.nav === 'function') window.nav();
      devoiler();
      if (window.__vespraMontre) window.__vespraMontre();
      if (window.parent !== window) window.parent.postMessage({ type: 'vespra-prete' }, location.origin);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
