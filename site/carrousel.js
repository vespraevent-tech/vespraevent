/* ─────────────────────────────────────────────────────────────
   CARROUSEL GLISSABLE

   Une rangée de cartes qui déborde de l'écran devient une bande
   qui défile horizontalement, au doigt sur téléphone et à la
   souris sur ordinateur, avec deux flèches.

   Le défilement lui-même est natif (overflow-x + scroll-snap) :
   c'est ce qui donne l'inertie du doigt sur téléphone. Ce fichier
   n'ajoute que deux choses : le glissement à la souris, qui n'existe
   pas nativement, et l'état des flèches.

   Utilisation :
     VESPRA_CARROUSEL(bande, flecheGauche, flecheDroite);

   Les flèches sont facultatives. Si tout tient dans la largeur,
   elles se masquent toutes seules.
   ───────────────────────────────────────────────────────────── */
(function () {
  function pas(bande) {
    var c = bande.firstElementChild;
    if (!c) return bande.clientWidth;
    var style = getComputedStyle(bande);
    var ecart = parseFloat(style.columnGap || style.gap || '0') || 0;
    return c.getBoundingClientRect().width + ecart;
  }

  window.VESPRA_CARROUSEL = function (bande, prec, suiv) {
    if (!bande) return;

    /* ——— état des flèches ———
       On mesure toujours hors mode « figé » : une fois les cartes
       revenues à la ligne, la bande ne déborde plus par définition,
       et on resterait bloqué en grille même à l'étroit. */
    var enCours = false;
    function etat() {
      if (enCours) return;
      enCours = true;
      var fige = bande.classList.contains('car-fige');
      if (fige) bande.classList.remove('car-fige');
      var deborde = bande.scrollWidth - bande.clientWidth > 4;
      bande.classList.toggle('car-fige', !deborde);
      setTimeout(function () { enCours = false; }, 0);
      if (!prec || !suiv) return;
      var parent = prec.parentElement;
      if (parent) parent.hidden = !deborde;
      prec.disabled = bande.scrollLeft <= 2;
      suiv.disabled = bande.scrollLeft >= bande.scrollWidth - bande.clientWidth - 2;
    }
    bande.addEventListener('scroll', etat, { passive: true });
    window.addEventListener('resize', etat);
    setTimeout(etat, 0);
    /* les cartes peuvent grandir quand une police finit de charger */
    if (window.ResizeObserver) new ResizeObserver(etat).observe(bande);

    if (prec) prec.addEventListener('click', function () {
      bande.scrollBy({ left: -pas(bande), behavior: 'smooth' });
    });
    if (suiv) suiv.addEventListener('click', function () {
      bande.scrollBy({ left: pas(bande), behavior: 'smooth' });
    });

    /* ——— glissement à la souris ———
       Le doigt fonctionne déjà tout seul : on ne s'occupe ici que
       de la souris, et on laisse les clics passer tant que le
       curseur n'a pas réellement bougé, sinon les liens des cartes
       deviendraient impossibles à cliquer. */
    var tire = false, bouge = false, departX = 0, departScroll = 0;

    bande.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      tire = true; bouge = false;
      departX = e.clientX; departScroll = bande.scrollLeft;
    });

    bande.addEventListener('pointermove', function (e) {
      if (!tire) return;
      var d = e.clientX - departX;
      if (!bouge && Math.abs(d) < 5) return;
      if (!bouge) { bouge = true; bande.classList.add('car-tire'); }
      e.preventDefault();
      bande.scrollLeft = departScroll - d;
    });

    function fin() {
      if (!tire) return;
      tire = false;
      bande.classList.remove('car-tire');
      /* on laisse passer un tour avant de réautoriser les clics */
      if (bouge) setTimeout(function () { bouge = false; }, 0);
    }
    bande.addEventListener('pointerup', fin);
    bande.addEventListener('pointercancel', fin);
    bande.addEventListener('pointerleave', fin);

    bande.addEventListener('click', function (e) {
      if (bouge) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    /* on ne fait pas glisser une image par mégarde */
    bande.addEventListener('dragstart', function (e) {
      if (tire) e.preventDefault();
    });
  };
})();
