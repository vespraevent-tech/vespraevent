/* Prestataires partenaires : mandats, fonds de tiers à reverser, export comptable.
   Principe : le prestataire réalise et facture sa prestation ; Vespra Event encaisse pour son compte
   (fonds de tiers, hors chiffre d'affaires et hors TVA) et ne garde que l'« Organisation et coordination ». */
(function(){
  'use strict';
  var CLE = 'vespraMandats';
  function lire(){ try { var v = JSON.parse(localStorage.getItem(CLE) || '{}'); return (v && typeof v === 'object') ? v : {}; } catch (e) { return {}; } }
  function ecrire(m){ try { localStorage.setItem(CLE, JSON.stringify(m)); } catch (e) { alert('Enregistrement impossible (espace plein ?).'); return; } if (typeof fbWrite === 'function') fbWrite('mandats', m); }
  function esc(x){ return String(x == null ? '' : x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function iso(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
  function fr(d){ var x = String(d||'').split('-'); return x.length === 3 ? x[2] + '/' + x[1] + '/' + x[0] : ''; }
  function eur(n){ return (Math.round((Number(n)||0)*100)/100).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €'; }

  /* statut : valide / à renouveler (moins de 30 jours) / expiré / absent */
  function statut(m){
    if (!m || !m.signe) return 'absent';
    if (!m.expire) return 'valide';
    var auj = iso(new Date());
    if (m.expire < auj) return 'expiré';
    var lim = new Date(); lim.setDate(lim.getDate() + 30);
    return m.expire <= iso(lim) ? 'à renouveler' : 'valide';
  }
  window.getMandats = lire;
  window.statutMandat = function(id){ return statut(lire()[id]); };
  window.mandatValide = function(id){ var s = statut(lire()[id]); return s === 'valide' || s === 'à renouveler'; };
  window.montantOrgaDefaut = function(id){ var m = lire()[id]; return m && Number(m.orga) > 0 ? Number(m.orga) : 0; };

  /* ── fonds de tiers : lignes à reverser ── */
  function lignesTiers(){
    var out = [];
    (window.R || []).forEach(function(r){
      if (r._deleted) return;
      (r.supplements || []).forEach(function(x, i){
        if (!x || !x.tiers) return;
        out.push({ r: r, i: i, id: x.prestataire || '', montant: Number(x.prix) || 0, reverse: x.reverse === true, date: x.reverseDate || '' });
      });
    });
    return out;
  }
  function nomPrest(id){ var p = (window.pkPrestataire && window.pkPrestataire(id)); return p ? p.nom : (id || '—'); }

  window.marquerReverse = function(resaId, i, sur){
    var r = (window.R || []).filter(function(x){ return String(x.id) === String(resaId); })[0];
    if (!r || !r.supplements || !r.supplements[i]) return;
    var x = r.supplements[i];
    if (sur === false) { x.reverse = false; x.reverseDate = ''; }
    else {
      var d = prompt('Date du reversement (AAAA-MM-JJ)', iso(new Date()));
      if (d === null) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.trim())) { alert('Date invalide.'); return; }
      x.reverse = true; x.reverseDate = d.trim();
    }
    if (typeof enregistrerResa === 'function') enregistrerResa(r);
    if (typeof renderCA === 'function') { try { renderCA(); } catch (e) {} }
    else if (typeof showSection === 'function') { /* l'affichage se rafraîchit au prochain rendu */ }
    window.rafraichirTiers && window.rafraichirTiers();
  };

  window.fondsTiersHTML = function(){
    var l = lignesTiers(), par = {};
    l.forEach(function(t){ var p = par[t.id] = par[t.id] || { aRev: 0, rev: 0, n: 0 }; if (t.reverse) p.rev += t.montant; else p.aRev += t.montant; p.n++; });
    var ids = Object.keys(par);
    var h = '<div id="fonds-tiers" style="background:#fff;border:1px solid #eee8dc;border-radius:14px;padding:18px 20px;margin-bottom:14px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">'
      + '<div style="font:700 11px Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8a8f98">Fonds de tiers à reverser</div>'
      + '<div style="display:flex;gap:8px"><button class="dp-b sup" onclick="ouvrirMandats()">Mandats</button><button class="dp-b sup" onclick="exporterFondsTiers()">Export CSV</button></div></div>';
    if (!ids.length) return h + '<div style="font:13px Inter,system-ui,sans-serif;color:#8a8f98">Aucune prestation de prestataire partenaire.</div></div>';
    ids.forEach(function(id){
      var p = par[id];
      h += '<div style="padding:10px 0;border-top:1px solid #f1ede3">'
        + '<div style="display:flex;justify-content:space-between;gap:10px;font:600 14px Inter,system-ui,sans-serif"><span>' + esc(nomPrest(id)) + '</span><span>' + eur(p.aRev) + ' à reverser</span></div>'
        + '<div style="font:12px Inter,system-ui,sans-serif;color:#8a8f98">Déjà reversé : ' + eur(p.rev) + ' · ces montants ne sont pas du chiffre d’affaires de Vespra</div>';
      l.filter(function(t){ return t.id === id; }).sort(function(a,b){ return String(a.r.dateStart).localeCompare(String(b.r.dateStart)); }).forEach(function(t){
        h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font:12.5px Inter,system-ui,sans-serif;padding:5px 0">'
          + '<span>' + esc(fr(t.r.dateStart)) + ' · ' + esc(t.r.client || '') + '</span>'
          + '<span style="white-space:nowrap">' + eur(t.montant) + ' ' + (t.reverse
            ? '<span style="color:#2c7a4b">reversé le ' + esc(fr(t.date)) + '</span> <a href="#" style="color:#8a93a3" onclick="marquerReverse(\'' + esc(t.r.id) + '\',' + t.i + ',false);return false">annuler</a>'
            : '<button class="dp-b sup" onclick="marquerReverse(\'' + esc(t.r.id) + '\',' + t.i + ')">Marquer comme reversé</button>') + '</span></div>';
      });
      h += '</div>';
    });
    return h + '</div>';
  };
  window.rafraichirTiers = function(){
    var el = document.getElementById('fonds-tiers');
    if (el) el.outerHTML = window.fondsTiersHTML();
  };

  /* export pour l'expert-comptable */
  window.exporterFondsTiers = function(){
    var l = lignesTiers().sort(function(a,b){ return (a.id + a.r.dateStart).localeCompare(b.id + b.r.dateStart); });
    var q = function(v){ return '"' + String(v == null ? '' : v).replace(/"/g,'""') + '"'; };
    var rows = [['Prestataire','Date événement','Client','Réservation','Montant encaissé pour son compte (€)','Statut','Date de reversement'].map(q).join(';')];
    l.forEach(function(t){
      rows.push([nomPrest(t.id), t.r.dateStart || '', t.r.client || '', t.r.id, t.montant.toFixed(2).replace('.', ','), t.reverse ? 'reversé' : 'à reverser', t.date].map(q).join(';'));
    });
    var blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'fonds-de-tiers-' + iso(new Date()) + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  /* ── fenêtre « Mandats » ── */
  window.ouvrirMandats = function(focusId){
    var ancien = document.getElementById('mandats-modal'); if (ancien) ancien.remove();
    var m = lire(), ov = document.createElement('div');
    ov.id = 'mandats-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,20,30,.5);z-index:100000;display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto';
    var couleur = { 'valide': '#2c7a4b', 'à renouveler': '#b7791f', 'expiré': '#b03a2a', 'absent': '#8a8f98' };
    var h = '<div style="background:#fff;border-radius:16px;max-width:640px;width:100%;padding:22px;font-family:Inter,system-ui,sans-serif">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b style="font-size:18px">Mandats des prestataires</b><button type="button" class="dp-b sup" onclick="document.getElementById(\'mandats-modal\').remove()">Fermer</button></div>'
      + '<p style="font-size:12.5px;color:#6b7280;margin:0 0 14px">Un mandat-cadre par prestataire, signé une fois, valable pour toutes ses prestations. Tant qu’il est valide, les prestations peuvent être ajoutées sans alerte.</p>';
    (window.PRESTATAIRES || []).forEach(function(p){
      var x = m[p.id] || {}, st = statut(x);
      h += '<div data-mid="' + p.id + '" style="border:1px solid ' + (focusId === p.id ? '#F59E0B' : '#e7e1d4') + ';border-radius:12px;padding:14px;margin-bottom:12px">'
        + '<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:8px"><b>' + esc(p.libelle) + ' — ' + esc(p.nom) + '</b><span style="font-weight:700;font-size:12px;color:' + couleur[st] + '">' + (st === 'absent' ? 'aucun mandat' : st) + '</span></div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;font-weight:600;color:#4a5160">'
        + '<label>Date de signature<input type="date" data-k="signe" value="' + esc(x.signe || '') + '" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #cfc8ba;border-radius:8px"></label>'
        + '<label>Date d’expiration (renouvelable)<input type="date" data-k="expire" value="' + esc(x.expire || '') + '" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #cfc8ba;border-radius:8px"></label>'
        + '<label style="grid-column:1/-1">Montant « Organisation » par défaut (€ TTC)<input type="text" inputmode="decimal" data-k="orga" value="' + esc(x.orga || '') + '" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #cfc8ba;border-radius:8px"></label>'
        + '</div><div style="margin-top:10px;font-size:12.5px">'
        + (x.pdf ? '<a href="' + esc(x.pdf) + '" download="mandat-' + esc(p.id) + '.pdf" style="color:#2B4A6B;font-weight:600">Mandat signé (PDF)</a> · ' : '')
        + '<label style="cursor:pointer;color:#2B4A6B;font-weight:600">' + (x.pdf ? 'Remplacer le PDF' : 'Ajouter le PDF signé') + '<input type="file" accept="application/pdf" data-k="pdf" style="display:none"></label></div></div>';
    });
    h += '<div style="text-align:right"><button type="button" id="mandats-ok" class="pk-btn plein">Enregistrer</button></div></div>';
    ov.innerHTML = h; document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if (e.target === ov) ov.remove(); });
    var pdfs = {};
    ov.querySelectorAll('input[type=file]').forEach(function(f){
      f.onchange = function(){
        var file = f.files && f.files[0]; if (!file) return;
        if (file.type !== 'application/pdf' || file.size > 1500000) { alert('Un PDF de 1,5 Mo maximum, svp.'); f.value = ''; return; }
        var rd = new FileReader(), id = f.closest('[data-mid]').getAttribute('data-mid');
        rd.onload = function(){ pdfs[id] = String(rd.result); f.parentNode.firstChild.textContent = 'PDF prêt : ' + file.name; };
        rd.readAsDataURL(file);
      };
    });
    document.getElementById('mandats-ok').onclick = function(){
      var nv = lire();
      ov.querySelectorAll('[data-mid]').forEach(function(bloc){
        var id = bloc.getAttribute('data-mid'), x = nv[id] || {};
        bloc.querySelectorAll('[data-k]').forEach(function(i){
          var k = i.getAttribute('data-k');
          if (k === 'pdf') return;
          var v = String(i.value || '').trim();
          if (k === 'orga') { v = Number(v.replace(',', '.')); x.orga = (isFinite(v) && v >= 0 && v <= 5000) ? v : 0; }
          else x[k] = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
        });
        if (pdfs[id]) x.pdf = pdfs[id];
        if (x.signe && x.expire && x.expire < x.signe) { alert('La date d’expiration précède la signature.'); throw new Error('dates'); }
        nv[id] = x;
      });
      ecrire(nv); ov.remove(); window.rafraichirTiers && window.rafraichirTiers();
    };
  };

  /* récapitulatif interne en clair : part prestataire à reverser, part Vespra HT, TVA, total client */
  window.recapPrestaHTML = function(r){
    var sp = (r.supplements || []).filter(function(x){ return x && (x.tiers || x.organisation); });
    if (!sp.length) return '';
    var tiers = 0, orga = 0;
    sp.forEach(function(x){ if (x.tiers) tiers += Number(x.prix) || 0; else orga += Number(x.prix) || 0; });
    var ht = Math.round(orga / 1.2 * 100) / 100, tva = Math.round((orga - ht) * 100) / 100;
    var l = function(a, b, fort){ return '<div style="display:flex;justify-content:space-between;gap:10px;font-size:12.5px;' + (fort ? 'font-weight:700;' : '') + '"><span>' + a + '</span><span>' + b + '</span></div>'; };
    return '<div style="margin:8px 0;padding:10px 12px;background:#faf8f3;border:1px solid #e7e1d4;border-radius:10px;font-family:Inter,system-ui,sans-serif">'
      + '<div style="font:700 11px Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8a8f98;margin-bottom:6px">Récapitulatif interne — prestataire</div>'
      + l('Part prestataire à reverser', eur(tiers)) + l('Part Vespra HT', eur(ht)) + l('TVA (20 %)', eur(tva)) + l('Total client (prestation)', eur(tiers + orga), true) + '</div>';
  };

  /* lien « mandat » visible depuis une réservation contenant une prestation de prestataire */
  window.mandatLienHTML = function(r){
    var ids = {};
    (r.supplements || []).forEach(function(x){ if (x && x.tiers && x.prestataire) ids[x.prestataire] = 1; });
    return Object.keys(ids).map(function(id){
      var st = statut(lire()[id]), ok = st === 'valide' || st === 'à renouveler';
      return '<div class="dp-l" style="justify-content:flex-start;gap:8px;font-size:12.5px"><a href="#" onclick="ouvrirMandats(\'' + id + '\');return false" style="color:#2B4A6B;font-weight:600">Mandat ' + esc(nomPrest(id)) + '</a>'
        + '<span style="color:' + (ok ? '#2c7a4b' : '#b03a2a') + '">' + (ok ? st : (st === 'absent' ? 'aucun mandat valide — à faire signer' : st + ' — à renouveler')) + '</span></div>';
    }).join('');
  };
})();
