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
  /* ── Photos envoyées depuis le back-office ────────────────────────
     Elles sont enregistrées telles quelles (une photo de téléphone pèse
     souvent plus d'un mégaoctet). Le CDN d'images de Netlify les sert
     redimensionnées et converties en WebP : la page se charge sans
     attendre plusieurs mégaoctets, et la photo reste nette.
     Une adresse qui n'est pas un envoi du back-office n'est pas touchée. */
  window.VESPRA_IMG = function (src, largeur) {
    var s = String(src == null ? '' : src).trim();
    if (!s || s.indexOf('/.netlify/images') === 0) return s;
    var envoi = s.indexOf('/api/media/') === 0;
    if (!envoi) {
      /* photo du site : réduite elle aussi, mais seulement si on sait à quelle
         taille elle est affichée (une vignette de 300 px n'a pas besoin d'une
         photo de 1080 px). Les logos et dessins (SVG) ne sont jamais touchés. */
      if (!largeur) return s;
      if (/^(https?:|data:|blob:)/.test(s)) return s;
      if (!/\.(webp|jpe?g|png)(\?|$)/i.test(s)) return s;
      if (s.charAt(0) !== '/') s = '/' + s;
    }
    var w = largeur || 900;
    try {
      var dpr = window.devicePixelRatio || 1;
      if (dpr > 1.5) w = Math.min(Math.round(w * 1.5), 1600);
    } catch (e) {}
    return '/.netlify/images?url=' + encodeURIComponent(s) + '&w=' + w + '&fm=webp&q=72';
  };
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
     quand même au bout de 0,4 seconde. */
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
    if (dcl && donneesPretes) setTimeout(leverVoile, 30);
  }
  /* on n'attend que la fin de la lecture de la page, pas l'exécution de tous
     les scripts : la page s'affiche au moment où le navigateur la dessine,
     sans seconde blanche supplémentaire. */
  function pageLue() { dcl = true; verifier(); }
  if (document.readyState === 'loading') {
    document.addEventListener('readystatechange', function () { if (document.readyState !== 'loading') pageLue(); });
    document.addEventListener('DOMContentLoaded', pageLue);
  } else pageLue();
  minuteur = setTimeout(leverVoile, 400);
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

  /* ── mémoire courte des réglages du back-office ──────────────────
     Sans elle, chaque page attend la réponse du serveur avant de
     s'afficher : le visiteur voit une page vide, puis tout apparaît d'un
     coup. La dernière réponse est donc gardée dans le navigateur et
     réutilisée telle quelle pendant quelques minutes : la page suivante
     s'affiche immédiatement, déjà juste. La réponse du serveur est
     quand même redemandée en arrière-plan, pour la fois d'après. */
  var CLE_CACHE = 'vespra_site_' + page, DUREE_CACHE = 10 * 60 * 1000;
  function normaliser(d) {
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
  }
  function garder(d) {
    try { localStorage.setItem(CLE_CACHE, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
  }
  function enMemoire() {
    try {
      var v = JSON.parse(localStorage.getItem(CLE_CACHE) || 'null');
      if (!v || !v.d || Date.now() - v.t > DUREE_CACHE) return null;
      return normaliser(v.d);
    } catch (e) { return null; }
  }
  function rafraichirEnFond() {
    try {
      fetch('/api/site?page=' + encodeURIComponent(page), { headers: { accept: 'application/json' }, cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d) garder(d); })
        .catch(function () {});
    } catch (e) {}
  }

  function charger() {
    if (promesse) return promesse;
    var garde = enMemoire();
    if (garde) {
      /* la page s'affiche tout de suite avec les derniers réglages connus */
      if (garde.entreprise) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { remplirEntreprise(garde.entreprise); });
        else remplirEntreprise(garde.entreprise);
      }
      donneesPretes = true; verifier();
      rafraichirEnFond();
      promesse = Promise.resolve(garde);
      return promesse;
    }
    promesse = fetch('/api/site?page=' + encodeURIComponent(page), {
      headers: { accept: 'application/json', 'cache-control': 'no-cache' },
      cache: 'no-store',
    })
      .then(function (r) { return r.ok ? r.json() : VIDE; })
      .then(function (d) { garder(d); return normaliser(d); })
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
