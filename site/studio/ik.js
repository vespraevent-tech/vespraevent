/* ─────────────────────────────────────────────────────────────
   INDEMNITÉS KILOMÉTRIQUES — barème fiscal (impots.gouv / URSSAF).
   Contrairement à la note de frais carburant, l'indemnité couvre aussi
   l'usure du véhicule, l'assurance, l'entretien… Le barème est ANNUEL :
   le taux dépend du total de kilomètres de l'année. Chaque trajet est
   donc calculé comme « indemnité du cumul après − indemnité du cumul avant ».
   Barème des voitures, inchangé depuis 2023 (gelé aussi en 2026).
   ───────────────────────────────────────────────────────────── */
(function () {
  /* [jusqu'à 5 000 km : d × a] · [5 001 à 20 000 km : d × b + c] · [au-delà de 20 000 km : d × e] */
  var BAREME = {
    '3': { nom: '3 CV et moins', a: 0.529, b: 0.316, c: 1065, e: 0.370 },
    '4': { nom: '4 CV', a: 0.606, b: 0.340, c: 1330, e: 0.407 },
    '5': { nom: '5 CV', a: 0.636, b: 0.357, c: 1395, e: 0.427 },
    '6': { nom: '6 CV', a: 0.665, b: 0.374, c: 1457, e: 0.447 },
    '7': { nom: '7 CV et plus', a: 0.697, b: 0.394, c: 1515, e: 0.470 }
  };
  var el = function (id) { return document.getElementById(id); };
  var esc2 = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n, d) { return (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ','); };
  var eur = function (n) { return fmt(n, 2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €'; };
  var loc = function (k, v) { try { if (v === undefined) return localStorage.getItem('vsIK_' + k); localStorage.setItem('vsIK_' + k, v); } catch (e) {} };
  var lignes = [], charge = false;

  function ik(d, cv, elec) {
    var b = BAREME[cv] || BAREME['5'], r;
    if (d <= 5000) r = d * b.a; else if (d <= 20000) r = d * b.b + b.c; else r = d * b.e;
    return r * (elec ? 1.2 : 1);
  }
  function aujourdhui() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function jour(date) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }

  /* cumul annuel par bénéficiaire, dans l'ordre des dates : chaque ligne reçoit son indemnité */
  function calculer(liste) {
    var out = liste.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)); });
    var cumul = {};
    out.forEach(function (l) {
      var cle = l.benef + '|' + String(l.date).slice(0, 4);
      var avant = cumul[cle] || 0, apres = avant + (Number(l.km) || 0);
      l.cumul = apres; l.indemnite = Math.round((ik(apres, l.cv, l.elec) - ik(avant, l.cv, l.elec)) * 100) / 100;
      cumul[cle] = apres;
    });
    return out;
  }

  function benefs() {
    var s = el('nfBenef'), l = [];
    if (s) for (var i = 0; i < s.options.length; i++) if (s.options[i].value && s.options[i].value !== '__new__') l.push(s.options[i].value);
    return l.length ? l : ['Thomas DEL\'HOMMEAU', 'Damien MARION'];
  }

  /* ── adresse du local : point de départ de tous les trajets ── */
  var localDefaut = '';
  function adresseLocal() { return (loc('local') || '').trim() || localDefaut; }
  async function ikChargerLocal() {
    try { var e = await api('/entreprise'), p = (e && e.pub) || {}; localDefaut = [p.adresse, p.cpville].filter(Boolean).join(', '); } catch (x) {}
    var c = el('ikLocal'); if (c && !c.value) c.value = adresseLocal();
    if (legs.length && !legs[0].de) { legs[0].de = adresseLocal(); ikLegsRendre(); }
  }
  window.ikLocalSauver = function () { loc('local', el('ikLocal').value.trim()); };

  /* ── suggestions d'adresses (Base Adresse Nationale), sur une seule ligne ── */
  var ENDPOINT = 'https://api-adresse.data.gouv.fr/search/';
  function suggere(inp, choisir) {
    if (!inp || inp._sug) return; inp._sug = 1;
    var liste = document.createElement('div'); liste.className = 'ik-ad'; liste.hidden = true; inp.parentNode.appendChild(liste);
    var t = 0, jeton = 0;
    function fermer() { clearTimeout(t); jeton++; liste.hidden = true; liste.innerHTML = ''; }
    inp.addEventListener('input', function () {
      clearTimeout(t); var q = inp.value.replace(/\s+/g, ' ').trim(); if (q.length < 3) { fermer(); return; }
      var mon = ++jeton;
      t = setTimeout(function () {
        fetch(ENDPOINT + '?q=' + encodeURIComponent(q) + '&limit=5&autocomplete=1').then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function (d) {
          if (mon !== jeton) return;
          var f = (d && d.features) || []; if (!f.length) { fermer(); return; }
          liste.innerHTML = f.map(function (x, i) { var p = x.properties || {}; return '<button type="button" data-i="' + i + '"><b>' + esc2(p.name || p.label) + '</b><small>' + esc2([p.postcode, p.city].filter(Boolean).join(' ')) + '</small></button>'; }).join('');
          liste.hidden = false;
          Array.prototype.forEach.call(liste.querySelectorAll('button'), function (b) {
            b.onmousedown = function (e) { e.preventDefault(); };
            b.onclick = function () { var p = f[+b.dataset.i].properties || {}; fermer(); inp.value = p.label || p.name || ''; choisir(inp.value); };
          });
        }).catch(function () {});
      }, 260);
    });
    inp.addEventListener('blur', function () { setTimeout(fermer, 150); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer(); });
  }

  /* ── itinéraire par tronçons ── */
  var legs = [{ de: '', vers: '', km: '' }];
  function num(v) { return parseFloat(String(v).replace(',', '.')) || 0; }
  function totalLegs() { return legs.reduce(function (t, l) { return t + num(l.km); }, 0); }
  function chainer(i) {
    if (legs[i + 1] && !legs[i + 1].de) { legs[i + 1].de = legs[i].vers; var n = el('ikLegs').querySelector('input[data-i="' + (i + 1) + '"][data-k="de"]'); if (n) n.value = legs[i].vers; }
  }
  window.ikLegsRendre = function () {
    el('ikLegs').innerHTML = legs.map(function (l, i) {
      return '<div class="ik-lg" data-row="' + i + '"><button type="button" class="ik-gr" data-i="' + i + '" aria-label="Déplacer ce tronçon (glisser, ou flèches haut et bas)" title="Glisser pour déplacer"></button>' +
        '<span class="ik-aw"><input type="text" data-i="' + i + '" data-k="de" value="' + esc2(l.de) + '" placeholder="' + (i ? 'Départ du tronçon' : 'Départ (adresse du local)') + '" autocomplete="off"></span>' +
        '<span class="ik-aw"><input type="text" data-i="' + i + '" data-k="vers" value="' + esc2(l.vers) + '" placeholder="Arrivée (adresse du client)" autocomplete="off"></span>' +
        '<input type="text" inputmode="decimal" data-i="' + i + '" data-k="km" value="' + esc2(l.km) + '" placeholder="km" autocomplete="off">' +
        '<button type="button" class="ik-x" onclick="ikLegDel(' + i + ')" aria-label="Retirer ce tronçon">×</button></div>';
    }).join('');
    Array.prototype.forEach.call(el('ikLegs').querySelectorAll('input'), function (inp) {
      var i = +inp.dataset.i, k = inp.dataset.k;
      inp.oninput = function () { legs[i][k] = inp.value; if (k === 'vers') chainer(i); ikTotal(); };
      if (k === 'de' || k === 'vers') suggere(inp, function (v) { legs[i][k] = v; if (k === 'vers') chainer(i); ikTotal(); });
    });
    Array.prototype.forEach.call(el('ikLegs').querySelectorAll('.ik-gr'), ikPoignee);
    ikTotal();
  };
  /* déplacer un tronçon : glisser la poignée (souris ou doigt), ou flèches haut / bas au clavier */
  function deplacer(de, vers) { if (vers < 0 || vers >= legs.length || vers === de) return; var x = legs.splice(de, 1)[0]; legs.splice(vers, 0, x); ikLegsRendre(); }
  function ikPoignee(h) {
    h.onkeydown = function (e) { var i = +h.dataset.i; if (e.key === 'ArrowUp') { e.preventDefault(); deplacer(i, i - 1); var n = el('ikLegs').querySelector('.ik-gr[data-i="' + Math.max(0, i - 1) + '"]'); if (n) n.focus(); } if (e.key === 'ArrowDown') { e.preventDefault(); deplacer(i, i + 1); var m = el('ikLegs').querySelector('.ik-gr[data-i="' + Math.min(legs.length - 1, i + 1) + '"]'); if (m) m.focus(); } };
    h.onpointerdown = function (e) {
      e.preventDefault(); var de = +h.dataset.i, rows = Array.prototype.slice.call(el('ikLegs').querySelectorAll('.ik-lg')), cible = de;
      var ligne = rows[de]; ligne.classList.add('ik-drag'); try { h.setPointerCapture(e.pointerId); } catch (x) {}
      function ou(y) { var r = rows.map(function (n) { var b = n.getBoundingClientRect(); return b.top + b.height / 2; }), c = 0; for (var k = 0; k < r.length; k++) if (y > r[k]) c = k; if (y <= r[0]) c = 0; return c; }
      h.onpointermove = function (ev) {
        cible = ou(ev.clientY); rows.forEach(function (n, k) { n.classList.toggle('ik-au-dessus', k === cible && cible < de); n.classList.toggle('ik-en-dessous', k === cible && cible > de); });
      };
      h.onpointerup = h.onpointercancel = function () { h.onpointermove = h.onpointerup = h.onpointercancel = null; rows.forEach(function (n) { n.classList.remove('ik-drag', 'ik-au-dessus', 'ik-en-dessous'); }); if (cible !== de) deplacer(de, cible); };
    };
  }
  function ikTotal() { var t = totalLegs(); el('ikKm').value = t ? fmt(t, 1) : ''; ikAper(); }
  window.ikLegAdd = function () { var p = legs[legs.length - 1]; legs.push({ de: p ? p.vers : '', vers: '', km: '' }); ikLegsRendre(); var n = el('ikLegs').querySelectorAll('input[data-k="vers"]'); if (n.length) n[n.length - 1].focus(); };
  /* retour au point de départ : de l'arrivée précédente (le client) vers le premier départ (le local) */
  window.ikLegRetour = function () { var p = legs[legs.length - 1]; legs.push({ de: p ? p.vers : '', vers: (legs[0] && legs[0].de) || adresseLocal(), km: '' }); ikLegsRendre(); var n = el('ikLegs').querySelectorAll('input[data-k="km"]'); if (n.length) n[n.length - 1].focus(); };
  window.ikLegDel = function (i) { legs.splice(i, 1); if (!legs.length) legs.push({ de: adresseLocal(), vers: '', km: '' }); ikLegsRendre(); };

  /* ── client / événement : recherche dans les réservations et la base clients ── */
  var sans = function (x) { return String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
  function adr1(a) { return String(a || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean).join(', '); }
  function isoDe(d) { var m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(d || '')); return m ? m[3] + '-' + m[2] + '-' + m[1] : (/^\d{4}-\d{2}-\d{2}/.test(String(d || '')) ? String(d).slice(0, 10) : ''); }
  function candidats(q) {
    var n = sans(q); if (n.length < 2) return [];
    var vus = {}, out = [];
    ((typeof cache !== 'undefined' && cache.demandes) || []).forEach(function (d) {
      if (!d || !d.nom) return;
      var cle = d.resaId ? 'r' + d.resaId : 'd' + d.id; if (vus[cle]) return;
      if (sans([d.nom, d.societe, d.date, d.adresse, d.type].join(' ')).indexOf(n) < 0) return;
      vus[cle] = 1; out.push({ nom: d.nom, societe: d.societe || '', date: d.date || '', adresse: adr1(d.adresse), type: d.type || '' });
    });
    try { (typeof _clientsBase !== 'undefined' ? _clientsBase : []).forEach(function (c) {
      if (!c || c._deleted || !c.fullName) return;
      if (out.some(function (o) { return sans(o.nom) === sans(c.fullName); })) return;
      if (sans([c.fullName, c.societe, c.billAdresse].join(' ')).indexOf(n) < 0) return;
      out.push({ nom: c.fullName, societe: c.societe || '', date: '', adresse: adr1(c.billAdresse), type: '' });
    }); } catch (e) {}
    return out.slice(0, 8);
  }
  function brancherClient() {
    var inp = el('ikClient'); if (!inp || inp._cl) return; inp._cl = 1;
    var liste = document.createElement('div'); liste.className = 'ik-ad'; liste.hidden = true; inp.parentNode.style.position = 'relative'; inp.parentNode.appendChild(liste);
    function fermer() { liste.hidden = true; liste.innerHTML = ''; }
    inp.addEventListener('input', function () {
      var c = candidats(inp.value); if (!c.length) { fermer(); return; }
      liste.innerHTML = c.map(function (x, i) { return '<button type="button" data-i="' + i + '"><b>' + esc2(x.nom + (x.societe ? ' · ' + x.societe : '')) + (x.date ? ' — ' + esc2(x.date) : '') + '</b><small>' + esc2(x.adresse || 'adresse à saisir') + '</small></button>'; }).join(''); liste.hidden = false;
      Array.prototype.forEach.call(liste.querySelectorAll('button'), function (b) {
        b.onmousedown = function (e) { e.preventDefault(); };
        b.onclick = function () {
          var x = c[+b.dataset.i]; fermer();
          inp.value = x.nom + (x.date ? ' — ' + x.date : '');
          var d = isoDe(x.date); if (d) { el('ikDate').value = d; }
          if (!el('ikMotif').value.trim()) el('ikMotif').value = 'Livraison / reprise du matériel — ' + x.nom;
          /* le premier tronçon part du local ; le client est l'arrivée */
          if (!legs[0].de) legs[0].de = adresseLocal();
          if (x.adresse) { var i = legs.findIndex(function (l) { return !l.vers; }); if (i < 0) { legs.push({ de: legs[legs.length - 1].vers, vers: '', km: '' }); i = legs.length - 1; } legs[i].vers = x.adresse; if (legs[i + 1] && !legs[i + 1].de) legs[i + 1].de = x.adresse; }
          ikLegsRendre(); ikAper();
        };
      });
    });
    inp.addEventListener('blur', function () { setTimeout(fermer, 150); });
  }

  window.nfOnglet = function (v) {
    el('nfVueNotes').hidden = v !== 'notes'; el('nfVueIK').hidden = v !== 'ik';
    el('nfOngNotes').classList.toggle('on', v === 'notes'); el('nfOngIK').classList.toggle('on', v === 'ik');
    if (v === 'ik') ikOuvrir();
  };

  var localPrec = '';
  window.ikOuvrir = function () {
    var cv = el('ikCv'); if (!cv.options.length) cv.innerHTML = Object.keys(BAREME).map(function (k) { return '<option value="' + k + '">' + BAREME[k].nom + '</option>'; }).join('');
    brancherClient(); suggere(el('ikLocal'), function () { ikLocalSauver(); if (legs.length && (!legs[0].de || legs[0].de === localPrec)) { legs[0].de = el('ikLocal').value; ikLegsRendre(); } localPrec = el('ikLocal').value; });
    if (!el('ikLocal').value) el('ikLocal').value = adresseLocal(); localPrec = el('ikLocal').value;
    if (legs.length && !legs[0].de) legs[0].de = adresseLocal();
    cv.value = loc('cv') || '5'; el('ikElec').checked = loc('elec') === '1'; el('ikImmat').value = loc('immat') || '';
    var b = el('ikBenef'), cur = b.value; b.innerHTML = benefs().map(function (x) { return '<option>' + esc2(x) + '</option>'; }).join(''); if (cur) b.value = cur;
    if (!el('ikDate').value) el('ikDate').value = aujourdhui();
    ikLegsRendre();
    ikChargerLocal();
    if (!charge) ikCharger();
  };
  async function ikCharger() {
    try { lignes = (await api('/data?collection=indemnites-km')) || []; if (!Array.isArray(lignes)) lignes = [];
      lignes = lignes.filter(function (x) { return x && /^\d{4}-\d{2}-\d{2}/.test(String(x.date || '')) && Number(x.km) > 0 && x.id; }); charge = true; } catch (e) { lignes = []; }
    ikRendre();
  }
  window.ikReglages = function () { loc('cv', el('ikCv').value); loc('elec', el('ikElec').checked ? '1' : '0'); loc('immat', el('ikImmat').value.trim()); ikAper(); };

  /* aperçu : indemnité du trajet saisi, compte tenu des kilomètres déjà faits cette année */
  window.ikAper = function () {
    var km = totalLegs(), benef = el('ikBenef').value, date = el('ikDate').value || aujourdhui();
    var tmp = lignes.concat([{ id: 'zzzz~', date: date, km: km, benef: benef, cv: el('ikCv').value, elec: el('ikElec').checked }]);
    var l = calculer(tmp).filter(function (x) { return x.id === 'zzzz~'; })[0];
    el('ikApercu').innerHTML = km > 0
      ? '<b>' + eur(l.indemnite) + '</b> pour ' + fmt(km, 1) + ' km <span>· déjà ' + fmt(l.cumul - km, 0) + ' km cette année, total ' + fmt(l.cumul, 0) + ' km</span>'
      : '<span>Saisissez les kilomètres pour voir l’indemnité.</span>';
  };

  window.ikAjouter = async function () {
    var km = totalLegs(), pleins = legs.filter(function (l) { return num(l.km) > 0; });
    if (km <= 0) { if (typeof showToast === 'function') showToast('Indiquez le nombre de kilomètres', true); return; }
    var item = { id: 'ik' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), date: el('ikDate').value || aujourdhui(), motif: el('ikMotif').value.trim(), depart: (pleins[0] || {}).de ? pleins[0].de.trim() : '', arrivee: pleins.length ? String(pleins[pleins.length - 1].vers || '').trim() : '', etapes: pleins.slice(0, -1).map(function (l) { return String(l.vers || '').trim(); }).filter(Boolean).join(' > '), legs: pleins.map(function (l) { return { de: String(l.de || '').trim(), vers: String(l.vers || '').trim(), km: num(l.km) }; }), client: el('ikClient').value.trim(), immat: el('ikImmat').value.trim(), km: km,
      benef: el('ikBenef').value, cv: el('ikCv').value, elec: el('ikElec').checked };
    try {
      await api('/data', { method: 'POST', body: JSON.stringify({ collection: 'indemnites-km', item: item }) });
      lignes.push(item); legs = [{ de: adresseLocal(), vers: '', km: '' }]; ikLegsRendre(); el('ikMotif').value = ''; el('ikClient').value = ''; ikRendre(); ikAper();
      if (typeof showToast === 'function') showToast('Trajet enregistré');
    } catch (e) { if (typeof showToast === 'function') showToast('Enregistrement impossible : ' + e.message, true); }
  };
  window.ikSupprimer = async function (id) {
    if (!confirm('Supprimer ce trajet ?')) return;
    try { await api('/data?collection=indemnites-km&id=' + encodeURIComponent(id), { method: 'DELETE' }); lignes = lignes.filter(function (x) { return x.id !== id; }); ikRendre(); ikAper(); }
    catch (e) { if (typeof showToast === 'function') showToast('Suppression impossible : ' + e.message, true); }
  };

  function ikRendre() {
    var z = el('ikListe'); if (!z) return;
    ikAnnees();
    var l = calculer(lignes);
    if (!l.length) { z.innerHTML = '<div class="hint" style="padding:18px 0">Aucun trajet enregistré.</div>'; return; }
    var annees = {}; l.forEach(function (x) { var a = String(x.date).slice(0, 4); (annees[a] = annees[a] || []).push(x); });
    z.innerHTML = Object.keys(annees).sort().reverse().map(function (a) {
      var g = annees[a], km = g.reduce(function (t, x) { return t + (Number(x.km) || 0); }, 0), tot = g.reduce(function (t, x) { return t + x.indemnite; }, 0);
      return '<div class="ik-an"><div class="ik-anh"><b>' + a + '</b><span>' + fmt(km, 1) + ' km · <b>' + eur(tot) + '</b></span></div>' +
        g.slice().reverse().map(function (x) {
          return '<div class="ik-l"><div><b>' + jour(x.date) + '</b> · ' + esc2(x.motif || 'Trajet') + '<div class="ik-s">' + (x.legs && x.legs.length ? x.legs.map(function (g) { return esc2((g.de || '?') + ' → ' + (g.vers || '?')) + ' <em>' + fmt(g.km, 1) + ' km</em>'; }).join('<br>') + '<br>' : (x.depart || x.arrivee ? esc2((x.depart || '?') + ' → ' + (x.arrivee || '?')) + '<br>' : '')) + esc2(x.benef) + ' · ' + esc2((BAREME[x.cv] || {}).nom || '') + (x.elec ? ' · électrique' : '') + ' · cumul ' + fmt(x.cumul, 0) + ' km</div></div>' +
            '<div class="ik-r"><span>' + fmt(x.km, 1) + ' km</span><b>' + eur(x.indemnite) + '</b><button type="button" class="ik-x" onclick="ikSupprimer(\'' + x.id + '\')" aria-label="Supprimer">×</button></div></div>';
        }).join('') + '</div>';
    }).join('');
  }

  window.ikExport = function () {
    var l = calculer(lignes); if (!l.length) return;
    var csv = ['Date;Motif;Départ;Arrivée;Étapes;Client / événement;Bénéficiaire;Puissance;Électrique;Kilomètres;Cumul annuel (km);Indemnité (€)'].concat(l.map(function (x) {
      return [jour(x.date), x.motif || '', x.depart || '', x.arrivee || '', (x.legs && x.legs.length ? x.legs.map(function (g) { return (g.de || '?') + ' > ' + (g.vers || '?') + ' (' + fmt(g.km, 1) + ' km)'; }).join(' | ') : (x.etapes || '')), x.client || '', x.benef, (BAREME[x.cv] || {}).nom || '', x.elec ? 'oui' : 'non', fmt(x.km, 1), fmt(x.cumul, 0), fmt(x.indemnite, 2)].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';');
    })).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'indemnites-kilometriques.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
  };
  /* État justificatif : un PDF par bénéficiaire et par année, à signer et à conserver avec la carte grise */
  window.ikEtatPdf = async function () {
    var an = el('ikAnnee').value, benef = el('ikBenef').value;
    var t = lignes.filter(function (x) { return String(x.date).slice(0, 4) === an && x.benef === benef; });
    if (!t.length) { if (typeof showToast === 'function') showToast('Aucun trajet en ' + an + ' pour ' + benef, true); return; }
    var manque = t.filter(function (x) { return !x.depart || !x.arrivee; }).length;
    if (manque && !confirm(manque + ' trajet(s) sans adresse de départ ou d’arrivée : l’état sera moins solide en cas de contrôle. Continuer quand même ?')) return;
    var v = { cv: el('ikCv').value, elec: el('ikElec').checked, immat: el('ikImmat').value.trim() };
    if (!v.immat && !confirm('L’immatriculation du véhicule n’est pas renseignée. Continuer quand même ?')) return;
    try {
      var r = await fetch('/api/admin/ik-etat', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ beneficiaire: benef, annee: an, vehicule: v, trajets: t }) });
      if (!r.ok) { var j = await r.json().catch(function () { return {}; }); throw new Error(j.error || ('Erreur ' + r.status)); }
      var b = await r.blob(), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'etat-frais-km-' + an + '.pdf'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    } catch (e) { if (typeof showToast === 'function') showToast('PDF impossible : ' + e.message, true); }
  };
  function ikAnnees() {
    var s = el('ikAnnee'), cur = s.value, an = new Date().getFullYear(), set = {}; set[an] = 1;
    lignes.forEach(function (x) { set[String(x.date).slice(0, 4)] = 1; });
    s.innerHTML = Object.keys(set).sort().reverse().map(function (a) { return '<option>' + a + '</option>'; }).join(''); if (cur && set[cur]) s.value = cur;
  }
  window._ikCalc = { ik: ik, calculer: calculer, BAREME: BAREME };
})();
