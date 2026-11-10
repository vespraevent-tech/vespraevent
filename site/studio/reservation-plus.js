/* ─────────────────────────────────────────────────────────────
   Planning : fiche de réservation plus lisible, et légende des couleurs.

   Deux ajouts, sans toucher au code de l'outil :

   1. La fiche qui s'ouvre au clic sur une réservation est réorganisée :
      l'essentiel d'abord (dates, montant, contact, matériel), le reste
      replié derrière un bouton « Voir plus ». Le téléphone, l'e-mail et
      l'adresse deviennent cliquables — un appel, un message ou un
      itinéraire en un geste, depuis le téléphone comme depuis
      l'ordinateur. Les boutons Modifier et Supprimer restent ceux de
      l'outil.

   2. Le planning code déjà chaque réservation par la couleur de sa
      catégorie de matériel. Il manquait de quoi lire ce code : une
      légende s'affiche sous le calendrier, et un simple survol suffit
      ensuite à savoir ce qui est loué.
   ───────────────────────────────────────────────────────────── */
(function () {

  /* ══ 1. Fiche de réservation ══════════════════════════════ */

  /* « Livraison » fait partie de l'essentiel : savoir si le client vient
     chercher ou s'il faut livrer change toute la préparation. */
  var ESSENTIEL = ['Date(s)', 'Montant total', 'Acompte', 'Détail du prix', 'Téléphone', 'Email', 'Lieu', 'Livraison', 'Produits', 'Notes', 'Message du client', 'Note du client'];

  function styles() {
    if (document.getElementById('vpStyle')) return;
    var st = document.createElement('style');
    st.id = 'vpStyle';
    st.textContent = [
      /* contact cliquable */
      '.vp-lien{display:inline-flex;align-items:center;gap:7px;font:600 14px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;',
      '  color:var(--navy,#1e3650);text-decoration:none;border-bottom:1px solid transparent;',
      '  word-break:break-word}',
      '.vp-lien:hover{border-bottom-color:currentColor}',
      '.vp-lien small{font:500 11px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;opacity:.6;white-space:nowrap}',
      /* l\'adresse est plus longue que les autres champs : elle prend la ligne */
      '.detail-row.vp-large{grid-column:1/-1}',
      /* repli du détail */
      '.vp-suite{display:none}',
      '.vp-ouvert .vp-suite{display:flex}',
      '.vp-plus{grid-column:1/-1;justify-self:start;margin:2px 0 4px;background:none;',
      '  border:1px solid #e0dccf;border-radius:999px;padding:7px 18px;cursor:pointer;',
      '  font:600 13px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:var(--navy,#1e3650)}',
      '.vp-plus:hover{background:var(--navy,#1e3650);border-color:var(--navy,#1e3650);color:#fff}',
      '.vp-detail{font:600 11.5px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#8a8577;margin-top:2px}',
      '.vp-euro{position:relative;display:block}',
      '.vp-euro input{padding-right:30px!important}',
      '.vp-euro-signe{position:absolute;right:12px;top:50%;transform:translateY(-50%);',
      '  font:600 13px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#8a8577;pointer-events:none}',
      '.vp-detail span{opacity:.5;margin:0 2px}',
      /* confort de lecture sur téléphone */
      /* la fiche ne doit jamais dépasser du cadre : elle défile à l\'intérieur */
      '#detailMb .modal{max-height:min(82vh,700px);display:flex;flex-direction:column}',
      /* le contenu défile au doigt à l\'intérieur de la fiche, sans
         entraîner la page derrière */
      '#detailMb .detail-grid{overflow-y:auto;flex:1;min-height:0;',
      '  overscroll-behavior:contain;-webkit-overflow-scrolling:touch}',
      '@media(max-width:620px){#detailMb .modal{max-height:86dvh}}',
      /* Le formulaire de réservation est long : produits, options,
         livraison, acompte, notes. Sur téléphone il occupe une hauteur
         raisonnable et se remplit en faisant glisser le doigt, le titre
         restant en haut et les boutons en bas. */
      '@media(max-width:700px){',
      '  #mb .modal{max-height:88dvh;overflow-y:auto;overscroll-behavior:contain;',
      '    -webkit-overflow-scrolling:touch;padding-bottom:0!important}',
      '  #mb .mhead{position:sticky;top:0;z-index:3;background:#fff;',
      '    border-bottom:1px solid #f0f0f0}',
      '  #mb .foot{position:sticky;bottom:0;z-index:3;background:#fff;',
      '    border-top:1px solid #f0f0f0;padding:12px 16px!important;display:flex;gap:8px}',
      '  #mb .foot .btn{flex:1}',
      /* les champs et les boutons du formulaire étaient taillés pour un
         écran d'ordinateur : ils prenaient la moitié de l'écran d'un
         téléphone. Ils gardent une hauteur confortable au doigt, sans
         l'excès. */
      '  #mb input,#mb select,#mb textarea{font-size:13.5px!important;padding:8px 10px!important}',
      '  #mb .field{gap:4px!important;margin-bottom:10px!important}',
      '  #mb .field label,#mb label{font-size:12px!important}',
      '  #mb .toggle-row{gap:6px!important}',
      '  #mb .toggle-btn{padding:7px 8px!important;font-size:12.5px!important;border-radius:8px!important}',
      '  #mb .btn{padding:8px 14px!important;font-size:13px!important}',
      '  #mb .mhead h2{font-size:17px!important}',
      '  #mb .prod-step-title,#mb .cat{font-size:12.5px!important}',
      '}',
      '@media(max-width:620px){',
      '  .detail-grid{grid-template-columns:1fr!important;gap:12px 0!important;padding:16px 18px 6px!important}',
      '  .detail-actions{padding:12px 18px 14px!important;flex-wrap:wrap;gap:8px}',
      '  .detail-actions>div{width:100%;display:flex;gap:8px}',
      '  .detail-actions .btn{flex:1}',
      '}',
      /* légende du planning */
      '.vp-legende{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;',
      '  margin:14px 0 4px;padding:12px 14px;background:#fff;border:1px solid #eee8dc;',
      '  border-radius:12px}',
      '.vp-legende-t{font:700 11px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;',
      '  color:#8a8577;margin-right:2px}',
      '.vp-cat{display:inline-flex;align-items:center;gap:7px;font:600 12.5px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#4a4a44}',
      '.vp-pastille{width:12px;height:12px;border-radius:4px;flex-shrink:0}',
      '@media(max-width:620px){.vp-legende{gap:8px 12px;padding:10px 12px}.vp-cat{font-size:12px}}',
      /* planning en liste (téléphone) */
      '.vp-agenda{display:flex;flex-direction:column;gap:6px;margin-top:12px}',
      '.vp-jour{font:700 11.5px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;',
      '  color:#8a8577;margin:12px 0 2px}',
      '.vp-jour:first-child{margin-top:0}',
      '.vp-resa{display:flex;align-items:center;gap:11px;width:100%;text-align:left;',
      '  background:#fff;border:1px solid #eee8dc;border-radius:12px;padding:11px 13px;',
      '  cursor:pointer;font-family:inherit}',
      '.vp-resa:active{background:#faf7f0}',
      '.vp-barre{display:flex;flex-direction:column;width:4px;align-self:stretch;',
      '  min-height:34px;border-radius:2px;overflow:hidden;flex-shrink:0}',
      '.vp-barre>span{flex:1}',
      '.vp-txt{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}',
      '.vp-nom{font:700 14px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#1f2430;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.vp-mat{font:500 12.5px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#6a6559;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.vp-suite-j{font:600 11.5px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#8a8577}',
      '.vp-prix{font:700 14px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;white-space:nowrap;',
      '  font-variant-numeric:tabular-nums}',
      '.vp-vide{font:500 13.5px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#8a8577;background:#fff;border:1px solid #eee8dc;',
      '  border-radius:12px;padding:18px 16px;text-align:center}',
      /* ── Le calendrier, sur écran large ─────────────────────────────
         Presque tout tombe le samedi : sa colonne recevait huit
         réservations dans la hauteur d\'une case, qui débordaient. Le
         week-end prend donc plus de largeur que les jours creux, la case
         s\'étire au lieu de faire défiler son contenu, et une journée
         chargée range ses réservations sur deux colonnes. */
      /* ── Le calendrier, sur écran large ─────────────────────────────
         Chaque réservation est une barre qui va de son premier jour à son
         dernier, sur une seule ligne : nom, matériel et montant alignés.
         Une location d'un seul jour court jusqu'au lendemain, comme dans
         la réalité (on récupère le matériel le lendemain). Les barres
         s'empilent dans la semaine, et les cases s'agrandissent pour les
         contenir : plus rien ne dépasse d'un trait. */
      '@media(min-width:701px){',
      '  .week,.days{grid-template-columns:.9fr .9fr .9fr .9fr 1.15fr 1.4fr 1.15fr!important}',
      '  .days{align-items:stretch!important}',
      '  .day{overflow:visible!important;height:auto!important}',
      '}',
      '.vb{position:absolute;display:flex;align-items:center;gap:8px;height:22px;',
      '  padding:0 8px;border-radius:6px;font:600 11px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;cursor:pointer;',
      '  box-sizing:border-box;overflow:hidden;white-space:nowrap;z-index:3}',
      '.vb:hover{filter:brightness(.97)}',
      '.vb-prise{box-shadow:0 6px 18px rgba(0,0,0,.22);transform:scale(1.01)}',
      '.vb-liv{font:700 8.5px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;letter-spacing:.05em;opacity:.55;flex-shrink:0}',
      '.vb-nom{font-weight:800;color:#1f2430;flex-shrink:0;max-width:42%;overflow:hidden;',
      '  text-overflow:ellipsis}',
      '.vb-mat{font-weight:500;color:#5d5a52;flex:1;min-width:0;overflow:hidden;',
      '  text-overflow:ellipsis}',
      '.vb-prix{font-weight:800;color:#1f2430;flex-shrink:0;font-variant-numeric:tabular-nums}',
      /* en liste, les vues Semaine / Année et le bouton flottant encombrent */
      '@media(max-width:700px){',
      /* les commandes du mois tiennent sur deux rangées lisibles :
         « ‹ Septembre 2026 › » puis « Aujourd\'hui ». display:contents
         sort les boutons de leur conteneur pour pouvoir les ranger. */
      '  .calhead{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px}',
      /* ces conteneurs portent un style écrit dans la balise : il faut
         donc passer devant avec !important */
      '  .calhead>div:not(.month){display:contents!important}',
      '  .calhead>div:not(.month)>div{display:none!important}',
      '  .calhead #prev{order:1}',
      '  .calhead .month{order:2;flex:1;min-width:0;text-align:center;',
      '    font-size:15px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '  .calhead .btn{padding:7px 12px!important;font-size:13px!important}',
      '  .calhead #next{order:3}',
      '  .calhead #todayBtn{order:4;flex:1 0 100%}',
      /* en liste, le choix Semaine / Mois / Année n\'a plus d\'objet : il
         débordait de l\'écran, on le retire */
      '  .calhead .view-btn{display:none}',
      '  .pt{font-size:22px!important}',
      '  .fab{width:46px!important;height:46px!important;font-size:24px!important;',
      '    right:14px!important;bottom:14px!important;box-shadow:0 4px 14px rgba(0,0,0,.2)!important}',
      '}',
    ].join('');
    document.head.appendChild(st);
  }

  /* ── Le champ du montant de livraison ─────────────────────────────
     Un simple champ où l'on tape le montant, avec le symbole € affiché
     au bout : pas de tarifs tout faits, chaque déplacement est différent. */
  function champEuros() {
    var champ = document.getElementById('livraisonPrice');
    if (!champ || champ.dataset.vpEuro) return;
    champ.dataset.vpEuro = '1';

    var boite = document.createElement('span');
    boite.className = 'vp-euro';
    champ.parentNode.insertBefore(boite, champ);
    boite.appendChild(champ);

    var signe = document.createElement('span');
    signe.className = 'vp-euro-signe';
    signe.textContent = '€';
    boite.appendChild(signe);
  }

  /* ── Le détail du montant ─────────────────────────────────────────
     Le total mêlait la location et la livraison. Sur une fiche, on a
     besoin des deux : ce que coûte le matériel, et ce qui a été compté
     pour la livraison ou l'installation. Le total reste en gros, le
     détail s'écrit juste en dessous. */
  function detailMontant() {
    /* Cette note ne comptait que la location et la livraison : depuis que
       le montage et les suppléments entrent dans le total, elle donnait un
       détail faux. Le bloc « Détail du prix » de la fiche les montre tous. */
    if (document.querySelector('#detailContent .dp')) return;
    var lignes = document.querySelectorAll('#detailContent .detail-row');
    var cible = null;
    Array.prototype.forEach.call(lignes, function (l) {
      var e = l.querySelector('.detail-label');
      if (e && e.textContent.trim() === 'Montant total') cible = l;
    });
    if (!cible || cible.querySelector('.vp-detail')) return;

    var r = null;
    (window.R || []).forEach(function (x) {
      if (String(x.id) === String(window.currentDetailId)) r = x;
    });
    if (!r) return;

    var livraison = Number(r.livraisonPrice) || 0;
    if (livraison <= 0) return;

    var location = (typeof window.produitsNets === 'function' ? window.produitsNets(r.products) : (r.products || [])).reduce(function (t, p) {
      var prix = typeof window.getProductPrice === 'function' ? window.getProductPrice(p) : p.price;
      return t + (Number(prix) || 0);
    }, 0);

    var d = document.createElement('div');
    d.className = 'vp-detail';
    d.innerHTML = 'Location ' + location.toLocaleString('fr-FR') + ' € ' +
      '<span>+</span> Livraison / installation ' + livraison.toLocaleString('fr-FR') + ' €';
    cible.appendChild(d);
  }

  /* les boutons de la fiche portaient une icône : le libellé se suffit */
  function sansIcones() {
    var barre = document.querySelector('#detailMb .detail-actions');
    if (!barre) return;
    Array.prototype.forEach.call(barre.querySelectorAll('button, .btn'), function (b) {
      if (b.children.length) return;
      var t = b.textContent.replace(/[←-⯿️\u{1F000}-\u{1FAFF}]/gu, '').trim();
      if (t && t !== b.textContent) b.textContent = t;
    });
  }

  /* garde le contenu déjà produit par l'outil, et le réorganise */
  function reorganiser() {
    sansIcones();
    detailMontant();
    var grille = document.getElementById('detailContent');
    if (!grille) return;

    var lignes = Array.prototype.slice.call(grille.querySelectorAll('.detail-row'));
    if (!lignes.length) return;

    var suite = [];

    lignes.forEach(function (ligne) {
      var etiquette = ligne.querySelector('.detail-label');
      var nom = etiquette ? etiquette.textContent.trim() : '';
      var valeur = ligne.querySelector('.detail-val');

      /* un champ vide (« — ») n'apprend rien et allonge la fiche : il
         descend avec le reste derrière « Voir plus », où l'on peut
         vérifier ce qui manque. Toutes les lignes n'ont pas de
         .detail-val (montant, produits, livraison…) : on lit alors ce que
         la ligne contient en dehors de son intitulé. */
      var contenu = (ligne.textContent || '').replace(nom, '').trim();
      var vide = !contenu || contenu === '—';
      if (vide) {
        ligne.classList.add('vp-suite');
        suite.push(ligne);
        return;
      }

      /* la mention de livraison portait une icône : le texte suffit */
      if (nom === 'Livraison') {
        var badge = ligne.querySelector('.badge');
        if (badge && !badge.children.length) {
          badge.textContent = badge.textContent
            .replace(/[\u2190-\u2BFF\uFE0F\u{1F000}-\u{1FAFF}]/gu, '').trim();
        }
      }

      /* contacts cliquables */
      if (nom === 'Téléphone' && valeur) cliquable(valeur, 'tel');
      else if (nom === 'Email' && valeur) cliquable(valeur, 'mail');
      else if (nom === 'Lieu' && valeur) { cliquable(valeur, 'carte'); ligne.classList.add('vp-large'); }

      if (ESSENTIEL.indexOf(nom) === -1) {
        ligne.classList.add('vp-suite');
        suite.push(ligne);
      }
    });

    if (!suite.length) return;

    /* les lignes repliées descendent en bas de la fiche : sans cela, le
       bouton viendrait s'intercaler au milieu des informations gardées
       visibles, puisque l'outil ne les écrit pas dans cet ordre */
    suite.forEach(function (ligne) { grille.appendChild(ligne); });

    /* plus de bouton « Voir plus » : pour tout voir, on ouvre « Modifier » */
  }

  function cliquable(valeur, genre) {
    var texte = (valeur.textContent || '').trim();
    if (!texte || texte === '—' || valeur.querySelector('.vp-lien')) return;

    var a = document.createElement('a');
    a.className = 'vp-lien';
    a.textContent = texte;

    if (genre === 'tel') {
      /* les numéros français s'écrivent avec des espaces : on les retire
         pour que le téléphone compose bien le bon numéro */
      a.href = 'tel:' + texte.replace(/[^0-9+]/g, '');

    } else if (genre === 'mail') {
      var sig = 'Cordialement,\nThomas\nÉquipe Vespra Event Vitré';
      a.href = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(texte)
        + '&su=' + encodeURIComponent('Vespra Event') + '&body=' + encodeURIComponent('Bonjour,\n\n\n\n' + sig);
      a.target = '_blank';
      a.rel = 'noopener';

    } else {
      a.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(texte);
      a.target = '_blank';
      a.rel = 'noopener';
      a.insertAdjacentHTML('beforeend', ' <small>itinéraire</small>');
    }

    valeur.textContent = '';
    valeur.appendChild(a);
  }

  /* ══ 2. Légende des couleurs du planning ══════════════════ */

  /* Les barres du planning sont coloriées par produit (getProductColor),
     et non par catégorie : la légende doit donc lister ces mêmes
     familles de produits, avec exactement la même couleur. Elle
     affichait jusqu'ici les couleurs de catégorie, qui ne
     correspondaient à rien de ce qu'on voit sur le calendrier. */
  var FAMILLES = [
    { cle: 'photobooth', label: 'Photobooth' },
    { cle: 'pack_vespra', label: 'Pack Vespra' },
    { cle: 'sono', label: 'Sonorisation' },
    { cle: 'lumieres', label: 'Jeux de lumières' },
    { cle: 'boule', label: 'Boule à facettes' },
    { cle: 'effets', label: 'Fumée et effets' },
    { cle: 'barnum', label: 'Barnum & structures' },
    { cle: 'boite_nuit', label: 'Boîte de nuit' },
    { cle: 'restauration', label: 'Restauration' },
    { cle: 'videoprojecteur', label: 'Vidéoprojecteur' },
    { cle: 'livre_or', label: "Livre d'or audio" },
    { cle: 'karaoke', label: 'Karaoké' },
    { cle: 'jeux_bois', label: 'Jeux en bois' },
    { cle: 'canon', label: "Feux d'artifice de jour" },
  ];

  /* Rang d'une réservation dans l'ordre des familles ci-dessus. On part de
     la couleur de sa barre — c'est elle qu'on voit — et on la retrouve dans
     PRODUCT_COLORS. Une couleur inconnue passe en fin de liste plutôt que
     de se glisser entre deux familles. */
  var rangsParCouleur = null;
  function rangFamille(r) {
    if (!rangsParCouleur) {
      var palette = window.PRODUCT_COLORS;
      if (!palette) return 999;          /* palette pas encore chargée */
      rangsParCouleur = {};
      FAMILLES.forEach(function (f, i) {
        var c = palette[f.cle];
        if (!c) return;
        var clef = String(c).toUpperCase();
        if (rangsParCouleur[clef] === undefined) rangsParCouleur[clef] = i;
      });
    }
    var couleurs = typeof window.getCatColorsForRes === 'function'
      ? window.getCatColorsForRes(r) : null;
    var bg = couleurs && couleurs[0];
    if (!bg) return 999;
    var rang = rangsParCouleur[String(bg).toUpperCase()];
    return rang === undefined ? 999 : rang;
  }

  function legende() {
    var calendrier = document.querySelector('.calendar');
    if (!calendrier || document.querySelector('.vp-legende')) return;
    if (typeof window.getProductColor !== 'function' || !window.PRODUCT_COLORS) return;

    /* on ne montre que les couleurs réellement présentes à l'écran :
       une légende de quinze couleurs dont deux servent n'aide personne */
    var utilisees = {};
    (window.R || []).forEach(function (r) {
      if (!r || r._deleted||enSuivi(r)) return;
      (r.products || []).forEach(function (p) {
        if (!p) return;
        var c = window.getProductColor(p.name, p.cat);
        if (c) utilisees[String(c).toUpperCase()] = true;
      });
    });

    var vues = {}, visibles = [];
    FAMILLES.forEach(function (f) {
      var couleur = window.PRODUCT_COLORS[f.cle];
      if (!couleur) return;
      var clef = String(couleur).toUpperCase();
      if (!utilisees[clef] || vues[clef]) return;   /* une couleur = une entrée */
      vues[clef] = true;
      visibles.push({ label: f.label, couleur: couleur });
    });
    if (!visibles.length) return;

    var bloc = document.createElement('div');
    bloc.className = 'vp-legende';
    bloc.innerHTML = '<span class="vp-legende-t">Matériel loué</span>' +
      visibles.map(function (c) {
        /* le blanc a besoin d'un contour pour se voir sur fond clair */
        var bord = /^#?(FFFFFF|FFF)$/i.test(String(c.couleur).replace('#', '')) ? ';border:1px solid #d8d2c6' : '';
        return '<span class="vp-cat"><span class="vp-pastille" style="background:' + c.couleur + bord + '"></span>' +
               echapper(c.label) + '</span>';
      }).join('');
    calendrier.parentNode.insertBefore(bloc, calendrier.nextSibling);
  }

  function echapper(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ══ 2 bis. Planning du mois, en liste, sur téléphone ══════
     Le calendrier à sept colonnes est fait pour un écran large. Sur un
     téléphone, chaque colonne fait quarante pixels : les noms sont
     coupés, les montants illisibles, et il faut agrandir pour savoir de
     qui il s'agit.

     Le même mois est donc présenté en liste : un jour après l'autre, et
     pour chaque jour le client, le matériel et le montant. Ce qui compte
     se lit d'un coup d'œil, sans zoom, et un appui ouvre la fiche.
     Au-delà de 700 px, le calendrier reprend sa place. */
  var LARGEUR_LISTE = 700;

  function moisDe(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }

  function isoDuJour() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  /* ── Les réservations en barres ───────────────────────────────────
     Dans une case étroite, une réservation tenait sur deux lignes et six
     réservations le même samedi débordaient. Chacune devient donc une
     barre posée par-dessus la semaine : elle va de son premier jour à son
     dernier, et porte sur une seule ligne le nom, le matériel et le
     montant. Une location d'un seul jour est tracée jusqu'au lendemain —
     c'est ainsi qu'elle se passe : sortie la veille, retour le lendemain.

     Les barres s'empilent sans jamais se chevaucher, et la hauteur des
     cases est ajustée pour qu'elles tiennent toutes entre les traits de
     la semaine. Le calendrier de l'outil n'est pas modifié : ses propres
     vignettes sont simplement masquées le temps de l'affichage. */
  var HAUTEUR_BARRE = 22, ECART_BARRE = 4;

  function barres() {
    if (window.innerWidth <= LARGEUR_LISTE) return;
    if (window.page !== 'planning' || window.calView === 'year') return;

    var resas = {};
    (window.R || []).forEach(function (r) { if (r && r.id) resas[String(r.id)] = r; });

    Array.prototype.forEach.call(document.querySelectorAll('.week-row'), function (ligne) {
      /* on efface les barres d'un affichage précédent */
      Array.prototype.forEach.call(ligne.querySelectorAll('.vb'), function (b) { b.remove(); });

      var cases = Array.prototype.slice.call(ligne.querySelectorAll('.day'));
      if (!cases.length) return;

      var jours = cases.map(function (c) { return c.dataset.date || ''; });

      /* une réservation par jour de la semaine, dans l'ordre d'affichage */
      var vues = {}, aPlacer = [];
      cases.forEach(function (c, i) {
        Array.prototype.forEach.call(c.querySelectorAll('.event[data-res-id]'), function (e) {
          e.style.display = 'none';
          var id = e.getAttribute('data-res-id');
          if (vues[id]) return;
          vues[id] = true;
          var r = resas[id];
          if (r) aPlacer.push({ r: r, depart: i });
        });
      });

      /* les locations de plusieurs jours sont déjà tracées en barres par
         l'outil, en bas de la semaine : on les reprend ici pour que tout
         soit empilé de la même façon */
      Array.prototype.forEach.call(ligne.querySelectorAll('.span-ev[data-res-id]'), function (e) {
        e.style.display = 'none';
        var id = e.getAttribute('data-res-id');
        if (vues[id]) return;
        vues[id] = true;
        var r = resas[id];
        if (!r) return;
        var depart = jours.indexOf(r.dateStart);
        aPlacer.push({ r: r, depart: depart >= 0 ? depart : premierJour(jours) });
      });

      if (!aPlacer.length) { ajusterHauteur(ligne, cases, 0); return; }

      /* colonnes couvertes : du jour de départ au lendemain du retour */
      aPlacer.forEach(function (p) {
        var fin = p.r.dateEnd && p.r.dateEnd > p.r.dateStart
          ? jours.indexOf(p.r.dateEnd)
          : p.depart + 1;
        if (fin < p.depart) fin = dernierJour(jours);   /* la location se poursuit la semaine suivante */
        p.fin = Math.min(Math.max(fin, p.depart), cases.length - 1);
      });
      /* Les réservations d'un même week-end sont rangées par catégorie de
         matériel : tous les photobooths ensemble, puis toutes les sonos,
         etc. Les barres étant empilées ensuite dans cet ordre, une colonne
         montre ses couleurs groupées au lieu de les alterner. */
      aPlacer.sort(function (a, b) {
        return rangFamille(a.r) - rangFamille(b.r) || a.depart - b.depart || a.fin - b.fin;
      });

      /* empilement : une barre ne recouvre jamais une autre */
      var occupe = [];
      aPlacer.forEach(function (p) {
        var rang = 0;
        while (true) {
          var libre = true;
          for (var c = p.depart; c <= p.fin; c++) {
            if (occupe[rang] && occupe[rang][c]) { libre = false; break; }
          }
          if (libre) break;
          rang++;
        }
        if (!occupe[rang]) occupe[rang] = {};
        for (var c2 = p.depart; c2 <= p.fin; c2++) occupe[rang][c2] = true;
        p.rang = rang;
      });

      var haut = departVertical(cases);
      var repere = ligne.getBoundingClientRect();

      aPlacer.forEach(function (p) {
        var a = cases[p.depart].getBoundingClientRect();
        var b = cases[p.fin].getBoundingClientRect();
        ligne.appendChild(barre(p, a.left - repere.left, b.right - a.left,
          haut + p.rang * (HAUTEUR_BARRE + ECART_BARRE)));
      });

      ajusterHauteur(ligne, cases, occupe.length);
    });
  }

  function premierJour(jours) {
    for (var i = 0; i < jours.length; i++) if (jours[i]) return i;
    return 0;
  }
  function dernierJour(jours) {
    for (var i = jours.length - 1; i >= 0; i--) if (jours[i]) return i;
    return jours.length - 1;
  }

  /* les barres commencent sous le numéro du jour */
  function departVertical(cases) {
    var num = cases[0].querySelector('.num');
    if (!num) return 34;
    var c = cases[0].getBoundingClientRect(), n = num.getBoundingClientRect();
    return Math.round(n.bottom - c.top) + 4;
  }

  function ajusterHauteur(ligne, cases, nbRangs) {
    var besoin = departVertical(cases) + nbRangs * (HAUTEUR_BARRE + ECART_BARRE) + 6;
    cases.forEach(function (c) { c.style.minHeight = Math.max(96, besoin) + 'px'; });
  }

  function barre(p, gauche, largeur, haut) {
    var r = p.r;
    var couleurs = typeof window.getCatColorsForRes === 'function'
      ? window.getCatColorsForRes(r) : ['#888'];
    var total = typeof window.calcResTotal === 'function' ? window.calcResTotal(r) : 0;
    var materiel = (r.products || []).map(function (x) { return x.short || x.name; })
      .filter(Boolean).join(' · ') || 'Matériel à compléter';

    var el = document.createElement('div');
    el.className = 'vb';
    el.setAttribute('data-res-id', r.id);
    el.style.left = Math.round(gauche) + 'px';
    el.style.width = Math.round(largeur) + 'px';
    el.style.top = Math.round(haut) + 'px';
    /* Une réservation est colorée par son matériel principal : toute la barre,
       et pas seulement un petit liseré, reprend cette couleur. Les variantes
       et options n'influencent jamais la couleur. */
    var bg = couleurs[0] || '#FFFFFF';
    var fg = typeof window.getColorText === 'function' ? window.getColorText(bg) : '#1f2430';
    el.style.background = bg;
    el.style.color = fg;
    el.style.border = '1px solid ' + bg;
    el.style.borderLeft = '3px solid ' + bg;

    el.innerHTML =
      (window.aLivraison && window.aLivraison(r) ? '<span class="vb-liv" style="color:inherit">LIV</span>' : '') +
      '<span class="vb-nom" style="color:inherit">' + echapper(r.client || 'Client') + '</span>' +
      '<span class="vb-mat" style="color:inherit;opacity:.78">' + echapper(materiel) + '</span>' +
      (total > 0 ? '<span class="vb-prix" style="color:inherit">' + total.toLocaleString('fr-FR') + ' €</span>' : '');

    el.addEventListener('click', function (e) {
      if (el._deplacee) { el._deplacee = false; return; }   /* fin d'un déplacement */
      e.stopPropagation();
      if (typeof window.openDetail === 'function') window.openDetail(r.id);
    });

    deplacable(el);
    return el;
  }

  /* ── Déplacer une réservation ─────────────────────────────────────
     À la souris, on attrape la barre et on la dépose sur un autre jour,
     comme avant. Au doigt, un appui simple ouvrirait la fiche et un
     glissement ferait défiler la page : il faut donc d'abord maintenir
     le doigt une demi-seconde — le téléphone vibre brièvement — avant de
     pouvoir déplacer. C'est le geste habituel sur téléphone, et il évite
     de déplacer une réservation par mégarde.

     Le déplacement lui-même reste celui de l'outil : mêmes règles, même
     enregistrement. */
  var ATTENTE_DOIGT = 450;

  function deplacable(el) {
    if (typeof window.startDrag !== 'function') return;

    /* Un clic simple ouvre la fiche, un glissement déplace la
       réservation. La barre était marquée « déplacée » dès l'appui, si
       bien qu'un simple clic était toujours pris pour un déplacement et
       que la fiche ne s'ouvrait jamais. On ne la marque donc que si la
       souris a réellement bougé. */
    el.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      el._deplacee = false;
      var depart = { x: e.clientX, y: e.clientY };
      function bouge(ev) {
        if (Math.abs(ev.clientX - depart.x) > 4 || Math.abs(ev.clientY - depart.y) > 4) el._deplacee = true;
      }
      function fini() {
        document.removeEventListener('mousemove', bouge, true);
        document.removeEventListener('mouseup', fini, true);
      }
      document.addEventListener('mousemove', bouge, true);
      document.addEventListener('mouseup', fini, true);
      window.startDrag(e);
    });

    var minuteur = null, depart = null;

    el.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      depart = { x: t.clientX, y: t.clientY };
      minuteur = setTimeout(function () {
        minuteur = null;
        el._deplacee = true;
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) {} }
        el.classList.add('vb-prise');
        window.startDrag({
          type: 'touchstart', button: 0, target: el, currentTarget: el,
          touches: e.touches, preventDefault: function () {}, cancelable: false,
        });
      }, ATTENTE_DOIGT);
    }, { passive: true });

    var abandon = function (e) {
      if (!minuteur) return;
      if (e && e.touches && e.touches[0] && depart) {
        var t = e.touches[0];
        /* un simple défilement de la page ne doit pas devenir un déplacement */
        if (Math.abs(t.clientX - depart.x) < 8 && Math.abs(t.clientY - depart.y) < 8) return;
      }
      clearTimeout(minuteur);
      minuteur = null;
    };
    el.addEventListener('touchmove', abandon, { passive: true });
    el.addEventListener('touchend', function () {
      abandon();
      el.classList.remove('vb-prise');
    });
    el.addEventListener('touchcancel', function () {
      abandon();
      el.classList.remove('vb-prise');
    });
  }

  /* ── Créer une réservation en glissant sur les jours, au doigt ─────
     L'outil sait déjà le faire à la souris. Au doigt, on maintient sur
     un jour, puis on glisse jusqu'au dernier jour : le formulaire de
     nouvelle réservation s'ouvre avec les dates déjà remplies. */
  function selectionAuDoigt() {
    if (document._vpSelection) return;
    document._vpSelection = true;

    var minuteur = null, actif = false, debut = null, fin = null, depart = null;

    function jourSous(t) {
      var el = document.elementFromPoint(t.clientX, t.clientY);
      var j = el ? el.closest('.day[data-date]') : null;
      return j && !j.classList.contains('out-month') ? j : null;
    }

    function surligner() {
      var a = debut <= fin ? debut : fin, b = debut <= fin ? fin : debut;
      Array.prototype.forEach.call(document.querySelectorAll('.day[data-date]'), function (d) {
        var dans = d.dataset.date >= a && d.dataset.date <= b;
        d.classList.toggle('selecting', dans && d.dataset.date !== a && d.dataset.date !== b);
        d.classList.toggle('sel-anchor', d.dataset.date === a || d.dataset.date === b);
      });
    }

    function nettoyer() {
      Array.prototype.forEach.call(document.querySelectorAll('.day'), function (d) {
        d.classList.remove('selecting', 'sel-anchor');
      });
    }

    document.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      var t = e.touches[0];
      if (t.target && t.target.closest && t.target.closest('.vb,.event,.span-ev,.fab,.modalbg')) return;
      var jour = jourSous(t);
      if (!jour) return;
      depart = { x: t.clientX, y: t.clientY };
      minuteur = setTimeout(function () {
        minuteur = null;
        actif = true;
        debut = fin = jour.dataset.date;
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) {} }
        surligner();
      }, ATTENTE_DOIGT);
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (minuteur) {
        var t0 = e.touches[0];
        if (depart && (Math.abs(t0.clientX - depart.x) > 8 || Math.abs(t0.clientY - depart.y) > 8)) {
          clearTimeout(minuteur); minuteur = null;
        }
        return;
      }
      if (!actif) return;
      if (e.cancelable) e.preventDefault();      /* la page ne défile plus */
      var j = jourSous(e.touches[0]);
      if (j) { fin = j.dataset.date; surligner(); }
    }, { passive: false });

    document.addEventListener('touchend', function () {
      if (minuteur) { clearTimeout(minuteur); minuteur = null; }
      if (!actif) return;
      actif = false;
      nettoyer();
      var a = debut <= fin ? debut : fin, b = debut <= fin ? fin : debut;
      if (typeof window.openModal === 'function') {
        window.openModal();
        var d1 = document.getElementById('dateStart'), d2 = document.getElementById('dateEnd');
        if (d1) d1.value = a;
        if (d2) d2.value = b;
        if (d2) d2.dispatchEvent(new Event('change', { bubbles: true }));
      }
      debut = fin = null;
    });
  }

  function agenda() {
    var calendrier = document.querySelector('.calendar');
    var ancienne = document.querySelector('.vp-agenda');
    if (ancienne) ancienne.remove();

    if (!calendrier) return;
    if (window.innerWidth > LARGEUR_LISTE || window.page !== 'planning' || window.calView !== 'month') {
      calendrier.style.display = '';
      return;
    }
    calendrier.style.display = 'none';

    /* Sur le mois en cours, la liste commence à aujourd'hui : ce qu'on
       veut voir en ouvrant le planning, c'est le week-end qui arrive, pas
       les locations du début du mois qui sont déjà passées. Sur un autre
       mois — quand on navigue avec ‹ et › — le mois entier s'affiche. */
    var mois = moisDe(window.cur instanceof Date ? window.cur : new Date());
    var aujourdhui = isoDuJour();
    var moisCourant = mois === aujourdhui.slice(0, 7);
    var depuis = moisCourant ? aujourdhui : mois + '-01';

    var duMois = (window.R || []).filter(function (r) {
      if (!r || r._deleted||enSuivi(r) || !r.dateStart) return false;
      var fin = r.dateEnd && r.dateEnd > r.dateStart ? r.dateEnd : r.dateStart;
      if (fin < depuis) return false;                       /* déjà terminée */
      return r.dateStart <= mois + '-31';                   /* commence dans ce mois ou avant */
    }).sort(function (a, b) {
      /* même règle que sur le calendrier : un jour donné, les
         réservations se suivent par catégorie de matériel */
      if (a.dateStart !== b.dateStart) return a.dateStart < b.dateStart ? -1 : 1;
      return rangFamille(a) - rangFamille(b);
    });

    var bloc = document.createElement('div');
    bloc.className = 'vp-agenda';

    if (!duMois.length) {
      bloc.innerHTML = '<div class="vp-vide">' +
        (moisCourant ? 'Plus rien de prévu d\'ici la fin du mois.' : 'Aucune réservation ce mois-ci.') +
        '</div>';
      calendrier.parentNode.insertBefore(bloc, calendrier);
      return;
    }

    var jour = null, html = '';
    duMois.forEach(function (r) {
      if (r.dateStart !== jour) {
        jour = r.dateStart;
        html += '<div class="vp-jour">' + echapper(jourLong(jour)) + '</div>';
      }
      html += ligne(r);
    });
    bloc.innerHTML = html;
    calendrier.parentNode.insertBefore(bloc, calendrier);

    bloc.addEventListener('click', function (e) {
      var l = e.target.closest('.vp-resa');
      if (l && typeof window.openDetail === 'function') window.openDetail(l.dataset.id);
    });
  }

  /* formulaire de nouvelle réservation, à une date donnée */
  function nouvelleResa(jour) {
    if (typeof window.openModal !== 'function') return;
    window.openModal();
    var d1 = document.getElementById('dateStart'), d2 = document.getElementById('dateEnd');
    if (d1) d1.value = jour;
    if (d2) d2.value = jour;
    if (d2) d2.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function jourLong(iso) {
    var d = new Date(iso + 'T12:00:00');
    var opts = { weekday: 'long', day: 'numeric', month: 'long' };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    var t = d.toLocaleDateString('fr-FR', opts);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function ligne(r) {
    var couleurs = typeof window.getCatColorsForRes === 'function'
      ? window.getCatColorsForRes(r) : ['#888'];
    var materiel = (r.products || []).map(function (p) { return p.short || p.name; })
      .filter(Boolean).join(' · ') || 'Matériel à compléter';
    var total = typeof window.calcResTotal === 'function' ? window.calcResTotal(r) : 0;
    var bg = couleurs[0] || '#FFFFFF';
    var fg = typeof window.getColorText === 'function' ? window.getColorText(bg) : '#1f2430';
    var border = bg;
    var suite = (r.dateEnd && r.dateEnd !== r.dateStart)
      ? '<span class="vp-suite-j">jusqu\'au ' + echapper(jourLong(r.dateEnd)) + '</span>' : '';

    return '<button type="button" class="vp-resa" data-id="' + echapper(r.id) + '" style="background:'+bg+';border-color:'+border+';color:'+fg+'">' +
      '<span class="vp-barre">' + couleurs.map(function (c) {
        return '<span style="background:' + c + '"></span>';
      }).join('') + '</span>' +
      '<span class="vp-txt">' +
        '<span class="vp-nom" style="color:inherit">' + echapper(r.client || 'Client') + '</span>' +
        (materiel ? '<span class="vp-mat" style="color:inherit;opacity:.78">' + echapper(materiel) + '</span>' : '') +
        (suite ? '<span class="vp-suite-j" style="color:inherit;opacity:.75">'+echapper(jourLong(r.dateEnd))+'</span>' : '') +
      '</span>' +
      (total > 0 ? '<span class="vp-prix">' + total.toLocaleString('fr-FR') + ' €</span>' : '') +
      '</button>';
  }

  /* ══ 3. Fenêtres : toute la place de l'écran ══════════════
     La page de gestion est affichée dans un cadre à l'intérieur du
     back-office. Une fenêtre (fiche de réservation, formulaire…) se
     centre sur ce cadre, et non sur l'écran : dès que la page est un
     peu défilée, le haut ou le bas de la fiche se retrouve hors de
     l'écran — surtout sur téléphone, où le cadre est plus haut que ce
     qu'on voit.

     Le back-office est donc prévenu de l'ouverture d'une fenêtre : il
     amène alors le cadre exactement sur l'écran visible, et le remet
     en place à la fermeture. */
  function signalerFenetres() {
    if (window.parent === window) return;

    var ouvertes = 0;
    function etat() {
      var n = document.querySelectorAll('.modalbg.open').length;
      if (n === ouvertes) return;
      ouvertes = n;
      try {
        window.parent.postMessage({ type: 'vespra-fenetre', ouverte: n > 0 }, location.origin);
      } catch (e) {}
    }

    var observateur = new MutationObserver(etat);
    Array.prototype.forEach.call(document.querySelectorAll('.modalbg'), function (el) {
      observateur.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
    /* certaines fenêtres sont ajoutées après coup */
    new MutationObserver(function (m) {
      m.forEach(function (x) {
        Array.prototype.forEach.call(x.addedNodes, function (n) {
          if (n.nodeType === 1 && n.classList && n.classList.contains('modalbg')) {
            observateur.observe(n, { attributes: true, attributeFilter: ['class'] });
          }
        });
      });
      etat();
    }).observe(document.body, { childList: true });
    etat();
  }

  /* ══ branchement sur les fonctions de l'outil ═════════════ */

  function brancher() {
    styles();
    signalerFenetres();
    selectionAuDoigt();
    champEuros();

    if (typeof window.openDetail === 'function' && !window.openDetail._vp) {
      var ouvrir = window.openDetail;
      var nouveau = function (id) {
        ouvrir.apply(this, arguments);
        var grille = document.getElementById('detailContent');
        if (grille) grille.classList.remove('vp-ouvert');
        reorganiser();
      };
      nouveau._vp = true;
      window.openDetail = nouveau;
    }

    if (typeof window.planning === 'function' && !window.planning._vp) {
      var dessiner = window.planning;
      var nouveau2 = function () {
        var res = dessiner.apply(this, arguments);
        legende();
        agenda();
        barres();
        return res;
      };
      nouveau2._vp = true;
      window.planning = nouveau2;
      /* la vue déjà affichée reçoit sa légende sans attendre un changement de mois */
      legende();
      agenda();
      barres();
      /* passage téléphone ↔ ordinateur : on repasse d'une présentation à l'autre */
      var attente = null;
      window.addEventListener('resize', function () {
        clearTimeout(attente);
        attente = setTimeout(function () { agenda(); barres(); }, 150);
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', brancher);
  else brancher();
})();
