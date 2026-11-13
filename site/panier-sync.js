/* Panier : rester d'accord avec ce qui est réellement enregistré.

   Le panier est lu une seule fois, au chargement de la page. Si le visiteur
   revient par le bouton « retour » du navigateur, la page peut être restaurée
   telle qu'elle était, avec l'ancien panier en mémoire : un produit retiré
   entre-temps réapparaissait alors au premier enregistrement.
   On relit donc le panier à chaque retour sur la page, à chaque changement
   d'onglet et dès qu'un autre onglet le modifie. */
(function () {
  function lire() {
    try { var v = JSON.parse(localStorage.getItem('vespra_cart') || '[]'); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function resync() {
    try {
      if (typeof cart === 'undefined' || !Array.isArray(cart)) return;
      var enregistre = lire();
      if (JSON.stringify(enregistre) === JSON.stringify(cart)) return;
      cart.length = 0;
      Array.prototype.push.apply(cart, enregistre);
      if (typeof renderCart === 'function') { try { renderCart(); } catch (e) {} }
      if (typeof window.updateBadge === 'function') { try { window.updateBadge(); } catch (e) {} }
    } catch (e) { /* panier pas encore prêt : rien à faire */ }
  }
  window.VESPRA_PANIER_RESYNC = resync;
  window.addEventListener('pageshow', function (e) { if (e.persisted) resync(); });
  window.addEventListener('storage', function (e) { if (!e.key || e.key === 'vespra_cart') resync(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) resync(); });
  window.addEventListener('focus', resync);
})();
