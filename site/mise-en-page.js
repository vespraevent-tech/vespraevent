/* ─────────────────────────────────────────────────────────────
   Mise en page des pages du site, réglée depuis le back-office.

   Depuis l'édition visuelle du back-office, vous pouvez déplacer une
   section d'une page, la masquer, ou ajouter un nouveau bloc. Ce fichier
   applique ces réglages sur la page publique.

   Rien n'est supprimé du site : une section masquée reste écrite dans la
   page, elle est simplement retirée à l'affichage. Si le serveur ne
   répond pas, la page garde sa mise en page d'origine.

   Il fournit aussi VESPRA_SECTIONS(), qui donne la liste des sections
   d'une page avec un repère stable — le même repère sert côté site et
   côté back-office, sans quoi un déplacement s'appliquerait au mauvais
   endroit.
   ───────────────────────────────────────────────────────────── */
(function () {
  /* ── repérage des sections ──────────────────────────────────── */
  function nomDeBase(el) {
    /* un bloc ajouté depuis le back-office porte son propre repère */
    if (el.getAttribute && el.getAttribute('data-vmp')) return el.getAttribute('data-vmp');
    if (el.id) return el.id;
    var c = (el.className || '').toString().trim().split(/\s+/)[0];
    return c || el.tagName.toLowerCase();
  }

  /* Liste des sections de premier niveau, dans l'ordre de la page.
     Le repère est le nom d'ancre ou la première classe ; s'il revient
     plusieurs fois, un numéro est ajouté. */
  function sections(doc) {
    var els = [];
    var enfants = (doc.body || doc).children;
    for (var i = 0; i < enfants.length; i++) {
      var e = enfants[i];
      if (e.tagName === 'SECTION' || (e.tagName === 'DIV' && /-section\b/.test(e.className || ''))) els.push(e);
    }
    var vus = {}, out = [];
    els.forEach(function (el) {
      var base = nomDeBase(el);
      vus[base] = (vus[base] || 0) + 1;
      var cle = vus[base] > 1 ? base + '~' + vus[base] : base;
      out.push({ cle: cle, el: el, titre: intitule(el) });
    });
    return out;
  }

  /* un intitulé lisible pour le back-office : le premier titre du bloc */
  function intitule(el) {
    var t = el.querySelector('h1,h2,h3');
    var texte = t ? (t.textContent || '').replace(/\s+/g, ' ').trim() : '';
    if (!texte) texte = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return texte.slice(0, 60) || nomDeBase(el);
  }

  window.VESPRA_SECTIONS = sections;

  /* ── blocs ajoutés depuis le back-office ────────────────────── */
  function echapper(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Un bloc ajouté reprend la présentation du site : même largeur de
     colonne, mêmes titres, mêmes boutons. Rien de neuf à styler. */
  function fabriquer(bloc) {
    var el = document.createElement('section');
    el.className = 'vmp-bloc';
    el.setAttribute('data-vmp', bloc.cle);
    el.style.cssText = 'padding:56px 0';

    var dedans = '<div class="container" style="max-width:1120px;margin:0 auto;padding:0 20px">';
    if (bloc.titre) dedans += '<h2 style="margin:0 0 14px">' + echapper(bloc.titre) + '</h2>';
    if (bloc.type === 'image' || bloc.type === 'texte-image') {
      if (bloc.image) {
        dedans += '<img src="' + echapper(bloc.image) + '" alt="' + echapper(bloc.titre || '') +
          '" style="max-width:100%;height:auto;border-radius:14px;display:block;margin:0 0 16px">';
      }
    }
    if (bloc.texte) {
      dedans += '<p style="margin:0 0 14px;white-space:pre-line">' + echapper(bloc.texte) + '</p>';
    }
    if (bloc.lien && bloc.libelle) {
      dedans += '<a class="btn" href="' + echapper(bloc.lien) + '">' + echapper(bloc.libelle) + '</a>';
    }
    dedans += '</div>';
    el.innerHTML = dedans;
    return el;
  }

  /* ── application ────────────────────────────────────────────── */
  /* Les listes sont enregistrées en texte JSON : l'enregistrement du
     site ne garde que des valeurs simples. On accepte aussi un tableau
     tel quel, et une liste séparée par des virgules. */
  function enListe(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      try {
        var p = JSON.parse(v);
        return Array.isArray(p) ? p : [];
      } catch (e) {
        return v.split(',').filter(Boolean);
      }
    }
    return [];
  }

  /* En édition, les sections masquées restent en place : le back-office
     les affiche en grisé pour pouvoir les réafficher. Seul l'ordre est
     appliqué, pour que l'éditeur parte de la mise en page enregistrée. */
  function appliquer(brut, edition) {
    if (!brut) return;
    var reglage = {
      ordre: enListe(brut.ordre),
      masquees: enListe(brut.masquees),
      ajouts: enListe(brut.ajouts),
    };
    var liste = sections(document);
    var par = {};
    liste.forEach(function (s) { par[s.cle] = s.el; });

    /* blocs ajoutés : fabriqués avant le classement, pour pouvoir être
       placés n'importe où dans l'ordre */
    (reglage.ajouts || []).forEach(function (b) {
      if (!b || !b.cle || par[b.cle]) return;
      par[b.cle] = fabriquer(b);
    });

    /* masquage */
    var masquees = {};
    (reglage.masquees || []).forEach(function (c) { masquees[c] = true; });

    /* ordre : les sections citées passent dans l'ordre demandé, les
       autres gardent leur place relative à la fin */
    var ordre = (reglage.ordre || []).filter(function (c) { return par[c]; });
    liste.forEach(function (s) { if (ordre.indexOf(s.cle) === -1) ordre.push(s.cle); });
    (reglage.ajouts || []).forEach(function (b) {
      if (b && b.cle && ordre.indexOf(b.cle) === -1) ordre.push(b.cle);
    });

    var ancre = liste.length ? liste[0].el : null;
    if (!ancre) return;
    var parent = ancre.parentNode;
    var repere = ancre;

    ordre.forEach(function (cle) {
      var el = par[cle];
      if (!el) return;
      if (masquees[cle] && !edition) {
        if (el.parentNode) el.parentNode.removeChild(el);
        return;
      }
      parent.insertBefore(el, repere);
      repere = el.nextSibling;
    });
  }

  /* ── édition visuelle : le back-office ouvre la page avec ?edition=1 ─
     Le nécessaire à l'édition n'est alors chargé que dans ce cadre, et
     jamais pour un visiteur du site. */
  function modeEdition() {
    if (!/[?&]edition=1/.test(location.search)) return false;
    if (window.parent === window) return false;
    var s = document.createElement('script');
    s.src = '/studio/edition.js';
    document.body.appendChild(s);
    return true;
  }

  function demarrer() {
    if (/[?&]apercu=1/.test(location.search)) return;
    var edition = /[?&]edition=1/.test(location.search) && window.parent !== window;
    if (typeof window.VESPRA_DONNEES !== 'function') { modeEdition(); return; }
    window.VESPRA_DONNEES('miseEnPage')
      .then(function (items) {
        if (Array.isArray(items) && items.length) appliquer(items[items.length - 1], edition);
      })
      .catch(function () {})
      .then(function () { modeEdition(); });
  }

  window.VESPRA_MISE_EN_PAGE_APPLIQUER = appliquer;
  window.VESPRA_MISE_EN_PAGE_FABRIQUER = fabriquer;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
