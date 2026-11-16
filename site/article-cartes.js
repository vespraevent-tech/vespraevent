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
