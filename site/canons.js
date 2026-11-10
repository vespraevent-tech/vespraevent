/* ─────────────────────────────────────────────────────────────
   FEUX D'ARTIFICE DE JOUR (CANONS À POUDRE)

   Un canon = un tir. Le client choisit d'abord une
   formule (le nombre de canons), puis répartit ses couleurs dans
   ce nombre de canons. Une même couleur peut être reprise autant
   de fois qu'il le souhaite : 12 bleus, ou 5 bleus + 3 roses +
   2 jaunes + 2 verts.

   Deux familles de couleurs :
     • standard  : comprises dans le prix de la formule
     • premium   : SUPPLEMENT_PREMIUM € de plus PAR CANON

   Le même choix en deux temps sert à deux endroits : déroulé sur
   la fiche produit, et en fenêtre pour l'ajout rapide depuis le
   catalogue et la page d'accueil.

   Pour changer un prix, une formule ou classer une couleur
   autrement, tout se règle dans les trois listes ci-dessous :
   le reste du site s'adapte tout seul.
   ───────────────────────────────────────────────────────────── */
(function () {

  /* ——— les formules ——— (nb = nombre de canons, donc de tirs) */
  var FORMULES = [
    { nb: 4,  prix: 179, mot: '4 tirs — effet dispersé' },
    { nb: 6,  prix: 249, mot: '6 tirs — plus fourni' },
    { nb: 8,  prix: 319, mot: '8 tirs — dense' },
    { nb: 12, prix: 449, mot: '12 tirs — effet maximal' },
  ];

  /* ——— les couleurs ——— */
  var SUPPLEMENT_PREMIUM = 10;          /* € par canon premium */
  var COULEURS = [
    { nom: 'Rose',   hex: '#EC4899', premium: false },
    { nom: 'Bleu',   hex: '#2563EB', premium: false },
    { nom: 'Blanc',  hex: '#FFFFFF', premium: false },
    { nom: 'Rouge',  hex: '#DC2626', premium: false },
    { nom: 'Jaune',  hex: '#FACC15', premium: true  },
    { nom: 'Orange', hex: '#F97316', premium: true  },
    { nom: 'Vert',   hex: '#16A34A', premium: true  },
    { nom: 'Violet', hex: '#7C3AED', premium: true  },
  ];

  var NOM_PRODUIT = 'Feux d\'artifice de jour';
  var IMAGE = 'canon-poudre-arc-en-ciel.webp';
  var PRIX_MINI = FORMULES[0].prix;
  var NB_MAX = FORMULES[FORMULES.length - 1].nb;

  /* ───────────── calculs ───────────── */

  function formulePour(nb) {
    for (var i = 0; i < FORMULES.length; i++) if (FORMULES[i].nb === nb) return FORMULES[i];
    return null;
  }
  function couleurPour(nom) {
    for (var i = 0; i < COULEURS.length; i++) if (COULEURS[i].nom === nom) return COULEURS[i];
    return null;
  }
  function canonsPremium(choix) {
    var n = 0;
    for (var nom in choix) {
      var c = couleurPour(nom);
      if (c && c.premium) n += (choix[nom] || 0);
    }
    return n;
  }
  function supplement(choix) { return canonsPremium(choix) * SUPPLEMENT_PREMIUM; }
  function total(nb, choix) {
    var f = formulePour(nb);
    return (f ? f.prix : 0) + supplement(choix || {});
  }
  function comptees(choix) {
    var n = 0;
    for (var nom in choix) n += (choix[nom] || 0);
    return n;
  }

  /* « 12 canons — 5 Bleu, 4 Jaune (premium), 3 Blanc » */
  function libelle(nb, choix) {
    var bouts = [];
    COULEURS.forEach(function (c) {
      var q = choix[c.nom] || 0;
      if (q) bouts.push(q + ' ' + c.nom + (c.premium ? ' (premium)' : ''));
    });
    return nb + ' canons — ' + bouts.join(', ');
  }

  function article(nb, choix) {
    var bouts = [];
    COULEURS.forEach(function (c) {
      var q = choix[c.nom] || 0;
      if (q) bouts.push(q + ' ' + c.nom + (c.premium ? ' (premium)' : ''));
    });
    return {
      id: 'p22_' + Date.now(),
      name: NOM_PRODUIT,
      label: libelle(nb, choix),
      /* séparés, pour que la demande de devis reçue par courriel
         affiche la formule d'un côté et les couleurs de l'autre */
      formule: nb + ' canons',
      detail: bouts.join(', '),
      price: total(nb, choix),
      img: IMAGE,
    };
  }

  /* ───────────── une instance du choix en deux temps ───────────── */

  function corps(enFenetre) {
    return (enFenetre
        ? '<button type="button" class="cn-fermer" aria-label="Fermer">×</button>' +
          '<div class="cn-kicker">Composez votre effet</div>' +
          '<h2 class="cn-titre">Feux d\'artifice de jour</h2>'
        : '') +
      '<div class="cn-etapes"><span class="cn-etape" data-e="1">1. La formule</span>' +
      '<span class="cn-trait"></span><span class="cn-etape" data-e="2">2. Les couleurs</span></div>' +
      '<div class="cn-fenetre"><div class="cn-piste">' +
        '<section class="cn-vue" data-e="1">' +
          '<p class="cn-sub">Un canon = un tir. Vous choisissez la couleur de chacun.</p>' +
          '<div class="cn-formules"></div>' +
          '<p class="cn-note">Tous les canons partent ensemble, ou l\'un après l\'autre si vous préférez. À 4, les jets restent séparés ; l\'effet des grandes photos, c\'est 12.</p>' +
        '</section>' +
        '<section class="cn-vue" data-e="2">' +
          '<p class="cn-sub cn-sub-2"></p>' +
          '<div class="cn-couleurs"></div>' +
          '<p class="cn-note">Une même couleur peut être reprise autant de fois que vous le voulez. Les couleurs premium coûtent ' + SUPPLEMENT_PREMIUM + ' € de plus par canon.</p>' +
          /* Poser les canons et les déclencher au bon moment est un
             travail à part, chiffré au cas par cas selon le lieu et le
             nombre de tirs. Cocher la case impose la livraison : on ne
             peut pas lancer des canons qu'on n'a pas apportés. */
          '<label class="cn-lancement"><input type="checkbox" class="cn-lanc">' +
          '<span><strong>Lancement par nos soins</strong>' +
          '<em>Nous déclenchons les canons au moment voulu et reprenons le matériel. À ajouter à la livraison et installation.</em></span>' +
          '<span class="cn-devis">Sur devis</span></label>' +
        '</section>' +
      '</div></div>' +
      '<div class="cn-bilan"><span class="cn-bilan-t">Votre effet</span><strong class="cn-bilan-p">—</strong></div>' +
      '<div class="cn-actions">' +
        '<button type="button" class="cn-retour" hidden>Retour</button>' +
        '<button type="button" class="cn-suivant">Suivant</button>' +
        '<button type="button" class="cn-ajouter" hidden>Ajouter au devis</button>' +
      '</div>';
  }

  function creer(hote, opts) {
    opts = opts || {};
    hote.innerHTML = corps(!!opts.enFenetre);

    var etat = { nb: 0, choix: {}, etape: 1 };
    var q = function (s) { return hote.querySelector(s); };

    /* les formules */
    var zf = q('.cn-formules');
    FORMULES.forEach(function (f) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cn-f';
      b.dataset.nb = f.nb;
      b.innerHTML = '<span class="cn-f-nb">' + f.nb + ' canons</span>' +
        '<span class="cn-f-mot">' + f.mot + '</span>' +
        '<span class="cn-f-prix">' + f.prix + ' €</span>';
      b.addEventListener('click', function () {
        if (etat.nb !== f.nb) etat.choix = {};
        etat.nb = f.nb;
        rendre();
      });
      zf.appendChild(b);
    });

    /* les couleurs */
    var zc = q('.cn-couleurs');
    COULEURS.forEach(function (c) {
      var l = document.createElement('div');
      l.className = 'cn-c' + (c.premium ? ' cn-c-prem' : '');
      l.innerHTML =
        '<span class="cn-pastille" style="background:' + c.hex + '"></span>' +
        '<span class="cn-c-nom">' + c.nom +
          (c.premium ? '<em>Premium +' + SUPPLEMENT_PREMIUM + ' €</em>' : '<em>Standard</em>') +
        '</span>' +
        '<span class="cn-cpt">' +
          '<button type="button" class="cn-moins" aria-label="Retirer un canon ' + c.nom + '">−</button>' +
          '<output class="cn-q">0</output>' +
          '<button type="button" class="cn-plus" aria-label="Ajouter un canon ' + c.nom + '">+</button>' +
        '</span>';
      l.querySelector('.cn-moins').addEventListener('click', function () { bouger(c.nom, -1); });
      l.querySelector('.cn-plus').addEventListener('click', function () { bouger(c.nom, 1); });
      zc.appendChild(l);
    });

    function bouger(nom, pas) {
      if (pas > 0 && comptees(etat.choix) >= etat.nb) return;
      var v = (etat.choix[nom] || 0) + pas;
      etat.choix[nom] = v < 0 ? 0 : v;
      rendre();
    }

    var lanc = q('.cn-lanc');
    if (lanc) lanc.addEventListener('click', function () { rendre(); });

    q('.cn-suivant').addEventListener('click', function () {
      if (etat.nb) { etat.etape = 2; rendre(); }
      else signaler(q('.cn-formules'));
    });
    q('.cn-retour').addEventListener('click', function () { etat.etape = 1; rendre(); });
    q('.cn-ajouter').addEventListener('click', function () {
      if (!etat.nb || comptees(etat.choix) !== etat.nb) { signaler(q(etat.nb ? '.cn-couleurs' : '.cn-formules')); return; }
      var item = article(etat.nb, etat.choix);
      var coche = hote.querySelector('.cn-lanc');
      if (coche && coche.checked) {
        item.label += ' · Lancement par nos soins (sur devis)';
        item.detail = (item.detail ? item.detail + ' · ' : '') + 'Lancement par nos soins (sur devis)';
        /* toujours un tableau : le panier de la page devis fait un
           .map() dessus, une chaîne le faisait planter et la page
           de récapitulatif s'affichait vide */
        item.options = ['Lancement par nos soins'];
        item.livraisonObligatoire = true;
      }
      if (typeof opts.surAjout === 'function') opts.surAjout(item);
      else if (typeof window.addToCart === 'function') window.addToCart(item);
    });

    /* bouton grisé cliqué : l'élément à compléter vibre et passe en rouge */
    function signaler(el) {
      if (!el) return;
      el.classList.remove('cn-vibre'); void el.offsetWidth;
      el.classList.add('cn-vibre', 'cn-rouge');
    }

    function rendre() {
      var n = comptees(etat.choix), reste = etat.nb - n;

      hote.querySelectorAll('.cn-f').forEach(function (b) {
        b.classList.toggle('on', Number(b.dataset.nb) === etat.nb);
      });
      hote.querySelectorAll('.cn-etape').forEach(function (s) {
        s.classList.toggle('on', Number(s.dataset.e) === etat.etape);
      });
      q('.cn-piste').style.transform = etat.etape === 2 ? 'translateX(-50%)' : 'translateX(0)';
      hote.querySelectorAll('.cn-vue').forEach(function (v) {
        v.classList.toggle('cn-vue-on', Number(v.dataset.e) === etat.etape);
      });

      var s2 = q('.cn-sub-2');
      if (s2) s2.innerHTML = etat.nb
        ? 'Répartissez vos <strong>' + etat.nb + ' canons</strong> entre les couleurs. ' +
          (reste > 0 ? 'Il reste <strong>' + reste + '</strong> canon' + (reste > 1 ? 's' : '') + ' à placer.'
                     : 'Tout est placé.')
        : '';

      var lignes = hote.querySelectorAll('.cn-c');
      COULEURS.forEach(function (c, i) {
        var l = lignes[i], v = etat.choix[c.nom] || 0;
        l.querySelector('.cn-q').textContent = v;
        l.classList.toggle('on', v > 0);
        l.querySelector('.cn-moins').disabled = v === 0;
        l.querySelector('.cn-plus').disabled = n >= etat.nb;
      });

      var p = q('.cn-bilan-p'), t = q('.cn-bilan-t');
      if (!etat.nb) { t.textContent = 'Votre effet'; p.textContent = '—'; }
      else {
        var prem = canonsPremium(etat.choix);
        t.textContent = etat.nb + ' canons' + (prem ? ' · dont ' + prem + ' premium' : '');
        p.textContent = total(etat.nb, etat.choix) + ' €';
      }

      q('.cn-retour').hidden = etat.etape !== 2;
      var su = q('.cn-suivant');
      su.hidden = etat.etape !== 1;
      su.classList.toggle('grise', !etat.nb); su.setAttribute('aria-disabled', !etat.nb ? 'true' : 'false');
      if (etat.nb) { var f0 = q('.cn-formules'); if (f0) f0.classList.remove('cn-rouge'); }
      var aj = q('.cn-ajouter');
      aj.hidden = etat.etape !== 2;
      var ajGris = !etat.nb || n !== etat.nb;
      aj.classList.toggle('grise', ajGris); aj.setAttribute('aria-disabled', ajGris ? 'true' : 'false');
      if (!ajGris) { var c0 = q('.cn-couleurs'); if (c0) c0.classList.remove('cn-rouge'); }
      aj.textContent = (etat.nb && n !== etat.nb)
        ? 'Placez les ' + etat.nb + ' canons'
        : 'Ajouter au devis';

      if (typeof opts.surChangement === 'function') opts.surChangement(etat, total(etat.nb, etat.choix));
    }

    rendre();
    return {
      hote: hote,
      remettre: function () { etat = { nb: 0, choix: {}, etape: 1 }; rendre(); },
    };
  }

  /* ───────────── la fenêtre (catalogue, accueil) ───────────── */

  var fenetre = null, instance = null, suite = null;

  function monter() {
    if (fenetre && document.body.contains(fenetre)) return;
    fenetre = document.createElement('div');
    fenetre.className = 'cn-ov';
    fenetre.id = 'canonsPicker';
    fenetre.setAttribute('role', 'dialog');
    fenetre.setAttribute('aria-modal', 'true');
    fenetre.hidden = true;
    var carte = document.createElement('div');
    carte.className = 'cn-carte';
    fenetre.appendChild(carte);
    document.body.appendChild(fenetre);

    instance = creer(carte, {
      enFenetre: true,
      surAjout: function (item) {
        var f = suite;
        fermer();
        if (typeof f === 'function') f(item);
        else if (typeof window.addToCart === 'function') window.addToCart(item);
        if (typeof window.closeVM === 'function') window.closeVM();
      },
    });

    carte.querySelector('.cn-fermer').addEventListener('click', fermer);
    fenetre.addEventListener('click', function (e) { if (e.target === fenetre) fermer(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && fenetre && !fenetre.hidden) fermer();
    });
  }

  function ouvrir(surAjout) {
    monter();
    suite = typeof surAjout === 'function' ? surAjout : null;
    instance.remettre();
    fenetre.hidden = false;
    fenetre.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { fenetre.classList.add('on'); });
    setTimeout(function () {
      var b = fenetre.querySelector('.cn-fermer');
      if (b) b.focus();
    }, 0);
  }

  function fermer() {
    if (!fenetre) return;
    fenetre.classList.remove('on');
    fenetre.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(function () { if (fenetre) fenetre.hidden = true; }, 250);
  }

  /* ───────────── ce que le reste du site utilise ───────────── */

  window.VESPRA_CANONS = {
    FORMULES: FORMULES, COULEURS: COULEURS,
    SUPPLEMENT_PREMIUM: SUPPLEMENT_PREMIUM,
    PRIX_MINI: PRIX_MINI, NB_MAX: NB_MAX, NOM: NOM_PRODUIT,
    ouvrir: ouvrir, fermer: fermer,
    total: total, libelle: libelle,
    deroule: function (hote, opts) { return creer(hote, opts || {}); },
  };

  /* les anciens noms restent valides : les boutons déjà en place
     continuent d'ouvrir la nouvelle fenêtre. */
  window.openPowderPicker = function () { ouvrir(); };
  window.closePowderPicker = fermer;

  /* l'ancienne fenêtre à 4 canons n'a plus lieu d'être ; le choix
     déroulé s'installe sur la fiche produit s'il y a un hôte. */
  function demarrer() {
    var vieux = document.getElementById('powderPicker');
    if (vieux && vieux.parentNode) vieux.parentNode.removeChild(vieux);
    var hote = document.getElementById('canonsDeroule');
    if (hote) creer(hote, {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
