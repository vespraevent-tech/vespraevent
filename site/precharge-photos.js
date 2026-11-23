/* Copie autonome du préchargement de fiche.js, pour les fiches qui ne chargent pas fiche.js. */
/* Photos des fiches produits : toutes les photos de la galerie et des variantes sont préchargées en arrière-plan
   dès que la page est affichée, pour qu'un clic sur une vignette ou une variante change la photo instantanément. */
(function () {
  function urls() {
    var l = [];
    try { (typeof PG_IMGS !== 'undefined' ? PG_IMGS : []).forEach(function (x) { if (x && x.s) l.push(x.s); }); } catch (e) {}
    document.querySelectorAll('.prod-vbtn[onclick]').forEach(function (b) { var m = /selectVariant\([^)]*,\s*'([^']+)'\s*\)/.exec(b.getAttribute('onclick') || ''); if (m) l.push(m[1]); });
    document.querySelectorAll('#prodThumbs img').forEach(function (i) { if (i.dataset && i.dataset.full) l.push(i.dataset.full); });
    return l.filter(function (u, i) { return u && l.indexOf(u) === i; });
  }
  function precharger() {
    var file = urls(), enCours = 0;
    function suivant() {
      while (enCours < 3 && file.length) {
        var im = new Image(); enCours++; im.decoding = 'async';
        im.onload = im.onerror = function () { enCours--; suivant(); };
        im.src = file.shift();
      }
    }
    suivant();
  }
  if (!document.getElementById('prodMainImg')) return;
  if (document.readyState === 'complete') setTimeout(precharger, 300); else window.addEventListener('load', function () { setTimeout(precharger, 300); });
})();
