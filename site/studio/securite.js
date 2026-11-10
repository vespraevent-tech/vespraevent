/* Onglet « Sauvegardes » des Paramètres : copies automatiques, récupération
   d'une réservation supprimée ou perdue. Rien ici n'écrase une donnée. */
(function () {
  function api(chemin, opts) {
    return fetch('/api/admin' + chemin, Object.assign({ credentials: 'same-origin', cache: 'no-store',
      headers: { 'content-type': 'application/json' } }, opts || {})).then(function (r) {
      return r.json().then(function (d) { if (!r.ok) throw new Error((d && d.error) || ('Erreur ' + r.status)); return d; });
    });
  }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function jour(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }
  var F = 'font:13px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;';
  var BTN = 'border:1px solid #dcd5c8;background:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;' + F;

  function msg(t, err) {
    var m = document.getElementById('sec-msg');
    if (m) { m.textContent = t || ''; m.style.color = err ? '#b3261e' : '#2f6b2f'; }
  }

  function afficher() {
    var el = document.getElementById('stab-content-securite');
    if (!el) return;
    el.innerHTML = '<div style="font:600 15px Poppins,system-ui,sans-serif;color:var(--navy);margin-bottom:6px">Sauvegardes et récupération</div>'
      + '<div style="' + F + 'line-height:1.55;margin-bottom:14px">Une copie complète (planning, clients, suivi) est faite automatiquement chaque nuit et conservée 60 jours. '
      + 'Chaque modification d’une réservation garde aussi sa version précédente, et une réservation supprimée va dans la corbeille. Rien n’est écrasé à la restauration : seul ce qui manque est remis.</div>'
      + '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><button type="button" id="sec-now" style="' + BTN + '">Sauvegarder maintenant</button>'
      + '<span id="sec-msg" style="' + F + '"></span></div>'
      + '<div id="sec-liste" style="' + F + 'margin-top:14px">Chargement…</div>';
    document.getElementById('sec-now').onclick = function () {
      msg('Sauvegarde en cours…');
      api('/sauvegardes', { method: 'POST', body: JSON.stringify({ motif: 'manuel' }) })
        .then(function (r) { msg('Sauvegarde faite : ' + r.reservations + ' réservations, ' + r.clients + ' clients.'); charger(); })
        .catch(function (e) { msg(e.message, true); });
    };
    charger();
  }

  function charger() {
    api('/sauvegardes').then(function (d) {
      var h = '<div style="font-weight:700;margin:8px 0">Sauvegardes disponibles</div>';
      if (!d.sauvegardes.length) h += '<div>Aucune pour l’instant : la première se fera cette nuit, ou cliquez « Sauvegarder maintenant ».</div>';
      else h += '<table style="width:100%;border-collapse:collapse">' + d.sauvegardes.slice(0, 15).map(function (s) {
        return '<tr style="border-bottom:1px solid #eee8dc"><td style="padding:7px 4px">' + jour(s.jour) + ' à ' + s.heure + '</td>'
          + '<td style="padding:7px 4px;color:#6b7280">' + (s.motif === 'auto' ? 'automatique' : 'manuelle') + ' · ' + s.reservations + ' réservations</td>'
          + '<td style="padding:7px 4px;text-align:right;white-space:nowrap">'
          + '<a href="/api/admin/sauvegarde?cle=' + encodeURIComponent(s.cle) + '" style="margin-right:10px">Télécharger</a>'
          + '<button type="button" data-manq="' + esc(s.cle) + '" style="' + BTN + '">Retrouver les manquantes</button></td></tr>';
      }).join('') + '</table>';
      h += '<div style="font-weight:700;margin:20px 0 8px">Réservations supprimées (corbeille)</div>';
      if (!d.corbeille.length) h += '<div>La corbeille est vide.</div>';
      else h += '<table style="width:100%;border-collapse:collapse">' + d.corbeille.slice(0, 40).map(function (c) {
        return '<tr style="border-bottom:1px solid #eee8dc"><td style="padding:7px 4px">' + esc(c.client || '(sans nom)') + '</td>'
          + '<td style="padding:7px 4px;color:#6b7280">' + jour(c.dateStart) + (c.supprimeLe ? ' · supprimée le ' + jour(c.supprimeLe.slice(0, 10)) : '') + '</td>'
          + '<td style="padding:7px 4px;text-align:right"><button type="button" data-corb="' + esc(c.cle) + '" style="' + BTN + '">Restaurer</button></td></tr>';
      }).join('') + '</table>';
      var zone = document.getElementById('sec-liste');
      zone.innerHTML = h;
      zone.querySelectorAll('[data-corb]').forEach(function (b) {
        b.onclick = function () {
          api('/restaurer', { method: 'POST', body: JSON.stringify({ source: 'corbeille', cle: b.getAttribute('data-corb') }) })
            .then(function (r) { msg(r.remises ? 'Réservation restaurée. Elle réapparaît au planning dans quelques secondes.' : 'Elle existe déjà au planning.'); if (window.vespraActualiser) window.vespraActualiser(); })
            .catch(function (e) { msg(e.message, true); });
        };
      });
      zone.querySelectorAll('[data-manq]').forEach(function (b) {
        b.onclick = function () {
          var cle = b.getAttribute('data-manq');
          msg('Comparaison en cours…');
          api('/sauvegarde-manquantes?cle=' + encodeURIComponent(cle)).then(function (r) {
            if (!r.manquantes.length) { msg('Rien ne manque : les ' + r.total + ' réservations de cette sauvegarde sont au planning.'); return; }
            var liste = r.manquantes.slice(0, 12).map(function (m) { return '• ' + (m.client || m.id) + ' (' + jour(m.dateStart) + ')'; }).join('\n');
            if (!confirm(r.manquantes.length + ' réservation(s) de cette sauvegarde ne sont plus au planning :\n\n' + liste + (r.manquantes.length > 12 ? '\n…' : '') + '\n\nLes remettre ?')) { msg(''); return; }
            api('/restaurer', { method: 'POST', body: JSON.stringify({ source: 'sauvegarde', cle: cle }) })
              .then(function (x) { msg(x.remises + ' réservation(s) remise(s) au planning.'); if (window.vespraActualiser) window.vespraActualiser(); })
              .catch(function (e) { msg(e.message, true); });
          }).catch(function (e) { msg(e.message, true); });
        };
      });
    }).catch(function (e) {
      var z = document.getElementById('sec-liste'); if (z) z.textContent = 'Impossible de charger : ' + e.message;
    });
  }
  window.vespraSecuriteAfficher = afficher;
})();
