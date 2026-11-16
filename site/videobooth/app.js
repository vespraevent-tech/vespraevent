/* Vidéobooth Vespra Event — appli tablette.
   Les vidéos sont d'abord gardées dans la tablette (IndexedDB), puis envoyées au serveur dès qu'il y a du réseau. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var CFG0 = { event: '', titre: 'Enregistrer un souvenir', sous: 'Laissez un petit message vidéo de 30 secondes', serveur: '', cle: '', max: 30, cam: '', pin: '0104' };
  function lireCfg() { try { return Object.assign({}, CFG0, JSON.parse(localStorage.getItem('vb-cfg') || '{}')); } catch (e) { return Object.assign({}, CFG0); } }
  function ecrireCfg(c) { try { localStorage.setItem('vb-cfg', JSON.stringify(c)); } catch (e) {} }
  var cfg = lireCfg(); if (!cfg.pin) cfg.pin = '0104';

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
  function montrer(id) { document.querySelectorAll('.ecran').forEach(function (e) { e.classList.toggle('on', e.id === id); }); }
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
  function arreterCam() { if (flux) { flux.getTracks().forEach(function (t) { t.stop(); }); flux = null; } $('v-live').srcObject = null; }
  function ouvrirCam() {
    montrer('s-cam'); $('s-cam').classList.remove('flou'); $('cam-err').hidden = true; $('compte').hidden = true; $('rec').hidden = true; $('barre').hidden = true;
    $('b-go').hidden = true; $('b-stop').hidden = true; enregistrement = false;
    var contraintes = { audio: { echoCancellation: true, noiseSuppression: true }, video: Object.assign(cfg.cam ? { deviceId: { exact: cfg.cam } } : { facingMode: 'user' }, window.innerHeight > window.innerWidth ? { width: { ideal: 1080 }, height: { ideal: 1440 } } : { width: { ideal: 1440 }, height: { ideal: 1080 } }) };
    arreterCam();
    navigator.mediaDevices.getUserMedia(contraintes).then(function (s) {
      flux = s; $('b-go').hidden = false; $('v-live').srcObject = s; $('v-live').play().catch(function () {});
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
    try { rec = mime ? new MediaRecorder(flux, { mimeType: mime, videoBitsPerSecond: 3000000 }) : new MediaRecorder(flux); } catch (e) { rec = new MediaRecorder(flux); }
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
  var envoiEnCours = false, dernierMsg = '';
  function majEtat() {
    toutes().then(function (l) {
      var att = l.filter(function (v) { return !v.envoye; }).length, tot = l.length;
      var txt = att ? (att + ' vidéo' + (att > 1 ? 's' : '') + ' en attente d’envoi') : (tot ? 'Toutes les vidéos sont envoyées' : '');
      var el = $('etat'); el.textContent = [cfg.event, txt].filter(Boolean).join(' · '); el.classList.toggle('alerte', att > 20);
      $('a-file').textContent = tot + ' vidéo(s) gardée(s) sur la tablette, dont ' + (tot - att) + ' envoyée(s)' + (att ? ' — ' + att + ' en attente' : '') + (dernierMsg ? ' — ' + dernierMsg : '');
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
          return envoyer(v).then(function (rep) { dernierMsg = (rep && rep.mail === false) ? 'vidéo envoyée au site, mais e-mail non parti : ' + (rep.mailErreur || '') : ''; v.envoye = true; v.envoyeLe = new Date().toISOString(); v.mail = !(rep && rep.mail === false); return ajouter(v); }).catch(function (e) { dernierMsg = 'envoi impossible (' + (e.message || 'réseau') + '), nouvel essai automatique'; v.essais = (v.essais || 0) + 1; return ajouter(v); });
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
  function ouvrirAdmin() {
    $('a-event').value = cfg.event; $('a-titre').value = cfg.titre; $('a-sous').value = cfg.sous; $('a-serveur').value = cfg.serveur; $('a-cle').value = cfg.cle; $('a-max').value = cfg.max;
    var sel = $('a-cam'); sel.innerHTML = '<option value="">Caméra avant (par défaut)</option>';
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) navigator.mediaDevices.enumerateDevices().then(function (d) { d.filter(function (x) { return x.kind === 'videoinput'; }).forEach(function (x, i) { var o = document.createElement('option'); o.value = x.deviceId; o.textContent = x.label || ('Caméra ' + (i + 1)); if (x.deviceId === cfg.cam) o.selected = true; sel.appendChild(o); }); }).catch(function () {});
    majEtat(); montrer('s-admin');
  }
  $('a-save').onclick = function () {
    cfg.event = $('a-event').value.trim(); cfg.titre = $('a-titre').value.trim() || CFG0.titre; cfg.sous = $('a-sous').value.trim(); cfg.serveur = $('a-serveur').value.trim(); cfg.cle = $('a-cle').value.trim();
    cfg.max = Math.min(120, Math.max(5, Number($('a-max').value) || 30)); cfg.cam = $('a-cam').value;
    ecrireCfg(cfg); accueil(); synchro();
  };
  $('a-sync').onclick = function () { dernierMsg = 'envoi en cours…'; majEtat(); synchro().then(majEtat); };
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
  ouvrirDb().then(function () { accueil(); synchro(); }).catch(function () { accueil(); $('etat').textContent = 'Stockage de la tablette indisponible'; $('etat').classList.add('alerte'); });
})();
