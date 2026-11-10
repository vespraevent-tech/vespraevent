/* ─────────────────────────────────────────────────────────────
   MONTAGE ET DÉMONTAGE — tarifs internes

   À ne pas confondre avec la livraison et l'installation :
     • livraison / installation = le déplacement du camion et la pose
       du matériel. C'est facturé à part, au kilomètre, pour couvrir le
       temps et le carburant. Ce montant est saisi à la main sur la
       réservation.
     • montage / démontage = le travail de structure sur place, qui ne
       concerne que les barnums, la tente étoile et la buvette. Sur le
       site, l'option s'affiche « sur devis » : aucun prix n'y est
       annoncé. C'est ici qu'elle est chiffrée.

   NOTE : aucun prix n'est plus appliqué. L'installation et le montage se
   chiffrent sur devis, avec le client : seul le montant saisi sur la fiche
   compte. Les lignes ci-dessous ne servent qu'à repérer les structures.

   Ces tarifs n'apparaissent que dans le back-office. Ils s'ajoutent
   au total d'une demande lorsque deux conditions sont réunies :
     1. le client a coché « Installation et démontage » sur le produit ;
     2. la demande est passée en « Validée ».
   Chaque ligne peut être retirée à la main sur la fiche : le retrait
   est enregistré et le total est recalculé.

   Pour changer un tarif, modifiez la valeur « prix » ci-dessous :
   rien d'autre n'est à toucher.
   ───────────────────────────────────────────────────────────── */
(function () {

  /* Les quatre seules familles concernées : barnums, tente étoile,
     buvette et boîte de nuit gonflable. Tout le reste se pose sans
     montage de structure, c'est compris dans la livraison. */
  /* Deux familles, deux intitulés, deux réalités :

       montage   une structure à monter puis à démonter sur place —
                 barnums, tente de réception, buvette, boîte de nuit
                 gonflable. La livraison est comprise dans ce travail.

       lancement les feux d'artifice de jour : il n'y a rien à monter,
                 mais quelqu'un installe les canons et les déclenche au
                 bon moment. Le montant se chiffre au cas par cas.

     Tout le reste — sono, photobooth, lumières, mobilier — ne relève
     d'aucune des deux : il n'y a que la livraison, saisie à la main sur
     la réservation. Aucune ligne de montage n'apparaît pour ces
     produits, pas même à zéro euro. */
  var FAMILLES = {
    montage:   'Montage et démontage',
    lancement: 'Lancement par nos soins',
  };

  var TARIFS = [
    /* famille   produit         formule (motif)  clé               libellé affiché                                    prix */
    { famille: 'montage',   produit: 'barnum',        formule: '3×3',  cle: 'barnum-3x3',  nom: 'Montage et démontage — barnum 3×3 m',            prix: 0, aChiffrer: true },
    { famille: 'montage',   produit: 'barnum',        formule: '4×8',  cle: 'barnum-4x8',  nom: 'Montage et démontage — barnum 4×8 m',            prix: 0, aChiffrer: true },
    { famille: 'montage',   produit: 'barnum',        formule: '6×10', cle: 'barnum-6x10', nom: 'Montage et démontage — barnum 6×10 m',           prix: 0, aChiffrer: true },
    { famille: 'montage',   produit: 'tente',         formule: '',     cle: 'tente-etoile', nom: 'Montage et démontage — tente étoile',           prix: 0, aChiffrer: true },
    { famille: 'montage',   produit: 'buvette',       formule: '',     cle: 'buvette',      nom: 'Montage et démontage — buvette',                prix: 0, aChiffrer: true },
    { famille: 'montage',   produit: 'boite de nuit', formule: '',     cle: 'boite-nuit',   nom: 'Montage et démontage — boîte de nuit gonflable', prix: 0, aChiffrer: true },
    /* à chiffrer : le montant dépend du nombre de canons et du lieu */
    { famille: 'lancement', produit: 'feux d\'artifice', formule: '', cle: 'feux-lancement',
      nom: 'Lancement par nos soins — feux d\'artifice de jour', prix: 0, aChiffrer: true },
  ];

  /* « 3x3 », « 3×3 m », « 3 × 3 » : on compare sans accents, sans
     espaces et avec un seul signe de multiplication. */
  function normaliser(x) {
    return String(x || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[×x*]/g, 'x')
      .replace(/\s+/g, '');
  }

  /* Le panier du site n'écrit pas toujours la formule et les options au
     même endroit : selon la fiche produit, « 4×8 m » et « installation &
     démontage » arrivent tantôt dans la formule, tantôt collés dans le
     libellé des options. On lit donc la ligne entière, une fois
     normalisée, plutôt que de se fier à un seul champ. */
  function texteLigne(item) {
    var opts = item.options;
    if (Array.isArray(opts)) opts = opts.join(' ');
    return normaliser([item.nom, item.formule, opts].filter(Boolean).join(' '));
  }

  /* « installation et démontage », « installation & démontage »,
     « montage/démontage » : la même option selon les pages. */
  function porteOptionMontage(item) {
    var t = typeof item === 'string' || Array.isArray(item)
      ? normaliser(Array.isArray(item) ? item.join(' ') : item)
      : texteLigne(item);
    /* « installation et démontage », « montage/démontage » pour les
       structures ; « installation et lancement » pour les feux. */
    var seul = Array.isArray(item && item.options) && item.options.some(function (o) {
      var x = normaliser(o); return x === 'montage' || x === 'demontage';
    });
    return /(installation|montage)(et|&|\+|\/)?demontage/.test(t)
        || /(^|[^a-z])(de)?montage\(surdevis\)/.test(t)
        || seul
        || /installation(et|&|\+|\/)?lancement/.test(t)
        || /lancementparnossoins/.test(t);
  }

  function tarifPour(item) {
    var t = texteLigne(item);
    for (var i = 0; i < TARIFS.length; i++) {
      var tarif = TARIFS[i];
      if (t.indexOf(normaliser(tarif.produit)) === -1) continue;
      if (tarif.formule && t.indexOf(normaliser(tarif.formule)) === -1) continue;
      return tarif;
    }
    return null;
  }

  /* Toutes les structures concernées présentes dans la demande, que le
     client ait coché l'option ou non. Chaque ligne dit son état :
       coche    le client a coché « Installation et démontage » sur le site
       retiree  coché, mais retiré à la main dans le back-office
       ajoutee  non coché, mais ajouté à la main dans le back-office
       compte   la ligne entre dans le total
     Une structure louée sans avoir coché la case apparaît donc quand
     même, avec son tarif prêt à être appliqué d'un clic.
     items    : le matériel déjà relu (nom, formule, options)
     retirees : clés retirées à la main · ajoutees : clés ajoutées à la main */
  window.VESPRA_MONTAGE_LIGNES = function (items, retirees, ajoutees) {
    var hors = {}, plus = {};
    (retirees || []).forEach(function (c) { hors[c] = true; });
    (ajoutees || []).forEach(function (c) { plus[c] = true; });
    var vues = {}, lignes = [];
    (items || []).forEach(function (it) {
      var t = tarifPour(it);
      if (!t) return;                         /* pas une structure à monter */
      var coche = porteOptionMontage(it);
      if (vues[t.cle]) {                      /* une seule ligne par structure */
        if (coche) vues[t.cle].coche = true;
        return;
      }
      var l = {
        cle: t.cle, nom: t.nom, prix: t.prix,
        famille: t.famille, titre: FAMILLES[t.famille] || FAMILLES.montage,
        aChiffrer: !!t.aChiffrer,
        coche: coche, retiree: !!hors[t.cle], ajoutee: !!plus[t.cle],
      };
      vues[t.cle] = l;
      lignes.push(l);
    });
    lignes.forEach(function (l) {
      l.compte = l.ajoutee || (l.coche && !l.retiree);
    });
    return lignes;
  };

  /* Ce que le montage ajoute au total. Rien tant que la demande n'est
     pas validée : avant, le chiffrage n'est pas arrêté. */
  window.VESPRA_MONTAGE_TOTAL = function (items, retirees, statut, ajoutees) {
    if (statut !== 'validee') return 0;
    return window.VESPRA_MONTAGE_LIGNES(items, retirees, ajoutees)
      .reduce(function (s, l) { return s + (l.compte ? l.prix : 0); }, 0);
  };

  /* Ce que le travail sur place devrait coûter, d'après le matériel
     loué — que le client ait coché l'option ou non, et sans attendre
     que la demande soit validée. C'est ce montant qui est proposé
     d'avance sur la fiche et sur le devis : une tente étoile, ce sont
     250 €, il n'y a pas de raison de le retaper à chaque fois.

     Les lignes « à chiffrer » (le lancement des feux d'artifice) valent
     zéro : leur montant dépend du lieu et de l'heure, c'est à vous de
     le poser. */
  window.VESPRA_MONTAGE_SUGGERE = function (items) {
    return window.VESPRA_MONTAGE_LIGNES(items, [], [])
      .reduce(function (s, l) { return s + (l.aChiffrer ? 0 : (Number(l.prix) || 0)); }, 0);
  };

  window.VESPRA_MONTAGE_TARIFS = TARIFS;
  window.VESPRA_MONTAGE_FAMILLES = FAMILLES;
})();
