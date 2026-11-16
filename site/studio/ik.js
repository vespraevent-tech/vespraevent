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

  window.nfOnglet = function (v) {
    el('nfVueNotes').hidden = v !== 'notes'; el('nfVueIK').hidden = v !== 'ik';
    el('nfOngNotes').classList.toggle('on', v === 'notes'); el('nfOngIK').classList.toggle('on', v === 'ik');
    if (v === 'ik') ikOuvrir();
  };

  window.ikOuvrir = function () {
    var cv = el('ikCv'); if (!cv.options.length) cv.innerHTML = Object.keys(BAREME).map(function (k) { return '<option value="' + k + '">' + BAREME[k].nom + '</option>'; }).join('');
    cv.value = loc('cv') || '5'; el('ikElec').checked = loc('elec') === '1';
    var b = el('ikBenef'), cur = b.value; b.innerHTML = benefs().map(function (x) { return '<option>' + esc2(x) + '</option>'; }).join(''); if (cur) b.value = cur;
    if (!el('ikDate').value) el('ikDate').value = aujourdhui();
    ikAper();
    if (!charge) ikCharger();
  };
  async function ikCharger() {
    try { lignes = (await api('/data?collection=indemnites-km')) || []; if (!Array.isArray(lignes)) lignes = [];
      lignes = lignes.filter(function (x) { return x && /^\d{4}-\d{2}-\d{2}/.test(String(x.date || '')) && Number(x.km) > 0 && x.id; }); charge = true; } catch (e) { lignes = []; }
    ikRendre();
  }
  window.ikReglages = function () { loc('cv', el('ikCv').value); loc('elec', el('ikElec').checked ? '1' : '0'); ikAper(); };

  /* aperçu : indemnité du trajet saisi, compte tenu des kilomètres déjà faits cette année */
  window.ikAper = function () {
    var km = parseFloat(String(el('ikKm').value).replace(',', '.')) || 0, benef = el('ikBenef').value, date = el('ikDate').value || aujourdhui();
    var tmp = lignes.concat([{ id: 'zzzz~', date: date, km: km, benef: benef, cv: el('ikCv').value, elec: el('ikElec').checked }]);
    var l = calculer(tmp).filter(function (x) { return x.id === 'zzzz~'; })[0];
    el('ikApercu').innerHTML = km > 0
      ? '<b>' + eur(l.indemnite) + '</b> pour ' + fmt(km, 1) + ' km <span>· déjà ' + fmt(l.cumul - km, 0) + ' km cette année, total ' + fmt(l.cumul, 0) + ' km</span>'
      : '<span>Saisissez les kilomètres pour voir l’indemnité.</span>';
  };

  window.ikAjouter = async function () {
    var km = parseFloat(String(el('ikKm').value).replace(',', '.')) || 0;
    if (km <= 0) { if (typeof showToast === 'function') showToast('Indiquez le nombre de kilomètres', true); return; }
    var item = { id: 'ik' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), date: el('ikDate').value || aujourdhui(), motif: el('ikMotif').value.trim(), km: km,
      benef: el('ikBenef').value, cv: el('ikCv').value, elec: el('ikElec').checked };
    try {
      await api('/data', { method: 'POST', body: JSON.stringify({ collection: 'indemnites-km', item: item }) });
      lignes.push(item); el('ikKm').value = ''; el('ikMotif').value = ''; ikRendre(); ikAper();
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
    var l = calculer(lignes);
    if (!l.length) { z.innerHTML = '<div class="hint" style="padding:18px 0">Aucun trajet enregistré.</div>'; return; }
    var annees = {}; l.forEach(function (x) { var a = String(x.date).slice(0, 4); (annees[a] = annees[a] || []).push(x); });
    z.innerHTML = Object.keys(annees).sort().reverse().map(function (a) {
      var g = annees[a], km = g.reduce(function (t, x) { return t + (Number(x.km) || 0); }, 0), tot = g.reduce(function (t, x) { return t + x.indemnite; }, 0);
      return '<div class="ik-an"><div class="ik-anh"><b>' + a + '</b><span>' + fmt(km, 1) + ' km · <b>' + eur(tot) + '</b></span></div>' +
        g.slice().reverse().map(function (x) {
          return '<div class="ik-l"><div><b>' + jour(x.date) + '</b> · ' + esc2(x.motif || 'Trajet') + '<div class="ik-s">' + esc2(x.benef) + ' · ' + esc2((BAREME[x.cv] || {}).nom || '') + (x.elec ? ' · électrique' : '') + ' · cumul ' + fmt(x.cumul, 0) + ' km</div></div>' +
            '<div class="ik-r"><span>' + fmt(x.km, 1) + ' km</span><b>' + eur(x.indemnite) + '</b><button type="button" class="ik-x" onclick="ikSupprimer(\'' + x.id + '\')" aria-label="Supprimer">×</button></div></div>';
        }).join('') + '</div>';
    }).join('');
  }

  window.ikExport = function () {
    var l = calculer(lignes); if (!l.length) return;
    var csv = ['Date;Motif;Bénéficiaire;Puissance;Électrique;Kilomètres;Cumul annuel (km);Indemnité (€)'].concat(l.map(function (x) {
      return [jour(x.date), x.motif || '', x.benef, (BAREME[x.cv] || {}).nom || '', x.elec ? 'oui' : 'non', fmt(x.km, 1), fmt(x.cumul, 0), fmt(x.indemnite, 2)].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';');
    })).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'indemnites-kilometriques.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
  };
  window._ikCalc = { ik: ik, calculer: calculer, BAREME: BAREME };
})();
