/* ─────────────────────────────────────────────────────────────
   Textes du site modifiables depuis le back-office (/studio).

   Les textes d'origine restent écrits dans les pages : c'est ce que
   voit un visiteur si ce script ne s'exécute pas, et c'est ce que
   lisent les moteurs de recherche. Ce fichier ne remplace que les
   blocs que vous avez réécrits depuis l'admin.

   Un bloc n'est remplacé que si le texte trouvé sur la page
   correspond toujours à celui qui a servi à l'enregistrer : si la
   page a changé entre-temps, le texte d'origine est conservé plutôt
   que d'écrire au mauvais endroit.
   ───────────────────────────────────────────────────────────── */
(function () {
  var SELECTEUR = 'h1,h2,h3,p';
  var HORS = 'footer, nav, .nav, script, style, #vsLoad, .c-drawer, .vm-box, .modal';

  function normaliser(t) {
    return String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  }

  /* Un bloc est modifiable s'il ne contient que du texte et, éventuellement,
     des retours à la ligne : remplacer un paragraphe qui contient un lien ou
     du gras ferait disparaître cette mise en forme. */
  function modifiable(el) {
    for (var i = 0; i < el.children.length; i++) {
      if (el.children[i].tagName !== 'BR') return false;
    }
    return true;
  }

  /* texte d'un bloc, en gardant les retours à la ligne des <br> */
  function lire(el) {
    var out = '';
    el.childNodes.forEach(function (n) {
      if (n.nodeType === 3) out += n.nodeValue;
      else if (n.nodeName === 'BR') out += '\n';
      else out += n.textContent;
    });
    return out.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
  }

  /* Liste des blocs de texte d'un document, dans l'ordre de la page.
     Utilisée à l'identique par la page publique et par le back-office,
     pour que les numéros de bloc désignent bien la même chose. */
  function blocs(doc) {
    var out = [], els = doc.querySelectorAll(SELECTEUR), n = 0;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.closest && el.closest(HORS)) continue;
      var t = lire(el);
      if (normaliser(t).length < 25) continue;
      out.push({ idx: n++, tag: el.tagName.toLowerCase(), texte: t, el: el, ouvert: modifiable(el) });
    }
    return out;
  }
  window.VESPRA_BLOCS = blocs;
  window.VESPRA_NORM = normaliser;

  /* écrit le texte en conservant les retours à la ligne */
  function ecrire(el, texte) {
    var lignes = String(texte).split(/\r?\n/);
    el.textContent = '';
    for (var i = 0; i < lignes.length; i++) {
      if (i) el.appendChild(document.createElement('br'));
      el.appendChild(document.createTextNode(lignes[i]));
    }
  }

  var page = (location.pathname.split('/').pop() || 'index.html');
  if (page.indexOf('.') === -1) page += '.html';
  if (/[?&]apercu=1/.test(location.search)) return;   /* aperçu d'apparence : on ne touche pas aux textes */

  /* le back-office charge ce fichier pour ses fonctions utilitaires, sans
     le chargeur de données : il n'y a alors rien à appliquer */
  if (typeof window.VESPRA_DONNEES !== 'function') return;

  window.VESPRA_DONNEES('textes')
    .then(function (items) {
      if (!Array.isArray(items) || !items.length) return;
      var liste = blocs(document);
      items.forEach(function (it) {
        if (!it || it.texte === undefined) return;
        var idx = parseInt(it.idx, 10);
        /* repère du texte d'origine (« ref ») : « sig » porte désormais la
           signature de sécurité, retirée avant envoi au site */
        var sig = normaliser(it.ref);
        var cible = liste[idx];

        /* le bloc attendu ne correspond plus (page modifiée, contenu ajouté
           par un autre script…) : on cherche le bon par son texte d'origine */
        if (!cible || normaliser(cible.texte).indexOf(sig) !== 0) {
          var candidats = liste.filter(function (b) { return normaliser(b.texte).indexOf(sig) === 0; });
          if (candidats.length !== 1) return;   /* introuvable ou ambigu : on s'abstient */
          cible = candidats[0];
        }
        if (!cible.ouvert) return;
        ecrire(cible.el, it.texte);
      });
    })
    .catch(function () { /* silencieux : les textes d'origine restent affichés */ });
})();
