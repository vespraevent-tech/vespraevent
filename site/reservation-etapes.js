/* ─────────────────────────────────────────────────────────────
   Page Réservation en deux étapes.

   Avant, la sélection des produits et le formulaire de coordonnées
   se suivaient sur une même page très longue : on ne savait pas où
   commençait l'un et où finissait l'autre.

   Ce script regroupe la sélection (panier, catégories, produits) dans
   une première étape, et le formulaire dans une seconde. Le visiteur
   passe de l'une à l'autre avec un bouton « Suivant », et peut revenir
   en arrière sans rien perdre : rien n'est effacé, les deux étapes
   restent dans la page, seule leur visibilité change.

   Choisir des produits reste facultatif : le bouton « Suivant » est
   toujours actif, et on peut remplir le formulaire sans sélection.

   Aucun code de la page n'est modifié : le script réorganise ce qui
   existe déjà. S'il ne s'exécute pas, la page fonctionne comme avant.
   ───────────────────────────────────────────────────────────── */
(function () {
  function demarrer() {
    var form = document.getElementById('formZone');
    var corps = document.querySelector('.page-body');
    if (!form || !corps) return;

    var zones = ['cartZone', 'emptyZone', 'catZone']
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);
    if (!zones.length) return;

    /* ── styles ─────────────────────────────────────────────── */
    var style = document.createElement('style');
    style.textContent = [
      '#etape1[hidden],#formZone[hidden]{display:none!important}',

      /* ── barre de progression ──────────────────────────────
         Deux segments côte à côte : celui de l'étape en cours (et ceux
         déjà franchis) sont pleins, l'autre reste gris. La barre est
         collée sous l'en-tête pour rester visible pendant le défilement,
         y compris sur téléphone. */
      '.re-steps{position:sticky;top:var(--re-haut,66px);z-index:60;',
      '  display:grid;grid-template-columns:1fr 1fr;gap:16px;',
      '  background:#fff;padding:14px 0 12px;margin:0 0 30px;',
      '  scroll-margin-top:calc(var(--re-haut,66px) + 10px);',
      '  box-shadow:0 1px 0 var(--g4,#F0F2F5),0 6px 14px -12px rgba(12,15,20,.5)}',
      '.re-step{display:block;min-width:0}',
      '.re-step-bar{height:4px;border-radius:999px;background:var(--g4,#F0F2F5);',
      '  overflow:hidden;margin-bottom:9px}',
      '.re-step-bar i{display:block;height:100%;width:0;border-radius:999px;',
      '  background:var(--navy,#2B4A6B);transition:width .45s cubic-bezier(.4,0,.2,1)}',
      '.re-step.on .re-step-bar i,.re-step.fait .re-step-bar i{width:100%}',
      '.re-step-t{display:block;width:100%;text-align:left;background:none;border:none;',
      '  padding:0;font-family:inherit;font-size:14px;font-weight:600;cursor:default;',
      '  color:var(--g2,#646D7C);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.re-step.on .re-step-t{color:var(--black,#0C0F14);font-weight:700}',
      '.re-step.fait .re-step-t{color:var(--navy,#2B4A6B);cursor:pointer}',
      '.re-step.fait .re-step-t:hover{text-decoration:underline}',

      /* passage à l'étape suivante : un bouton discret, la sélection
         des produits restant l'élément principal de l'écran */
      '.re-next{margin:30px 0 4px;display:flex;flex-direction:column;align-items:center;gap:9px}',
      '.re-next-btn{background:none;color:var(--navy,#2B4A6B);border:1.5px solid var(--navy,#2B4A6B);',
      '  border-radius:999px;padding:10px 26px;font-family:inherit;font-size:14px;font-weight:600;',
      '  cursor:pointer;max-width:100%;',
      '  transition:background .2s ease,color .2s ease}',
      '.re-next-btn:hover{background:var(--navy,#2B4A6B);color:#fff}',
      '.re-next-note{font-size:12.5px;color:var(--g2,#646D7C);text-align:center;max-width:430px;line-height:1.5}',
      '.re-back-btn{background:none;border:none;color:var(--g2,#646D7C);padding:0;',
      '  font-family:inherit;font-size:13.5px;font-weight:600;cursor:pointer;margin-bottom:24px;',
      '  transition:color .2s ease}',
      '.re-back-btn:hover{color:var(--navy,#2B4A6B);text-decoration:underline}',

      /* rappel de la sélection à l'étape 2 */
      '.re-recap[hidden]{display:none!important}',
      '.re-recap{border:1px solid var(--g3,#C8CDD8);border-radius:var(--r,12px);',
      '  padding:16px 18px;margin:0 0 30px}',
      '.re-recap-t{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;',
      '  color:var(--g2,#646D7C);margin-bottom:12px}',
      '.re-recap-total{display:flex;justify-content:space-between;align-items:baseline;gap:12px;',
      '  border-top:1px solid var(--g4,#F0F2F5);margin-top:12px;padding-top:12px;',
      '  font-size:14px;font-weight:700;color:var(--black,#0C0F14)}',

      '@media(max-width:560px){',
      '  .re-steps{gap:10px;padding:11px 0 9px;margin-bottom:24px}',
      '  .re-step-t{font-size:12.5px}',
      '  .re-step-bar{height:3.5px;margin-bottom:7px}',
      '  .re-next-btn{padding:10px 22px;font-size:13.5px}',
      '}',
    ].join('');
    document.head.appendChild(style);

    /* ── on regroupe la sélection dans une seule étape ───────── */
    var etape1 = document.createElement('div');
    etape1.id = 'etape1';
    zones[0].parentNode.insertBefore(etape1, zones[0]);
    zones.forEach(function (z) { etape1.appendChild(z); });

    /* ── fil des étapes ─────────────────────────────────────── */
    var fil = document.createElement('div');
    fil.className = 're-steps';
    fil.innerHTML =
      '<div class="re-step on" id="reStep1">' +
      '<div class="re-step-bar"><i></i></div>' +
      '<button type="button" class="re-step-t" id="reStep1Btn">1. Votre sélection</button></div>' +
      '<div class="re-step" id="reStep2">' +
      '<div class="re-step-bar"><i></i></div>' +
      '<span class="re-step-t">2. Vos coordonnées</span></div>';

    /* hauteur réelle de l'en-tête : la barre se colle juste en dessous */
    function hauteurEntete() {
      var nav = document.querySelector('.nav');
      var h = nav ? Math.round(nav.getBoundingClientRect().height) : 66;
      document.documentElement.style.setProperty('--re-haut', h + 'px');
    }
    hauteurEntete();
    window.addEventListener('resize', hauteurEntete);

    corps.insertBefore(fil, etape1);

    /* ── bouton « Suivant » au bas de l'étape 1 ─────────────── */
    var suite = document.createElement('div');
    suite.className = 're-next';
    suite.innerHTML =
      '<button type="button" class="re-next-btn" id="reNext">Suivant</button>' +
      '<div class="re-next-note" id="reNextNote"></div>';
    etape1.appendChild(suite);

    /* ── bouton de retour en haut de l'étape 2 ──────────────── */
    var retour = document.createElement('button');
    retour.type = 'button';
    retour.className = 're-back-btn';
    retour.id = 'reBack';
    retour.textContent = '← Modifier ma sélection';
    form.insertBefore(retour, form.firstChild);

    /* ── rappel de la sélection en haut de l'étape 2 ─────────
       Le récapitulatif d'origine (#totalBlock) n'affiche que les produits
       choisis par catégories. Quand le visiteur arrive du catalogue avec
       un panier, il n'avait donc rien sous les yeux à l'étape 2 : on y
       recopie alors le contenu du panier de l'étape 1. */
    var rappel = document.createElement('div');
    rappel.className = 're-recap';
    rappel.hidden = true;
    form.insertBefore(rappel, retour.nextSibling);   /* juste sous le lien de retour */

    function majRappel() {
      var items = document.getElementById('csItems');
      var total = document.getElementById('csTotal');
      var panier = document.getElementById('cartZone');
      var actif = items && panier && getComputedStyle(panier).display !== 'none' &&
                  items.querySelector('.cs-item');
      var propre = document.getElementById('totalBlock');
      /* si le récapitulatif d'origine s'affiche déjà, on ne double pas */
      if (!actif || (propre && getComputedStyle(propre).display !== 'none')) {
        rappel.hidden = true;
        return;
      }
      var copie = items.cloneNode(true);
      /* c'est un rappel, pas une zone de modification : on retire les croix */
      copie.querySelectorAll('.cs-item-del').forEach(function (x) { x.remove(); });
      rappel.innerHTML = '<div class="re-recap-t">Votre sélection</div>';
      rappel.appendChild(copie);
      if (total) {
        var t = document.createElement('div');
        t.className = 're-recap-total';
        t.innerHTML = '<span>Total estimé (devis)</span><span>' + total.textContent + '</span>';
        rappel.appendChild(t);
      }
      rappel.hidden = false;
    }

    /* ── passage d'une étape à l'autre ──────────────────────── */
    var s1 = document.getElementById('reStep1');
    var s2 = document.getElementById('reStep2');

    function etape(n) {
      var deux = n === 2;
      if (deux) majRappel();
      etape1.hidden = deux;
      form.hidden = !deux;
      s1.className = 're-step' + (deux ? ' fait' : ' on');
      s2.className = 're-step' + (deux ? ' on' : '');
      fil.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    document.getElementById('reNext').addEventListener('click', function () { etape(2); });
    retour.addEventListener('click', function () { etape(1); });
    document.getElementById('reStep1Btn').addEventListener('click', function () {
      if (s1.classList.contains('fait')) etape(1);
    });

    /* « Remplir directement le formulaire » : même effet que Suivant */
    document.querySelectorAll('.ez-alt a, a[href="#formZone"]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); etape(2); });
    });

    /* Le texte sous le bouton dépend de ce qui est sélectionné. */
    function note() {
      if (etape1.hidden) return;
      var vide = document.getElementById('emptyZone');
      var sansProduit = vide && getComputedStyle(vide).display !== 'none';
      document.getElementById('reNextNote').textContent = sansProduit
        ? 'Vous pouvez passer à la suite sans rien sélectionner : décrivez-nous votre projet dans le formulaire, nous nous occupons du reste.'
        : 'Vous pourrez revenir à cette étape pour modifier votre sélection.';
    }
    note();

    /*
       IMPORTANT : ne pas observer tout #etape1 en childList.
       Le contenu du panier (#cartZone) est redessiné à chaque ajout/retrait.
       L'ancien observer relançait note() à chaque modification DOM, et
       note() réécrivait le textContent du bouton, ce qui créait une boucle
       de MutationObserver et pouvait bloquer complètement l'onglet
       (RESULT_CODE_HUNG dans Chrome/Edge).

       Le texte de la note dépend uniquement de la visibilité de #emptyZone
       et de #etape1. On observe donc uniquement leurs attributs, et on ne
       réécrit le texte que lorsqu'il a réellement changé.
    */
    function noteSafe() {
      if (etape1.hidden) return;
      var vide = document.getElementById('emptyZone');
      var sansProduit = vide && getComputedStyle(vide).display !== 'none';
      var nextText = sansProduit
        ? 'Vous pouvez passer à la suite sans rien sélectionner : décrivez-nous votre projet dans le formulaire, nous nous occupons du reste.'
        : 'Vous pourrez revenir à cette étape pour modifier votre sélection.';
      var cible = document.getElementById('reNextNote');
      if (cible && cible.textContent !== nextText) cible.textContent = nextText;
    }
    var noteObserver = new MutationObserver(noteSafe);
    noteObserver.observe(etape1, {
      attributes: true,
      attributeFilter: ['hidden', 'style', 'class']
    });
    var emptyZone = document.getElementById('emptyZone');
    if (emptyZone) {
      noteObserver.observe(emptyZone, {
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }

    /* Une fois la demande envoyée, la page n'affiche plus que le message
       de confirmation : le fil des étapes n'a plus lieu d'être. */
    var succes = document.getElementById('successCard');
    if (succes) {
      new MutationObserver(function () {
        if (succes.classList.contains('on')) { fil.hidden = true; etape1.hidden = true; }
      }).observe(succes, { attributes: true, attributeFilter: ['class'] });
    }

    etape(1);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
