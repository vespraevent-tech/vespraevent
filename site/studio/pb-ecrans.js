/* ════════════════════════════════════════════════════
   PHOTOBOOTH — éditeur de l'écran « Bienvenue »
   Une scène en vraie taille (1920 × 1080) réduite à l'écran : ce que l'on voit ici est exactement ce que la borne affiche.
   Calques libres (images, textes, formes) + bouton appareil photo, arrière-plan, thèmes, ordre des calques, annuler / rétablir.
   Les positions sont celles du CENTRE de chaque élément (même convention que la borne).
   ════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var X = function () { return window.PBX; };
  var E = { sel: null, panneau: null, histo: [], futur: [], k: 0.5, sale: false, glisse: null };
  var MAX_CALQUES = 40;
  var THEMES = [
    ['Ivoire & or', '#F6F1E9', '#8A6A2F', 'elegante', '#1F3B5A', '#FFFFFF'],
    ['Nuit marine', '#14243A', '#E9D8B4', 'elegante', '#C8A45C', '#14243A'],
    ['Blanc épuré', '#FFFFFF', '#231F1C', 'moderne', '#231F1C', '#FFFFFF'],
    ['Rose poudré', '#F7E8E4', '#9B5B5B', 'manuscrite', '#9B5B5B', '#FFFFFF'],
    ['Vert sauge', '#E8EEE6', '#3F5A47', 'elegante', '#3F5A47', '#FFFFFF'],
    ['Noir & or', '#111111', '#D4AF37', 'elegante', '#D4AF37', '#111111'],
    ['Fête', '#FFF4E0', '#D2472E', 'festive', '#D2472E', '#FFFFFF']
  ];
  var IC = {
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>',
    theme: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-.9-.7-1.2-.7-2.1 0-.8.6-1.4 1.4-1.4H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/>',
    texte: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    forme: '<circle cx="9" cy="9" r="5"/><rect x="11" y="11" width="9" height="9" rx="1.5"/>',
    calques: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    fond: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v4M3 7h4M17 21v-4M21 17h-4"/>',
    reglages: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    annuler: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    retablir: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    haut: '<path d="M12 19V5M6 11l6-6 6 6"/>', bas: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    oeil: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    suppr: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    copie: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    centre: '<path d="M12 3v18M3 12h18"/><rect x="8" y="8" width="8" height="8" rx="1"/>'
  };
  function ic(k, t) { return '<svg viewBox="0 0 24 24" width="' + (t || 22) + '" height="' + (t || 22) + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[k] || '') + '</svg>'; }
  var ICONE_APP = '<svg viewBox="0 0 24 24" width="52%" height="52%" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';

  function A() { return X().PB.evt.accueil; }
  function nid() { return 'c' + Math.random().toString(36).slice(2, 9); }
  function esc(s) { return X().esc(s); }
  function pol(k) { var P = X().POLICES; return P[k] || P.elegante; }

  /* anciens événements : le texte et le logo deviennent des calques comme les autres */
  function migrer(a) {
    if (Array.isArray(a.calques)) return;
    a.calques = [];
    if (a.texte && a.texte.contenu) a.calques.push({ id: nid(), type: 'texte', x: a.texte.x, y: a.texte.y, r: 0, o: 1, texte: a.texte.contenu, police: a.texte.police, couleur: a.texte.couleur, taille: a.texte.taille });
    if (a.logo && a.logo.image) a.calques.push({ id: nid(), type: 'image', x: a.logo.x, y: a.logo.y, r: 0, o: 1, image: a.logo.image, w: a.logo.largeur });
    a.texte = Object.assign({}, a.texte || {}, { contenu: '' }); a.logo = Object.assign({}, a.logo || {}, { image: '' });
  }
  function calque(id) { return (A().calques || []).filter(function (c) { return c.id === id; })[0] || null; }

  /* ── annuler / rétablir ── */
  function memoriser() { E.histo.push(JSON.stringify(A())); if (E.histo.length > 60) E.histo.shift(); E.futur = []; E.sale = true; }
  function restaurer(json) { X().PB.evt.accueil = JSON.parse(json); }
  window.pbxAnnuler = function () { if (!E.histo.length) return; E.futur.push(JSON.stringify(A())); restaurer(E.histo.pop()); E.sale = true; if (E.sel && E.sel !== '__bouton' && !calque(E.sel)) E.sel = null; scene(); panneau(); };
  window.pbxRetablir = function () { if (!E.futur.length) return; E.histo.push(JSON.stringify(A())); restaurer(E.futur.pop()); E.sale = true; scene(); panneau(); };

  /* ── styles ── */
  function css() {
    if (document.getElementById('ecxCss')) return;
    var st = document.createElement('style'); st.id = 'ecxCss';
    st.textContent = ''
      + '.ecx-main{display:flex;flex-direction:column;min-width:0}'
      + '.ecx-tabs{display:flex;gap:6px;justify-content:center;padding:10px;margin:0 0 14px;background:#14304f;border-radius:14px}'
      + '.ecx-tabs button{display:inline-flex;align-items:center;gap:8px;border:0;background:transparent;color:#cfd8e3;font:600 14px Inter,system-ui,sans-serif;padding:9px 18px;border-radius:999px;cursor:pointer}'
      + '.ecx-tabs button svg{width:18px;height:18px}.ecx-tabs button.on{background:#b8862f;color:#fff}.ecx-tabs button:not(.on):hover{background:rgba(255,255,255,.08);color:#fff}'
      + '.ecx{display:grid;grid-template-columns:236px minmax(0,1fr);gap:18px;align-items:start}'
      + '.ecx-pal{background:#fff;border:1px solid #e7e9ee;border-radius:14px;padding:14px;position:sticky;top:12px}'
      + '.ecx-outils{display:grid;grid-template-columns:1fr 1fr;gap:12px 8px;margin-bottom:6px}'
      + '.ecx-outil{display:flex;flex-direction:column;align-items:center;gap:6px;border:0;background:none;cursor:pointer;font:500 12.5px Inter,system-ui,sans-serif;color:#33404f;padding:4px 0}'
      + '.ecx-outil i{width:50px;height:50px;border-radius:50%;display:grid;place-items:center;border:1.5px solid #c9a35a;color:#9a7230;background:#fff;transition:all .15s}'
      + '.ecx-outil.plein i{background:#b8862f;border-color:#b8862f;color:#fff}.ecx-outil:hover i{transform:translateY(-1px);box-shadow:0 6px 14px -8px rgba(0,0,0,.4)}.ecx-outil.on i{background:#14304f;border-color:#14304f;color:#fff}'
      + '.ecx-prop{border-top:1px solid #eef0f4;margin-top:12px;padding-top:12px;font:400 13px Inter,system-ui,sans-serif;color:#33404f}'
      + '.ecx-prop h4{margin:0 0 10px;font:800 11.5px Inter,system-ui,sans-serif;letter-spacing:.6px;text-transform:uppercase;color:#14304f}'
      + '.ecx-prop label{display:block;margin:0 0 10px;font-size:12.5px;color:#6b7280}.ecx-prop label input,.ecx-prop label select,.ecx-prop label textarea{display:block;width:100%;margin-top:4px;box-sizing:border-box}'
      + '.ecx-prop input[type=color]{height:34px;padding:2px;border-radius:8px}.ecx-prop textarea{min-height:58px;resize:vertical;font:400 14px Inter,system-ui,sans-serif;padding:8px;border:1px solid #dfe3ea;border-radius:8px}'
      + '.ecx-prop select,.ecx-prop input[type=text]{padding:7px 8px;border:1px solid #dfe3ea;border-radius:8px;font:400 13.5px Inter,system-ui,sans-serif;background:#fff}'
      + '.ecx-rang{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}.ecx-mini{display:inline-flex;align-items:center;gap:5px;border:1px solid #dfe3ea;background:#fff;border-radius:8px;padding:6px 9px;font:500 12.5px Inter,system-ui,sans-serif;color:#33404f;cursor:pointer}'
      + '.ecx-mini:hover{border-color:#b8862f;color:#14304f}.ecx-mini.rouge{color:#a63f35}.ecx-mini svg{width:15px;height:15px}'
      + '.ecx-zone{min-width:0}.ecx-barre{display:flex;align-items:center;gap:8px;margin:0 0 10px}.ecx-barre .esp{flex:1}'
      + '.ecx-rond{width:38px;height:38px;border-radius:10px;border:1px solid #dfe3ea;background:#fff;display:grid;place-items:center;cursor:pointer;color:#14304f}.ecx-rond:disabled{opacity:.35;cursor:default}'
      + '.ecx-cadre{position:relative;overflow:hidden;border-radius:12px;box-shadow:0 18px 40px -22px rgba(0,0,0,.45);background:#fff;touch-action:none;user-select:none}'
      + '.ecx-scene{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0;overflow:hidden}'
      + '.ecx-scene .fond{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}'
      + '.ecx-el{position:absolute;cursor:move}.ecx-el.sel{outline:3px dashed #b8862f;outline-offset:6px}'
      + '.ecx-el .txt{white-space:pre;line-height:1.1;text-align:center}.ecx-el img{display:block;pointer-events:none}'
      + '.ecx-poignee{position:absolute;right:-22px;bottom:-22px;width:30px;height:30px;border-radius:50%;background:#b8862f;border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:nwse-resize}'
      + '.ecx-bt{border-radius:50%;display:grid;place-items:center;box-shadow:0 12px 40px rgba(0,0,0,.25)}'
      + '.ecx-coin{position:absolute;top:2.5%;width:78px;height:78px;border-radius:18px;display:grid;place-items:center;pointer-events:none}'
      + '.ecx-guide{position:absolute;background:#e5484d;pointer-events:none;z-index:50}'
      + '.ecx-calq{display:flex;align-items:center;gap:6px;padding:6px 6px 6px 8px;border:1px solid #e7e9ee;border-radius:9px;margin:0 0 6px;cursor:pointer;background:#fff}'
      + '.ecx-calq.on{border-color:#b8862f;background:#fbf6ec}.ecx-calq span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:#1f2a37}'
      + '.ecx-calq button{border:0;background:none;padding:3px;cursor:pointer;color:#6b7280}.ecx-calq button:hover{color:#14304f}.ecx-calq button svg{width:15px;height:15px}'
      + '.ecx-theme{display:flex;align-items:center;gap:9px;width:100%;border:1px solid #e7e9ee;background:#fff;border-radius:9px;padding:7px;margin:0 0 6px;cursor:pointer;font:500 13px Inter,system-ui,sans-serif;color:#1f2a37}'
      + '.ecx-theme:hover{border-color:#b8862f}.ecx-theme b{width:34px;height:22px;border-radius:6px;display:block;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}'
      + '.ecx-aide{font-size:12px;color:#8a929e;margin:0 0 10px;line-height:1.45}'
      + '.ecx-sauver{display:inline-flex;align-items:center;gap:7px;border:0;background:#14304f;color:#fff;font:600 13.5px Inter,system-ui,sans-serif;padding:10px 16px;border-radius:10px;cursor:pointer}.ecx-sauver.sale{background:#b8862f}'
      + '@media(max-width:900px){.ecx{grid-template-columns:1fr}.ecx-pal{position:static}.ecx-outils{grid-template-columns:repeat(4,1fr)}}';
    document.head.appendChild(st);
  }

  /* ── l'écran Bienvenue ── */
  window.pbSecBienvenue = function (c) {
    css(); var a = A(); migrer(a); E.c = c;
    var outils = [['image', 'Image', 1], ['theme', 'Thème', 0], ['texte', 'Texte', 1], ['forme', 'Forme', 1], ['calques', 'Calques', 0], ['fond', 'Arrière-plan', 1], ['reglages', 'Réglages', 0]];
    c.innerHTML = '<div class="ecx"><aside class="ecx-pal"><div class="ecx-outils">'
      + outils.map(function (o) { return '<button type="button" class="ecx-outil' + (o[2] ? ' plein' : '') + (E.panneau === o[0] ? ' on' : '') + '" onclick="pbxOutil(\'' + o[0] + '\')"><i>' + ic(o[0]) + '</i>' + o[1] + '</button>'; }).join('')
      + '<input type="file" id="ecxFichier" accept="image/png,image/jpeg,image/webp" hidden onchange="pbxImage(this)"></div><div class="ecx-prop" id="ecxProp"></div></aside>'
      + '<section class="ecx-zone"><div class="ecx-barre"><button type="button" class="ecx-rond" id="ecxAnn" title="Annuler" onclick="pbxAnnuler()">' + ic('annuler', 18) + '</button><button type="button" class="ecx-rond" id="ecxRet" title="Rétablir" onclick="pbxRetablir()">' + ic('retablir', 18) + '</button>'
      + '<span class="ecx-aide" style="margin:0 0 0 6px">Cliquez sur un élément pour le modifier · glissez pour le déplacer · le rond doré l’agrandit</span><span class="esp"></span>'
      + '<button type="button" class="ecx-sauver" id="ecxSauver" onclick="pbxSauver()">Enregistrer</button></div>'
      + '<div class="ecx-cadre" id="ecxCadre"><div class="ecx-scene" id="ecxScene"></div></div></section></div>';
    var l = Math.max(300, (document.getElementById('ecxCadre').parentNode.clientWidth || 900));
    E.k = l / 1920; var cadre = document.getElementById('ecxCadre'); cadre.style.width = Math.round(1920 * E.k) + 'px'; cadre.style.height = Math.round(1080 * E.k) + 'px';
    document.getElementById('ecxScene').style.transform = 'scale(' + E.k + ')';
    scene(); panneau(); brancher();
  };

  function htmlCalque(c) {
    var x = X(), inner = '';
    if (c.type === 'image') inner = '<img alt="" draggable="false" src="' + esc(x.urlImage(c.image)) + '" style="width:' + c.w + 'px">';
    else if (c.type === 'texte') { var p = pol(c.police); inner = '<div class="txt" style="color:' + esc(c.couleur) + ';font-family:' + p[0] + ';font-weight:' + p[1] + ';font-size:' + c.taille + 'px">' + esc(c.texte || ' ') + '</div>'; }
    else if (c.type === 'forme') inner = '<div style="width:' + c.w + 'px;height:' + c.h + 'px;background:' + esc(c.couleur) + ';border-radius:' + (c.forme === 'cercle' ? '50%' : (c.rayon || 0) + 'px') + ';' + (c.ep ? 'border:' + c.ep + 'px solid ' + esc(c.bord) + ';box-sizing:border-box' : '') + '"></div>';
    return '<div class="ecx-el' + (E.sel === c.id ? ' sel' : '') + '" data-id="' + c.id + '" style="left:' + c.x + 'px;top:' + c.y + 'px;transform:translate(-50%,-50%) rotate(' + (c.r || 0) + 'deg);opacity:' + (c.o == null ? 1 : c.o) + (c.cache ? ';display:none' : '') + '">' + inner + (E.sel === c.id ? '<span class="ecx-poignee" data-poignee="1"></span>' : '') + '</div>';
  }
  function scene() {
    var a = A(), x = X(), z = document.getElementById('ecxScene'); if (!z) return;
    var b = a.bouton;
    z.style.background = a.couleur || '#fff';
    z.innerHTML = (a.fond ? '<img class="fond" alt="" src="' + esc(x.urlImage(a.fond)) + '">' : '')
      + (a.calques || []).map(htmlCalque).join('')
      + '<div class="ecx-el ecx-bt' + (E.sel === '__bouton' ? ' sel' : '') + '" data-id="__bouton" style="left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.taille + 'px;height:' + b.taille + 'px;transform:translate(-50%,-50%);background:' + esc(b.couleur) + '">' + ICONE_APP.replace('<svg', '<svg stroke="' + esc(b.icone) + '"') + (E.sel === '__bouton' ? '<span class="ecx-poignee" data-poignee="1"></span>' : '') + '</div>'
      + (a.galerie ? '<div class="ecx-coin" style="left:1.5%;background:rgba(0,0,0,.35)">' + ic('image', 40).replace('stroke="currentColor"', 'stroke="#fff"') + '</div>' : '');
    var an = document.getElementById('ecxAnn'), re = document.getElementById('ecxRet'), sv = document.getElementById('ecxSauver');
    if (an) an.disabled = !E.histo.length; if (re) re.disabled = !E.futur.length; if (sv) { sv.classList.toggle('sale', E.sale); sv.textContent = E.sale ? 'Enregistrer les modifications' : 'Enregistré'; }
  }

  /* ── déplacer, agrandir, choisir ── */
  function cible(id) { return id === '__bouton' ? A().bouton : calque(id); }
  function brancher() {
    var z = document.getElementById('ecxScene'); if (!z) return;
    z.onpointerdown = function (ev) {
      var el = ev.target.closest('.ecx-el');
      if (!el) { if (E.sel) { E.sel = null; scene(); panneau(); } return; }
      ev.preventDefault();
      var id = el.dataset.id, o = cible(id); if (!o) return;
      if (E.sel !== id) { E.sel = id; E.panneau = null; scene(); panneau(); el = z.querySelector('[data-id="' + id + '"]'); }
      var poignee = !!ev.target.closest('[data-poignee]');
      var avant = JSON.stringify(A()), x0 = ev.clientX, y0 = ev.clientY, d = JSON.parse(JSON.stringify(o)), boite = el.getBoundingClientRect();
      var demi = Math.max(10, Math.hypot(boite.width, boite.height) / 2 / E.k);
      z.setPointerCapture && z.setPointerCapture(ev.pointerId);
      var bouger = function (e) {
        var dx = (e.clientX - x0) / E.k, dy = (e.clientY - y0) / E.k;
        if (poignee) {
          var f = Math.max(0.1, (demi + (dx + dy) / Math.SQRT2) / demi);
          if (id === '__bouton') o.taille = Math.round(Math.max(80, Math.min(600, d.taille * f)));
          else if (o.type === 'texte') o.taille = Math.round(Math.max(8, Math.min(400, d.taille * f)));
          else if (o.type === 'image') o.w = Math.round(Math.max(20, Math.min(4000, d.w * f)));
          else if (o.type === 'forme') { o.w = Math.round(Math.max(10, Math.min(4000, d.w + dx * 2))); o.h = o.forme === 'cercle' ? o.w : Math.round(Math.max(10, Math.min(4000, d.h + dy * 2))); }
        } else {
          o.x = Math.round(d.x + dx); o.y = Math.round(d.y + dy);
          guides(o);
        }
        var n = z.querySelector('[data-id="' + id + '"]'); var h = id === '__bouton' ? null : htmlCalque(o);
        if (h) { var t = document.createElement('div'); t.innerHTML = h; n.replaceWith(t.firstChild); } else { n.style.left = o.x + 'px'; n.style.top = o.y + 'px'; n.style.width = n.style.height = o.taille + 'px'; }
      };
      var fin = function () {
        z.removeEventListener('pointermove', bouger); z.removeEventListener('pointerup', fin); z.removeEventListener('pointercancel', fin);
        z.querySelectorAll('.ecx-guide').forEach(function (g) { g.remove(); });
        if (JSON.stringify(A()) !== avant) { E.histo.push(avant); E.futur = []; E.sale = true; }
        scene(); panneau();
      };
      z.addEventListener('pointermove', bouger); z.addEventListener('pointerup', fin); z.addEventListener('pointercancel', fin);
    };
    if (!window.__ecxClavier) {
      window.__ecxClavier = true;
      document.addEventListener('keydown', function (e) {
        if (!document.getElementById('ecxScene') || !E.sel) return;
        var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
        var o = cible(E.sel); if (!o) return; var p = e.shiftKey ? 10 : 1, ok = true;
        if (e.key === 'ArrowLeft') { memoriser(); o.x -= p; } else if (e.key === 'ArrowRight') { memoriser(); o.x += p; } else if (e.key === 'ArrowUp') { memoriser(); o.y -= p; } else if (e.key === 'ArrowDown') { memoriser(); o.y += p; }
        else if ((e.key === 'Delete' || e.key === 'Backspace') && E.sel !== '__bouton') { window.pbxSuppr(E.sel); return e.preventDefault(); }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.shiftKey ? window.pbxRetablir() : window.pbxAnnuler(); return e.preventDefault(); }
        else ok = false;
        if (ok) { e.preventDefault(); scene(); }
      });
    }
  }
  /* repères rouges : centre de l'écran (aimanté à 12 px) */
  function guides(o) {
    var z = document.getElementById('ecxScene'); z.querySelectorAll('.ecx-guide').forEach(function (g) { g.remove(); });
    if (Math.abs(o.x - 960) < 12) { o.x = 960; var g = document.createElement('div'); g.className = 'ecx-guide'; g.style.cssText = 'left:959px;top:0;width:3px;height:1080px'; z.appendChild(g); }
    if (Math.abs(o.y - 540) < 12) { o.y = 540; var h = document.createElement('div'); h.className = 'ecx-guide'; h.style.cssText = 'top:539px;left:0;height:3px;width:1920px'; z.appendChild(h); }
  }

  /* ── palette ── */
  window.pbxOutil = function (k) {
    var a = A();
    if (k === 'image') { if ((a.calques || []).length >= MAX_CALQUES) return X().toast('40 éléments au maximum', true); document.getElementById('ecxFichier').click(); return; }
    if (k === 'texte') { if ((a.calques || []).length >= MAX_CALQUES) return X().toast('40 éléments au maximum', true); memoriser(); var t = { id: nid(), type: 'texte', x: 960, y: 220, r: 0, o: 1, texte: 'Votre texte', police: 'elegante', couleur: '#231F1C', taille: 110 }; a.calques.push(t); E.sel = t.id; E.panneau = null; scene(); panneau(); setTimeout(function () { var i = document.getElementById('ecxTx'); if (i) { i.focus(); i.select(); } }, 30); return; }
    if (k === 'forme') { if ((a.calques || []).length >= MAX_CALQUES) return X().toast('40 éléments au maximum', true); memoriser(); var f = { id: nid(), type: 'forme', forme: 'rect', x: 960, y: 540, r: 0, o: 0.85, w: 700, h: 260, couleur: '#FFFFFF', rayon: 24, bord: '#B8862F', ep: 0 }; a.calques.unshift(f); E.sel = f.id; E.panneau = null; scene(); panneau(); return; }
    E.sel = null; E.panneau = E.panneau === k ? null : k; window.pbSecBienvenue(E.c);
  };
  window.pbxImage = async function (inp) {
    var f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
    try {
      var dims = await new Promise(function (ok) { var i = new Image(); i.onload = function () { ok([i.naturalWidth, i.naturalHeight]); }; i.onerror = function () { ok([600, 400]); }; i.src = URL.createObjectURL(f); });
      X().toast('Envoi de l’image…'); var id = await X().envoyerImage(f);
      memoriser(); var w = Math.min(dims[0] || 600, 900); var c = { id: nid(), type: 'image', x: 960, y: 540, r: 0, o: 1, image: id, w: w };
      A().calques.push(c); E.sel = c.id; E.panneau = null; scene(); panneau(); X().toast('Image ajoutée');
    } catch (e) { X().toast('Échec : ' + e.message, true); }
  };

  /* ── panneau de droite (sous la palette) : réglages de l'élément choisi ou de l'outil ouvert ── */
  function champ(lib, html) { return '<label>' + lib + html + '</label>'; }
  function panneau() {
    var z = document.getElementById('ecxProp'); if (!z) return; var a = A(), h = '';
    if (E.sel) {
      var o = cible(E.sel); if (!o) { E.sel = null; return panneau(); }
      if (E.sel === '__bouton') {
        h = '<h4>Bouton photo</h4>' + champ('Couleur du bouton', '<input type="color" data-p="couleur" value="' + esc(o.couleur) + '">') + champ('Couleur de l’icône', '<input type="color" data-p="icone" value="' + esc(o.icone) + '">')
          + champ('Taille (' + o.taille + ' px)', '<input type="range" min="80" max="600" step="5" data-p="taille" data-n="1" value="' + o.taille + '">')
          + '<div class="ecx-rang"><button type="button" class="ecx-mini" onclick="pbxCentrer()">' + ic('centre') + 'Centrer</button></div>';
      } else {
        if (o.type === 'texte') h = '<h4>Texte</h4>' + champ('Texte', '<textarea id="ecxTx" data-p="texte" maxlength="200">' + esc(o.texte) + '</textarea>')
          + champ('Police', '<select data-p="police">' + Object.keys(X().POLICES).map(function (k) { return '<option value="' + k + '"' + (k === o.police ? ' selected' : '') + '>' + X().POLICES[k][2] + '</option>'; }).join('') + '</select>')
          + champ('Couleur', '<input type="color" data-p="couleur" value="' + esc(o.couleur) + '">') + champ('Taille (' + o.taille + ' px)', '<input type="range" min="16" max="400" data-p="taille" data-n="1" value="' + o.taille + '">');
        else if (o.type === 'image') h = '<h4>Image</h4>' + champ('Largeur (' + o.w + ' px)', '<input type="range" min="20" max="1920" step="2" data-p="w" data-n="1" value="' + o.w + '">');
        else if (o.type === 'forme') h = '<h4>Forme</h4>' + champ('Forme', '<select data-p="forme"><option value="rect"' + (o.forme === 'rect' ? ' selected' : '') + '>Rectangle</option><option value="cercle"' + (o.forme === 'cercle' ? ' selected' : '') + '>Cercle</option></select>')
          + champ('Couleur', '<input type="color" data-p="couleur" value="' + esc(o.couleur) + '">')
          + champ('Largeur (' + o.w + ' px)', '<input type="range" min="10" max="1920" step="2" data-p="w" data-n="1" value="' + o.w + '">')
          + (o.forme === 'cercle' ? '' : champ('Hauteur (' + o.h + ' px)', '<input type="range" min="10" max="1080" step="2" data-p="h" data-n="1" value="' + o.h + '">') + champ('Arrondi des coins (' + (o.rayon || 0) + ' px)', '<input type="range" min="0" max="300" data-p="rayon" data-n="1" value="' + (o.rayon || 0) + '">'))
          + champ('Bordure (' + (o.ep || 0) + ' px)', '<input type="range" min="0" max="40" data-p="ep" data-n="1" value="' + (o.ep || 0) + '">') + (o.ep ? champ('Couleur de la bordure', '<input type="color" data-p="bord" value="' + esc(o.bord || '#B8862F') + '">') : '');
        h += champ('Opacité (' + Math.round((o.o == null ? 1 : o.o) * 100) + ' %)', '<input type="range" min="5" max="100" data-p="o" data-n="100" value="' + Math.round((o.o == null ? 1 : o.o) * 100) + '">')
          + champ('Rotation (' + (o.r || 0) + '°)', '<input type="range" min="-180" max="180" data-p="r" data-n="1" value="' + (o.r || 0) + '">')
          + '<div class="ecx-rang"><button type="button" class="ecx-mini" onclick="pbxCentrer()">' + ic('centre') + 'Centrer</button><button type="button" class="ecx-mini" onclick="pbxOrdre(1)">' + ic('haut') + 'Devant</button><button type="button" class="ecx-mini" onclick="pbxOrdre(-1)">' + ic('bas') + 'Derrière</button>'
          + '<button type="button" class="ecx-mini" onclick="pbxDupliquer()">' + ic('copie') + 'Dupliquer</button><button type="button" class="ecx-mini rouge" onclick="pbxSuppr(\'' + o.id + '\')">' + ic('suppr') + 'Supprimer</button></div>';
      }
    } else if (E.panneau === 'theme') {
      h = '<h4>Thèmes</h4><p class="ecx-aide">Applique les couleurs du fond, du bouton et de tous les textes. Vos images restent en place.</p>'
        + THEMES.map(function (t, i) { return '<button type="button" class="ecx-theme" onclick="pbxTheme(' + i + ')"><b style="background:linear-gradient(90deg,' + t[1] + ' 50%,' + t[4] + ' 50%)"></b>' + t[0] + '</button>'; }).join('');
    } else if (E.panneau === 'calques') {
      var l = (a.calques || []).slice().reverse();
      h = '<h4>Calques</h4><p class="ecx-aide">Du premier plan (en haut) à l’arrière-plan. Le bouton photo reste toujours devant.</p>'
        + (l.length ? l.map(function (c) { var nom = c.type === 'texte' ? '« ' + (c.texte || '').slice(0, 24) + ' »' : (c.type === 'image' ? 'Image' : (c.forme === 'cercle' ? 'Cercle' : 'Rectangle'));
          return '<div class="ecx-calq' + (E.sel === c.id ? ' on' : '') + '" onclick="pbxChoisir(\'' + c.id + '\')"><span>' + esc(nom) + '</span><button type="button" title="Monter" onclick="event.stopPropagation();pbxOrdre(1,\'' + c.id + '\')">' + ic('haut') + '</button><button type="button" title="Descendre" onclick="event.stopPropagation();pbxOrdre(-1,\'' + c.id + '\')">' + ic('bas') + '</button><button type="button" title="' + (c.cache ? 'Afficher' : 'Masquer') + '" style="' + (c.cache ? 'opacity:.4' : '') + '" onclick="event.stopPropagation();pbxCacher(\'' + c.id + '\')">' + ic('oeil') + '</button><button type="button" title="Supprimer" onclick="event.stopPropagation();pbxSuppr(\'' + c.id + '\')">' + ic('suppr') + '</button></div>'; }).join('') : '<p class="ecx-aide">Aucun élément : ajoutez une image, un texte ou une forme.</p>');
    } else if (E.panneau === 'fond') {
      h = '<h4>Arrière-plan</h4>' + champ('Couleur', '<input type="color" id="ecxCoul" value="' + esc(a.couleur || '#FFFFFF') + '">')
        + '<p class="ecx-aide">Image de fond conseillée : 1920 × 1080 px.</p><div class="ecx-rang"><label class="ecx-mini" style="margin:0;color:#33404f">' + (a.fond ? 'Remplacer l’image' : 'Choisir une image') + '<input type="file" accept="image/png,image/jpeg,image/webp" hidden onchange="pbxFond(this)"></label>' + (a.fond ? '<button type="button" class="ecx-mini rouge" onclick="pbxFondRetirer()">' + ic('suppr') + 'Retirer</button>' : '') + '</div>';
    } else if (E.panneau === 'reglages') {
      h = '<h4>Réglages</h4><label style="display:flex;align-items:center;gap:10px;color:#1f2a37"><input type="checkbox" id="ecxGal" style="width:auto;margin:0"' + (a.galerie ? ' checked' : '') + '>Bouton galerie (en haut à gauche)</label><p class="ecx-aide">Les invités ouvrent la galerie de l’événement sur la borne. Le cadenas des réglages de la borne reste en haut à droite.</p>';
    } else {
      h = '<h4>Écran Bienvenue</h4><p class="ecx-aide">Ajoutez une image, un texte ou une forme avec la palette, ou cliquez sur un élément de l’aperçu pour le modifier. Ce que vous voyez est exactement ce que la borne affiche (1920 × 1080).</p>';
    }
    z.innerHTML = h;
    z.querySelectorAll('[data-p]').forEach(function (inp) {
      var p = inp.dataset.p, div = +inp.dataset.n || 0;
      inp.addEventListener('focus', function () { memoriser(); });
      inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', function () {
        var o = cible(E.sel); if (!o) return; o[p] = div ? (+inp.value) / div : inp.value; if (p === 'forme' && o.forme === 'cercle') o.h = o.w;
        E.sale = true; scene(); var lab = inp.closest('label'); if (lab && div) lab.firstChild.textContent = lab.firstChild.textContent.replace(/\(.*\)/, '(' + (p === 'o' ? Math.round(o.o * 100) + ' %' : p === 'r' ? o.r + '°' : o[p] + ' px') + ')');
        if (p === 'forme' || p === 'ep') panneau();
      });
    });
    var cl = document.getElementById('ecxCoul'); if (cl) { cl.addEventListener('focus', memoriser); cl.addEventListener('input', function () { A().couleur = cl.value; E.sale = true; scene(); }); }
    var gl = document.getElementById('ecxGal'); if (gl) gl.addEventListener('change', function () { memoriser(); A().galerie = gl.checked; scene(); });
  }

  window.pbxChoisir = function (id) { E.sel = id; scene(); panneau(); };
  window.pbxCentrer = function () { var o = cible(E.sel); if (!o) return; memoriser(); o.x = 960; scene(); };   /* centré horizontalement (la hauteur ne bouge pas) */
  window.pbxOrdre = function (sens, id) {
    var l = A().calques, i = l.map(function (c) { return c.id; }).indexOf(id || E.sel), j = i + sens; if (i < 0 || j < 0 || j >= l.length) return;
    memoriser(); var t = l[i]; l[i] = l[j]; l[j] = t; scene(); if (E.panneau === 'calques' && !E.sel) window.pbSecBienvenue(E.c); else panneau();
  };
  window.pbxCacher = function (id) { var c = calque(id); if (!c) return; memoriser(); c.cache = !c.cache; scene(); window.pbSecBienvenue(E.c); };
  window.pbxSuppr = function (id) { var l = A().calques, i = l.map(function (c) { return c.id; }).indexOf(id); if (i < 0) return; memoriser(); l.splice(i, 1); if (E.sel === id) E.sel = null; scene(); panneau(); if (E.panneau === 'calques') window.pbSecBienvenue(E.c); };
  window.pbxDupliquer = function () { var o = calque(E.sel); if (!o) return; if (A().calques.length >= MAX_CALQUES) return X().toast('40 éléments au maximum', true); memoriser(); var c = JSON.parse(JSON.stringify(o)); c.id = nid(); c.x += 40; c.y += 40; A().calques.push(c); E.sel = c.id; scene(); panneau(); };
  window.pbxTheme = function (i) {
    var t = THEMES[i], a = A(); memoriser(); a.couleur = t[1]; a.bouton.couleur = t[4]; a.bouton.icone = t[5];
    (a.calques || []).forEach(function (c) { if (c.type === 'texte') { c.couleur = t[2]; c.police = t[3]; } }); scene(); X().toast('Thème « ' + t[0] + ' » appliqué');
  };
  window.pbxFond = async function (inp) { var f = inp.files && inp.files[0]; if (!f) return; try { X().toast('Envoi de l’image…'); var id = await X().envoyerImage(f); memoriser(); A().fond = id; scene(); window.pbSecBienvenue(E.c); X().toast('Arrière-plan ajouté'); } catch (e) { X().toast('Échec : ' + e.message, true); } };
  window.pbxFondRetirer = function () { memoriser(); A().fond = ''; scene(); window.pbSecBienvenue(E.c); };
  window.pbxSauver = function () {
    var id = E.sel; X().enregistrer('Écran Bienvenue enregistré').then(function (ok) { if (!ok) return; E.sale = false; E.histo = []; E.futur = []; E.sel = id; if (document.getElementById('ecxScene')) window.pbSecBienvenue(E.c); });
  };

  /* quitter l'écran avec des modifications non enregistrées : on prévient */
  var depart = window.pbSection;
  if (typeof depart === 'function') window.pbSection = function (s) { if (E.sale && document.getElementById('ecxScene') && s !== 'accueil' && !confirm('L’écran Bienvenue a des modifications non enregistrées. Quitter sans enregistrer ?')) return; if (s !== 'accueil') { E.sale = false; E.histo = []; E.futur = []; E.sel = null; } return depart(s); };
  window.addEventListener('beforeunload', function (e) { if (E.sale && document.getElementById('ecxScene')) { e.preventDefault(); e.returnValue = ''; } });
})();
