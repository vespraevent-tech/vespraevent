/* ─────────────────────────────────────────────────────────────
   Édition visuelle — la page elle-même sert d'éditeur.

   Ce fichier n'est chargé que dans le cadre d'aperçu du back-office,
   quand la page est ouverte avec « ?edition=1 ». Un visiteur du site ne
   le charge jamais.

   Ce qu'il permet, directement sur la page :
     · cliquer un texte et le réécrire sur place ;
     · cliquer une image et la remplacer ;
     · déplacer une section vers le haut ou vers le bas ;
     · masquer une section, ou la réafficher ;
     · ajouter un bloc (titre, texte, image, bouton) où l'on veut.

   Rien n'est enregistré ici : chaque modification est transmise au
   back-office, qui l'enregistre sur le serveur et confirme. Tant que
   rien n'est enregistré, la page d'origine reste intacte.
   ───────────────────────────────────────────────────────────── */
(function () {
  if (window.__vespraEdition) return;
  window.__vespraEdition = true;

  var PARENT = window.parent;
  var page = (location.pathname.split('/').pop() || 'index.html');
  if (page.indexOf('.') === -1) page += '.html';

  function envoyer(message) {
    message.page = page;
    try { PARENT.postMessage(message, location.origin); } catch (e) {}
  }

  /* ══ présentation de l'éditeur ═══════════════════════════════ */
  var style = document.createElement('style');
  style.textContent = [
    '.vse-cible{outline:2px dashed rgba(30,54,80,.45);outline-offset:3px;cursor:text}',
    '.vse-cible:hover{outline-color:#1e3650;background:rgba(201,162,75,.10)}',
    '.vse-image{cursor:pointer}',
    '.vse-image:hover{outline:2px dashed #1e3650;outline-offset:3px}',
    '.vse-section{position:relative}',
    '.vse-section:hover{outline:1px dashed rgba(30,54,80,.35);outline-offset:-1px}',
    '.vse-barre{position:absolute;top:8px;right:8px;z-index:9998;display:none;gap:4px;',
    '  background:#fff;border:1px solid #dcd5c8;border-radius:999px;padding:4px 6px;',
    '  box-shadow:0 6px 18px rgba(12,15,20,.14)}',
    '.vse-section:hover>.vse-barre{display:flex}',
    '.vse-barre button{border:none;background:transparent;font:700 12px Inter,sans-serif;',
    '  color:#1e3650;cursor:pointer;padding:4px 8px;border-radius:999px;white-space:nowrap}',
    '.vse-barre button:hover{background:#f1eee7}',
    '.vse-masquee{opacity:.35;filter:grayscale(1)}',
    '.vse-edition{outline:2px solid #C9A24B!important;background:#fffdf7}',
    '.vse-ajout{position:relative;height:0}',
    '.vse-ajout button{position:absolute;left:50%;top:-14px;transform:translateX(-50%);z-index:9997;',
    '  border:1px solid #dcd5c8;background:#fff;color:#1e3650;border-radius:999px;',
    '  font:700 12px Inter,sans-serif;padding:5px 14px;cursor:pointer;opacity:0;transition:opacity .15s}',
    '.vse-ajout:hover button,.vse-ajout button:focus{opacity:1}',
  ].join('');
  document.head.appendChild(style);

  /* ══ textes ══════════════════════════════════════════════════
     Les blocs de texte sont repérés exactement comme dans la page
     « Textes » du back-office : même numérotation, donc un texte
     réécrit ici se retrouve au même endroit sur le site. */
  function blocsTexte() {
    return typeof window.VESPRA_BLOCS === 'function' ? window.VESPRA_BLOCS(document) : [];
  }

  function lireBloc(el) {
    var out = '';
    el.childNodes.forEach(function (n) {
      if (n.nodeType === 3) out += n.nodeValue;
      else if (n.nodeName === 'BR') out += '\n';
      else out += n.textContent;
    });
    return out.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
  }

  function brancherTextes() {
    blocsTexte().forEach(function (b) {
      if (!b.ouvert || b.el.dataset.vse) return;
      b.el.dataset.vse = 'texte';
      b.el.dataset.vseIdx = b.idx;
      b.el.dataset.vseRef = b.texte;
      b.el.classList.add('vse-cible');
      b.el.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        ouvrirTexte(b.el);
      });
    });
  }

  var enCours = null;
  function ouvrirTexte(el) {
    if (enCours && enCours !== el) fermerTexte(false);
    if (enCours === el) return;
    enCours = el;
    el.setAttribute('contenteditable', 'plaintext-only');
    el.classList.add('vse-edition');
    el.focus();
    el.addEventListener('keydown', toucheTexte);
    el.addEventListener('blur', function () { fermerTexte(true); }, { once: true });
  }

  function toucheTexte(e) {
    if (e.key === 'Escape') { e.preventDefault(); fermerTexte(false); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); fermerTexte(true); }
  }

  function fermerTexte(enregistrer) {
    var el = enCours;
    if (!el) return;
    enCours = null;
    el.removeEventListener('keydown', toucheTexte);
    el.removeAttribute('contenteditable');
    el.classList.remove('vse-edition');
    var texte = lireBloc(el);
    if (!enregistrer) { el.textContent = el.dataset.vseRef; return; }
    if (texte === el.dataset.vseRef) return;
    envoyer({
      type: 'vespra-edition-texte',
      idx: parseInt(el.dataset.vseIdx, 10),
      ref: el.dataset.vseRef,
      texte: texte,
    });
  }

  /* ══ images ══════════════════════════════════════════════════ */
  function brancherImages() {
    document.querySelectorAll('img').forEach(function (img) {
      if (img.dataset.vse) return;
      var src = img.getAttribute('src') || '';
      if (!src || src.indexOf('data:') === 0) return;
      img.dataset.vse = 'image';
      img.classList.add('vse-image');
      img.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var nom = src.split('?')[0].split('/').pop();
        envoyer({ type: 'vespra-edition-image', fichier: nom, apercu: img.currentSrc || src });
      });
    });
  }

  /* le back-office confirme le remplacement : on l'affiche tout de suite */
  function remplacerImage(fichier, url) {
    document.querySelectorAll('img').forEach(function (img) {
      var src = (img.getAttribute('src') || '').split('?')[0].split('/').pop();
      if (src === fichier) { img.setAttribute('src', url); img.removeAttribute('srcset'); }
    });
  }

  /* ══ sections : déplacer, masquer, ajouter ═══════════════════ */
  var reglage = { ordre: [], masquees: [], ajouts: [] };

  function listeSections() {
    return typeof window.VESPRA_SECTIONS === 'function' ? window.VESPRA_SECTIONS(document) : [];
  }

  function etatActuel() {
    var liste = listeSections();
    return {
      ordre: liste.map(function (s) { return s.cle; }),
      masquees: reglage.masquees.slice(),
      ajouts: reglage.ajouts.slice(),
    };
  }

  function publier() {
    envoyer({ type: 'vespra-edition-mise-en-page', reglage: etatActuel() });
  }

  function bouton(libelle, titre, action) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = libelle;
    b.title = titre;
    b.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      action();
    });
    return b;
  }

  function brancherSections() {
    var liste = listeSections();
    liste.forEach(function (s, rang) {
      var el = s.el;
      if (el.dataset.vseSection) {
        /* la section a bougé : on remet seulement les libellés à jour */
        return;
      }
      el.dataset.vseSection = s.cle;
      el.classList.add('vse-section');

      var barre = document.createElement('div');
      barre.className = 'vse-barre';
      barre.setAttribute('contenteditable', 'false');
      barre.appendChild(bouton('↑', 'Monter cette section', function () { deplacer(el, -1); }));
      barre.appendChild(bouton('↓', 'Descendre cette section', function () { deplacer(el, 1); }));
      barre.appendChild(bouton('Masquer', 'Retirer cette section de la page (rien n\'est supprimé)', function () { masquer(el); }));
      el.appendChild(barre);

      var ajout = document.createElement('div');
      ajout.className = 'vse-ajout';
      ajout.appendChild(bouton('+ Ajouter un bloc ici', 'Insérer un nouveau bloc après cette section', function () {
        envoyer({ type: 'vespra-edition-ajout', apres: el.dataset.vseSection });
      }));
      if (el.nextSibling) el.parentNode.insertBefore(ajout, el.nextSibling);
      else el.parentNode.appendChild(ajout);
    });
  }

  function voisine(el, sens) {
    var n = sens < 0 ? el.previousElementSibling : el.nextElementSibling;
    while (n && !n.dataset.vseSection) n = sens < 0 ? n.previousElementSibling : n.nextElementSibling;
    return n;
  }

  function deplacer(el, sens) {
    var autre = voisine(el, sens);
    if (!autre) return;
    if (sens < 0) autre.parentNode.insertBefore(el, autre);
    else autre.parentNode.insertBefore(el, autre.nextSibling);
    rangerAjouts();
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    publier();
  }

  /* les boutons « ajouter ici » suivent les sections quand elles bougent */
  function rangerAjouts() {
    document.querySelectorAll('.vse-ajout').forEach(function (a) { a.remove(); });
    listeSections().forEach(function (s) {
      var ajout = document.createElement('div');
      ajout.className = 'vse-ajout';
      ajout.appendChild(bouton('+ Ajouter un bloc ici', 'Insérer un nouveau bloc après cette section', function () {
        envoyer({ type: 'vespra-edition-ajout', apres: s.el.dataset.vseSection });
      }));
      if (s.el.nextSibling) s.el.parentNode.insertBefore(ajout, s.el.nextSibling);
      else s.el.parentNode.appendChild(ajout);
    });
  }

  function masquer(el) {
    var cle = el.dataset.vseSection;
    if (reglage.masquees.indexOf(cle) === -1) reglage.masquees.push(cle);
    el.classList.add('vse-masquee');
    var barre = el.querySelector('.vse-barre');
    if (barre) {
      barre.innerHTML = '';
      barre.appendChild(bouton('Réafficher', 'Remettre cette section sur la page', function () { reafficher(el); }));
    }
    publier();
  }

  function reafficher(el) {
    var cle = el.dataset.vseSection;
    var i = reglage.masquees.indexOf(cle);
    if (i !== -1) reglage.masquees.splice(i, 1);
    el.classList.remove('vse-masquee');
    var barre = el.querySelector('.vse-barre');
    if (barre) {
      barre.innerHTML = '';
      barre.appendChild(bouton('↑', 'Monter cette section', function () { deplacer(el, -1); }));
      barre.appendChild(bouton('↓', 'Descendre cette section', function () { deplacer(el, 1); }));
      barre.appendChild(bouton('Masquer', 'Retirer cette section de la page', function () { masquer(el); }));
    }
    publier();
  }

  /* ══ messages venus du back-office ═══════════════════════════ */
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data) return;
    var m = e.data;
    if (m.type === 'vespra-edition-etat') {
      /* réglage déjà enregistré pour cette page */
      reglage = {
        ordre: m.reglage && m.reglage.ordre ? m.reglage.ordre.slice() : [],
        masquees: m.reglage && m.reglage.masquees ? m.reglage.masquees.slice() : [],
        ajouts: m.reglage && m.reglage.ajouts ? m.reglage.ajouts.slice() : [],
      };
      reglage.masquees.forEach(function (cle) {
        var el = document.querySelector('[data-vse-section="' + cle + '"]');
        if (el) masquerSansPublier(el);
      });
    } else if (m.type === 'vespra-edition-image-ok') {
      remplacerImage(m.fichier, m.url);
    } else if (m.type === 'vespra-edition-bloc') {
      insererBloc(m.bloc, m.apres);
    } else if (m.type === 'vespra-edition-recharger') {
      location.reload();
    }
  });

  function masquerSansPublier(el) {
    el.classList.add('vse-masquee');
    var barre = el.querySelector('.vse-barre');
    if (barre) {
      barre.innerHTML = '';
      barre.appendChild(bouton('Réafficher', 'Remettre cette section sur la page', function () { reafficher(el); }));
    }
  }

  function insererBloc(bloc, apres) {
    if (!bloc || typeof window.VESPRA_MISE_EN_PAGE_FABRIQUER !== 'function') return;
    var el = window.VESPRA_MISE_EN_PAGE_FABRIQUER(bloc);
    var cible = apres ? document.querySelector('[data-vse-section="' + apres + '"]') : null;
    if (cible && cible.nextSibling) cible.parentNode.insertBefore(el, cible.nextSibling);
    else document.body.appendChild(el);
    reglage.ajouts = reglage.ajouts.filter(function (b) { return b.cle !== bloc.cle; });
    reglage.ajouts.push(bloc);
    brancherSections();
    rangerAjouts();
    brancherTextes();
    publier();
  }

  /* ══ démarrage ═══════════════════════════════════════════════ */
  function demarrer() {
    brancherTextes();
    brancherImages();
    brancherSections();
    /* les textes du back-office arrivent après le premier affichage :
       on rebranche une fois qu'ils sont posés */
    setTimeout(function () { brancherTextes(); brancherImages(); }, 900);
    envoyer({ type: 'vespra-edition-prete', sections: listeSections().map(function (s) {
      return { cle: s.cle, titre: s.titre };
    }) });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
