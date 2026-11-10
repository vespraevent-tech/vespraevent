/* ─────────────────────────────────────────────────────────────
   Produits complémentaires : deux cartes sur téléphone, trois sur
   tablette, quatre sur grand écran.

   Chaque fiche produit propose deux produits complémentaires choisis à
   la main : c'est le bon nombre sur téléphone, où les cartes s'affichent
   deux par ligne. Sur un écran large, la même ligne peut en accueillir
   quatre sans rien serrer. Les emplacements manquants sont donc complétés
   ici, en priorité par des produits de la même catégorie.

   Les quatre cartes sont toujours présentes dans la page : c'est la
   feuille de style qui n'en montre que 2, 3 ou 4 selon la largeur de
   l'écran, afin qu'elles tiennent toujours sur une seule ligne.

   Les deux cartes d'origine ne sont jamais touchées : les nouvelles sont
   fabriquées en recopiant l'une d'elles, et héritent ainsi exactement de
   la même présentation.

   Nécessite prix-registre.js (window.VESPRA_PRODUITS) chargé avant lui.
   ───────────────────────────────────────────────────────────── */
(function () {
  function demarrer() {
    var grille = document.querySelector('.related-grid');
    var produits = window.VESPRA_PRODUITS;
    if (!grille || !produits || !produits.length) return;

    var cartes = grille.querySelectorAll('.rel-card');
    if (!cartes.length || cartes.length >= 4) return;

    /* page courante et produits déjà proposés : à ne pas reproposer */
    var page = (location.pathname.split('/').pop() || 'index.html');
    if (page.indexOf('.') === -1) page += '.html';
    var deja = {};
    deja[page] = true;
    Array.prototype.forEach.call(cartes, function (c) {
      deja[(c.getAttribute('href') || '').split('/').pop()] = true;
    });

    var actuel = null;
    for (var i = 0; i < produits.length; i++) {
      if (produits[i].page === page) { actuel = produits[i]; break; }
    }

    /* d'abord la même catégorie, puis le reste, dans l'ordre du catalogue */
    var libres = produits.filter(function (p) {
      return p && p.page && !deja[p.page];
    });
    if (actuel) {
      libres.sort(function (a, b) {
        var sa = a.cat === actuel.cat ? 0 : 1;
        var sb = b.cat === actuel.cat ? 0 : 1;
        return sa - sb;
      });
    }

    var manque = 4 - cartes.length;
    var modele = cartes[cartes.length - 1];

    libres.slice(0, manque).forEach(function (p) {
      var c = modele.cloneNode(true);
      c.setAttribute('href', p.page);

      var img = c.querySelector('.rel-img');
      if (img && p.img) {
        img.setAttribute('src', p.img);
        img.setAttribute('alt', p.nom || '');
        img.removeAttribute('srcset');
      }

      texte(c, '.rel-cat', p.cat || '');
      texte(c, '.rel-title', p.nom || '');
      texte(c, '.rel-why', accroche(p));

      var prix = c.querySelector('.rel-price');
      if (prix) {
        var multi = p.variantes && p.variantes.length > 1;
        prix.innerHTML = (multi ? '<span class="rel-from">À partir de</span>' : '') +
                         (p.prix != null ? p.prix + ' €' : 'Sur devis');
      }

      grille.appendChild(c);
    });

    function texte(racine, sel, val) {
      var el = racine.querySelector(sel);
      if (el) el.textContent = val;
    }

    /* une ligne courte tirée de la description du produit */
    function accroche(p) {
      var d = String(p.desc || '').trim();
      if (!d) return 'À découvrir dans le catalogue';
      var pt = d.indexOf('.');
      if (pt > 20) d = d.slice(0, pt);
      if (d.length > 58) d = d.slice(0, 55).replace(/\s+\S*$/, '') + '…';
      return d;
    }
  }

  /* ── choix fait depuis le back-office ─────────────────────────────
     Sur chaque produit, le back-office peut désigner les produits à
     proposer ici (jusqu'à quatre, dans l'ordre voulu). Ils passent en
     premier ; s'il en manque, le site complète comme avant. Les prix,
     photos et descriptions corrigés dans le back-office sont repris. */
  function liste(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      try { var a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; }
    }
    return [];
  }

  function appliquerBO(items) {
    var grille = document.querySelector('.related-grid');
    var produits = window.VESPRA_PRODUITS;
    if (!grille || !produits || !Array.isArray(items)) return;
    var fiches = {}, prix = {};
    items.forEach(function (it) {
      if (!it || !it.id) return;
      if (it.type === 'produit') fiches[it.id] = it;
      else if (it.type === 'prix') {
        var n = parseFloat(String(it.prix).replace(',', '.'));
        if (n > 0) prix[it.id] = n;
      }
    });

    var page = (location.pathname.split('/').pop() || 'index.html');
    if (page.indexOf('.') === -1) page += '.html';
    var actuel = null;
    produits.forEach(function (p) { if (p && p.page === page) actuel = p; });
    if (!actuel || !fiches[actuel.id]) return;
    var voulus = liste(fiches[actuel.id].complements);
    if (!voulus.length) return;

    var parId = {};
    produits.forEach(function (p) { if (p && p.page) parId[p.id] = p; });
    var choisis = [];
    voulus.forEach(function (id) {
      var p = parId[id];
      if (p && p.id !== actuel.id && choisis.indexOf(p) < 0 && choisis.length < 4) choisis.push(p);
    });
    if (!choisis.length) return;

    /* complète jusqu'à quatre, d'abord la même catégorie */
    if (choisis.length < 4) {
      var libres = produits.filter(function (p) {
        return p && p.page && p.id !== actuel.id && choisis.indexOf(p) < 0;
      });
      libres.sort(function (a, b) {
        return (a.cat === actuel.cat ? 0 : 1) - (b.cat === actuel.cat ? 0 : 1);
      });
      choisis = choisis.concat(libres.slice(0, 4 - choisis.length));
    }

    var modele = grille.querySelector('.rel-card');
    if (!modele) return;
    modele = modele.cloneNode(true);
    /* les phrases écrites à la main sur les cartes d'origine sont gardées */
    var phrases = {};
    Array.prototype.forEach.call(grille.querySelectorAll('.rel-card'), function (c) {
      var w = c.querySelector('.rel-why');
      phrases[(c.getAttribute('href') || '').split('/').pop()] = w ? w.textContent : '';
    });

    grille.innerHTML = '';
    choisis.forEach(function (p) {
      var f = fiches[p.id] || {};
      var c = modele.cloneNode(true);
      c.setAttribute('href', p.page);
      var img = c.querySelector('.rel-img');
      var src = f.image || p.img;
      if (img && src) {
        img.setAttribute('src', /^(https?:|\/)/.test(src) ? src : '/' + src);
        img.setAttribute('alt', p.nom || '');
        img.removeAttribute('srcset');
      }
      var set = function (sel, v) { var e = c.querySelector(sel); if (e) e.textContent = v; };
      set('.rel-cat', p.cat || '');
      set('.rel-title', p.nom || '');
      var d = String(f.description || p.desc || '').trim();
      var pt = d.indexOf('.');
      if (pt > 20) d = d.slice(0, pt);
      if (d.length > 58) d = d.slice(0, 55).replace(/\s+\S*$/, '') + '…';
      set('.rel-why', phrases[p.page] || d || 'À découvrir dans le catalogue');

      var vars = (p.variantes || []).map(function (v) { return prix[v.prixId] != null ? prix[v.prixId] : v.prix; });
      var tarif = vars.length ? Math.min.apply(null, vars)
        : (p.prixId && prix[p.prixId] != null ? prix[p.prixId] : p.prix);
      var pr = c.querySelector('.rel-price');
      if (pr) pr.innerHTML = (vars.length > 1 ? '<span class="rel-from">À partir de</span>' : '') +
        (tarif != null ? tarif + ' €' : 'Sur devis');
      grille.appendChild(c);
    });
  }

  function brancherBO() {
    if (typeof window.VESPRA_DONNEES !== 'function') return;
    window.VESPRA_DONNEES('produits').then(appliquerBO).catch(function () { /* la sélection d'origine reste */ });
  }

  function lancer() { demarrer(); brancherBO(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lancer);
  else lancer();
})();
