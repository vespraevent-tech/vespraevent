/* ═════════════════════════════════════════════════════════════════
   NOUVELLE VUE DU PLANNING — même thème que le reste du back-office

   • Vue planning : semaines de mardi à lundi, pour que le week-end
     (vendredi → lundi) tienne sur une seule ligne. Chaque réservation
     est une barre ; on la glisse pour la déplacer (la durée est gardée)
     et on glisse sur des jours vides pour en créer une.
   • Vue tableau : une ligne par réservation, comme sous Excel.
   • Un clic sur une réservation ou une ligne ouvre la fiche : client en
     haut, matériel et total en bas.

   Ce fichier ne touche ni aux prix, ni au stock, ni à l'enregistrement :
   il ne change que l'affichage et le déplacement des barres.
   ═════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__vueNouvelle) return;
  window.__vueNouvelle = true;
  if (window.__vueAttente) clearTimeout(window.__vueAttente);

  var JOURS = ['Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim', 'Lun'];
  var recherche = '';

  /* ── Thème : mêmes couleurs et même police que le back-office ── */
  var css = [
    ':root{--navy:#2B4A6B;--deep:#1e3650;--cream:#F6F8FB;--ink:#6B7280;--char:#374151}',
    'body{background:#F6F8FB;font-family:Inter,system-ui,sans-serif}',
    '.page{max-width:none;padding:0}',
    '.pt{font:700 21px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#0C0F14}',
    '.vn-bar{display:flex;gap:10px;align-items:center;margin:14px 0 12px;flex-wrap:wrap}',
    '.vn-seg{display:flex;border:1px solid #D8DDE5;border-radius:10px;background:#fff;overflow:hidden}',
    '.vn-seg button{border:0;background:#fff;padding:9px 16px;font:700 13px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#374151;cursor:pointer}',
    '.vn-seg button.a{background:#2B4A6B;color:#fff}',
    '.vn-nav{display:flex;align-items:center;gap:8px}',
    '.vn-nav button{border:1px solid #D8DDE5;background:#fff;border-radius:8px;padding:6px 11px;font:700 14px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#374151;cursor:pointer}',
    '.vn-nav span{min-width:120px;text-align:center;font:500 14px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#374151;white-space:nowrap}',
    '.vn-q{flex:1;min-width:180px;border:1px solid #D8DDE5;background:#fff;border-radius:10px;padding:10px 14px;font:13px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#0C0F14}',
    '.vn-card{background:#fff;border:1px solid #D8DDE5;border-radius:12px;overflow:hidden}',
    '.vn-table-card{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch}',
    '.vn-table-card .vn-tbl{min-width:900px}',
    '.vn-hh{display:grid;grid-template-columns:repeat(7,1fr);background:#F3F5F8;border-bottom:1px solid #D8DDE5}',
    '.vn-hh div{padding:9px 10px;font:700 11px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#6B7280}',
    '.vn-wk{position:relative;display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid #EEF1F5}',
    '.vn-wk:last-child{border-bottom:0}',
    '.vn-wk .day{grid-row:1/-1;min-height:0;height:auto;overflow:visible;padding:6px 0 0 9px;border:0;border-right:1px solid #E6EAF0;background:#fff;cursor:crosshair;position:relative}',
    '.vn-wk .day:nth-child(7){border-right:0}',
    '.vn-wk .day.autre{background:#FAFBFD}',
    '.vn-wk .day .n{font:700 12px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#374151}',
    '.vn-wk .day.autre .n{color:#b6bcc6}',
    '.vn-wk .day.today .n{background:#2B4A6B;color:#fff;border-radius:20px;padding:2px 7px}',
    '.vn-wk .day.selecting{background:#E8EFF7!important}',
    '.vn-wk .day.sel-anchor{background:#D5E3F2!important}',
    '.vn-wk .day.dragover{background:#E8EFF7!important;outline:2px dashed #2B4A6B;outline-offset:-2px}',
    '.vn-wk .span-ev{position:relative;z-index:1;height:auto;min-height:0;margin:2px 3px;padding:4px 9px;border-radius:7px;font:500 12px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;line-height:1.25;border:1px solid rgba(0,0,0,.12);justify-content:space-between;gap:8px;cursor:grab;user-select:none}',
    '.vn-wk .span-ev.cl{border-top-left-radius:0;border-bottom-left-radius:0;margin-left:0}',
    '.vn-wk .span-ev.cr{border-top-right-radius:0;border-bottom-right-radius:0;margin-right:0}',
    '.vn-wk .span-ev span.t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
    '.vn-wk .span-ev b{font-weight:500}.vn-wk .span-ev small{font-weight:400;opacity:.85;margin-left:8px}',
    '.vn-led{flex:none;display:inline-block;width:8px;height:8px;border-radius:2px;border:0;box-shadow:none}',
    '.vn-led.oui{background:#A9D89B}.vn-led.non{background:#E27F75}',
    '.vn-leg{display:flex;gap:16px;align-items:center;margin:-2px 0 10px;font:600 12px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#374151}.vn-leg span{display:inline-flex;align-items:center;gap:6px}',
    '.vn-wk .span-ev i u{width:9px;height:9px;border-radius:2px;border:1px solid rgba(255,255,255,.75);text-decoration:none;display:block}',
    '.vn-sel-actif .span-ev{pointer-events:none}',
    '.vn-tbl{width:100%;border-collapse:collapse;font:13px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif}',
    '.vn-tbl th{text-align:left;background:#F3F5F8;color:#6B7280;font:700 11px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:10px 12px;border-bottom:1px solid #D8DDE5;border-right:1px solid #D8DDE5}',
    '.vn-tbl td{padding:9px 12px;border-bottom:1px solid #EEF1F5;border-right:1px solid #EEF1F5;white-space:nowrap}',
    '.vn-tbl .vn-note{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;font-size:11.5px;font-style:italic;color:#6B7280}',
    '.vn-tbl td.prod{max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.vn-tbl tbody tr{cursor:pointer}.vn-tbl tbody tr.att{cursor:pointer}.vn-tbl tbody tr:nth-child(even) td{background:#FAFBFD}.vn-tbl tbody tr:hover td{background:#EEF3F8}',
    '.vn-tbl .m,.vn-tbl th.m{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}.vn-tbl th.m{font-weight:800}.vn-tbl{table-layout:auto}.vn-tbl td.m,.vn-tbl th.m{width:1%;white-space:nowrap;padding-right:18px}',
    '.vn-st{border-radius:20px;padding:3px 10px;font:700 11.5px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif}.vn-st.v{background:#E6F4EA;color:#14532D}.vn-st.w{background:#FEF3C7;color:#92400E}.vn-st.c{background:#DBEAFE;color:#1E3A8A}',
    '.vn-tot{display:flex;justify-content:space-between;padding:11px 14px;background:#F3F5F8;border-top:1px solid #D8DDE5;font:700 13px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif}',
    '.vn-vide{padding:30px;text-align:center;color:#6B7280}',
    '.vn-sel-tooltip{}',
    /* fenêtres : bords arrondis, bleu du back-office */
    '.modalbg{background:rgba(12,15,20,.42)}',
    '.modal{border-radius:14px;max-width:720px;box-shadow:0 24px 70px rgba(12,15,20,.35)}',
    '.mhead h2,#detailTitle{font:700 21px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#0C0F14}',
    '.btn.primary,.btn.pri,#saveM,#editRes{background:#2B4A6B!important;color:#fff!important;border-color:#2B4A6B!important;border-radius:10px}',
    '.detail-label{font:600 11px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;letter-spacing:.08em;color:#6B7280}',
    '.vn-num{margin-left:10px;font:600 13px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#2B4A6B;background:#EAF0F7;border-radius:8px;padding:3px 9px;vertical-align:middle;white-space:nowrap}',
    '.detail-row.vn-sep{border-top:1px solid #EEF1F5;padding-top:12px;margin-top:4px}',
    '.fab{background:#2B4A6B!important;color:#fff!important;font:300 36px/52px Inter,system-ui,Arial,sans-serif!important;text-align:center;padding:0!important}',
    /* fiche d'une réservation */
    '#detailMb .modal{max-width:600px;padding-bottom:0;overflow:hidden;display:flex;flex-direction:column}',
    '#detailMb .mhead{align-items:flex-start;padding:22px 26px 14px;border-bottom:1px solid #EEF1F5}',
    '#detailTitle{font:700 22px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;line-height:1.2}',
    '.vn-sous{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:8px;font:600 13.5px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#374151}',
    '.vn-sous em{font-style:normal;font-weight:500;color:#6B7280}',
    '#detailMb .detail-grid{padding:12px 26px 6px;gap:14px 26px;overflow-y:auto;flex:1}',
    '#detailMb .detail-row.full{border-top:1px solid #EEF1F5;padding-top:12px}',
    '#detailMb .detail-actions{background:#F3F5F8;border-top:1px solid #D8DDE5!important;padding:14px 26px!important}',
    '#detailMb .detail-actions .btn{border-radius:10px;padding:10px 16px;font:700 13px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;border:1px solid #D8DDE5;background:#fff;color:#374151;cursor:pointer}',
    '#detailMb .detail-actions .btn:hover{border-color:#2B4A6B;color:#2B4A6B}',
    '#detailMb #vnFacture{border-color:#2B4A6B;color:#2B4A6B}',
    '#detailMb #editRes{background:#2B4A6B;border-color:#2B4A6B;color:#fff}',
    '#detailMb #editRes:hover{background:#1e3650;color:#fff}',
    '#detailMb #deleteRes{color:#B91C1C;border-color:#F5C2C2}',
    '#detailMb #deleteRes:hover{background:#FEF2F2;border-color:#B91C1C;color:#B91C1C}'
  ].join('\n');
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  /* ── Outils ── */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dateDe(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function ajoute(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function jours(a, b) { return Math.round((dateDe(b) - dateDe(a)) / 86400000); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function sansAccent(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function euro(n) { return (Math.round(n * 100) / 100).toLocaleString('fr-FR') + ' €'; }

  /* ── Numéros de devis / facture ── */
  var NUM = { devis: {}, factures: {} };
  function chargerNumeros() {
    return fetch('/api/admin/numeros', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        var avant = JSON.stringify(NUM);
        NUM = { devis: d.devis || {}, factures: d.factures || {} };
        if (JSON.stringify(NUM) !== avant) {
          if (recherche && recherche.trim() && typeof window.planning === 'function' && window.page === 'planning') { sauterVersResultat(); window.planning(); }
          var t = document.getElementById('detailTitle');
          if (t && window.currentDetailId) marquerNumero(window.currentDetailId);
        }
      }).catch(function () {});
  }
  /* ids sous lesquels un document peut être numéroté : la réservation, ou la demande dont elle vient */
  function idsDocs(id) {
    var ids = [String(id)];
    try {
      ((window.parent && window.parent.cache && window.parent.cache.demandes) || []).forEach(function (d) {
        if (d && d.resaId && String(d.resaId) === String(id)) ids.push(String(d.id));
      });
    } catch (e) {}
    return ids;
  }
  function numerosDe(id) {
    var out = [];
    idsDocs(id).forEach(function (i) {
      if (NUM.factures[i] && out.indexOf(NUM.factures[i]) < 0) out.push(NUM.factures[i]);
      if (NUM.devis[i] && out.indexOf(NUM.devis[i]) < 0) out.push(NUM.devis[i]);
    });
    return out;
  }
  window.numerosDocsResa = numerosDe;
  function marquerNumero(id) {
    var titre = document.getElementById('detailTitle');
    if (!titre) return;
    var ancien = titre.querySelector('.vn-num');
    if (ancien) ancien.remove();
    var nums = numerosDe(id);
    if (!nums.length) return;
    var sp = document.createElement('span');
    sp.className = 'vn-num';
    sp.textContent = nums.map(function (n) { return (/^D/.test(n) ? 'Devis ' : 'Facture ') + n; }).join(' · ');
    var sous = titre.querySelector('.vn-sous');
    if (sous) titre.insertBefore(sp, sous); else titre.appendChild(sp);
  }

  /* En planning, une recherche qui ne donne rien dans le mois affiché
     saute au mois de la réservation la plus proche. */
  function sauterVersResultat() {
    var q = recherche.trim();
    if (!q || window.calView === 'table') return;
    var l = visibles();
    if (!l.length) return;
    var an = window.cur.getFullYear(), mo = window.cur.getMonth();
    var dansMois = l.some(function (r) {
      var a = dateDe(r.dateStart), b = dateDe(fin(r));
      return (a.getFullYear() === an && a.getMonth() === mo) || (b.getFullYear() === an && b.getMonth() === mo);
    });
    if (dansMois) return;
    var now = Date.now();
    l.sort(function (x, y) { return Math.abs(dateDe(x.dateStart) - now) - Math.abs(dateDe(y.dateStart) - now); });
    var d = dateDe(l[0].dateStart);
    window.cur.setDate(1); window.cur.setFullYear(d.getFullYear()); window.cur.setMonth(d.getMonth());
  }
  function visibles() {
    var q = sansAccent(recherche.trim());
    return (window.R || []).filter(function (r) {
      if (!r || r._deleted||enSuivi(r) || !r.dateStart) return false;
      if (!q) return true;
      var txt = [r.client, r.place, r.phone, r.email, r.notes, numerosDe(r.id).join(' ')].concat((r.products || []).map(function (p) { return [p.name, p.variant, p.short].filter(Boolean).join(' '); })).join(' ');
      return sansAccent(txt).indexOf(q) >= 0;
    });
  }
  function fin(r) { return r.dateEnd && r.dateEnd >= r.dateStart ? r.dateEnd : r.dateStart; }

  /* ── Barre du haut ── */
  function barre(titre, decale) {
    return '<div class="vn-bar">'
      + '<div class="vn-seg"><button class="' + (window.calView !== 'table' ? 'a' : '') + '" data-v="month">Vue planning</button>'
      + '<button class="' + (window.calView === 'table' ? 'a' : '') + '" data-v="table">Vue tableau</button></div>'
      + '<div class="vn-nav"><button id="prev">‹</button><span>' + titre + '</span><button id="next">›</button></div>'
      + '<input class="vn-q" id="vnQ" placeholder="Rechercher un client, un produit, un lieu, un n° de facture…" value="' + esc(recherche) + '">'
      + '</div>';
  }
  function brancher() {
    Array.prototype.forEach.call(document.querySelectorAll('.vn-seg button'), function (b) {
      b.onclick = function () {
        window.calView = b.getAttribute('data-v');
        /* Une bascule Vue planning ↔ Vue tableau doit repartir des données
           serveur. La vue tableau dépend aussi de cache.demandes dans la
           page parente : si le tableau était ouvert très vite après la
           connexion, cette liste pouvait encore être vide alors que les
           réservations validées étaient déjà chargées. */
        var chargerDemandes = Promise.resolve();
        if (window.calView === 'table' && window.parent && typeof window.parent.loadDemandes === 'function') {
          chargerDemandes = window.parent.loadDemandes().catch(function () {});
        }
        chargerDemandes.then(function () {
          if (typeof window.vespraActualiser === 'function') {
            return window.vespraActualiser();
          }
        }).catch(function () {}).then(function () { window.planning(); });
      };
    });
    var q = document.getElementById('vnQ');
    if (q) q.oninput = function () {
      recherche = q.value;
      var pos = q.selectionStart;
      sauterVersResultat();
      window.planning();
      var q2 = document.getElementById('vnQ');
      if (q2) { q2.focus(); try { q2.setSelectionRange(pos, pos); } catch (e) {} }
    };
    var p = document.getElementById('prev'), n = document.getElementById('next');
    if (p) p.onclick = function () { window.cur.setDate(1); window.cur.setMonth(window.cur.getMonth() - 1); window.planning(); };
    if (n) n.onclick = function () { window.cur.setDate(1); window.cur.setMonth(window.cur.getMonth() + 1); window.planning(); };
  }
  function titreMois() {
    var t = new Date(window.cur.getFullYear(), window.cur.getMonth(), 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  /* ── Vue planning ── */
  function couleurs(r) { return window.getCatColorsForRes(r); }

  /* Libellé compact du planning : le nom court reste utilisé pour les
     produits classiques, mais les variantes utiles à l'équipe doivent
     apparaître. Exemples : « PB1 · 200 photos · Cadre photo » et
     « Pack Vespra 60 personnes » (sans doubler « 60 personnes »). */
  function formulePlanning(v) {
    return String(v || '').replace(/\btirages?\b/ig, 'photos');
  }
  function motsPlanning(x) {
    return String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  }
  function planningProduitLabel(p) {
    if (!p) return '';
    var name = String(p.name || '').trim();
    var short = String(p.short || '').trim();
    var variant = p.variant && p.variant !== 'Standard' && p.variant !== 'Option'
      ? formulePlanning(p.variant).trim() : '';
    var base = (!p.estOption && name) ? name : (short || name || 'Produit');
    /* photobooth : toujours « PB1 », « PB2 »… avec le numéro du nom officiel
       (« Photobooth 2 »), même sur les anciennes réservations dont le nom
       court était un libellé tronqué */
    var nb = /^Photobooth\s*(\d)$/i.exec(name);
    if (nb && !p.estOption) {
      base = 'PB' + nb[1];
      if (!variant) {
        var brut = short.split(/\s*[\u2014\u2013]\s*/).slice(1).join(' ');
        var t = String(brut).replace(/\(\s*\d+[.,]?\d*\s*\u20ac\s*\)/g, '').trim(), mm;
        if (/num[e\u00e9]rique|digit/i.test(t)) variant = 'Num\u00e9rique';
        else if ((mm = /(\d+)\s*(?:tirages?|photos?)/i.exec(t))) variant = mm[1] + ' photos';
        else if (/illimit/i.test(t)) variant = 'Illimit\u00e9';
      }
    }
    var pb = /^(?:PB|Photobooth)\s*\d+$/i.exec(base);
    if (pb) base = 'PB' + base.replace(/\D+/g, '');

    /* Pour les Packs Vespra, le nom complet contient déjà la variante.
       On garde donc exactement « Pack Vespra 60 personnes », jamais
       « Pack Vespra 60 · 60 personnes ». */
    if (/^Sono/i.test(name) && !p.estOption && typeof window.pkNomFormule === 'function') {
      base = window.pkNomFormule(name, variant); variant = '';
    }
    if (/^Pack Vespra\b/i.test(name)) {
      base = name;
      if (variant) {
        var nm = motsPlanning(name), vm = motsPlanning(variant);
        var deja = vm.length && vm.every(function(w) { return nm.indexOf(w) >= 0; });
        if (!deja) base += ' ' + variant;
        variant = '';
      }
    }

    var parts = [base];
    if (variant) {
      var bm = motsPlanning(base), vm2 = motsPlanning(variant);
      var contenu = vm2.length && vm2.every(function(w) { return bm.indexOf(w) >= 0; });
      if (!contenu) parts.push(variant);
    }
    var opts = p.optsLabel || p.options || p.option || '';
    if (Array.isArray(opts)) opts = opts.filter(Boolean).join(', ');
    opts = String(opts || '').trim();
    if (opts && opts !== variant) {
      var om = motsPlanning(opts), am = motsPlanning(parts.join(' '));
      if (om.length && !om.every(function(w) { return am.indexOf(w) >= 0; })) {
        parts.push('Option ' + opts.charAt(0).toLowerCase() + opts.slice(1));
      }
    }
    return parts.join(' · ');
  }

  /* Une seule façon de nommer le matériel, partout (barres du planning et
     tableau) : « PB1 · 200 photos · Cadre photo ». Rien ne se répète. */
  function majuscule(x) { x = String(x || '').trim().replace(/^\+\s*/, ''); return x.charAt(0).toUpperCase() + x.slice(1); }
  function libelleMateriel(r) {
    var out = [], vus = [];
    function ajoute(t) {
      var m = motsPlanning(t);
      if (!m.length) return;
      var deja = vus.join(' ').split(' ');
      if (m.every(function (w) { return deja.indexOf(w) >= 0; })) return;
      vus = vus.concat(m); out.push(t);
    }
    var ps = (r && r.products || []).filter(Boolean);
    var isOpt = function (p) { return typeof window.estOptionProduit === 'function' ? window.estOptionProduit(p, ps.indexOf(p)) : p.estOption === true; };
    ps.filter(function (p) { return !isOpt(p); }).forEach(function (p) {
      planningProduitLabel(p).split(' \u00b7 ').forEach(function (x) { ajoute(/^Option /.test(x) && window.optionTexte ? window.optionTexte(x) : x); });
    });
    ps.filter(isOpt).forEach(function (p) { var t = window.optionTexte ? window.optionTexte(p.short || p.name) : 'Option ' + (p.short || p.name); ajoute(t); });
    return out.map(function (x, i) { return i ? majuscule(x) : x; }).join(' \u00b7 ');
  }
  window.libelleMaterielResa = libelleMateriel;

  function barreHtml(r, a, b, w0, w1, lane) {
    var cols = couleurs(r), c = cols[0] || '#EDE6D8', txt = window.getColorText(c);
    var bord = txt === '#fff' || txt === '#ffffff' || /^#f{3,6}$/i.test(txt);
    var autres = cols.slice(1).map(function (x) {
      return '<u style="background:' + x + ';border-color:' + (bord ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.25)') + '"></u>';
    }).join('');
    var prods = [libelleMateriel(r)].filter(Boolean);
    var livre = window.aLivraison(r) || (Number(r.livraisonPrice) || 0) > 0 || (Number(r.montage) || 0) > 0;
    var cl = r.dateStart < w0 ? ' cl' : '', cr = fin(r) > w1 ? ' cr' : '';
    var col = jours(w0, a) + 1, span = jours(a, b) + 1;
    return '<div class="span-ev' + cl + cr + '" data-res-id="' + esc(r.id) + '" style="grid-column:' + col + '/span ' + span + ';grid-row:' + (lane + 2)
      + ';background:' + c + ';color:' + txt + '" title="' + esc(r.client) + '">'
      + '<span class="t"><b>' + esc(r.client || '') + '</b><small>' + esc(prods.join(' · ') || 'Matériel à compléter') + '</small></span>'
      + '<i class="vn-led ' + (livre ? 'oui' : 'non') + '" title="' + (livre ? 'Livraison / montage' : 'Retrait sur place') + '"></i></div>';
  }

  /* rang d'une réservation : catégorie puis produit (Photobooth 1, 2, sono, barnum…) */
  function rangProduit(r) {
    var cats = typeof window.getCats === 'function' ? window.getCats() : [];
    var prods = typeof window.getProds === 'function' ? window.getProds() : [];
    var best = 1e9;
    (r.products || []).forEach(function (p) {
      if (!p) return;
      var ci = -1;
      for (var k = 0; k < cats.length; k++) if (cats[k].id === p.cat) { ci = k; break; }
      var pi = -1;
      for (var m = 0; m < prods.length; m++) if (prods[m].name === p.name) { pi = m; break; }
      var v = (ci < 0 ? 99 : ci) * 1000 + (pi < 0 ? 999 : pi);
      if (v < best) best = v;
    });
    return best;
  }
  function semaineHtml(lundi0, resas, mois) {
    /* lundi0 = le mardi qui ouvre la semaine */
    var w0 = iso(lundi0), w1 = iso(ajoute(lundi0, 6));
    var occ = [], items = [];
    resas.filter(function (r) { return r.dateStart <= w1 && fin(r) >= w0; })
      .sort(function (x, y) {
        var rx = rangProduit(x), ry = rangProduit(y);
        if (rx !== ry) return rx - ry;
        return x.dateStart < y.dateStart ? -1 : x.dateStart > y.dateStart ? 1 : 0;
      })
      .forEach(function (r) {
        var a = r.dateStart < w0 ? w0 : r.dateStart, b = fin(r) > w1 ? w1 : fin(r);
        var c1 = jours(w0, a), c2 = jours(w0, b), lane = 0;
        for (;;) {
          var libre = true;
          for (var c = c1; c <= c2; c++) if (occ[c] && occ[c][lane]) { libre = false; break; }
          if (libre) break;
          lane++;
        }
        for (var k = c1; k <= c2; k++) { occ[k] = occ[k] || {}; occ[k][lane] = true; }
        items.push({ r: r, a: a, b: b, lane: lane });
      });
    var nbVoies = Math.max(2, items.reduce(function (m, i) { return Math.max(m, i.lane + 1); }, 0));
    var auj = iso(new Date()), html = '';
    for (var i = 0; i < 7; i++) {
      var d = ajoute(lundi0, i), di = iso(d);
      html += '<div class="day' + (d.getMonth() !== mois ? ' autre' : '') + (di === auj ? ' today' : '') + '" data-date="' + di + '" style="grid-column:' + (i + 1) + '"><span class="n">' + d.getDate() + '</span></div>';
    }
    html += items.map(function (i) { return barreHtml(i.r, i.a, i.b, w0, w1, i.lane); }).join('');
    return '<div class="vn-wk" style="grid-template-rows:30px repeat(' + nbVoies + ',34px) 8px">' + html + '</div>';
  }

  function vuePlanning() {
    var an = window.cur.getFullYear(), mo = window.cur.getMonth();
    var premier = new Date(an, mo, 1), dernier = new Date(an, mo + 1, 0);
    var debut = ajoute(premier, -((premier.getDay() - 2 + 7) % 7));
    var resas = visibles(), sem = '';
    for (var d = debut; d <= dernier; d = ajoute(d, 7)) sem += semaineHtml(d, resas, mo);
    window.main.innerHTML = '<div class="page"><div class="pt">Planning</div>' + barre(titreMois())
      + '<div class="vn-leg"><span><i class="vn-led oui"></i>Livraison ou montage</span><span><i class="vn-led non"></i>Retrait sur place</span></div>'
      + '<div class="vn-card calendar"><div class="vn-hh">' + JOURS.map(function (j) { return '<div>' + j + '</div>'; }).join('') + '</div>' + sem + '</div></div>';
    brancher();
    window.attachDragListeners();
  }

  /* ── Vue tableau ── */
  function vueTableau() {
    var an = window.cur.getFullYear(), mo = window.cur.getMonth(), q = recherche.trim();
    var liste = visibles().filter(function (r) {
      if (q) return true;
      var d = dateDe(r.dateStart);
      return d.getFullYear() === an && d.getMonth() === mo;
    }).sort(function (x, y) { return x.dateStart < y.dateStart ? -1 : x.dateStart > y.dateStart ? 1 : 0; });
    /* les demandes pas encore validées apparaissent aussi, avec leur statut :
       on voit d'un coup d'œil ce qui est en attente à une date donnée */
    var lignesAtt = [];
    try {
      var dem = window.parent.eval('cache.demandes') || [];
      dem.forEach(function (d) {
        /* La Vue tableau doit montrer toutes les demandes encore ouvertes
           du mois, y compris celles qui possèdent déjà un resaId. Seules
           les demandes validées restent exclues : elles sont déjà fournies
           par window.R et ne doivent pas être doublées. */
        var recente = d && d.statut === 'validee' && d._valideRecemment && !(window.R || []).some(function (x) { return x && String(x.id) === String(d.resaId); });
        if (!d || (d.statut !== 'nouvelle' && d.statut !== 'en-cours' && !recente)) return;
        var dateSource = d.date || d.dateStart || '';
        var m = String(dateSource).match(/^(\d{4})-(\d{2})-(\d{2})/) || String(dateSource).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (!m) return;
        var iso0 = m[1].length === 4 ? m[1] + '-' + m[2] + '-' + m[3] : m[3] + '-' + m[2] + '-' + m[1];
        var dd = dateDe(iso0);
        if (!q && !(dd.getFullYear() === an && dd.getMonth() === mo)) return;
        if (q && sansAccent((d.nom || '') + ' ' + (d.adresse || '') + ' ' + (NUM.devis[String(d.id)] || '') + ' ' + (NUM.factures[String(d.id)] || '')).indexOf(sansAccent(q)) < 0) return;
        lignesAtt.push({ iso: iso0, d: d, att: true });
      });
    } catch (e) {}
    var lignesTout = liste.map(function (r) { return { iso: r.dateStart, r: r }; }).concat(lignesAtt)
      .sort(function (x, y) { return x.iso < y.iso ? -1 : x.iso > y.iso ? 1 : 0; });
    /* Dans le tableau, l'adresse n'est volontairement plus affichée :
       au quotidien le matériel loué est plus utile. L'adresse reste bien
       sûr disponible dans la fiche ouverte au clic. */
    function produitsReservation(r) {
      var t = libelleMateriel(r);
      return t || 'Matériel à compléter';
    }
    function produitsDemande(d) {
      try {
        /* même nomination que sur le planning : PB1 (premier libre à cette date), packs, options */
        var P = window.parent;
        if (P && typeof P.produitsDepuisDemande === 'function' && typeof P.isoDepuisFr === 'function') {
          var j = P.isoDepuisFr(d.date) || '';
          if (j) {
            var lib = libelleMateriel({ products: P.produitsDepuisDemande(d, j, j) });
            if (lib) return lib;
          }
        }
      } catch (e0) {}
      try {
        var fn = window.parent && window.parent.resumePanier;
        if (typeof fn === 'function') return fn(d) || 'Matériel à préciser';
      } catch (e) {}
      return d && (d.panier || d.produits || d.product) ? String(d.panier || d.produits || d.product) : 'Matériel à préciser';
    }

    /* la note de la fiche, sous le nom du client */
    function noteDe(r, d) {
      var t = '';
      try {
        var P = window.parent;
        if (d) t = d.note || '';
        else if (P && typeof P.noteDepuisResa === 'function') {
          var dem = ((P.cache && P.cache.demandes) || []).filter(function (x) { return x && !x.planning && x.resaId && String(x.resaId) === String(r.id); })[0] || null;
          t = P.noteDepuisResa(r, dem);
        } else t = r.notes || '';
      } catch (e) { t = r && r.notes || ''; }
      t = String(t || '').replace(/\s*\n\s*/g, ' \u00b7 ').trim();
      return t ? '<div class="vn-note" title="' + esc(t) + '">' + esc(t) + '</div>' : '';
    }
    var total = 0;
    var lignes = lignesTout.map(function (l) {
      var d = dateDe(l.iso);
      var lib = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
      if (l.att) {
        var enc = l.d.statut === 'en-cours';
        return '<tr class="att" data-demande-id="' + esc(l.d.id) + '"><td><b>' + lib + '</b></td><td>' + esc(l.d.nom || 'Client') + noteDe(null, l.d) + '</td><td class="prod" title="' + esc(produitsDemande(l.d)) + '">' + esc(produitsDemande(l.d)) + '</td>'
          + '<td class="m">—</td><td><span class="vn-st ' + (l.d.statut === 'validee' ? 'v' : enc ? 'c' : 'w') + '">' + (l.d.statut === 'validee' ? 'Validée' : enc ? 'En cours' : 'Nouvelle') + '</span></td><td class="m">—</td></tr>';
      }
      var r = l.r, t = window.calcResTotal(r); total += t;
      return '<tr data-res-id="' + esc(r.id) + '"><td><b>' + lib + '</b></td><td>' + esc(r.client) + noteDe(r, null) + '</td><td class="prod" title="' + esc(produitsReservation(r)) + '">' + esc(produitsReservation(r)) + '</td>'
        + '<td class="m">' + euro(t) + '</td>'
        + '<td><span class="vn-st v">Validée</span></td>'
        + '<td class="m">' + (window.aLivraison(r) ? 'Oui' : 'Non') + '</td></tr>';
    }).join('');
    var nb = lignesTout.length;
    window.main.innerHTML = '<div class="page"><div class="pt">Planning</div>' + barre(titreMois())
      + '<div class="vn-card vn-table-card">' + (nb
        ? '<table class="vn-tbl"><thead><tr><th>Date</th><th>Client</th><th>Produits</th><th class="m">Montant</th><th>Statut</th><th class="m">Livraison</th></tr></thead><tbody>' + lignes + '</tbody></table>'
          + '<div class="vn-tot"><span>' + nb + ' réservation' + (nb > 1 ? 's' : '') + (q ? '' : ' · ' + titreMois().toLowerCase()) + '</span><span>Total : ' + euro(total) + '</span></div>'
        : '<div class="vn-vide">Aucune réservation' + (q ? ' pour cette recherche' : ' ce mois-ci') + '.</div>')
      + '</div></div>';
    brancher();
    /* Les demandes « nouvelle » et « en cours » ouvrent leur fiche de demande.
       Les réservations validées ouvrent leur fiche de réservation habituelle. */
    Array.prototype.forEach.call(document.querySelectorAll('.vn-tbl tbody tr[data-res-id]'), function (tr) {
      tr.onclick = function () { window.openDetail(tr.getAttribute('data-res-id')); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('.vn-tbl tbody tr[data-demande-id]'), function (tr) {
      tr.onclick = function () {
        var id = tr.getAttribute('data-demande-id');
        var d = null;
        try {
          d = (window.parent && window.parent.cache && Array.isArray(window.parent.cache.demandes))
            ? window.parent.cache.demandes.filter(function (x) { return String(x.id) === String(id); })[0] : null;
        } catch (e) {}
        /* Une demande « nouvelle » ou « en cours » doit ouvrir sa fiche,
           même si elle possède déjà un resaId. */
        try {
          if (window.parent && typeof window.parent.ficheDemande === 'function') {
            window.parent.ficheDemande(id);
            return;
          }
        } catch (e2) {}
        if (typeof window.ficheDemande === 'function') window.ficheDemande(id);
      };
    });
  }


  /* ── Anciennes réservations d'un seul jour ──
     Une location va du vendredi au lundi. Un seul jour : vendredi → lundi ;
     samedi → du vendredi au lundi ; dimanche → lundi ; jeudi → vendredi. Chaque réservation n'est traitée
     qu'une fois : ensuite, vos réglages à la main sont respectés. */
  function etaler() {
    var changees = 0;
    (window.R || []).forEach(function (r) {
      if (!r || r._deleted||enSuivi(r) || !r.dateStart || r._etale === 2) return;
      var d0 = dateDe(r.dateStart), w = d0.getDay(); /* 0 dim … 6 sam */
      var seul = !r.dateEnd || r.dateEnd === r.dateStart;
      if (seul) {
        if (w === 5) { r.dateEnd = iso(ajoute(d0, 3)); changees++; }                          /* vendredi → lundi */
        else if (w === 6) { r.dateStart = iso(ajoute(d0, -1)); r.dateEnd = iso(ajoute(d0, 2)); changees++; } /* samedi → vendredi…lundi */
        else if (w === 0) { r.dateEnd = iso(ajoute(d0, 1)); changees++; }                    /* dimanche → lundi */
        else if (w === 4) { r.dateEnd = iso(ajoute(d0, 1)); changees++; }                    /* jeudi → vendredi */
      } else if (r._etale === true && w === 6 && r.dateEnd === iso(ajoute(d0, 2))) {
        /* étalée à la version précédente (samedi → lundi) : elle commence aussi le vendredi */
        r.dateStart = iso(ajoute(d0, -1)); changees++;
      }
      r._etale = 2;
      if (typeof window.fbPutRes === 'function') { try { window.fbPutRes(r); } catch (e) {} }
    });
    if (changees) { try { localStorage.setItem('vespraR', JSON.stringify(window.R)); } catch (e) {} }
  }

  window.planning = function () {
    /* Tant que la page n'a pas reçu les réservations du serveur, elle ne
       connaît que la copie gardée dans le navigateur, parfois très ancienne :
       la dessiner ferait apparaître un planning périmé, aussitôt remplacé. */
    if (!window.__vespraPret) {
      if (window.main) window.main.innerHTML = '<div class="page"><div class="pt">Planning</div><div class="vn-vide">Chargement du planning\u2026</div></div>';
      /* Ne jamais forcer artificiellement __vespraPret après quelques
         secondes : cela affichait une copie locale potentiellement périmée.
         reservation-pont.js devient l'unique source de vérité. */
      return;
    }
    etaler();
    if (window.calView !== 'table') window.calView = 'month';
    if (window.calView === 'table') {
      /* Au premier affichage direct de la vue tableau, ne pas dépendre du
         timing de loadDemandes() lancé par le shell du back-office. Sans
         cette attente, seules les réservations validées (window.R) étaient
         parfois visibles ; les nouvelles / en cours n'apparaissaient
         qu'après un détour par « Liste des réservations ». */
      var parentDemandes = window.parent && typeof window.parent.loadDemandes === 'function'
        ? window.parent.loadDemandes
        : null;
      var demandes = null;
      try { demandes = window.parent && window.parent.cache ? window.parent.cache.demandes : null; } catch (e) {}
      if (!Array.isArray(demandes)) {
        if (window.main) window.main.innerHTML = '<div class="page"><div class="pt">Planning</div><div class="vn-vide">Chargement du tableau…</div></div>';
        if (parentDemandes) {
          parentDemandes().catch(function () {}).then(function () { vueTableau(); });
          return;
        }
      }
      vueTableau();
    } else vuePlanning();
  };
  window.planning._vp = true;

  /* ── Déplacer une réservation en la glissant ──
     La barre suit la souris ; en la lâchant sur un jour, la réservation
     se décale de autant de jours que le déplacement, durée conservée. */
  function jourSous(x, y) {
    var el = document.elementFromPoint(x, y);
    return el ? el.closest('.day[data-date]') : null;
  }
  window.attachDragListeners = function () {
    Array.prototype.forEach.call(document.querySelectorAll('.span-ev[data-res-id]'), function (el) {
      el.addEventListener('mousedown', demarrer);
      el.addEventListener('touchstart', demarrer, { passive: false });
    });
  };
  function demarrer(e) {
    if (e.type === 'mousedown' && e.button !== 0) return;
    var el = e.currentTarget, id = el.getAttribute('data-res-id');
    var pt0 = e.touches ? e.touches[0] : e;
    var x0 = pt0.clientX, y0 = pt0.clientY;
    var jourPris = jourSous(x0, y0);
    var rect = el.getBoundingClientRect();
    var fantome = null, cible = null, bouge = false, raf = null, lx = x0, ly = y0;
    /* Au doigt, il faut MAINTENIR l'appui avant de pouvoir déplacer : un simple
       glissement du doigt fait défiler la page, il ne déplace jamais une réservation. */
    var tactile = e.type === 'touchstart', actif = !tactile, tm = null;
    if (tactile) {
      tm = setTimeout(function () {
        tm = null; actif = true;
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) {} }
        el.style.opacity = '.6';
      }, 450);
    }
    function abandonne() {
      if (tm) { clearTimeout(tm); tm = null; }
      document.removeEventListener('touchmove', bouger); document.removeEventListener('touchend', fini);
      document.removeEventListener('touchcancel', fini);
    }
    el.style.pointerEvents = 'none'; /* pour voir le jour dessous */
    jourPris = jourSous(x0, y0);
    el.style.pointerEvents = '';

    function nettoie() {
      Array.prototype.forEach.call(document.querySelectorAll('.day.dragover'), function (d) { d.classList.remove('dragover'); });
    }
    function bouger(ev) {
      var p = ev.touches ? ev.touches[0] : ev;
      lx = p.clientX; ly = p.clientY;
      if (!actif) {                       /* doigt : tant que l'appui n'est pas « tenu », on laisse défiler */
        if (Math.abs(lx - x0) + Math.abs(ly - y0) > 8) abandonne();
        return;
      }
      if (!bouge && Math.abs(lx - x0) + Math.abs(ly - y0) < 6) return;
      if (ev.cancelable) ev.preventDefault();
      bouge = true;
      document.body.classList.add('vn-sel-actif');
      if (!fantome) {
        fantome = el.cloneNode(true);
        fantome.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;width:' + rect.width + 'px;opacity:.88;box-shadow:0 8px 24px rgba(0,0,0,.25);margin:0;grid-column:auto;grid-row:auto';
        document.body.appendChild(fantome);
        el.style.opacity = '.35';
      }
      if (!raf) raf = requestAnimationFrame(function () {
        raf = null;
        fantome.style.left = (lx - (x0 - rect.left)) + 'px';
        fantome.style.top = (ly - (y0 - rect.top)) + 'px';
        nettoie();
        fantome.style.display = 'none';
        cible = jourSous(lx, ly);
        fantome.style.display = '';
        if (cible) cible.classList.add('dragover');
      });
    }
    function fini() {
      if (tm) { clearTimeout(tm); tm = null; }
      el.style.opacity = '';
      document.removeEventListener('touchcancel', fini);
      document.removeEventListener('mousemove', bouger); document.removeEventListener('mouseup', fini);
      document.removeEventListener('touchmove', bouger); document.removeEventListener('touchend', fini);
      if (raf) cancelAnimationFrame(raf);
      if (fantome) fantome.remove();
      el.style.opacity = '';
      document.body.classList.remove('vn-sel-actif');
      nettoie();
      if (!bouge) return;
      /* ce n'était pas un clic : on empêche l'ouverture de la fiche */
      var bloque = function (c) { c.stopPropagation(); c.preventDefault(); };
      document.addEventListener('click', bloque, true);
      setTimeout(function () { document.removeEventListener('click', bloque, true); }, 0);
      if (!cible || !jourPris) return;
      var decal = jours(jourPris.getAttribute('data-date'), cible.getAttribute('data-date'));
      if (!decal) return;
      var r = (window.R || []).filter(function (x) { return String(x.id) === String(id); })[0];
      if (!r) return;
      var duree = jours(r.dateStart, fin(r));
      r.dateStart = iso(ajoute(dateDe(r.dateStart), decal));
      r.dateEnd = iso(ajoute(dateDe(r.dateStart), duree));
      localStorage.setItem('vespraR', JSON.stringify(window.R));
      if (typeof window.fbPutRes === 'function') window.fbPutRes(r);
      window.planning();
    }
    document.addEventListener('mousemove', bouger, { passive: false }); document.addEventListener('mouseup', fini);
    document.addEventListener('touchmove', bouger, { passive: false }); document.addEventListener('touchend', fini); document.addEventListener('touchcancel', fini);
  }

  /* Pendant la sélection de jours à la souris, les barres laissent passer
     le pointeur : on peut glisser d'une case à l'autre sans les accrocher. */
  document.addEventListener('mousedown', function () {
    if (window.dragSel && window.dragSel.active) document.body.classList.add('vn-sel-actif');
  });
  document.addEventListener('mouseup', function () { document.body.classList.remove('vn-sel-actif'); });

  /* ── Fiche : le client en haut, le matériel et le total en bas ── */
  var ouvrir = window.openDetail;
  if (typeof ouvrir === 'function') {
    window.openDetail = function (id) {
      ouvrir(id);
      ordonner();
      setTimeout(ordonner, 80); /* l'autre module réorganise juste après */
    };
    var ordonner = function () {
      var zone = document.getElementById('detailContent');
      if (!zone) return;
      var rangees = {};
      Array.prototype.forEach.call(zone.querySelectorAll('.detail-row'), function (l) {
        var lab = l.querySelector('.detail-label');
        if (lab) rangees[lab.textContent.trim()] = l;
      });
      /* le client d'abord ; le matériel, le détail du prix et le total en bas */
      var haut = ['Téléphone', 'Email', 'Lieu', 'Date(s)', 'Livraison', 'Convives', "Type d'événement", 'Source', 'Validé par'];
      var bas = ['Produits', 'Acompte', 'Détail du prix', 'Montant total', 'Message du client', 'Notes', 'Note du client'];
      var bouton = zone.querySelector('.vp-plus');
      var poser = function (nom) {
        var l = rangees[nom];
        if (!l || l.classList.contains('vp-suite')) return;
        if (bouton) zone.insertBefore(l, bouton); else zone.appendChild(l);
      };
      haut.concat(bas).forEach(poser);
      /* un acompte n'est mentionné que s'il a été versé */
      var r = (window.R || []).filter(function (x) { return String(x.id) === String(window.currentDetailId); })[0];
      var titre = document.getElementById('detailTitle');
      if (titre && r) {
        var sous = titre.querySelector('.vn-sous');
        if (sous) sous.remove();
        sous = document.createElement('div'); sous.className = 'vn-sous';
        var fd = function (i) { return dateDe(i).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' }); };
        var f = fin(r), nb = jours(r.dateStart, f) + 1;
        sous.innerHTML = '<span>' + esc(fd(r.dateStart) + (f !== r.dateStart ? ' \u2192 ' + fd(f) : '') + ' ' + dateDe(f).getFullYear()) + '</span>'
          + '<em>' + nb + ' jour' + (nb > 1 ? 's' : '') + '</em>';
        titre.appendChild(sous);
      }
      if (r) { marquerNumero(r.id); chargerNumeros(); }
      if (rangees['Date(s)']) rangees['Date(s)'].style.display = 'none';
      var mat = rangees['Produits'];
      if (mat) mat.classList.add('vn-sep');
    };
  }


  /* ── Bouton « Facture » sur la fiche d'une réservation ──
     La fenêtre de facture vit dans le back-office qui contient ce
     planning : on lui passe la réservation telle qu'on la voit ici. */
  function brancherFacture() {
    var barre = document.querySelector('#detailMb .detail-actions > div');
    if (!barre || document.getElementById('vnFacture')) return;
    var b = document.createElement('button');
    b.className = 'btn'; b.id = 'vnFacture'; b.type = 'button'; b.textContent = 'Facture';
    b.onclick = function () {
      var id = window.currentDetailId;
      var r = (window.R || []).filter(function (x) { return String(x.id) === String(id); })[0];
      var haut = window.parent;
      if (!r || !haut || haut === window || typeof haut.ouvrirFacture !== 'function') return;
      try {
        var cache = haut.eval('cache');
        cache.resas = (cache.resas || []).filter(function (x) { return String(x.id) !== String(id); }).concat([r]);
      } catch (e) {}
      window.closeDetail();
      haut.ouvrirFacture(String(id));
    };
    barre.insertBefore(b, barre.firstChild);
  }
  brancherFacture();

  if (window.page === 'planning' && window.main) window.planning();
  setTimeout(chargerNumeros, 1200);
  setInterval(chargerNumeros, 60000);
})();
