/* ─────────────────────────────────────────────────────────────
   CONFIGURATEUR GÉNÉRIQUE

   Une fiche produit créée depuis le back-office ne contient pas de
   code : elle contient une description de ce que le client doit
   choisir. Ce fichier lit cette description et fabrique le
   formulaire correspondant, calcule le prix et compose la ligne
   qui part dans le devis.

   Les briques disponibles, à combiner librement :

     { type:'formules', titre:'Choisissez votre formule', obligatoire:true,
       choix:[ {label:'4 canons', sous:'4 tirs', prix:179},
               {label:'Sur mesure', devis:true} ] }

     { type:'options', titre:'Options supplémentaires',
       choix:[ {label:'Cadre photo', sous:'…', prix:20},
               {label:'Installation', devis:true} ] }

     { type:'quantite', titre:'Combien ?', min:1, max:20, defaut:1,
       prixUnitaire:12, unite:'table' }

     { type:'couleurs', titre:'Vos couleurs', nombre:'formule',
       repetition:true,
       choix:[ {nom:'Rose', hex:'#EC4899'},
               {nom:'Jaune', hex:'#FACC15', supplement:10} ] }
       — nombre:'formule' reprend le premier nombre trouvé dans le
         libellé de la formule choisie ; un nombre fixe est accepté.

     { type:'texte', titre:'Votre texte',
       champs:[ {label:'Prénoms', exemple:'Camille & Antoine',
                 max:40, requis:true} ] }

   Utilisation :
     VESPRA_CONFIGURATEUR(hote, produit)
   puis window.VESPRA_CONFIG_ARTICLE() rend la ligne de devis, ou
   null si le choix est incomplet (un message l'indique alors).
   ───────────────────────────────────────────────────────────── */
(function () {

  function euros(n) { return (Math.round(n * 100) / 100) + ' €'; }
  function texteSur(x) { return String(x == null ? '' : x); }

  /* « 12 canons » → 12 ; sert à la brique couleurs quand elle suit
     le nombre annoncé par la formule. */
  function nombreDans(s) {
    var m = String(s || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  }

  function elem(balise, classe, dedans) {
    var e = document.createElement(balise);
    if (classe) e.className = classe;
    if (dedans != null) e.innerHTML = dedans;
    return e;
  }

  window.VESPRA_CONFIGURATEUR = function (hote, produit) {
    if (!hote || !produit) return null;
    var blocs = Array.isArray(produit.config) ? produit.config : [];
    var base = Number(produit.prix) || 0;
    var etat = { formule: null, options: {}, quantite: 1, couleurs: {}, texte: {} };
    var touche = false;   /* le visiteur a commencé à choisir */
    var rendus = [];

    hote.innerHTML = '';
    hote.className = 'cfg';

    marquer = function () { touche = true; };

    blocs.forEach(function (bloc, i) {
      var f = CONSTRUCTEURS[bloc.type];
      if (!f) return;
      var zone = elem('div', 'cfg-bloc');
      if (bloc.titre) zone.appendChild(elem('div', 'cfg-titre', bloc.titre));
      hote.appendChild(zone);
      rendus.push(f(zone, bloc, etat, i, recalculer));
    });

    /* le total, toujours visible sous les choix */
    var pied = elem('div', 'cfg-total');
    var libelleTotal = elem('span', 'cfg-total-t', 'Total');
    var montant = elem('strong', 'cfg-total-p', euros(base));
    pied.appendChild(libelleTotal); pied.appendChild(montant);
    hote.appendChild(pied);

    var avis = elem('p', 'cfg-avis', '');
    avis.hidden = true;
    hote.appendChild(avis);

    function detail() {
      var prix = base, surDevis = false, morceaux = [];

      if (etat.formule) {
        if (etat.formule.devis) { surDevis = true; }
        else { prix = Number(etat.formule.prix) || 0; }
        morceaux.push(etat.formule.label);
      }

      if (etat.quantiteActive) {
        prix = prix * etat.quantite;
        if (etat.quantite > 1) morceaux.push(etat.quantite + ' × ' + (etat.uniteQuantite || 'unité'));
      }

      Object.keys(etat.couleurs).forEach(function (nom) {
        var q = etat.couleurs[nom];
        if (!q) return;
        var c = etat.couleursRef[nom] || {};
        prix += (Number(c.supplement) || 0) * q;
        morceaux.push(q + ' ' + nom);
      });

      Object.keys(etat.options).forEach(function (cle) {
        var o = etat.options[cle];
        if (!o) return;
        if (o.devis) surDevis = true;
        else prix += Number(o.prix) || 0;
        morceaux.push(o.label);
      });

      Object.keys(etat.texte).forEach(function (cle) {
        var v = etat.texte[cle];
        if (v) morceaux.push(v);
      });

      return { prix: prix, surDevis: surDevis, label: morceaux.join(' · ') };
    }

    /* ce qui manque avant de pouvoir ajouter au devis */
    function manquant() {
      for (var i = 0; i < blocs.length; i++) {
        var b = blocs[i];
        if (b.type === 'formules' && b.obligatoire !== false && !etat.formule) {
          return 'Choisissez une formule.';
        }
        if (b.type === 'couleurs') {
          var voulu = nombreVoulu(b);
          var pose = 0;
          Object.keys(etat.couleurs).forEach(function (k) { pose += etat.couleurs[k] || 0; });
          if (voulu && pose !== voulu) {
            return 'Choisissez la couleur de chacun de vos ' + voulu + ' ' +
                   (b.unite || 'unité') + (voulu > 1 ? 's' : '') + '.';
          }
        }
        if (b.type === 'texte') {
          for (var j = 0; j < (b.champs || []).length; j++) {
            var ch = b.champs[j];
            if (ch.requis && !texteSur(etat.texte[ch.label]).trim()) {
              return 'Remplissez « ' + ch.label + ' ».';
            }
          }
        }
      }
      return '';
    }

    function nombreVoulu(bloc) {
      if (bloc.nombre === 'formule') {
        return etat.formule ? nombreDans(etat.formule.label) : 0;
      }
      return Number(bloc.nombre) || 0;
    }
    etat.nombreVoulu = nombreVoulu;

    function recalculer() {
      var d = detail();
      montant.textContent = d.surDevis ? 'Sur devis' : euros(d.prix);
      rendus.forEach(function (r) { if (r && r.rafraichir) r.rafraichir(); });
      var m = manquant();
      /* le message n'apparaît qu'après une première action : arriver
         sur la fiche et lire un avertissement en jaune, sans avoir
         rien fait, donne l'impression d'une erreur. */
      avis.textContent = m;
      avis.hidden = !m || !touche;
      var btn = document.getElementById('addToCartBtn');
      if (btn) btn.disabled = !!m;
      /* le prix affiché en haut de fiche suit les choix */
      var haut = document.getElementById('prodPriceDisplay');
      if (haut && !d.surDevis) {
        haut.innerHTML = euros(d.prix) + ' <small>/ événement</small>';
      }
    }

    window.VESPRA_CONFIG_ARTICLE = function () {
      var m = manquant();
      if (m) {
        touche = true;
        avis.textContent = m; avis.hidden = false;
        avis.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return null;
      }
      var d = detail();
      var reste = d.label.split(' · ');
      if (etat.formule) reste = reste.slice(1);
      return {
        id: produit.id + '_' + Date.now(),
        name: produit.nom,
        label: d.label,
        /* la formule et le reste du choix, séparés pour le courriel */
        formule: etat.formule ? etat.formule.label : '',
        detail: reste.join(' · '),
        price: d.surDevis ? 0 : d.prix,
        devis: d.surDevis || undefined,
        img: produit.img || '',
      };
    };

    recalculer();
    return { etat: etat, recalculer: recalculer };
  };

  /* ───────────────────────── les briques ───────────────────────── */

  /* signale qu'une première action a eu lieu : les messages d'aide
     n'apparaissent qu'ensuite */
  var marquer = function () {};

  var CONSTRUCTEURS = {};

  CONSTRUCTEURS.formules = function (zone, bloc, etat, i, majeur) {
    (bloc.choix || []).forEach(function (c, k) {
      var b = elem('button', 'cfg-f');
      b.type = 'button';
      b.innerHTML = '<span class="cfg-f-txt"><span class="cfg-f-nom">' + c.label + '</span>' +
        (c.sous ? '<span class="cfg-f-sous">' + c.sous + '</span>' : '') + '</span>' +
        '<span class="cfg-f-prix">' + (c.devis ? 'Sur devis' : euros(Number(c.prix) || 0)) + '</span>';
      b.addEventListener('click', function () {
        marquer();
        etat.formule = c;
        etat.couleurs = {};                    /* le nombre change : on repart de zéro */
        zone.querySelectorAll('.cfg-f').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        majeur();
      });
      zone.appendChild(b);
      if (bloc.obligatoire !== false && k === 0 && bloc.preselection !== false) {
        etat.formule = c; b.classList.add('on');
      }
    });
    return null;
  };

  CONSTRUCTEURS.options = function (zone, bloc, etat, i, majeur) {
    (bloc.choix || []).forEach(function (o, k) {
      var cle = 'o' + i + '_' + k;
      var l = elem('label', 'cfg-opt');
      l.innerHTML = '<input type="checkbox"><span class="cfg-opt-txt">' +
        '<strong>' + o.label + '</strong>' +
        (o.sous ? '<span>' + o.sous + '</span>' : '') + '</span>' +
        '<span class="cfg-opt-prix">' + (o.devis ? 'Sur devis' : '+ ' + euros(Number(o.prix) || 0)) + '</span>';
      l.querySelector('input').addEventListener('change', function () {
        marquer();
        etat.options[cle] = this.checked ? o : null;
        l.classList.toggle('on', this.checked);
        majeur();
      });
      zone.appendChild(l);
    });
    return null;
  };

  CONSTRUCTEURS.quantite = function (zone, bloc, etat, i, majeur) {
    etat.quantiteActive = true;
    etat.quantite = Number(bloc.defaut) || Number(bloc.min) || 1;
    etat.uniteQuantite = bloc.unite || 'unité';
    var min = Number(bloc.min) || 1, max = Number(bloc.max) || 99;

    var ligne = elem('div', 'cfg-qte');
    ligne.innerHTML = '<button type="button" class="cfg-moins" aria-label="Moins">−</button>' +
      '<output class="cfg-q">' + etat.quantite + '</output>' +
      '<button type="button" class="cfg-plus" aria-label="Plus">+</button>' +
      '<span class="cfg-qte-u">' + (bloc.unite || '') + '</span>';
    function bouger(p) {
      marquer();
      var v = etat.quantite + p;
      if (v < min || v > max) return;
      etat.quantite = v;
      ligne.querySelector('.cfg-q').textContent = v;
      majeur();
    }
    ligne.querySelector('.cfg-moins').addEventListener('click', function () { bouger(-1); });
    ligne.querySelector('.cfg-plus').addEventListener('click', function () { bouger(1); });
    zone.appendChild(ligne);
    return {
      rafraichir: function () {
        ligne.querySelector('.cfg-moins').disabled = etat.quantite <= min;
        ligne.querySelector('.cfg-plus').disabled = etat.quantite >= max;
      },
    };
  };

  CONSTRUCTEURS.couleurs = function (zone, bloc, etat, i, majeur) {
    etat.couleursRef = {};
    var lignes = [];
    (bloc.choix || []).forEach(function (c) {
      etat.couleursRef[c.nom] = c;
      var l = elem('div', 'cfg-c' + (c.supplement ? ' cfg-c-sup' : ''));
      l.innerHTML =
        '<span class="cfg-pastille" style="background:' + (c.hex || '#ccc') + '"></span>' +
        '<span class="cfg-c-nom">' + c.nom +
          (c.supplement ? '<em>+ ' + euros(c.supplement) + '</em>' : '') + '</span>' +
        '<span class="cfg-cpt"><button type="button" class="cfg-moins" aria-label="Retirer">−</button>' +
        '<output class="cfg-q">0</output>' +
        '<button type="button" class="cfg-plus" aria-label="Ajouter">+</button></span>';
      function bouger(p) {
        marquer();
        var voulu = etat.nombreVoulu(bloc), pose = 0;
        Object.keys(etat.couleurs).forEach(function (k) { pose += etat.couleurs[k] || 0; });
        if (p > 0 && voulu && pose >= voulu) return;
        var v = (etat.couleurs[c.nom] || 0) + p;
        etat.couleurs[c.nom] = v < 0 ? 0 : v;
        majeur();
      }
      l.querySelector('.cfg-moins').addEventListener('click', function () { bouger(-1); });
      l.querySelector('.cfg-plus').addEventListener('click', function () { bouger(1); });
      zone.appendChild(l);
      lignes.push({ c: c, l: l });
    });

    var note = elem('p', 'cfg-note', '');
    zone.appendChild(note);

    return {
      rafraichir: function () {
        var voulu = etat.nombreVoulu(bloc), pose = 0;
        Object.keys(etat.couleurs).forEach(function (k) { pose += etat.couleurs[k] || 0; });
        lignes.forEach(function (x) {
          var q = etat.couleurs[x.c.nom] || 0;
          x.l.querySelector('.cfg-q').textContent = q;
          x.l.classList.toggle('on', q > 0);
          x.l.querySelector('.cfg-moins').disabled = q === 0;
          x.l.querySelector('.cfg-plus').disabled = voulu ? pose >= voulu : false;
        });
        var reste = voulu - pose;
        note.textContent = !voulu ? ''
          : reste > 0 ? 'Il reste ' + reste + ' ' + (bloc.unite || 'unité') + (reste > 1 ? 's' : '') + ' à placer.'
          : 'Tout est placé.' + (bloc.repetition === false ? '' : ' Une même couleur peut être reprise.');
      },
    };
  };

  CONSTRUCTEURS.texte = function (zone, bloc, etat, i, majeur) {
    (bloc.champs || []).forEach(function (ch) {
      var l = elem('label', 'cfg-champ');
      l.innerHTML = '<span>' + ch.label + (ch.requis ? ' *' : '') + '</span>' +
        '<input type="text"' + (ch.max ? ' maxlength="' + ch.max + '"' : '') +
        ' placeholder="' + (ch.exemple || '') + '">';
      l.querySelector('input').addEventListener('input', function () {
        marquer();
        etat.texte[ch.label] = this.value;
        majeur();
      });
      zone.appendChild(l);
    });
    return null;
  };

  window.VESPRA_CONFIG_BRIQUES = Object.keys(CONSTRUCTEURS);
})();
