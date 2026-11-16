/* Sommaire des articles : met en évidence la section en cours de lecture */
(function () {
  var liens = [].slice.call(document.querySelectorAll('.art-toc a[href^="#"]'));
  if (!liens.length || !('IntersectionObserver' in window)) return;
  var cartes = liens.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  function marquer(i) { liens.forEach(function (a, k) { a.classList.toggle('on', k === i); }); }
  marquer(0);
  var vus = {};
  var obs = new IntersectionObserver(function (es) {
    es.forEach(function (e) { vus[e.target.id] = e.isIntersecting; });
    var premier = cartes.findIndex(function (c) { return c && vus[c.id]; });
    if (premier >= 0) marquer(premier);
  }, { rootMargin: '-96px 0px -55% 0px', threshold: 0 });
  cartes.forEach(function (c) { if (c) obs.observe(c); });
})();

/* Images des articles : un clic mène au produit concerné */
(function () {
  var cote = document.querySelector('.art-sidebar a[href^="produit-"]');
  var principal = cote ? cote.getAttribute('href') : null;
  [].forEach.call(document.querySelectorAll('.art-card .art-fig img'), function (img) {
    if (img.closest('a')) return;
    var carte = img.closest('.art-card'), cible = null;
    var nom = (img.getAttribute('src') || '').replace(/\.webp.*$/, '');
    var liens = [].slice.call(carte.querySelectorAll('a[href^="produit-"]'));
    cible = (liens.filter(function (a) { return nom && a.getAttribute('href').indexOf(nom.split('-')[0]) >= 0; })[0] || liens[0] || {}).getAttribute
      ? (liens.filter(function (a) { return nom && a.getAttribute('href').indexOf(nom.split('-')[0]) >= 0; })[0] || liens[0]).getAttribute('href') : principal;
    if (!cible) return;
    var a = document.createElement('a');
    a.href = cible; a.setAttribute('aria-label', 'Voir le produit');
    img.parentNode.insertBefore(a, img); a.appendChild(img);
  });
})();
