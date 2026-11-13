/* ─────────────────────────────────────────────────────────────
   Pop-up « Jeux en bois » en deux étapes :
     1. on choisit ses jeux (un ou plusieurs, ou le pack 5 jeux) ;
     2. on règle les quantités (2 maximum, baby-foot : 1 seul), ou,
        avec le pack, les exemplaires en plus.
   Le pack 5 jeux (140 € au lieu de 150 €) verrouille les autres jeux.
   Le script se branche sur la fenêtre « vmOv » des pages qui l'ont.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var JEUX = [
    { k: 'cornhole', n: 'Cornhole', p: 15, max: 2, img: 'jeux-cornhole.webp' },
    { k: 'puissance4', n: 'Puissance 4 géant', p: 15, max: 2, img: 'jeux-puissance4.webp' },
    { k: 'palet', n: 'Palet breton', p: 10, max: 2, img: 'jeux-palet-breton.webp' },
    { k: 'babyfoot', n: 'Baby-foot', p: 90, max: 1, img: 'baby-foot-dessus.webp' },
    { k: 'passe', n: 'Passe-trappe', p: 15, max: 2, img: 'jeux-passe-trappe.webp' },
    { k: 'pack', n: 'Pack 5 jeux', p: 140, avant: 150, max: 1, pack: true, img: 'jeux-cornhole.webp' }
  ];
  var EXTRAS = ['cornhole', 'puissance4', 'palet', 'passe'];
  var etape = 1, sel = {}, extra = {};

  function jeu(k) { return JEUX.filter(function (j) { return j.k === k; })[0]; }
  function pack() { return !!sel.pack; }
  function total() {
    var t = 0;
    JEUX.forEach(function (j) { t += (sel[j.k] || 0) * j.p; });
    if (pack()) EXTRAS.forEach(function (k) { if (extra[k]) t += jeu(k).p; });
    return t;
  }
  function styles() {
    if (document.getElementById('jbpStyle')) return;
    var st = document.createElement('style');
    st.id = 'jbpStyle';
    st.textContent = [
      '#jbpBox{margin:0 0 14px;font-family:Inter,system-ui,sans-serif}',
      '#jbpBox .jb-t{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;margin-bottom:8px;display:flex;justify-content:space-between}',
      '#jbpBox .jb-row{display:flex;align-items:center;gap:10px;width:100%;padding:11px 12px;margin-bottom:6px;border:2px solid #d9dde3;border-radius:10px;background:#fff;font:14px Inter,system-ui,sans-serif;color:inherit;text-align:left;cursor:pointer}',
      '#jbpBox .jb-row.on{border-color:#2b4a6b;background:rgba(43,74,107,.05)}',
      '#jbpBox .jb-row.off{opacity:.4;cursor:not-allowed}',
      '#jbpBox .jb-box{flex:none;width:20px;height:20px;border:2px solid #c3c9d1;border-radius:5px;background:#fff;position:relative}',
      '#jbpBox .jb-row.on .jb-box{background:#2b4a6b;border-color:#2b4a6b}',
      '#jbpBox .jb-row.on .jb-box::after{content:"";position:absolute;left:5px;top:1px;width:5px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}',
      '#jbpBox .jb-n{flex:1;min-width:0}',
      '#jbpBox .jb-p{font-weight:700;white-space:nowrap}',
      '#jbpBox s{color:#6b7280;font-weight:400;margin-left:4px}',
      '#jbpBox .jb-tag{display:inline-block;margin-left:6px;padding:2px 7px;border-radius:99px;background:#e8f6ec;color:#14532d;font-size:11px;font-weight:600}',
      '#jbpBox .jb-note{font-size:12.5px;color:#6b7280;line-height:1.4;margin:2px 0 8px}',
      '#jbpBox .jb-q{display:flex;align-items:center;gap:8px;flex:none}',
      '#jbpBox .jb-q button{width:30px;height:30px;border-radius:50%;border:2px solid #2b4a6b;background:#fff;color:#2b4a6b;font-size:18px;line-height:1;cursor:pointer;padding:0}',
      '#jbpBox .jb-q button:disabled{opacity:.35;cursor:default}',
      '#jbpBox .jb-q b{min-width:16px;text-align:center}',
      '#jbpBox .jb-sub{font-size:13px;font-weight:600;margin:10px 0 6px}',
      '#jbpBox .jb-nav{display:flex;gap:8px;margin-top:10px}',
      '#jbpBox .jb-nav button{flex:1;padding:14px;border-radius:99px;font:700 15px Inter,system-ui,sans-serif;cursor:pointer;border:2px solid #2b4a6b}',
      '#jbpBox .jb-go{background:#2b4a6b;color:#fff}',
      '#jbpBox .jb-go:disabled{opacity:.4;cursor:default}',
      '#jbpBox .jb-back{background:#fff;color:#2b4a6b;flex:0 0 auto!important;padding:14px 18px!important}'
    ].join('');
    document.head.appendChild(st);
  }

  function bouton() { return document.querySelector('#vmOv button[onclick*="confirmVM"]'); }
  function boite() { return document.getElementById('jbpBox'); }

  function dessiner() {
    var b = boite(); if (!b) return;
    var h = '';
    if (etape === 1) {
      h += '<div class="jb-t"><span>1/2 · Choisissez vos jeux</span></div>';
      JEUX.forEach(function (j) {
        var off = pack() && !j.pack;
        h += '<button type="button" class="jb-row' + (sel[j.k] ? ' on' : '') + (off ? ' off' : '') + '" data-k="' + j.k + '"' + (off ? ' disabled' : '') + '>'
          + '<span class="jb-box"></span><span class="jb-n">' + j.n + (j.pack ? '<span class="jb-tag">10 € de remise</span>' : '') + '</span>'
          + '<span class="jb-p">' + (j.pack ? j.p + ' € <s>' + j.avant + ' €</s>' : j.p + ' €') + '</span></button>';
      });
      if (pack()) h += '<div class="jb-note">Le pack contient déjà les 5 jeux. À l\'étape suivante, vous pourrez ajouter des exemplaires en plus.</div>';
      h += '<div class="jb-nav"><button type="button" class="jb-go" data-act="suite"' + (Object.keys(sel).length ? '' : ' disabled') + '>Suivant →</button></div>';
    } else {
      h += '<div class="jb-t"><span>2/2 · ' + (pack() ? 'Un exemplaire en plus ?' : 'Quantités') + '</span></div>';
      if (pack()) {
        h += '<div class="jb-row on"><span class="jb-n">Pack 5 jeux <span class="jb-tag">10 € de remise</span></span><span class="jb-p">140 € <s>150 €</s></span></div>';
        h += '<div class="jb-sub">Quantité de chaque jeu (1 inclus dans le pack, un 2e à + 15 €)</div>';
        EXTRAS.forEach(function (k) {
          var j = jeu(k), q = extra[k] || 0;
          h += '<div class="jb-row"><span class="jb-n">' + j.n + '</span><span class="jb-p">' + (q ? '+ ' + j.p + ' €' : 'inclus') + '</span>'
            + '<span class="jb-q"><button type="button" data-ex="' + k + '" data-d="-1"' + (q < 1 ? ' disabled' : '') + '>−</button><b>' + (q + 1) + '</b><button type="button" data-ex="' + k + '" data-d="1"' + (q >= 1 ? ' disabled' : '') + '>+</button></span></div>';
        });
      } else {
        JEUX.forEach(function (j) {
          var q = sel[j.k]; if (!q) return;
          var qt = j.max > 1
            ? '<span class="jb-q"><button type="button" data-q="' + j.k + '" data-d="-1"' + (q <= 1 ? ' disabled' : '') + '>−</button><b>' + q + '</b><button type="button" data-q="' + j.k + '" data-d="1"' + (q >= j.max ? ' disabled' : '') + '>+</button></span>'
            : '';
          h += '<div class="jb-row on"><span class="jb-n">' + j.n + '</span><span class="jb-p">' + j.p + ' €' + (j.max > 1 ? ' pièce' : '') + '</span>' + qt + '</div>';
        });
        h += '<div class="jb-note">2 exemplaires maximum par jeu, 1 seul baby-foot.</div>';
      }
      h += '<div class="jb-nav"><button type="button" class="jb-back" data-act="retour">← Retour</button><button type="button" class="jb-go" data-act="ajouter">Ajouter au devis · ' + total() + ' €</button></div>';
    }
    b.innerHTML = h;
    var pr = document.getElementById('vmPrice');
    if (pr) pr.textContent = Object.keys(sel).length ? total() + ' €' : 'dès 15 €';
  }

  function ajouter() {
    var lignes = [];
    JEUX.forEach(function (j) {
      var q = sel[j.k]; if (!q) return;
      for (var i = 0; i < q; i++) lignes.push({ n: j.pack ? 'Pack 5 jeux (au lieu de 150 € — 10 € de remise)' : j.n, p: j.p, img: j.img });
    });
    if (pack()) EXTRAS.forEach(function (k) { if (extra[k]) { var j = jeu(k); lignes.push({ n: j.n + ' (en plus du pack)', p: j.p, img: j.img }); } });
    if (!lignes.length || typeof addToCart !== 'function') return;
    lignes.forEach(function (l, i) {
      addToCart({ id: 'p2_' + Date.now() + '_' + i, name: 'Jeux en bois — ' + l.n, price: l.p, img: l.img, install: false });
    });
  }

  function clic(e) {
    var t = e.target.closest('button'); if (!t) return;
    e.stopPropagation();
    if (t.hasAttribute('data-k')) {
      var k = t.getAttribute('data-k'), j = jeu(k);
      if (sel[k]) { delete sel[k]; if (j.pack) extra = {}; }
      else { if (j.pack) { sel = {}; extra = {}; } else if (pack()) return; sel[k] = 1; }
    } else if (t.getAttribute('data-act') === 'suite') etape = 2;
    else if (t.getAttribute('data-act') === 'retour') etape = 1;
    else if (t.getAttribute('data-act') === 'ajouter') { ajouter(); return; }
    else if (t.hasAttribute('data-q')) {
      var k2 = t.getAttribute('data-q'), j2 = jeu(k2), q = (sel[k2] || 1) + Number(t.getAttribute('data-d'));
      sel[k2] = Math.max(1, Math.min(j2.max, q));
    } else if (t.hasAttribute('data-ex')) {
      var k3 = t.getAttribute('data-ex');
      extra[k3] = Math.max(0, Math.min(1, (extra[k3] || 0) + Number(t.getAttribute('data-d'))));
    } else return;
    dessiner();
  }

  function installer() {
    styles();
    ['vmVariants', 'vmOptions'].forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; });
    var bt = bouton(); if (bt) bt.style.display = 'none';
    var b = boite();
    if (!b) {
      b = document.createElement('div'); b.id = 'jbpBox';
      var ref = bt || document.querySelector('#vmOv .vm');
      ref.parentNode.insertBefore(b, ref);
      b.addEventListener('click', clic);
    }
    b.style.display = '';
    etape = 1; sel = {}; extra = {};
    dessiner();
  }
  function retirer() {
    var b = boite(); if (b) b.style.display = 'none';
    var bt = bouton(); if (bt) bt.style.display = '';
    var v = document.getElementById('vmVariants'); if (v) v.style.display = '';
    var o = document.getElementById('vmOptions'); if (o) o.style.display = '';
  }

  function verifier() {
    var ov = document.getElementById('vmOv');
    if (!ov || !ov.classList.contains('open')) return;
    var nom = (document.getElementById('vmName') || {}).textContent || '';
    var est = /^jeux en bois$/i.test(nom.trim());
    if (est && !(boite() && boite().style.display !== 'none')) installer();
    else if (!est && boite() && boite().style.display !== 'none') retirer();
  }
  function init() {
    var ov = document.getElementById('vmOv');
    if (!ov) return;
    new MutationObserver(verifier).observe(ov, { attributes: true, attributeFilter: ['class'] });
    var nm = document.getElementById('vmName');
    if (nm) new MutationObserver(verifier).observe(nm, { childList: true, characterData: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
