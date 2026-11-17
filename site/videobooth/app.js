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
    if (id !== 's-revoir') { var vr = $('v-revoir'); try { vr.pause(); vr.removeAttribute('src'); vr.load(); } catch (e) {} } document.querySelectorAll('.ecran').forEach(function (e) { e.classList.toggle('on', e.id === id); }); }
  var inactif = null;
  function veille() { clearTimeout(inactif); inactif = setTimeout(function () { if (!$('s-accueil').classList.contains('on') && !$('s-admin').classList.contains('on') && !$('s-pin').classList.contains('on') && !enregistrement) { arreterCam(); accueil(); } }, 120000); }
  ['pointerdown', 'keydown'].forEach(function (t) { document.addEventListener(t, veille, { passive: true }); });
  function accueil(garder) {
    $('t-accueil').textContent = cfg.titre || CFG0.titre; $('p-accueil').textContent = cfg.sous || '';
    $('t-qui').textContent = cfg.qui || 'Qui êtes-vous ?'; $('p-qui').textContent = cfg.quiSous == null ? 'Pour vous envoyer votre vidéo par e-mail' : cfg.quiSous;
    if (!garder) { $('form').reset(); formatInvite = null; majFormat(); } $('f-err').textContent = ''; montrer('s-accueil'); majEtat();
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
  var sonNiveau = 100;
  var cv = $('v-live'), cx = cv.getContext('2d'), boucle = 0;
  /* Rendu toujours VERTICAL (3:4) : l'image de la caméra est recadrée sur un canvas, et c'est ce canvas qui est filmé. */
  /* format de la vidéo : automatique = suit l'orientation de la tablette (vertical 9:16, horizontal 16:9) */
  var formatInvite = null;   /* format choisi par l'invité (vertical / horizontal), remis à zéro pour chaque nouvel invité */
  function formatEffectif() { var f = formatInvite || cfg.format || 'auto'; if (f === 'auto') f = window.innerWidth > window.innerHeight ? '16:9' : '9:16'; return f; }
  function majFormat() {
    var f = formatEffectif(), vertical = f === '9:16' || f === '3:4';
    /* image entière (bandes noires) quand le format filmé n'a pas la forme de l'écran : on voit exactement ce qui sera filmé */
    document.body.classList.toggle('fmt34', f === '3:4' || f === '4:3' || vertical !== (window.innerHeight > window.innerWidth));
    Array.prototype.forEach.call(document.querySelectorAll('#fmt button'), function (b) { b.classList.toggle('on', (b.dataset.f === 'v') === vertical); });
  }
  window.addEventListener('resize', majFormat);
  Array.prototype.forEach.call(document.querySelectorAll('#fmt button'), function (b) { b.onclick = function () { formatInvite = b.dataset.f === 'v' ? '9:16' : '16:9'; majFormat(); }; });
  function ratioFormat() {
    var f = formatInvite || cfg.format || 'auto';
    if (f === 'auto') f = window.innerWidth > window.innerHeight ? '16:9' : '9:16';
    return { '9:16': 0.5625, '3:4': 0.75, '4:3': 1.3333, '16:9': 1.7778 }[f] || 0.5625;
  }
  function dessiner() {
    var v = $('v-src');
    if (v.videoWidth) {
      var vw = v.videoWidth, vh = v.videoHeight, W, H, R = ratioFormat();
      if (vw / vh > R) { H = Math.min(vh, 1920); W = Math.round(H * R / 2) * 2; } else { W = Math.min(vw, 1920); H = Math.round(W / R / 2) * 2; }
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      var sc = Math.max(W / vw, H / vh), sw = W / sc, sh = H / sc;
      cx.drawImage(v, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, W, H);
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
  function perteCapteur(quoi) {
    if (quoi === 'cam') camEtat = 'perdue'; else micEtat = 'perdu';
    clearTimeout(minuteurStable);
    if (enregistrement) { arreterRec(); return; }
    if (!$('s-cam').classList.contains('on') || minuteurReco) return;
    if (essaisCam >= 6) { essaisCam = 0; arreterCam(); accueil(); return; }
    var delai = Math.min(60000, 2000 * Math.pow(2, essaisCam)); essaisCam++; nbReco++;
    $('cam-err').textContent = 'Un instant…'; $('cam-err').hidden = false;
    minuteurReco = setTimeout(function () { minuteurReco = null; if ($('s-cam').classList.contains('on') && !enregistrement) ouvrirCam(); }, delai);
  }
  function arreterCam() {
    analyseur = null; $('mic').hidden = true; if (boucle) { cancelAnimationFrame(boucle); boucle = 0; } if (flux) { flux.getTracks().forEach(function (t) { t.stop(); }); flux = null; } $('v-src').srcObject = null; }
  function ouvrirCam() {
    montrer('s-cam'); $('s-cam').classList.remove('flou'); $('cam-err').hidden = true; $('compte').hidden = true; $('rec').hidden = true; $('barre').hidden = true;
    $('b-go').hidden = true; $('b-stop').hidden = true; $('fmt').hidden = true; enregistrement = false;
    var contraintes = { audio: Object.assign({ echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 }, cfg.mic ? { deviceId: { exact: cfg.mic } } : {}), video: Object.assign(cfg.cam ? { deviceId: { exact: cfg.cam } } : { facingMode: 'user' }, { width: { ideal: 1920 }, height: { ideal: 1080 } }) };
    arreterCam();
    navigator.mediaDevices.getUserMedia(contraintes).then(function (s) {
      flux = s; $('b-go').hidden = false; $('fmt').hidden = !(cfg.choixFormat !== false) || testCam; majFormat(); $('cadrage').textContent = cfg.cadrage || ''; $('cadrage').hidden = !cfg.cadrage; $('v-src').srcObject = s; $('v-src').play().catch(function () {}); boucle = requestAnimationFrame(dessiner);
      grandAngle(s);
      camEtat = 'ok'; tFige = Date.now(); brancherMicro(s); $('mic').hidden = false;
      clearTimeout(minuteurStable); minuteurStable = setTimeout(function () { essaisCam = 0; }, 30000);
      s.getVideoTracks().forEach(function (t) { t.onended = function () { perteCapteur('cam'); }; });
      s.getAudioTracks().forEach(function (t) { t.onended = function () { perteCapteur('mic'); }; });
      if (testCam) infoCamera(s);
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
    var l = ['Caméra : ' + (tr.label || '(nom inconnu)'), 'Image reçue : ' + st.width + ' × ' + st.height + ' à ' + Math.round(st.frameRate || 0) + ' i/s',
      'Zoom : ' + (caps.zoom ? ('min ' + caps.zoom.min + ' · max ' + caps.zoom.max + ' · actuel ' + (st.zoom || '?')) : 'non réglable par le navigateur'),
      'Format enregistré : ' + (cfg.format === 'auto' || !cfg.format ? 'auto (' + (window.innerWidth > window.innerHeight ? '16:9' : '9:16') + ')' : cfg.format),
      'Micro : ' + (au ? (au.label || '(nom inconnu)') : 'aucun')];
    navigator.mediaDevices.enumerateDevices().then(function (d) {
      l.push('Caméras disponibles : ' + d.filter(function (x) { return x.kind === 'videoinput'; }).map(function (x) { return x.label || '?'; }).join(' | '));
      $('cam-info').textContent = l.join('\n'); $('cam-info').hidden = false;
    });
    $('guide').hidden = false; $('b-go').hidden = true; $('cadrage').hidden = true; $('fmt').hidden = true;
  }
  $('a-camtest').onclick = function () { testCam = true; ouvrirCam(); };
  /* GRAND ANGLE : zoom au minimum, et caméra « ultra grand-angle » si la tablette en a une */
  var angleEssaye = false;
  function grandAngle(s) {
    try {
      var tr = s.getVideoTracks()[0], caps = tr && tr.getCapabilities ? tr.getCapabilities() : {};
      if (caps.zoom && typeof caps.zoom.min === 'number') tr.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] }).catch(function () {});
    } catch (e) {}
    if (angleEssaye || cfg.cam || !navigator.mediaDevices.enumerateDevices) return;
    angleEssaye = true;
    navigator.mediaDevices.enumerateDevices().then(function (d) {
      var cur = (s.getVideoTracks()[0].getSettings() || {}).deviceId;
      var w = d.filter(function (x) { return x.kind === 'videoinput' && /ultra|wide|large|0\.5/i.test(x.label || ''); })[0];
      if (w && w.deviceId !== cur) { cfg.cam = w.deviceId; ouvrirCam(); cfg.cam = ''; }
    }).catch(function () {});
  }
  $('b-go').onclick = function () {
    if (!flux) return; $('fmt').hidden = true; $('cadrage').hidden = true; $('b-go').hidden = true; $('compte').hidden = false; $('s-cam').classList.add('flou');
    $('compte-msg').textContent = 'Vous avez ' + (Number(cfg.max) || 30) + ' secondes maximum';
    var n = 3; $('compte-n').textContent = n; decompte = setInterval(function () { n--; if (n > 0) { $('compte-n').textContent = n; } else { clearInterval(decompte); decompte = null; $('compte').hidden = true; $('s-cam').classList.remove('flou'); demarrer(); } }, 1000);
  };
  /* qualité choisie sur la session : haute 3,5 Mbit/s, standard 2,5, économique 1,8 (vidéos plus légères, moins de stockage et de données mobiles) */
  function debitVideo() { return { eco: 1800000, haute: 3500000 }[cfg.qualite] || 2500000; }
  function demarrer() {
    morceaux = []; blobFinal = null; mime = meilleurMime(); niveauMax = 0;
    var flot = new MediaStream(cv.captureStream(30).getVideoTracks().concat(flux.getAudioTracks()));
    try { rec = mime ? new MediaRecorder(flot, { mimeType: mime, videoBitsPerSecond: debitVideo(), audioBitsPerSecond: 128000 }) : new MediaRecorder(flot); } catch (e) { rec = new MediaRecorder(flot); }
    mime = rec.mimeType || mime || 'video/webm';
    rec.ondataavailable = function (e) { if (e.data && e.data.size) morceaux.push(e.data); };
    rec.onstop = function () {
      enregistrement = false; clearInterval(minuteur);
      blobFinal = new Blob(morceaux, { type: mime.split(';')[0] });
      sonNiveau = Math.round(niveauMax * 100); var faible = sonNiveau < 3;
      $('son-alerte').hidden = !faible; $('son-alerte').textContent = faible ? 'On ne vous entend pas bien. Parlez un peu plus fort, plus près de la tablette, puis recommencez.' : ''; if (faible) nbSilence++;
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
    if (testCam) { testCam = false; $('guide').hidden = true; $('cam-info').hidden = true; arreterCam(); ouvrirAdmin(); return; }
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
      son: sonNiveau, fichier: nomFichier(), type: blobFinal.type, duree: Math.round((Date.now() - t0) / 1000), cree: new Date().toISOString(), essais: 0, blob: blobFinal };
    ajouter(v).then(function () {
      try { URL.revokeObjectURL($('v-revoir').src); } catch (e) {} blobFinal = null; invite = null; $('b-fin').disabled = false;
      montrer('s-merci'); synchro(); setTimeout(function () { accueil(); }, 7000);
    }).catch(function () { $('b-fin').disabled = false; alert('La vidéo n’a pas pu être enregistrée : la mémoire de la tablette est pleine. Prévenez l’équipe.'); });
  };

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
      var q = new URLSearchParams({ id: v.id, i: i, n: n, fichier: v.fichier, type: v.type || '', nom: v.nom, prenom: v.prenom, email: v.email, event: v.event || '', duree: v.duree || 0, son: (v.son == null ? '' : v.son) });
      return fetch(base + '/api/videobooth/chunk?' + q.toString(), { method: 'POST', headers: { 'x-appareil': (cfg.jeton || cfg.cle), 'content-type': 'application/octet-stream' }, body: v.blob.slice(i * TAILLE, (i + 1) * TAILLE) }).then(function (r) {
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
      l = l.filter(function (v) { return !v.envoye; }).sort(function (a, b) { return a.cree < b.cree ? -1 : 1; });
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
    var etat = { cam: camEtat, mic: micEtat, ver: 24, enreg: !!enregistrement, reco: nbReco, mut: nbSilence };
    var fin = function () {
      toutes().then(function (l) { etat.att = l.filter(function (v) { return !v.envoye; }).length; etat.tot = l.length; }).catch(function () {}).then(function () {
        return (navigator.storage && navigator.storage.estimate) ? navigator.storage.estimate().then(function (e) { etat.usage = e.usage || 0; etat.quota = e.quota || 0; }).catch(function () {}) : null;
      }).then(function () {
        return fetch(baseApi() + '/api/videobooth/etat', { method: 'POST', headers: { 'x-appareil': (cfg.jeton || cfg.cle), 'content-type': 'application/json' }, body: JSON.stringify(etat) }).catch(function () {});
      });
    };
    if (navigator.getBattery) navigator.getBattery().then(function (b) { etat.batt = Math.round(b.level * 100); etat.charge = !!b.charging; fin(); }).catch(fin); else fin();
  }
  setInterval(battement, 120000); setTimeout(battement, 8000);
  setInterval(synchro, 20000); window.addEventListener('online', synchro);
  setTimeout(function () { liberer(false).then(majEtat); }, 4000);

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
  function sauverConnexion() { cfg.serveur = $('a-serveur').value.trim(); cfg.cam = $('a-cam').value; cfg.mic = $('a-mic').value; ecrireCfg(cfg); }
  $('a-serveur').onchange = $('a-cam').onchange = $('a-mic').onchange = sauverConnexion;
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

  /* ───────── l'appli reste dans son monde : le bouton « retour » de la tablette ne mène jamais au site ─────────
     On met un état d'historique devant la page : un retour ne quitte pas l'appli, il remonte d'un écran (ou ne fait rien). */
  try {
    history.replaceState({ vb: 0 }, '', location.href); history.pushState({ vb: 1 }, '', location.href);
    window.addEventListener('popstate', function () {
      history.pushState({ vb: 1 }, '', location.href);
      var on = document.querySelector('.ecran.on'); var id = on ? on.id : '';
      if (id === 's-form' || id === 's-pin') accueil();
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
  function appelApi(route, corps) {
    return fetch(baseApi() + '/api/videobooth/' + route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._st = r.status; return j; }); });
  }
  function sessionStockee() { try { var s = JSON.parse(localStorage.getItem('vb-sess') || 'null'); if (s && s.exp > Date.now() && s.jeton && s.session) return s; } catch (e) {} return null; }
  function accesStocke() { try { var a = JSON.parse(sessionStorage.getItem('vb-acces') || 'null'); if (a && a.exp > Date.now()) return a; } catch (e) {} return null; }
  function ouvrirSession(s) { cfg.session = s.session; cfg.jeton = s.jeton; appliquerActif(); accueil(); synchro(); }
  var accesLibre = false;
  function memoriserAcces(j) { accesLibre = !!j.libre; try { sessionStorage.setItem('vb-acces', JSON.stringify({ acces: j.acces, exp: Date.now() + 11 * 3600e3 })); } catch (e) {} }
  function ecranMdpAcces() { $('acces-in').value = ''; $('acces-err').textContent = ''; montrer('s-acces'); setTimeout(function () { $('acces-in').focus(); }, 100); }
  /* sans mot de passe général (réglage du back-office) la liste des sessions s'ouvre directement ; sinon on le demande */
  function versAcces() {
    cfg.session = null; cfg.jeton = ''; ecrireCfg(cfg);
    appelApi('acces', { mdp: '' }).then(function (j) {
      if (j.ok) { memoriserAcces(j); rendreSessions(j.sessions || []); } else ecranMdpAcces();
    }).catch(function () { ecranMdpAcces(); });
  }
  function connecter(e, mdp) {
    var a = accesStocke(); if (!a) return versAcces();
    return appelApi('session', { acces: a.acces, id: e.id, mdp: mdp }).then(function (j) {
      if (!j.ok) return j;
      var s = { jeton: j.jeton, session: j.session, exp: (Number(j.exp) || (Date.now() + 60 * 86400e3)) - 86400e3 };
      try { localStorage.setItem('vb-sess', JSON.stringify(s)); } catch (x) {}
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
  $('sess-retour').onclick = function () { try { sessionStorage.removeItem('vb-acces'); } catch (e) {} ecranMdpAcces(); };
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
  $('a-chsess').onclick = function () { if (!confirm('Fermer la session en cours et en choisir une autre ? Les vidéos déjà enregistrées restent sur la tablette.')) return; try { localStorage.removeItem('vb-sess'); } catch (e) {} cfg.session = null; cfg.jeton = ''; appliquerActif(); if (accesStocke()) listerSessions(); else versAcces(); };
  /* tablette allumée toute la journée : rechargement discret (écran d'accueil, personne en train d'enregistrer) au bout de 8 h,
     pour repartir d'une mémoire propre et récupérer les mises à jour de l'appli */
  var debutPage = Date.now();
  setInterval(function () {
    if (Date.now() - debutPage > 8 * 3600e3 && navigator.onLine && !enregistrement && $('s-accueil').classList.contains('on')) { try { location.reload(); } catch (e) {} }
  }, 10 * 60e3);
  function demarrerAppli() { var s = sessionStockee(); if (s) ouvrirSession(s); else versAcces(); }
  ouvrirDb().then(function () { demarrerAppli(); }).catch(function () { demarrerAppli(); $('etat').hidden = false; $('etat').textContent = 'Stockage de la tablette indisponible'; $('etat').classList.add('alerte'); });
})();
