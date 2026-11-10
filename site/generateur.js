/* ─────────────────────────────────────────────────────────────
   GÉNÉRATEUR DE FICHE PRODUIT

   Le back-office pose des questions courtes et précises ; ce
   fichier en fait une fiche rédigée : description sous le prix,
   points forts, texte long, questions fréquentes, données Google.

   Le principe est volontairement bête et sûr : le texte est
   assemblé à partir de ce qui a été saisi, jamais inventé. Si une
   information n'a pas été donnée, la phrase correspondante ne
   sort pas. Aucune caractéristique technique n'apparaît sans que
   quelqu'un l'ait écrite.

   Les règles de la maison sont appliquées ici, une fois pour
   toutes : on écrit « grand Ouest » et jamais le nom de la
   région, on loue et on ne vend pas, on ne se présente ni comme
   agence événementielle ni comme organisateur.

   Utilisation :
     var fiche = VESPRA_GENERER(reponses);
   ───────────────────────────────────────────────────────────── */
(function () {

  var VILLE = 'Vitré';
  var CP = '35500';
  var AUTOUR = 'Fougères, La Guerche-de-Bretagne, Rennes, Laval et Châteaubriant';

  /* ── petits outils de langue ─────────────────────────────── */

  function propre(t) {
    return String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  }
  function sansPoint(t) {
    return propre(t).replace(/[.;,]+$/, '');
  }
  function phrase(t) {
    t = sansPoint(t);
    if (!t) return '';
    return t.charAt(0).toUpperCase() + t.slice(1) + '.';
  }
  function minuscule(t) {
    t = sansPoint(t);
    return t ? t.charAt(0).toLowerCase() + t.slice(1) : '';
  }
  /* « a, b et c » plutôt que « a, b, c » */
  function liste(tab, lien) {
    tab = (tab || []).map(sansPoint).filter(Boolean);
    if (!tab.length) return '';
    if (tab.length === 1) return tab[0];
    return tab.slice(0, -1).join(', ') + ' ' + (lien || 'et') + ' ' + tab[tab.length - 1];
  }

  /* « mariage » → « un mariage », sans doubler un article déjà écrit */
  function avecArticle(o) {
    return /^(un |une |des |le |la |les |l’|l')/.test(o) ? o : 'un ' + o;
  }
  function slug(t) {
    return propre(t).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  /* ── les règles de la maison ─────────────────────────────── */

  var INTERDITS = [
    /* le nom de la région, mais jamais à l'intérieur d'un nom de
       commune comme La Guerche-de-Bretagne */
    { motif: /(?<![-\u2011])\bbretagne\b/gi, remplacement: 'grand Ouest',
      note: 'la région a été remplacée par « grand Ouest »' },
    { motif: /\bagence [ée]v[ée]nementielle\b/gi, remplacement: 'loueur de matériel',
      note: '« agence événementielle » n’est pas ce que vous êtes' },
    { motif: /\borganisateur (?:de soir[ée]es?|d[’']?[ée]v[ée]nements?)\b/gi, remplacement: 'loueur de matériel',
      note: '« organisateur » a été retiré' },
    { motif: /\b(?:vente|acheter|achat|à vendre)\b/gi, remplacement: 'location',
      note: 'le site ne vend pas, il loue' },
  ];

  function nettoyer(t, alertes) {
    var out = String(t || '');
    INTERDITS.forEach(function (r) {
      if (r.motif.test(out)) {
        if (alertes && alertes.indexOf(r.note) === -1) alertes.push(r.note);
        out = out.replace(r.motif, r.remplacement);
      }
      r.motif.lastIndex = 0;
    });
    return out;
  }

  /* ── la génération ───────────────────────────────────────── */

  /* reponses attendues :
       nom            « Canons à confettis »
       categorie      « Animation »
       enUneLigne     « des tubes qui envoient des confettis en l'air »
       inclus         ['2 tubes', 'les confettis', 'la télécommande']
       occasions      ['mariage', 'anniversaire', 'gender reveal']
       bonASavoir     ['intérieur et extérieur', 'aucune autorisation']
       aSurveiller    ['prévoir un coup de balai']
       prix           49
       config         [ … briques du configurateur … ]
       livraison      true
  */
  window.VESPRA_GENERER = function (r) {
    r = r || {};
    var alertes = [];
    var nom = propre(r.nom);
    var ligne = minuscule(r.enUneLigne);
    var inclus = (r.inclus || []).map(sansPoint).filter(Boolean);
    var occasions = (r.occasions || []).map(minuscule).filter(Boolean);
    var savoir = (r.bonASavoir || []).map(sansPoint).filter(Boolean);
    var veiller = (r.aSurveiller || []).map(sansPoint).filter(Boolean);
    var prix = Number(r.prix) || 0;

    /* ——— la description courte, sous le prix ——— */
    var courte = ligne ? phrase(nom + ' : ' + ligne) : phrase(nom);
    if (occasions.length) {
      courte += ' Pour ' + liste(occasions.map(avecArticle), 'ou') + '.';
    }

    /* ——— les points forts ——— */
    var points = [];
    inclus.forEach(function (x) { points.push(x.charAt(0).toUpperCase() + x.slice(1)); });
    savoir.forEach(function (x) { points.push(x.charAt(0).toUpperCase() + x.slice(1)); });
    if (prix) points.push('Location : ' + prix + ' € l\'événement');
    if (r.livraison !== false) points.push('Livraison sur ' + VILLE + ' et alentours selon votre adresse');

    /* ——— le texte long ——— */
    var sections = [];

    if (ligne) {
      sections.push({
        titre: 'Ce que vous louez',
        paragraphes: [
          phrase('Concrètement, ' + ligne),
          inclus.length
            ? 'La location comprend ' + liste(inclus.map(minuscule)) + '.'
            : '',
        ].filter(Boolean),
      });
    }

    if (occasions.length) {
      sections.push({
        titre: 'Pour quelles occasions',
        paragraphes: [
          'On le sort surtout pour ' + liste(occasions.map(avecArticle), 'ou') + '. Le matériel est le même dans tous les cas : c’est le moment où vous le sortez qui change.',
        ],
      });
    }

    if (savoir.length || veiller.length) {
      var p = [];
      if (savoir.length) p.push('Bon à savoir : ' + liste(savoir.map(minuscule)) + '.');
      if (veiller.length) p.push('À prévoir : ' + liste(veiller.map(minuscule)) + '.');
      sections.push({ titre: 'En pratique', paragraphes: p });
    }

    if (r.livraison !== false) {
      sections.push({
        titre: 'Location à ' + VILLE + ' et alentours',
        paragraphes: [
          'Vespra Event est basé à <strong>' + VILLE + ' (' + CP + ')</strong> et intervient dans le secteur, ' +
          'notamment vers ' + AUTOUR + ' selon les conditions de livraison. ' +
          'Indiquez votre date et votre adresse dans votre demande de devis pour connaître la disponibilité ' +
          'et le tarif de déplacement.',
        ],
      });
    }

    /* ——— les questions fréquentes ——— */
    var faq = [];
    if (prix) {
      faq.push({
        q: 'Combien coûte la location ?',
        r: prixEnClair(r),
      });
    }
    if (inclus.length) {
      faq.push({
        q: 'Qu’est-ce qui est compris ?',
        r: 'La location comprend ' + liste(inclus.map(minuscule)) + '.',
      });
    }
    if (occasions.length) {
      faq.push({
        q: 'Est-ce adapté à mon événement ?',
        r: 'C’est prévu pour ' + liste(occasions.map(avecArticle), 'ou') + ', sous réserve d’un lieu et d’une installation adaptés.',
      });
    }
    if (veiller.length) {
      faq.push({
        q: 'Y a-t-il des précautions à prendre ?',
        r: 'Oui : ' + liste(veiller.map(minuscule)) + '.',
      });
    }
    faq.push({
      q: 'Livrez-vous à ' + VILLE + ' et alentours ?',
      r: 'Oui, Vespra Event est basé à ' + VILLE + '. Le tarif de déplacement dépend de votre adresse en dehors de ' + VILLE + '.',
    });

    /* ——— référencement ——— */
    var seo = {
      titre: 'Location de ' + minuscule(nom) + ' à ' + VILLE + ' | Vespra Event',
      description: coupe(sansPoint(courte.replace(/<[^>]+>/g, '')) +
        (prix ? ' — à partir de ' + prix + ' € l\'événement.' : '.'), 158),
    };

    var fiche = {
      id: slug(r.id || nom),
      nom: nom,
      cat: propre(r.categorie) || 'Animations',
      prix: prix,
      descCourte: courte,
      points: points,
      sections: sections,
      faq: faq,
      seo: seo,
      config: Array.isArray(r.config) ? r.config : [],
      img: propre(r.img),
      images: r.images || [],
      statut: 'brouillon',
    };

    /* les règles de la maison s'appliquent à tout ce qui est rédigé */
    fiche.descCourte = nettoyer(fiche.descCourte, alertes);
    fiche.points = fiche.points.map(function (x) { return nettoyer(x, alertes); });
    fiche.sections = fiche.sections.map(function (s) {
      return { titre: nettoyer(s.titre, alertes),
               paragraphes: s.paragraphes.map(function (p) { return nettoyer(p, alertes); }) };
    });
    fiche.faq = fiche.faq.map(function (f) {
      return { q: nettoyer(f.q, alertes), r: nettoyer(f.r, alertes) };
    });
    fiche.seo.titre = nettoyer(fiche.seo.titre, alertes);
    fiche.seo.description = nettoyer(fiche.seo.description, alertes);
    fiche.alertes = alertes;

    return fiche;
  };

  function coupe(t, n) {
    t = propre(t);
    if (t.length <= n) return t;
    var court = t.slice(0, n);
    var point = court.lastIndexOf('. ');
    if (point > n * 0.5) return court.slice(0, point + 1);
    return court.replace(/\s+\S*$/, '') + '…';
  }

  /* la phrase de prix suit le configurateur : une formule unique,
     plusieurs formules, ou un supplément par option */
  function prixEnClair(r) {
    var blocs = Array.isArray(r.config) ? r.config : [];
    var f = null;
    blocs.forEach(function (b) { if (b.type === 'formules' && !f) f = b; });
    if (f && (f.choix || []).length > 1) {
      var bouts = f.choix.map(function (c) {
        return sansPoint(c.label) + ' ' + (c.devis ? 'sur devis' : (Number(c.prix) || 0) + ' €');
      });
      return 'Cela dépend de la formule : ' + bouts.join(', ') + ', le week-end.';
    }
    return 'La location est de ' + (Number(r.prix) || 0) + ' € l\'événement.';
  }

  window.VESPRA_SLUG = slug;
  window.VESPRA_REGLES_MAISON = INTERDITS;
})();
