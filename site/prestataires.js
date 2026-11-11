/* ─────────────────────────────────────────────────────────────
   LES PRESTATAIRES QUE VESPRA EVENT RECOMMANDE

   C'est ce fichier, et lui seul, qu'il faut modifier pour ajouter,
   retirer ou corriger un prestataire. La page nos-prestataires.html
   se construit toute seule à partir de cette liste.

   Un prestataire, ici, c'est une entreprise dont le métier n'est pas
   le nôtre : brasseur, traiteur, location de vaisselle, photographe,
   fleuriste… Nous n'avons aucun
   accord commercial avec eux. Ce sont des gens que nous croisons sur
   les événements et dont le travail nous a paru sérieux.

   Pour ajouter un prestataire, copiez un bloc et remplissez-le :

     {
       metier  : "Traiteur",     // la famille, telle qu'elle s'affichera
       nom     : "",             // le nom exact de l'entreprise
       type    : "",             // précision courte : « Brasserie artisanale »
       commune : "",             // la commune
       mot     : "",             // une phrase à vous : pourquoi vous le recommandez
       site    : "",             // https://... ou "" s'ils n'ont pas de site
       tel     : "",             // facultatif
       exemple : false           // laissez false pour une vraie entreprise
     },

   Les entrées marquées exemple:true porteraient un bandeau « EXEMPLE »
   sur le site. Il n'y en a plus : la liste ne contient que de vraies
   entreprises.
   ───────────────────────────────────────────────────────────── */

window.VESPRA_PRESTATAIRES = [

  /* ——— Bar et cave : bière, vin, spiritueux ——— */
  /* rang: 5000 = affiché en premier dans sa famille */
  {
    metier: "Bar & cave", nom: "3B Bar", type: "Réception, bar et cave",
    commune: "Vitré",
    mot: "Possibilité d'acheter des boissons (bière, vin…) et de louer des tireuses à bière pour votre événement.",
    site: "https://www.instagram.com/3b_bar_craftbeer/", tel: "", exemple: false, rang: 5000
  },
  {
    metier: "Bar & cave", nom: "V and B Vitré", type: "Cave et bar",
    commune: "Vitré",
    mot: "Cave et bar à Vitré : bières, vins et spiritueux, avec la possibilité de commander en volume pour une réception.",
    site: "https://www.vandb.fr/v-and-b-vitre.html", tel: "", exemple: false
  },

  /* ——— Service ——— */
  {
    metier: "Serveuse privée", nom: "Candice", type: "Service lors de votre événement",
    commune: "Vitré",
    mot: "Candice vous accompagne pour le service lors de votre événement : présentation, service et mise en place.",
    site: "", tel: "", lien: "/prestations.html#serveuse", exemple: false
  },

  /* ——— Pâtisserie ——— */
  {
    metier: "Pâtisserie & wedding cake", nom: "Emmanuel", type: "Chef pâtissier, création sur mesure",
    commune: "Vitré",
    mot: "Emmanuel crée sur mesure : gâteaux, desserts, mignardises pour tous vos événements. Un rendez-vous dégustation peut être organisé.",
    site: "", tel: "", lien: "/prestations.html#patissier", exemple: false
  },

  /* ——— Vaisselle, tables, chaises ——— */
  {
    metier: "Location de vaisselle", nom: "Passion Réception", type: "Vaisselle, mobilier et décoration",
    commune: "Vitré",
    mot: "Vaisselle, tables, chaises, nappage et décoration, au 173 boulevard de Laval. Une seule route pour tout récupérer.",
    site: "https://passionreception.fr/", tel: "02 99 74 22 91", exemple: false
  },

  /* ——— Repas ———
     La même maison que ci-dessus : elle apparaît dans deux familles
     parce qu'elle fait deux métiers. C'est voulu. */
  {
    metier: "Traiteur", nom: "Passion Réception", type: "Gigot bitume",
    commune: "Vitré",
    mot: "Le gigot bitume, ce repas de fin de chantier où la viande cuit selon le procédé d'origine. C'est leur spécialité, surtout demandée par les entreprises.",
    site: "https://passionreception.fr/organisateur-de-gigot-bitume-repas-de-fin-de-chantier/",
    tel: "02 99 74 22 91", exemple: false
  }

];

/* Ordre d'affichage des familles de métier. Une famille absente de
   cette liste s'affiche quand même, à la fin, par ordre alphabétique. */
window.VESPRA_PRESTATAIRES_ORDRE = [
  "Pâtisserie & wedding cake", "Serveuse privée", "Bar & cave", "Location de vaisselle", "Traiteur",
  "Food truck", "Photographe", "Vidéaste", "DJ & animation musicale", "Fleuriste",
  "Décoration & scénographie", "Coiffure & maquillage",
  "Transport & navette", "Wedding planner", "Autre"
];

/* ─────────────────────────────────────────────────────────────
   Ce qui suit est de la mécanique : rien à modifier ici.

   Les prestataires peuvent venir de deux endroits : ce fichier, et le
   back-office. VESPRA_PRESTATAIRES_CHARGER() rend la liste complète,
   les plus récents d'abord.
   ───────────────────────────────────────────────────────────── */
(function () {
  function slug(x) {
    return String(x || '').toLowerCase().normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  window.VESPRA_PRESTATAIRE_SLUG = slug;

  function normaliser(v, rang) {
    var s = {};
    for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) s[k] = v[k];
    s.metier = s.metier || 'Autre';
    /* ancien nom de la famille, encore présent dans d'anciennes fiches du back-office */
    if (s.metier === 'Brasseur & boissons') s.metier = 'Bar & cave';
    s.cle = s.cle || slug(s.metier);
    /* plus le rang est grand, plus l'entrée est récente */
    s.rang = typeof s.rang === 'number' ? s.rang : rang;
    return s;
  }

  var promesse = null;
  window.VESPRA_PRESTATAIRES_CHARGER = function () {
    if (promesse) return promesse;

    var fixes = (window.VESPRA_PRESTATAIRES || []).map(function (v, i) {
      return normaliser(v, i);
    });

    /* le back-office l'emporte : un prestataire qui y porte le même
       identifiant remplace celui écrit dans ce fichier */
    var duBo = new Promise(function (resoudre) {
      var fait = false;
      function finir(liste) { if (!fait) { fait = true; resoudre(liste || []); } }
      /* délai de garde : au-delà, on se contente du fichier */
      setTimeout(function () { finir([]); }, 2500);
      if (typeof window.VESPRA_DONNEES !== 'function') { finir([]); return; }
      try {
        window.VESPRA_DONNEES('prestataires').then(finir, function () { finir([]); });
      } catch (e) { finir([]); }
    });

    promesse = duBo.then(function (liste) {
      var tout = fixes.slice();
      /* ceinture et bretelles : si la réponse n'est pas une liste,
         on garde simplement ce que le fichier contient */
      (Array.isArray(liste) ? liste : []).forEach(function (v) {
        if (!v || !v.nom) return;
        var s = normaliser(v, 1000 + (Number(v.ordre) || 0));
        var i = -1;
        for (var k = 0; k < tout.length; k++) {
          if (v.id && tout[k].id === v.id) { i = k; break; }
        }
        if (i >= 0) tout[i] = s; else tout.push(s);
      });
      return tout.sort(function (a, b) { return b.rang - a.rang; });
    });
    return promesse;
  };
})();
