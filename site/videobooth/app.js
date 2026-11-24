/* Vidéobooth Vespra Event — appli tablette.
   Les vidéos sont d'abord gardées dans la tablette (IndexedDB), puis envoyées au serveur dès qu'il y a du réseau. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var CFG0 = { event: '', titre: 'Enregistrer un souvenir', sous: 'Laissez un petit message vidéo de 30 secondes', serveur: '', cle: '', max: 30, cam: '', pin: '0104' };
  function lireCfg() { try { return Object.assign({}, CFG0, JSON.parse(localStorage.getItem('vb-cfg') || '{}')); } catch (e) { return Object.assign({}, CFG0); } }
  function ecrireCfg(c) { try { localStorage.setItem('vb-cfg', JSON.stringify(c)); } catch (e) {} }
  /* textes de chaque écran : ceux du back-office (session.textes) remplacent ces valeurs par défaut ; « {heure} » = heure de déblocage */
  var DEF = { go: 'Commencer', m1n: 'Vidéo souvenir', m1d: 'Filmez un message, un vœu ou un souvenir', m2n: 'Boîte à questions', m2d: 'Répondez face caméra aux questions préparées pour l’événement', m3n: 'Questions piquantes', m3d: 'Des questions plus osées, pour les plus audacieux', m3b: 'Débloqué à {heure}',
    pretT: 'Êtes-vous prêts ?', pretB: 'C’est parti !', plaitT: 'La vidéo vous plaît ?', plaitNon: 'Non, on recommence', plaitOui: 'Oui, c’est parfait', quiB: 'Continuer',
    livT: 'Récupérer votre vidéo', livQr: 'QR code', livQrT: 'Scannez ce code avec l’appareil photo de votre téléphone', livMail: 'Par e-mail', livMailT: 'Votre adresse e-mail', livAutreQ: 'Voulez-vous l’envoyer à quelqu’un ?', livOui: 'Oui', livNon: 'Non', livPrenom: 'Prénom de la personne', livEmail2: 'Son adresse e-mail', livFin: 'Terminé', merciT: 'Merci !', merciD: 'Votre vidéo a bien été enregistrée.' };
  var SUITE_ORGA = ' Le QR code et l’e-mail sont uniquement pour vous, si vous souhaitez garder la vôtre.';
  var ORGA = { mariage: 'Les mariés recevront toutes les vidéos de leur côté.' + SUITE_ORGA, entreprise: 'Les organisateurs recevront toutes les vidéos de leur côté.' + SUITE_ORGA, anniversaire: 'La personne fêtée recevra toutes les vidéos de son côté.' + SUITE_ORGA, autre: 'Les organisateurs recevront toutes les vidéos.' + SUITE_ORGA };
  /* ── couleurs : un fond uni et une couleur pour les boutons, choisis par événement ; texte, cartes et traits s'en déduisent (clair ou foncé) ── */
  var AMB = { blanc: ['#FFFFFF', '#B8893B'], ivoire: ['#FAF6EE', '#B8893B'], rose: ['#FDF6F4', '#B76E79'], sauge: ['#F8F9F4', '#6B8560'], perle: ['#F1F1EF', '#262626'], noir: ['#161616', '#C9A24D'] };
  /* disposition de l'écran : celle de la tablette (« auto »), ou imposée par l'événement (écran fixe, tablette posée en hauteur…) */
  function paysage() { return cfg.ori === 'paysage' ? true : (cfg.ori === 'portrait' ? false : window.innerWidth > window.innerHeight); }
  function appliquerOrientation() { document.documentElement.setAttribute('data-ori', paysage() ? 'paysage' : 'portrait'); }
  window.addEventListener('resize', function () { appliquerOrientation(); });
  /* police du titre : quatre styles, choisis par événement */
  var POLICES = { elegante: ["'Playfair VB',Georgia,serif", 700, 1], manuscrite: ["'GreatVibes VB','Brush Script MT',cursive", 400, 1.3], moderne: ["'Montserrat VB',Inter,system-ui,sans-serif", 700, 0.8], festive: ["'Mountains VB',cursive", 700, 1.2] };
  function hexOk(x) { return /^#[0-9a-fA-F]{6}$/.test(x || '') ? x : ''; }
  function rvb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function lum(h) { var c = rvb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function appliquerTheme() {
    var p = AMB[cfg.amb] || AMB.blanc, fond = hexOk(cfg.fond) || p[0], acc = hexOk(cfg.accent) || p[1];
    var clair = lum(fond) > 0.35, r = rvb(acc), st = document.documentElement.style;
    var v = { '--bg1': fond, '--acc': acc, '--acc-t': lum(acc) > 0.45 ? '#1a1612' : '#ffffff', '--glow': 'rgba(' + r.join(',') + ',.18)', '--glow2': 'rgba(' + r.join(',') + ',.12)',
      '--txt': clair ? '#231F1C' : '#ffffff', '--soft': clair ? '#6F655C' : 'rgba(255,255,255,.72)', '--card': clair ? '#ffffff' : 'rgba(255,255,255,.08)', '--champ': clair ? '#ffffff' : 'rgba(255,255,255,.1)',
      '--line': clair ? 'rgba(35,31,28,.14)' : 'rgba(255,255,255,.22)', '--ombre': clair ? 'rgba(60,45,25,.28)' : 'rgba(0,0,0,.55)', '--err': clair ? '#b3392b' : '#ffb4a8', '--tit': clair ? '#1F3B5A' : '#ffffff' };
    var pf = POLICES[cfg.police] || POLICES.elegante; v['--ft'] = pf[0]; v['--ftw'] = pf[1]; v['--fts'] = pf[2];
    Object.keys(v).forEach(function (k) { st.setProperty(k, v[k]); });
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', fond);
  }
  function T(k, heure) { var t = (cfg.textes && cfg.textes[k]) || DEF[k] || ''; return heure == null ? t : t.replace(/\{heure\}/g, heure); }
  var cfg = lireCfg(); if (!cfg.pin) cfg.pin = '0104'; if (!cfg.cle) cfg.cle = CFG0.cle;
  /* appairage rapide : ouvrir /videobooth/#cle=VOTRE_CLE une seule fois enregistre la clé sur la tablette */
  try {
    var mh = /[#&?]cle=([^&]+)/.exec(location.hash || '');
    if (mh) { cfg.cle = decodeURIComponent(mh[1]).trim(); ecrireCfg(cfg); history.replaceState(null, '', location.pathname); }
  } catch (e) {}

  /* ───────── base locale ───────── */
  var DB = null;
  function ouvrirDb() {
    return new Promise(function (ok, ko) {
      var r = indexedDB.open('vb-videos', 2);
      r.onupgradeneeded = function () { var d = r.result; if (!d.objectStoreNames.contains('videos')) d.createObjectStore('videos', { keyPath: 'id' }); if (!d.objectStoreNames.contains('sons')) d.createObjectStore('sons', { keyPath: 'id' }); };
      r.onsuccess = function () { DB = r.result; ok(DB); };
      r.onerror = function () { ko(r.error); };
    });
  }
  function tx(mode, f) { return new Promise(function (ok, ko) { var t = DB.transaction('videos', mode), s = t.objectStore('videos'), q = f(s); t.oncomplete = function () { ok(q && q.result); }; t.onerror = function () { ko(t.error); }; }); }
  function toutes() { return tx('readonly', function (s) { return s.getAll(); }); }
  function ajouter(v) { return tx('readwrite', function (s) { return s.put(v); }); }
  function retirer(id) { return tx('readwrite', function (s) { return s.delete(id); }); }

  /* ───────── écrans ───────── */
  function montrer(id) {
    if (id !== 's-revoir') { var vr = $('v-revoir'); try { vr.pause(); vr.removeAttribute('src'); vr.load(); } catch (e) {} } document.querySelectorAll('.ecran').forEach(function (e) { e.classList.toggle('on', e.id === id); });
    /* application Android : la barre du système n'apparaît que dans les réglages (après le code), jamais devant les invités */
    try { if (window.VespraAndroid) window.VespraAndroid.admin(id === 's-admin' || id === 's-appli'); } catch (e) {} }
  var inactif = null;
  function veille() { clearTimeout(inactif); inactif = setTimeout(function () { if (!$('s-accueil').classList.contains('on') && !$('s-admin').classList.contains('on') && !$('s-pin').classList.contains('on') && !enregistrement) { arreterCam(); accueil(); } }, 120000); }
  ['pointerdown', 'keydown'].forEach(function (t) { document.addEventListener(t, veille, { passive: true }); });
  function accueil(garder) {
    if (videoEnCours) libererEnAttente();
    $('l-qr-img').innerHTML = '';   /* le QR code d'un invité ne reste jamais affiché pour le suivant */
    if (sessionMaj) { cfg.session = Object.assign({}, cfg.session, sessionMaj); sessionMaj = null; appliquerActif(); }
    if (Date.now() - dernierMaj > 60000) majSession();   /* à chaque retour à l'accueil (au plus une fois par minute) : les réglages du back-office arrivent vite */
    appliquerTheme(); appliquerOrientation();
    $('t-accueil').textContent = cfg.titre || CFG0.titre; $('p-accueil').textContent = (cfg.sous && cfg.sous !== 'Laissez un petit message vidéo de 30 secondes') ? cfg.sous : ''; $('b-commencer').textContent = T('go');
    $('t-qui').textContent = cfg.qui || 'Qui êtes-vous ?'; $('p-qui').textContent = cfg.quiSous == null ? 'Pour que les organisateurs sachent qui a laissé ce message' : cfg.quiSous; $('f-suite').textContent = T('quiB');
    if (!garder) { $('form').reset(); formatInvite = null; majFormat(); } $('f-err').textContent = ''; rendreModes(); montrer('s-accueil'); majEtat();
  }
  var sessionMaj = null;

  /* ───────── modes : message vidéo, boîte à questions, questions piquantes ─────────
     S'il n'y a que le message vidéo : un seul bouton « Commencer ». Sinon, une carte par mode ;
     les questions piquantes restent grisées jusqu'à l'heure choisie dans le back-office (heure de Paris). */
  var mode = 'video', questionsMode = [], dureesQ = [];
  function minutesParis() {
    try {
      var h = 0, m = 0; new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).forEach(function (x) { if (x.type === 'hour') h = +x.value; if (x.type === 'minute') m = +x.value; });
      return h * 60 + m;
    } catch (e) { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  }
  function hMin(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : 23 * 60; }
  function hLib(t) { var u = hMin(t), h = Math.floor(u / 60), m = u % 60; return h + 'h' + (m ? ('0' + m).slice(-2) : ''); }
  /* ouvertes à partir de l'heure choisie, et jusqu'à 6 h du matin quand cette heure est le soir ou l'après-midi */
  function piquantesOuvertes() { var u = hMin(cfg.heureP), n = minutesParis(); return n >= u || (u >= 12 * 60 && n < 6 * 60); }
  function modesDispo() { var l = ['video']; if (cfg.modeQ && (cfg.qs || []).length) l.push('questions'); if (cfg.modeP && (cfg.qp || []).length) l.push('piquantes'); return l; }
  var SVG = { video: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5 21.5 7v10l-6-3.5z"/></svg>',
    questions: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z"/><path d="M9.8 8.4a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1.8-1.1 1.5"/><circle cx="12" cy="13.6" r=".7" fill="currentColor" stroke="none"/></svg>',
    piquantes: '<svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor" stroke="none" aria-hidden="true"><path d="M15.5 7.2c3.7-.3 5.2 3.5 3.2 7.5-2.3 4.6-7.7 6.8-13.9 5.8-1.2-.2-1.2-1.2-.3-1.6C8.2 17.1 10 15 11 12c.9-2.6 1.7-4.6 4.5-4.8z"/><path d="M15.5 7.2c-.5-1.6 0-3.2 1.7-4 .6-.3 1.1.4.6.9-.8.7-.9 1.6-.4 2.5z" opacity=".7"/></svg>' };
  var SVG_CADENAS = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9.5" rx="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  var CLE_MODE = { video: ['m1n', 'm1d'], questions: ['m2n', 'm2d'], piquantes: ['m3n', 'm3d'] };
  function nomMode(id) { return T(CLE_MODE[id || mode][0]); }
  function rendreModes() {
    var z = $('modes'), l = modesDispo(), seul = l.length === 1;
    document.body.classList.toggle('mode-seul', !!seul); $('b-commencer').hidden = !seul; z.hidden = seul; z.innerHTML = ''; if (seul) return; z.style.setProperty('--n', l.length);
    l.forEach(function (id) {
      var b = document.createElement('button'), ferme = id === 'piquantes' && !piquantesOuvertes();
      b.type = 'button'; b.className = 'mode ' + id;
      b.innerHTML = '<span class="in"><span class="ic"></span><b></b><span class="d"></span></span>';
      b.querySelector('.ic').innerHTML = SVG[id]; b.querySelector('b').textContent = T(CLE_MODE[id][0]); b.querySelector('.d').textContent = T(CLE_MODE[id][1]);
      if (ferme) {
        b.disabled = true; var c = document.createElement('span'); c.className = 'cadenas-b'; c.innerHTML = SVG_CADENAS + '<em></em>'; c.querySelector('em').style.fontStyle = 'normal'; c.querySelector('em').textContent = T('m3b', hLib(cfg.heureP)); b.appendChild(c);
      } else b.onclick = function () { choisirMode(id); };
      z.appendChild(b);
    });
  }
  setInterval(function () { if ($('s-accueil').classList.contains('on')) rendreModes(); }, 20000);
  function choisirMode(m) {
    mode = m; var brut = m === 'questions' ? (cfg.qs || []).slice() : (m === 'piquantes' ? (cfg.qp || []).slice() : []);
    /* une question peut avoir sa propre durée : « Votre meilleure anecdote ? (15 s) » */
    dureesQ = []; questionsMode = brut.map(function (q) { var x = /\s*\((\d{1,3})\s*s\)\s*$/i.exec(String(q)); dureesQ.push(x ? Math.min(120, Math.max(3, +x[1])) : 0); return x ? String(q).slice(0, x.index) : String(q); });
    formatInvite = null; majFormat(); invite = null; ouvrirCam();
  }
  /* durée de l'enregistrement : celle de la session, allongée si les questions demandent plus de temps (secondes par question réglées dans le back-office) */
  function dureesQuestions() {      /* secondes de chaque question : la sienne, sinon celle de la session, sinon répartition automatique */
    var n = questionsMode.length, base = Math.max(5, Number(cfg.max) || 30), sec = Number(cfg.secQ) > 0 ? Number(cfg.secQ) : 0;
    return questionsMode.map(function (_q, i) { return dureesQ[i] || sec || Math.max(3, base / n); });
  }
  function dureeMax() {
    var m = Math.max(5, Number(cfg.max) || 30);
    if (questionsMode.length && (Number(cfg.secQ) > 0 || dureesQ.some(Boolean))) m = Math.max(m, Math.min(300, dureesQuestions().reduce(function (t, x) { return t + x; }, 0)));
    return m;
  }
  function libMode() { return nomMode(mode); }
  function montrerPret() {
    var z = $('pret'); if (testCam) { z.hidden = true; return; }
    var n = questionsMode.length;
    $('pret-m').textContent = libMode(); $('pret-t').textContent = T('pretT');
    $('pret-h').textContent = n ? n + ' question' + (n > 1 ? 's vont défiler' : ' va défiler') + ' : répondez en regardant la caméra' : '';
    $('b-go').textContent = T('pretB'); z.hidden = false;
  }
  function majQuestion(s) {
    var n = questionsMode.length; if (!n) return;
    var d = dureesQuestions(), i = 0, deb = 0; while (i < n - 1 && s >= deb + d[i]) { deb += d[i]; i++; }
    var reste = Math.min(1, Math.max(0, (s - deb) / d[i]));
    $('q-lib').textContent = libMode() + ' · ' + (i + 1) + ' / ' + n; $('q-txt').textContent = questionsMode[i]; $('q-n').style.setProperty('--qp', Math.round(reste * 100) + '%');
    $('qbox').classList.toggle('pi', mode === 'piquantes'); $('qbox').hidden = false;
  }
  function fmt(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  /* ───────── nom, puis livraison de la vidéo ───────── */
  $('b-commencer').onclick = function () { choisirMode('video'); };
  /* le formulaire vient APRÈS la vidéo : « Retour » ramène à la vidéo, que l'invité peut revoir ou refaire */
  $('f-retour').onclick = function () { if (blobFinal) revoir(); else accueil(); };
  $('form').onsubmit = function (e) {
    e.preventDefault();
    var p = $('f-prenom').value.trim(), n = $('f-nom').value.trim();
    if (!p || !n) return ($('f-err').textContent = 'Merci d’indiquer votre prénom et votre nom.');
    if (!$('f-ok').checked) return ($('f-err').textContent = 'Merci de cocher la case pour enregistrer votre vidéo.');
    $('f-err').textContent = ''; invite = { prenom: p, nom: n }; ouvrirLivraison();
  };
  var invite = null;

  /* ───────── caméra ───────── */
  var decompte = null, flux = null, rec = null, morceaux = [], blobFinal = null, mime = '', enregistrement = false, minuteur = null, t0 = 0;
  function meilleurMime() {
    var l = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    for (var i = 0; i < l.length; i++) { try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(l[i])) return l[i]; } catch (e) {} }
    return '';
  }
  var sonNiveau = 100;
  var cv = $('v-live'), cx = cv.getContext('2d'), boucle = 0;
  /* Rendu toujours VERTICAL (3:4) : l'image de la caméra est recadrée sur un canvas, et c'est ce canvas qui est filmé. */
  /* format de la vidéo : automatique = suit l'orientation de la tablette (vertical 9:16, horizontal 16:9) */
  var formatInvite = null;   /* format choisi par l'invité (vertical / horizontal), remis à zéro pour chaque nouvel invité */
  function formatEffectif() { var f = formatInvite || cfg.format || 'auto'; if (f === 'auto') f = paysage() ? '16:9' : '9:16'; return f; }
  function majFormat() {
    var f = formatEffectif(), vertical = f === '9:16' || f === '3:4';
    /* image entière (bandes noires) quand le format filmé n'a pas la forme de l'écran : on voit exactement ce qui sera filmé */
    document.body.classList.toggle('fmt34', f === '3:4' || f === '4:3' || vertical !== !paysage());
    Array.prototype.forEach.call(document.querySelectorAll('#fmt button'), function (b) { b.classList.toggle('on', (b.dataset.f === 'v') === vertical); });
  }
  window.addEventListener('resize', majFormat);
  Array.prototype.forEach.call(document.querySelectorAll('#fmt button'), function (b) { b.onclick = function () { formatInvite = b.dataset.f === 'v' ? '9:16' : '16:9'; majFormat(); }; });
  function ratioFormat() {
    var f = formatInvite || cfg.format || 'auto';
    if (f === 'auto') f = paysage() ? '16:9' : '9:16';
    return { '9:16': 0.5625, '3:4': 0.75, '4:3': 1.3333, '16:9': 1.7778 }[f] || 0.5625;
  }
  function dessiner() {
    var v = $('v-src');
    if (v.videoWidth) {
      var vw = v.videoWidth, vh = v.videoHeight, W, H, R = ratioFormat();
      /* l'image remplit toujours le format choisi (vertical = vraie vidéo de haut en bas) : le champ de vision se règle à la caméra (grand angle, orientation de la tablette) */
      if (vw / vh > R) { H = Math.min(vh, 1920); W = Math.round(H * R / 2) * 2; } else { W = Math.min(vw, 1920); H = Math.round(W / R / 2) * 2; }
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
      var sc = Math.max(W / vw, H / vh), sw = W / sc, sh = H / sc;
      cx.drawImage(v, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, W, H);
      cv.classList.remove('vide');
      /* image figée plus de 5 s alors que la caméra est ouverte : la caméra a décroché */
      if (v.currentTime !== derniereImage) { derniereImage = v.currentTime; tFige = Date.now(); } else if (tFige && Date.now() - tFige > 5000) { tFige = 0; perteCapteur('cam'); }
    }
    if (Date.now() - tNiveau > 120) { tNiveau = Date.now(); suivreNiveau(); }
    boucle = requestAnimationFrame(dessiner);
  }
  /* ── surveillance du micro et de la caméra ──
     niveau du micro (jauge + détection d'un enregistrement silencieux), perte de la caméra ou du micro, image figée */
  var audioCtx = null, analyseur = null, niveau = 0, niveauMax = 0, tNiveau = 0, camEtat = 'inconnu', micEtat = 'inconnu', derniereImage = 0, tFige = 0;
  function brancherMicro(s) {
    try {
      var a = s.getAudioTracks()[0]; if (!a) { micEtat = 'absent'; return; }
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      if (!audioCtx) audioCtx = new AC(); if (audioCtx.state === 'suspended') audioCtx.resume().catch(function () {});
      analyseur = audioCtx.createAnalyser(); analyseur.fftSize = 512; audioCtx.createMediaStreamSource(new MediaStream([a])).connect(analyseur);
      micEtat = 'ok'; niveauMax = 0;
    } catch (e) {}
  }
  function lireNiveau() {
    if (!analyseur) return 0;
    var d = new Uint8Array(analyseur.fftSize); analyseur.getByteTimeDomainData(d); var m = 0;
    for (var i = 0; i < d.length; i++) { var v = Math.abs(d[i] - 128) / 128; if (v > m) m = v; }
    return m;
  }
  function suivreNiveau() {
    var n = lireNiveau(); niveau = n; if (enregistrement && n > niveauMax) niveauMax = n;
    var b = $('mic-i'); if (b) { b.style.width = Math.min(100, Math.round(n * 220)) + '%'; b.style.background = n > 0.85 ? '#ef4444' : (n > 0.6 ? '#f59e0b' : '#4ade80'); }
  }
  /* Reconnexion automatique, sans boucle : 1re tentative après 2 s, puis 4, 8, 16… jusqu'à 60 s ; au bout de 6 échecs on revient
     à l'écran d'accueil (la prochaine personne retentera). Le compteur repart à zéro quand la caméra tient 30 s.
     Les invités ne voient jamais de message technique : seulement « Un instant… ». Le détail va dans l'état de la tablette (back-office). */
  var essaisCam = 0, minuteurReco = null, minuteurStable = null, nbReco = 0, nbSilence = 0;
  var camSuspecte = false;
  function perteCapteur(quoi) {
    camSuspecte = true;                    /* flux douteux : on ne le réutilisera pas */
    if (quoi === 'cam') camEtat = 'perdue'; else micEtat = 'perdu';
    clearTimeout(minuteurStable);
    if (enregistrement) { arreterRec(); return; }
    if (!$('s-cam').classList.contains('on') || minuteurReco) return;
    if (essaisCam >= 6) { essaisCam = 0; arreterCam(true); accueil(); return; }
    var delai = Math.min(60000, 2000 * Math.pow(2, essaisCam)); essaisCam++; nbReco++;
    $('cam-err').textContent = 'Un instant…'; $('cam-err').hidden = false;
    minuteurReco = setTimeout(function () { minuteurReco = null; if ($('s-cam').classList.contains('on') && !enregistrement) ouvrirCam(); }, delai);
  }
  /* La caméra reste allumée entre deux invités (ouverture immédiate, sans écran noir) ; elle est coupée après 10 min sans invité,
     ou quand on va dans les réglages. L'aperçu est effacé à chaque fois : jamais l'image de l'invité précédent. */
  var fluxGarde = null, minuteurGarde = null;
  function libererCamera() { clearTimeout(minuteurGarde); minuteurGarde = null; if (fluxGarde) { fluxGarde.getTracks().forEach(function (t) { t.stop(); }); fluxGarde = null; } }
  function effacerApercu() { try { cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); } catch (e) {} cv.classList.add('vide'); }
  function arreterCam(couper) {
    analyseur = null; $('mic').hidden = true; $('qbox').hidden = true; $('pret').hidden = true; if (boucle) { cancelAnimationFrame(boucle); boucle = 0; }
    if (flux) { if (couper) flux.getTracks().forEach(function (t) { t.stop(); }); else { fluxGarde = flux; clearTimeout(minuteurGarde); minuteurGarde = setTimeout(libererCamera, 10 * 60000); } flux = null; }
    if (couper) libererCamera();
    $('v-src').srcObject = null; effacerApercu();
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden && !flux) libererCamera(); });
  function ouvrirCam() {
    montrer('s-cam'); $('s-cam').classList.remove('flou'); $('cam-err').hidden = true; $('compte').hidden = true; $('rec').hidden = true; $('barre').hidden = true;
    $('b-go').hidden = true; $('b-stop').hidden = true; $('fmt').hidden = true; enregistrement = false;
    var contraintes = { audio: Object.assign({ echoCancellation: false, noiseSuppression: true, autoGainControl: true, channelCount: { ideal: 1 } }, cfg.mic ? { deviceId: { exact: cfg.mic } } : {}), video: Object.assign(cfg.cam ? { deviceId: { exact: cfg.cam } } : { facingMode: 'user' }, (paysage() ? { width: { ideal: 1920 }, height: { ideal: 1440 }, aspectRatio: { ideal: 4 / 3 }, frameRate: { ideal: 30 } } : { width: { ideal: 1440 }, height: { ideal: 1920 }, aspectRatio: { ideal: 3 / 4 }, frameRate: { ideal: 30 } })) };   /* 4:3 : tout le capteur, donc le champ de vision le plus large */
    arreterCam();
    var garde = !camSuspecte && fluxGarde && fluxGarde.getTracks().length && fluxGarde.getTracks().every(function (t) { return t.readyState === 'live'; }) ? fluxGarde : null;
    if (garde) { fluxGarde = null; clearTimeout(minuteurGarde); } else libererCamera();
    /* haute définition exigée d'abord (au moins 1280 px) ; si la caméra la refuse, demande souple ; si la caméra choisie est introuvable ou inutilisable, retour à la caméra avant par défaut */
    var dur = JSON.parse(JSON.stringify(contraintes)); dur.video = Object.assign({}, dur.video, paysage() ? { width: { min: 1280, ideal: 1920 }, height: { min: 720, ideal: 1440 } } : { width: { min: 720, ideal: 1440 }, height: { min: 1280, ideal: 1920 } });
    var choisie = '';
    var viser = function (id) { [contraintes, dur].forEach(function (c) { delete c.video.deviceId; delete c.video.facingMode; if (id) c.video.deviceId = { exact: id }; else c.video.facingMode = 'user'; }); };
    (garde ? Promise.resolve(garde) : resoudreCam().then(function (id) {
      choisie = id; viser(id);
      return navigator.mediaDevices.getUserMedia(dur).catch(function () { return navigator.mediaDevices.getUserMedia(contraintes); }).catch(function (e) {
        if (!id) throw e;
        cfg.cam = ''; cfg.camLabel = ''; ecrireCfg(cfg); viser('');
        return navigator.mediaDevices.getUserMedia(contraintes).catch(function () { return navigator.mediaDevices.getUserMedia({ audio: contraintes.audio, video: true }); });
      });
    })).then(function (s) {
      flux = s; $('b-go').hidden = false; montrerPret(); $('fmt').hidden = !(cfg.choixFormat !== false) || testCam; majFormat(); $('cadrage').textContent = cfg.cadrage || ''; $('cadrage').hidden = !cfg.cadrage; $('v-src').srcObject = s; $('v-src').play().catch(function () {}); boucle = requestAnimationFrame(dessiner);
      grandAngle(s);
      camSuspecte = false; camEtat = 'ok'; tFige = Date.now(); brancherMicro(s); $('mic').hidden = false;
      clearTimeout(minuteurStable); minuteurStable = setTimeout(function () { essaisCam = 0; }, 30000);
      s.getVideoTracks().forEach(function (t) { t.onended = function () { perteCapteur('cam'); }; });
      s.getAudioTracks().forEach(function (t) { t.onended = function () { perteCapteur('mic'); }; });
      if (testCam) infoCamera(s);
      boutonCameraSuivante();
    }).catch(function (e) {
      camEtat = (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) ? 'refusee' : 'erreur';
      $('cam-err').textContent = testCam ? 'Impossible d’accéder à la caméra ou au micro. Autorisez-les dans les réglages de la tablette, puis réessayez.' : 'La caméra n’est pas disponible pour le moment.'; $('cam-err').hidden = false; $('b-go').hidden = true;
      setTimeout(function () { accueil(); }, 7000);
    });
  }
  /* ── test de la caméra : nom, résolution, zoom, guide de cadrage ── */
  var testCam = false;
  function infoCamera(s) {
    var tr = s.getVideoTracks()[0], st = tr.getSettings ? tr.getSettings() : {}, caps = tr.getCapabilities ? tr.getCapabilities() : {}, au = s.getAudioTracks()[0];
    var vv = $('v-src'), l = ['Caméra : ' + (tr.label || '(nom inconnu)'), 'Écran : ' + (paysage() ? 'paysage' : 'portrait') + ' (' + window.innerWidth + ' × ' + window.innerHeight + ') — image affichée : ' + vv.videoWidth + ' × ' + vv.videoHeight, 'Image reçue : ' + st.width + ' × ' + st.height + ' à ' + Math.round(st.frameRate || 0) + ' i/s',
      'Zoom : ' + (caps.zoom ? ('min ' + caps.zoom.min + ' · max ' + caps.zoom.max + ' · actuel ' + (st.zoom || '?')) : 'non réglable par le navigateur'),
      'Format enregistré : ' + (cfg.format === 'auto' || !cfg.format ? 'auto (' + (paysage() ? '16:9' : '9:16') + ')' : cfg.format),
      'Micro : ' + (au ? (au.label || '(nom inconnu)') : 'aucun')];
    navigator.mediaDevices.enumerateDevices().then(function (d) {
      l.push('Caméras disponibles : ' + d.filter(function (x) { return x.kind === 'videoinput'; }).map(function (x) { return x.label || '?'; }).join(' | '));
      $('cam-info').textContent = l.join('\n'); $('cam-info').hidden = false;
    });
    $('guide').hidden = false; $('b-go').hidden = true; $('cadrage').hidden = true; $('fmt').hidden = true;
  }
  $('a-camtest').onclick = function () { testCam = true; ouvrirCam(); };
  /* test de la caméra : bouton pour passer d'une caméra avant à l'autre (certaines tablettes en ont deux : normale et ultra grand-angle) ; le choix est mémorisé */
  function boutonCameraSuivante() {
    var b = $('cam-suiv'); if (!b) { b = document.createElement('button'); b.id = 'cam-suiv'; b.type = 'button'; b.style.cssText = 'position:absolute;z-index:9;left:50%;bottom:26px;transform:translateX(-50%);padding:14px 26px;border-radius:999px;border:0;background:#fff;color:#14304f;font:700 16px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.35)'; $('s-cam').appendChild(b); }
    b.hidden = !testCam; if (!testCam) return;
    b.textContent = 'Essayer l’autre caméra avant';
    b.onclick = function () {
      navigator.mediaDevices.enumerateDevices().then(function (d) {
        var l = d.filter(function (x) { return x.kind === 'videoinput' && !/back|arri/i.test(x.label || ''); });
        if (l.length < 2) { b.textContent = 'Une seule caméra avant sur cette tablette'; return; }
        var cur = (flux && flux.getVideoTracks()[0] && flux.getVideoTracks()[0].getSettings().deviceId) || cfg.cam, i = 0;
        l.forEach(function (x, k) { if (x.deviceId === cur) i = k; });
        memoCam(l[(i + 1) % l.length]); setTimeout(ouvrirCam, 400);
      }).catch(function () {});
    };
  }
  /* GRAND ANGLE : zoom au minimum, et caméra « ultra grand-angle » si la tablette en a une */
  /* la caméra choisie est retrouvée par son identifiant, sinon par son nom (« camera 2, facing front ») : les identifiants peuvent changer d'un démarrage à l'autre */
  function resoudreCam() {
    if (!cfg.cam && !cfg.camLabel) return Promise.resolve('');
    return navigator.mediaDevices.enumerateDevices().then(function (d) {
      var v = d.filter(function (x) { return x.kind === 'videoinput'; });
      var t = v.filter(function (x) { return x.deviceId === cfg.cam; })[0] || (cfg.camLabel ? v.filter(function (x) { return x.label === cfg.camLabel; })[0] : null);
      return t ? t.deviceId : '';
    }).catch(function () { return ''; });
  }
  function memoCam(x) { cfg.cam = x.deviceId; cfg.camLabel = x.label || ''; ecrireCfg(cfg); }
  var angleEssaye = false;
  function grandAngle(s) {
    try {
      var tr = s.getVideoTracks()[0], caps = tr && tr.getCapabilities ? tr.getCapabilities() : {};
      var larg = function () { try { var c2 = tr.getCapabilities ? tr.getCapabilities() : {}; if (c2.zoom && typeof c2.zoom.min === 'number') tr.applyConstraints({ zoom: c2.zoom.min }).catch(function () { tr.applyConstraints({ advanced: [{ zoom: c2.zoom.min }] }).catch(function () {}); }); } catch (e) {} };
      var pousser = function () { try { var c3 = tr.getCapabilities ? tr.getCapabilities() : {}; if (!(c3.zoom && c3.zoom.min < 1)) { [0.6, 0.5, 0.7].some(function (z) { tr.applyConstraints({ advanced: [{ zoom: z }] }).catch(function () {}); return false; }); } } catch (e) {} };
      larg(); pousser(); setTimeout(larg, 600); setTimeout(larg, 2000);   /* certaines tablettes n'acceptent le zoom qu'une fois la caméra lancée */
    } catch (e) {}
    if (angleEssaye || cfg.cam || !navigator.mediaDevices.enumerateDevices) return;
    angleEssaye = true;
    /* tablette à deux caméras avant : la dernière (ex. « camera 2 ») est l'ultra grand-angle ; on la choisit une fois pour toutes (modifiable dans Réglages › Caméra) */
    navigator.mediaDevices.enumerateDevices().then(function (d) {
      var cur = (s.getVideoTracks()[0].getSettings() || {}).deviceId;
      var avant = d.filter(function (x) { return x.kind === 'videoinput' && !/back|arri/i.test(x.label || ''); });
      var w = d.filter(function (x) { return x.kind === 'videoinput' && /ultra|wide|large|0\.5/i.test(x.label || ''); })[0] || (avant.length >= 2 ? avant[avant.length - 1] : null);
      if (w && w.deviceId !== cur) { memoCam(w); setTimeout(ouvrirCam, 500); }
    }).catch(function () {});
  }
  $('b-go').onclick = function () {
    if (!flux) return; $('fmt').hidden = true; $('cadrage').hidden = true; $('b-go').hidden = true; $('pret').hidden = true; $('compte').hidden = false; $('s-cam').classList.add('flou');
    $('compte-msg').textContent = 'Vous avez ' + dureeMax() + ' secondes maximum';
    var n = 3; $('compte-n').textContent = n; decompte = setInterval(function () { n--; if (n > 0) { $('compte-n').textContent = n; } else { clearInterval(decompte); decompte = null; $('compte').hidden = true; $('s-cam').classList.remove('flou'); demarrer(); } }, 1000);
  };
  /* qualité choisie sur la session : haute 3,5 Mbit/s, standard 2,5, économique 1,8 (vidéos plus légères, moins de stockage et de données mobiles) */
  function debitVideo() { return { eco: 3500000, haute: 9000000 }[cfg.qualite] || 6000000; }
  function demarrer() {
    morceaux = []; blobFinal = null; mime = meilleurMime(); niveauMax = 0;
    var flot = new MediaStream(cv.captureStream(30).getVideoTracks().concat(flux.getAudioTracks()));
    try { rec = mime ? new MediaRecorder(flot, { mimeType: mime, videoBitsPerSecond: debitVideo(), audioBitsPerSecond: 192000 }) : new MediaRecorder(flot); } catch (e) { rec = new MediaRecorder(flot); }
    mime = rec.mimeType || mime || 'video/webm';
    rec.ondataavailable = function (e) { if (e.data && e.data.size) morceaux.push(e.data); };
    rec.onstop = function () {
      enregistrement = false; clearInterval(minuteur);
      blobFinal = new Blob(morceaux, { type: mime.split(';')[0] });
      sonNiveau = Math.round(niveauMax * 100); var faible = sonNiveau < 3;
      $('son-alerte').hidden = !faible; $('son-alerte').textContent = faible ? 'On ne vous entend pas bien. Parlez un peu plus fort, plus près de la tablette, puis recommencez.' : ''; if (faible) nbSilence++;
      arreterCam(); revoir();
    };
    rec.start(1000); enregistrement = true; t0 = Date.now();
    var max = dureeMax(); if (questionsMode.length) majQuestion(0);
    $('rec').hidden = false; $('barre').hidden = false; $('b-stop').hidden = false; $('rec-max').textContent = '/ ' + fmt(max);
    minuteur = setInterval(function () {
      var s = (Date.now() - t0) / 1000; $('rec-t').textContent = fmt(s); $('barre-i').style.width = Math.min(100, s / max * 100) + '%'; if (questionsMode.length) majQuestion(s);
      if (s >= max) arreterRec();
    }, 200);
  }
  function arreterRec() { if (rec && rec.state !== 'inactive') rec.stop(); }
$('b-stop').onclick = arreterRec;
  /* croix : on abandonne la prise et on revient au formulaire, les champs restent remplis */
  $('b-x').onclick = function () {
    if (testCam) { testCam = false; $('guide').hidden = true; $('cam-info').hidden = true; if ($('cam-suiv')) $('cam-suiv').hidden = true; arreterCam(true); ouvrirAdmin(); return; }
    if (decompte) { clearInterval(decompte); decompte = null; }
    clearInterval(minuteur);
    if (rec && rec.state !== 'inactive') { rec.onstop = null; try { rec.stop(); } catch (e) {} }
    enregistrement = false; arreterCam(); morceaux = []; blobFinal = null; $('s-cam').classList.remove('flou');
    accueil();
  };

  /* ───────── revoir / terminer ───────── */
  var urlRevoir = null;
  function revoir() {
    try { if (urlRevoir) URL.revokeObjectURL(urlRevoir); } catch (e) {}
    $('rv-q').textContent = T('plaitT'); $('b-refaire').textContent = T('plaitNon'); $('b-fin').textContent = T('plaitOui');
    urlRevoir = URL.createObjectURL(blobFinal); $('v-revoir').src = urlRevoir; montrer('s-revoir'); $('v-revoir').play().catch(function () {});
  }
  $('b-refaire').onclick = function () { try { if (urlRevoir) URL.revokeObjectURL(urlRevoir); } catch (e) {} urlRevoir = null; blobFinal = null; ouvrirCam(); };
  /* « Oui, c'est parfait » : on demande alors les coordonnées */
  $('b-fin').onclick = function () { if (!blobFinal) return; montrer('s-form'); setTimeout(function () { $('f-prenom').focus(); }, 80); };
  /* ───────── QR code : l'invité scanne et récupère sa vidéo ───────── */
  function cleRecup() {
    try { var a = new Uint8Array(12); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); } catch (e) { return (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + '000000000000').slice(0, 20); }
  }
  function qrSvg(v) {
    var base = (cfg.serveur || location.origin).replace(/\/+$/, '');
    try { if (window.qrcode && v.rk) { var q = window.qrcode(0, 'M'); q.addData(base + '/api/videobooth/mv/' + v.id + '?k=' + v.rk); q.make(); return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } } catch (e) {}
    return '';
  }
  var minuteurMerci = null;
  function retourAccueilMerci() { clearTimeout(minuteurMerci); minuteurMerci = null; accueil(); }
  $('m-fin').onclick = retourAccueilMerci;

  /* ───────── livraison : QR code, e-mail, « l'envoyer à quelqu'un ? » ─────────
     La vidéo est gardée dans la tablette dès que le nom est saisi, mais ne part au serveur qu'au « Terminé » (ou après 10 minutes / à l'accueil si l'invité s'éloigne) :
     on sait alors à quelles adresses l'envoyer. Rien ne se perd si l'invité part sans rien faire. */
  var videoEnCours = null, choix = { qr: false, mail: false, autre: false };
  function nomFichier() {
    var net = function (x) { return x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); };
    var d = new Date(), j = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + '_' + ('0' + d.getHours()).slice(-2) + 'h' + ('0' + d.getMinutes()).slice(-2);
    return net(invite.nom) + '_' + net(invite.prenom) + '_' + j + (/mp4/.test(blobFinal.type) ? '.mp4' : '.webm');
  }
  function basculer(el, on) { el.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  function majPanneaux() {
    $('p-qr').hidden = !choix.qr; $('p-mail').hidden = !choix.mail; $('p-autre').hidden = !choix.autre;
    basculer($('l-qr'), choix.qr); basculer($('l-mail'), choix.mail);
    $('l-oui').classList.toggle('on', choix.autre); $('l-non').classList.toggle('on', !choix.autre);
    $('l-oui').setAttribute('aria-checked', choix.autre ? 'true' : 'false'); $('l-non').setAttribute('aria-checked', choix.autre ? 'false' : 'true');
    $('l-err').textContent = ''; $('l-conf').hidden = true; $('l-fin').hidden = false; confirmeAdresse = false;
  }
  function ouvrirLivraison() {
    if (!blobFinal || !invite) return;
    var bt = $('f-suite'); bt.disabled = true;
    var v = { id: 'v' + Date.now() + Math.random().toString(36).slice(2, 7), rk: cleRecup(), event: cfg.event, nom: invite.nom, prenom: invite.prenom, email: '', consent: true,
      son: sonNiveau, pour: 'moi', dest: '', fichier: nomFichier(), type: blobFinal.type, duree: Math.round((Date.now() - t0) / 1000), cree: new Date().toISOString(), essais: 0, mode: mode, qs: questionsMode.slice(), retenue: true, blob: blobFinal };
    ajouter(v).then(function () {
      try { if (urlRevoir) URL.revokeObjectURL(urlRevoir); } catch (e) {} urlRevoir = null; blobFinal = null; invite = null; bt.disabled = false;
      videoEnCours = v; choix = { qr: false, mail: false, autre: false };
      $('l-email').value = ''; $('l-dest').value = ''; $('l-email2').value = '';
      $('l-titre').textContent = T('livT'); $('l-info').textContent = cfg.merciOrga || ORGA[cfg.type] || ORGA.autre;
      /* phrase « les organisateurs recevront toutes les vidéos » : réglable par événement ; sans réglage, absente pour un événement d'entreprise */
      $('l-info').hidden = !(cfg.orgaOn == null ? cfg.type !== 'entreprise' : cfg.orgaOn);
      $('l-qr-t').textContent = T('livQr'); $('l-qr-d').textContent = T('livQrT'); $('l-mail-t').textContent = T('livMail'); $('l-mail-d').textContent = T('livMailT');
      $('l-autre-q').textContent = T('livAutreQ'); $('l-oui').textContent = T('livOui'); $('l-non').textContent = T('livNon'); $('l-prenom-d').textContent = T('livPrenom'); $('l-email2-d').textContent = T('livEmail2'); $('l-fin').textContent = T('livFin');
      var svg = qrSvg(v); $('l-qr-img').innerHTML = svg; $('l-qr').hidden = !svg; $('l-mail').parentNode.style.gridTemplateColumns = svg ? '' : '1fr';
      majPanneaux(); montrer('s-livraison'); $('s-livraison').scrollTop = 0;
    }).catch(function () { bt.disabled = false; alert('La vidéo n’a pas pu être enregistrée : la mémoire de la tablette est pleine. Prévenez l’équipe.'); });
  }
  function libererEnAttente() {
    var v = videoEnCours; if (!v) return; videoEnCours = null; v.retenue = false;
    ajouter(v).then(function () { synchro(); }).catch(function () {});
  }
  $('l-qr').onclick = function () { choix.qr = !choix.qr; majPanneaux(); };
  $('l-mail').onclick = function () { choix.mail = !choix.mail; majPanneaux(); if (choix.mail) setTimeout(function () { $('l-email').focus(); }, 80); };
  $('l-oui').onclick = function () { choix.autre = true; majPanneaux(); setTimeout(function () { $('l-dest').focus(); }, 80); };
  $('l-non').onclick = function () { choix.autre = false; majPanneaux(); };
  $('l-fin').onclick = function () {
    var v = videoEnCours; if (!v) return accueil();
    var ok = function (x) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x); };
    var email = choix.mail ? $('l-email').value.trim() : '', e2 = choix.autre ? $('l-email2').value.trim() : '', d2 = choix.autre ? $('l-dest').value.trim() : '';
    var err = function (m) { $('l-err').textContent = m; };
    if (choix.mail && !ok(email)) return err('Cette adresse e-mail ne semble pas valide.');
    if (choix.autre && !d2) return err('Indiquez le prénom de la personne, ou choisissez « ' + T('livNon') + ' ».');
    if (choix.autre && !ok(e2)) return err('L’adresse e-mail de cette personne ne semble pas valide.');
    /* l'adresse de l'invité reste l'adresse principale ; s'il n'a donné que celle d'une autre personne, c'est elle qui devient principale */
    if (email) { v.email = email; v.pour = 'moi'; if (e2) { v.plusEmail = e2; v.plusDest = d2; } } else if (e2) { v.email = e2; v.pour = 'autre'; v.dest = d2; }
    /* une adresse mal tapée enverrait la vidéo à un inconnu : on la fait relire avant d'envoyer */
    var adresses = []; if (email) adresses.push(email); if (e2) adresses.push(e2);
    if (adresses.length && !confirmeAdresse) { $('l-conf-a').textContent = adresses.join('\n'); $('l-conf').hidden = false; $('l-fin').hidden = true; $('l-conf-ok').focus(); return; }
    confirmeAdresse = false; $('l-conf').hidden = true; $('l-fin').hidden = false;
    v.retenue = false; videoEnCours = null; $('l-fin').disabled = true;
    ajouter(v).then(function () { $('l-fin').disabled = false; synchro(); afficherMerci(v); }).catch(function () { $('l-fin').disabled = false; videoEnCours = v; err('Enregistrement impossible : prévenez l’équipe.'); });
  };
  var confirmeAdresse = false;
  $('l-conf-ok').onclick = function () { confirmeAdresse = true; $('l-fin').click(); };
  $('l-conf-non').onclick = function () { confirmeAdresse = false; $('l-conf').hidden = true; $('l-fin').hidden = false; var c = choix.mail ? $('l-email') : $('l-email2'); setTimeout(function () { c.focus(); }, 60); };
  function afficherMerci(v) {
    $('m-titre').textContent = T('merciT'); $('m-txt').textContent = T('merciD');
    /* adresses partiellement masquées : l'écran peut être lu par la personne suivante */
    var cache = function (e) { var i = e.indexOf('@'); return i > 2 ? e.slice(0, 2) + '•••' + e.slice(i) : e; };
    var l = []; if (v.email && v.pour === 'moi') l.push('Vous : ' + cache(v.email)); if (v.plusEmail) l.push((v.plusDest || 'Autre personne') + ' : ' + cache(v.plusEmail)); if (v.email && v.pour === 'autre') l.push((v.dest || 'Autre personne') + ' : ' + cache(v.email));
    $('m-mails').textContent = l.length ? 'La vidéo est envoyée par e-mail à :\n' + l.join('\n') : ''; $('m-mails').hidden = !l.length; $('m-sup').hidden = !l.length;
    montrer('s-merci'); clearTimeout(minuteurMerci); minuteurMerci = setTimeout(retourAccueilMerci, 5000);
  }

  /* ───────── envoi au serveur ───────── */
  var envoiEnCours = false, dernierMsg = ''; try { dernierMsg = localStorage.getItem('vb-err') || ''; } catch (e) {}
  function noterMsg(m) { dernierMsg = m; try { localStorage.setItem('vb-err', m); } catch (e) {} }
  function majEtat() {
    toutes().then(function (l) {
      var att = l.filter(function (v) { return !v.envoye; }).length, tot = l.length;
      var txt = att ? (att + ' vidéo' + (att > 1 ? 's' : '') + ' en attente d’envoi') : (tot ? 'Toutes les vidéos sont envoyées' : '');
      
      $('a-file').textContent = ((cfg.jeton || cfg.cle) ? '' : '⚠ Aucune session ouverte : les vidéos restent sur la tablette. ') + tot + ' vidéo(s) gardée(s) sur la tablette, dont ' + (tot - att) + ' envoyée(s)' + (att ? ' — ' + att + ' en attente' : '') + (dernierMsg ? ' — ' + dernierMsg : '');
    }).catch(function () {});
  }
  /* ── aucune vidéo n'est jamais effacée de la tablette : elles y restent toutes, même une fois envoyées.
        C'est vous qui videz la tablette quand vous le décidez. ── */
  function liberer() { return Promise.resolve(0); }
  var TAILLE = 3 * 1024 * 1024;
  function envoyer(v) {
    var base = (cfg.serveur || location.origin).replace(/\/+$/, '');
    var n = Math.max(1, Math.ceil(v.blob.size / TAILLE)), i = 0, dernier = {};
    function suite() {
      var q = new URLSearchParams({ id: v.id, i: i, n: n, fichier: v.fichier, type: v.type || '', nom: v.nom, prenom: v.prenom, email: v.email || '', plusEmail: v.plusEmail || '', plusDest: v.plusDest || '', event: v.event || '', duree: v.duree || 0, son: (v.son == null ? '' : v.son), pour: v.pour || 'moi', dest: v.dest || '', rk: v.rk || '', mode: v.mode || 'video', qs: (v.qs || []).join('|') });
      return fetch(base + '/api/videobooth/chunk?' + q.toString(), { method: 'POST', headers: ent({ 'x-appareil': (cfg.jeton || cfg.cle), 'content-type': 'application/octet-stream' }), body: v.blob.slice(i * TAILLE, (i + 1) * TAILLE) }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok || j.ok === false) throw new Error(j.erreur || ('Serveur : ' + r.status));
          dernier = j; i++; return i < n ? suite() : dernier;
        });
      });
    }
    return suite();
  }
  function synchro() {
    if (envoiEnCours || !(cfg.jeton || cfg.cle) || !navigator.onLine) { majEtat(); return Promise.resolve(); }
    envoiEnCours = true;
    return toutes().then(function (l) {
      l = l.filter(function (v) { return !v.envoye && (!v.retenue || Date.now() - Date.parse(v.cree) > 600000); }).sort(function (a, b) { return a.cree < b.cree ? -1 : 1; });
      var suite = Promise.resolve();
      l.forEach(function (v) {
        suite = suite.then(function () {
          return envoyer(v).then(function (rep) { noterMsg((rep && rep.mail === false) ? 'vidéo reçue par le site, mais e-mail non parti : ' + (rep.mailErreur || '') : ''); v.envoye = true; v.envoyeLe = new Date().toISOString(); v.mail = !(rep && rep.mail === false); return ajouter(v); }).catch(function (e) { noterMsg('envoi impossible (' + (e.message || 'réseau') + '), nouvel essai automatique'); v.essais = (v.essais || 0) + 1; return ajouter(v); });
        });
      });
      return suite;
    }).then(function () { envoiEnCours = false; return liberer(false); }).then(function () { majEtat(); }, function () { envoiEnCours = false; });
  }
  /* ── état de la tablette, envoyé toutes les 2 minutes au back-office (batterie, vidéos en attente, caméra, micro, place) ── */
  function battement() {
    if (!(cfg.jeton || cfg.cle)) return;
    var etat = { cam: camEtat, mic: micEtat, ver: 41, pinUsine: cfg.pin === PIN_USINE, enreg: !!enregistrement, reco: nbReco, mut: nbSilence };
    var fin = function () {
      toutes().then(function (l) { etat.att = l.filter(function (v) { return !v.envoye; }).length; etat.tot = l.length; }).catch(function () {}).then(function () {
        return (navigator.storage && navigator.storage.estimate) ? navigator.storage.estimate().then(function (e) { etat.usage = e.usage || 0; etat.quota = e.quota || 0; }).catch(function () {}) : null;
      }).then(function () {
        return fetch(baseApi() + '/api/videobooth/etat', { method: 'POST', headers: ent({ 'x-appareil': (cfg.jeton || cfg.cle), 'content-type': 'application/json' }), body: JSON.stringify(etat) }).catch(function () {});
      });
    };
    if (navigator.getBattery) navigator.getBattery().then(function (b) { etat.batt = Math.round(b.level * 100); etat.charge = !!b.charging; fin(); }).catch(fin); else fin();
  }
  /* état renvoyé toutes les minutes, dès que la page redevient visible, dès que le réseau revient et après chaque envoi : le back-office reste à jour */
  setInterval(battement, 60000); setTimeout(battement, 5000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(battement, 800); });
  window.addEventListener('online', function () { setTimeout(battement, 1500); });
  /* e-mails non partis : une relance douce quand la tablette se rallume (au plus une toutes les 6 h, jamais en boucle ; le serveur limite aussi à 3 essais par vidéo) */
  var derniereAction = Date.now(); document.addEventListener('pointerdown', function () { derniereAction = Date.now(); }, true);
  function relanceMails() {
    if (!(cfg.jeton || cfg.cle)) return;
    /* on attend un moment calme : personne n'est en train de filmer, aucun envoi en cours, personne n'a touché l'écran depuis 2 minutes */
    if (enregistrement || envoiEnCours || Date.now() - derniereAction < 120000) { setTimeout(relanceMails, 120000); return; }
    var der = 0; try { der = +localStorage.getItem('vb-relance') || 0; } catch (e) {}
    if (Date.now() - der < 6 * 3600 * 1000) return;
    try { localStorage.setItem('vb-relance', String(Date.now())); } catch (e) {}
    fetch(baseApi() + '/api/videobooth/relance', { method: 'POST', headers: ent({ 'x-appareil': (cfg.jeton || cfg.cle) }) }).catch(function () {});
  }
  setTimeout(relanceMails, 60000); setInterval(relanceMails, 30 * 60000);
  setInterval(synchro, 20000); window.addEventListener('online', synchro);
  setTimeout(function () { liberer(false).then(majEtat); }, 4000);

  /* ───────── réglages (code d'accès) ───────── */
  var pressions = 0, tPress = 0, modePin = 'verifier';
  $('cadenas').onclick = demanderPin;
  function demanderPin() {
    modePin = 'verifier'; $('pin-t').textContent = 'Code d’accès'; $('pin-in').value = ''; $('pin-err').textContent = ''; montrer('s-pin'); setTimeout(function () { $('pin-in').focus(); }, 80);
  }
  $('pin-x').onclick = accueil;
  /* code des réglages : il protège l'export de toutes les vidéos. Après 5 erreurs, la tablette se bloque 1 minute, puis 2, 4, 8… (jusqu'à 30 min),
     même si on recharge la page. Le code se change dans les réglages ; le back-office signale une tablette qui garde le code d'usine. */
  var PIN_USINE = '0104', pinNouveau = '';
  function lirePinEssais() { try { return JSON.parse(localStorage.getItem('vb-pin-essais') || '{}') || {}; } catch (e) { return {}; } }
  function ecrirePinEssais(o) { try { localStorage.setItem('vb-pin-essais', JSON.stringify(o)); } catch (e) {} }
  $('pin-ok').onclick = function () {
    var v = $('pin-in').value.trim(), e = lirePinEssais();
    if (modePin === 'creer') {
      if (!/^\d{4,12}$/.test(v)) return ($('pin-err').textContent = 'De 4 à 12 chiffres.');
      pinNouveau = v; modePin = 'confirmer'; $('pin-t').textContent = 'Confirmez le nouveau code'; $('pin-in').value = ''; $('pin-err').textContent = ''; return;
    }
    if (modePin === 'confirmer') {
      if (v !== pinNouveau) { modePin = 'creer'; $('pin-t').textContent = 'Nouveau code'; $('pin-in').value = ''; return ($('pin-err').textContent = 'Les deux codes sont différents : recommencez.'); }
      cfg.pin = v; ecrireCfg(cfg); pinNouveau = ''; battement(); return ouvrirAdmin();
    }
    if (e.jusqua && Date.now() < e.jusqua) return ($('pin-err').textContent = 'Trop d’erreurs : réessayez dans ' + Math.ceil((e.jusqua - Date.now()) / 60000) + ' min.');
    if (v === cfg.pin) { ecrirePinEssais({}); return ouvrirAdmin(); }
    e.n = (e.n || 0) + 1;
    if (e.n >= 5) e.jusqua = Date.now() + Math.min(30, Math.pow(2, e.n - 5)) * 60000;
    ecrirePinEssais(e); $('pin-in').value = '';
    $('pin-err').textContent = e.jusqua && Date.now() < e.jusqua ? 'Code incorrect. Trop d’erreurs : tablette bloquée ' + Math.ceil((e.jusqua - Date.now()) / 60000) + ' min.' : 'Code incorrect.';
  };
  $('a-pin').onclick = function () { modePin = 'creer'; pinNouveau = ''; $('pin-t').textContent = 'Nouveau code'; $('pin-in').value = ''; $('pin-err').textContent = ''; montrer('s-pin'); setTimeout(function () { $('pin-in').focus(); }, 80); };
  $('pin-in').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('pin-ok').click(); });
  /* ── décor de Noël : sapins et guirlandes fixes (rien ne bouge) ── */
  (function () {
    var cols = ['#F59E0B', '#ffffff', '#e8564a', '#7cc4f2'];
    /* guirlande : un fil en arcs, des douilles accrochées au fil, des ampoules allumées qui scintillent doucement */
    var guirlande = (function () {
      var H0 = 6, CY = 40, fil = 'M-10,' + H0, amp = '', k = 0;   /* motif sur 1600 de large, 54 de haut : tout reste visible, quelle que soit la largeur de l'écran */
      var pt = function (x0, t) { var u = 1 - t; return [x0 + 90 * t, u * u * H0 + 2 * u * t * CY + t * t * H0]; };
      for (var x = -10; x < 1620; x += 90) {
        fil += ' Q' + (x + 45) + ',' + CY + ' ' + (x + 90) + ',' + H0;
        [0.2, 0.5, 0.8].forEach(function (t) {
          var q = pt(x, t), c = cols[k % 4], d = ((k * 0.37) % 2.4).toFixed(2), du = (1.7 + (k % 3) * 0.45).toFixed(2);
          amp += '<g class="amp" style="animation-delay:-' + d + 's;animation-duration:' + du + 's">' +
            '<circle cx="' + q[0].toFixed(1) + '" cy="' + (q[1] + 11).toFixed(1) + '" r="11" fill="' + c + '" opacity=".28"/>' +
            '<rect x="' + (q[0] - 2.4).toFixed(1) + '" y="' + (q[1] - 0.5).toFixed(1) + '" width="4.8" height="5.5" rx="1" fill="#b9954a"/>' +
            '<path d="M' + (q[0] - 4.2).toFixed(1) + ',' + (q[1] + 5).toFixed(1) + ' Q' + (q[0] - 5.2).toFixed(1) + ',' + (q[1] + 16).toFixed(1) + ' ' + q[0].toFixed(1) + ',' + (q[1] + 17.5).toFixed(1) + ' Q' + (q[0] + 5.2).toFixed(1) + ',' + (q[1] + 16).toFixed(1) + ' ' + (q[0] + 4.2).toFixed(1) + ',' + (q[1] + 5).toFixed(1) + ' Z" fill="' + c + '"/>' +
            '<ellipse cx="' + (q[0] - 1.4).toFixed(1) + '" cy="' + (q[1] + 9).toFixed(1) + '" rx="1.1" ry="2.4" fill="#fff" opacity=".7"/></g>';
          k++;
        });
      }
      return '<svg viewBox="0 0 1600 54" preserveAspectRatio="xMidYMin slice" width="100%" height="100%"><path d="' + fil + '" fill="none" stroke="#3f9a6c" stroke-width="2.4" stroke-linecap="round"/>' + amp + '</svg>';
    })();
    function sapin(x, h, id) {
      var w = h * 0.62, y0 = 118, lum = '';
      var pts = [[0.28, -0.12], [0.52, 0.1], [0.74, -0.08], [0.4, 0.14], [0.62, -0.22], [0.5, 0.02]];
      pts.forEach(function (q, i) { lum += '<circle cx="' + (x + (q[1] * w)) + '" cy="' + (y0 - h * (1 - q[0]) - 0) + '" r="2.4" fill="' + cols[(i + id) % 4] + '"/>'; });
      return '<g><rect x="' + (x - w * 0.05) + '" y="' + (y0 - h * 0.1) + '" width="' + (w * 0.1) + '" height="' + (h * 0.1) + '" fill="#6b4a2f"/>' +
        '<polygon points="' + x + ',' + (y0 - h) + ' ' + (x + w * 0.3) + ',' + (y0 - h * 0.62) + ' ' + (x - w * 0.3) + ',' + (y0 - h * 0.62) + '" fill="#2f8a5b"/>' +
        '<polygon points="' + x + ',' + (y0 - h * 0.8) + ' ' + (x + w * 0.4) + ',' + (y0 - h * 0.32) + ' ' + (x - w * 0.4) + ',' + (y0 - h * 0.32) + '" fill="#278253"/>' +
        '<polygon points="' + x + ',' + (y0 - h * 0.55) + ' ' + (x + w * 0.5) + ',' + (y0 - h * 0.1) + ' ' + (x - w * 0.5) + ',' + (y0 - h * 0.1) + '" fill="#1f6f47"/>' + lum +
        '<polygon points="' + x + ',' + (y0 - h - 7) + ' ' + (x + 2.6) + ',' + (y0 - h - 1.5) + ' ' + (x + 8) + ',' + (y0 - h - 1.5) + ' ' + (x + 3.6) + ',' + (y0 - h + 2) + ' ' + (x + 5.4) + ',' + (y0 - h + 8) + ' ' + x + ',' + (y0 - h + 4.5) + ' ' + (x - 5.4) + ',' + (y0 - h + 8) + ' ' + (x - 3.6) + ',' + (y0 - h + 2) + ' ' + (x - 8) + ',' + (y0 - h - 1.5) + ' ' + (x - 2.6) + ',' + (y0 - h - 1.5) + '" fill="#F59E0B"/></g>';
    }
    var arbres = '', hs = [70, 96, 58, 84, 104, 62, 90, 72, 100, 64], k;
    for (k = 0; k < 10; k++) arbres += sapin(40 + k * 80, hs[k], k);
    var sol = '<svg viewBox="0 0 800 120" preserveAspectRatio="xMidYMax meet" width="100%" height="100%"><rect x="0" y="116" width="800" height="4" rx="2" fill="#ffffff55"/>' + arbres + '</svg>';
    Array.prototype.forEach.call(document.querySelectorAll('.noel-haut'), function (n) { n.innerHTML = guirlande; });
    Array.prototype.forEach.call(document.querySelectorAll('.noel-bas'), function (n) { n.innerHTML = sol; });
  })();

  /* ── événements : cartes, réglages de chacun, un seul « en cours » ── */
  function nouvelId() { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function evts() {
    if (!Array.isArray(cfg.events)) cfg.events = [];
    if (!cfg.events.length && cfg.event) { var id = nouvelId(); cfg.events.push({ id: id, nom: cfg.event, date: '', titre: cfg.titre, sous: cfg.sous, max: cfg.max, cam: cfg.cam }); cfg.actif = id; ecrireCfg(cfg); }
    return cfg.events;
  }
  function appliquerActif() {
    var s = cfg.session || null;
    cfg.event = s ? (s.label || s.nom || '') : '';
    cfg.titre = (s && s.titre) || CFG0.titre; cfg.sous = s ? (s.sous || '') : CFG0.sous; cfg.max = (s && Number(s.max)) || 30;
    cfg.ori = (s && s.ori) || 'auto'; cfg.police = (s && s.police) || 'elegante'; cfg.amb = (s && s.amb) || 'blanc'; cfg.fond = (s && s.fond) || ''; cfg.accent = (s && s.accent) || ''; cfg.textes = (s && s.textes) || {}; appliquerTheme(); appliquerOrientation();
    $('f-ok-txt').textContent = 'L’adresse e-mail sert uniquement à vous envoyer la vidéo. Tout est supprimé ' + ((s && s.conserv) || 30) + ' jours après l’événement.';
    cfg.type = (s && s.type) || 'autre'; cfg.modeQ = !!(s && s.modeQ); cfg.modeP = !!(s && s.modeP); cfg.heureP = (s && s.heureP) || '23:00'; cfg.qs = (s && s.qs) || []; cfg.qp = (s && s.qp) || []; cfg.secQ = (s && Number(s.secQ)) || 0; cfg.merciOrga = (s && s.merciOrga) || ''; cfg.orgaOn = s && (s.orgaOn === true || s.orgaOn === false) ? s.orgaOn : null;
    cfg.noel = !!(s && s.noel); cfg.format = (s && s.format) || 'auto';
    cfg.qui = (s && s.qui) || ''; cfg.quiSous = s ? (s.quiSous == null || s.quiSous === '' ? null : s.quiSous) : null; cfg.qualite = (s && s.qualite) || 'standard'; cfg.garde = (s && Number(s.garde)) || 14; cfg.choixFormat = !s || s.choixFormat !== false;
    cfg.cadrage = (s && s.cadrage != null && s.cadrage !== '') ? s.cadrage : (s ? '' : 'Vous pouvez incliner doucement la tablette pour vous cadrer');
    document.body.classList.toggle('noel-on', cfg.noel); majFormat();
    ecrireCfg(cfg);
  }
  var edite = null;
  function rendreCartes() {
    var s = cfg.session; $('a-sess').textContent = s ? (s.label || s.nom) : 'Aucune session ouverte';
    var remplir = function (sel, genre, courant) {
      sel.innerHTML = '<option value="">' + (genre === 'videoinput' ? 'Caméra avant (par défaut)' : 'Micro de la tablette (par défaut)') + '</option>';
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      navigator.mediaDevices.enumerateDevices().then(function (d) { d.filter(function (x) { return x.kind === genre; }).forEach(function (x, i) { var o = document.createElement('option'); o.value = x.deviceId; o.textContent = x.label || ((genre === 'videoinput' ? 'Caméra ' : 'Micro ') + (i + 1)); if (x.deviceId === courant) o.selected = true; sel.appendChild(o); }); }).catch(function () {});
    };
    remplir($('a-cam'), 'videoinput', cfg.cam); remplir($('a-mic'), 'audioinput', cfg.mic);
  }
  function majStock() {
    var el = $('a-stock'); if (!el) return;
    var ligne = function (u, q, p) { return 'Stockage utilisé : ' + (u / 1048576 >= 1024 ? (u / 1073741824).toFixed(2) + ' Go' : Math.round(u / 1048576) + ' Mo') + (q ? ' sur ' + Math.round(q / 1073741824) + ' Go disponibles' : '') + ' · stockage protégé contre l’effacement automatique : ' + (p ? 'oui' : 'non (ne videz jamais les données de Chrome)'); };
    if (!navigator.storage || !navigator.storage.estimate) { el.textContent = 'Stockage : information indisponible.'; return; }
    Promise.all([navigator.storage.estimate(), navigator.storage.persisted ? navigator.storage.persisted() : false]).then(function (r) { el.textContent = ligne(r[0].usage || 0, r[0].quota || 0, r[1]); }).catch(function () {});
  }
  $('a-exp-cfg').onclick = function () {
    var copie = JSON.stringify({ vespraVideobooth: 1, exporteLe: new Date().toISOString(), cfg: cfg }, null, 1);
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([copie], { type: 'application/json' })); a.download = 'reglages-videobooth.json'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2500);
  };
  $('a-imp-cfg').onchange = function () {
    var f = this.files && this.files[0]; if (!f) return; var self = this;
    var r = new FileReader();
    r.onload = function () {
      try {
        var j = JSON.parse(r.result); if (!j || !j.vespraVideobooth || !j.cfg || !Array.isArray(j.cfg.events)) throw new Error('fichier non reconnu');
        if (!confirm('Remplacer les réglages actuels (' + (cfg.events || []).length + ' événement(s)) par ceux du fichier (' + j.cfg.events.length + ' événement(s)) ? Les vidéos de la tablette ne sont pas touchées.')) return;
        cfg = Object.assign({}, CFG0, j.cfg); if (!cfg.cle) cfg.cle = ''; ecrireCfg(cfg); appliquerActif(); ouvrirAdmin();
      } catch (e) { alert('Import impossible : ' + e.message); }
      self.value = '';
    };
    r.readAsText(f);
  };
  function ouvrirAdmin() {
    $('a-serveur').value = cfg.serveur;
    $('a-pin-m').textContent = 'Ce code protège les réglages et l’export des vidéos. Après 5 erreurs, la tablette se bloque quelques minutes.';
    $('adm-edit').hidden = true; $('adm-liste').hidden = false; rendreCartes(); majEtat(); majStock(); montrer('s-admin');
  }
  function ouvrirEdition(id) {
    var e = evts().filter(function (x) { return x.id === id; })[0]; if (!e) return; edite = e;
    $('e-nom').value = e.nom; $('e-noel').checked = !!e.noel; $('e-cadrage').value = e.cadrage == null ? '' : e.cadrage; $('e-format').value = (e.fmtV === 2 && e.format) || 'auto'; $('e-date').value = e.date || ''; $('e-titre').value = e.titre || ''; $('e-sous').value = e.sous || ''; $('e-max').value = e.max || 30;
    var sel = $('e-cam'); sel.innerHTML = '<option value="">Caméra avant (par défaut)</option>';
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) navigator.mediaDevices.enumerateDevices().then(function (d) { d.filter(function (x) { return x.kind === 'videoinput'; }).forEach(function (x, i) { var o = document.createElement('option'); o.value = x.deviceId; o.textContent = x.label || ('Caméra ' + (i + 1)); if (x.deviceId === e.cam) o.selected = true; sel.appendChild(o); }); }).catch(function () {});
    var sm = $('e-mic'); sm.innerHTML = '<option value="">Micro de la tablette (par défaut)</option>';
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) navigator.mediaDevices.enumerateDevices().then(function (d) { d.filter(function (x) { return x.kind === 'audioinput'; }).forEach(function (x, i) { var o = document.createElement('option'); o.value = x.deviceId; o.textContent = x.label || ('Micro ' + (i + 1)); if (x.deviceId === e.mic) o.selected = true; sm.appendChild(o); }); }).catch(function () {});
    $('e-titre-h').textContent = e.nom || 'Nouvel événement';
    $('e-actif').textContent = e.id === cfg.actif ? 'Enregistrer et fermer' : 'Utiliser cet événement';
    $('adm-liste').hidden = true; $('adm-edit').hidden = false;
  }
  function lireEdition() {
    if (!edite) return;
    edite.nom = $('e-nom').value.trim(); edite.date = $('e-date').value.trim(); edite.titre = $('e-titre').value.trim() || CFG0.titre; edite.sous = $('e-sous').value.trim();
    edite.max = Math.min(120, Math.max(5, Number($('e-max').value) || 30)); edite.cam = $('e-cam').value; edite.noel = $('e-noel').checked; edite.cadrage = $('e-cadrage').value.trim(); edite.format = $('e-format').value; edite.fmtV = 2; edite.mic = $('e-mic').value;
  }
  function sauverConnexion() { cfg.serveur = $('a-serveur').value.trim(); cfg.cam = $('a-cam').value; cfg.camLabel = $('a-cam').selectedOptions && $('a-cam').selectedOptions[0] && $('a-cam').value ? $('a-cam').selectedOptions[0].textContent : ''; cfg.mic = $('a-mic').value; ecrireCfg(cfg); }
  $('a-serveur').onchange = $('a-cam').onchange = $('a-mic').onchange = sauverConnexion;
  /* mise à jour de l'application Android sans la retélécharger : le site garde la dernière version, l'application la récupère elle-même */
  try {
    if (window.VespraAndroid && window.VespraAndroid.majApk) {
      var verInstallee = Number(window.VespraAndroid.versionApk()) || 0;
      $('a-ver').textContent = 'Version installée : ' + verInstallee + '. Les écrans du vidéobooth se mettent à jour tout seuls ; ce bouton sert quand l’application elle-même change.';
      $('a-maj').onclick = function () {
        $('a-ver').textContent = 'Recherche d’une mise à jour…';
        fetch(baseApi() + '/api/appli/version', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
          if (!j || !j.code) { $('a-ver').textContent = 'Impossible de savoir si une mise à jour existe. Réessayez.'; return; }
          if (j.code <= verInstallee) { $('a-ver').textContent = 'L’application est à jour (version ' + (j.nom || j.code) + ').'; return; }
          if (confirm('Installer la version ' + (j.nom || j.code) + ' ?\n\nVos réglages et vos vidéos sont conservés. Android va demander de confirmer.')) { $('a-ver').textContent = 'Mise à jour en cours…'; window.VespraAndroid.majApk(baseApi() + '/api/appli/apk'); }
          else $('a-ver').textContent = 'Version installée : ' + verInstallee + '.';
        }).catch(function () { $('a-ver').textContent = 'Réseau indisponible. Réessayez.'; });
      };
    }
  } catch (e) {}
  try { if (window.VespraAndroid && window.VespraAndroid.quitter) { $('adm-quitter').hidden = false; $('a-quitter').onclick = function () { if (confirm('Quitter le vidéobooth ?')) window.VespraAndroid.quitter(); }; } } catch (e) {}
  $('a-close').onclick = function () { sauverConnexion(); appliquerActif(); accueil(); synchro(); };
  $('e-retour').onclick = function () { lireEdition(); appliquerActif(); ouvrirAdmin(); };
  $('e-ok').onclick = function () { lireEdition(); appliquerActif(); ouvrirAdmin(); };
  $('e-actif').onclick = function () { lireEdition(); cfg.actif = edite.id; appliquerActif(); sauverConnexion(); accueil(); synchro(); };
  $('e-sup').onclick = function () {
    if (!edite || !confirm('Supprimer cet événement des réglages ? (les vidéos déjà enregistrées ne sont pas supprimées)')) return;
    cfg.events = cfg.events.filter(function (x) { return x.id !== edite.id; }); if (cfg.actif === edite.id) cfg.actif = cfg.events[0] ? cfg.events[0].id : '';
    edite = null; appliquerActif(); ouvrirAdmin();
  };
  $('a-sync').onclick = function () {
    if (!(cfg.jeton || cfg.cle)) { noterMsg('aucune session ouverte : ouvrez une session pour envoyer'); return majEtat(); }
    noterMsg('envoi en cours…'); majEtat(); synchro().then(function () { if (dernierMsg === 'envoi en cours…') noterMsg(''); majEtat(); });
  };
  $('a-test').onclick = function () {
    var base = ($('a-serveur').value.trim() || location.origin).replace(/\/+$/, ''), cle = (cfg.jeton || cfg.cle || '');
    $('a-test-r').textContent = 'Test en cours…';
    fetch(base + '/api/videobooth/ping', { headers: ent({ 'x-appareil': cle }) }).then(function (r) { return r.json().catch(function () { return { ok: false, erreur: 'Réponse inattendue (' + r.status + ')' }; }); }).then(function (j) {
      $('a-test-r').textContent = j.ok ? ('✓ Connexion OK' + (j.resend ? '' : ' — mais l’envoi d’e-mail n’est pas configuré (RESEND_API_KEY manquante)')) : ('✗ ' + (j.erreur || 'échec'));
    }).catch(function (e) { $('a-test-r').textContent = '✗ Serveur injoignable : ' + (e.message || 'réseau'); });
  };
  $('a-export').onclick = function () {
    toutes().then(function (l) {
      if (!l.length) return alert('Aucune vidéo en attente.');
      var csv = ['fichier;prenom;nom;email;evenement;date'].concat(l.map(function (v) { return [v.fichier, v.prenom, v.nom, v.email, v.event, v.cree].map(function (x) { return '"' + String(x || '').replace(/"/g, '""') + '"'; }).join(';'); })).join('\r\n');
      var tel = function (blob, nom) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nom; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); };
      tel(new Blob(['﻿' + csv], { type: 'text/csv' }), 'contacts-videobooth.csv');
      l.forEach(function (v, i) { setTimeout(function () { tel(v.blob, v.fichier); }, 600 * (i + 1)); });
    });
  };

  /* ───────── l'appli reste dans son monde : le bouton « retour » de la tablette ne mène jamais au site ─────────
     On met un état d'historique devant la page : un retour ne quitte pas l'appli, il remonte d'un écran (ou ne fait rien). */
  try {
    history.replaceState({ vb: 0 }, '', location.href); history.pushState({ vb: 1 }, '', location.href);
    window.addEventListener('popstate', function () {
      history.pushState({ vb: 1 }, '', location.href);
      var on = document.querySelector('.ecran.on'); var id = on ? on.id : '';
      if (id === 's-form') { if (blobFinal) revoir(); else accueil(); } else if (id === 's-pin') accueil();
      else if (id === 's-admin') { if (!$('adm-edit').hidden) $('e-retour').click(); else $('a-close').click(); }
      else if (id === 's-sess-mdp') $('sm-retour').click();
      else if (id === 's-cam' && !enregistrement && !decompte) $('b-x').click();
      else if (id === 's-revoir') $('b-refaire').click();
    });
  } catch (e) {}

  /* ───────── démarrage ───────── */
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('beforeunload', function (e) { if (enregistrement) { e.preventDefault(); e.returnValue = ''; } });
  var verrou = null;
  function garderEveille() { if ('wakeLock' in navigator) navigator.wakeLock.request('screen').then(function (w) { verrou = w; }).catch(function () {}); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') garderEveille(); });
  document.addEventListener('pointerdown', function () { garderEveille(); if (document.fullscreenElement == null && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {}); }, { once: true });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/videobooth/sw.js', { scope: '/videobooth/' }).catch(function () {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  /* ── accès : mot de passe général → liste des sessions → mot de passe de la session ── */
  function baseApi() { return (cfg.serveur || location.origin).replace(/\/+$/, ''); }
  /* clé de l'application Android (jamais dans la page : c'est l'application qui la fournit) */
  /* code de sortie / réglages choisi dans le back-office (Logiciels) : il remplace le code local et est transmis à l'application Android */
  var codeServeur = false;
  function appliquerCode(j) {
    if (!j || !/^\d{4,12}$/.test(String(j.code))) return;
    codeServeur = true;
    if (cfg.pin !== String(j.code)) { cfg.pin = String(j.code); try { ecrireCfg(cfg); } catch (e) {} }
    try { if (window.VespraAndroid && window.VespraAndroid.code) window.VespraAndroid.code(String(j.code)); } catch (e) {}
    try { var c = $('a-pin') && $('a-pin').closest('.adm-c'); if (c) c.hidden = true; } catch (e) {}
  }
  function cleAppli() { try { return window.VespraAndroid && window.VespraAndroid.cle ? String(window.VespraAndroid.cle() || '') : ''; } catch (e) { return ''; } }
  function ent(h) { h = h || {}; h['x-vespra-app'] = cleAppli(); return h; }
  function ecranAppli(maj) {
    var z = $('s-appli'); if (!z) return;
    $('appli-t').textContent = maj ? 'Mettez l’application à jour' : 'Application requise';
    $('appli-p').textContent = maj ? 'Cette version de l’application Vespra Vidéobooth est trop ancienne. Installez la dernière version.' : 'Ce vidéobooth fonctionne uniquement dans l’application Vespra Vidéobooth pour tablette Android.';
    montrer('s-appli');
    /* application trop ancienne : on ne laisse jamais la tablette bloquée (barres visibles, épinglage levé) pour pouvoir installer la nouvelle version */
    if (maj) $('appli-p').textContent += ' Les barres de la tablette sont maintenant visibles : quittez l’application, puis installez la nouvelle version depuis vespraevent.fr/telecharger.';
    try { if (window.VespraAndroid && window.VespraAndroid.admin) window.VespraAndroid.admin(true); } catch (e) {}
  }
  function appelApi(route, corps) {
    return fetch(baseApi() + '/api/videobooth/' + route, { method: 'POST', headers: ent({ 'content-type': 'application/json' }), body: JSON.stringify(corps) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._st = r.status; if (j.appli) ecranAppli(!!window.VespraAndroid); appliquerCode(j); return j; }); });
  }
  function sessionStockee() { try { var s = JSON.parse(localStorage.getItem('vb-sess') || 'null'); if (s && s.exp > Date.now() && s.jeton && s.session) return s; } catch (e) {} return null; }
  function accesStocke() { try { var a = JSON.parse(localStorage.getItem('vb-acces') || 'null'); if (a && a.exp > Date.now()) return a; } catch (e) {} return null; }
  function ouvrirSession(s) { cfg.session = s.session; cfg.jeton = s.jeton; appliquerActif(); accueil(); synchro(); }
  var accesLibre = false;
  function memoriserAcces(j) { accesLibre = !!j.libre; try { localStorage.setItem('vb-acces', JSON.stringify({ acces: j.acces, exp: Date.now() + 11 * 3600e3 })); } catch (e) {} }
  function ecranMdpAcces() { $('acces-in').value = ''; $('acces-err').textContent = ''; montrer('s-acces'); setTimeout(function () { $('acces-in').focus(); }, 100); }
  /* sans mot de passe général (réglage du back-office) la liste des sessions s'ouvre directement ; sinon on le demande */
  function versAcces() {
    cfg.session = null; cfg.jeton = ''; ecrireCfg(cfg);
    appelApi('acces', { mdp: '' }).then(function (j) {
      if (j.ok) {
        memoriserAcces(j);
        /* accès libre : la tablette rouvre toute seule sa dernière session (sans mot de passe de session), sauf si on vient de demander à en changer */
        var der = ''; try { der = localStorage.getItem('vb-derniere') || ''; } catch (x) {}
        var e = j.libre && der && !sessionStorage.getItem('vb-manuel') ? (j.sessions || []).filter(function (x) { return x.id === der && x.prot === false; })[0] : null;
        if (e) { connecter(e, '').then(function (r) { if (!r || !r.ok) rendreSessions(j.sessions || []); }).catch(function () { rendreSessions(j.sessions || []); }); return; }
        rendreSessions(j.sessions || []);
      } else ecranMdpAcces();
    }).catch(function () { ecranMdpAcces(); });
  }
  function connecter(e, mdp) {
    var a = accesStocke(); if (!a) return versAcces();
    return appelApi('session', { acces: a.acces, id: e.id, mdp: mdp }).then(function (j) {
      if (!j.ok) return j;
      var s = { jeton: j.jeton, session: j.session, exp: (Number(j.exp) || (Date.now() + 60 * 86400e3)) - 86400e3 };
      try { localStorage.setItem('vb-sess', JSON.stringify(s)); localStorage.setItem('vb-derniere', String(e.id)); sessionStorage.removeItem('vb-manuel'); } catch (x) {}
      ouvrirSession(s); return j;
    });
  }
  function rendreSessions(liste) {
    var z = $('sess-cartes'); z.innerHTML = '';
    $('sess-retour').hidden = accesLibre;
    if (!liste.length) { z.innerHTML = '<p>Aucune session ouverte pour le moment. Créez-en une dans le back-office.</p>'; }
    liste.forEach(function (e) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'adm-carte'; b.innerHTML = '<b></b><span></span>'; b.querySelector('b').textContent = e.nom; b.querySelector('span').textContent = e.date || '';
      b.onclick = function () {
        choisie = e;
        if (e.prot !== false) { $('sm-titre').textContent = e.nom; $('sm-in').value = ''; $('sm-err').textContent = ''; montrer('s-sess-mdp'); setTimeout(function () { $('sm-in').focus(); }, 100); return; }
        b.disabled = true;
        connecter(e, '').then(function (j) { b.disabled = false; if (j && !j.ok) { z.insertAdjacentHTML('afterbegin', '<p class="err">' + (j.erreur || 'Connexion impossible.') + '</p>'); } }).catch(function () { b.disabled = false; z.insertAdjacentHTML('afterbegin', '<p class="err">Pas de réseau : réessayez.</p>'); });
      };
      z.appendChild(b);
    });
    montrer('s-sessions');
  }
  var choisie = null;
  function listerSessions() {
    var a = accesStocke(); if (!a) return versAcces();
    appelApi('sessions', { acces: a.acces }).then(function (j) { if (j.ok) rendreSessions(j.sessions || []); else versAcces(); }).catch(function () { $('sess-cartes').innerHTML = '<p>Réseau indisponible. Réessayez.</p>'; montrer('s-sessions'); });
  }
  $('acces-ok').onclick = function () {
    var m = $('acces-in').value.trim(); if (!m) return; $('acces-err').textContent = ''; $('acces-ok').disabled = true;
    appelApi('acces', { mdp: m }).then(function (j) {
      $('acces-ok').disabled = false;
      if (!j.ok) { $('acces-err').textContent = j.erreur || 'Connexion impossible.'; return; }
      memoriserAcces(j); rendreSessions(j.sessions || []);
    }).catch(function () { $('acces-ok').disabled = false; $('acces-err').textContent = 'Pas de réseau : branchez la tablette à internet pour ouvrir une session.'; });
  };
  $('acces-in').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('acces-ok').click(); });
  $('sess-retour').onclick = function () { try { localStorage.removeItem('vb-acces'); } catch (e) {} ecranMdpAcces(); };
  $('sm-retour').onclick = function () { listerSessions(); };
  $('sm-ok').onclick = function () {
    if (!choisie) return versAcces();
    $('sm-err').textContent = ''; $('sm-ok').disabled = true;
    connecter(choisie, $('sm-in').value.trim()).then(function (j) {
      $('sm-ok').disabled = false;
      if (j && !j.ok) { $('sm-err').textContent = j.erreur || 'Connexion impossible.'; if (j.expire) versAcces(); }
    }).catch(function () { $('sm-ok').disabled = false; $('sm-err').textContent = 'Pas de réseau : réessayez.'; });
  };
  $('sm-in').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('sm-ok').click(); });
  $('a-chsess').onclick = function () { if (!confirm('Fermer la session en cours et en choisir une autre ? Les vidéos déjà enregistrées restent sur la tablette.')) return; try { localStorage.removeItem('vb-sess'); sessionStorage.setItem('vb-manuel', '1'); } catch (e) {} cfg.session = null; cfg.jeton = ''; appliquerActif(); if (accesStocke()) listerSessions(); else versAcces(); };
  /* tablette allumée toute la journée : rechargement discret (écran d'accueil, personne en train d'enregistrer) au bout de 8 h,
     pour repartir d'une mémoire propre et récupérer les mises à jour de l'appli */
  var debutPage = Date.now();
  setInterval(function () {
    if (Date.now() - debutPage > 8 * 3600e3 && navigator.onLine && !enregistrement && $('s-accueil').classList.contains('on')) { try { location.reload(); } catch (e) {} }
  }, 10 * 60e3);
  /* réglages de la session (modes, questions, textes) relus au démarrage puis toutes les 5 minutes : une modification du back-office arrive seule sur la tablette,
     et ne s'applique qu'à l'écran d'accueil, jamais pendant qu'un invité est en train de filmer */
  var dernierMaj = 0;
  function majSession() {
    if (!cfg.jeton || !navigator.onLine || enregistrement) return;
    dernierMaj = Date.now();
    fetch(baseApi() + '/api/videobooth/ma-session', { headers: ent({ 'x-appareil': cfg.jeton }) }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j) appliquerCode(j);
      if (!j || !j.ok || !j.session) return;
      sessionMaj = j.session; if ($('s-accueil').classList.contains('on')) accueil(true);
    }).catch(function () {});
  }
  setInterval(majSession, 5 * 60e3); window.addEventListener('online', function () { setTimeout(majSession, 1500); }); setTimeout(majSession, 6000);
  function demarrerAppli() {
    /* hors de l'application (navigateur) ou application trop ancienne : on n'ouvre rien */
    if (!window.VespraAndroid) return ecranAppli(false);
    if (!cleAppli()) return ecranAppli(true);
    var s = sessionStockee(); if (s) ouvrirSession(s); else versAcces();
  }
  ouvrirDb().then(function () { demarrerAppli(); }).catch(function () { demarrerAppli(); $('etat').hidden = false; $('etat').textContent = 'Stockage de la tablette indisponible'; $('etat').classList.add('alerte'); });
})();
