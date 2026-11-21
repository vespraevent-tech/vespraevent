/* ════════════════════════════════════════════════════
   PHOTOBOOTH — back-office
   Liste des événements → un événement : tableau de bord, expérience (mises en page + éditeur de cadre),
   paramètres de capture, écran d'accueil, partage, impression, galerie en ligne.
   ════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var PB = { liste: [], formats: {}, evt: null, section: 'tableau', edit: null, sel: -1, nouveau: false, sousImp: 'general', modeles: false };
  var COUL = { 1: '#E5484D', 2: '#8DC63F', 3: '#4FA7A7', 4: '#F2A23A' };
  var POLICES = { elegante: ["'Playfair VB',Georgia,serif", 700, 'Élégante'], manuscrite: ["'GreatVibes VB',cursive", 400, 'Manuscrite'], moderne: ["'Montserrat VB',Arial,sans-serif", 700, 'Moderne'], festive: ["'Mountains VB',cursive", 700, 'Festive'] };
  /* formats de base proposés pour une nouvelle mise en page (cases en pixels à 300 dpi) */
  var MODELES = [
    { format: '2x6', nom: 'Bandelette · 2 poses', cases: [[30, 30, 540, 360], [30, 410, 540, 360]] },
    { format: '2x6', nom: 'Bandelette · 3 poses', cases: [[30, 30, 540, 360], [30, 410, 540, 360], [30, 790, 540, 360]] },
    { format: '2x6', nom: 'Bandelette · 4 poses', cases: [[30, 30, 540, 360], [30, 410, 540, 360], [30, 790, 540, 360], [30, 1170, 540, 360]] },
    { format: '4x6p', nom: '10×15 portrait · 1 pose', cases: [[60, 60, 1080, 1440]] },
    { format: '4x6p', nom: '10×15 portrait · 3 poses', cases: [[60, 60, 1080, 480], [60, 570, 1080, 480], [60, 1080, 1080, 480]] },
    { format: '4x6l', nom: '10×15 paysage · 1 pose', cases: [[60, 60, 1680, 960]] },
    { format: '4x6l', nom: '10×15 paysage · 3 poses en grille', cases: [[45, 45, 840, 540], [915, 45, 840, 540], [45, 615, 840, 540]] },
    { format: '4x6l', nom: '10×15 paysage · 3 poses côte à côte', cases: [[45, 150, 550, 820], [625, 150, 550, 820], [1205, 150, 550, 820]] },
  ];
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var $ = function (id) { return document.getElementById(id); };
  var urlImage = function (id) { return id && PB.evt ? '/api/admin/photobooth/image?evt=' + PB.evt.id + '&id=' + id : ''; };
  var aujourdhui = function () { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date()); };
  var termine = function (e) { return e.actif === false || ((e.fin || e.date) && (e.fin || e.date) < aujourdhui()); };
  var dateFr = function (d) { if (!d) return ''; var p = d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); };
  var toast = function (m, err) { if (typeof showToast === 'function') showToast(m, err); };

  function css() {
    if ($('pb-css')) return;
    var st = document.createElement('style'); st.id = 'pb-css';
    st.textContent = '#pbZone{font-size:14px;color:#1f2733}.pb-tete{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:0 0 14px}.pb-tete h2{margin:0;font:700 19px Poppins,Inter,sans-serif;color:#14304f}'
      + '.pb-grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}.pb-carte{background:#fff;border:1px solid #e6e1d6;border-radius:12px;padding:16px 18px;cursor:pointer;text-align:left;font:inherit}.pb-carte:hover{border-color:#c9bfa9}.pb-carte b{display:block;font:700 15.5px Poppins,Inter,sans-serif;color:#14304f}.pb-carte span{display:block;font-size:12.5px;color:#6b7280;margin-top:3px}'
      + '.pb-titre-g{font:700 12px Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8a8f98;margin:20px 0 10px}'
      + '.pb-evt{display:grid;grid-template-columns:230px 1fr;gap:18px;align-items:start}@media(max-width:860px){.pb-evt{grid-template-columns:1fr}}'
      + '.pb-nav{background:#fff;border:1px solid #e6e1d6;border-radius:12px;padding:8px;position:sticky;top:10px}.pb-nav button{display:block;width:100%;text-align:left;border:0;background:transparent;padding:9px 12px;border-radius:8px;font:500 14px Inter,sans-serif;color:#1f2733;cursor:pointer}.pb-nav button.on{background:#eef2f7;color:#14304f;font-weight:700;box-shadow:inset 3px 0 0 #B8893B}.pb-nav .g{font:700 11px Inter,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#9a8f7a;padding:12px 12px 4px}'
      + '@media(max-width:860px){.pb-nav{position:static;display:flex;gap:4px;overflow-x:auto;padding:6px}.pb-nav button{white-space:nowrap;width:auto}.pb-nav .g{display:none}}'
      + '.pb-bloc{background:#fff;border:1px solid #e6e1d6;border-radius:12px;padding:16px 18px;margin-bottom:14px}.pb-bloc h3{margin:0 0 4px;font:700 15px Poppins,Inter,sans-serif;color:#14304f}.pb-bloc .aide{font-size:12.5px;color:#6b7280;margin:0 0 12px}'
      + '.pb-champs{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px 14px}.pb-champs label,.pb-f{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;color:#6b7280}.pb-champs input,.pb-champs select,.pb-f input,.pb-f select{min-width:0;width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #d9dde5;border-radius:8px;font:inherit;font-size:13.5px;color:#111;background:#fff}'
      + '.pb-ligne{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 0;border-top:1px solid #f0ece2}.pb-ligne:first-of-type{border-top:0}.pb-ligne b{display:block;font-size:14px;color:#1f2733}.pb-ligne span{display:block;font-size:12.5px;color:#8a8f98;margin-top:2px}'
      + '.pb-sw{position:relative;width:42px;height:24px;flex:none;display:inline-block}.pb-sw input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer;z-index:2}.pb-sw i{position:absolute;inset:0;border-radius:999px;background:#cfd4dc;transition:background .2s}.pb-sw i::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s}.pb-sw input:checked+i{background:#2f7d4f}.pb-sw input:checked+i::after{transform:translateX(18px)}'
      + '.pb-compteurs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.pb-compteurs div{background:#fff;border:1px solid #e6e1d6;border-radius:12px;padding:16px;text-align:center}.pb-compteurs b{display:block;font:700 28px Poppins,Inter,sans-serif;color:#14304f}.pb-compteurs span{font-size:12.5px;color:#6b7280}'
      + '.pb-actions{display:flex;gap:8px;flex-wrap:wrap}.pb-actions .btn[disabled]{opacity:.45;cursor:not-allowed}.pb-pied{display:flex;gap:8px;position:sticky;bottom:0;background:linear-gradient(0deg,#f7f5f0 70%,transparent);padding:12px 0 6px}'
      + '.pb-mp{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}.pb-mp-c{background:#fff;border:1px solid #e6e1d6;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px}.pb-mp-c canvas{width:100%;height:170px;object-fit:contain;background:#f4f2ec;border-radius:8px}.pb-mp-c b{font-size:13.5px;color:#14304f}.pb-mp-c small{color:#8a8f98;font-size:12px}.pb-mp-c .pb-actions .btn{padding:5px 9px;font-size:12px}'
      + '.pb-modeles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}.pb-modeles button{background:#fff;border:1px solid #e6e1d6;border-radius:12px;padding:10px;cursor:pointer;display:flex;flex-direction:column;gap:6px;align-items:center;font:600 12.5px Inter,sans-serif;color:#1f2733}.pb-modeles button:hover{border-color:#B8893B}.pb-modeles canvas{width:100%;height:120px;object-fit:contain}'
      + '.pb-ed{display:grid;grid-template-columns:1fr 260px;gap:16px;align-items:start}@media(max-width:980px){.pb-ed{grid-template-columns:1fr}}.pb-scene-z{background:#e9e6df;border-radius:12px;padding:16px;display:flex;justify-content:center;overflow:auto}'
      + '.pb-scene{position:relative;background:#fff;box-shadow:0 10px 30px -12px rgba(0,0,0,.35);touch-action:none;user-select:none;flex:none}.pb-case{position:absolute;display:flex;align-items:center;justify-content:center;color:#fff;font:800 28px Inter,sans-serif;cursor:move;outline:1px solid rgba(0,0,0,.15)}.pb-case.sel{outline:3px solid #14304f;z-index:3}.pb-case .poignee{position:absolute;right:-7px;bottom:-7px;width:14px;height:14px;background:#fff;border:2px solid #14304f;border-radius:3px;cursor:nwse-resize}'
      + '.pb-calque{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4}.pb-outils{display:flex;flex-direction:column;gap:12px}'
      + '.pb-accueil{position:relative;overflow:hidden;border-radius:10px;box-shadow:0 10px 30px -12px rgba(0,0,0,.35);background-size:cover;background-position:center;touch-action:none;user-select:none}.pb-acc-el{position:absolute;transform:translate(-50%,-50%);cursor:move}.pb-acc-bt{border-radius:50%;display:flex;align-items:center;justify-content:center}.pb-acc-coin{position:absolute;top:2.5%;width:4.2%;aspect-ratio:1;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35)}'
      + '.pb-photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}.pb-photos figure{margin:0;background:#faf8f4;border:1px solid #e6e1d6;border-radius:10px;padding:8px}.pb-photos img{width:100%;max-height:240px;object-fit:contain;border-radius:6px;display:block}.pb-photos figcaption{font-size:12px;color:#6b7280;margin-top:6px}.pb-photos figcaption span{display:block;margin-top:3px}.pb-photos a{color:#14304f}.pb-champs input:focus,.pb-champs select:focus{outline:none!important;border-color:#14304f!important;box-shadow:0 0 0 3px rgba(20,48,79,.12)!important}.pb-vide{text-align:center;color:#6b7280;padding:28px 10px;font-size:13.5px}.pb-theme{}@media(max-width:700px){.pb-theme{grid-template-columns:1fr!important}}.pb-sous{display:flex;gap:4px;border-bottom:1px solid #e6e1d6;margin:0 0 14px}.pb-sous button{border:0;background:transparent;padding:10px 14px;font:600 14px Inter,sans-serif;color:#6b7280;cursor:pointer;border-bottom:3px solid transparent}.pb-sous button.on{color:#14304f;border-bottom-color:#B8893B}';
    document.head.appendChild(st);
    if (typeof vbPolicesCss === 'function') vbPolicesCss();
  }
  var sw = function (id, on, oc) { return '<span class="pb-sw"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + (oc ? ' onchange="' + oc + '"' : '') + '><i></i></span>'; };
  var ligne = function (titre, aide, droite) { return '<div class="pb-ligne"><div><b>' + titre + '</b>' + (aide ? '<span>' + aide + '</span>' : '') + '</div>' + droite + '</div>'; };
  var champ = function (id, l, v, ph, type, extra) { return '<label>' + l + '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(v == null ? '' : v) + '" placeholder="' + esc(ph || '') + '"' + (extra || '') + '></label>'; };
  var val = function (id) { var e = $(id); return e ? e.value : ''; };
  var coche = function (id) { var e = $(id); return !!(e && e.checked); };

  /* ───────── chargement ───────── */
  window.pbOuvrir = async function () { css(); PB.evt = null; PB.edit = null; PB.nouveau = false; var z = $('pbZone'); if (z) z.innerHTML = '<div class="pb-vide">Chargement…</div>'; try { await chargerListe(); rendre(); } catch (e) { if (z) z.innerHTML = '<div class="pb-vide">Impossible d’afficher le Photobooth : ' + esc(e.message) + '</div>'; } };
  async function chargerListe() {
    try { var r = await api('/photobooth'); PB.liste = r.evenements || []; PB.formats = r.formats || {}; }
    catch (e) { PB.liste = []; toast('Photobooth : ' + e.message, true); }
  }
  function rendre() { var z = $('pbZone'); if (!z) return; if (!PB.evt) rendreListe(z); else rendreEvt(z); }

  /* ───────── liste des événements ───────── */
  function rendreListe(z) {
    var enCours = PB.liste.filter(function (e) { return !termine(e); }), passes = PB.liste.filter(termine);
    var carte = function (e) { return '<button type="button" class="pb-carte" onclick="pbEvt(\'' + e.id + '\')"><b>' + esc(e.nom) + '</b><span>' + (e.date ? dateFr(e.date) : 'Date à préciser') + '</span><span>' + e.misesEnPage + ' mise' + (e.misesEnPage > 1 ? 's' : '') + ' en page · ' + e.photos + ' photo' + (e.photos > 1 ? 's' : '') + '</span></button>'; };
    z.innerHTML = '<div class="pb-tete"><h2>Photobooth</h2><span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><a class="btn btn-ghost" style="padding:5px 12px;font-size:12.5px" href="/photobooth/app/?liste" target="_blank" rel="noopener">Ouvrir l’appli des bornes</a><button class="btn btn-ghost" style="padding:5px 12px;font-size:12.5px" onclick="pbNouveau()">+ Créer un événement</button></span></div>'
      + (PB.nouveau ? '<div class="pb-bloc"><h3>Nouvel événement</h3><div class="pb-champs">' + champ('pbn-q', 'Nom de la cliente', '', 'Tapez un nom : recherche dans les réservations du planning', 'text', ' autocomplete="off" oninput="pbFiltrer()"') + '</div><div id="pbn-res" style="margin-top:12px"></div><p class="aide" style="font-size:12.5px;color:#6b7280;margin:10px 0 0">Pas dans le planning ? <a href="#" onclick="pbManuel();return false" style="color:#14304f">Créer sans réservation</a></p>' + (PB.manuel ? '<div class="pb-champs" style="margin-top:8px">' + champ('pbn-nom', 'Nom de l’événement', '', 'Mariage de Sylvie & Paul') + champ('pbn-date', 'Date', '', '', 'date') + '</div><div class="pb-actions" style="margin-top:10px"><button class="btn" onclick="pbCreer()">Créer l’événement</button></div>' : '') + '<div class="pb-actions" style="margin-top:10px"><button class="btn btn-ghost" onclick="pbNouveau(false)">Annuler</button></div></div>' : '')
      + (PB.liste.some(function (e) { return e.auto; }) ? '<div class="pb-actions" style="margin:0 0 10px"><button class="btn btn-ghost" style="color:#b03a2a" onclick="pbAutoSuppr()">Supprimer les événements créés automatiquement (' + PB.liste.filter(function (e) { return e.auto; }).length + ')</button></div>' : '') + '<div class="pb-titre-g">En cours et à venir</div>' + (enCours.length ? '<div class="pb-grille">' + enCours.map(carte).join('') + '</div>' : '<div class="pb-vide">Aucun événement en cours. Créez-en un avec « Nouvel événement ».</div>')
      + '<div class="pb-titre-g">Événements passés (encore sauvegardés)</div>' + (passes.length ? '<div class="pb-grille">' + passes.map(carte).join('') + '</div>' : '<div class="pb-vide">Aucun événement passé.</div>');
    if (PB.nouveau) { setTimeout(function () { var n = $('pbn-q'); if (n) n.focus(); }, 50); pbFiltrer(); }
  }
  /* liste des clientes du planning, pour pré-remplir un nouvel événement */
  async function chargerClientes() {
    try {
      var brut = await api('/data?collection=reservations'), auj = aujourdhui(), l = [];
      (brut || []).forEach(function (x) {
        try {
          var r = typeof x.d === 'string' ? JSON.parse(x.d) : x; if (!r || !r.client) return;
          l.push({ id: String(x.id || r.id), client: String(r.client), dateStart: r.dateStart || '', dateEnd: r.dateEnd || r.dateStart || '', produits: (r.products || []).map(function (p) { return p.name; }).filter(function (n) { return /photobooth|vid[ée]obooth|photomaton/i.test(n || ''); }).slice(0, 2).join(', '), tirages: ((r.products || []).map(function (p) { var m = /(\d+)\s*tirages?/i.exec(p.variant || ''); return /photobooth|photomaton/i.test(p.name || '') && m ? +m[1] : 0; }).filter(Boolean)[0]) || 0 });
        } catch (e) {}
      });
      l.sort(function (a, b) { var fa = a.dateStart >= auj, fb = b.dateStart >= auj; return fa !== fb ? (fa ? -1 : 1) : (fa ? a.dateStart.localeCompare(b.dateStart) : b.dateStart.localeCompare(a.dateStart)); });
      PB.clientes = l;
    } catch (e) { PB.clientes = []; }
  }
  window.pbManuel = function () { PB.manuel = true; rendre(); setTimeout(function () { var n = $('pbn-nom'); if (n) n.focus(); }, 50); };
  window.pbFiltrer = function () {
    var z = $('pbn-res'); if (!z) return; var q = ($('pbn-q') ? $('pbn-q').value : '').trim().toLowerCase();
    var l = (PB.clientes || []).map(function (c, i) { return { c: c, i: i }; }).filter(function (x) { return q ? x.c.client.toLowerCase().indexOf(q) >= 0 : !!x.c.produits && x.c.dateStart >= aujourdhui(); }).slice(0, 12);
    z.innerHTML = l.length ? l.map(function (x) { var c = x.c; return '<button type="button" class="pb-carte" style="width:100%;text-align:left;margin-bottom:6px" onclick="pbCreerDepuis(' + x.i + ')"><b>' + esc(c.client) + '</b><span>' + (c.dateStart ? dateFr(c.dateStart) : 'Date à préciser') + (c.produits ? ' · ' + esc(c.produits) : '') + (c.tirages ? ' · ' + c.tirages + ' tirages' : '') + '</span></button>'; }).join('') : '<div class="pb-vide" style="padding:10px">' + (q ? 'Aucune réservation à ce nom.' : 'Tapez le nom de la cliente.') + '</div>';
  };
  /* un clic sur la cliente : l'événement est créé (nom, dates) et le nombre de tirages réservés devient la limite d'impressions */
  window.pbCreerDepuis = async function (i) {
    var c = (PB.clientes || [])[i]; if (!c) return;
    var corps = { nom: c.client, date: c.dateStart, fin: c.dateEnd || c.dateStart, resa: c.id };
    if (c.tirages) corps.impression = { limites: { on: true, parEvenement: c.tirages, parSession: 1 } };
    try { var r = await api('/photobooth/evt', { method: 'POST', body: JSON.stringify(corps) }); PB.nouveau = false; PB.evt = r.evenement; PB.section = 'experience'; toast('Événement créé' + (c.tirages ? ' : limite de ' + c.tirages + ' impressions' : '')); rendre(); }
    catch (e) { toast('Échec : ' + e.message, true); }
  };
  window.pbNouveau = async function (on) { PB.nouveau = on !== false; PB.manuel = false; PB.resa = ''; if (PB.nouveau && !PB.clientes) await chargerClientes(); rendre(); };
  window.pbAutoSuppr = async function () {
    var k = PB.liste.filter(function (e) { return e.auto; }); if (!k.length) return toast('Aucun événement créé automatiquement');
    if (!confirm('Supprimer ' + k.length + ' événement(s) créé(s) automatiquement depuis le planning, avec leurs photos ?\n\nIl n’y a pas de retour en arrière.')) return;
    for (var i = 0; i < k.length; i++) { try { await api('/photobooth/evt?id=' + k[i].id, { method: 'DELETE' }); } catch (e) {} }
    toast(k.length + ' événement(s) supprimé(s)'); await chargerListe(); rendre();
  };
  window.pbCreer = async function () {
    var nom = val('pbn-nom').trim(), date = val('pbn-date');
    if (!nom) return toast('Indiquez le nom de l’événement', true);
    try { var r = await api('/photobooth/evt', { method: 'POST', body: JSON.stringify({ nom: nom, date: date, fin: PB.resaFin || date, resa: PB.resa || '' }) }); PB.nouveau = false; PB.evt = r.evenement; PB.section = 'experience'; toast('Événement créé'); rendre(); }
    catch (e) { toast('Échec : ' + e.message, true); }
  };
  window.pbEvt = async function (id) {
    try { var r = await api('/photobooth/evt?id=' + encodeURIComponent(id)); PB.evt = r.evenement; PB.formats = r.formats || PB.formats; PB.section = 'tableau'; PB.edit = null; rendre(); window.scrollTo(0, 0); }
    catch (e) { toast('Échec : ' + e.message, true); }
  };
  window.pbRetour = async function () { PB.evt = null; PB.edit = null; await chargerListe(); rendre(); };
  async function enregistrer(msg) {
    try { var r = await api('/photobooth/evt', { method: 'POST', body: JSON.stringify(PB.evt) }); PB.evt = r.evenement; toast(msg || 'Enregistré'); return true; }
    catch (e) { toast('Échec : ' + e.message, true); return false; }
  }

  /* ───────── un événement ───────── */
  var SECTIONS = [['tableau', 'Tableau de bord', ''], ['experience', 'Expérience photobooth', 'Basique'], ['capture', 'Paramètres de capture', ''], ['accueil', 'Écran d’accueil', 'Avancé'], ['partage', 'Paramètres de partage', 'Impression et partage'], ['impression', 'Paramètres d’impression', ''], ['galerie', 'Galerie en ligne', '']];
  function rendreEvt(z) {
    var nav = SECTIONS.map(function (s) { return (s[2] ? '<div class="g">' + s[2] + '</div>' : '') + '<button type="button" class="' + (PB.section === s[0] ? 'on' : '') + '" onclick="pbSection(\'' + s[0] + '\')">' + s[1] + '</button>'; }).join('');
    z.innerHTML = '<div class="pb-tete"><div><button class="btn btn-ghost" style="padding:5px 11px;font-size:12.5px;margin-bottom:6px" onclick="pbRetour()">‹ Retour aux événements</button><h2>' + esc(PB.evt.nom) + '</h2></div></div><div class="pb-evt"><nav class="pb-nav">' + nav + '</nav><div id="pbContenu"></div></div>';
    var c = $('pbContenu');
    ({ tableau: secTableau, experience: secExperience, capture: secCapture, accueil: secAccueil, partage: secPartage, impression: secImpression, galerie: secGalerie })[PB.section](c);
  }
  window.pbSection = function (s) { PB.section = s; PB.edit = null; PB.modeles = false; rendre(); };

  /* tableau de bord */
  function secTableau(c) {
    var e = PB.evt;
    c.innerHTML = '<div class="pb-compteurs" id="pbCompteurs"><div><b>…</b><span>Photos prises</span></div><div><b>…</b><span>Photos imprimées</span></div><div><b>…</b><span>QR codes scannés</span></div></div>'
      + (e.auto && e.auto.resa ? '<p class="aide" style="color:#6b7280;font-size:13px;margin:10px 0 0">Créé automatiquement depuis la réservation du planning.</p>' : '')
      + '<div class="pb-bloc" style="margin-top:14px"><h3>Informations</h3><div class="pb-champs">' + champ('pbi-nom', 'Nom de l’événement', e.nom) + champ('pbi-date', 'Date', e.date, '', 'date') + champ('pbi-fin', 'Dernier jour', e.fin, '', 'date') + champ('pbi-mdp', 'Mot de passe des photobooths (facultatif)', e.mdp, 'Pour ouvrir l’événement sur un photobooth') + '</div>'
      + ligne('Événement ouvert sur les photobooths', 'Décochez pour le retirer des photobooths sans le supprimer', sw('pbi-actif', e.actif !== false))
      + '<div class="pb-actions" style="margin-top:8px"><button class="btn" onclick="pbInfosSauver()">Enregistrer</button></div></div>'
      + '<div class="pb-bloc"><h3>Partager avec un lien</h3>' + ligne('Lien de l’événement', 'Toute personne qui a le lien voit la galerie (réglable dans « Galerie en ligne »)', sw('pbi-lien', e.galerie.lien, 'pbLienBasculer(this.checked)'))
      + '<div class="pb-champs"><label>Lien<input readonly id="pbi-url" value="' + (e.galerie.lien ? 'Chargement…' : 'Activez le lien ci-dessus') + '" onclick="this.select()"></label></div><div class="pb-actions" style="margin-top:8px"><button class="btn btn-ghost" onclick="pbLienCopier()">Copier le lien</button><button class="btn btn-ghost" onclick="pbLienOuvrir()">Ouvrir la galerie</button></div></div>'
      + '<div class="pb-bloc"><div class="pb-actions"><button class="btn btn-ghost" style="color:#b03a2a" onclick="pbSupprimer()">Supprimer l’événement</button></div></div>'
      + '<div class="pb-bloc"><h3>Photos <span style="font-weight:400;color:#6b7280;font-size:12px">(mise à jour en direct)</span></h3><div id="pbPhotos"><div class="pb-vide">Chargement…</div></div></div>';
    pbPhotosCharger();
  }
  var pbLien = '';
  async function pbPhotosCharger() {
    clearTimeout(pbPhotosCharger.t);
    var zone = $('pbPhotos'); if (!zone || !PB.evt || PB.section !== 'tableau') return;
    var id = PB.evt.id, r;
    try { r = await api('/photobooth/photos?evt=' + id); } catch (x) { zone.innerHTML = '<div class="pb-vide">Impossible de charger les photos.</div>'; return; }
    if (!PB.evt || PB.evt.id !== id || !$('pbPhotos')) return;
    var s = r.stats || {}, cp = $('pbCompteurs'); if (cp) cp.innerHTML = '<div><b>' + (s.photos || 0) + '</b><span>Photos prises</span></div><div><b>' + (s.imprimees || 0) + '</b><span>Photos imprimées</span></div><div><b>' + (s.scans || 0) + '</b><span>QR codes scannés</span></div>';
    pbLien = r.lien || ''; var u = $('pbi-url'); if (u && PB.evt.galerie.lien) u.value = pbLien;
    var l = r.photos || [], sig = l.map(function (p) { return p.id + p.fichiers.length + p.imprimees + p.scanne; }).join();
    if (zone.dataset.sig !== sig) {
      zone.dataset.sig = sig;
      var src = function (p, n) { return '/api/admin/photobooth/photo?evt=' + id + '&prise=' + p.id + '&nom=' + n; };
      zone.innerHTML = l.length ? '<div class="pb-photos">' + l.map(function (p) {
        var bruts = p.fichiers.filter(function (n) { return /^brut-/.test(n); });
        return '<figure>' + (p.fichiers.indexOf('final') >= 0 ? '<a href="' + src(p, 'final') + '" target="_blank" rel="noopener"><img loading="lazy" src="' + src(p, 'final') + '" alt=""></a>' : '<div class="pb-vide">envoi en cours…</div>')
          + '<figcaption>' + new Date(p.cree).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + (p.imprimees ? ' · ' + p.imprimees + ' impr.' : '') + (p.scanne ? ' · QR scanné' : '')
          + '<span>' + (p.fichiers.indexOf('final') >= 0 ? '<a href="' + src(p, 'final') + '&dl=1">Télécharger</a>' : '') + bruts.map(function (n) { return ' · <a href="' + src(p, n) + '&dl=1">brute ' + n.slice(5) + '</a>'; }).join('')
          + ' · <a href="#" onclick="pbPhotoSuppr(\'' + p.id + '\');return false" style="color:#b03a2a">Supprimer</a></span></figcaption></figure>';
      }).join('') + '</div>' : '<div class="pb-vide">Aucune photo pour l’instant. Elles apparaîtront ici en direct, dès la première prise de vue.</div>';
    }
    pbPhotosCharger.t = setTimeout(pbPhotosCharger, 10000);
  }
  window.pbPhotoSuppr = async function (prise) {
    if (!confirm('Supprimer cette photo (encadrée et brutes) ? Elle disparaîtra aussi de la galerie des invités.')) return;
    try { await api('/photobooth/photo?evt=' + PB.evt.id + '&prise=' + prise, { method: 'DELETE' }); toast('Photo supprimée'); $('pbPhotos').dataset.sig = ''; pbPhotosCharger(); } catch (x) { toast('Échec : ' + x.message, true); }
  };
  window.pbLienCopier = function () { if (!pbLien || !PB.evt.galerie.lien) return toast('Activez d’abord le lien', true); navigator.clipboard.writeText(pbLien).then(function () { toast('Lien copié'); }); };
  window.pbLienOuvrir = function () { if (!pbLien || !PB.evt.galerie.lien) return toast('Activez d’abord le lien', true); window.open(pbLien, '_blank', 'noopener'); };
  window.pbInfosSauver = function () {
    var e = PB.evt; e.nom = val('pbi-nom').trim() || e.nom; e.date = val('pbi-date'); e.fin = val('pbi-fin'); e.mdp = val('pbi-mdp').trim(); e.actif = coche('pbi-actif');
    enregistrer('Informations enregistrées').then(rendre);
  };
  window.pbLienBasculer = function (on) { PB.evt.galerie.lien = on; enregistrer(on ? 'Lien activé' : 'Lien désactivé').then(function () { var u = $('pbi-url'); if (u) u.value = on ? (pbLien || 'Chargement…') : 'Activez le lien ci-dessus'; pbPhotosCharger(); }); };
  window.pbSupprimer = async function () {
    if (!confirm('Supprimer l’événement « ' + PB.evt.nom + ' », ses mises en page et ses images ?\n\nIl n’y a pas de retour en arrière.')) return;
    try { await api('/photobooth/evt?id=' + PB.evt.id, { method: 'DELETE' }); toast('Événement supprimé'); pbRetour(); } catch (e) { toast('Échec : ' + e.message, true); }
  };

  /* ───────── expérience : mises en page ───────── */
  function dessiner(cv, m, img, petit) {
    var f = PB.formats[m.format] || { w: m.w, h: m.h };
    cv.width = f.w; cv.height = f.h; var g = cv.getContext('2d');
    g.fillStyle = m.fond || '#fff'; g.fillRect(0, 0, f.w, f.h);
    (m.cases || []).forEach(function (k) {
      g.save(); g.translate(k.x + k.w / 2, k.y + k.h / 2); g.rotate((k.r || 0) * Math.PI / 180);
      g.fillStyle = COUL[k.n] || '#999'; g.fillRect(-k.w / 2, -k.h / 2, k.w, k.h);
      g.fillStyle = '#fff'; g.font = '800 ' + Math.round(Math.min(k.w, k.h) * (petit ? 0.45 : 0.3)) + 'px Inter,Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(k.n), 0, 0);
      g.restore();
    });
    if (img) g.drawImage(img, 0, 0, f.w, f.h);
  }
  function chargerImage(id, cb) { if (!id) return cb(null); var i = new Image(); i.onload = function () { cb(i); }; i.onerror = function () { cb(null); }; i.src = urlImage(id); }
  function secExperience(c) {
    if (PB.edit) return editeur(c);
    var l = PB.evt.misesEnPage || [];
    c.innerHTML = '<div class="pb-sous"><button class="on">Mises en page</button></div><p class="aide" style="color:#6b7280;font-size:13px;margin:0 0 12px">Utilisées pour les prises de vue et l’impression. L’invité choisit sa mise en page sur l’écran (s’il n’y en a qu’une, la prise de vue démarre directement).</p>'
      + '<div class="pb-actions" style="margin-bottom:14px"><button class="btn" onclick="pbModeles()">+ Nouvelle mise en page</button></div>'
      + (PB.modeles ? '<div class="pb-bloc"><h3>Choisir un format de base</h3><p class="aide">Posez ensuite votre calque (votre design PNG) par-dessus et ajustez les cases 1, 2, 3, 4 dans ses trous.</p><div class="pb-modeles" id="pbModeles"></div></div>' : '')
      + (l.length ? '<div class="pb-mp" id="pbMpListe"></div>' : '<div class="pb-bloc"><div class="pb-vide">Aucune mise en page pour l’instant.</div></div>');
    if (PB.modeles) {
      var zm = $('pbModeles'), fam = function (f) { return f === '2x6' ? 'b' : 'p'; }, actuelle = l.length ? fam(l[0].format) : '';
      /* un événement est soit en 10×15, soit en bandelettes 5×15 : jamais les deux */
      if (actuelle) zm.insertAdjacentHTML('beforebegin', '<p class="aide" style="color:#6b7280;font-size:13px;margin:0 0 10px">Cet événement est en <b>' + (actuelle === 'b' ? 'bandelettes 5×15' : '10×15') + '</b> : seuls ces formats sont proposés. Pour changer, supprimez d’abord ses mises en page.</p>');
      MODELES.forEach(function (mo, i) {
        if (actuelle && fam(mo.format) !== actuelle) return;
        var b = document.createElement('button'); b.type = 'button'; var cv = document.createElement('canvas');
        dessiner(cv, { format: mo.format, fond: '#f0eee8', cases: mo.cases.map(function (q, j) { return { n: j + 1, x: q[0], y: q[1], w: q[2], h: q[3], r: 0 }; }) }, null, true);
        b.appendChild(cv); b.appendChild(document.createTextNode(mo.nom)); b.onclick = function () { pbCreerMp(i); }; zm.appendChild(b);
      });
    }
    var zl = $('pbMpListe'); if (!zl) return;
    l.forEach(function (m, i) {
      var d = document.createElement('div'); d.className = 'pb-mp-c'; var cv = document.createElement('canvas'); d.appendChild(cv);
      d.insertAdjacentHTML('beforeend', '<div><b>' + esc(m.nom) + '</b><br><small>' + esc((PB.formats[m.format] || {}).nom || m.format) + ' · ' + m.cases.length + ' case' + (m.cases.length > 1 ? 's' : '') + (m.cadre ? '' : ' · sans calque') + '</small></div><div class="pb-actions"><button class="btn btn-ghost" onclick="pbModifierMp(' + i + ')">Modifier</button><button class="btn btn-ghost" onclick="pbDupliquerMp(' + i + ')">Dupliquer</button><button class="btn btn-ghost" title="Monter" onclick="pbDeplacerMp(' + i + ',-1)"' + (i ? '' : ' disabled') + '>↑</button><button class="btn btn-ghost" title="Descendre" onclick="pbDeplacerMp(' + i + ',1)"' + (i < l.length - 1 ? '' : ' disabled') + '>↓</button><button class="btn btn-ghost" style="color:#b03a2a" onclick="pbSupprimerMp(' + i + ')">Supprimer</button></div>');
      zl.appendChild(d); dessiner(cv, m, null, true); chargerImage(m.cadre, function (img) { if (img) dessiner(cv, m, img, true); });
    });
  }
  window.pbModeles = function () { PB.modeles = !PB.modeles; rendre(); };
  window.pbCreerMp = function (i) {
    var mo = MODELES[i], f = PB.formats[mo.format];
    PB.edit = { i: -1, m: { nom: mo.nom, format: mo.format, w: f.w, h: f.h, cadre: '', fond: '#FFFFFF', cases: mo.cases.map(function (q, j) { return { n: j + 1, x: q[0], y: q[1], w: q[2], h: q[3], r: 0 }; }) } };
    PB.sel = 0; PB.modeles = false; rendre();
  };
  window.pbModifierMp = function (i) { PB.edit = { i: i, m: JSON.parse(JSON.stringify(PB.evt.misesEnPage[i])) }; PB.sel = 0; rendre(); };
  window.pbDupliquerMp = function (i) { var m = JSON.parse(JSON.stringify(PB.evt.misesEnPage[i])); delete m.id; m.nom = m.nom + ' (copie)'; PB.evt.misesEnPage.splice(i + 1, 0, m); enregistrer('Mise en page dupliquée').then(rendre); };
  window.pbDeplacerMp = function (i, d) { var l = PB.evt.misesEnPage, j = i + d; if (j < 0 || j >= l.length) return; var t = l[i]; l[i] = l[j]; l[j] = t; enregistrer('Ordre enregistré').then(rendre); };
  window.pbSupprimerMp = function (i) { if (!confirm('Supprimer la mise en page « ' + PB.evt.misesEnPage[i].nom + ' » ?')) return; PB.evt.misesEnPage.splice(i, 1); enregistrer('Mise en page supprimée').then(rendre); };

  /* ── éditeur : calque PNG + cases numérotées à glisser / redimensionner ── */
  var echelle = 1;
  function editeur(c) {
    var m = PB.edit.m, f = PB.formats[m.format];
    var largeurDispo = Math.min(c.clientWidth || 700, 900) - 300; if (largeurDispo < 280) largeurDispo = Math.min(c.clientWidth || 700, 700) - 40;
    echelle = Math.min(largeurDispo / f.w, 620 / f.h); if (echelle > 1) echelle = 1;
    c.innerHTML = '<div class="pb-tete"><div class="pb-f" style="flex:1;min-width:220px"><span>Nom de la mise en page</span><input id="pbe-nom" value="' + esc(m.nom) + '"></div><div class="pb-actions"><button class="btn" onclick="pbSauverMp()">Enregistrer la mise en page</button><button class="btn btn-ghost" onclick="pbAnnulerMp()">Annuler</button></div></div>'
      + '<div class="pb-ed"><div class="pb-scene-z"><div class="pb-scene" id="pbScene" style="width:' + Math.round(f.w * echelle) + 'px;height:' + Math.round(f.h * echelle) + 'px;background:' + esc(m.fond) + '"></div></div>'
      + '<div class="pb-outils">'
      + '<div class="pb-bloc" style="margin:0"><h3>Calque</h3><p class="aide">Votre design PNG au format ' + esc(f.nom) + ' (' + f.w + ' × ' + f.h + ' px), avec les emplacements des photos transparents.</p><div class="pb-actions"><label class="btn btn-ghost" style="cursor:pointer">' + (m.cadre ? 'Remplacer' : 'Choisir le PNG') + '<input type="file" accept="image/png" hidden onchange="pbCalque(this)"></label>' + (m.cadre ? '<button class="btn btn-ghost" onclick="pbCalqueRetirer()">Retirer</button>' : '') + '</div>'
      + (m.cadre ? '<div class="pb-actions" style="margin-top:8px"><button class="btn" onclick="pbDetecter()">Détecter les trous du calque</button></div><label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:#6b7280;margin-top:10px"><input type="range" id="pbe-op" min="15" max="100" value="100" oninput="pbOpacite(this.value)"> Transparence du calque (pour ajuster)</label>' : '') + '</div>'
      + '<div class="pb-bloc" style="margin:0"><h3>Cases des photos</h3><p class="aide">Faites glisser les cases dans les trous ; le coin en bas à droite les redimensionne. Flèches du clavier : 1 px (Maj : 10 px).</p><div class="pb-actions"><button class="btn btn-ghost" onclick="pbAjouterCase()">+ Ajouter une case</button></div><div id="pbCaseReg" style="margin-top:10px"></div></div>'
      + '<div class="pb-bloc" style="margin:0"><h3>Fond</h3><div class="pb-champs"><label>Couleur sous le calque<input type="color" id="pbe-fond" value="' + esc(m.fond) + '" oninput="pbFond(this.value)" style="height:38px;padding:2px"></label></div></div>'
      + '</div></div>';
    dessinerScene();
  }
  /* aperçu : une photo type 3:2 (celle du reflex) recadrée dans la case, sans déformation, comme sur la borne */
  var EXEMPLE = 'url("data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe3f5"/><stop offset="1" stop-color="#f1e4d3"/></linearGradient></defs><rect width="300" height="200" fill="url(#g)"/><g fill="#6b7a8f"><circle cx="105" cy="78" r="22"/><path d="M62 200c0-42 18-68 43-68s43 26 43 68z"/></g><g fill="#8a6a5a"><circle cx="190" cy="84" r="20"/><path d="M150 200c0-40 17-64 40-64s40 24 40 64z"/></g><rect x="1" y="1" width="298" height="198" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2"/></svg>') + '") center/cover no-repeat';
  var fondCase = function (k) { var c = COUL[k.n] || '#999'; return 'linear-gradient(' + c + '55,' + c + '55),' + EXEMPLE; };
  function dessinerScene() {
    var m = PB.edit.m, sc = $('pbScene'); if (!sc) return;
    sc.innerHTML = '';
    m.cases.forEach(function (k, i) {
      var d = document.createElement('div'); d.className = 'pb-case' + (i === PB.sel ? ' sel' : ''); d.dataset.i = i;
      d.style.cssText += 'left:' + k.x * echelle + 'px;top:' + k.y * echelle + 'px;width:' + k.w * echelle + 'px;height:' + k.h * echelle + 'px;background:' + fondCase(k) + ';transform:rotate(' + (k.r || 0) + 'deg);font-size:' + Math.max(14, Math.min(k.w, k.h) * echelle * 0.35) + 'px';
      d.textContent = k.n; var p = document.createElement('i'); p.className = 'poignee'; d.appendChild(p);
      d.addEventListener('pointerdown', function (ev) { glisser(ev, i, ev.target === p); });
      sc.appendChild(d);
    });
    if (m.cadre) { var im = document.createElement('img'); im.className = 'pb-calque'; im.id = 'pbCalqueImg'; im.alt = ''; im.src = urlImage(m.cadre); var op = $('pbe-op'); if (op) im.style.opacity = op.value / 100; sc.appendChild(im); }
    reglagesCase();
  }
  function glisser(ev, i, redim) {
    ev.preventDefault(); PB.sel = i; var k = PB.edit.m.cases[i], x0 = ev.clientX, y0 = ev.clientY, d = { x: k.x, y: k.y, w: k.w, h: k.h };
    var el = ev.currentTarget; el.setPointerCapture && el.setPointerCapture(ev.pointerId);
    document.querySelectorAll('.pb-case').forEach(function (n) { n.classList.toggle('sel', +n.dataset.i === i); });
    var bouger = function (e) {
      var dx = (e.clientX - x0) / echelle, dy = (e.clientY - y0) / echelle;
      if (redim) { k.w = Math.max(30, Math.round(d.w + dx)); k.h = e.shiftKey ? Math.max(30, Math.round(k.w * d.h / d.w)) : Math.max(30, Math.round(d.h + dy)); } else { k.x = Math.round(d.x + dx); k.y = Math.round(d.y + dy); }
      el.style.left = k.x * echelle + 'px'; el.style.top = k.y * echelle + 'px'; el.style.width = k.w * echelle + 'px'; el.style.height = k.h * echelle + 'px';
      var ind = $('pbRecadre'); if (ind) ind.innerHTML = recadrage(k);
    };
    var fin = function () { el.removeEventListener('pointermove', bouger); el.removeEventListener('pointerup', fin); el.removeEventListener('pointercancel', fin); reglagesCase(); };
    el.addEventListener('pointermove', bouger); el.addEventListener('pointerup', fin); el.addEventListener('pointercancel', fin);
    reglagesCase();
  }
  function recadrage(k) {
    var r = k.w / k.h, ideal = 1.5, vis = r > ideal ? ideal / r : r / ideal, coupe = Math.round((1 - vis) * 100);
    return coupe <= 3 ? '<span style="color:#2a7a4b">✓ Proportions du reflex (3:2) : toute l’image est utilisée.</span>'
      : '<span style="color:' + (coupe > 30 ? '#b03a2a' : '#8a6a1a') + '">' + coupe + ' % de l’image du reflex est coupé (' + (r > ideal ? 'en haut et en bas' : 'sur les côtés') + '). Jamais déformée.</span>';
  }
  function reglagesCase() {
    var z = $('pbCaseReg'); if (!z) return; var k = PB.edit.m.cases[PB.sel];
    if (!k) { z.innerHTML = '<div style="font-size:12.5px;color:#8a8f98">Touchez une case pour la régler.</div>'; return; }
    var n = function (id, l, v) { return '<label>' + l + '<input type="number" id="' + id + '" value="' + v + '" oninput="pbCaseChamp()"></label>'; };
    z.innerHTML = '<div class="pb-champs" style="grid-template-columns:1fr 1fr">'
      + '<label>Pose<select id="pbc-n" onchange="pbCaseChamp()">' + [1, 2, 3, 4].map(function (x) { return '<option' + (x === k.n ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' + n('pbc-r', 'Rotation (°)', k.r || 0)
      + n('pbc-x', 'Gauche (px)', k.x) + n('pbc-y', 'Haut (px)', k.y) + n('pbc-w', 'Largeur', k.w) + n('pbc-h', 'Hauteur', k.h) + '</div>'
      + '<p id="pbRecadre" class="aide" style="font-size:12.5px;margin:8px 0 0">' + recadrage(k) + '</p><p class="aide" style="font-size:12px;color:#6b7280;margin:4px 0 0">Maj + coin en bas à droite : agrandir en gardant les proportions.</p>'
      + '<div class="pb-actions" style="margin-top:8px"><button class="btn btn-ghost" style="color:#b03a2a" onclick="pbSupprimerCase()">Supprimer cette case</button></div>';
  }
  window.pbCaseChamp = function () {
    var k = PB.edit.m.cases[PB.sel]; if (!k) return;
    k.n = +val('pbc-n') || 1; k.r = Math.max(-45, Math.min(45, +val('pbc-r') || 0)); k.x = Math.round(+val('pbc-x') || 0); k.y = Math.round(+val('pbc-y') || 0); k.w = Math.max(30, Math.round(+val('pbc-w') || 30)); k.h = Math.max(30, Math.round(+val('pbc-h') || 30));
    var foc = document.activeElement && document.activeElement.id; dessinerScene(); if (foc && $(foc)) { $(foc).focus(); }
  };
  window.pbAjouterCase = function () {
    var m = PB.edit.m, f = PB.formats[m.format], n = Math.min(4, (m.cases.reduce(function (a, k) { return Math.max(a, k.n); }, 0)) + 1);
    m.cases.push({ n: n, x: Math.round(f.w * 0.3), y: Math.round(f.h * 0.3), w: Math.round(f.w * 0.4), h: Math.round(f.h * 0.25), r: 0 }); PB.sel = m.cases.length - 1; dessinerScene();
  };
  window.pbSupprimerCase = function () { PB.edit.m.cases.splice(PB.sel, 1); PB.sel = -1; dessinerScene(); };
  window.pbFond = function (v) { PB.edit.m.fond = v; var sc = $('pbScene'); if (sc) sc.style.background = v; };
  window.pbOpacite = function (v) { var im = $('pbCalqueImg'); if (im) im.style.opacity = v / 100; };
  document.addEventListener('keydown', function (e) {
    if (!PB.edit || PB.sel < 0 || !$('pbScene') || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
    var k = PB.edit.m.cases[PB.sel], p = e.shiftKey ? 10 : 1, ok = true;
    if (e.key === 'ArrowLeft') k.x -= p; else if (e.key === 'ArrowRight') k.x += p; else if (e.key === 'ArrowUp') k.y -= p; else if (e.key === 'ArrowDown') k.y += p; else ok = false;
    if (ok) { e.preventDefault(); dessinerScene(); }
  });
  async function envoyerImage(fichier) {
    var r = await fetch('/api/admin/photobooth/image?evt=' + PB.evt.id + '&nom=' + encodeURIComponent(fichier.name || ''), { method: 'POST', credentials: 'same-origin', headers: { 'content-type': fichier.type || 'application/octet-stream' }, body: fichier });
    var j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(j.error || ('Erreur ' + r.status));
    return j.id;
  }
  window.pbCalque = async function (inp) {
    var f = inp.files && inp.files[0]; if (!f) return; var m = PB.edit.m, fo = PB.formats[m.format];
    var dims = await new Promise(function (ok) { var i = new Image(); i.onload = function () { ok([i.naturalWidth, i.naturalHeight]); }; i.onerror = function () { ok([0, 0]); }; i.src = URL.createObjectURL(f); });
    if (dims[0] && Math.abs(dims[0] / dims[1] - fo.w / fo.h) > 0.02) toast('Attention : ce PNG fait ' + dims[0] + ' × ' + dims[1] + ' px, pas les proportions du format ' + fo.nom + ' (' + fo.w + ' × ' + fo.h + ')', true);
    try { m.cadre = await envoyerImage(f); toast('Calque ajouté'); editeur($('pbContenu')); } catch (e) { toast('Échec : ' + e.message, true); }
  };
  window.pbCalqueRetirer = function () { PB.edit.m.cadre = ''; editeur($('pbContenu')); };
  /* repère les zones transparentes du calque et y place une case par trou (de haut en bas, puis de gauche à droite) */
  window.pbDetecter = function () {
    var m = PB.edit.m, f = PB.formats[m.format];
    chargerImage(m.cadre, function (img) {
      if (!img) return toast('Calque illisible', true);
      var r = 6, W = Math.ceil(f.w / r), H = Math.ceil(f.h / r), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var g = cv.getContext('2d'); g.drawImage(img, 0, 0, W, H); var a = g.getImageData(0, 0, W, H).data, vu = new Uint8Array(W * H), trous = [];
      for (var p = 0; p < W * H; p++) {
        if (vu[p] || a[p * 4 + 3] > 40) continue;
        var pile = [p], x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0; vu[p] = 1;
        while (pile.length) { var q = pile.pop(), x = q % W, y = (q - x) / W; n++; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
          [q - 1, q + 1, q - W, q + W].forEach(function (v, j) { if (v < 0 || v >= W * H || vu[v] || a[v * 4 + 3] > 40) return; if ((j === 0 && x === 0) || (j === 1 && x === W - 1)) return; vu[v] = 1; pile.push(v); }); }
        if (n > W * H * 0.01) trous.push({ x: x0 * r, y: y0 * r, w: (x1 - x0 + 1) * r, h: (y1 - y0 + 1) * r });
      }
      if (!trous.length) return toast('Aucun trou transparent trouvé dans ce calque', true);
      trous.sort(function (u, v) { return Math.abs(u.y - v.y) > 40 ? u.y - v.y : u.x - v.x; });
      /* léger débord sous le calque, pour qu'aucun liseré blanc n'apparaisse au bord du trou */
      m.cases = trous.slice(0, 8).map(function (t, i) { return { n: Math.min(4, i + 1), x: Math.max(0, t.x - 6), y: Math.max(0, t.y - 6), w: t.w + 12, h: t.h + 12, r: 0 }; });
      PB.sel = 0; dessinerScene(); toast(trous.length + ' emplacement' + (trous.length > 1 ? 's trouvés' : ' trouvé') + ' : vérifiez les numéros des poses');
    });
  };
  window.pbSauverMp = function () {
    var m = PB.edit.m; m.nom = val('pbe-nom').trim() || m.nom;
    if (!m.cases.length) return toast('Ajoutez au moins une case photo', true);
    if (PB.edit.i >= 0) PB.evt.misesEnPage[PB.edit.i] = m; else PB.evt.misesEnPage.push(m);
    enregistrer('Mise en page enregistrée').then(function (ok) { if (ok) { PB.edit = null; rendre(); } });
  };
  window.pbAnnulerMp = function () { PB.edit = null; rendre(); };

  /* ───────── paramètres de capture ───────── */
  function secCapture(c) {
    var k = PB.evt.capture;
    c.innerHTML = '<div class="pb-bloc"><h3>Compte à rebours</h3><p class="aide">Après le choix de la mise en page : un compte à rebours avant la première photo, puis un plus court entre les poses suivantes.</p><div class="pb-champs">'
      + champ('pbk-1', 'Avant la 1re photo (secondes)', k.premier, '7', 'number', ' min="1" max="30"') + champ('pbk-n', 'Entre les poses suivantes (secondes)', k.suivants, '3', 'number', ' min="1" max="30"') + '</div></div>'
      + '<div class="pb-bloc"><h3>Message avant la première photo</h3><p class="aide">Affiché pendant que l’invité se voit en direct dans la case, avant le compte à rebours.</p><div class="pb-champs">' + champ('pbk-txt', 'Message', k.texteAvant, 'Placez-vous dans le cadre') + '</div></div>'
      + '<div class="pb-bloc"><h3>Appareil photo</h3><p class="aide" style="margin:0">Les réglages du Canon à distance (ISO, ouverture, vitesse, balance des blancs) arriveront à l’étape 2, une fois l’appli installée sur le mini-PC avec l’appareil branché.</p></div>'
      + '<div class="pb-pied"><button class="btn" onclick="pbCaptureSauver()">Enregistrer</button></div>';
  }
  window.pbCaptureSauver = function () { PB.evt.capture = { premier: +val('pbk-1') || 7, suivants: +val('pbk-n') || 3, texteAvant: val('pbk-txt').trim() }; enregistrer('Compte à rebours enregistré').then(rendre); };

  /* ───────── écran d'accueil (1920 × 1080) ───────── */
  var eAcc = 1;
  function secAccueil(c) {
    var a = PB.evt.accueil, l = Math.min((c.clientWidth || 800), 900); eAcc = l / 1920;
    var pol = POLICES[a.texte.police] || POLICES.elegante;
    c.innerHTML = '<div class="pb-bloc"><h3>Écran d’accueil</h3><p class="aide">Aperçu de l’écran du photobooth (1920 × 1080). Faites glisser le bouton, le texte et le logo. Le cadenas (en haut à droite) donne accès aux réglages du photobooth.</p>'
      + '<div class="pb-accueil" id="pbAcc" style="width:' + Math.round(1920 * eAcc) + 'px;height:' + Math.round(1080 * eAcc) + 'px;background-color:' + esc(a.couleur) + ';' + (a.fond ? 'background-image:url(' + urlImage(a.fond) + ')' : '') + '">'
      + (a.galerie ? '<div class="pb-acc-coin" style="left:1.5%"><svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/></svg></div>' : '')
      + '<div class="pb-acc-coin" style="right:1.5%;background:transparent"><svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="#8a8f98" stroke-width="2" opacity=".8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div>'
      + (a.texte.contenu ? '<div class="pb-acc-el" data-el="texte" style="left:' + a.texte.x * eAcc + 'px;top:' + a.texte.y * eAcc + 'px;white-space:nowrap;color:' + esc(a.texte.couleur) + ';font-family:' + pol[0] + ';font-weight:' + pol[1] + ';font-size:' + a.texte.taille * eAcc + 'px">' + esc(a.texte.contenu) + '</div>' : '')
      + (a.logo.image ? '<img class="pb-acc-el" data-el="logo" alt="" draggable="false" src="' + urlImage(a.logo.image) + '" style="left:' + a.logo.x * eAcc + 'px;top:' + a.logo.y * eAcc + 'px;width:' + a.logo.largeur * eAcc + 'px">' : '')
      + '<div class="pb-acc-el pb-acc-bt" data-el="bouton" style="left:' + a.bouton.x * eAcc + 'px;top:' + a.bouton.y * eAcc + 'px;width:' + a.bouton.taille * eAcc + 'px;height:' + a.bouton.taille * eAcc + 'px;background:' + esc(a.bouton.couleur) + '"><svg viewBox="0 0 24 24" width="52%" height="52%" fill="none" stroke="' + esc(a.bouton.icone) + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="4"/></svg></div>'
      + '</div></div>'
      + '<div class="pb-bloc"><h3>Arrière-plan</h3><div class="pb-actions"><label class="btn btn-ghost" style="cursor:pointer">' + (a.fond ? 'Remplacer l’image' : 'Choisir une image (1920 × 1080)') + '<input type="file" accept="image/png,image/jpeg,image/webp" hidden onchange="pbAccImage(this,\'fond\')"></label>' + (a.fond ? '<button class="btn btn-ghost" onclick="pbAccRetirer(\'fond\')">Retirer</button>' : '') + '</div><div class="pb-champs" style="margin-top:10px"><label>Couleur de fond (sans image)<input type="color" id="pba-couleur" value="' + esc(a.couleur) + '" style="height:38px;padding:2px"></label></div></div>'
      + '<div class="pb-bloc"><h3>Bouton appareil photo</h3><div class="pb-champs"><label>Couleur du bouton<input type="color" id="pba-bc" value="' + esc(a.bouton.couleur) + '" style="height:38px;padding:2px"></label><label>Couleur de l’icône<input type="color" id="pba-bi" value="' + esc(a.bouton.icone) + '" style="height:38px;padding:2px"></label><label>Taille (' + a.bouton.taille + ' px)<input type="range" id="pba-bt" min="80" max="600" value="' + a.bouton.taille + '"></label></div>'
      + ligne('Bouton galerie', 'Petit bouton en haut à gauche : les invités voient la galerie de l’événement', sw('pba-gal', a.galerie)) + '</div>'
      + '<div class="pb-bloc"><h3>Texte</h3><div class="pb-champs">' + champ('pba-tx', 'Texte (facultatif)', a.texte.contenu, 'Joyeux Noël') + '<label>Police<select id="pba-tp">' + Object.keys(POLICES).map(function (k) { return '<option value="' + k + '"' + (k === a.texte.police ? ' selected' : '') + '>' + POLICES[k][2] + '</option>'; }).join('') + '</select></label><label>Couleur<input type="color" id="pba-tc" value="' + esc(a.texte.couleur) + '" style="height:38px;padding:2px"></label><label>Taille (' + a.texte.taille + ' px)<input type="range" id="pba-tt" min="24" max="260" value="' + a.texte.taille + '"></label></div></div>'
      + '<div class="pb-bloc"><h3>Logo</h3><div class="pb-actions"><label class="btn btn-ghost" style="cursor:pointer">' + (a.logo.image ? 'Remplacer le logo' : 'Choisir un logo (PNG)') + '<input type="file" accept="image/png,image/jpeg,image/webp" hidden onchange="pbAccImage(this,\'logo\')"></label>' + (a.logo.image ? '<button class="btn btn-ghost" onclick="pbAccRetirer(\'logo\')">Retirer</button>' : '') + '</div>' + (a.logo.image ? '<div class="pb-champs" style="margin-top:10px"><label>Largeur (' + a.logo.largeur + ' px)<input type="range" id="pba-ll" min="40" max="1920" value="' + a.logo.largeur + '"></label></div>' : '') + '</div>'
      + '<div class="pb-pied"><button class="btn" onclick="pbAccSauver()">Enregistrer l’écran d’accueil</button></div>';
    /* modifications en direct dans l'aperçu */
    ['pba-couleur', 'pba-bc', 'pba-bi', 'pba-bt', 'pba-gal', 'pba-tx', 'pba-tp', 'pba-tc', 'pba-tt', 'pba-ll'].forEach(function (id) { var el = $(id); if (el) el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', function () { lireAccueil(); secAccueil(c); }); });
    document.querySelectorAll('#pbAcc .pb-acc-el').forEach(function (el) {
      el.addEventListener('pointerdown', function (ev) {
        ev.preventDefault(); var cle = el.dataset.el, o = cle === 'bouton' ? a.bouton : (cle === 'texte' ? a.texte : a.logo), x0 = ev.clientX, y0 = ev.clientY, d = { x: o.x, y: o.y };
        el.setPointerCapture && el.setPointerCapture(ev.pointerId);
        var bouger = function (e) { o.x = Math.max(0, Math.min(1920, Math.round(d.x + (e.clientX - x0) / eAcc))); o.y = Math.max(0, Math.min(1080, Math.round(d.y + (e.clientY - y0) / eAcc))); el.style.left = o.x * eAcc + 'px'; el.style.top = o.y * eAcc + 'px'; };
        var fin = function () { el.removeEventListener('pointermove', bouger); el.removeEventListener('pointerup', fin); };
        el.addEventListener('pointermove', bouger); el.addEventListener('pointerup', fin);
      });
    });
  }
  function lireAccueil() {
    var a = PB.evt.accueil;
    a.couleur = val('pba-couleur') || a.couleur; a.bouton.couleur = val('pba-bc') || a.bouton.couleur; a.bouton.icone = val('pba-bi') || a.bouton.icone; a.bouton.taille = +val('pba-bt') || a.bouton.taille; a.galerie = coche('pba-gal');
    a.texte.contenu = val('pba-tx'); a.texte.police = val('pba-tp') || a.texte.police; a.texte.couleur = val('pba-tc') || a.texte.couleur; a.texte.taille = +val('pba-tt') || a.texte.taille; if ($('pba-ll')) a.logo.largeur = +val('pba-ll') || a.logo.largeur;
  }
  window.pbAccImage = async function (inp, cle) {
    var f = inp.files && inp.files[0]; if (!f) return; lireAccueil();
    try { var id = await envoyerImage(f); if (cle === 'fond') PB.evt.accueil.fond = id; else PB.evt.accueil.logo.image = id; toast('Image ajoutée'); secAccueil($('pbContenu')); } catch (e) { toast('Échec : ' + e.message, true); }
  };
  window.pbAccRetirer = function (cle) { lireAccueil(); if (cle === 'fond') PB.evt.accueil.fond = ''; else PB.evt.accueil.logo.image = ''; secAccueil($('pbContenu')); };
  window.pbAccSauver = function () { lireAccueil(); enregistrer('Écran d’accueil enregistré').then(rendre); };

  /* ───────── partage ───────── */
  function secPartage(c) {
    var p = PB.evt.partage;
    c.innerHTML = '<div class="pb-bloc"><h3>QR code</h3>' + ligne('Afficher le QR code', 'Tous les amis présents peuvent le scanner (10 téléphones au plus, dans le quart d’heure) ; un lien transféré plus tard ne s’ouvre pas', sw('pbp-qr', p.qr))
      + ligne('Inclure les photos brutes', 'En plus de la photo encadrée, chaque pose sans cadre', sw('pbp-bruts', p.bruts)) + '</div>'
      + '<div class="pb-bloc"><h3>Écran de partage</h3><div class="pb-champs">' + champ('pbp-titre', 'Titre', p.titre, 'Scannez pour récupérer vos photos') + champ('pbp-duree', 'Durée d’affichage (secondes)', p.duree, '45', 'number', ' min="10" max="600"')
      + champ('pbp-rec', 'Bouton « Recommencer »', p.recommencer, 'Recommencer') + champ('pbp-ter', 'Bouton « Terminer »', p.terminer, 'Terminer') + '</div></div>'
      + '<div class="pb-pied"><button class="btn" onclick="pbPartageSauver()">Enregistrer</button></div>';
  }
  window.pbPartageSauver = function () { PB.evt.partage = { qr: coche('pbp-qr'), bruts: coche('pbp-bruts'), titre: val('pbp-titre').trim(), duree: +val('pbp-duree') || 45, recommencer: val('pbp-rec').trim(), terminer: val('pbp-ter').trim() }; enregistrer('Partage enregistré').then(rendre); };

  /* ───────── impression ───────── */
  function secImpression(c) {
    var im = PB.evt.impression, gen = PB.sousImp !== 'limites';
    c.innerHTML = '<div class="pb-sous"><button class="' + (gen ? 'on' : '') + '" onclick="pbSousImp(\'general\')">Général</button><button class="' + (gen ? '' : 'on') + '" onclick="pbSousImp(\'limites\')">Limites d’impression</button></div>'
      + (gen ? '<div class="pb-bloc">' + ligne('Découpe en deux (bandelettes 5×15)', 'Activé : deux bandelettes sur une feuille 10×15, coupée en deux par l’imprimante. Désactivé : la photo sort entière. Par défaut : activé pour un événement en bandelettes. Pensez aussi à activer la découpe dans les paramètres de l’imprimante.', sw('pbm-dec', im.decoupe == null ? (((PB.evt.misesEnPage || [])[0] || {}).format === '2x6') : im.decoupe)) + ligne('Impression automatique', 'Chaque prise est imprimée sans rien toucher', sw('pbm-auto', im.auto)) + ligne('Afficher le bouton d’impression', 'Sur l’écran de partage, pour imprimer une ou plusieurs copies', sw('pbm-bt', im.bouton))
        + '<div class="pb-champs" style="margin-top:8px">' + champ('pbm-t1', 'Bouton « Imprimer »', im.txtImprimer, 'Imprimer') + champ('pbm-t2', 'Pendant l’impression', im.txtImpression, 'Impression…') + champ('pbm-t3', 'Question du nombre de copies', im.txtCopies, 'Combien de copies ?') + champ('pbm-cm', 'Copies au maximum par impression', im.copiesMax, '2', 'number', ' min="1" max="10"') + '</div></div>'
        : '<div class="pb-bloc">' + ligne('Définir une limite pour les impressions autorisées', '', sw('pbm-lim', im.limites.on)) + '<div class="pb-champs">' + champ('pbm-le', 'Limite par événement (impressions)', im.limites.parEvenement, '200', 'number', ' min="1"') + champ('pbm-ls', 'Limite par prise (impressions)', im.limites.parSession, '1', 'number', ' min="1" max="50"') + '</div></div>')
      + '<div class="pb-pied"><button class="btn" onclick="pbImpSauver()">Enregistrer</button></div>';
  }
  window.pbSousImp = function (s) { lireImpression(); PB.sousImp = s; rendre(); };
  function lireImpression() {
    var im = PB.evt.impression;
    if ($('pbm-auto')) { im.auto = coche('pbm-auto'); im.decoupe = coche('pbm-dec'); im.bouton = coche('pbm-bt'); im.txtImprimer = val('pbm-t1').trim(); im.txtImpression = val('pbm-t2').trim(); im.txtCopies = val('pbm-t3').trim(); im.copiesMax = +val('pbm-cm') || 2; }
    if ($('pbm-lim')) { im.limites = { on: coche('pbm-lim'), parEvenement: +val('pbm-le') || 200, parSession: +val('pbm-ls') || 1 }; }
  }
  window.pbImpSauver = function () { lireImpression(); enregistrer('Impression enregistrée').then(rendre); };

  /* ───────── galerie en ligne ───────── */
  function secGalerie(c) {
    var g = PB.evt.galerie;
    c.innerHTML = '<div class="pb-bloc"><h3>Couverture</h3><div style="height:170px;border-radius:10px;background:#eceae4 center/cover no-repeat;' + (g.couverture ? 'background-image:url(' + urlImage(g.couverture) + ')' : '') + ';display:flex;align-items:center;justify-content:center;color:#9a958a;font-size:13px">' + (g.couverture ? '' : 'Aucune image de couverture') + '</div>'
      + '<div class="pb-actions" style="margin-top:10px"><label class="btn btn-ghost" style="cursor:pointer">' + (g.couverture ? 'Modifier' : 'Choisir une image') + '<input type="file" accept="image/png,image/jpeg,image/webp" hidden onchange="pbCouverture(this)"></label><button class="btn ' + (g.ouverte ? '' : 'btn-ghost') + '" onclick="pbGalOuverte()">' + (g.ouverte ? 'Galerie ouverte' : 'Galerie fermée') + '</button></div></div>'
      + '<div class="pb-bloc">' + ligne('Partager avec un lien', 'Toute personne disposant du lien de l’événement voit la galerie', sw('pbg-lien', g.lien)) + ligne('Accès des invités', 'Un invité voit aussi les photos des autres invités. Décochez pour un événement public : chacun ne voit que les siennes (QR code)', sw('pbg-inv', g.invites)) + ligne('Tout télécharger', 'Les visiteurs peuvent télécharger tout le contenu de l’événement', sw('pbg-tout', g.toutTelecharger))
      + '<div class="pb-champs" style="margin-top:8px"><label>Mot de passe de la galerie (facultatif)<input id="pbg-mdp" value="' + esc(g.mdp) + '" placeholder="Sans mot de passe"></label></div><div class="pb-actions" style="margin-top:8px"><button class="btn btn-ghost" onclick="document.getElementById(\'pbg-mdp\').value=(typeof vbMdp===\'function\'?vbMdp():\'\')">Générer un mot de passe</button></div></div>'
      + blocTheme(g.theme)
      + '<div class="pb-pied"><button class="btn" onclick="pbGalSauver()">Enregistrer</button></div>';
    apercuTheme();
    ['pbt-titre', 'pbt-fond', 'pbt-accent', 'pbt-police'].forEach(function (id) { var el = $(id); if (el) el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', function () { lireTheme(); apercuTheme(); }); });
  }
  /* ── apparence de la page que voient les invités (QR code) : couleurs, image de fond, police du titre ── */
  function luminance(h) { var c = [1, 3, 5].map(function (i) { var v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function blocTheme(t) {
    return '<div class="pb-bloc"><h3>Apparence de la page des invités</h3><p class="aide">La page qui s’ouvre quand un invité scanne le QR code : la photo encadrée, puis les photos brutes en glissant. Mettez-la aux couleurs de l’événement (Halloween, club de foot…).</p>'
      + '<div style="display:grid;grid-template-columns:1fr 230px;gap:16px;align-items:start" class="pb-theme">'
      + '<div><div class="pb-champs">' + champ('pbt-titre', 'Titre de la page', t.titre, PB.evt.nom) + '<label>Police du titre<select id="pbt-police">' + Object.keys(POLICES).map(function (k) { return '<option value="' + k + '"' + (k === t.police ? ' selected' : '') + '>' + POLICES[k][2] + '</option>'; }).join('') + '</select></label>'
      + '<label>Couleur de fond<input type="color" id="pbt-fond" value="' + esc(t.fond) + '" style="height:38px;padding:2px"></label><label>Couleur des boutons<input type="color" id="pbt-accent" value="' + esc(t.accent) + '" style="height:38px;padding:2px"></label></div>'
      + '<div class="pb-actions" style="margin-top:12px"><button class="btn" onclick="pbCouleursCadre()">Reprendre les couleurs du cadre</button><label class="btn btn-ghost" style="cursor:pointer">' + (t.image ? 'Changer l’image de fond' : 'Image de fond (facultatif)') + '<input type="file" accept="image/png,image/jpeg,image/webp" hidden onchange="pbThemeImage(this)"></label>' + (t.image ? '<button class="btn btn-ghost" onclick="pbThemeImageRetirer()">Retirer l’image</button>' : '') + '</div></div>'
      + '<div id="pbtApercu" style="width:230px;height:430px;border-radius:26px;border:6px solid #1f2733;overflow:hidden;position:relative;background-size:cover;background-position:center"></div></div></div>';
  }
  function lireTheme() { var t = PB.evt.galerie.theme; if (!$('pbt-fond')) return; t.titre = val('pbt-titre').trim(); t.fond = val('pbt-fond'); t.accent = val('pbt-accent'); t.police = val('pbt-police'); }
  function apercuTheme() {
    var z = $('pbtApercu'); if (!z) return; var t = PB.evt.galerie.theme, pol = POLICES[t.police] || POLICES.elegante, clair = luminance(t.fond) > 0.35, tx = clair ? '#231F1C' : '#fff', doux = clair ? '#6F655C' : 'rgba(255,255,255,.75)', btx = luminance(t.accent) > 0.45 ? '#1a1612' : '#fff';
    z.style.backgroundColor = t.fond; z.style.backgroundImage = t.image ? 'url(' + urlImage(t.image) + ')' : 'none';
    var m = (PB.evt.misesEnPage || [])[0];
    z.innerHTML = '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding:26px 14px 10px;text-align:center;color:' + tx + '">'
      + '<div style="font-family:' + pol[0] + ';font-weight:' + pol[1] + ';font-size:' + (t.police === 'manuscrite' ? 30 : 22) + 'px;line-height:1.1">' + esc(t.titre || PB.evt.nom) + '</div>'
      + '<div style="width:34px;height:2px;background:' + esc(t.accent) + ';margin:8px 0 12px;border-radius:2px"></div>'
      + '<div style="position:relative;width:100%;flex:1;display:flex;align-items:center;justify-content:center"><canvas id="pbtCv" style="max-width:82%;max-height:200px;box-shadow:0 10px 24px -10px rgba(0,0,0,.5);border-radius:4px;background:#ddd"></canvas><span style="position:absolute;right:0;top:50%;transform:translateY(-50%);width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,.85);color:#231F1C;display:flex;align-items:center;justify-content:center;font-size:15px">›</span></div>'
      + '<div style="display:flex;gap:5px;margin:8px 0"><i style="width:6px;height:6px;border-radius:50%;background:' + esc(t.accent) + '"></i><i style="width:6px;height:6px;border-radius:50%;background:' + doux + ';opacity:.5"></i><i style="width:6px;height:6px;border-radius:50%;background:' + doux + ';opacity:.5"></i></div>'
      + '<div style="width:100%;padding:9px;border-radius:9px;background:' + esc(t.accent) + ';color:' + btx + ';font:700 11.5px Inter,Arial,sans-serif">Télécharger</div>'
      + '<div style="margin-top:auto;padding-top:10px;border-top:1px solid ' + (clair ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.25)') + ';width:100%;font:600 8.5px Inter,Arial,sans-serif;color:' + doux + '">Service proposé par Vespra Event<br><span style="font-weight:500">Vous aussi, vous voulez louer du matériel ? <u>Vespra Event</u></span></div></div>';
    if (m) { var cv = $('pbtCv'); dessiner(cv, m, null, true); chargerImage(m.cadre, function (img) { if (img) dessiner(cv, m, img, true); }); }
  }
  /* couleurs dominantes du calque de la première mise en page : fond (la plus présente) et boutons (la plus présente des couleurs bien différentes) */
  window.pbCouleursCadre = function () {
    lireTheme(); var m = (PB.evt.misesEnPage || []).filter(function (x) { return x.cadre; })[0];
    if (!m) return toast('Ajoutez d’abord un calque à une mise en page (Expérience photobooth)', true);
    chargerImage(m.cadre, function (img) {
      if (!img) return toast('Calque illisible', true);
      var cv = document.createElement('canvas'), W = 80, H = Math.round(80 * img.naturalHeight / img.naturalWidth); cv.width = W; cv.height = H; var g = cv.getContext('2d'); g.drawImage(img, 0, 0, W, H);
      var d = g.getImageData(0, 0, W, H).data, comptes = {};
      for (var i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; var k = [d[i] >> 4, d[i + 1] >> 4, d[i + 2] >> 4].join(','); comptes[k] = (comptes[k] || 0) + 1; }
      var l = Object.keys(comptes).sort(function (a, b) { return comptes[b] - comptes[a]; }).map(function (k) { return k.split(',').map(function (v) { return (+v << 4) + 8; }); });
      if (!l.length) return toast('Pas de couleur trouvée dans le calque', true);
      var hx = function (c) { return '#' + c.map(function (v) { return ('0' + Math.min(255, v).toString(16)).slice(-2); }).join('').toUpperCase(); };
      var dist = function (a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]); };
      var fond = l[0], accent = l.filter(function (c) { return dist(c, fond) > 160; })[0] || (luminance(hx(fond)) > 0.4 ? [35, 31, 28] : [255, 255, 255]);
      var t = PB.evt.galerie.theme; t.fond = hx(fond); t.accent = hx(accent); $('pbt-fond').value = t.fond; $('pbt-accent').value = t.accent; apercuTheme(); toast('Couleurs reprises du cadre : pensez à enregistrer');
    });
  };
  window.pbThemeImage = async function (inp) { var f = inp.files && inp.files[0]; if (!f) return; lireGalerie(); try { PB.evt.galerie.theme.image = await envoyerImage(f); toast('Image ajoutée'); secGalerie($('pbContenu')); } catch (e) { toast('Échec : ' + e.message, true); } };
  window.pbThemeImageRetirer = function () { lireGalerie(); PB.evt.galerie.theme.image = ''; secGalerie($('pbContenu')); };
  function lireGalerie() { var g = PB.evt.galerie; lireTheme(); if (!$('pbg-lien')) return; g.lien = coche('pbg-lien'); g.invites = coche('pbg-inv'); g.toutTelecharger = coche('pbg-tout'); g.mdp = val('pbg-mdp').trim(); }
  window.pbGalOuverte = function () { lireGalerie(); PB.evt.galerie.ouverte = !PB.evt.galerie.ouverte; enregistrer(PB.evt.galerie.ouverte ? 'Galerie ouverte' : 'Galerie fermée').then(rendre); };
  window.pbCouverture = async function (inp) { var f = inp.files && inp.files[0]; if (!f) return; lireGalerie(); try { PB.evt.galerie.couverture = await envoyerImage(f); await enregistrer('Couverture enregistrée'); rendre(); } catch (e) { toast('Échec : ' + e.message, true); } };
  window.pbGalSauver = function () { lireGalerie(); enregistrer('Galerie enregistrée').then(rendre); };
})();
