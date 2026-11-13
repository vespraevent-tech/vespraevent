/* ─────────────────────────────────────────────────────────────
   Fiche produit à variantes et produits « à ajouter ».

   Quand plusieurs produits voisins sont présentés sur la même page
   (les machines à fumée et à bulles, le baby-foot et les jeux en bois) :
   - les boutons de variante font un choix unique : un clic change la
     photo, le titre, la description, les points forts et le prix ;
   - la liste « Ajouter aussi » propose les autres produits à cocher.
   Chaque produit choisi devient SA PROPRE LIGNE dans le devis, jamais
   une ligne qui en regroupe deux : le client peut en retirer un seul.

   La page décrit ses produits dans window.VARIANTES_PAGE :
   { defaut, items:[ { id, name, label?, price, titre, cat, short, feats,
                       photos, aj:{ desc }, groupe? } ] }
   « groupe » : deux produits du même groupe ne se prennent pas ensemble.
   Les prix viennent des boutons (data-price) que le back-office peut
   modifier : ce script n'écrit jamais lui-même un tarif.
   ───────────────────────────────────────────────────────────── */
(function () {
  var C = window.VARIANTES_PAGE;
  if (!C || !C.items || !C.items.length) return;
  var cur = 0, coches = {};

  function q(s) { return document.querySelector(s); }
  function btns() { return [].slice.call(document.querySelectorAll('.prod-vbtn')); }
  function prixDe(i) {
    var b = btns()[i], p = b && parseFloat(b.getAttribute('data-price'));
    return isFinite(p) && p > 0 ? p : C.items[i].price;
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function memeGroupe(a, b) { return a !== b && C.items[a].groupe && C.items[a].groupe === C.items[b].groupe; }

  function total() {
    var t = prixDe(cur);
    Object.keys(coches).forEach(function (k) { if (coches[k]) t += prixDe(+k); });
    return t;
  }
  function afficherPrix() {
    var aff = q('#prodPriceDisplay');
    if (aff) aff.innerHTML = total() + ' € <small>/ événement</small>';
    var lb = q('.prod-from-label'); if (lb) lb.textContent = 'Prix';
  }

  function dessinerAjouts() {
    var zone = q('#vpAjouts'); if (!zone) return;
    if (C.sansAjouts) { zone.innerHTML = ''; zone.style.display = 'none'; return; }
    var h = '';
    C.items.forEach(function (it, i) {
      if (i === cur || memeGroupe(cur, i)) return;
      var on = !!coches[i];
      h += '<label class="prod-option-check" style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border:2px solid ' + (on ? 'var(--navy)' : 'var(--g3)') + ';border-radius:var(--r);cursor:pointer;font-size:14px;transition:border-color .18s;margin-bottom:10px">'
        + '<input type="checkbox" data-i="' + i + '"' + (on ? ' checked' : '') + ' style="width:18px;height:18px;margin-top:2px;accent-color:var(--navy);flex-shrink:0">'
        + '<span><strong>' + esc(it.court || it.name) + '</strong><br><span style="color:var(--g2);font-size:12px">' + esc((it.aj && it.aj.desc) || '') + '</span></span>'
        + '<span style="font-weight:700;color:var(--navy);margin-left:auto;flex-shrink:0;white-space:nowrap">+&nbsp;' + prixDe(i) + '&nbsp;€</span></label>';
    });
    zone.innerHTML = h
      ? '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--g1);margin-bottom:10px">' + esc(C.titreAjouts || 'Ajouter aussi') + '</div>' + h
      : '';
    zone.style.display = h ? '' : 'none';
    [].forEach.call(zone.querySelectorAll('input[type=checkbox]'), function (cb) {
      cb.addEventListener('change', function () {
        var i = +cb.getAttribute('data-i');
        coches[i] = cb.checked;
        if (cb.checked) Object.keys(coches).forEach(function (k) { if (+k !== i && memeGroupe(i, +k)) coches[k] = false; });
        dessinerAjouts(); afficherPrix();
      });
    });
  }

  function appliquer(i) {
    var it = C.items[i]; if (!it) return;
    cur = i;
    coches = {};
    btns().forEach(function (b, k) { b.classList.toggle('active', k === i); });
    var note = q('.prod-price-note'); if (note) note.style.display = 'none';
    var t = q('.prod-title'); if (t && it.titre) t.innerHTML = String(it.titre).replace(/<br\s*\/?>/gi,' ');
    var c = q('.prod-cat-tag'); if (c && it.cat) c.innerHTML = String(it.cat).split(' · ')[0];
    var d = q('.prod-short-desc'); if (d && it.short) d.innerHTML = it.short;
    var f = q('.prod-features'); if (f && it.feats) f.innerHTML = it.feats.map(function (x) { return '<li>' + x + '</li>'; }).join('');
    var bc = q('.prod-breadcrumb');
    if (bc && bc.lastChild && bc.lastChild.nodeType === 3) bc.lastChild.nodeValue = ' › ' + (it.court || it.name);
    var add = q('#addToCartBtn'); if (add) add.setAttribute('data-product-id', it.id);
    try {
      /* photos choisies dans le back-office pour ce produit : elles priment
         sur celles écrites dans la page (sinon un envoi du client disparaît) */
      var choisies = null;
      try { var bo = window.VESPRA_PHOTOS_BO; if (bo && bo[it.id] && bo[it.id].length) choisies = bo[it.id]; } catch (e) {}
      var photos = choisies || it.photos;
      if (photos && typeof PG_IMGS !== 'undefined' && Array.isArray(PG_IMGS)) {
        PG_IMGS.splice.apply(PG_IMGS, [0, PG_IMGS.length].concat(photos));
        var v = document.getElementById('prodThumbs'); if (v) v.innerHTML = '';
        if (typeof pgThumbs === 'function') pgThumbs();
        if (typeof pgShow === 'function') pgShow(0);
      }
    } catch (e) {}
    dessinerAjouts(); afficherPrix();
  }

  window.selectVariant = function (btn) {
    var i = btns().indexOf(btn);
    if (i >= 0) appliquer(i);
  };
  /* la page appelle parfois ces fonctions : on les garde sans effet */
  window.majOptions = function () { afficherPrix(); };
  window.updateOptionBorder = function () {};

  function ligne(i) {
    var it = C.items[i];
    var l = { id: it.id, name: it.name, price: prixDe(i), img: (it.photos && it.photos[0] && it.photos[0].s) || '' };
    if (it.label) l.label = it.label;
    return l;
  }
  window.addToCartProduct = function () {
    var lignes = [cur];
    Object.keys(coches).forEach(function (k) { if (coches[k]) lignes.push(+k); });
    lignes.forEach(function (i) { window.addToCart(ligne(i)); });
  };

  function init() {
    var v = parseInt((location.search.match(/[?&]v=(\d+)/) || [])[1], 10);
    appliquer(isFinite(v) && C.items[v] ? v : (C.defaut || 0));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  /* prix.js peut corriger un tarif après coup : on réaffiche les montants à jour */
  window.addEventListener('load', function () { setTimeout(function () { dessinerAjouts(); afficherPrix(); }, 1500); });
})();
