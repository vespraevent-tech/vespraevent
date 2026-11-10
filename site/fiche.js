/* ─────────────────────────────────────────────────────────────
   Fiches produit : texte replié et produits complémentaires.

   Le texte descriptif est long — utile pour le référencement, mais il
   repousse loin vers le bas les produits complémentaires. Il est donc
   replié à l'ouverture de la page, avec un bouton « Voir plus ».
   Le texte reste présent dans la page : il est seulement masqué
   visuellement, donc les moteurs de recherche le lisent toujours.
   ───────────────────────────────────────────────────────────── */
(function () {
  /* toute la section descriptive, et non son seul premier bloc : le reste
     du texte (livraison, communes desservies…) se trouve à côté, pas dedans */
  var bloc = document.querySelector('section.prod-article') || document.querySelector('.prod-article-inner');
  var grille = document.querySelector('.related-grid');
  if (!bloc && !grille) return;

  var style = document.createElement('style');
  style.textContent = [
    /* texte replié */
    '.va-repli{position:relative;max-height:var(--va-h,420px);overflow:hidden}',
    '.va-repli::after{content:"";position:absolute;left:0;right:0;bottom:0;height:120px;',
    '  background:linear-gradient(to bottom,rgba(255,255,255,0),var(--white,#fff) 92%);pointer-events:none}',
    '.va-ouvert{max-height:none}',
    '.va-ouvert::after{display:none}',
    '.va-btn{display:block;margin:18px auto 0;background:none;border:1.5px solid var(--g3,#C8CDD8);',
    '  color:var(--navy,#2B4A6B);border-radius:999px;padding:11px 26px;font-size:14px;font-weight:700;',
    '  font-family:inherit;cursor:pointer;transition:background .2s,border-color .2s}',
    '.va-btn:hover{background:var(--navy,#2B4A6B);border-color:var(--navy,#2B4A6B);color:#fff}',
    /* Produits complémentaires : toujours une seule ligne, mais le nombre
       de cartes s'adapte à la largeur de l'écran — 4 sur grand écran,
       3 sur ordinateur portable et tablette paysage, 2 sur téléphone et
       tablette portrait. Les cartes en trop sont masquées plutôt que
       retirées, pour que l'affichage suive aussi un redimensionnement
       de la fenêtre ou un changement d'orientation. */
    '.related-grid{grid-template-columns:repeat(2,1fr)!important;max-width:760px;margin:0 auto}',
    '.related-grid .rel-card:nth-child(n+3){display:none}',
    '@media(min-width:700px){',
    '  .related-grid{grid-template-columns:repeat(3,1fr)!important;max-width:980px}',
    '  .related-grid .rel-card:nth-child(3){display:flex}',
    '}',
    '@media(min-width:1100px){',
    '  .related-grid{grid-template-columns:repeat(4,1fr)!important;max-width:1200px}',
    '  .related-grid .rel-card:nth-child(4){display:flex}',
    '  .related-grid .rel-title{font-size:15px}',
    '  .related-grid .rel-why{font-size:12.5px}',
    '}',
    '@media(max-width:560px){',
    '  .related-grid{gap:10px}',
    '  .related-grid .rel-img-wrap{aspect-ratio:4/3}',
    '  .related-grid .rel-body{padding:10px 11px 12px}',
    '  .related-grid .rel-title{font-size:13px;line-height:1.25}',
    '  .related-grid .rel-cat{font-size:9.5px}',
    '  .related-grid .rel-why{font-size:11px;line-height:1.4}',
    '  .related-grid .rel-price{font-size:13px}',
    '  .va-repli{--va-h:380px}',
    '}',
  ].join('');
  document.head.appendChild(style);

  if (!bloc) return;

  /* ——— la mise en place ———
     Elle est tentée plusieurs fois : au moment où le script est lu, puis
     quand la page a fini de charger, puis une dernière fois un peu après.
     Mesurer trop tôt — avant que les polices ne soient appliquées, ou
     pendant que le reste de la page se construit — peut donner une
     hauteur qui ne correspond pas encore au texte réellement affiché,
     et le texte resterait alors entièrement déplié. */
  var pose = false;

  function installer() {
    if (pose) return;
    var seuil = window.matchMedia('(max-width:560px)').matches ? 380 : 420;
    if (bloc.scrollHeight < seuil * 1.15) return;   /* texte déjà court */
    pose = true;

    bloc.classList.add('va-repli');
    var btn = document.createElement('button');
    btn.className = 'va-btn';
    btn.style.marginBottom = '34px';
    btn.type = 'button';
    btn.textContent = 'Voir plus';
    btn.setAttribute('aria-expanded', 'false');
    bloc.parentNode.insertBefore(btn, bloc.nextSibling);

    btn.addEventListener('click', function () {
      var ouvert = bloc.classList.toggle('va-ouvert');
      btn.textContent = ouvert ? 'Voir moins' : 'Voir plus';
      btn.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
      if (!ouvert) bloc.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    /* ouvrir automatiquement si le visiteur déplie une question de la FAQ
       qui se trouve dans la partie masquée */
    bloc.addEventListener('click', function (e) {
      if (!bloc.classList.contains('va-ouvert') && e.target.closest('.faq-q')) btn.click();
    }, true);
  }

  installer();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installer);
  }
  window.addEventListener('load', installer);
  setTimeout(installer, 1200);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(installer);
})();


/* Photo principale : le cadre épouse la forme de la photo (de 3:4 à 4:3),
   elle occupe donc toute la largeur sans être rognée ni entourée de blanc. */
(function () {
  function init() {
    var im = document.getElementById('prodMainImg');
    var fr = im && im.closest ? im.closest('.prod-img-main') : null;
    if (!fr) return;
    function fit() {
      if (!im.naturalWidth || !im.naturalHeight) return;
      var r = im.naturalWidth / im.naturalHeight;
      fr.style.aspectRatio = String(Math.max(0.75, Math.min(1.34, r)));
    }
    im.addEventListener('load', fit);
    fit();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
