/* Options « Micro filaire » (10 €) et « Micro sans fil » (20 €) pour les fiches Sono et Pack Vespra.
   Même modèle Shure SM58 ; 2 micros conseillés (filaire + sans fil confondus). Chaque micro a sa propre ligne de devis (produit p42).
   Les prix viennent du BO (champs optionMicroFil / optionMicroSF). */
(function () {
  var MAX = 99; /* pas de limite réelle : 2 micros conseillés, davantage sur demande */
  var TYPES = [
    { champ: 'optionMicroFil', label: 'Filaire', defaut: 10, qte: 1 },
    { champ: 'optionMicroSF', label: 'Sans fil', defaut: 20, qte: 1 }
  ];
  function px(t) { return (window.VESPRA_OPT ? window.VESPRA_OPT(t.champ, t.defaut) : t.defaut); }
  function dansPanier() {
    try { return JSON.parse(localStorage.getItem('vespra_cart') || '[]').reduce(function (n, i) { return n + (i.id === 'p42' ? (i.qty || 1) : 0); }, 0); } catch (e) { return 0; }
  }
  function utilises() {
    return TYPES.reduce(function (n, t) { var c = document.getElementById(t.champ); return n + (c && c.checked ? t.qte : 0); }, 0);
  }
  function maj() {
    var dispo = MAX - dansPanier();
    TYPES.forEach(function (t) { if (t.qte > Math.max(1, dispo)) t.qte = Math.max(1, dispo); });
    /* un seul des deux types peut prendre la 2e place : 2 micros conseillés */
    var used = utilises();
    TYPES.forEach(function (t) {
      var c = document.getElementById(t.champ); if (!c) return;
      var plein = used >= Math.min(MAX, dispo);
      c.disabled = !c.checked && plein;
      var lc = c.closest('label'); if (lc) lc.style.opacity = c.disabled ? '.5' : '';
    });
    TYPES.forEach(function (t) {
      var c = document.getElementById(t.champ); if (!c) return;
      var l = c.closest('label');
      var n = document.getElementById(t.champ + 'N');
      if (n) n.textContent = t.qte;
      var m = document.getElementById(t.champ + 'Moins'), p = document.getElementById(t.champ + 'Plus');
      if (m) m.disabled = t.qte <= 1;
      if (p) p.disabled = used >= Math.min(MAX, dispo);
      var tot = document.getElementById(t.champ + 'Total');
      if (tot) tot.textContent = t.qte > 1 ? ('= ' + (px(t) * t.qte) + ' €') : '';
      if (l) l.style.borderColor = c.checked ? 'var(--navy)' : 'var(--g3)';
      var st = document.getElementById(t.champ + 'Step');
      if (st) st.style.display = c.checked ? 'flex' : 'none';
    });
  }
  /* supplément des micros cochés, pour le prix affiché en haut de la fiche */
  window.microSupplement = function () {
    return TYPES.reduce(function (n, t) { var c = document.getElementById(t.champ); return n + (c && c.checked ? px(t) * t.qte : 0); }, 0);
  };
  var _maj0 = maj;
  maj = function () { _maj0(); if (typeof window.majPrixHaut === 'function') window.majPrixHaut(); };
  window.microOptionMaj = maj;
  window.microQte = function (champ, d) {
    TYPES.forEach(function (t) {
      if (t.champ !== champ) return;
      if (d > 0 && utilises() >= MAX) return;
      t.qte = Math.max(1, Math.min(MAX, t.qte + d));
    });
    maj();
  };
  window.ajouterMicros = function () {
    if (typeof window.addToCart !== 'function') return;
    TYPES.forEach(function (t) {
      var c = document.getElementById(t.champ);
      if (!c || !c.checked) return;
      var n = Math.min(t.qte, MAX - dansPanier());
      for (var i = 0; i < n; i++) window.addToCart({ id: 'p42', name: 'Micro Shure SM58', label: t.label, price: px(t), img: 'micro-shure-sm58.webp' });
    });
  };
  document.addEventListener('DOMContentLoaded', function () {
    TYPES.forEach(function (t) { var c = document.getElementById(t.champ); if (c) c.addEventListener('change', function () { if (!c.checked) t.qte = 1; maj(); }); });
    maj();
  });
  window.addEventListener('load', maj);
})();
