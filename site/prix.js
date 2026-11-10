/* ─────────────────────────────────────────────────────────────
   Application des prix modifiés depuis le back-office (/studio).

   Les prix restent écrits en dur dans les pages : c'est ce que voit
   un visiteur si ce script ne s'exécute pas, et c'est ce que lisent
   les moteurs de recherche. Ce script ne fait que remplacer ceux que
   vous avez modifiés depuis l'admin, sur la fiche produit comme dans
   le catalogue, pour que le prix affiché et le prix ajouté au devis
   soient toujours les mêmes.

   Nécessite prix-registre.js chargé avant lui.
   ───────────────────────────────────────────────────────────── */
(function () {
  var REGISTRE = window.VESPRA_PRIX_REGISTRE;
  if (!REGISTRE || !REGISTRE.length) return;

  /* nom de fichier de la page courante, y compris en URL « propre »
     (/produit-sonorisation → produit-sonorisation.html) */
  var page = (location.pathname.split('/').pop() || 'index.html');
  if (page.indexOf('.') === -1) page += '.html';

  /* une entrée du registre vaut pour sa page, et pour les autres pages de la
     même famille quand elle en liste (« pgs ») : les trois tailles de
     barnum ou de tente étoile partagent les mêmes prix */
  function surPage(e) {
    return e.pg === page || (e.pgs && e.pgs.indexOf(page) !== -1);
  }

  var nombre = function (v) {
    var n = parseFloat(String(v).replace(',', '.').replace(/[^\d.]/g, ''));
    return isFinite(n) && n > 0 ? n : null;
  };

  /* le back-office charge ce fichier pour ses fonctions utilitaires, sans
     le chargeur de données : il n'y a alors rien à appliquer */
  if (typeof window.VESPRA_DONNEES !== 'function') return;

  window.VESPRA_DONNEES('produits')
    .then(function (items) {
      if (!Array.isArray(items)) return;
      var prix = {}, fiches = {}, nouveaux = [];
      items.forEach(function (it) {
        if (!it || !it.id) return;
        if (it.type === 'prix') {
          var v = nombre(it.prix);
          if (v) prix[it.id] = v;
        } else if (it.type === 'produit') {
          fiches[it.id] = it;
        } else {
          nouveaux.push(it);
        }
      });
      if (window.PRODUCTS && Array.isArray(window.PRODUCTS)) appliquerCatalogue(prix, fiches, nouveaux);
      else { appliquerFiche(prix); appliquerFicheInfos(fiches); }
      appliquerMentions(prix);
    })
    .catch(function () { /* silencieux : les prix d'origine restent affichés */ });

  /* ── fiche produit : boutons de variante + prix principal ── */
  /* ── Options d'une fiche produit ──────────────────────────────────
     Les options (sacs de lestage, caisson de basse, maïs…) ont leur prix
     écrit à trois endroits : l'étiquette « + 45 € » à côté de la case,
     le calcul du prix affiché, et le montant ajouté au devis. Le tarif
     modifié depuis le back-office est publié ici, dans un point unique
     que la page consulte à chaque calcul.
     ─────────────────────────────────────────────────────────────────── */
  var PRIX_OPTIONS = {};
  window.VESPRA_OPT = function (champ, defaut) {
    var v = PRIX_OPTIONS[champ];
    return (v === undefined || v === null) ? defaut : v;
  };

  function appliquerOptions(prix) {
    var options = REGISTRE.filter(function (e) { return surPage(e) && e.opt; });
    if (!options.length) return;
    var change = false;

    options.forEach(function (e) {
      var np = prix[e.i];
      if (!np || !e.champ) return;
      PRIX_OPTIONS[e.champ] = np;
      change = true;

      /* l'étiquette de prix est le dernier élément de l'intitulé */
      var case_ = document.getElementById(e.champ);
      var label = case_ && case_.closest('label');
      var etiquette = label && label.lastElementChild;
      if (etiquette && /€|Inclus/.test(etiquette.textContent)) {
        etiquette.textContent = '+\u00a0' + np + '\u00a0€';
      }
    });

    /* on redemande à la page de recalculer, pour que le prix affiché et le
       montant du devis tiennent compte du nouveau tarif */
    if (change) {
      ['majPrixSono', 'updateInstallOption', 'updatePhotoboothOptions', 'majPrix', 'majOptions'].forEach(function (f) {
        if (typeof window[f] === 'function') { try { window[f](); } catch (err) {} }
      });
    }
  }

  function appliquerFiche(prix) {
    appliquerOptions(prix);
    var entrees = REGISTRE.filter(function (e) { return surPage(e) && !e.opt; });
    if (!entrees.length) return;
    var btns = document.querySelectorAll('.prod-vbtn');
    var touche = false;

    entrees.forEach(function (e) {
      var np = prix[e.i];
      if (!np) return;

      if (e.vi >= 0) {
        var b = btns[e.vi];
        if (!b) return;
        var el = b.querySelector('.prod-vbtn-price');
        if (el) el.textContent = np + ' €';
        if (b.hasAttribute('data-price')) b.setAttribute('data-price', np);
        var oc = b.getAttribute('onclick');
        if (oc) {
          /* remplace le prix passé à selectVariant(this,'…',PRIX…) pour que
             le montant ajouté au devis suive le montant affiché */
          b.setAttribute('onclick', oc.replace(/(selectVariant\(this,\s*'(?:[^']*)'\s*,\s*)\d+(?:\.\d+)?/, '$1' + np));
        }
        touche = true;
      } else {
        majPrixPrincipal(np);
        touche = true;
      }
    });

    /* le prix principal reflète la variante sélectionnée à l'ouverture */
    if (touche && btns.length) {
      var actif = document.querySelector('.prod-vbtn.active') || btns[0];
      var t = actif && actif.querySelector('.prod-vbtn-price');
      var v = t && nombre(t.textContent);
      if (v) majPrixPrincipal(v);
    }
  }

  /* image, description et libellés de variante modifiés depuis l'admin */
  function appliquerFicheInfos(fiches) {
    var entree = REGISTRE.filter(function (e) { return surPage(e) && !e.opt; })[0];
    if (!entree) return;
    /* le produit de cette page : plusieurs produits peuvent partager un prix */
    var idFiche = entree.ci;
    (window.VESPRA_PRODUITS || []).forEach(function (pr) { if (pr.page === page) idFiche = pr.id; });
    var f = fiches[idFiche];
    if (!f) return;

    /* titre modifié depuis l'admin */
    if (f.titre) {
      var h1 = document.querySelector('h1.prod-title');
      if (h1) h1.textContent = String(f.titre).replace(/\\(['"])/g, '$1');
    }

    if (f.image) {
      var img = document.getElementById('prodMainImg');
      if (img) { img.src = f.image; img.removeAttribute('srcset'); }
    }

    /* galerie : la liste de photos choisie dans le back-office remplace celle de la page */
    if (f.photos) {
      try {
        var ph = JSON.parse(f.photos);
        if (Array.isArray(ph) && ph.length && typeof PG_IMGS !== 'undefined' && Array.isArray(PG_IMGS)) {
          /* les boutons de variante de la page (taille, formule…) affichent leur
             photo d'origine : avec une galerie modifiée dans le back-office, ils
             montraient l'ancienne photo. On retient la liste d'origine pour que
             chaque bouton montre la photo de même rang dans la nouvelle liste. */
          var origine = PG_IMGS.map(function (x) { return x && x.s; });
          if (typeof window.selectVariant === 'function' && !window.__vespraVarGalerie) {
            window.__vespraVarGalerie = true;
            var selOrig = window.selectVariant;
            window.selectVariant = function (btn, label, price, imgV) {
              var r = selOrig.apply(this, arguments);
              try {
                var k = -1;
                if (imgV) origine.forEach(function (s, i) { if (k < 0 && s && String(imgV).slice(-s.length) === s) k = i; });
                if (k >= 0 && PG_IMGS[k]) {
                  if (typeof pgShow === 'function') pgShow(k);
                  if (typeof _selectedVariant !== 'undefined' && _selectedVariant) _selectedVariant.img = PG_IMGS[k].s;
                }
              } catch (e3) {}
              return r;
            };
          }
          PG_IMGS.splice.apply(PG_IMGS, [0, PG_IMGS.length].concat(ph.filter(function (x) { return x && x.s; }).map(function (x) { return { s: x.s, a: x.a || 'Photo du produit' }; })));
          var vign = document.getElementById('prodThumbs');
          if (vign) vign.innerHTML = '';
          if (typeof window.pgThumbs === 'function' || typeof pgThumbs === 'function') { try { pgThumbs(); } catch (e1) {} }
          var princ = document.getElementById('prodMainImg');
          if (princ) { princ.removeAttribute('srcset'); princ.src = PG_IMGS[0].s; princ.alt = PG_IMGS[0].a + ' — Location Vespra Event'; }
          if (typeof pgShow === 'function') { try { pgShow(0); } catch (e2) {} }
          try { if (typeof _selectedVariant !== 'undefined' && _selectedVariant && origine[0] && _selectedVariant.img === origine[0]) _selectedVariant.img = PG_IMGS[0].s; } catch (e4) {}
        }
      } catch (e) { /* liste illisible : les photos d'origine restent */ }
    }

    /* petits textes sous les variantes */
    if (f.varsub) {
      var sousTextes = String(f.varsub).replace(/\\(['"])/g, '$1').split('|');
      var bv = document.querySelectorAll('.prod-vbtn');
      sousTextes.forEach(function (t, i) {
        t = t.trim();
        var sp = bv[i] && bv[i].querySelector('.prod-vbtn-sub');
        if (t && sp) sp.textContent = t;
      });
    }

    /* nom et texte des options */
    if (f.optlib) {
      try {
        var lib = JSON.parse(f.optlib);
        Object.keys(lib).forEach(function (champ) {
          var cb = document.getElementById(champ);
          var lab = cb && cb.closest('label');
          if (!lab) return;
          var fort = lab.querySelector('strong');
          if (lib[champ].nom && fort) fort.textContent = lib[champ].nom;
          if (lib[champ].desc != null) {
            var sp = fort && fort.parentNode && fort.parentNode.querySelector('br + span');
            if (sp) sp.textContent = lib[champ].desc;
          }
        });
      } catch (e) {}
    }
    if (f.variantes) {
      var labels = String(f.variantes).replace(/\\(['"])/g, '$1').split('|');
      var btns = document.querySelectorAll('.prod-vbtn');
      labels.forEach(function (lab, i) {
        lab = lab.trim();
        var b = btns[i];
        if (!lab || !b) return;
        var n = b.querySelector('.prod-vbtn-name');
        if (n) n.textContent = lab;
        var oc = b.getAttribute('onclick');
        if (oc) b.setAttribute('onclick', oc.replace(/(selectVariant\(this,\s*')(?:[^']*)(')/, '$1' + lab.replace(/'/g, '') + '$2'));
      });
    }
  }

  function majPrixPrincipal(v) {
    var disp = document.getElementById('prodPriceDisplay');
    if (!disp) return;
    /* publié pour les fiches qui recalculent leur total avec des options :
       elles doivent repartir du prix corrigé, pas de celui écrit en dur */
    window.VESPRA_PRIX_BASE = v;
    var small = disp.querySelector('small');
    disp.innerHTML = v + ' €' + (small ? ' ' + small.outerHTML : '');
    corrigerDevis(v);
    /* si des options sont cochées, la fiche réaffiche son total */
    if (typeof window.majOptions === 'function') { try { window.majOptions(); } catch (err) {} }
  }

  /* Les fiches à prix unique écrivent le montant en dur dans leur
     fonction d'ajout au devis. Plutôt que de modifier chaque fiche, on
     intercepte l'ajout : si la ligne vient de cette fiche, elle repart
     avec le prix affiché. Les options cochées, elles, sont déjà
     comptées par la page et on ne touche qu'à l'écart. */
  var prixAffiche = null;
  function corrigerDevis(v) {
    var ancien = null;
    var e = REGISTRE.filter(function (x) { return surPage(x) && x.vi === -1 && !x.opt; })[0];
    if (!e) return;
    ancien = e.p;
    prixAffiche = v;
    if (window.__vespraPrixIntercepte) return;
    window.__vespraPrixIntercepte = true;
    var vrai = window.addToCart;
    if (typeof vrai !== 'function') return;
    window.addToCart = function (item) {
      if (item && prixAffiche && typeof item.price === 'number' && ancien) {
        /* on décale du même montant : un supplément d'option reste compté */
        item.price = item.price - ancien + prixAffiche;
      }
      return vrai.apply(this, arguments);
    };
  }

  /* ── prix cités dans le texte des pages ──────────────────────────────
     Articles, pages de villes, FAQ, paragraphes des fiches : « le Pack
     Vespra va de 70 € à 150 € ». Chaque mention a été repérée à l'avance
     avec le texte qui la précède, ce qui permet de ne remplacer que le bon
     montant. Un montant dont le contexte ne correspond plus exactement
     n'est pas touché : mieux vaut un prix non mis à jour qu'un prix faux
     au mauvais endroit. */
  function normTexte(t) {
    /* même normalisation que celle qui a servi à établir le registre :
       accents décomposés puis tout caractère non ASCII retiré (tirets
       cadratins, symbole €…), minuscules, espaces réduits */
    return String(t).normalize('NFD').replace(/[^\x00-\x7F]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function appliquerMentions(prix) {
    var toutes = window.VESPRA_MENTIONS;
    if (!toutes) return;
    var entree = null;
    for (var i = 0; i < toutes.length; i++) if (toutes[i].pg === page) { entree = toutes[i]; break; }
    if (!entree) return;

    var aFaire = entree.m.filter(function (m) { return prix[m.id] && prix[m.id] !== m.v; });
    if (!aFaire.length) return;

    /* noeuds texte de la page, hors zones déjà gérées plus haut */
    var IGNORE = '.prod-vbtn, #prodPriceDisplay, .prod-price, .vm-info, #vmSelect, script, style';
    var noeuds = [];
    var it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = it.nextNode())) {
      if (!n.nodeValue || n.nodeValue.indexOf('\u20AC') === -1) continue;
      if (n.parentElement && n.parentElement.closest && n.parentElement.closest(IGNORE)) continue;
      noeuds.push(n);
    }

    /* Deux passes : on repère d'abord TOUS les emplacements, puis on
       remplace. Sinon un montant déjà remplacé modifierait le texte qui
       sert à reconnaître le suivant. */
    var cibles = [];
    aFaire.forEach(function (m) {
      var motif = new RegExp('(^|[^\\d])' + m.v + '(\\s|\u00a0)*\u20AC');
      var trouves = [];
      noeuds.forEach(function (nd) {
        var t = nd.nodeValue;
        var res = motif.exec(t);
        if (!res) return;
        var pos = res.index + res[1].length;
        var avant = normTexte(t.slice(Math.max(0, pos - 34), pos)).slice(-24);
        if (avant !== m.s) return;
        trouves.push({ noeud: nd, pos: pos, longueur: res[0].length - res[1].length, prix: prix[m.id] });
      });
      /* un seul emplacement possible, sinon on s'abstient */
      if (trouves.length === 1) cibles.push(trouves[0]);
    });

    /* de la fin vers le début dans chaque nœud, pour que les positions
       déjà calculées restent valables */
    cibles.sort(function (a, b) { return b.pos - a.pos; });
    cibles.forEach(function (c) {
      var val = c.noeud.nodeValue;
      var morceau = val.slice(c.pos, c.pos + c.longueur).replace(/^\d+/, String(c.prix));
      c.noeud.nodeValue = val.slice(0, c.pos) + morceau + val.slice(c.pos + c.longueur);
    });
  }

  /* ── catalogue : tableau PRODUCTS (cartes, fenêtre produit, devis) ── */
  function appliquerCatalogue(prix, fiches, nouveaux) {
    var P = window.PRODUCTS;
    if (!P) return;
    var modifies = {};

    /* fiches modifiées : image, description, libellés de variante */
    Object.keys(fiches).forEach(function (id) {
      var f = fiches[id], prod = null;
      for (var k = 0; k < P.length; k++) if (P[k].id === id) { prod = P[k]; break; }
      if (!prod) return;
      if (f.image) prod.img = f.image;
      if (f.description) prod.desc = f.description;
      if (f.titre) prod.name = String(f.titre).replace(/\\(['"])/g, '$1');
      if (f.variantes && prod.variants) {
        String(f.variantes).replace(/\\(['"])/g, '$1').split('|').forEach(function (lab, i) {
          lab = lab.trim();
          if (lab && prod.variants[i]) prod.variants[i].label = lab;
        });
      }
    });

    REGISTRE.forEach(function (e) {
      var np = prix[e.i];
      if (!np) return;
      /* la même taille peut figurer dans plusieurs produits (« cx ») */
      [[e.ci, e.cvi]].concat(e.cx || []).forEach(function (cible) {
        var prod = null;
        for (var k = 0; k < P.length; k++) if (P[k].id === cible[0]) { prod = P[k]; break; }
        if (!prod) return;
        if (cible[1] >= 0 && prod.variants && prod.variants[cible[1]]) {
          prod.variants[cible[1]].price = np;
          modifies[prod.id] = true;
        } else {
          prod.price = np;
        }
      });
    });

    /* « à partir de » sur la carte = variante la moins chère, recalculé
       uniquement pour les produits dont un prix a été modifié */
    P.forEach(function (prod) {
      if (!modifies[prod.id] || !prod.variants || !prod.variants.length) return;
      /* un produit qui a sa propre taille (« vdef ») affiche le prix de cette taille */
      prod.price = (typeof prod.vdef === 'number' && prod.variants[prod.vdef])
        ? prod.variants[prod.vdef].price
        : Math.min.apply(null, prod.variants.map(function (v) { return v.price; }));
    });

    /* produits entièrement nouveaux, créés depuis l'admin */
    var connus = {};
    P.forEach(function (p) { connus[p.id] = true; });
    nouveaux.forEach(function (it) {
      if (!it.nom || connus['admin-' + it.id]) return;
      P.push({
        id: 'admin-' + it.id,
        cat: it.categorie || 'Autre',
        name: it.nom,
        price: nombre(it.prix) || 0,
        desc: it.description || '',
        img: it.image || '',
        page: null,
      });
    });

    if (typeof applyFilters === 'function') applyFilters();
    else if (typeof renderGrid === 'function') renderGrid(P);
    /* la page d'accueil écoute ce signal pour mettre ses cartes à jour */
    try { window.dispatchEvent(new CustomEvent('vespra-produits-ready')); } catch (e) { /* sans effet */ }
  }
})();
