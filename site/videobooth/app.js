/* Vidéobooth Vespra Event — appli tablette.
   Les vidéos sont d'abord gardées dans la tablette (IndexedDB), puis envoyées au serveur dès qu'il y a du réseau. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var CFG0 = { event: '', titre: 'Enregistrer un souvenir', sous: 'Laissez un petit message vidéo de 30 secondes', serveur: '', cle: '', max: 30, cam: '', pin: '0104' };
  function lireCfg() { try { return Object.assign({}, CFG0, JSON.parse(localStorage.getItem('vb-cfg') || '{}')); } catch (e) { return Object.assign({}, CFG0); } }
  function ecrireCfg(c) { try { localStorage.setItem('vb-cfg', JSON.stringify(c)); } catch (e) {} }
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
      var r = indexedDB.open('vb-videos', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('videos', { keyPath: 'id' }); };
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
    if (id !== 's-revoir') { var vr = $('v-revoir'); try { vr.pause(); vr.removeAttribute('src'); vr.load(); } catch (e) {} } document.querySelectorAll('.ecran').forEach(function (e) { e.classList.toggle('on', e.id === id); }); }
  var inactif = null;
  function veille() { clearTimeout(inactif); inactif = setTimeout(function () { if (!$('s-accueil').classList.contains('on') && !$('s-admin').classList.contains('on') && !$('s-pin').classList.contains('on') && !enregistrement) { arreterCam(); accueil(); } }, 120000); }
  ['pointerdown', 'keydown'].forEach(function (t) { document.addEventListener(t, veille, { passive: true }); });
  function accueil(garder) {
    $('t-accueil').textContent = cfg.titre || CFG0.titre; $('p-accueil').textContent = cfg.sous || '';
    if (!garder) $('form').reset(); $('f-err').textContent = ''; montrer('s-accueil'); majEtat();
  }
  function fmt(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  /* ───────── formulaire ───────── */
  $('b-commencer').onclick = function () { montrer('s-form'); setTimeout(function () { $('f-nom').focus(); }, 80); };
  $('f-retour').onclick = function () { accueil(); };
  $('form').onsubmit = function (e) {
    e.preventDefault();
    var p = $('f-prenom').value.trim(), n = $('f-nom').value.trim(), m = $('f-email').value.trim();
    if (!p || !n) return ($('f-err').textContent = 'Merci d’indiquer votre prénom et votre nom.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m)) return ($('f-err').textContent = 'Cette adresse e-mail ne semble pas valide.');
    if (!$('f-ok').checked) return ($('f-err').textContent = 'Merci de cocher la case pour recevoir votre vidéo.');
    $('f-err').textContent = ''; invite = { prenom: p, nom: n, email: m }; ouvrirCam();
  };
  var invite = null;

  /* ───────── caméra ───────── */
  var decompte = null, flux = null, rec = null, morceaux = [], blobFinal = null, mime = '', enregistrement = false, minuteur = null, t0 = 0;
  function meilleurMime() {
    var l = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    for (var i = 0; i < l.length; i++) { try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(l[i])) return l[i]; } catch (e) {} }
    return '';
  }
  var cv = $('v-live'), cx = cv.getContext('2d'), boucle = 0;
  /* Rendu toujours VERTICAL (3:4) : l'image de la caméra est recadrée sur un canvas, et c'est ce canvas qui est filmé. */
  function dessiner() {
    var v = $('v-src');
    if (v.videoWidth) {
      var vw = v.videoWidth, vh = v.videoHeight, W, H, R = cfg.format === '3:4' ? 0.75 : 0.5625;
      if (vw / vh > R) { H = Math.min(vh, 1920); W = Math.round(H * R / 2) * 2; } else { W = Math.min(vw, 1080); H = Math.round(W / R / 2) * 2; }
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      var sc = Math.max(W / vw, H / vh), sw = W / sc, sh = H / sc;
      cx.drawImage(v, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, W, H);
    }
    boucle = requestAnimationFrame(dessiner);
  }
  function arreterCam() { if (boucle) { cancelAnimationFrame(boucle); boucle = 0; } if (flux) { flux.getTracks().forEach(function (t) { t.stop(); }); flux = null; } $('v-src').srcObject = null; }
  function ouvrirCam() {
    montrer('s-cam'); $('s-cam').classList.remove('flou'); $('cam-err').hidden = true; $('compte').hidden = true; $('rec').hidden = true; $('barre').hidden = true;
    $('b-go').hidden = true; $('b-stop').hidden = true; enregistrement = false;
    var contraintes = { audio: Object.assign({ echoCancellation: true, noiseSuppression: true }, cfg.mic ? { deviceId: { exact: cfg.mic } } : {}), video: Object.assign(cfg.cam ? { deviceId: { exact: cfg.cam } } : { facingMode: 'user' }, { width: { ideal: 1920 }, height: { ideal: 1080 } }) };
    arreterCam();
    navigator.mediaDevices.getUserMedia(contraintes).then(function (s) {
      flux = s; $('b-go').hidden = false; $('v-src').srcObject = s; $('v-src').play().catch(function () {}); boucle = requestAnimationFrame(dessiner);
    }).catch(function (e) {
      $('cam-err').textContent = 'Impossible d’accéder à la caméra ou au micro. Autorisez-les dans les réglages de la tablette, puis réessayez.'; $('cam-err').hidden = false; $('b-go').hidden = true;
      setTimeout(function () { accueil(); }, 7000);
    });
  }
  $('b-go').onclick = function () {
    if (!flux) return; $('b-go').hidden = true; $('compte').hidden = false; $('s-cam').classList.add('flou');
    $('compte-msg').textContent = 'Vous avez ' + (Number(cfg.max) || 30) + ' secondes maximum';
    var n = 3; $('compte-n').textContent = n; decompte = setInterval(function () { n--; if (n > 0) { $('compte-n').textContent = n; } else { clearInterval(decompte); decompte = null; $('compte').hidden = true; $('s-cam').classList.remove('flou'); demarrer(); } }, 1000);
  };
  function demarrer() {
    morceaux = []; blobFinal = null; mime = meilleurMime();
    var flot = new MediaStream(cv.captureStream(30).getVideoTracks().concat(flux.getAudioTracks()));
    try { rec = mime ? new MediaRecorder(flot, { mimeType: mime, videoBitsPerSecond: 3500000 }) : new MediaRecorder(flot); } catch (e) { rec = new MediaRecorder(flot); }
    mime = rec.mimeType || mime || 'video/webm';
    rec.ondataavailable = function (e) { if (e.data && e.data.size) morceaux.push(e.data); };
    rec.onstop = function () {
      enregistrement = false; clearInterval(minuteur);
      blobFinal = new Blob(morceaux, { type: mime.split(';')[0] });
      arreterCam(); $('v-revoir').src = URL.createObjectURL(blobFinal); montrer('s-revoir'); $('v-revoir').play().catch(function () {});
    };
    rec.start(1000); enregistrement = true; t0 = Date.now();
    var max = Math.max(5, Number(cfg.max) || 30);
    $('rec').hidden = false; $('barre').hidden = false; $('b-stop').hidden = false; $('rec-max').textContent = '/ ' + fmt(max);
    minuteur = setInterval(function () {
      var s = (Date.now() - t0) / 1000; $('rec-t').textContent = fmt(s); $('barre-i').style.width = Math.min(100, s / max * 100) + '%';
      if (s >= max) arreterRec();
    }, 200);
  }
  function arreterRec() { if (rec && rec.state !== 'inactive') rec.stop(); }
$('b-stop').onclick = arreterRec;
  /* croix : on abandonne la prise et on revient au formulaire, les champs restent remplis */
  $('b-x').onclick = function () {
    if (decompte) { clearInterval(decompte); decompte = null; }
    clearInterval(minuteur);
    if (rec && rec.state !== 'inactive') { rec.onstop = null; try { rec.stop(); } catch (e) {} }
    enregistrement = false; arreterCam(); morceaux = []; blobFinal = null; $('s-cam').classList.remove('flou');
    montrer('s-form');
  };

  /* ───────── revoir / terminer ───────── */
  $('b-refaire').onclick = function () { try { URL.revokeObjectURL($('v-revoir').src); } catch (e) {} blobFinal = null; ouvrirCam(); };
  function nomFichier() {
    var net = function (x) { return x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); };
    var d = new Date(), j = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + '_' + ('0' + d.getHours()).slice(-2) + 'h' + ('0' + d.getMinutes()).slice(-2);
    return net(invite.nom) + '_' + net(invite.prenom) + '_' + j + (/mp4/.test(blobFinal.type) ? '.mp4' : '.webm');
  }
  $('b-fin').onclick = function () {
    if (!blobFinal || !invite) return;
    $('b-fin').disabled = true;
    var v = { id: 'v' + Date.now() + Math.random().toString(36).slice(2, 7), event: cfg.event, nom: invite.nom, prenom: invite.prenom, email: invite.email, consent: true,
      fichier: nomFichier(), type: blobFinal.type, duree: Math.round((Date.now() - t0) / 1000), cree: new Date().toISOString(), essais: 0, blob: blobFinal };
    ajouter(v).then(function () {
      try { URL.revokeObjectURL($('v-revoir').src); } catch (e) {} blobFinal = null; invite = null; $('b-fin').disabled = false;
      montrer('s-merci'); synchro(); setTimeout(function () { accueil(); }, 7000);
    }).catch(function () { $('b-fin').disabled = false; alert('La vidéo n’a pas pu être enregistrée : la tablette est peut-être pleine. Prévenez l’équipe.'); });
  };

  /* ───────── envoi au serveur ───────── */
  var envoiEnCours = false, dernierMsg = ''; try { dernierMsg = localStorage.getItem('vb-err') || ''; } catch (e) {}
  function noterMsg(m) { dernierMsg = m; try { localStorage.setItem('vb-err', m); } catch (e) {} }
  function majEtat() {
    toutes().then(function (l) {
      var att = l.filter(function (v) { return !v.envoye; }).length, tot = l.length;
      var txt = att ? (att + ' vidéo' + (att > 1 ? 's' : '') + ' en attente d’envoi') : (tot ? 'Toutes les vidéos sont envoyées' : '');
      
      $('a-file').textContent = (cfg.cle ? '' : '⚠ Clé de l’appareil vide : aucune vidéo ne peut partir. ') + tot + ' vidéo(s) gardée(s) sur la tablette, dont ' + (tot - att) + ' envoyée(s)' + (att ? ' — ' + att + ' en attente' : '') + (dernierMsg ? ' — ' + dernierMsg : '');
    }).catch(function () {});
  }
  var TAILLE = 3 * 1024 * 1024;
  function envoyer(v) {
    var base = (cfg.serveur || location.origin).replace(/\/+$/, '');
    var n = Math.max(1, Math.ceil(v.blob.size / TAILLE)), i = 0, dernier = {};
    function suite() {
      var q = new URLSearchParams({ id: v.id, i: i, n: n, fichier: v.fichier, type: v.type || '', nom: v.nom, prenom: v.prenom, email: v.email, event: v.event || '', duree: v.duree || 0 });
      return fetch(base + '/api/videobooth/chunk?' + q.toString(), { method: 'POST', headers: { 'x-appareil': cfg.cle, 'content-type': 'application/octet-stream' }, body: v.blob.slice(i * TAILLE, (i + 1) * TAILLE) }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok || j.ok === false) throw new Error(j.erreur || ('Serveur : ' + r.status));
          dernier = j; i++; return i < n ? suite() : dernier;
        });
      });
    }
    return suite();
  }
  function synchro() {
    if (envoiEnCours || !cfg.cle || !navigator.onLine) { majEtat(); return Promise.resolve(); }
    envoiEnCours = true;
    return toutes().then(function (l) {
      l = l.filter(function (v) { return !v.envoye; }).sort(function (a, b) { return a.cree < b.cree ? -1 : 1; });
      var suite = Promise.resolve();
      l.forEach(function (v) {
        suite = suite.then(function () {
          return envoyer(v).then(function (rep) { noterMsg((rep && rep.mail === false) ? 'vidéo reçue par le site, mais e-mail non parti : ' + (rep.mailErreur || '') : ''); v.envoye = true; v.envoyeLe = new Date().toISOString(); v.mail = !(rep && rep.mail === false); return ajouter(v); }).catch(function (e) { noterMsg('envoi impossible (' + (e.message || 'réseau') + '), nouvel essai automatique'); v.essais = (v.essais || 0) + 1; return ajouter(v); });
        });
      });
      return suite;
    }).then(function () { envoiEnCours = false; majEtat(); }, function () { envoiEnCours = false; });
  }
  setInterval(synchro, 20000); window.addEventListener('online', synchro);

  /* ───────── réglages (code d'accès) ───────── */
  var pressions = 0, tPress = 0, modePin = 'verifier';
  $('cadenas').onclick = demanderPin;
  function demanderPin() {
    modePin = 'verifier'; $('pin-t').textContent = 'Code d’accès'; $('pin-in').value = ''; $('pin-err').textContent = ''; montrer('s-pin'); setTimeout(function () { $('pin-in').focus(); }, 80);
  }
  $('pin-x').onclick = accueil;
  $('pin-ok').onclick = function () {
    var v = $('pin-in').value.trim();
    if (modePin === 'creer') { if (v.length < 4) return ($('pin-err').textContent = '4 chiffres au minimum.'); cfg.pin = v; ecrireCfg(cfg); return ouvrirAdmin(); }
    if (v === cfg.pin) ouvrirAdmin(); else $('pin-err').textContent = 'Code incorrect.';
  };
  $('pin-in').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('pin-ok').click(); });
  /* ── décor de Noël : sapins et guirlandes fixes (rien ne bouge) ── */
  (function () {
    var cols = ['#F59E0B', '#ffffff', '#e8564a', '#7cc4f2'];
    var guirlande = (function () {
      var p = 'M-10,6', b = '';
      for (var x = 0; x <= 810; x += 90) { p += ' Q' + (x + 45) + ',46 ' + (x + 90) + ',6'; }
      for (var k = 0; k < 18; k++) { var x2 = 22 + k * 45, y = 6 + 30 * Math.sin(Math.PI * ((k * 45 + 22) % 90) / 90) * 0.92 + 4; b += '<line x1="' + x2 + '" y1="' + (y - 3) + '" x2="' + x2 + '" y2="' + (y + 1) + '" stroke="#ffffff55" stroke-width="1.2"/><ellipse cx="' + x2 + '" cy="' + (y + 7) + '" rx="4.2" ry="6" fill="' + cols[k % 4] + '"/>'; }
      return '<svg viewBox="0 0 800 60" preserveAspectRatio="xMidYMin slice" width="100%" height="100%"><path d="' + p + '" fill="none" stroke="#ffffff66" stroke-width="1.6"/>' + b + '</svg>';
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
    var e = evts().filter(function (x) { return x.id === cfg.actif; })[0];
    cfg.event = e ? (e.nom + (e.date ? ' — ' + e.date : '')) : '';
    cfg.titre = (e && e.titre) || CFG0.titre; cfg.sous = e ? (e.sous || '') : CFG0.sous; cfg.max = (e && Number(e.max)) || 30; cfg.cam = (e && e.cam) || ''; cfg.noel = !!(e && e.noel); cfg.format = (e && e.format) || '9:16'; cfg.mic = (e && e.mic) || ''; document.body.classList.toggle('fmt34', cfg.format === '3:4'); document.body.classList.toggle('noel-on', cfg.noel);
    ecrireCfg(cfg);
  }
  var edite = null;
  function rendreCartes() {
    var h = '';
    evts().forEach(function (e) {
      h += '<button type="button" class="adm-carte' + (e.id === cfg.actif ? ' on' : '') + '" data-id="' + e.id + '">' + (e.id === cfg.actif ? '<i class="badge">En cours</i>' : '') +
        '<b></b><span></span></button>';
    });
    h += '<button type="button" class="adm-carte nouveau" id="adm-new">+ Nouvel événement</button>';
    $('adm-cartes').innerHTML = h;
    var cs = $('adm-cartes').querySelectorAll('.adm-carte[data-id]');
    evts().forEach(function (e, i) { cs[i].querySelector('b').textContent = e.nom || 'Sans nom'; cs[i].querySelector('span').textContent = e.date || ''; cs[i].onclick = function () { ouvrirEdition(e.id); }; });
    $('adm-new').onclick = function () { var e = { id: nouvelId(), nom: '', date: '', titre: CFG0.titre, sous: CFG0.sous, max: 30, cam: '' }; cfg.events.push(e); if (!cfg.actif) cfg.actif = e.id; ecrireCfg(cfg); ouvrirEdition(e.id); };
  }
  function ouvrirAdmin() {
    $('a-serveur').value = cfg.serveur; $('a-cle').value = cfg.cle;
    $('adm-edit').hidden = true; $('adm-liste').hidden = false; rendreCartes(); majEtat(); montrer('s-admin');
  }
  function ouvrirEdition(id) {
    var e = evts().filter(function (x) { return x.id === id; })[0]; if (!e) return; edite = e;
    $('e-nom').value = e.nom; $('e-noel').checked = !!e.noel; $('e-format').value = e.format || '9:16'; $('e-date').value = e.date || ''; $('e-titre').value = e.titre || ''; $('e-sous').value = e.sous || ''; $('e-max').value = e.max || 30;
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
    edite.max = Math.min(120, Math.max(5, Number($('e-max').value) || 30)); edite.cam = $('e-cam').value; edite.noel = $('e-noel').checked; edite.format = $('e-format').value; edite.mic = $('e-mic').value;
  }
  function sauverConnexion() { cfg.serveur = $('a-serveur').value.trim(); cfg.cle = $('a-cle').value.trim() || cfg.cle; ecrireCfg(cfg); }
  $('a-serveur').onchange = $('a-cle').onchange = sauverConnexion;
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
    if (!cfg.cle) { noterMsg('la clé de l’appareil n’est pas renseignée (champ ci-dessus, puis Enregistrer)'); return majEtat(); }
    noterMsg('envoi en cours…'); majEtat(); synchro().then(function () { if (dernierMsg === 'envoi en cours…') noterMsg(''); majEtat(); });
  };
  $('a-test').onclick = function () {
    var base = ($('a-serveur').value.trim() || location.origin).replace(/\/+$/, ''), cle = $('a-cle').value.trim();
    $('a-test-r').textContent = 'Test en cours…';
    fetch(base + '/api/videobooth/ping', { headers: { 'x-appareil': cle } }).then(function (r) { return r.json().catch(function () { return { ok: false, erreur: 'Réponse inattendue (' + r.status + ')' }; }); }).then(function (j) {
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

  /* ───────── démarrage ───────── */
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('beforeunload', function (e) { if (enregistrement) { e.preventDefault(); e.returnValue = ''; } });
  var verrou = null;
  function garderEveille() { if ('wakeLock' in navigator) navigator.wakeLock.request('screen').then(function (w) { verrou = w; }).catch(function () {}); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') garderEveille(); });
  document.addEventListener('pointerdown', function () { garderEveille(); if (document.fullscreenElement == null && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {}); }, { once: true });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/videobooth/sw.js', { scope: '/videobooth/' }).catch(function () {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  appliquerActif();
  ouvrirDb().then(function () { accueil(); synchro(); }).catch(function () { accueil(); $('etat').hidden = false; $('etat').textContent = 'Stockage de la tablette indisponible'; $('etat').classList.add('alerte'); });
})();
