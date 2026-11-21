/* Vespra Event Photobooth — appli des bornes.
   Fonctionne dans Chrome (mode kiosque) ou dans l'appli Windows « Vespra Event Photobooth »,
   qui expose window.vespraBorne (appareil photo reflex Canon, dossier local, impression silencieuse, démarrage auto). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var API = '/api/photobooth/';
  var Pont = window.vespraBorne || null;              /* présent uniquement dans l'appli Windows */
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem('pb.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('pb.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var opts = Object.assign({ autoDernier: true, pleinEcran: true, voirEnregistres: true, dossier: 'C:\\VespraEvent\\Photobooth' }, LS.get('opts', {}));
  var etat = { appareil: LS.get('appareil', ''), evts: [], sel: null, evt: null, jeton: '', stats: null, lien: '', images: {}, imprSession: 0, ecran: '' };
  var POLICES = { elegante: "'Playfair VB',Georgia,serif", manuscrite: "'GreatVibes VB',cursive", moderne: "'Montserrat VB',Arial,sans-serif", festive: "'Mountains VB',cursive" };
  var ICONE = '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/></svg>';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var hex = function (n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); };
  var attendre = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function toast(t, ms) { var e = $('toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { e.hidden = true; }, ms || 2600); }
  function ecran(id) { document.querySelectorAll('.ecran').forEach(function (e) { e.classList.toggle('on', e.id === id); }); etat.ecran = id; }
  function api(chemin, o) {
    o = o || {}; var h = Object.assign({}, o.headers || {});
    if (etat.appareil) h['x-borne'] = etat.appareil;
    if (etat.jeton) h['x-appareil'] = etat.jeton;
    if (o.json) { h['content-type'] = 'application/json'; o.body = JSON.stringify(o.json); }
    return fetch(API + chemin, { method: o.method || (o.body ? 'POST' : 'GET'), headers: h, body: o.body, cache: 'no-store' });
  }
  function dateFr(d, court) { if (!d) return ''; var x = new Date(d + 'T12:00:00'); return x.toLocaleDateString('fr-FR', court ? { day: 'numeric', month: 'short' } : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  var auj = function () { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date()); };

  /* ── images (cadres, fonds, logos) : mises en cache sur la borne pour fonctionner sans réseau ── */
  function urlImage(evtId, id, viaBorne) { return viaBorne ? API + 'apercu/' + evtId + '/' + id : API + 'img/' + id; }
  function chargerImage(evtId, id, viaBorne) {
    var cle = evtId + '/' + id; if (!id) return Promise.resolve(null);
    if (etat.images[cle]) return Promise.resolve(etat.images[cle]);
    var u = urlImage(evtId, id, viaBorne), req = new Request(location.origin + '/pb-cache/' + cle);
    var depuisCache = ('caches' in window) ? caches.open('pb-img').then(function (c) { return c.match(req); }).catch(function () { return null; }) : Promise.resolve(null);
    return depuisCache.then(function (r) {
      if (r) return r.blob();
      return api(u.replace(API, '')).then(function (x) {
        if (!x.ok) return null;
        return x.blob().then(function (b) { if ('caches' in window) caches.open('pb-img').then(function (c) { c.put(req, new Response(b)); }).catch(function () {}); return b; });
      });
    }).then(function (b) {
      if (!b) return null;
      return new Promise(function (ok) { var im = new Image(); im.onload = function () { etat.images[cle] = im; ok(im); }; im.onerror = function () { ok(null); }; im.src = URL.createObjectURL(b); });
    }).catch(function () { return null; });
  }
  function imagesDe(e) {
    var l = [e.accueil && e.accueil.fond, e.accueil && e.accueil.logo && e.accueil.logo.image];
    (e.misesEnPage || []).forEach(function (m) { l.push(m.cadre); });
    return l.filter(Boolean);
  }

  /* ── appareil photo : reflex Canon via l'appli Windows, sinon webcam (essais) ── */
  /* reflex si l'appli Windows le détecte, sinon webcam */
  var reflex = function () { return !!(Pont && Pont.demarrerVisee && Pont.nomAppareil && Pont.nomAppareil()); };
  var Camera = {
    flux: null,
    nom: function () { return reflex() ? Pont.nomAppareil() : (Camera.flux ? (Camera.flux.getVideoTracks()[0] || {}).label || 'Webcam' : ''); },
    demarrer: function () {
      if (reflex()) { var lv = $('p-live'); lv.style.display = 'block'; $('p-video').style.display = 'none'; return Promise.resolve(Pont.demarrerVisee(lv)); }
      if (Camera.flux) return Promise.resolve();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.reject(new Error('Aucun appareil photo'));
      return navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }).then(function (s) {
        Camera.flux = s; var v = $('p-video'); v.srcObject = s; v.classList.add('miroir'); return v.play().catch(function () {});
      });
    },
    /* renvoie une image (canvas) en pleine définition */
    photo: function () {
      if (reflex()) return Promise.resolve(Pont.declencher()).then(blobVersCanvas);
      var v = $('p-video'), c = document.createElement('canvas'); c.width = v.videoWidth || 1280; c.height = v.videoHeight || 720;
      var x = c.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(v, 0, 0, c.width, c.height); return Promise.resolve(c);
    },
    arreter: function () { if (reflex()) Pont.arreterVisee(); }
  };
  function blobVersCanvas(b) {
    return new Promise(function (ok, ko) {
      var im = new Image(); im.onload = function () { var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); URL.revokeObjectURL(im.src); ok(c); };
      im.onerror = ko; im.src = typeof b === 'string' ? b : URL.createObjectURL(b);
    });
  }
  function majCamera() {
    var n = Camera.nom(), t = n ? n : (Pont ? (Pont.canonPresent && Pont.canonPresent() ? 'Canon détecté : activation USB requise' : 'Aucun appareil photo') : 'Webcam (essai) — reflex : appli Windows');
    ['l-cam', 'm-cam'].forEach(function (id) { var e = $(id); e.textContent = t; e.className = 'puce ' + (n ? 'ok' : 'ko'); });
  }

  /* ── 1. connexion de la borne ── */
  function connecter() {
    var mdp = $('c-mdp').value.trim(); $('c-err').textContent = '';
    fetch(API + 'acces', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mdp: mdp }) })
      .then(function (r) { return r.json(); }).then(function (d) {
        if (!d.ok) { $('c-err').textContent = d.erreur || 'Connexion impossible'; return; }
        etat.appareil = d.appareil; LS.set('appareil', d.appareil); etat.evts = d.evenements || []; afficherListe();
      }).catch(function () { $('c-err').textContent = 'Pas de connexion internet.'; });
  }
  $('c-ok').onclick = connecter;
  $('c-mdp').onkeydown = function (e) { if (e.key === 'Enter') connecter(); };

  /* ── 2. liste des événements : du plus proche au plus lointain, aperçus à droite ── */
  function chargerListe() {
    return api('evenements').then(function (r) {
      if (r.status === 401) { etat.appareil = ''; LS.set('appareil', ''); ecran('s-connexion'); throw new Error('expire'); }
      return r.json();
    }).then(function (d) { etat.evts = d.evenements || []; LS.set('evts', etat.evts); return etat.evts; })
      .catch(function (e) { if (e.message === 'expire') throw e; etat.evts = LS.get('evts', []); return etat.evts; });
  }
  function afficherListe() {
    etat.jeton = ''; ecran('s-liste'); majCamera(); dessinerListe();
    if (!etat.evts.length) chargerListe().then(dessinerListe).catch(function () {});
  }
  function dessinerListe() {
    var f = $('l-filtre').value.trim().toLowerCase(), j = auj(), dernier = LS.get('dernier', '');
    var l = etat.evts.filter(function (e) { return !f || String(e.nom).toLowerCase().indexOf(f) >= 0; });
    if (!opts.voirEnregistres) l = l.filter(function (e) { return !e.date || e.date >= j || e.id === dernier; });
    $('l-evts').innerHTML = l.length ? l.map(function (e) {
      var d = e.date ? new Date(e.date + 'T12:00:00') : null;
      var et = e.id === dernier ? '<span class="etat der">Dernier événement lancé</span>' : (e.date === j ? '<span class="etat auj">Aujourd’hui</span>' : (e.date && e.date < j ? '<span class="etat">Passé</span>' : '<span class="etat">' + (e.misesEnPage || []).length + ' cadre(s)</span>'));
      return '<div class="evt' + (etat.sel && etat.sel.id === e.id ? ' sel' : '') + '" data-id="' + e.id + '"><div class="jour">' + (d ? d.getDate() + '<small>' + d.toLocaleDateString('fr-FR', { month: 'short' }) + '</small>' : '—') + '</div><div><div class="nom">' + esc(e.nom) + '</div>' + et + '</div></div>';
    }).join('') : '<p class="vide">Aucun événement. Créez-le dans le back-office.</p>';
    $('l-evts').querySelectorAll('.evt').forEach(function (n) { n.onclick = function () { etat.sel = etat.evts.find(function (e) { return e.id === n.dataset.id; }); dessinerListe(); apercu(etat.sel); }; n.ondblclick = function () { lancer(n.dataset.id); }; });
    if (!etat.sel && l[0]) { etat.sel = l[0]; dessinerListe(); apercu(l[0]); }
  }
  $('l-filtre').oninput = dessinerListe;
  function apercu(e) {
    if (!e) return;
    var mps = e.misesEnPage || [];
    $('l-apercu').innerHTML = '<div class="ap-titre"><div><h2>' + esc(e.nom) + '</h2><p class="aide">' + esc(dateFr(e.date)) + '</p></div><button class="btn plein grand" id="ap-lancer">Lancer l’événement</button></div>' +
      '<div class="apercus"><div class="apercu"><h3>Écran d’accueil</h3><div class="mini-scene" id="ap-acc"></div></div>' +
      '<div class="apercu"><h3>Écran de partage</h3><div class="mini-scene" id="ap-par" style="background:#fff"></div></div>' +
      '<div class="apercu large"><h3>Cadres (' + mps.length + ')</h3><div class="mini-cadres" id="ap-cad">' + (mps.length ? '' : '<p class="aide">Aucun cadre : ajoutez-en dans le back-office.</p>') + '</div></div></div>';
    $('ap-lancer').onclick = function () { lancer(e.id); };
    miniScene($('ap-acc'), function (sc) { return dessinerAccueil(sc, e, true); });
    mps.forEach(function (m) { var b = document.createElement('div'); b.className = 'mini-cadre'; $('ap-cad').appendChild(b); vignetteCadre(e, m, true).then(function (c) { b.appendChild(c); }); });
    var p = $('ap-par'); p.innerHTML = '<div style="position:absolute;inset:8% 6%;display:grid;grid-template-columns:1.2fr 1fr;gap:6%;align-items:center"><div id="ap-par-img" style="height:100%;display:flex;align-items:center;justify-content:center"></div><div style="text-align:center;font:700 14px Georgia;color:#1F3B5A">' + esc((e.partage && e.partage.titre) || 'Vos photos sont prêtes !') + '<div style="margin:8px auto;width:58px;height:58px;background:repeating-linear-gradient(90deg,#1F3B5A 0 4px,#fff 4px 8px),#fff;border:4px solid #fff;outline:1px solid #ddd"></div><div style="font:500 10px system-ui;color:#6B665F">' + (e.impression && e.impression.bouton ? esc(e.impression.txtImprimer || 'Imprimer') + ' · ' : '') + esc((e.partage && e.partage.terminer) || 'Terminer') + '</div></div></div>';
    if (mps[0]) vignetteCadre(e, mps[0], true).then(function (c) { c.style.maxHeight = '100%'; c.style.maxWidth = '100%'; $('ap-par-img') && $('ap-par-img').appendChild(c); });
  }
  function miniScene(boite, dessin) {
    var sc = document.createElement('div'); sc.className = 'scene'; sc.style.left = '0'; sc.style.top = '0'; boite.appendChild(sc);
    var ajuster = function () { sc.style.transform = 'scale(' + (boite.clientWidth / 1920) + ')'; };
    ajuster(); new ResizeObserver(ajuster).observe(boite); dessin(sc);
  }
  /* vignette : le cadre posé sur des cases grises numérotées */
  function vignetteCadre(e, m, viaBorne) {
    var c = document.createElement('canvas'); c.width = m.w / 4; c.height = m.h / 4; var x = c.getContext('2d'), k = 0.25;
    x.fillStyle = m.fond || '#fff'; x.fillRect(0, 0, c.width, c.height);
    (m.cases || []).forEach(function (cs) { x.save(); x.translate((cs.x + cs.w / 2) * k, (cs.y + cs.h / 2) * k); x.rotate((cs.r || 0) * Math.PI / 180); x.fillStyle = '#C9CED6'; x.fillRect(-cs.w * k / 2, -cs.h * k / 2, cs.w * k, cs.h * k); x.fillStyle = '#fff'; x.font = '700 ' + Math.round(cs.h * k / 3) + 'px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(cs.n, 0, 0); x.restore(); });
    return chargerImage(e.id, m.cadre, viaBorne).then(function (im) { if (im) x.drawImage(im, 0, 0, c.width, c.height); return c; });
  }

  /* ── 3. écran d'accueil (même rendu que l'aperçu du back-office) ── */
  function dessinerAccueil(sc, e, viaBorne) {
    var a = e.accueil || {}; sc.innerHTML = ''; sc.style.background = a.couleur || '#fff';
    var p = [];
    if (a.fond) p.push(chargerImage(e.id, a.fond, viaBorne).then(function (im) { if (im) { var i = im.cloneNode(); i.className = 'fond'; sc.insertBefore(i, sc.firstChild); } }));
    if (a.texte && a.texte.contenu) { var t = document.createElement('div'); t.className = 'txt'; t.textContent = a.texte.contenu; t.style.cssText += ';left:' + a.texte.x + 'px;top:' + a.texte.y + 'px;font-family:' + (POLICES[a.texte.police] || POLICES.elegante) + ';font-size:' + a.texte.taille + 'px;color:' + a.texte.couleur; sc.appendChild(t); }
    if (a.logo && a.logo.image) p.push(chargerImage(e.id, a.logo.image, viaBorne).then(function (im) { if (im) { var i = im.cloneNode(); i.className = 'logo'; i.style.cssText = 'left:' + a.logo.x + 'px;top:' + a.logo.y + 'px;width:' + a.logo.largeur + 'px'; sc.appendChild(i); } }));
    var b = a.bouton || { x: 960, y: 540, taille: 230, couleur: '#1F3B5A', icone: '#fff' };
    var bt = document.createElement('button'); bt.className = 'declic'; bt.innerHTML = ICONE; bt.setAttribute('aria-label', 'Prendre une photo');
    bt.style.cssText = 'left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.taille + 'px;height:' + b.taille + 'px;background:' + b.couleur;
    bt.querySelector('svg').style.stroke = b.icone; sc.appendChild(bt);
    if (a.galerie !== false) { var g = document.createElement('button'); g.className = 'gal'; g.textContent = 'Galerie'; sc.appendChild(g); }
    return Promise.all(p);
  }
  function ajusterScene() { var sc = $('a-scene'), k = Math.min(innerWidth / 1920, innerHeight / 1080); sc.style.transformOrigin = 'center'; sc.style.transform = 'translate(-50%,-50%) scale(' + k + ')'; }
  addEventListener('resize', ajusterScene);
  function afficherAccueil() {
    var e = etat.evt; etat.imprSession = 0; ecran('s-accueil'); $('s-accueil').style.background = (e.accueil && e.accueil.couleur) || '#fff';
    dessinerAccueil($('a-scene'), e, false); ajusterScene();
    var sc = $('a-scene');
    sc.querySelector('.declic').onclick = commencer;
    var g = sc.querySelector('.gal'); if (g) g.onclick = galerie;
    if (majEnAttente) { majEnAttente = false; verifierMaj(); }
  }

  /* lancement d'un événement : jeton, images préchargées, mémorisé pour le prochain démarrage du PC */
  function lancer(id) {
    var dejaJeton = LS.get('jeton.' + id, null);
    var obtenir = dejaJeton && dejaJeton.exp > Date.now() + 86400e3 ? Promise.resolve(dejaJeton) :
      api('session', { json: { id: id } }).then(function (r) { return r.json(); }).then(function (d) { if (!d.ok) throw new Error(d.erreur || 'Ouverture impossible'); var j = { jeton: d.jeton, exp: d.exp }; LS.set('jeton.' + id, j); return j; });
    return obtenir.then(function (j) { etat.jeton = j.jeton; return lireConfig(true); })
      .then(function () { LS.set('dernier', id); if (opts.pleinEcran) pleinEcran(); afficherAccueil(); Camera.demarrer().then(majCamera).catch(majCamera); })
      .catch(function (e) {
        var hors = LS.get('cfg.' + id, null);             /* pas de réseau : on ouvre la dernière version connue */
        if (hors && dejaJeton) { etat.jeton = dejaJeton.jeton; etat.evt = hors; LS.set('dernier', id); afficherAccueil(); Camera.demarrer().then(majCamera).catch(majCamera); return; }
        toast(e.message || 'Ouverture impossible');
      });
  }
  function pleinEcran() { if (Pont && Pont.pleinEcran) return Pont.pleinEcran(true); var d = document.documentElement; if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().catch(function () {}); }

  /* ── mise à jour en direct : tout changement du back-office arrive en quelques secondes ── */
  var majEnAttente = false;
  function lireConfig(avecProgression) {
    return api('config').then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) { if (d.supprime) { toast('Cet événement a été supprimé.'); LS.set('dernier', ''); afficherListe(); } throw new Error(d.erreur || 'Événement indisponible'); }
      etat.stats = d.stats; etat.lien = d.lien || '';
      var change = !etat.evt || etat.evt.id !== d.evenement.id || etat.evt.maj !== d.evenement.maj;
      if (!change) return false;
      return precharger(d.evenement, avecProgression).then(function () { etat.evt = d.evenement; LS.set('cfg.' + d.evenement.id, d.evenement); return true; });
    });
  }
  function precharger(e, montrer) {
    var l = imagesDe(e), n = 0, tot = l.length + 1;
    var prog = function () { var p = Math.round(100 * n / tot); $('maj-barre').style.width = p + '%'; $('maj-pct').textContent = p + ' %'; };
    if (montrer) { $('maj').hidden = false; n = 1; prog(); }
    return Promise.all(l.map(function (id) { return chargerImage(e.id, id, false).then(function () { n++; if (montrer) prog(); }); }))
      .then(function () { if (montrer) { n = tot; prog(); return attendre(400).then(function () { $('maj').hidden = true; }); } });
  }
  function verifierMaj() {
    if (!etat.jeton || !etat.evt) return;
    if (etat.ecran !== 's-accueil' && etat.ecran !== 's-menu') { majEnAttente = true; return; }  /* jamais pendant une prise de vue */
    var avant = etat.evt.maj;
    api('config').then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) { if (d.supprime) lireConfig(false).catch(function () {}); return; }
      etat.stats = d.stats; etat.lien = d.lien || '';
      if (d.evenement.maj === avant) return;
      return precharger(d.evenement, true).then(function () { etat.evt = d.evenement; LS.set('cfg.' + d.evenement.id, d.evenement); if (etat.ecran === 's-accueil') afficherAccueil(); else ouvrirPanneau(panneauActif); });
    }).catch(function () {});
  }
  setInterval(verifierMaj, 5000);

  /* ── 4. choix du cadre puis 5. prise de vue ── */
  function commencer() {
    var mps = etat.evt.misesEnPage || [];
    if (!mps.length) { toast('Aucun cadre pour cet événement (back-office).'); return; }
    if (mps.length === 1) return prendre(mps[0]);
    ecran('s-cadres'); var k = $('k-liste'); k.innerHTML = '';
    mps.forEach(function (m) { var b = document.createElement('div'); b.className = 'mini-cadre'; k.appendChild(b); vignetteCadre(etat.evt, m, false).then(function (c) { b.appendChild(c); }); b.onclick = function () { prendre(m); }; });
    clearTimeout(commencer.t); commencer.t = setTimeout(function () { if (etat.ecran === 's-cadres') afficherAccueil(); }, 60000);
  }
  $('k-retour').onclick = function () { afficherAccueil(); };
  function compteARebours(s) {
    return new Promise(function (ok) {
      var c = $('p-compte'), i = s; c.textContent = i;
      var t = setInterval(function () { i--; if (i <= 0) { clearInterval(t); c.textContent = ''; ok(); } else c.textContent = i; }, 1000);
    });
  }
  /* la vue en direct s'affiche DANS les cases 1, 2, 3… du cadre : les invités se voient déjà dans la photo finale */
  function dessinerCase(cv, src, miroir) {
    var sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height; if (!sw || !sh) return;
    var x = cv.getContext('2d'), r = Math.max(cv.width / sw, cv.height / sh), w = cv.width / r, h = cv.height / r;
    x.save(); if (miroir) { x.translate(cv.width, 0); x.scale(-1, 1); } x.drawImage(src, (sw - w) / 2, (sh - h) / 2, w, h, 0, 0, cv.width, cv.height); x.restore();
  }
  function bâtirScene(m) {
    var st = $('p-stage'), cp0 = $('p-compte'), fl0 = $('p-flash'); st.innerHTML = '';
    var H = innerHeight * 0.96, W = innerWidth * 0.98, k = Math.min(H / m.h, W / m.w);
    st.style.width = m.w * k + 'px'; st.style.height = m.h * k + 'px'; st.style.background = m.fond || '#fff';
    var cvs = {};
    (m.cases || []).forEach(function (cs) {
      var d = document.createElement('div'); d.className = 'pcase'; d.style.cssText = 'left:' + cs.x * k + 'px;top:' + cs.y * k + 'px;width:' + cs.w * k + 'px;height:' + cs.h * k + 'px;transform:rotate(' + (cs.r || 0) + 'deg)';
      var c = document.createElement('canvas'); c.width = Math.round(cs.w * k * 1.5); c.height = Math.round(cs.h * k * 1.5); d.appendChild(c); st.appendChild(d); (cvs[cs.n] = cvs[cs.n] || []).push({ cv: c, cs: cs });
    });
    var cadre = document.createElement('img'); cadre.className = 'pcadre'; cadre.alt = ''; st.appendChild(cadre);   /* cadre PNG par-dessus */
    chargerImage(etat.evt.id, m.cadre, false).then(function (im) { if (im) cadre.src = im.src; });
    st.appendChild(cp0); st.appendChild(fl0);
    return { cvs: cvs, k: k };
  }
  function prendre(m) {
    ecran('s-prise'); var cases = (m.cases || []).slice().sort(function (a, b) { return a.n - b.n; });
    $('s-prise').style.background = (etat.evt.accueil && etat.evt.accueil.couleur) || '#fff';
    var sc = bâtirScene(m), actif = 1, vivant = true;
    var poses = Math.max(1, cases.reduce(function (t, c) { return Math.max(t, c.n); }, 0)), photos = [], cap = etat.evt.capture || { premier: 7, suivants: 3 };
    var source = function () { return reflex() ? $('p-live') : $('p-video'); };
    (function boucle() {                                           /* ~30 images/s : le flux vivant dans la case en cours */
      if (!vivant || etat.ecran !== 's-prise') return;
      (sc.cvs[actif] || []).forEach(function (o) { dessinerCase(o.cv, source(), !reflex()); });
      requestAnimationFrame(boucle);
    })();
    var suite = Camera.demarrer().catch(function () { toast('Appareil photo introuvable'); throw new Error('cam'); });
    var une = function (i) {
      actif = i + 1; $('p-pose').textContent = i === 0 ? (cap.texteAvant || 'Placez-vous dans le cadre') : 'Photo ' + (i + 1) + ' / ' + poses;
      var o = (sc.cvs[actif] || [])[0], cp = $('p-compte');
      if (o) { cp.style.left = (o.cs.x + o.cs.w / 2) * sc.k + 'px'; cp.style.top = (o.cs.y + o.cs.h / 2) * sc.k + 'px'; cp.style.fontSize = Math.max(60, Math.min(o.cs.w, o.cs.h) * sc.k * 0.55) + 'px'; }
      return compteARebours(i === 0 ? cap.premier : cap.suivants).then(function () {
        var f = $('p-flash'); f.classList.add('on'); setTimeout(function () { f.classList.remove('on'); }, 80);
        return Camera.photo();
      }).then(function (c) {
        photos.push(c);
        (sc.cvs[actif] || []).forEach(function (o) { dessinerCase(o.cv, c, false); });     /* la photo prise reste figée dans sa case */
        actif = 0;                                                                         /* plus de flux jusqu'à la pose suivante */
        return attendre(i < poses - 1 ? 700 : 1200);
      });
    };
    for (var i = 0; i < poses; i++) (function (i) { suite = suite.then(function () { return une(i); }); })(i);
    suite.then(function () { vivant = false; Camera.arreter(); return composer(m, photos); }).then(function (res) { partage(m, res, photos); })
      .catch(function (e) { vivant = false; if (e.message !== 'cam') toast('Erreur : ' + e.message); afficherAccueil(); });
  }
  /* photo finale : fond, photos dans les cases (recadrées sans déformation), cadre PNG par-dessus */
  function composer(m, photos) {
    var c = document.createElement('canvas'); c.width = m.w; c.height = m.h; var x = c.getContext('2d');
    x.fillStyle = m.fond || '#fff'; x.fillRect(0, 0, m.w, m.h);
    (m.cases || []).forEach(function (cs) {
      var p = photos[cs.n - 1] || photos[0]; if (!p) return;
      var r = Math.max(cs.w / p.width, cs.h / p.height), sw = cs.w / r, sh = cs.h / r;
      x.save(); x.translate(cs.x + cs.w / 2, cs.y + cs.h / 2); x.rotate((cs.r || 0) * Math.PI / 180);
      x.drawImage(p, (p.width - sw) / 2, (p.height - sh) / 2, sw, sh, -cs.w / 2, -cs.h / 2, cs.w, cs.h); x.restore();
    });
    return chargerImage(etat.evt.id, m.cadre, false).then(function (im) { if (im) x.drawImage(im, 0, 0, m.w, m.h); return c; });
  }
  var versBlob = function (c, q) { return new Promise(function (ok) { c.toBlob(ok, 'image/jpeg', q || 0.92); }); };

  /* ── 6. partage : QR code, impression, envoi en arrière-plan ── */
  var minuterie = null;
  function partage(m, final, photos) {
    var e = etat.evt, pa = e.partage || {}, im = e.impression || {}, prise = 'pr' + hex(8), rk = hex(16), quand = new Date().toISOString();
    ecran('s-partage'); $('r-titre').textContent = pa.titre || 'Vos photos sont prêtes !';
    $('r-final').src = final.toDataURL('image/jpeg', 0.85);
    $('r-recommencer').textContent = pa.recommencer || 'Recommencer'; $('r-terminer').textContent = pa.terminer || 'Terminer';
    $('r-qr-bloc').hidden = pa.qr === false; $('r-qr').innerHTML = '';
    if (pa.qr !== false && window.qrcode) { var q = window.qrcode(0, 'M'); q.addData(location.origin + API + 'q/' + prise + '?k=' + rk); q.make(); $('r-qr').innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); }
    /* enregistrement local + file d'envoi */
    versBlob(final).then(function (b) {
      var fichiers = [{ nom: 'final', blob: b }];
      var envois = Promise.resolve();
      if (pa.bruts !== false) photos.forEach(function (p, i) { if (i < 4) envois = envois.then(function () { return versBlob(p, 0.9).then(function (bb) { fichiers.push({ nom: 'brut-' + (i + 1), blob: bb }); }); }); });
      return envois.then(function () {
        if (Pont && Pont.enregistrer) fichiers.forEach(function (f) { try { Pont.enregistrer(e.nom, prise + '-' + f.nom + '.jpg', f.blob); } catch (x) {} });
        return File.ajouter({ evt: e.id, jeton: etat.jeton, prise: prise, rk: rk, mp: m.id, quand: quand, fichiers: fichiers });
      }).then(function () { Galerie.ajouter(e.id, b); });
    });
    /* impression */
    var limite = im.limites && im.limites.on, resteEvt = limite ? Math.max(0, im.limites.parEvenement - ((etat.stats && etat.stats.imprimees) || 0)) : 99, resteSess = limite ? Math.max(0, im.limites.parSession - etat.imprSession) : 99;
    var max = Math.min(im.copiesMax || 1, resteEvt, resteSess), copies = 1;
    $('r-imp').hidden = !(im.bouton !== false && max > 0) && !im.auto; $('r-imp-msg').textContent = '';
    $('r-copies').innerHTML = '';
    if (max > 1) { for (var i = 1; i <= max; i++) { var bt = document.createElement('button'); bt.textContent = i; bt.className = i === 1 ? 'sel' : ''; bt.onclick = (function (i, bt) { return function () { copies = i; $('r-copies').querySelectorAll('button').forEach(function (z) { z.className = z === bt ? 'sel' : ''; }); }; })(i, bt); $('r-copies').appendChild(bt); } }
    var bImp = $('r-imprimer'); bImp.textContent = im.txtImprimer || 'Imprimer'; bImp.disabled = max <= 0; bImp.hidden = im.bouton === false;
    var faire = function (n) { bImp.disabled = true; $('r-imp-msg').textContent = im.txtImpression || 'Impression…'; imprimer(m, final, n).then(function (res) { if (res && res.ok === false) { $('r-imp-msg').textContent = 'Imprimante indisponible : prévenez l’équipe Vespra Event.'; bImp.disabled = false; return; } etat.imprSession += n; if (etat.stats) etat.stats.imprimees += n; api('impression', { json: { prise: prise, copies: n } }).catch(function () {}); setTimeout(function () { $('r-imp-msg').textContent = 'C’est parti, votre photo arrive !'; }, 1500); }); };
    bImp.onclick = function () { faire(copies); };
    if (im.auto && max > 0) faire(1);
    /* retour automatique */
    var reste = pa.duree || 45; clearInterval(minuterie);
    var tic = function () { $('r-temps').textContent = 'Retour à l’accueil dans ' + reste + ' s'; if (reste-- <= 0) fin(); };
    var fin = function () { clearInterval(minuterie); $('r-qr').innerHTML = ''; $('r-final').src = ''; afficherAccueil(); };
    tic(); minuterie = setInterval(tic, 1000);
    $('r-terminer').onclick = fin;
    $('r-recommencer').onclick = function () { clearInterval(minuterie); $('r-qr').innerHTML = ''; prendre(m); };
  }
  /* bandelette 5×15 : deux bandelettes côte à côte sur une feuille 10×15, coupée en deux par l'imprimante DNP */
  function imprimer(m, final, copies) {
    var feuille = final, im = (etat.evt && etat.evt.impression) || {};
    var decoupe = im.decoupe == null ? m.format === '2x6' : im.decoupe;
    if (m.format === '2x6') {        /* bandelette : deux exemplaires côte à côte si découpe, sinon une seule, centrée, jamais étirée */
      feuille = document.createElement('canvas'); feuille.width = 1200; feuille.height = 1800; var x = feuille.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 1200, 1800);
      if (decoupe) { x.drawImage(final, 0, 0, 600, 1800); x.drawImage(final, 600, 0, 600, 1800); } else x.drawImage(final, 300, 0, 600, 1800);
    }
    var paysage = feuille.width > feuille.height;
    if (Pont && Pont.imprimer) return versBlob(feuille, 0.95).then(function (b) { return Pont.imprimer(b, { copies: copies, format: m.format, decoupe: decoupe }); });
    var url = feuille.toDataURL('image/jpeg', 0.95), f = $('impr'), d = f.contentDocument;
    d.open(); d.write('<!doctype html><style>@page{size:' + (paysage ? '6in 4in' : '4in 6in') + ';margin:0}html,body{margin:0}img{width:100%;height:100%;display:block;page-break-after:always;object-fit:cover}</style>' + new Array(copies + 1).join('<img src="' + url + '">')); d.close();
    return new Promise(function (ok) { setTimeout(function () { try { f.contentWindow.print(); } catch (e) {} ok(); }, 300); });
  }

  /* ── file d'envoi (IndexedDB) : rien n'est perdu si le réseau coupe, l'envoi reprend tout seul ── */
  var File = {
    db: null,
    ouvrir: function () { if (File.db) return Promise.resolve(File.db); return new Promise(function (ok, ko) { var r = indexedDB.open('vespra-photobooth', 1); r.onupgradeneeded = function () { r.result.createObjectStore('envois', { keyPath: 'prise' }); r.result.createObjectStore('galerie', { autoIncrement: true }); }; r.onsuccess = function () { File.db = r.result; ok(File.db); }; r.onerror = function () { ko(r.error); }; }); },
    tx: function (st, mode, f) { return File.ouvrir().then(function (db) { return new Promise(function (ok, ko) { var t = db.transaction(st, mode), s = t.objectStore(st), res = f(s); t.oncomplete = function () { ok(res && res.result !== undefined ? res.result : res); }; t.onerror = function () { ko(t.error); }; }); }); },
    ajouter: function (o) { return File.tx('envois', 'readwrite', function (s) { return s.put(o); }).then(function () { File.vider(); }); },
    enCours: false,
    vider: function () {
      if (File.enCours) return; File.enCours = true;
      File.tx('envois', 'readonly', function (s) { return s.getAll(); }).then(function (l) {
        var suite = Promise.resolve();
        (l || []).forEach(function (o) { suite = suite.then(function () { return File.envoyer(o); }).catch(function () {}); });
        return suite;
      }).catch(function () {}).then(function () { File.enCours = false; });
    },
    envoyer: function (o) {
      var MORCEAU = 3 * 1024 * 1024, suite = Promise.resolve();
      o.fichiers.forEach(function (f) {
        if (f.envoye) return;
        suite = suite.then(function () {
          var n = Math.max(1, Math.ceil(f.blob.size / MORCEAU)), s2 = Promise.resolve();
          for (var i = 0; i < n; i++) (function (i) {
            s2 = s2.then(function () {
              var q = 'prise=' + o.prise + '&nom=' + f.nom + '&i=' + i + '&n=' + n + '&rk=' + o.rk + '&mp=' + o.mp + '&quand=' + encodeURIComponent(o.quand);
              return fetch(API + 'envoi?' + q, { method: 'POST', headers: { 'x-appareil': o.jeton, 'content-type': 'application/octet-stream' }, body: f.blob.slice(i * MORCEAU, (i + 1) * MORCEAU) })
                .then(function (r) { if (!r.ok) throw new Error('envoi ' + r.status); });
            });
          })(i);
          return s2.then(function () { f.envoye = true; return File.tx('envois', 'readwrite', function (s) { return s.put(o); }); });
        });
      });
      return suite.then(function () { return File.tx('envois', 'readwrite', function (s) { return s.delete(o.prise); }); });
    }
  };
  setInterval(function () { File.vider(); }, 15000);
  addEventListener('online', function () { File.vider(); });

  /* galerie de la borne (dernières photos de l'événement, sur l'écran) */
  var Galerie = {
    ajouter: function (evt, b) { return File.tx('galerie', 'readwrite', function (s) { return s.add({ evt: evt, blob: b, quand: Date.now() }); }).catch(function () {}); },
    lister: function (evt) { return File.tx('galerie', 'readonly', function (s) { return s.getAll(); }).then(function (l) { return (l || []).filter(function (x) { return x.evt === evt; }).reverse().slice(0, 120); }); }
  };
  function galerie() {
    ecran('s-galerie'); $('g-grille').innerHTML = '';
    Galerie.lister(etat.evt.id).then(function (l) {
      $('g-grille').innerHTML = l.length ? '' : '<p class="vide">Pas encore de photo.</p>';
      l.forEach(function (x) { var i = new Image(); i.src = URL.createObjectURL(x.blob); $('g-grille').appendChild(i); });
    });
    clearTimeout(galerie.t); galerie.t = setTimeout(function () { if (etat.ecran === 's-galerie') afficherAccueil(); }, 90000);
  }
  $('g-fermer').onclick = function () { afficherAccueil(); };

  /* ── code PIN (0104 par défaut, modifiable dans Général) ── */
  var pinSuite = null, pinSaisie = '';
  function demanderPin(suite) {
    var bl = LS.get('pinBloque', 0); if (bl > Date.now()) { toast('Trop d’essais : réessayez dans ' + Math.ceil((bl - Date.now()) / 60000) + ' min'); return; }
    pinSuite = suite; pinSaisie = ''; $('pin').hidden = false; $('pin-err').textContent = ''; pts();
  }
  function pts() { $('pin-pts').innerHTML = [0, 1, 2, 3].map(function (i) { return '<i class="' + (i < pinSaisie.length ? 'p' : '') + '"></i>'; }).join(''); }
  $('pin-pave').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(function (k) { return k ? '<button data-k="' + k + '">' + k + '</button>' : '<span></span>'; }).join('');
  $('pin-pave').onclick = function (ev) {
    var k = ev.target.dataset && ev.target.dataset.k; if (!k) return;
    if (k === '⌫') pinSaisie = pinSaisie.slice(0, -1); else if (pinSaisie.length < 4) pinSaisie += k;
    pts();
    if (pinSaisie.length === 4) {
      if (pinSaisie === String(LS.get('pin', '0104'))) { LS.set('pinEssais', 0); $('pin').hidden = true; var s = pinSuite; pinSuite = null; s && s(); }
      else { var n = LS.get('pinEssais', 0) + 1; LS.set('pinEssais', n); pinSaisie = ''; pts(); $('pin-err').textContent = 'Code incorrect'; if (n >= 5) { LS.set('pinBloque', Date.now() + 5 * 60000); LS.set('pinEssais', 0); $('pin').hidden = true; toast('Trop d’essais : bloqué 5 minutes'); } }
    }
  };
  $('pin-annuler').onclick = function () { $('pin').hidden = true; };
  /* accès aux réglages : appui long (3 s) ou 5 appuis rapides dans le coin en haut à droite */
  (function () {
    var c = $('a-coin'), n = 0, t0 = 0, long = null;
    c.onpointerdown = function () { long = setTimeout(function () { demanderPin(ouvrirMenu); }, 3000); };
    c.onpointerup = c.onpointerleave = function () { clearTimeout(long); };
    c.onclick = function () { var t = Date.now(); n = t - t0 < 600 ? n + 1 : 1; t0 = t; if (n >= 5) { n = 0; demanderPin(ouvrirMenu); } };
  })();
  $('l-reg').onclick = function () { demanderPin(function () { if (etat.sel) { lancer(etat.sel.id).then(function () { ouvrirMenu('general'); }); } }); };

  /* ── menu de l'événement (comme l'appli PC) ── */
  var PANNEAUX = [['general', 'Général'], ['capture', 'Paramètres de capture'], ['appareil', 'Paramètres de l’appareil photo'], ['mise', 'Mise en page des photos'], ['partage', 'Paramètres de partage'], ['impression', 'Paramètres d’impression'], ['dossier', 'Dossier d’événement']];
  var panneauActif = 'general';
  function ouvrirMenu(p) {
    ecran('s-menu'); majCamera(); $('m-evt').textContent = etat.evt.nom; $('m-pop').hidden = true; $('m-evt-liste').hidden = true;
    $('m-nav').innerHTML = PANNEAUX.map(function (x) { return '<button data-p="' + x[0] + '">' + x[1] + '</button>'; }).join('');
    $('m-nav').querySelectorAll('button').forEach(function (b) { b.onclick = function () { ouvrirPanneau(b.dataset.p); }; });
    ouvrirPanneau(typeof p === 'string' ? p : panneauActif);
  }
  $('m-lancer').onclick = function () { afficherAccueil(); if (opts.pleinEcran) pleinEcran(); };
  $('m-evt').onclick = function () {
    var d = $('m-evt-liste'); if (!d.hidden) { d.hidden = true; return; }
    chargerListe().catch(function () { return etat.evts; }).then(function () {
      d.innerHTML = etat.evts.slice(0, 6).map(function (e) { return '<button data-id="' + e.id + '">' + esc(e.nom) + ' <span class="aide">' + esc(dateFr(e.date, true)) + '</span></button>'; }).join('') + '<button class="tous">Tous les événements…</button>';
      d.hidden = false;
      d.querySelectorAll('button[data-id]').forEach(function (b) { b.onclick = function () { d.hidden = true; etat.evt = null; lancer(b.dataset.id).then(function () { ouvrirMenu(); }); }; });
      d.querySelector('.tous').onclick = function () { d.hidden = true; afficherListe(); };
    });
  };
  function pop(html) { var p = $('m-pop'); if (!p.hidden && p.dataset.h === html.length + '') { p.hidden = true; return; } p.innerHTML = html; p.dataset.h = html.length; p.hidden = false; }
  $('m-stats').onclick = function () {
    lireConfig(false).catch(function () {}).then(function () {
      var s = etat.stats || { photos: 0, imprimees: 0, scans: 0 };
      pop('<div class="ligne"><span>Photos prises</span><b>' + s.photos + '</b></div><div class="ligne"><span>Photos imprimées</span><b>' + s.imprimees + '</b></div><div class="ligne"><span>QR codes scannés</span><b>' + s.scans + '</b></div>');
    });
  };
  $('m-lien').onclick = function () {
    if (!etat.lien) { pop('<p class="aide">Le lien de la galerie est désactivé.<br>Activez « Partager avec un lien » dans Galerie en ligne (back-office).</p>'); return; }
    pop('<p class="aide">Lien de la galerie de l’événement</p><input readonly value="' + esc(etat.lien) + '" onclick="this.select()"><p><button class="btn" id="pop-copier">Copier le lien</button></p>');
    $('pop-copier').onclick = function () { navigator.clipboard && navigator.clipboard.writeText(etat.lien).then(function () { toast('Lien copié'); }); };
  };
  function bascule(id, v, lib, aide) { return '<div class="ligne-opt"><div><b>' + lib + '</b>' + (aide ? '<div class="aide">' + aide + '</div>' : '') + '</div><input type="checkbox" class="bascule" id="' + id + '"' + (v ? ' checked' : '') + '></div>'; }
  function nombre(id, v, lib, unite, min, max) { return '<div class="ligne-opt"><b>' + lib + '</b><span><input type="number" id="' + id + '" value="' + v + '" min="' + min + '" max="' + max + '"> ' + (unite || '') + '</span></div>'; }
  function enregistrer(champ, val) {
    var o = {}; o[champ] = val;
    return api('reglages', { json: o }).then(function (r) { return r.json(); }).then(function (d) { if (!d.ok) throw new Error(); etat.evt = d.evenement; LS.set('cfg.' + d.evenement.id, d.evenement); toast('Enregistré'); })
      .catch(function () { toast('Enregistrement impossible (réseau ?)'); });
  }
  function ouvrirPanneau(p) {
    panneauActif = p; var e = etat.evt, P = $('m-panneau'), h = '';
    $('m-nav').querySelectorAll('button').forEach(function (b) { b.classList.toggle('sel', b.dataset.p === p); });
    if (p === 'general') {
      h = '<h2>Général</h2><div class="bloc"><label class="champ">Code de sécurité (PIN)</label><div style="display:flex;gap:8px"><input id="g-pin" inputmode="numeric" maxlength="4" value="' + esc(LS.get('pin', '0104')) + '"><button class="btn" id="g-pin-ok">Changer</button></div>' +
        '<label class="champ">Dossier des données</label><input id="g-dossier" value="' + esc(opts.dossier) + '"' + (Pont ? '' : ' disabled') + '><p class="aide">' + (Pont ? 'Les photos sont enregistrées dans ce dossier, un sous-dossier par événement.' : 'Le dossier local est géré par l’appli Windows « Vespra Event Photobooth ». Dans le navigateur, les photos attendent dans la borne jusqu’à leur envoi.') + '</p></div>' +
        '<div class="bloc">' + bascule('g-plein', opts.pleinEcran, 'Démarrer en plein écran') + bascule('g-auto', opts.autoDernier, 'Ouvrir automatiquement le dernier événement', 'Au démarrage du PC, la borne rouvre directement le dernier événement lancé.') + bascule('g-enreg', opts.voirEnregistres, 'Afficher les événements passés dans la liste') + bascule('g-boot', Pont && Pont.demarrageAuto ? Pont.demarrageAuto() : true, 'Lancer l’appli au démarrage de Windows', Pont ? '' : 'Réglé par le raccourci de démarrage de Windows (voir la notice).') + '</div>' +
        '<div class="bloc"><button class="btn" id="g-deco">Déconnecter cette borne</button></div>';
      P.innerHTML = h;
      $('g-pin-ok').onclick = function () { var v = $('g-pin').value.trim(); if (!/^\d{4}$/.test(v)) { toast('4 chiffres'); return; } LS.set('pin', v); toast('Code changé'); };
      var so = function () { opts.pleinEcran = $('g-plein').checked; opts.autoDernier = $('g-auto').checked; opts.voirEnregistres = $('g-enreg').checked; if ($('g-dossier').value) opts.dossier = $('g-dossier').value; LS.set('opts', opts); if (Pont && Pont.demarrageAuto) Pont.demarrageAuto($('g-boot').checked); if (Pont && Pont.dossier) Pont.dossier(opts.dossier); };
      ['g-plein', 'g-auto', 'g-enreg', 'g-boot', 'g-dossier'].forEach(function (id) { $(id).onchange = so; });
      $('g-deco').onclick = function () { if (!confirm('Déconnecter cette borne ? Il faudra ressaisir le mot de passe d’accès.')) return; LS.set('appareil', ''); LS.set('dernier', ''); etat.appareil = ''; etat.jeton = ''; ecran('s-connexion'); };
    } else if (p === 'capture') {
      var c = e.capture || {};
      P.innerHTML = '<h2>Paramètres de capture</h2><div class="bloc">' + nombre('c-1', c.premier, 'Compte à rebours de la première photo', 's', 1, 30) + nombre('c-2', c.suivants, 'Compte à rebours entre les photos', 's', 1, 30) + '</div><button class="btn plein" id="c-enr">Enregistrer</button>';
      $('c-enr').onclick = function () { enregistrer('capture', { premier: +$('c-1').value, suivants: +$('c-2').value }); };
    } else if (p === 'appareil') {
      P.innerHTML = '<h2>Paramètres de l’appareil photo</h2><div class="bloc"><div class="ligne-opt"><b>Appareil connecté</b><span class="puce ' + (Camera.nom() ? 'ok' : 'ko') + '">' + esc(Camera.nom() || 'aucun') + '</span></div>' +
        (Pont && Pont.reglagesAppareil ? '<div id="ap-reg"></div>' : '<p class="aide">Le reflex Canon EOS 1300D (USB) est piloté par l’appli Windows « Vespra Event Photobooth » : ouverture, vitesse, ISO et balance des blancs se règlent ici une fois l’appli installée. Dans le navigateur, seule une webcam peut servir aux essais.</p>') +
        '<p><button class="btn" id="ap-test">Prendre une photo test</button></p><div id="ap-res"></div></div>';
      if (Pont && Pont.reglagesAppareil) Pont.reglagesAppareil($('ap-reg'));
      $('ap-test').onclick = function () { Camera.demarrer().then(function () { return attendre(800); }).then(Camera.photo).then(function (cv) { cv.style.maxWidth = '100%'; cv.style.borderRadius = '8px'; $('ap-res').innerHTML = ''; $('ap-res').appendChild(cv); majCamera(); }).catch(function () { toast('Aucun appareil photo'); }); };
    } else if (p === 'mise') panneauMise(P, e);
    else if (p === 'partage') {
      var pa = e.partage || {};
      P.innerHTML = '<h2>Paramètres de partage</h2><div class="bloc">' + bascule('s-qr', pa.qr !== false, 'Afficher le QR code') + bascule('s-bruts', pa.bruts !== false, 'Envoyer aussi les photos brutes (sans cadre)') + nombre('s-duree', pa.duree || 45, 'Durée de l’écran de partage', 's', 10, 600) +
        '<label class="champ">Titre</label><input id="s-titre" value="' + esc(pa.titre || '') + '" placeholder="Vos photos sont prêtes !"><label class="champ">Bouton « Recommencer »</label><input id="s-rec" value="' + esc(pa.recommencer || '') + '" placeholder="Recommencer"><label class="champ">Bouton « Terminer »</label><input id="s-ter" value="' + esc(pa.terminer || '') + '" placeholder="Terminer"></div><button class="btn plein" id="s-enr">Enregistrer</button>';
      $('s-enr').onclick = function () { enregistrer('partage', { qr: $('s-qr').checked, bruts: $('s-bruts').checked, duree: +$('s-duree').value, titre: $('s-titre').value, recommencer: $('s-rec').value, terminer: $('s-ter').value }); };
    } else if (p === 'impression') {
      var im = e.impression || {}, li = im.limites || {};
      P.innerHTML = '<h2>Paramètres d’impression</h2><div class="bloc">' + bascule('i-auto', im.auto, 'Impression automatique') + bascule('i-bouton', im.bouton !== false, 'Afficher le bouton Imprimer') + nombre('i-max', im.copiesMax || 2, 'Nombre de copies maximum', '', 1, 10) + '</div>' +
        '<div class="bloc"><b>Imprimante de ce PC</b>' + (Pont && Pont.imprimantes ? '<p><select id="i-prn"></select></p>' : '<p class="aide">Navigateur : imprimante par défaut de Windows (Chrome en mode --kiosk-printing).</p>') + bascule('i-dec', im.decoupe == null ? (e.misesEnPage || [])[0] && e.misesEnPage[0].format === '2x6' : im.decoupe, 'Découpe en deux (bandelettes 5×15)', 'Activé : deux bandelettes par feuille 10×15, coupée en deux. Désactivé : la photo sort entière. <b>Activez aussi la découpe dans les paramètres de l’imprimante Windows avant l’événement.</b>') + '</div>' +
        '<div class="bloc">' + bascule('i-lim', li.on !== false, 'Limiter les impressions') + nombre('i-evt', li.parEvenement || 200, 'Par événement', 'impressions', 1, 100000) + nombre('i-ses', li.parSession || 1, 'Par session', 'impressions', 1, 50) + '<p class="aide">Imprimées jusqu’ici : <b>' + ((etat.stats && etat.stats.imprimees) || 0) + '</b></p></div>' +
        '<div class="bloc"><p class="aide">' + (Pont ? 'Imprimante : ' + esc(Pont.imprimante ? Pont.imprimante() : '') : 'Impression sans fenêtre : Chrome lancé avec l’option --kiosk-printing, imprimante DNP par défaut.') + ' </p><button class="btn" id="i-test">Imprimer une page test</button></div><button class="btn plein" id="i-enr">Enregistrer</button>';
      $('i-enr').onclick = function () { enregistrer('impression', { decoupe: $('i-dec').checked, auto: $('i-auto').checked, bouton: $('i-bouton').checked, copiesMax: +$('i-max').value, limites: { on: $('i-lim').checked, parEvenement: +$('i-evt').value, parSession: +$('i-ses').value } }); };
      if (Pont && Pont.imprimantes) Pont.imprimantes().then(function (l) { var z = $('i-prn'); if (!z) return; z.innerHTML = l.map(function (n) { return '<option' + (n === Pont.imprimante() ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join(''); z.onchange = function () { Pont.choisirImprimante(z.value); toast('Imprimante : ' + z.value); }; });
      $('i-test').onclick = function () { var m = (e.misesEnPage || [])[0]; if (!m) { toast('Aucun cadre'); return; } vignetteCadre(e, m, false).then(function (v) { var c = document.createElement('canvas'); c.width = m.w; c.height = m.h; c.getContext('2d').drawImage(v, 0, 0, m.w, m.h); imprimer(m, c, 1); }); };
    } else if (p === 'dossier') {
      P.innerHTML = '<h2>Dossier d’événement</h2><div class="bloc"><p>Photos de « ' + esc(e.nom) + ' » sur ce PC :</p><p><code>' + esc(opts.dossier + '\\' + e.nom) + '</code></p>' + (Pont && Pont.ouvrirDossier ? '<button class="btn plein" id="d-ouvrir">Ouvrir le dossier</button>' : '<p class="aide">L’ouverture du dossier Windows se fait depuis l’appli « Vespra Event Photobooth ». Toutes les photos sont aussi dans le back-office, onglet Photobooth → Tableau de bord.</p>') + '<p class="aide" id="d-file"></p></div>';
      if (Pont && Pont.ouvrirDossier) $('d-ouvrir').onclick = function () { Pont.ouvrirDossier(e.nom); };
      File.tx('envois', 'readonly', function (s) { return s.count(); }).then(function (n) { $('d-file').textContent = n ? n + ' prise(s) en attente d’envoi vers le serveur.' : 'Toutes les photos sont envoyées.'; }).catch(function () {});
    }
  }
  /* mise en page : déplacer / redimensionner les cases directement sur la borne */
  function panneauMise(P, e) {
    var mps = e.misesEnPage || [];
    if (!mps.length) { P.innerHTML = '<h2>Mise en page des photos</h2><p class="aide">Aucun cadre. Ajoutez-les dans le back-office.</p>'; return; }
    var m = JSON.parse(JSON.stringify(mps[panneauMise.i || 0] || mps[0]));
    P.innerHTML = '<h2>Mise en page des photos</h2><div class="bloc" style="max-width:none"><p><select id="mp-choix">' + mps.map(function (x, i) { return '<option value="' + i + '"' + (x.id === m.id ? ' selected' : '') + '>' + esc(x.nom) + '</option>'; }).join('') + '</select></p>' +
      '<div class="edit-mp"><div class="edit-stage" id="mp-stage"></div><div style="min-width:220px"><p class="aide">Faites glisser une case pour la déplacer, coin bas-droit pour l’agrandir. Les flèches du clavier déplacent la case choisie d’1 pixel.</p><button class="btn plein" id="mp-enr">Enregistrer</button></div></div></div>';
    $('mp-choix').onchange = function () { panneauMise.i = +this.value; panneauMise(P, e); };
    var st = $('mp-stage'), H = Math.min(innerHeight * 0.62, 640), k = H / m.h; st.style.width = m.w * k + 'px'; st.style.height = H + 'px';
    vignetteCadre(e, m, false).then(function (c) { st.insertBefore(c, st.firstChild); });
    var sel = null;
    var dessiner = function () {
      st.querySelectorAll('.edit-case').forEach(function (n) { n.remove(); });
      m.cases.forEach(function (cs, i) {
        var d = document.createElement('div'); d.className = 'edit-case' + (sel === i ? ' sel' : ''); d.textContent = cs.n;
        d.style.cssText = 'left:' + cs.x * k + 'px;top:' + cs.y * k + 'px;width:' + cs.w * k + 'px;height:' + cs.h * k + 'px;transform:rotate(' + (cs.r || 0) + 'deg)';
        d.onpointerdown = function (ev) {
          sel = i; var r = d.getBoundingClientRect(), coin = ev.clientX > r.right - 30 && ev.clientY > r.bottom - 30, x0 = ev.clientX, y0 = ev.clientY, o = { x: cs.x, y: cs.y, w: cs.w, h: cs.h };
          d.setPointerCapture(ev.pointerId); d.classList.add('sel');
          d.onpointermove = function (mv) { var dx = (mv.clientX - x0) / k, dy = (mv.clientY - y0) / k; if (coin) { cs.w = Math.max(40, Math.round(o.w + dx)); cs.h = Math.max(40, Math.round(o.h + dy)); } else { cs.x = Math.round(o.x + dx); cs.y = Math.round(o.y + dy); } d.style.left = cs.x * k + 'px'; d.style.top = cs.y * k + 'px'; d.style.width = cs.w * k + 'px'; d.style.height = cs.h * k + 'px'; };
          d.onpointerup = function () { d.onpointermove = null; dessiner(); };
        };
        st.appendChild(d);
      });
    };
    dessiner();
    document.onkeydown = function (ev) { if (etat.ecran !== 's-menu' || panneauActif !== 'mise' || sel == null) return; var cs = m.cases[sel], d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key]; if (!d) return; ev.preventDefault(); cs.x += d[0]; cs.y += d[1]; dessiner(); };
    $('mp-enr').onclick = function () { enregistrer('misesEnPage', [{ id: m.id, cases: m.cases }]); };
  }

  /* ── démarrage : la borne rouvre seule le dernier événement (PC rallumé) ── */
  function demarrer() {
    if (!etat.appareil) { ecran('s-connexion'); return; }
    var dernier = LS.get('dernier', ''), forcer = /[?&]liste/.test(location.search);
    if (dernier && opts.autoDernier && !forcer) { lancer(dernier); chargerListe().catch(function () {}); return; }
    chargerListe().then(afficherListe).catch(function () { afficherListe(); });
  }
  setInterval(function () { if (etat.ecran === 's-liste' || etat.ecran === 's-menu') majCamera(); }, 3000);   /* le nom de l'appareil apparaît dès qu'il est branché */
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  File.vider();
  demarrer();
  window.__pb = { etat: etat, File: File };   /* pour le diagnostic */
})();
