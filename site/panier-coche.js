/* Repère « déjà dans mon devis » sur les cartes produit, partout sur le site :
   catalogue, accueil, pages villes, pages photobooth, pack.
   Un produit ajouté depuis n'importe quelle page est coché sur toutes les
   autres, et le repère suit le produit, jamais la position de la carte. */
(function () {
  var CSS = '.prod-img-wrap,.bc-img-wrap{position:relative}'
    + '.prod-card.in,.bc.in{box-shadow:0 0 0 2px var(--navy,#2B4A6B),0 4px 16px rgba(0,0,0,.05)}'
    + '.cp-badge{position:absolute;top:10px;left:10px;z-index:3;width:22px;height:22px;border-radius:50%;'
    + 'background:var(--navy,#2B4A6B);color:#fff;display:flex;align-items:center;justify-content:center;'
    + 'box-shadow:0 2px 6px rgba(0,0,0,.18)}';
  try {
    var st = document.createElement('style'); st.id = 'cp-badge-style'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}

  /* « p3_200-tirages » et « p3 » désignent le même produit */
  function racine(x) { return String((x && x.id) || x || '').split('_')[0]; }
  function panier() {
    try { if (typeof cart !== 'undefined' && Array.isArray(cart)) return cart; } catch (e) {}
    try { return JSON.parse(localStorage.getItem('vespra_cart') || '[]'); } catch (e) { return []; }
  }
  function dedans(id) {
    var p = panier();
    for (var i = 0; i < p.length; i++) if (racine(p[i]) === id) return true;
    return false;
  }
  function marquer() {
    var cartes = document.querySelectorAll('.prod-card[data-id],.bc[data-id]');
    for (var i = 0; i < cartes.length; i++) {
      var c = cartes[i], on = dedans(c.getAttribute('data-id'));
      c.classList.toggle('in', on);
      var w = c.querySelector('.prod-img-wrap,.bc-img-wrap') || c;
      var b = w.querySelector(':scope > .cp-badge') || c.querySelector('.cp-badge');
      if (on && !b) {
        b = document.createElement('span'); b.className = 'cp-badge';
        b.innerHTML = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">'
          + '<path d="M2.5 6.4l2.3 2.3 4.7-5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        b.title = 'Déjà dans votre devis';
        w.appendChild(b);
      } else if (!on && b) b.remove();
    }
  }
  window.VESPRA_COCHE = marquer;

  /* après chaque écriture du devis (ajout, retrait, synchronisation) */
  function brancher(nom) {
    try {
      var f = window[nom];
      if (typeof f !== 'function' || f.__coche) return;
      var g = function () { var r = f.apply(this, arguments); try { marquer(); } catch (e) {} return r; };
      g.__coche = 1; window[nom] = g;
    } catch (e) {}
  }
  function suivre() {
    ['saveCart', 'renderCart', 'addToCart', 'VESPRA_PANIER_RESYNC'].forEach(brancher);
    marquer();
    try {
      var m = null;
      new MutationObserver(function () { clearTimeout(m); m = setTimeout(marquer, 120); })
        .observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', suivre);
  else suivre();
  window.addEventListener('storage', function (e) { if (!e.key || e.key === 'vespra_cart') marquer(); });
  window.addEventListener('pageshow', marquer);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) marquer(); });
  /* après chaque ajout ou retrait depuis la page elle-même */
  var t = null;
  document.addEventListener('click', function () { clearTimeout(t); t = setTimeout(marquer, 300); }, true);
})();
