/* ─────────────────────────────────────────────────────────────
   Un seul appel pour toute la page.

   Le site récupère, à chaque affichage, ce que le back-office a pu
   modifier : l'apparence, les textes réécrits, les notices, les prix et
   les avis Google. Cela faisait jusqu'à cinq allers-retours par page —
   cinq attentes pour le visiteur et cinq requêtes facturées.

   Ce fichier n'en fait plus qu'un, et distribue le résultat aux scripts
   qui en ont besoin. Chacun demande sa part par window.VESPRA_DONNEES,
   sans savoir si l'appel a déjà eu lieu : il n'est fait qu'une fois.

   Si l'appel échoue, chaque script reçoit une réponse vide et la page
   garde le contenu écrit dans ses fichiers : rien ne disparaît.
   ───────────────────────────────────────────────────────────── */
(function () {
  var VIDE = { theme: {}, ambiance: {}, bandeau: {}, textes: [], notices: [], produits: [], google: [],
               images: [], miseEnPage: [], salles: [], prestataires: [], catalogue: [], entreprise: {} };

  /* une part inconnue vaut une liste vide : aucun script n'a ainsi à
     vérifier la forme de ce qu'il reçoit */
  function part(d, quoi) {
    if (!quoi) return d;
    return Object.prototype.hasOwnProperty.call(d, quoi) ? d[quoi] : [];
  }

  /* l'aperçu d'apparence du back-office ne doit rien charger */
  if (/[?&]apercu=1/.test(location.search)) {
    /* Cette réponse ignorait la part demandée et renvoyait le tout :
       un script qui attendait une liste recevait un objet, et son
       parcours échouait — les salles et les prestataires ne
       s'affichaient plus dans l'aperçu du back-office. */
    window.VESPRA_DONNEES = function (quoi) { return Promise.resolve(part(VIDE, quoi)); };
    return;
  }

  var page = (location.pathname.split('/').pop() || 'index.html');
  if (page.indexOf('.') === -1) page += '.html';

  var promesse = null;

  /* ── voile anti-clignotement ───────────────────────────────────
     La page est écrite avec les photos, l'ordre et les textes du
     dernier déploiement ; le back-office peut les avoir changés depuis.
     Sans précaution, le visiteur voyait d'abord l'ancienne version, puis
     la bonne apparaissait d'un coup. La page reste donc invisible le
     temps que ces réglages arrivent et soient appliqués, puis s'affiche
     une seule fois. Garde-fou : si le serveur tarde, elle s'affiche
     quand même au bout de 0,7 seconde. */
  var voileLeve = false, dcl = false, donneesPretes = false, minuteur = null;
  try {
    var st = document.createElement('style');
    st.id = 'v-voile-style';
    st.textContent = 'html.v-attente body{opacity:0!important}html.v-fin body{transition:opacity .18s ease}';
    (document.head || document.documentElement).appendChild(st);
    document.documentElement.classList.add('v-attente');
  } catch (e) {}
  function leverVoile() {
    if (voileLeve) return;
    voileLeve = true;
    clearTimeout(minuteur);
    var h = document.documentElement;
    h.classList.add('v-fin');
    h.classList.remove('v-attente');
    setTimeout(function () { h.classList.remove('v-fin'); }, 400);
  }
  function verifier() {
    if (dcl && donneesPretes) setTimeout(leverVoile, 90);
  }
  document.addEventListener('DOMContentLoaded', function () { dcl = true; verifier(); });
  if (document.readyState !== 'loading') dcl = true;
  minuteur = setTimeout(leverVoile, 700);
  window.VESPRA_LEVER_VOILE = leverVoile;


  /* ── informations de l'entreprise ──────────────────────────────
     Les mentions légales et les conditions de location portent leurs
     informations dans des repères data-ent="…". Ce qui est saisi dans
     Paramètres › Entreprise remplace le texte écrit dans la page ; un
     champ laissé vide laisse le texte d'origine.
       data-ent="assureur"      → remplace le texte
       data-ent-si="assureur"   → l'élément n'apparaît que si le champ est rempli
       data-ent-tel / -mail     → texte et lien d'un numéro / d'une adresse   */
  function remplirEntreprise(e) {
    try {
      var v = function (k) { return (e[k] === undefined || e[k] === null) ? '' : String(e[k]).trim(); };
      var nbsp = function (t) { return t.replace(/ /g, '\u00a0'); };
      var els = document.querySelectorAll('[data-ent]');
      for (var i = 0; i < els.length; i++) {
        var k = els[i].getAttribute('data-ent'), t = v(k);
        if (!t) continue;
        if (k === 'capital' || k === 'siret' || k === 'rcs' || k === 'tva') t = nbsp(t);
        els[i].textContent = t;
      }
      var si = document.querySelectorAll('[data-ent-si]');
      for (var j = 0; j < si.length; j++) {
        if (v(si[j].getAttribute('data-ent-si'))) si[j].hidden = false;
      }
      var tl = v('tel');
      if (tl) {
        var num = tl.replace(/[^0-9+]/g, '');
        if (/^0\d{9}$/.test(num)) num = '+33' + num.slice(1);
        document.querySelectorAll('[data-ent-tel]').forEach(function (a) { a.textContent = tl; a.setAttribute('href', 'tel:' + num); });
      }
      var ml = v('email');
      if (ml) document.querySelectorAll('[data-ent-mail]').forEach(function (a) { a.textContent = ml; a.setAttribute('href', 'mailto:' + ml); });
    } catch (x) {}
  }

  function charger() {
    if (promesse) return promesse;
    promesse = fetch('/api/site?page=' + encodeURIComponent(page), {
      headers: { accept: 'application/json', 'cache-control': 'no-cache' },
      cache: 'no-store',
    })
      .then(function (r) { return r.ok ? r.json() : VIDE; })
      .then(function (d) {
        /* on complète ce qui manquerait, pour que les scripts n'aient
           jamais à vérifier la forme de ce qu'ils reçoivent */
        return {
          theme: (d && d.theme) || {},
          textes: (d && d.textes) || [],
          notices: (d && d.notices) || [],
          produits: (d && d.produits) || [],
          google: (d && d.google) || [],
          images: (d && d.images) || [],
          miseEnPage: (d && d.miseEnPage) || [],
          salles: (d && d.salles) || [],
          prestataires: (d && d.prestataires) || [],
          catalogue: (d && d.catalogue) || [],
          entreprise: (d && d.entreprise) || {},
          ambiance: (d && d.ambiance && !Array.isArray(d.ambiance)) ? d.ambiance : {},
          bandeau: (d && d.bandeau && !Array.isArray(d.bandeau)) ? d.bandeau : {},
        };
      })
      .catch(function () { return VIDE; })
      .then(function (d) {
        /* informations de l'entreprise : avant que le voile ne se lève */
        var e = d && d.entreprise;
        if (e) {
          if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { remplirEntreprise(e); });
          else remplirEntreprise(e);
        }
        donneesPretes = true; verifier(); return d;
      });
    return promesse;
  }

  /* VESPRA_DONNEES('textes') rend directement la part demandée */
  window.VESPRA_DONNEES = function (quoi) {
    return charger().then(function (d) { return part(d, quoi); });
  };

  /* l'appel part tout de suite : les scripts qui suivent n'attendent pas */
  charger();
})();
