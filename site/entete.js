/* ─────────────────────────────────────────────────────────────
   En-tête : effet verre dépoli suspendu pendant l'ouverture du menu.

   L'en-tête du site est semi-transparent et floute ce qui passe
   derrière lui. C'est joli au défilement, mais quand le menu burger
   s'ouvre juste en dessous, les deux surfaces translucides se
   superposent et le menu devient difficile à lire.

   Ce script surveille l'ouverture du menu et pose la classe
   « menu-ouvert » sur l'en-tête : le temps que le menu reste ouvert,
   l'en-tête devient opaque. Dès la fermeture, l'effet revient.

   Il n'y a rien à appeler : le script se branche tout seul sur le
   menu existant, quelle que soit la page.
   ───────────────────────────────────────────────────────────── */
(function () {
  function demarrer() {
    var nav = document.querySelector('.nav');
    var liens = document.getElementById('navLinks');
    if (!nav || !liens) return;

    var style = document.createElement('style');
    style.textContent = [
      /* menu ouvert : en-tête et panneau entièrement opaques */
      '.nav.menu-ouvert{',
      '  background:#fff!important;',
      '  -webkit-backdrop-filter:none!important;backdrop-filter:none!important;',
      '  border-bottom:1px solid var(--g4,#E6E9F0)!important;',
      '  box-shadow:none!important;',
      '}',
      /* Le panneau couvre tout l'écran : une fois ouvert, le site ne doit
         plus réapparaître en bas. Les coordonnées, elles, restent juste
         sous le bouton « Réserver » — poussées tout en bas (margin-top:auto),
         elles laissaient un grand vide blanc au milieu du menu. L'espace
         libre est donc rejeté après elles, au bas du panneau. */
      '@media(max-width:960px){',
      '  .nav-links{height:calc(100dvh - var(--vp-entete,60px))!important;',
            '    max-height:none!important;padding-bottom:96px!important;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}',
      '  .nav-menu-foot{margin-top:18px!important}',
      '}',
      '.nav-links.open{',
      '  background:#fff!important;',
      '  -webkit-backdrop-filter:none!important;backdrop-filter:none!important;',
      '  border-bottom:1px solid var(--g4,#E6E9F0)!important;',
      '  box-shadow:0 10px 24px rgba(12,15,20,.10)!important;',
      '}',
    ].join('');
    document.head.appendChild(style);

    /* La hauteur réelle de l'en-tête varie d'une page et d'une largeur à
       l'autre : on la mesure plutôt que de la supposer, sans quoi le
       panneau dépasse du bas de l'écran ou s'arrête trop tôt. */
    function mesurer() {
      /* on mesure l'endroit où le panneau commence réellement, et non la
         hauteur de l'en-tête : un bandeau d'annonce, ajouté parfois après
         l'affichage, décale le tout vers le bas. Le panneau ouvert dit
         lui-même où il commence ; sinon on se rabat sur le bas de
         l'en-tête. */
      var haut = liens.classList.contains('open')
        ? liens.getBoundingClientRect().top
        : nav.getBoundingClientRect().bottom;
      document.documentElement.style.setProperty('--vp-entete', Math.max(0, Math.round(haut)) + 'px');
      /* hauteur réellement visible (barre d'adresse du navigateur comprise) : le panneau s'arrête
         exactement en bas de l'écran, et défile jusqu'au dernier élément */
      if (liens.classList.contains('open') && window.matchMedia && matchMedia('(max-width:960px)').matches) {
        var vv = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        var h = Math.max(200, Math.round(vv - liens.getBoundingClientRect().top));
        liens.style.setProperty('height', h + 'px', 'important');
        liens.style.setProperty('max-height', h + 'px', 'important');
        liens.style.setProperty('overflow-y', 'auto', 'important');
      } else {
        liens.style.removeProperty('height'); liens.style.removeProperty('max-height'); liens.style.removeProperty('overflow-y');
      }
    }
    mesurer();
    window.addEventListener('resize', mesurer);
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', mesurer); window.visualViewport.addEventListener('scroll', mesurer); }
    window.addEventListener('scroll', function () {
      if (liens.classList.contains('open')) mesurer();
    }, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(mesurer).observe(nav);
    /* un bandeau d'annonce peut arriver après l'affichage et tout décaler :
       on remesure quand la page change au-dessus de l'en-tête */
    if (window.MutationObserver) {
      new MutationObserver(mesurer).observe(document.body, { childList: true });
    }

    function majuscule() {
      var ouvert = liens.classList.contains('open');
      if (ouvert) { mesurer(); requestAnimationFrame(mesurer); }
      nav.classList.toggle('menu-ouvert', ouvert);
      /* le menu peut aussi être refermé en cliquant à côté : on remet
         alors le défilement de la page, que la fermeture n'annulait pas */
      if (!ouvert) {
        document.body.style.overflow = '';
        var bt = document.querySelector('.nav-toggle');
        if (bt) { bt.classList.remove('open'); bt.setAttribute('aria-expanded', 'false'); }
      }
    }

    new MutationObserver(majuscule).observe(liens, { attributes: true, attributeFilter: ['class'] });
    majuscule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();

/* ─────────────────────────────────────────────────────────────
   Icônes « Rechercher » et « Mon compte » dans l'en-tête, à côté du
   panier, au même endroit sur toutes les pages. La loupe déroule un
   champ de recherche sous l'en-tête : les exemples y défilent, et
   s'arrêtent dès qu'on clique. La recherche mène directement au
   produit (suggestions en tapant). Le bonhomme mène à l'espace client.
   ───────────────────────────────────────────────────────────── */
(function () {
  var EXEMPLES = ['photobooth', 'sono', 'barnum', 'mange-debout', 'cabine téléphonique', 'néon lumineux', 'baby-foot', 'machine à fumée'];

  function monter() {
    var nav = document.querySelector('.nav');
    if (!nav || nav.querySelector('.hs-ico')) return;
    var droite = nav.querySelector('.nav-right');
    if (!droite) return;

    var css = document.createElement('style');
    css.textContent = [
      '.nav .hs-ico{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border:0;background:transparent;color:inherit;cursor:pointer;border-radius:50%;text-decoration:none;flex:none}',
      '.nav .hs-ico svg{width:20px;height:20px}',
      '.nav .hs-ico:hover{background:rgba(100,109,124,.12)}',
      '.nav .hs-compte{position:relative}',
      '.nav .hs-compte.hs-on::after{content:"";position:absolute;right:3px;bottom:3px;width:9px;height:9px;border-radius:50%;background:#3fae4a;border:2px solid #fff;box-sizing:content-box;margin:-2px}',
      '.nav .hs-compte.hs-on{background:#eaf0f6;color:#2b4a6b}',
      '.hs-m{display:none}',
      /* pastille du devis : le chiffre est centré par flex, sans marge ni remplissage parasite */
      '.nav .cart-n{display:inline-flex!important;align-items:center;justify-content:center;padding:0!important;line-height:1!important;text-align:center;font-variant-numeric:tabular-nums;box-sizing:border-box}',
      /* téléphone : pas de loupe dans l'en-tête (la recherche est en haut du menu) ; l'icône de compte n'apparaît que connecté */
      '@media(max-width:960px){.nav .hs-loupe{display:none}.nav .hs-compte{display:none!important}.hs-m.hs-on .hs-mi::after{content:"";position:absolute;right:-4px;bottom:-3px;width:8px;height:8px;border-radius:50%;background:#3fae4a;border:2px solid #fff;box-sizing:content-box}.hs-m{display:block}.hs-pan{display:none!important}',
      '  #navLinks .hs-rech{flex:none;display:flex;width:auto;max-width:none;margin:14px 20px 8px;height:46px}',
      '  #navLinks .hs-rech-in{height:46px;border:0;border-radius:12px;background:#f1f3f6;font-size:15px;padding:0 14px 0 40px}',
      '  #navLinks .hs-rech-in:focus{background:#f1f3f6;box-shadow:0 0 0 2px rgba(43,74,107,.35)}',
      '  #navLinks .hs-rech-ico{left:14px;width:17px;height:17px;margin-top:-8.5px}',
      '  #navLinks .hs-rech-ex{left:40px;font-size:15px}',
      '  #navLinks .hs-sug{top:50px}}',
      '.hs-pan{position:absolute;left:0;right:0;top:100%;display:none;background:#fff;border-bottom:1px solid #e3e5ea;box-shadow:0 8px 20px rgba(20,24,35,.08);padding:10px 16px;z-index:5}',
      '.hs-pan.on{display:block}',
      '.hs-rech{position:relative;display:flex;align-items:center;max-width:520px;margin:0 auto}',
      '.hs-rech-ico{position:absolute;left:13px;top:50%;width:15px;height:15px;margin-top:-7.5px;color:#646D7C;pointer-events:none}',
      '.hs-rech-in{width:100%;height:40px;box-sizing:border-box;padding:0 14px 0 36px;border:1px solid transparent;border-radius:999px;',
      '  background:#F0F2F5;color:#0C0F14;font:400 14px/1 Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;outline:none;',
      '  -webkit-appearance:none;appearance:none;transition:border-color .18s,background .18s,box-shadow .18s}',
      '.hs-rech-in::-webkit-search-cancel-button{-webkit-appearance:none;display:none}',
      '.hs-rech-in:focus{background:#fff;border-color:#2B4A6B;box-shadow:0 0 0 3px rgba(43,74,107,.12)}',
      '.hs-rech-ex{position:absolute;left:36px;right:14px;top:0;height:100%;display:flex;align-items:center;overflow:hidden;',
      '  pointer-events:none;color:#646D7C;font:400 14px/1 Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;white-space:nowrap}',
      '.hs-rech-mot{display:inline-block;margin-left:.3em;transition:opacity .38s ease,transform .38s ease}',
      '.hs-rech-mot.sort{opacity:0;transform:translateY(-70%)}',
      '.hs-rech-mot.entre{opacity:0;transform:translateY(70%);transition:none}',
      '.hs-rech.actif .hs-rech-ex,.hs-rech.plein .hs-rech-ex{display:none}',
      '@media(prefers-reduced-motion:reduce){.hs-rech-mot{transition:none}}'
    ].join('\n');
    document.head.appendChild(css);

    var loupe = document.createElement('button');
    loupe.type = 'button'; loupe.className = 'hs-ico hs-loupe'; loupe.setAttribute('aria-label', 'Rechercher'); loupe.setAttribute('aria-expanded', 'false');
    loupe.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';
    var compte = document.createElement('a');
    compte.className = 'hs-ico hs-compte'; compte.href = '/espace-client'; compte.setAttribute('aria-label', 'Mon espace client');
    compte.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.7"/><path d="M4.8 20c.8-3.6 3.6-5.6 7.2-5.6s6.4 2 7.2 5.6"/></svg>';
    droite.insertBefore(compte, droite.firstChild);
    /* état de connexion du client : même icône partout, avec un point vert quand il est connecté */
    try {
      fetch('/api/espace/session', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        window.vespraClient = d && d.connecte ? d : null;
        if (window.vespraClient) { compte.classList.add('hs-on'); var mm = document.querySelector('.hs-m'); if (mm) mm.classList.add('hs-on'); compte.setAttribute('aria-label', 'Mon espace client (connecté)'); }
        document.dispatchEvent(new CustomEvent('vespra-client', { detail: window.vespraClient }));
      }).catch(function () {});
    } catch (e) {}
    droite.insertBefore(loupe, droite.firstChild);

    /* téléphone : les deux icônes quittent l'en-tête et passent dans le menu burger */
    var liens = document.getElementById('navLinks');
    if (liens) {
      var ic = function (d) { return '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" style="flex:none">' + d + '</svg>'; };
      var gr = function (svg, t) { return '<span style="display:inline-flex;align-items:center;gap:12px">' + svg + t + '</span>'; };
      var mc = document.createElement('a'); mc.href = '/espace-client'; mc.className = 'hs-m'; mc.innerHTML = gr('<span class="hs-mi" style="position:relative;display:inline-flex">' + ic('<circle cx="12" cy="8.5" r="3.7"/><path d="M4.8 20c.8-3.6 3.6-5.6 7.2-5.6s6.4 2 7.2 5.6"/>') + '</span>', 'Mon espace client');
      var pied = liens.querySelector('.nav-reserver-mobile') || liens.querySelector('.nav-menu-foot');
      liens.insertBefore(mc, pied);
    }
    var pan = document.createElement('div'); pan.className = 'hs-pan';
    var f = document.createElement('form');
    f.className = 'hs-rech'; f.setAttribute('role', 'search'); f.action = '/catalogue.html'; f.method = 'get';
    f.innerHTML =
      '<svg class="hs-rech-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>' +
      '<input class="hs-rech-in" type="search" name="q" autocomplete="off" enterkeyhint="search" aria-label="Rechercher un produit" maxlength="60">' +
      '<span class="hs-rech-ex" aria-hidden="true">Ex.<span class="hs-rech-mot"></span></span>';
    pan.appendChild(f); nav.appendChild(pan);
    /* téléphone : la barre de recherche est le premier élément du menu burger ; sur PC elle reste sous l'en-tête */
    var mq = window.matchMedia ? matchMedia('(max-width:960px)') : null;
    function placer() {
      var liens2 = document.getElementById('navLinks');
      if (mq && mq.matches && liens2) { if (f.parentNode !== liens2) liens2.insertBefore(f, liens2.firstChild); }
      else if (f.parentNode !== pan) pan.appendChild(f);
    }
    placer();
    if (mq) { if (mq.addEventListener) mq.addEventListener('change', placer); else if (mq.addListener) mq.addListener(placer); }

    var champ = f.querySelector('input'), mot = f.querySelector('.hs-rech-mot');
    var i = 0, minuteur = null;
    mot.textContent = EXEMPLES[0];

    function suivant() {
      if (f.classList.contains('actif') || champ.value) return;
      mot.classList.add('sort');
      setTimeout(function () {
        i = (i + 1) % EXEMPLES.length;
        mot.textContent = EXEMPLES[i];
        mot.classList.remove('sort'); mot.classList.add('entre');
        void mot.offsetWidth;
        mot.classList.remove('entre');
      }, 380);
    }
    function demarrer() {
      if (minuteur || (window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches)) return;
      minuteur = setInterval(suivant, 2600);
    }
    function arreter() { clearInterval(minuteur); minuteur = null; }
    if (mq && mq.matches) setTimeout(function () { demarrer(); }, 0);
    function ouvrir() { pan.classList.add('on'); loupe.setAttribute('aria-expanded', 'true'); demarrer(); }
    function fermer() { pan.classList.remove('on'); loupe.setAttribute('aria-expanded', 'false'); arreter(); }

    loupe.addEventListener('click', function (e) { e.stopPropagation(); pan.classList.contains('on') ? fermer() : ouvrir(); });
    pan.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', fermer);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer(); });

    champ.addEventListener('focus', function () { f.classList.add('actif'); arreter(); champ.placeholder = 'Rechercher un produit'; });
    champ.addEventListener('blur', function () {
      f.classList.remove('actif'); champ.placeholder = '';
      if (!champ.value && pan.classList.contains('on')) demarrer();
    });
    /* La recherche mène au produit, et uniquement au produit : des suggestions
       s'affichent en tapant, Entrée ouvre la première. */
    var sug = document.createElement('div'); sug.className = 'hs-sug'; f.appendChild(sug);
    var css2 = document.createElement('style');
    css2.textContent = '.hs-sug{position:absolute;left:0;right:0;top:44px;background:#fff;border:1px solid #e3e5ea;border-radius:14px;box-shadow:0 8px 20px rgba(20,24,35,.08);overflow:hidden;display:none;z-index:6}' +
      '.hs-sug.on{display:block}.hs-sug a,.hs-sug div{display:block;padding:10px 16px;font:14px Inter,system-ui,sans-serif;color:#2b303b;text-decoration:none}' +
      '.hs-sug a+a{border-top:1px solid #f0f1f4}.hs-sug a:hover,.hs-sug a.sel{background:#f4f5f7}.hs-sug small{color:#8a8f9b;margin-left:8px;font-size:12px}.hs-sug div{color:#8a8f9b}';
    document.head.appendChild(css2);
    var liste = null, chargement = null;
    function norm(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
    function produits() {
      if (liste) return Promise.resolve(liste);
      try { if (/catalogue/.test(location.pathname) && typeof PRODUCTS !== 'undefined' && PRODUCTS.length) { liste = PRODUCTS; return Promise.resolve(liste); } } catch (e) {}
      if (!chargement) chargement = fetch('/catalogue.html', { credentials: 'omit' }).then(function (r) { return r.text(); }).then(function (t) {
        var d = t.indexOf('const PRODUCTS=['); if (d < 0) return [];
        var fin = t.indexOf('\n];', d); if (fin < 0) return [];
        try { return (new Function('return ' + t.slice(d + 'const PRODUCTS='.length, fin + 2)))(); } catch (e) { return []; }
      }).then(function (l) { liste = l; return l; }).catch(function () { liste = []; return liste; });
      return chargement;
    }
    function trouver(q, l) {
      var termes = norm(q).split(/\s+/).filter(Boolean); if (!termes.length) return [];
      return l.map(function (p) {
        var nom = norm(p.name), autres = norm([].concat(p.cats || [p.cat], (p.variants || []).map(function (v) { return v.label; }), (p.options || []).map(function (o) { return o.label; })).join(' '));
        var ok = termes.every(function (t) { return nom.indexOf(t) >= 0 || autres.indexOf(t) >= 0; });
        return ok && p.page ? { p: p, r: termes.every(function (t) { return nom.indexOf(t) >= 0; }) ? 0 : 1 } : null;
      }).filter(Boolean).sort(function (a, b) { return a.r - b.r; }).slice(0, 6).map(function (x) { return x.p; });
    }
    var cur = [], sel = -1;
    function afficher() {
      var q = champ.value.trim();
      if (!q) { sug.classList.remove('on'); cur = []; return; }
      produits().then(function (l) {
        if (champ.value.trim() !== q) return;
        cur = trouver(q, l); sel = -1;
        sug.innerHTML = cur.length ? cur.map(function (p) { return '<a href="/' + String(p.page).replace(/^\//, '') + '">' + String(p.name).replace(/</g, '&lt;') + '<small>' + String(p.cat || '').replace(/</g, '&lt;') + '</small></a>'; }).join('') : '<div>Aucun produit ne correspond</div>';
        sug.classList.add('on');
      });
    }
    champ.addEventListener('input', function () { f.classList.toggle('plein', !!champ.value); afficher(); });
    champ.addEventListener('focus', function () { produits(); });
    champ.addEventListener('keydown', function (e) {
      var as = sug.querySelectorAll('a'); if (!as.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + as.length) % as.length;
        as.forEach(function (a, i) { a.classList.toggle('sel', i === sel); });
      }
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var as = sug.querySelectorAll('a'); var cible = as[sel >= 0 ? sel : 0];
      if (cible) { location.href = cible.getAttribute('href'); return; }
      afficher();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monter);
  else monter();
})();

/* ─────────────────────────────────────────────────────────────
   Client connecté : les formulaires de demande de devis se remplissent
   avec ses coordonnées (seulement les champs encore vides), et une
   ligne discrète indique qu'il est connecté.
   ───────────────────────────────────────────────────────────── */
(function () {
  function noms(n) {
    var m = String(n || '').trim().split(/\s+/).filter(Boolean);
    var maj = m.filter(function (x) { return x === x.toUpperCase() && /[A-ZÀ-Ý]/.test(x); });
    var pre = m.filter(function (x) { return maj.indexOf(x) < 0; });
    if (pre.length && maj.length) return { prenom: pre.join(' '), nom: maj.join(' ') };
    if (m.length > 1) return { prenom: m[m.length - 1], nom: m.slice(0, -1).join(' ') };
    return { prenom: m[0] || '', nom: '' };
  }
  function remplir(c) {
    if (!c) return;
    var x = noms(c.nom);
    var forms = document.querySelectorAll('form');
    [].forEach.call(forms, function (f) {
      var mail = f.querySelector('input[name="email"]');
      if (!mail || f.getAttribute('data-vc')) return;
      f.setAttribute('data-vc', '1');
      var poser = function (sel, v) {
        var e = f.querySelector(sel);
        if (e && v && !e.value) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }
      };
      poser('input[name="email"]', c.email);
      if (f.querySelector('input[name="prenom"]')) { poser('input[name="prenom"]', x.prenom); poser('input[name="nom"]', x.nom); }
      else poser('input[name="nom"]', (x.prenom + ' ' + x.nom).trim());
      poser('input[name="tel"]', c.telephone);
      poser('input[name="telephone"]', c.telephone);
      var ligne = document.createElement('p');
      ligne.className = 'hs-conn';
      ligne.style.cssText = 'margin:0 0 12px;font:500 12.5px/1.4 Inter,system-ui,sans-serif;color:#3d6e36;display:flex;align-items:center;gap:7px';
      ligne.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#3fae4a;flex:none"></span><span></span>';
      ligne.lastChild.textContent = 'Connecté en tant que ' + (x.prenom || c.email);
      var premier = mail.closest('.form-row') || mail;
      var nom0 = f.querySelector('input[name="prenom"]') || f.querySelector('input[name="nom"]');
      var ligneRef = (nom0 && nom0.closest('.form-row')) || premier;
      ligneRef.parentNode.insertBefore(ligne, ligneRef);
    });
  }
  document.addEventListener('vespra-client', function (e) { remplir(e.detail); });
  /* les fenêtres de devis se créent parfois après coup */
  document.addEventListener('click', function () { setTimeout(function () { remplir(window.vespraClient); }, 60); });
})();

/* ─────────────────────────────────────────────────────────────
   Demande de devis d'un client connecté : une copie est enregistrée
   tout de suite sur le serveur, pour qu'elle apparaisse aussitôt dans
   son espace (sans attendre la liste de Netlify Forms). L'identifiant
   « ref_espace » relie les deux : la copie s'efface dès que la vraie
   demande est listée.
   ───────────────────────────────────────────────────────────── */
(function () {
  window.vespraAvant = function (data) {
    try {
      var rid = (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).slice(0, 24);
      data.set('ref_espace', rid);
      return rid;
    } catch (e) { return ''; }
  };
  window.vespraApres = function (rid, data) {
    if (!rid) return;
    try {
      var g = function (k) { var v = data.get(k); return v == null ? '' : String(v); };
      var nom = (g('prenom') + ' ' + g('nom')).trim();
      fetch('/api/espace/demande-recue', { method: 'POST', credentials: 'same-origin', keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rid: rid, email: g('email'), nom: nom, date: g('date'), convives: g('convives'), type: g('type') || g('type-evenement'),
          livraison: g('livraison'), adresse: g('adresse_livraison'), panier: g('cartData'), message: g('message') }) }).catch(function () {});
    } catch (e) {}
  };
})();

/* ─────────────────────────────────────────────────────────────
   Bouton « Catalogue — Feuilleter » : ouvre le catalogue en fenêtre
   (pages en images, on glisse ou on utilise les flèches).
   ───────────────────────────────────────────────────────────── */
(function () {
  var N = 12, i = 0, ouvert = false, btn, ov, img, cpt;
  function css() {
    var s = document.createElement('style');
    s.textContent = [
      '.cat-fab-w{position:fixed;right:10px;bottom:10px;z-index:900}',
      '@media(max-width:640px){.cat-fab-w{display:none!important}}',
      '.cat-fab{display:flex;align-items:center;gap:7px;padding:5px 10px 5px 5px;background:#fff;border:1px solid #e3e5ea;border-radius:10px;box-shadow:0 2px 10px rgba(20,24,35,.1);font:500 11px/1.2 Inter,system-ui,sans-serif;color:#2b303b;cursor:pointer;text-align:left}',
      '.cat-fab-x{position:absolute;top:-7px;left:-7px;width:18px;height:18px;padding:0;border-radius:50%;border:1px solid #e3e5ea;background:#fff;color:#646D7C;font-size:10px;line-height:1;cursor:pointer}',
      '.cat-fab img{width:22px;height:31px;object-fit:cover;border-radius:4px;border:1px solid #e3e5ea}',
      '.cat-fab b{display:block;font-weight:600;font-size:11.5px}',
      '.cat-fab span{color:#646D7C;font-size:10px}',
      '.cat-ov{position:fixed;inset:0;z-index:2000;background:rgba(20,24,35,.6);display:none;align-items:center;justify-content:center;padding:14px;box-sizing:border-box}',
      '.cat-ov.on{display:flex}',
      '.cat-box{position:relative;max-width:560px;width:100%;max-height:100%;display:flex;flex-direction:column;align-items:center;gap:10px}',
      '.cat-box img{max-width:100%;max-height:calc(100vh - 110px);max-height:calc(100dvh - 110px);background:#fff;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.3);touch-action:none;transform-origin:0 0;will-change:transform;user-select:none;-webkit-user-drag:none}',
      '.cat-vp{overflow:hidden;border-radius:8px;max-width:100%;touch-action:none}',
      '.cat-vp.z{cursor:grab}',
      '.cat-bar{display:flex;align-items:center;gap:14px;color:#fff;font:500 12px Inter,system-ui,sans-serif}',
      '.cat-bar button,.cat-x{width:34px;height:34px;border-radius:50%;border:0;background:#fff;color:#2b303b;font-size:16px;line-height:1;cursor:pointer}',
      '.cat-x{position:absolute;top:-4px;right:-4px;z-index:2}',
      '.cat-bar a{color:#fff;text-decoration:underline;font-size:11px}',
    ].join('');
    document.head.appendChild(s);
  }
  function maj() { img.src = '/catalogue-pages/p' + (i + 1) + '.webp'; img.alt = 'Catalogue Vespra Event, page ' + (i + 1); cpt.textContent = (i + 1) + ' / ' + N; }
  var zoomReset = function () {};
  function aller(d) { i = (i + d + N) % N; maj(); zoomReset(); }
  function ouvrir() { ouvert = true; ov.classList.add('on'); maj(); }
  function fermer() { ouvert = false; ov.classList.remove('on'); zoomReset(); }
  function monter() {
    if (document.querySelector('.cat-fab') || /\/studio\//.test(location.pathname)) return;
    css();
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'cat-fab';
    btn.setAttribute('aria-label', 'Ouvrir le catalogue');
    btn.innerHTML = '<img src="/catalogue-pages/p1.webp" alt="" loading="lazy"><div><b>Catalogue</b><span>Feuilleter →</span></div>';
    ov = document.createElement('div'); ov.className = 'cat-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="cat-box"><button type="button" class="cat-x" aria-label="Fermer">✕</button><div class="cat-vp"><img alt="" draggable="false"></div><div class="cat-bar"><button type="button" data-z="-1" aria-label="Zoom arrière">−</button><button type="button" data-z="1" aria-label="Zoom avant">+</button><button type="button" data-d="-1" aria-label="Page précédente">‹</button><span class="cat-c"></span><button type="button" data-d="1" aria-label="Page suivante">›</button><a href="/Vespra_Event_Catalogue.pdf" target="_blank" rel="noopener">PDF</a></div></div>';
    img = ov.querySelector('img'); cpt = ov.querySelector('.cat-c');
    var cacheFab = false; try { cacheFab = sessionStorage.getItem('vespra_cat_fab') === '0'; } catch (e) {}
    var wrap = document.createElement('div'); wrap.className = 'cat-fab-w'; wrap.hidden = cacheFab;
    var cx = document.createElement('button'); cx.type = 'button'; cx.className = 'cat-fab-x'; cx.setAttribute('aria-label', 'Masquer'); cx.textContent = '✕';
    cx.addEventListener('click', function (e) { e.stopPropagation(); wrap.hidden = true; try { sessionStorage.setItem('vespra_cat_fab', '0'); } catch (er) {} });
    wrap.appendChild(btn); wrap.appendChild(cx);
    document.body.appendChild(wrap); document.body.appendChild(ov);
    btn.addEventListener('click', ouvrir);
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.classList.contains('cat-x')) return fermer();
      var d = e.target.getAttribute && e.target.getAttribute('data-d'); if (d) aller(+d);
    });
    document.addEventListener('keydown', function (e) {
      if (!ouvert) return;
      if (e.key === 'Escape') fermer(); else if (e.key === 'ArrowRight') aller(1); else if (e.key === 'ArrowLeft') aller(-1);
    });
    /* zoom : pincer, double appui, molette ou boutons − / + ; déplacement au doigt une fois zoomé */
    var vp = ov.querySelector('.cat-vp'), Z = 1, tx = 0, ty = 0, pts = {}, d0 = 0, z0 = 1, drag = null, dernier = 0, x0 = null, bouge = false;
    function borne() {
      var w = img.clientWidth, h = img.clientHeight;
      tx = Math.min(0, Math.max(w - w * Z, tx)); ty = Math.min(0, Math.max(h - h * Z, ty));
      if (Z <= 1) { tx = 0; ty = 0; }
    }
    function appliquer() { borne(); img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + Z + ')'; vp.classList.toggle('z', Z > 1); }
    function zoomer(nz, cx, cy) {
      nz = Math.min(3, Math.max(1, nz));
      var r = img.getBoundingClientRect(), ox = (cx === undefined ? r.left + r.width / 2 : cx), oy = (cy === undefined ? r.top + r.height / 2 : cy);
      var px = (ox - r.left) / Z, py = (oy - r.top) / Z;
      tx -= px * (nz - Z); ty -= py * (nz - Z); Z = nz; appliquer();
    }
    zoomReset = function () { Z = 1; tx = 0; ty = 0; appliquer(); };
    img.addEventListener('load', zoomReset);
    ov.addEventListener('click', function (e) { var z = e.target.getAttribute && e.target.getAttribute('data-z'); if (z) zoomer(Z + (+z) * 0.75); });
    vp.addEventListener('wheel', function (e) { e.preventDefault(); zoomer(Z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY); }, { passive: false });
    vp.addEventListener('pointerdown', function (e) {
      try { vp.setPointerCapture(e.pointerId); } catch (er) {}
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var k = Object.keys(pts);
      if (k.length === 2) { d0 = Math.hypot(pts[k[0]].x - pts[k[1]].x, pts[k[0]].y - pts[k[1]].y); z0 = Z; drag = null; }
      else { drag = { x: e.clientX, y: e.clientY, tx: tx, ty: ty }; x0 = e.clientX; bouge = false; }
    });
    vp.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var k = Object.keys(pts);
      if (k.length === 2 && d0) {
        var a = pts[k[0]], b = pts[k[1]];
        zoomer(z0 * Math.hypot(a.x - b.x, a.y - b.y) / d0, (a.x + b.x) / 2, (a.y + b.y) / 2); bouge = true;
      } else if (drag && Z > 1) { tx = drag.tx + (e.clientX - drag.x); ty = drag.ty + (e.clientY - drag.y); appliquer(); bouge = true; }
    });
    function fin(e) {
      var etait = Object.keys(pts).length; delete pts[e.pointerId]; d0 = 0;
      if (etait === 1) {
        var dx = e.clientX - x0;
        if (Z <= 1.02 && Math.abs(dx) > 40) { aller(dx < 0 ? 1 : -1); }
        else if (!bouge) {
          var t = Date.now();
          if (t - dernier < 320) { Z > 1 ? zoomReset() : zoomer(2.5, e.clientX, e.clientY); dernier = 0; } else dernier = t;
        }
      }
      var k = Object.keys(pts); if (k.length === 1) drag = { x: pts[k[0]].x, y: pts[k[0]].y, tx: tx, ty: ty }; else drag = null;
    }
    vp.addEventListener('pointerup', fin); vp.addEventListener('pointercancel', function (e) { delete pts[e.pointerId]; d0 = 0; drag = null; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monter); else monter();
})();
