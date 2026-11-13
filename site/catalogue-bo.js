/* ─────────────────────────────────────────────────────────────
   PRODUITS CRÉÉS DEPUIS LE BACK-OFFICE

   Les vingt produits historiques sont écrits dans les pages. Ceux
   que vous créez depuis le back-office arrivent par l'API du site
   et viennent s'ajouter à la suite, sur le catalogue comme sur la
   page d'accueil, sans qu'aucun fichier n'ait à être modifié.

   Si l'API ne répond pas, la page reste celle d'avant : les
   produits historiques s'affichent normalement.
   ───────────────────────────────────────────────────────────── */
(function () {

  function enFicheCatalogue(p) {
    return {
      id: p.id,
      cat: p.cat || 'Animations',
      cats: Array.isArray(p.cats) && p.cats.length ? p.cats : [p.cat || 'Animations'],
      name: p.nom,
      price: Number(p.prix) || 0,
      desc: String(p.descCourte || '').replace(/<[^>]+>/g, ''),
      img: (function(u){return window.VESPRA_IMG?window.VESPRA_IMG(u,900):u;})(p.img || (Array.isArray(p.images) ? p.images[0] : '') || ''),
      page: '/' + p.id,
      /* le choix se fait sur la fiche : l'ajout rapide y renvoie */
      surFiche: true,
    };
  }

  function ajouter(liste, produits) {
    var vus = {};
    liste.forEach(function (x) { vus[x.id] = true; });
    produits.forEach(function (p) {
      if (!p || !p.id || vus[p.id]) return;
      liste.push(enFicheCatalogue(p));
    });
  }

  function poser(produits) {
    if (!produits || !produits.length) return;

    /* page catalogue */
    if (typeof window.PRODUCTS !== 'undefined' && typeof window.renderGrid === 'function') {
      ajouter(window.PRODUCTS, produits);
      if (Array.isArray(window.PRODUCTS_ORDERED)) ajouter(window.PRODUCTS_ORDERED, produits);
      try { window.renderGrid(window.PRODUCTS.filter(Boolean)); } catch (e) { /* la page reste en l'état */ }
      return;
    }

    /* page d'accueil : la grille des meilleures ventes est figée,
       on se contente d'alimenter la liste pour le panier et les liens */
    if (typeof window.PRODUCTS !== 'undefined') {
      ajouter(window.PRODUCTS, produits);
      /* les « Meilleures locations » peuvent contenir un de ces produits : on les relit */
      try { window.dispatchEvent(new Event('vespra-produits-ready')); } catch (e) {}
    }
  }

  function charger() {
    if (!window.fetch) return;
    /* même appel que le reste de la page (donnees.js) : l'ordre arrive
       en même temps que les photos, avant que la page ne s'affiche */
    var source = (typeof window.VESPRA_DONNEES === 'function')
      ? window.VESPRA_DONNEES('catalogue').then(function (c) { return { catalogue: c }; })
      : fetch('/api/site', { credentials: 'same-origin', cache: 'no-store', headers: { 'cache-control': 'no-cache' } })
          .then(function (r) { return r.ok ? r.json() : null; });
    source
      .then(function (d) { if (d && Array.isArray(d.catalogue) && d.catalogue.length) poser(d.catalogue); })
      .catch(function () { /* silencieux : la page fonctionne sans */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', charger);
  else charger();
})();
