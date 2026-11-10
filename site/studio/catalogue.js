/* ─────────────────────────────────────────────────────────────
   BACK-OFFICE — CRÉATION D'UN PRODUIT

   Ce fichier relie trois choses :
     • le formulaire de questions de l'onglet « Nouveau produit » ;
     • le générateur de texte (generateur.js), qui transforme les
       réponses en fiche rédigée ;
     • l'enregistrement dans la collection « catalogue », que la
       fonction fiche.mjs relit pour construire la page publique.

   Aucun texte n'est inventé : tout vient de ce qui a été saisi.
   Les corrections faites à la main dans l'aperçu sont conservées
   et ne sont écrasées que si vous cliquez sur « Tout réécrire ».
   ───────────────────────────────────────────────────────────── */
(function () {

  var courant = null;        /* la fiche en cours de rédaction */
  var corrigeAMain = false;  /* vrai dès qu'un texte de l'aperçu est retouché */
  var briques = [];          /* les briques du configurateur */
  window.catSlugTouche = false;
  var photos = [];           /* adresses des photos, la première est la principale */

  /* ── lecture du formulaire ──────────────────────────────── */

  function val(id) {
    var e = document.getElementById(id);
    return e ? e.value.trim() : '';
  }
  function lignes(id) {
    return val(id).split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function reponses() {
    return {
      nom: val('cat-nom'),
      id: window.catSlugTouche ? val('cat-slug') : val('cat-nom'),
      categorie: val('cat-cat'),
      enUneLigne: val('cat-ligne'),
      inclus: lignes('cat-inclus'),
      occasions: lignes('cat-occasions'),
      bonASavoir: lignes('cat-savoir'),
      aSurveiller: lignes('cat-veiller'),
      prix: Number(val('cat-prix')) || 0,
      img: photos[0] || '',
      config: briques.map(function (b) { return b.donnees(); }).filter(Boolean),
    };
  }

  /* ── l'aperçu, modifiable ───────────────────────────────── */

  function champ(cle, libelle, valeur, lignesNb) {
    var id = 'cat-a-' + cle.replace(/[^a-z0-9]+/gi, '-');
    return '<div class="cat-bloc"><label class="cat-l">' + libelle +
      '<textarea id="' + id + '" rows="' + (lignesNb || 2) + '" data-cle="' + cle + '">' +
      String(valeur || '').replace(/</g, '&lt;') + '</textarea></label></div>';
  }

  function dessinerApercu() {
    var f = courant;
    var z = document.getElementById('cat-apercu');
    if (!f) { z.innerHTML = '<p class="cat-aide">Commencez par le nom du produit.</p>'; return; }

    var html = '';
    html += champ('descCourte', 'Description sous le prix', f.descCourte, 3);
    html += champ('points', 'Points forts (une ligne chacun)', (f.points || []).join('\n'), 6);
    (f.sections || []).forEach(function (s, i) {
      html += champ('s' + i + '.titre', 'Titre de section', s.titre, 1);
      html += champ('s' + i + '.corps', 'Texte de la section (une ligne par paragraphe)',
        (s.paragraphes || []).join('\n'), 4);
    });
    (f.faq || []).forEach(function (q, i) {
      html += champ('f' + i + '.q', 'Question', q.q, 1);
      html += champ('f' + i + '.r', 'Réponse', q.r, 2);
    });
    html += champ('seo.titre', 'Titre affiché par Google', f.seo ? f.seo.titre : '', 1);
    html += champ('seo.description', 'Description affichée par Google', f.seo ? f.seo.description : '', 2);
    z.innerHTML = html;

    z.querySelectorAll('textarea').forEach(function (t) {
      t.addEventListener('input', function () { corrigeAMain = true; relireApercu(); });
    });

    var a = document.getElementById('cat-alertes');
    if (f.alertes && f.alertes.length) {
      a.innerHTML = 'Corrections automatiques : ' + f.alertes.join(' ; ') + '.';
      a.hidden = false;
    } else { a.hidden = true; }
  }

  /* les corrections faites dans l'aperçu reviennent dans la fiche */
  function relireApercu() {
    if (!courant) return;
    document.querySelectorAll('#cat-apercu textarea').forEach(function (t) {
      var cle = t.dataset.cle, v = t.value;
      if (cle === 'descCourte') courant.descCourte = v;
      else if (cle === 'points') courant.points = v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      else if (cle === 'seo.titre') courant.seo.titre = v;
      else if (cle === 'seo.description') courant.seo.description = v;
      else if (/^s(\d+)\.(titre|corps)$/.test(cle)) {
        var m = cle.match(/^s(\d+)\.(titre|corps)$/), s = courant.sections[m[1]];
        if (!s) return;
        if (m[2] === 'titre') s.titre = v;
        else s.paragraphes = v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      } else if (/^f(\d+)\.(q|r)$/.test(cle)) {
        var n = cle.match(/^f(\d+)\.(q|r)$/), q = courant.faq[n[1]];
        if (q) q[n[2]] = v;
      }
    });
  }

  /* ── mise à jour à chaque frappe ────────────────────────── */

  window.catMaj = function () {
    var r = reponses();
    var slug = window.VESPRA_SLUG(window.catSlugTouche ? r.id : r.nom);
    if (!window.catSlugTouche) {
      var e = document.getElementById('cat-slug');
      if (e) e.value = slug;
    }
    var u = document.getElementById('cat-url');
    if (u) u.textContent = 'www.vespraevent.fr/' + (slug || '…');

    if (!r.nom) { courant = null; dessinerApercu(); return; }
    /* tant que rien n'a été retouché à la main, la fiche se réécrit
       à chaque frappe : on voit le texte se construire en direct.
       Dès qu'une correction est faite dans l'aperçu, on ne touche
       plus au texte — seules les données chiffrées suivent. */
    if (!corrigeAMain) {
      courant = window.VESPRA_GENERER(r);
      courant.images = photos.slice();
      dessinerApercu();
      return;
    }
    courant.id = slug;
    courant.nom = r.nom;
    courant.cat = r.categorie;
    courant.prix = r.prix;
    courant.img = photos[0] || '';
    courant.images = photos.slice();
    courant.config = r.config;
  };

  window.catRegenerer = function () {
    var r = reponses();
    if (!r.nom) { showToast('Indiquez d’abord le nom du produit', true); return; }
    courant = window.VESPRA_GENERER(r);
    corrigeAMain = false;
    dessinerApercu();
    showToast('Fiche réécrite à partir de vos réponses');
  };

  /* ── les briques du configurateur ───────────────────────── */

  var MODELES = {
    formules: { titre: 'Choisissez votre formule', colonnes: ['Libellé', 'Précision', 'Prix'], exemple: ['4 canons', '4 tirs', '179'] },
    options:  { titre: 'Options supplémentaires', colonnes: ['Libellé', 'Précision', 'Prix'], exemple: ['Installation', 'Nous posons tout', '0'] },
    couleurs: { titre: 'Vos couleurs',            colonnes: ['Nom', 'Couleur', 'Supplément'], exemple: ['Rose', '#EC4899', '0'] },
    texte:    { titre: 'Votre texte',             colonnes: ['Intitulé', 'Exemple', 'Obligatoire (oui/non)'], exemple: ['Prénoms', 'Camille & Antoine', 'oui'] },
    quantite: { titre: 'Combien ?',               colonnes: [], exemple: [] },
  };

  window.catAjouterBrique = function (type, pre) {
    var m = MODELES[type];
    if (!m) return;
    var hote = document.getElementById('cat-briques');
    var div = document.createElement('div');
    div.className = 'cat-brique';
    var corps = '';

    if (type === 'quantite') {
      corps =
        '<div class="cat-grille3">' +
        '<label class="cat-l">Minimum<input type="number" data-k="min" value="' + ((pre && pre.min) || 1) + '"></label>' +
        '<label class="cat-l">Maximum<input type="number" data-k="max" value="' + ((pre && pre.max) || 10) + '"></label>' +
        '<label class="cat-l">Unité<input type="text" data-k="unite" value="' + ((pre && pre.unite) || 'unité') + '"></label>' +
        '</div>';
    } else {
      corps =
        '<label class="cat-l">Lignes (' + m.colonnes.join(' · ') + ')' +
        '<textarea rows="4" data-k="lignes" placeholder="' + m.exemple.join(' | ') + '">' +
        (pre && pre.lignes ? pre.lignes : '') + '</textarea>' +
        '<small>Une ligne par choix, les colonnes séparées par une barre verticale |. ' +
        'Écrivez « devis » à la place du prix pour un chiffrage sur mesure.</small></label>';
      if (type === 'couleurs') {
        corps += '<label class="cat-l">Nombre à répartir' +
          '<input type="text" data-k="nombre" value="' + ((pre && pre.nombre) || 'formule') + '">' +
          '<small>« formule » reprend le nombre annoncé par la formule choisie ; sinon un nombre fixe.</small></label>';
      }
    }

    div.innerHTML =
      '<div class="cat-brique-t"><strong>' + m.titre + '</strong>' +
      '<button type="button" class="cat-x" title="Retirer">×</button></div>' +
      '<label class="cat-l">Intitulé affiché<input type="text" data-k="titre" value="' +
      ((pre && pre.titre) || m.titre) + '"></label>' + corps;

    hote.appendChild(div);
    div.querySelector('.cat-x').addEventListener('click', function () {
      briques = briques.filter(function (b) { return b.el !== div; });
      div.remove();
      window.catMaj();
    });
    div.querySelectorAll('input,textarea').forEach(function (e) {
      e.addEventListener('input', window.catMaj);
    });

    var brique = {
      el: div,
      donnees: function () {
        function k(n) { var e = div.querySelector('[data-k="' + n + '"]'); return e ? e.value.trim() : ''; }
        var base = { type: type, titre: k('titre') };
        if (type === 'quantite') {
          base.min = Number(k('min')) || 1;
          base.max = Number(k('max')) || 10;
          base.unite = k('unite') || 'unité';
          base.defaut = base.min;
          return base;
        }
        var choix = k('lignes').split('\n').map(function (l) { return l.trim(); }).filter(Boolean)
          .map(function (l) {
            var c = l.split('|').map(function (x) { return x.trim(); });
            if (type === 'couleurs') {
              return { nom: c[0], hex: c[1] || '#CCCCCC', supplement: Number(c[2]) || 0 };
            }
            if (type === 'texte') {
              return { label: c[0], exemple: c[1] || '', requis: /^oui/i.test(c[2] || '') };
            }
            var o = { label: c[0], sous: c[1] || '' };
            if (/devis/i.test(c[2] || '')) o.devis = true; else o.prix = Number(c[2]) || 0;
            return o;
          });
        if (!choix.length) return null;
        if (type === 'texte') { base.champs = choix; return base; }
        base.choix = choix;
        if (type === 'couleurs') {
          var n = k('nombre');
          base.nombre = /^\d+$/.test(n) ? Number(n) : 'formule';
          base.unite = 'unité';
          base.repetition = true;
        }
        return base;
      },
    };
    briques.push(brique);
    window.catMaj();
    return brique;
  };

  /* ── les photos ──────────────────────────────────────────

     Elles partent au même endroit que celles de l'onglet Images :
     une photo envoyée ici est donc utilisable partout ailleurs.
     La première de la liste est la photo principale — celle du
     catalogue et de la page d'accueil ; les suivantes deviennent
     les vignettes de la fiche. */

  window.catEnvoyerPhotos = async function (input) {
    var fichiers = Array.prototype.slice.call(input.files || []);
    if (!fichiers.length) return;
    var etat = document.getElementById('cat-envoi');
    var images = fichiers.filter(function (f) { return /^image\//.test(f.type); });
    if (images.length !== fichiers.length) {
      showToast('Les fichiers qui ne sont pas des images ont été ignorés', true);
    }
    var fait = 0;
    for (var i = 0; i < images.length; i++) {
      etat.hidden = false;
      etat.textContent = 'Envoi ' + (i + 1) + ' sur ' + images.length + '…';
      try {
        var url = await envoyerFichier(images[i]);
        if (photos.indexOf(url) === -1) photos.push(url);
        fait++;
      } catch (e) {
        showToast('Photo refusée : ' + e.message, true);
      }
    }
    etat.hidden = true;
    input.value = '';
    dessinerPhotos();
    window.catMaj();
    if (fait) showToast(fait > 1 ? fait + ' photos ajoutées' : 'Photo ajoutée');
  };

  function dessinerPhotos() {
    var z = document.getElementById('cat-galerie');
    if (!z) return;
    if (!photos.length) {
      z.innerHTML = '<p class="cat-aide">Aucune photo pour l’instant.</p>';
      return;
    }
    z.innerHTML = photos.map(function (u, i) {
      return '<div class="cat-vignette' + (i === 0 ? ' principale' : '') + '">' +
        '<img src="' + u + '" alt="">' +
        (i === 0 ? '<span class="cat-p">Principale</span>' : '') +
        '<button type="button" class="cat-x" data-i="' + i + '" title="Retirer">×</button></div>';
    }).join('');
    z.querySelectorAll('.cat-x').forEach(function (b) {
      b.addEventListener('click', function () {
        photos.splice(Number(b.dataset.i), 1);
        dessinerPhotos(); window.catMaj();
      });
    });
    /* cliquer une vignette la passe en principale */
    z.querySelectorAll('.cat-vignette img').forEach(function (img, i) {
      img.style.cursor = 'pointer';
      img.title = 'Mettre en photo principale';
      img.addEventListener('click', function () {
        if (i === 0) return;
        photos.unshift(photos.splice(i, 1)[0]);
        dessinerPhotos(); window.catMaj();
      });
    });
  }


  /* ── enregistrement ─────────────────────────────────────── */

  window.catEnregistrer = async function (statut) {
    relireApercu();
    if (!courant || !courant.nom) { showToast('Indiquez le nom du produit', true); return; }
    if (!courant.id) { showToast('L’adresse de la page est vide', true); return; }
    if (RESERVES.indexOf(courant.id) !== -1) {
      showToast('Cette adresse est déjà celle d’une page du site : choisissez-en une autre', true);
      return;
    }
    if (statut === 'publie' && !photos.length) {
      showToast('Ajoutez au moins une photo avant de publier', true);
      return;
    }
    courant.statut = statut;
    courant.img = photos[0] || '';
    courant.images = photos.slice();
    try {
      await api('/data', { method: 'POST', body: JSON.stringify({ collection: 'catalogue', item: courant }) });
      showToast(statut === 'publie'
        ? 'Produit publié — visible sur www.vespraevent.fr/' + courant.id
        : 'Brouillon enregistré');
      catCharger();
    } catch (e) {
      showToast('Enregistrement impossible : ' + e.message, true);
    }
  };

  /* les adresses déjà prises par une page du site */
  var RESERVES = ['index', 'catalogue', 'blog', 'faq', 'reservation', 'notices', 'merci',
    'zones-livraison', 'nos-prestataires', 'nos-recommandations', 'plan-du-site',
    'mentions-legales', 'politique-de-confidentialite', 'conditions-generales-location', 'admin'];

  /* ── la liste des produits déjà créés ───────────────────── */

  async function catCharger() {
    var z = document.getElementById('cat-liste');
    if (!z) return;
    try {
      var items = await api('/data?collection=catalogue');
      var l = (items || []).filter(function (x) { return x && x.id; });
      if (!l.length) { z.innerHTML = '<p class="cat-aide">Aucun produit créé ici pour l’instant.</p>'; return; }
      z.innerHTML = l.map(function (x) {
        return '<div class="cat-item"><span><strong>' + (x.nom || x.id) + '</strong>' +
          '<small>/' + x.id + ' · ' + (x.statut === 'publie' ? 'en ligne' : 'brouillon') + '</small></span>' +
          '<button type="button" class="btn-sec" data-id="' + x.id + '">Reprendre</button></div>';
      }).join('');
      z.querySelectorAll('button[data-id]').forEach(function (b) {
        b.addEventListener('click', function () {
          var f = l.find(function (x) { return x.id === b.dataset.id; });
          if (f) reprendre(f);
        });
      });
    } catch (e) {
      z.innerHTML = '<p class="cat-aide">Liste indisponible : ' + e.message + '</p>';
    }
  }

  function reprendre(f) {
    courant = JSON.parse(JSON.stringify(f));
    corrigeAMain = true;   /* une fiche enregistrée ne se réécrit pas toute seule */
    document.getElementById('cat-nom').value = f.nom || '';
    document.getElementById('cat-slug').value = f.id || '';
    document.getElementById('cat-cat').value = f.cat || 'Animations';
    document.getElementById('cat-prix').value = f.prix || '';
    photos = (Array.isArray(f.images) && f.images.length) ? f.images.slice() : (f.img ? [f.img] : []);
    dessinerPhotos();
    window.catSlugTouche = true;
    document.getElementById('cat-briques').innerHTML = '';
    briques = [];
    (f.config || []).forEach(function (b) {
      var pre = { titre: b.titre };
      if (b.type === 'quantite') { pre.min = b.min; pre.max = b.max; pre.unite = b.unite; }
      else if (b.type === 'texte') {
        pre.lignes = (b.champs || []).map(function (c) {
          return [c.label, c.exemple || '', c.requis ? 'oui' : 'non'].join(' | ');
        }).join('\n');
      } else if (b.type === 'couleurs') {
        pre.nombre = b.nombre;
        pre.lignes = (b.choix || []).map(function (c) {
          return [c.nom, c.hex, c.supplement || 0].join(' | ');
        }).join('\n');
      } else {
        pre.lignes = (b.choix || []).map(function (c) {
          return [c.label, c.sous || '', c.devis ? 'devis' : (c.prix || 0)].join(' | ');
        }).join('\n');
      }
      window.catAjouterBrique(b.type, pre);
    });
    dessinerApercu();
    showToast('Produit chargé : vous pouvez le modifier');
  }

  window.catOuvrir = function () {
    if (!document.getElementById('cat-apercu')) return;
    dessinerPhotos();
    dessinerApercu();
    catCharger();
  };
})();
