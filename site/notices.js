/* ─────────────────────────────────────────────────────────────
   Notices masquées ou ajoutées depuis le back-office.

   Les notices d'origine restent écrites dans les pages. Ce script
   retire celles que vous avez masquées et ajoute les nouvelles, sur la
   page Notices comme dans la liste déroulante des fiches produit.

   Une notice ajoutée est fabriquée en recopiant une notice existante
   de la page : elle hérite ainsi exactement de la même présentation,
   sans qu'aucun style ne soit à redéfinir ici.

   Nécessite notices-registre.js chargé avant lui.
   ───────────────────────────────────────────────────────────── */
(function () {
  var REGISTRE = window.VESPRA_NOTICES;
  if (!REGISTRE) return;

  var page = (location.pathname.split('/').pop() || 'index.html');
  if (page.indexOf('.') === -1) page += '.html';
  if (/[?&]apercu=1/.test(location.search)) return;

  var duPage = REGISTRE.filter(function (n) { return n.pg === page; });
  if (!duPage.length) return;

  /* le back-office charge ce fichier pour ses fonctions utilitaires, sans
     le chargeur de données : il n'y a alors rien à appliquer */
  if (typeof window.VESPRA_DONNEES !== 'function') return;

  window.VESPRA_DONNEES('notices')
    .then(function (items) {
      if (!Array.isArray(items) || !items.length) return;
      var masques = {}, ajouts = [];
      items.forEach(function (it) {
        if (!it || !it.id) return;
        if (it.action === 'masquer') masques[it.id] = true;
        else ajouts.push(it);
      });
      if (Object.keys(masques).length) masquer(masques);
      ajouts.forEach(ajouter);
    })
    .catch(function () { /* silencieux : les notices d'origine restent affichées */ });

  /* retrouve l'élément d'une notice d'origine à partir de son fichier PDF
     et de son intitulé — les deux doivent correspondre */
  function element(n) {
    var liens = document.querySelectorAll('a[href$=".pdf"], a[href*=".pdf"]');
    for (var i = 0; i < liens.length; i++) {
      var a = liens[i];
      if ((a.getAttribute('href') || '') !== n.pdf) continue;
      var carte = a.closest('.notice-card') || a.parentElement;
      if (!carte) continue;
      var t = (carte.textContent || '').replace(/\s+/g, ' ');
      if (t.indexOf(n.nom.slice(0, 26)) !== -1) return carte;
    }
    return null;
  }

  function masquer(masques) {
    duPage.forEach(function (n) {
      if (!masques[n.id]) return;
      var el = element(n);
      if (el) el.remove();
    });
  }

  function estPhotobooth(it) {
    var nom = normaliserCategorie((it && it.nom) || '');
    var pdf = String((it && it.pdf) || '').toLowerCase();
    var id = normaliserCategorie((it && it.id) || '');
    return pdf.indexOf('fiche-technique-photobooth.pdf') !== -1
      || nom.indexOf('photobooth') !== -1
      || id.indexOf('photobooth') !== -1;
  }

  function nettoyerPhotoboothHorsAnimation() {
    var blocs = document.querySelectorAll('.cat-block[data-cat]');
    for (var i = 0; i < blocs.length; i++) {
      if (normaliserCategorie(blocs[i].getAttribute('data-cat')) === 'animation') continue;
      var cartes = blocs[i].querySelectorAll('.notice-card');
      for (var j = 0; j < cartes.length; j++) {
        var texte = normaliserCategorie(cartes[j].textContent || '');
        var liens = cartes[j].querySelectorAll('a[href]');
        var pdfPhoto = false;
        for (var k = 0; k < liens.length; k++) {
          if ((liens[k].getAttribute('href') || '').toLowerCase().indexOf('fiche-technique-photobooth.pdf') !== -1) {
            pdfPhoto = true;
            break;
          }
        }
        if (pdfPhoto || texte.indexOf('photobooth') !== -1) cartes[j].remove();
      }
    }
  }

  function ajouter(it) {
    /* La fiche Photobooth est une notice native de la catégorie Animation.
       Si une ancienne entrée du back-office la classe en Lumière & Effets,
       on ne la recrée pas dans cette catégorie : la fiche native d'Animation
       reste l'unique occurrence affichée. */
    if (estPhotobooth(it)) {
      nettoyerPhotoboothHorsAnimation();
      var nativePhoto = null;
      for (var pi = 0; pi < duPage.length; pi++) {
        if (estPhotobooth(duPage[pi])) {
          nativePhoto = element(duPage[pi]);
          break;
        }
      }
      if (nativePhoto) return;
    }

    var modele = null;
    for (var i = 0; i < duPage.length && !modele; i++) modele = element(duPage[i]);
    if (!modele) return;                       /* aucun modèle à recopier */

    var neuf = modele.cloneNode(true);
    var nom = it.nom || 'Notice';
    var desc = it.desc || '';
    var pdf = it.pdf || '';

    /* intitulé et description : on remplace le texte des mêmes emplacements */
    var cible = neuf.querySelector('.nc-name');
    if (cible) cible.textContent = nom;
    var d = neuf.querySelector('.nc-desc');
    if (d) d.textContent = desc;

    if (!cible) {
      /* fiche produit : première ligne = intitulé, seconde = description */
      var divs = neuf.querySelectorAll('div div');
      if (divs[0]) divs[0].textContent = nom;
      if (divs[1]) { divs[1].textContent = ''; divs[1].appendChild(document.createTextNode(desc)); }
    }

    var tags = neuf.querySelector('.nc-tags');
    if (tags) tags.innerHTML = '<span class="nc-tag">' + nom.replace(/[<>&]/g, '') + '</span>';

    neuf.querySelectorAll('a[href]').forEach(function (a) {
      if ((a.getAttribute('href') || '').indexOf('.pdf') === -1) return;
      a.setAttribute('href', pdf);
      if (/^https?:/i.test(pdf)) {
        /* un PDF hébergé ailleurs ne peut pas être téléchargé directement :
           on l'ouvre dans un nouvel onglet */
        a.removeAttribute('download');
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener');
      }
    });

    var grid = grilleCategorie(it.cat);
    if (grid) grid.appendChild(neuf);
    else modele.parentNode.appendChild(neuf);
    mettreAJourCompteur(grid);
  }

  function normaliserCategorie(cat) {
    return String(cat || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function grilleCategorie(cat) {
    var c = normaliserCategorie(cat);
    if (!c) return null;
    var aliases = {
      'barnums': 'barnum',
      'barnum': 'barnum',
      'animation': 'animation',
      'photobooth': 'animation',
      'son': 'son & sonorisation',
      'sono': 'son & sonorisation',
      'sonorisation': 'son & sonorisation',
      'son & sonorisation': 'son & sonorisation',
      'lumiere': 'lumiere & effets',
      'lumiere & effets': 'lumiere & effets',
      'lumiere et effets': 'lumiere & effets'
    };
    var cible = aliases[c] || c;
    var blocs = document.querySelectorAll('.cat-block[data-cat]');
    for (var i = 0; i < blocs.length; i++) {
      if (normaliserCategorie(blocs[i].getAttribute('data-cat')) === cible) {
        return blocs[i].querySelector('.notice-grid');
      }
    }
    return null;
  }

  function mettreAJourCompteur(grid) {
    if (!grid) return;
    var bloc = grid.closest('.cat-block');
    var compteur = bloc && bloc.querySelector('.cat-count');
    if (!compteur) return;
    var n = grid.querySelectorAll('.notice-card').length;
    compteur.textContent = n + (n > 1 ? ' notices' : ' notice');
  }
})();
