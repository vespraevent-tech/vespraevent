/* ─────────────────────────────────────────────────────────────
   Reprise du planning tenu sous Excel.

   Les réservations de 2026, 2027 et 2028 étaient jusqu'ici notées dans
   un classeur. Elles sont reprises ici telles quelles : même client,
   même date, même matériel, même montant, même lieu de livraison.

   La reprise se fait toute seule à la première ouverture du back-office :
   il n'y a rien à cliquer. Elle n'a lieu qu'une fois, et chaque
   réservation reprise porte un identifiant tiré de son nom et de sa date,
   si bien qu'une ligne déjà présente n'est jamais ajoutée deux fois — et
   qu'une réservation supprimée à la main ne revient pas. Les réservations
   saisies dans le back-office ne sont jamais touchées. Si la reprise
   échoue (serveur injoignable), un bandeau propose de réessayer.

   Deux locations manquaient au catalogue du planning : le vidéoprojecteur
   (ajouté à la sonorisation, comme sur le site) et le livre d'or audio
   (dans une nouvelle catégorie « Animation »). La shampouineuse, retirée
   du catalogue, n'est pas reprise.

   La feuille « Tarifs » du classeur n'est pas reprise : elle ne
   contient pas de réservations.
   ───────────────────────────────────────────────────────────── */
(function () {
  /* les noms et téléphones des clients ne sont servis qu'au back-office connecté */
  var FICHIER = '/api/admin/historique-reservations';
  var LIBELLE = 'Mettre à jour via Excel';
  var PREFIXE = 'xls-';

  /* Le vidéoprojecteur rejoint la sonorisation, comme sur le site
     (catégorie « Son et vidéo »). Le livre d'or audio est une animation :
     le planning n'avait pas cette catégorie, elle est ajoutée. */
  var CAT_ANIMATION = { id: 'animation', label: 'Animation', color: '#2F7F73' };
  var PRODUITS_MANQUANTS = [
    { name: 'Vidéoprojecteur', cat: 'sono', price: 10, variants: ['Seul', 'Avec écran'], short: 'Vidéoproj.' },
    { name: "Livre d'or audio", cat: 'animation', price: 35, variants: ['Standard'], short: "Livre d'or" },
  ];

  /* ── catalogue : catégorie et produits manquants ────────────── */
  function completerCatalogue() {
    try {
      var cats = typeof window.getCats === 'function' ? window.getCats() : [];
      if (!cats.some(function (c) { return c.id === CAT_ANIMATION.id; })) {
        cats.push({ id: CAT_ANIMATION.id, label: CAT_ANIMATION.label, color: CAT_ANIMATION.color });
        localStorage.setItem('vespraCats', JSON.stringify(cats));
      }
      var prods = typeof window.getProds === 'function' ? window.getProds() : [];
      var ajout = false;
      PRODUITS_MANQUANTS.forEach(function (p) {
        if (!prods.some(function (x) { return x.name === p.name; })) { prods.push(p); ajout = true; }
      });
      if (ajout) localStorage.setItem('vespraProds', JSON.stringify(prods));
    } catch (e) {}
  }

  /* ── application d'une liste de réservations au planning ──────
     - au premier passage : tout est ajouté ;
     - en mise à jour : les lignes nouvelles sont ajoutées, celles déjà
       reprises sont réalignées sur le fichier (dates, matériel, montants),
       et celles qui ont disparu du fichier sont retirées du planning —
       mais uniquement pour les années présentes dans le fichier fourni.
     Les réservations saisies à la main dans le planning ne portent pas
     l'identifiant du fichier : elles ne sont jamais touchées. */
  function appliquer(liste, majuscule, annees) {
    completerCatalogue();

    var R = window.R || [];
    var parId = {};
    R.forEach(function (r) { if (r && r.id) parId[String(r.id)] = r; });

    var ajoutees = 0, majs = 0, retirees = 0;
    var duFichier = {};
    liste.forEach(function (r) {
      if (!r || !r.id) return;
      duFichier[r.id] = true;
      var existante = parId[r.id];
      if (!existante) {
        delete r.garderPrix;
        R.push(r);
        parId[r.id] = r;
        ajoutees++;
        return;
      }
      if (!majuscule) return;
      /* le fichier fait foi pour ce qu'il contient ; le suivi ajouté
         dans le back-office (état, notes) reste en place.
         Si le classeur n'indiquait pas de montant pour cette ligne
         (formule non recalculée), le prix déjà au planning est gardé :
         on ne réinvente jamais un prix. */
      var avant = JSON.stringify([existante.dateStart, existante.dateEnd,
        existante.products, existante.livraisonPrice, existante.livraison, existante.place]);
      existante.client = r.client;
      existante.phone = r.phone || existante.phone;
      existante.dateStart = r.dateStart;
      existante.dateEnd = r.dateEnd;
      if (!r.garderPrix) existante.products = r.products;
      existante.livraison = r.livraison;
      if (!r.garderPrix) existante.livraisonPrice = r.livraisonPrice;
      if (r.place) existante.place = r.place;
      var apres = JSON.stringify([existante.dateStart, existante.dateEnd,
        existante.products, existante.livraisonPrice, existante.livraison, existante.place]);
      if (avant !== apres) majs++;
    });

    /* lignes effacées du classeur : on ne retire que celles des années
       que le classeur fourni contient réellement */
    if (majuscule && annees && annees.length) {
      R = R.filter(function (r) {
        if (!r || String(r.id).indexOf(PREFIXE) !== 0) return true;
        if (duFichier[r.id]) return true;
        var an = String(r.dateStart || '').slice(0, 4);
        if (annees.indexOf(an) === -1) return true;
        retirees++;
        return false;
      });
    }

    window.R = R;
    /* l'enregistrement dans le navigateur déclenche l'envoi au
       serveur, réservation par réservation : rien de plus à faire */
    localStorage.setItem('vespraR', JSON.stringify(R));
    if (typeof window.fbPutCfg === 'function') window.fbPutCfg();

    return { ajoutees: ajoutees, majs: majs, retirees: retirees };
  }

  /* Bilan de la dernière mise à jour. Le planning se redessine après
     l'import, et le bouton affiché est alors un nouveau : le bilan est
     donc retenu ici quelques secondes, et réaffiché à chaque fois que le
     bouton est recréé. Sans cela, le message disparaissait aussitôt. */
  var bilanTexte = '';
  var bilanJusqua = 0;

  /* phrase de bilan affichée sur le bouton */
  function resume(bilan) {
    var morceaux = [];
    if (bilan.ajoutees) morceaux.push(bilan.ajoutees + ' ajoutée' + (bilan.ajoutees > 1 ? 's' : ''));
    if (bilan.majs) morceaux.push(bilan.majs + ' mise' + (bilan.majs > 1 ? 's' : '') + ' à jour');
    if (bilan.retirees) morceaux.push(bilan.retirees + ' retirée' + (bilan.retirees > 1 ? 's' : ''));
    return morceaux.length ? morceaux.join(', ') : 'Planning déjà à jour';
  }

  /* Reprise initiale, depuis le fichier livré avec le site. */
  function importer(bouton) {
    if (bouton) {
      bouton.disabled = true;
      bouton.textContent = 'Reprise en cours…';
    }

    return fetch(FICHIER, { credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (liste) {
        if (!Array.isArray(liste)) throw new Error('fichier');
        var bilan = appliquer(liste, false, null);
        if (bouton) bouton.textContent = resume(bilan);

        setTimeout(function () {
          var b = document.querySelector('.vi-bandeau');
          if (b) b.remove();
          if (typeof window.nav === 'function') window.nav();
        }, bouton ? 1400 : 0);
        return bilan.ajoutees;
      })
      .catch(function () {
        if (bouton) {
          bouton.disabled = false;
          bouton.textContent = 'Reprise impossible — réessayer';
        }
        return -1;   /* échec : le bandeau proposera de réessayer */
      });
  }

  /* mise à disposition de la mise à jour par fichier Excel */
  window.VESPRA_PLANNING_APPLIQUER = function (liste, annees) {
    return appliquer(liste, true, annees);
  };
  window.VESPRA_PLANNING_RESUME = resume;

  /* ── reprise automatique ─────────────────────────────────────
     Rien à cliquer : à la première ouverture du back-office, le planning
     Excel est repris tout seul. Le bandeau n'apparaît qu'en cas d'échec
     (fichier inaccessible, serveur injoignable), pour pouvoir réessayer.

     La reprise n'a lieu qu'une fois : ensuite, le planning porte déjà les
     réservations reprises, et elle ne se redéclenche pas. Une réservation
     supprimée à la main ne revient donc pas. */
  var CLE_FAIT = 'vespraImportExcel';
  var tentee = false;

  function reprendreSeul() {
    if (tentee) return;
    /* on attend que le planning soit chargé depuis le serveur, sans quoi
       on importerait par-dessus une liste encore vide */
    if (!Array.isArray(window.R)) return;
    tentee = true;

    var deja = window.R.some(function (r) { return r && String(r.id).indexOf(PREFIXE) === 0; });
    try { if (deja || localStorage.getItem(CLE_FAIT)) { marquer(); return; } } catch (e) {}

    importer(null).then(function (n) {
      if (!(n >= 0)) return;
      marquer();
      if (typeof window.nav === 'function') window.nav();
    });
  }

  function marquer() {
    try { localStorage.setItem(CLE_FAIT, '1'); } catch (e) {}
  }

  /* ── bandeau, en dernier recours ─────────────────────────────── */
  function bandeau() {
    var page = document.querySelector('main .page');
    if (!page || document.querySelector('.vi-bandeau')) return;
    if (window.page !== 'planning') return;

    var deja = (window.R || []).some(function (r) {
      return r && String(r.id).indexOf(PREFIXE) === 0;
    });

    /* Le fichier a déjà été repris : on propose de le reprendre à nouveau,
       pour récupérer les lignes ajoutées ou les montants corrigés depuis.
       Le bouton est discret, à droite du titre de la page. */
    if (deja) { boutonMiseAJour(page); return; }
    try { if (localStorage.getItem(CLE_FAIT)) { boutonMiseAJour(page); return; } } catch (e) {}
    if (!tentee) return;

    var bloc = document.createElement('div');
    bloc.className = 'vi-bandeau';
    bloc.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;' +
      'margin:0 0 16px;padding:13px 16px;background:#fff;border:1px solid #eee8dc;' +
      'border-left:3px solid #C9A24B;border-radius:12px';
    bloc.innerHTML = '<span style="font:600 13.5px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#4a4a44;flex:1;min-width:200px">' +
      'Les réservations 2026, 2027 et 2028 du fichier Excel peuvent être reprises dans le planning.</span>';

    var bt = document.createElement('button');
    bt.type = 'button';
    bt.textContent = 'Reprendre le planning Excel';
    bt.style.cssText = 'background:#1e3650;color:#fff;border:none;border-radius:999px;' +
      'padding:9px 18px;font:600 13px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;cursor:pointer';
    bt.addEventListener('click', function () { importer(bt); });
    bloc.appendChild(bt);

    page.insertBefore(bloc, page.firstChild);
  }

  /* Bouton « Mettre à jour via Excel », une fois la reprise faite.
     Il ouvre le sélecteur de fichier : vous choisissez votre classeur
     « Planning location.xlsx » tel qu'il est sur votre ordinateur, et le
     planning comme la liste des réservations se mettent à jour. Le fichier
     est lu dans le navigateur, il n'est envoyé nulle part. */
  function boutonMiseAJour(page) {
    /* bouton retiré à la demande : la mise à jour par Excel n'est plus utilisée */
    var ancien = document.querySelector('.vi-maj'); if (ancien) ancien.remove();
    return;
    if (window.page !== 'planning' || document.querySelector('.vi-maj')) return;
    var titre = page.querySelector('.pt');
    if (!titre) return;

    var champ = document.createElement('input');
    champ.type = 'file';
    champ.accept = '.xlsx';
    champ.style.display = 'none';

    var bt = document.createElement('button');
    bt.type = 'button';
    bt.className = 'vi-maj';
    bt.textContent = Date.now() < bilanJusqua ? bilanTexte : LIBELLE;
    bt.title = "Choisissez votre fichier Planning location.xlsx : les lignes nouvelles sont ajoutées, les montants et dates modifiés sont repris, et les lignes effacées du classeur sont retirées. Les réservations saisies à la main dans le planning ne sont pas touchées.";
    bt.style.cssText = 'float:right;margin-top:2px;background:#fff;border:1px solid #dcd5c8;' +
      'border-radius:999px;padding:6px 14px;font:600 12px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#4a4a44;cursor:pointer';
    bt.addEventListener('click', function () { champ.click(); });

    champ.addEventListener('change', function () {
      var f = champ.files && champ.files[0];
      champ.value = '';
      if (!f) return;
      if (typeof window.VESPRA_LIRE_EXCEL !== 'function') {
        bt.textContent = 'Lecture du fichier indisponible';
        return;
      }
      bt.disabled = true;
      bt.textContent = 'Lecture du fichier…';
      window.VESPRA_LIRE_EXCEL(f)
        .then(function (lu) {
          var bilan = appliquer(lu.reservations, true, lu.annees);
          bilanTexte = resume(bilan);
          bilanJusqua = Date.now() + 6000;
          if (typeof window.nav === 'function') window.nav();
          var frais = document.querySelector('.vi-maj') || bt;
          frais.disabled = false;
          frais.textContent = bilanTexte;
          setTimeout(function () {
            bilanJusqua = 0;
            var b = document.querySelector('.vi-maj');
            if (b) { b.disabled = false; b.textContent = LIBELLE; }
          }, 6000);
        })
        .catch(function (e) {
          bt.disabled = false;
          bt.textContent = e && e.message ? e.message : 'Fichier illisible';
          setTimeout(function () { bt.textContent = LIBELLE; }, 5000);
        });
    });

    titre.appendChild(bt);
    titre.appendChild(champ);
  }

  function brancher() {
    /* le pont charge les réservations du serveur puis appelle nav() :
       c'est le moment où l'on sait ce que contient déjà le planning */
    if (typeof window.nav === 'function' && !window.nav._vi) {
      var naviguer = window.nav;
      var nouveau = function () {
        var res = naviguer.apply(this, arguments);
        reprendreSeul();
        setTimeout(bandeau, 0);
        return res;
      };
      nouveau._vi = true;
      window.nav = nouveau;
    }
    bandeau();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', brancher);
  else brancher();
})();
