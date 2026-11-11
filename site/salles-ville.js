/* ─────────────────────────────────────────────────────────────
   L'encart « salles recommandées » des pages de ville.

   La page ne contient aucune salle en dur : elle demande la liste
   complète à salles.js, garde celles dont le secteur correspond à
   son propre nom de fichier, et affiche les trois plus récentes.
   Une salle ajoutée dans le back-office arrive donc en tête, et la
   troisième sort de l'encart sans rien à modifier ici.

   S'il n'y a aucune salle pour cette ville, l'encart ne s'affiche
   pas du tout : mieux vaut rien qu'un cadre vide.
   ───────────────────────────────────────────────────────────── */
(function () {
  var hote = document.getElementById('sallesVille');
  if (!hote || typeof window.VESPRA_SALLES_CHARGER !== 'function') return;

  var cle = hote.getAttribute('data-ville') || '';
  var nom = hote.getAttribute('data-nom') || cle;
  var COMBIEN = 3;

  function creer(t, cls, txt) {
    var e = document.createElement(t);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  window.VESPRA_SALLES_CHARGER().then(function (tout) {
    var mien = (tout || []).filter(function (v) { return v.cle === cle && v.nom; });
    if (!mien.length) return;                 /* rien à recommander ici */
    var trois = mien.slice(0, COMBIEN);

    var sec = creer('section', 'sv');
    var dedans = creer('div', 'sv-in');

    var tete = creer('div', 'sv-tete');
    tete.appendChild(creer('div', 'sv-k', 'Nos lieux de réception'));
    tete.appendChild(creer('h2', null, 'Où organiser votre événement à ' + nom));
    tete.appendChild(creer('p', 'sv-lead',
      'Des lieux de réception du secteur de ' + nom + ' où nous livrons notre' +
      ' matériel. Cette' +
      ' liste est là pour vous faire gagner du temps.'));
    dedans.appendChild(tete);

    /* flèches du carrousel : elles ne servent que si les cartes
       débordent, le carrousel les masque tout seul sinon */
    var fleches = creer('div', 'car-fleches sv-fleches');
    var bPrec = creer('button', 'car-f', '\u2039'); bPrec.type = 'button';
    bPrec.setAttribute('aria-label', 'Lieu précédent');
    var bSuiv = creer('button', 'car-f', '\u203a'); bSuiv.type = 'button';
    bSuiv.setAttribute('aria-label', 'Lieu suivant');
    fleches.appendChild(bPrec); fleches.appendChild(bSuiv);
    tete.appendChild(fleches);

    var grille = creer('div', 'sv-grid car-bande');
    trois.forEach(function (v) {
      var c = creer('article', 'sv-carte' + (v.exemple ? ' sv-exemple' : ''));
      if (v.exemple) c.appendChild(creer('span', 'sv-badge', 'Exemple'));
      if (v.type) c.appendChild(creer('span', 'sv-type', v.type));
      c.appendChild(creer('h3', 'sv-nom', v.nom));
      var l = creer('div', 'sv-lieu');
      if (v.commune) l.appendChild(creer('b', null, v.commune));
      if (v.capacite) l.appendChild(document.createTextNode(
        (v.commune ? ' · ' : '') + 'jusqu\'à ' + v.capacite));
      c.appendChild(l);
      if (v.mot) c.appendChild(creer('p', 'sv-mot', v.mot));
      if (v.site) {
        var a = creer('a', 'sv-lien', 'Voir le site');
        a.href = v.site; a.target = '_blank'; a.rel = 'noopener';
        c.appendChild(a);
      }
      grille.appendChild(c);
    });
    dedans.appendChild(grille);

    var pied = creer('p', 'sv-pied');
    var a = creer('a', null, 'Voir tous nos lieux de réception');
    a.href = 'nos-recommandations.html';
    pied.appendChild(a);
    if (mien.length > COMBIEN) {
      pied.appendChild(document.createTextNode(
        ' — ' + mien.length + ' lieux référencés sur le secteur de ' + nom + '.'));
    }
    dedans.appendChild(pied);

    sec.appendChild(dedans);
    hote.appendChild(sec);

    if (typeof window.VESPRA_CARROUSEL === 'function') {
      window.VESPRA_CARROUSEL(grille, bPrec, bSuiv);
    }
  });
})();
