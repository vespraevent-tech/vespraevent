/* ─────────────────────────────────────────────────────────────
   Apparence du site — couleurs, polices, taille du texte.

   Les couleurs et les polices d'origine restent écrites dans les
   pages : c'est ce que voit un visiteur si ce script ne s'exécute
   pas. Ce fichier applique par-dessus le réglage enregistré dans le
   back-office (/admin, onglet Apparence), et ne fait rien du tout
   tant qu'aucun réglage n'a été enregistré.

   Le dernier réglage connu est gardé dans le navigateur du visiteur,
   pour être appliqué immédiatement au chargement suivant sans
   attendre la réponse du serveur (évite un clignotement de couleur).
   ───────────────────────────────────────────────────────────── */
(function () {
  var CLE = 'vespra_theme';

  /* Teintes d'origine du site, regroupées par rôle. Quand une couleur
     est changée, chaque teinte de la famille est recalculée en gardant
     son écart d'origine (plus foncée, plus claire) avec la couleur de
     base — les survols et les aplats restent cohérents. */
  var FAMILLES = {
    primaire: { base: '#2B4A6B', teintes: ['#2B4A6B', '#1E3650', '#143A60', '#1E3C5C', '#16293E', '#1B2E4B', '#162540'] },
    accent:   { base: '#F59E0B', teintes: ['#F59E0B'] },
    texte:    { base: '#0C0F14', teintes: ['#0C0F14', '#0F1923'] },
  };
  var VARIABLES = { primaire: ['--navy'], accent: ['--gold'], texte: ['--black'] };

  /* ── conversions couleur ── */
  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgb2hex(r, g, b) {
    var c = function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); };
    return '#' + c(r) + c(g) + c(b);
  }
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2, d = mx - mn;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    if (!s) { var v = l * 255; return [v, v, v]; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    var f = function (t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  /* applique à `nouvelle` l'écart de luminosité/saturation qui sépare
     `teinte` de `base` */
  function deriver(base, teinte, nouvelle) {
    var b = rgb2hsl.apply(null, hex2rgb(base));
    var t = rgb2hsl.apply(null, hex2rgb(teinte));
    var n = rgb2hsl.apply(null, hex2rgb(nouvelle));
    var l = Math.max(0, Math.min(1, n[2] + (t[2] - b[2])));
    var s = Math.max(0, Math.min(1, n[1] + (t[1] - b[1])));
    /* Garde-fou de lisibilité : ces teintes servent de fond à des boutons
       dont le texte est blanc. Une couleur claire rendrait ce texte
       illisible. On assombrit donc juste ce qu'il faut pour garder un
       contraste suffisant avec le blanc (4,5 pour 1, le seuil courant
       d'accessibilité), sans changer la teinte choisie. */
    if (t[2] < 0.45) {
      for (var essai = 0; essai < 24 && contrasteBlanc(hsl2rgb(n[0], s, l)) < 4.5 && l > 0.04; essai++) {
        l -= 0.03;
      }
    }
    return rgb2hex.apply(null, hsl2rgb(n[0], s, l));
  }

  /* contraste entre une couleur et le blanc, au sens des règles
     d'accessibilité du web */
  function contrasteBlanc(rgb) {
    var c = rgb.map(function (v) {
      v = Math.max(0, Math.min(255, v)) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    var lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return 1.05 / (lum + 0.05);
  }

  /* ── construction de la table de remplacement ── */
  function table(reglage) {
    var map = {};
    Object.keys(FAMILLES).forEach(function (role) {
      var nouvelle = reglage[role];
      if (!nouvelle || nouvelle.toUpperCase() === FAMILLES[role].base.toUpperCase()) return;
      FAMILLES[role].teintes.forEach(function (t) {
        var remplacante = deriver(FAMILLES[role].base, t, nouvelle);
        map[t.toUpperCase()] = remplacante;
        /* le navigateur réécrit les couleurs des feuilles de style en
           rgb(...) : il faut donc aussi pouvoir les retrouver sous cette
           forme, en plus de l'hexadécimal des attributs style="…" */
        var c = hex2rgb(t);
        map['RGB:' + c[0] + ',' + c[1] + ',' + c[2]] = remplacante;
      });
    });
    return map;
  }

  /* réglages « de finition » : arrondi des boutons, police des sous-titres, pastille d'ajout.
     Appliqués avec le réglage enregistré, ou avec les valeurs d'origine quand il n'y en a pas. */
  function poser(id) {
    var e = document.getElementById(id);
    if (!e) { e = document.createElement('style'); e.id = id; document.head.appendChild(e); }
    return e;
  }
  function extras(reglage) {
    reglage = reglage || {};
  /* boutons : arrondi réglable depuis le back-office (8 px par défaut) ; cartes, champs et encarts : 8 px */
  var BOUTONS = '.hs-btn,.btn-p,.btn-o,.btn-submit,.reserver-btn,.cart-btn,.pa-btn,.xm-cta,.cs-empty-btn,.ez-btn,.hero-catalogue-pdf,.btn-add-cart,.vc-btn-primary,.vc-btn-secondary,.pr-btn,.pr-submit,.c-checkout,.var-chip,.opt-chip,.ez-chip,.btn-add,.bc-add,.comp-add,.comp-added,.bests-arrow,.c-cls,.vm-cls,.devis-popup-close,.hs-ico,.reco-btn,.cat-fab-x,.filter-search-clear,.hd-pp';
  var CARTES = '.comp-product,.cart-summary,.cs-items,.cart-more,.devis-popup-card,.c-item,.vc-livr,.prod-card,.cat-fab,.vm,.pc,.toast,.filter-search-in,.tarif-badge,.hero-eye,.vh-a,.prod-thumb,.comp-img,.vm-img';
  (function(){
    var rb = parseInt(reglage.bouton_arrondi, 10); if (isNaN(rb) || rb < 0) rb = 8;
    var st=poser('vespra-rayons');
    st.textContent=':root{--pill:8px}html:root:root:root:root:root body :is(' + BOUTONS + '){border-radius:' + rb + 'px!important}html:root:root:root:root:root body :is(' + CARTES + '){border-radius:8px!important}';
  })();

  /* police des sous-titres et petits textes (facultative : sinon, celle du texte) */
  (function(){
    var p = reglage.police_sous;
    if (!p || /["<>;{}]/.test(p)) return;
    if (!document.querySelector('link[data-theme-font="' + p + '"]')) {
      var l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=' + p.replace(/ /g, '+') + ':wght@300;400;500;600;700&display=swap';
      l.setAttribute('data-theme-font', p); document.head.appendChild(l);
    }
    var st = poser('vespra-police-sous');
    st.textContent = 'html body :is(.hero-eye,.hero-sub,.hs-sub,.sec-tag,.sec-sub,.sec-p,.prod-cat,.pc-cat,.eyebrow,.tarif-badge,.prods-sub,.section-sub,.lead){font-family:\'' + p + '\',Inter,system-ui,sans-serif!important}';
  })();

  /* pas de pastille noire « Ajouté » à chaque ajout au panier : les autres messages restent */
  (function(){
    var st=poser('vespra-toast-ajout');st.textContent='.toast.toast-ajout{display:none!important}';
    function veille(){
      var t=document.getElementById('toast');if(!t||t.__sansAjout)return;t.__sansAjout=true;
      function verifie(){var tx=(t.textContent||'').replace(/\s+/g,' ').trim();t.classList.toggle('toast-ajout',/^(✓\s*)?Ajout/i.test(tx));}
      new MutationObserver(verifie).observe(t,{childList:true,characterData:true,subtree:true});verifie();
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',veille);else veille();
  })();
  }
  var extrasFaits = false;
  function extrasOrigine() { if (!extrasFaits) { extrasFaits = true; try { extras({}); } catch (e) {} } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', extrasOrigine); else extrasOrigine();

  /* ── application ── */
  var POLICES_ORIGINE = { titres: 'Bebas Neue', texte: 'Inter' };
  /* L'apparence n'est posée qu'une fois par affichage : les couleurs
     écrites en dur dans les feuilles de style sont remplacées à partir
     de la palette d'origine, ce qu'un second passage ne saurait pas
     refaire. Pour montrer un réglage changé en cours de route, la page
     est rechargée (rechargerUneFois). */
  var deja = false;

  function appliquer(reglage) {
    if (!reglage || deja) return;
    deja = true;

    extrasFaits = true;
    try { extras(reglage); } catch (e) {}
    var map = table(reglage);
    var racine = document.documentElement;

    /* bandeau défilant du haut : masqué sur téléphone par défaut (règle dans
       chaque page), réaffiché si le back-office l'a activé */
    if (reglage.bandeau_mobile === 'oui') {
      var sb = document.createElement('style');
      sb.textContent = '@media(max-width:768px){.ticker{display:flex!important}}';
      document.head.appendChild(sb);
    }

    /* bandeau du haut masqué sur ordinateur si le back-office le demande */
    if (reglage.bandeau_pc === 'non') {
      var sp = document.createElement('style');
      sp.textContent = '@media(min-width:769px){.ticker{display:none!important}}';
      document.head.appendChild(sp);
    }

    /* 1. variables CSS */
    Object.keys(VARIABLES).forEach(function (role) {
      if (!reglage[role]) return;
      VARIABLES[role].forEach(function (v) { racine.style.setProperty(v, reglage[role]); });
    });
    if (reglage.primaire) {
      racine.style.setProperty('--navy-h', deriver(FAMILLES.primaire.base, '#1E3650', reglage.primaire));
    }
    if (reglage.arrondi) {
      var a = parseInt(reglage.arrondi, 10);
      if (!isNaN(a)) {
        racine.style.setProperty('--r', a + 'px');
        racine.style.setProperty('--rl', a + 'px');
      }
    }

    /* 2. polices : charge la nouvelle fonte si besoin */
    [reglage.police_titres, reglage.police_texte].forEach(function (p) {
      if (!p || p === POLICES_ORIGINE.titres || p === POLICES_ORIGINE.texte) return;
      if (document.querySelector('link[data-theme-font="' + p + '"]')) return;
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=' + p.replace(/ /g, '+') + ':wght@300;400;500;600;700;800&display=swap';
      l.setAttribute('data-theme-font', p);
      document.head.appendChild(l);
    });

    /* 3. réécriture des feuilles de style : couleurs en dur, polices, tailles */
    var taille = parseFloat(reglage.taille);
    if (!taille || isNaN(taille)) taille = 1;
    var besoinCss = Object.keys(map).length
      || (reglage.police_titres && reglage.police_titres !== POLICES_ORIGINE.titres)
      || (reglage.police_texte && reglage.police_texte !== POLICES_ORIGINE.texte)
      || taille !== 1;
    if (besoinCss) parcourirFeuilles(map, reglage, taille);

    /* 4. attributs style="…" écrits directement dans le HTML */
    if (Object.keys(map).length) remplacerStylesEnLigne(map);
  }

  function remplacerCouleurs(valeur, map) {
    valeur = valeur.replace(/#[0-9A-Fa-f]{6}\b/g, function (h) { return map[h.toUpperCase()] || h; });
    return valeur.replace(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.%]+)\s*)?\)/g,
      function (tout, r, g, b, a) {
        var neuf = map['RGB:' + r + ',' + g + ',' + b];
        if (!neuf) return tout;
        if (a === undefined) return neuf;
        var c = hex2rgb(neuf);
        return 'rgba(' + c[0] + ', ' + c[1] + ', ' + c[2] + ', ' + a + ')';
      });
  }

  function parcourirFeuilles(map, reglage, taille) {
    var feuilles = document.styleSheets;
    for (var i = 0; i < feuilles.length; i++) {
      var regles;
      try { regles = feuilles[i].cssRules; } catch (e) { continue; } /* feuille externe : inaccessible */
      if (regles) parcourirRegles(regles, map, reglage, taille);
    }
  }

  function parcourirRegles(regles, map, reglage, taille) {
    for (var i = 0; i < regles.length; i++) {
      var r = regles[i];
      /* attention : dans les navigateurs récents, une règle simple possède
         elle aussi un cssRules (vide) — d'où le test sur la longueur */
      if (r.cssRules && r.cssRules.length) parcourirRegles(r.cssRules, map, reglage, taille);
      var st = r.style;
      if (!st) continue;

      /* police */
      var ff = st.fontFamily;
      if (ff) {
        var prio = st.getPropertyPriority('font-family');
        if (reglage.police_titres && reglage.police_titres !== POLICES_ORIGINE.titres && ff.indexOf(POLICES_ORIGINE.titres) !== -1) {
          try { st.setProperty('font-family', "'" + reglage.police_titres + "', " + ff, prio); } catch (e) {}
        } else if (reglage.police_texte && reglage.police_texte !== POLICES_ORIGINE.texte && ff.indexOf(POLICES_ORIGINE.texte) !== -1) {
          try { st.setProperty('font-family', "'" + reglage.police_texte + "', " + ff, prio); } catch (e) {}
        }
      }

      /* taille du texte */
      if (taille !== 1 && st.fontSize && /px$/.test(st.fontSize)) {
        var px = parseFloat(st.fontSize);
        if (px) {
          try { st.setProperty('font-size', (Math.round(px * taille * 10) / 10) + 'px', st.getPropertyPriority('font-size')); } catch (e) {}
        }
      }

      /* couleurs en dur */
      if (!Object.keys(map).length) continue;
      for (var j = 0; j < st.length; j++) {
        var prop = st[j];
        var val = st.getPropertyValue(prop);
        if (!val || (val.indexOf('#') === -1 && val.indexOf('rgb') === -1)) continue;
        var neuf = remplacerCouleurs(val, map);
        if (neuf !== val) {
          try { st.setProperty(prop, neuf, st.getPropertyPriority(prop)); } catch (e) {}
        }
      }
    }
  }

  function remplacerStylesEnLigne(map) {
    var els = document.querySelectorAll('[style*="#"]');
    for (var i = 0; i < els.length; i++) {
      var v = els[i].getAttribute('style');
      var neuf = remplacerCouleurs(v, map);
      if (neuf !== v) els[i].setAttribute('style', neuf);
    }
  }

  /* Deux réglages peuvent se présenter avant que la page soit prête :
     celui gardé en mémoire de la visite précédente, puis celui du
     serveur. C'est le dernier connu qui doit être posé, sans quoi une
     apparence tout juste publiée resterait invisible jusqu'à la visite
     suivante. */
  var enAttente = null;
  function lancer(reglage) {
    if (!reglage) return;
    if (document.readyState === 'loading') {
      if (!enAttente) {
        document.addEventListener('DOMContentLoaded', function () { appliquer(enAttente); });
      }
      enAttente = reglage;
    } else {
      appliquer(reglage);
    }
  }

  /* ── mode aperçu ───────────────────────────────────────────────────
     La page est affichée dans le cadre d'aperçu du back-office
     (…?apercu=1). Elle n'applique alors pas l'apparence publiée mais le
     brouillon que l'admin lui envoie, et ne touche à rien d'autre. */
  var APERCU = /[?&]apercu=1/.test(location.search);
  if (APERCU) {
    var CLE_A = CLE + '_apercu';
    try {
      var brouillon = sessionStorage.getItem(CLE_A);
      if (brouillon) lancer(JSON.parse(brouillon));
    } catch (e) {}
    window.addEventListener('message', function (ev) {
      if (ev.origin !== location.origin) return;
      var d = ev.data;
      if (!d || d.type !== 'vespra-apercu') return;
      var avant = null;
      try { avant = sessionStorage.getItem(CLE_A); } catch (e) {}
      var neuf = JSON.stringify(d.theme || {});
      if (avant === neuf) return;
      try { sessionStorage.setItem(CLE_A, neuf); } catch (e) {}
      /* l'apparence se pose une seule fois par chargement : pour montrer
         un nouveau réglage, la page se recharge avec le brouillon en main */
      if (deja) location.reload(); else lancer(d.theme);
    });
    try { parent.postMessage({ type: 'vespra-apercu-pret' }, location.origin); } catch (e) {}
    return;
  }

  /* Signature indépendante de l'ordre des clés : comparer deux JSON bruts
     rechargerait la page en boucle si le serveur renvoyait un jour les
     mêmes valeurs dans un ordre différent. */
  function signature(t) {
    if (!t) return '';
    return Object.keys(t).filter(function (k) { return k.charAt(0) !== '_'; }).sort()
      .map(function (k) { return k + '=' + t[k]; }).join('|');
  }

  /* Un rechargement n'est tenté qu'une fois par signature : même en cas
     d'imprévu, la page ne peut pas se recharger sans fin. */
  function rechargerUneFois(sig) {
    try {
      if (sessionStorage.getItem(CLE + '_r') === sig) return;
      sessionStorage.setItem(CLE + '_r', sig);
    } catch (e) { return; }
    location.reload();
  }

  /* 1. réglage déjà connu : appliqué sans attendre le réseau */
  var sigCache = '';
  try {
    var cache = localStorage.getItem(CLE);
    if (cache) {
      var t0 = JSON.parse(cache);
      sigCache = signature(t0);
      lancer(t0);
    }
  } catch (e) {}

  /* 2. puis vérification auprès du serveur */
  /* le back-office charge ce fichier pour ses fonctions utilitaires, sans
     le chargeur de données : il n'y a alors rien à appliquer */
  if (typeof window.VESPRA_DONNEES !== 'function') return;

  window.VESPRA_DONNEES('theme')
    .then(function (t) {
      /* un réglage encore en brouillon n'est pas montré aux visiteurs */
      if (t && t.statut === 'brouillon') t = null;
      if (!t || !Object.keys(t).length) {
        try { localStorage.removeItem(CLE); } catch (e) {}
        if (sigCache) rechargerUneFois('');   /* apparence remise à zéro depuis l'admin */
        return;
      }
      var sig = signature(t);
      try { localStorage.setItem(CLE, JSON.stringify(t)); } catch (e) {}
      if (sig === sigCache) return;
      if (deja) rechargerUneFois(sig);        /* réglage modifié depuis la dernière visite */
      else lancer(t);
    })
    .catch(function () { /* silencieux : l'apparence d'origine reste affichée */ });

})();

/* ═══ Bandeau défilant du haut ═══════════════════════════════════════
   Messages, liens, affichage (ordinateur / téléphone) et vitesse se
   règlent dans la page « Bandeau » du back-office (réglage « bandeau »).
   Sans réglage, le bandeau reste celui écrit dans la page. Le dernier
   réglage connu est gardé dans le navigateur pour s'afficher sans
   attendre le réseau. */
(function () {
  var CLE = 'vespra_bandeau';
  var VITESSE = { lent: 30, normal: 55, rapide: 90 };   /* pixels par seconde */
  var fait = '';

  function liens(l) {
    l = String(l || '').trim();
    return /^(\/[^\s"<>]*|https:\/\/[^\s"<>]+|tel:[+0-9 ]+|mailto:[^\s"<>]+)$/.test(l) ? l : '';
  }
  function messages(cfg) {
    var m = [];
    try { m = JSON.parse(cfg.messages || '[]'); } catch (e) {}
    if (!Array.isArray(m)) return [];
    return m.map(function (x) { return { t: String((x && x.t) || '').trim().slice(0, 120), c: String((x && x.c) || '').trim().slice(0, 40), i: String((x && x.i) || ''), l: liens(x && x.l) }; })
      .filter(function (x) { return x.t; }).slice(0, 8);
  }
  /* petites icônes du bandeau, choisies d'après le texte du message */
  var ICO = {
    camion: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M3 7h11v9H3zM14 10h4l3 3v3h-7\"/><circle cx=\"7\" cy=\"18\" r=\"1.6\"/><circle cx=\"17\" cy=\"18\" r=\"1.6\"/></svg>",
    calendrier: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"4\" y=\"5\" width=\"16\" height=\"15\" rx=\"2\"/><path d=\"M4 10h16M9 3v4M15 3v4\"/></svg>",
    telephone: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z\"/></svg>",
    pourcent: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M19 5L5 19\"/><circle cx=\"7\" cy=\"7\" r=\"2.2\"/><circle cx=\"17\" cy=\"17\" r=\"2.2\"/></svg>",
    cadeau: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"3\" y=\"8\" width=\"18\" height=\"4\" rx=\"1\"/><path d=\"M12 8v13M5 12v8h14v-8M8 8a2.5 2.5 0 1 1 0-5c2 0 4 2.5 4 5 0-2.5 2-5 4-5a2.5 2.5 0 1 1 0 5\"/></svg>",
    etoile: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z\"/></svg>",
    coeur: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z\"/></svg>",
    lieu: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z\"/><circle cx=\"12\" cy=\"10\" r=\"2.2\"/></svg>",
    horloge: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/></svg>",
    eclair: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M13 3L5 13h6l-1 8 8-10h-6z\"/></svg>",
    check: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M8 12.5l3 3 5-6\"/></svg>",
    musique: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9 18V6l10-2v12\"/><circle cx=\"7\" cy=\"18\" r=\"2.2\"/><circle cx=\"17\" cy=\"16\" r=\"2.2\"/></svg>"
  };
  function icone(t) {
    if (/livr|d[ée]plac/i.test(t)) return ICO.camion;
    if (/rendez|visite|r[ée]serv/i.test(t)) return ICO.calendrier;
    if (/client|appel|t[ée]l|7j|contact/i.test(t)) return ICO.telephone;
    return '';
  }
  function noeud(x) {
    var el = document.createElement(x.l ? 'a' : 'span');
    el.className = 'tk-m';
    if (x.l) { el.setAttribute('href', x.l); if (/^https?:/.test(x.l)) { el.setAttribute('rel', 'noopener'); } }
    var ic = x.i ? (ICO[x.i] || '') : icone(x.t);
    if (ic) { var i = document.createElement('span'); i.className = 'tk-i'; i.innerHTML = ic; el.appendChild(i); }
    var t = document.createElement('strong'); t.className = 'tk-t';
    if (x.c && x.c !== x.t) {
      var lo = document.createElement('span'); lo.className = 'l-long'; lo.textContent = x.t;
      var co = document.createElement('span'); co.className = 'l-court'; co.textContent = x.c;
      t.appendChild(lo); t.appendChild(co);
    } else t.textContent = x.t;
    el.appendChild(t);
    return el;
  }
  function poser(cfg) {
    if (!cfg || typeof cfg !== 'object') return;
    var sig = JSON.stringify([cfg.pc, cfg.mobile, cfg.vitesse, cfg.messages]);
    if (sig === fait) return;
    var bandeau = document.querySelector('.ticker');
    if (!bandeau) return;
    fait = sig;

    /* affichage : ce réglage l'emporte sur les anciens menus de la page Apparence */
    var css = '';
    if (cfg.pc === 'non') css += '@media(min-width:769px){.ticker{display:none!important}}';
    if (cfg.pc === 'oui') css += '@media(min-width:769px){.ticker{display:flex!important}}';
    if (cfg.mobile === 'oui') css += '@media(max-width:768px){.ticker{display:flex!important}}';
    if (cfg.mobile === 'non') css += '@media(max-width:768px){.ticker{display:none!important}}';
    var st = document.getElementById('vsp-bandeau-css');
    if (!st) { st = document.createElement('style'); st.id = 'vsp-bandeau-css'; document.head.appendChild(st); }
    st.textContent = css;

    /* messages : des repères fixes séparés par un fin trait vertical.
       Les trois anciens messages défilants sont ignorés : le bandeau garde alors ses trois repères d'origine. */
    var liste = messages(cfg), inner = bandeau.querySelector('.ticker-inner');
    var anciens = /^(venez voir le mat[ée]riel avant de le louer|besoin d.[êe]tre guid[ée] \?|composez votre pack)$/i;
    if (!liste.length || !inner || liste.every(function (x) { return anciens.test(x.t); })) return;
    inner.textContent = '';
    liste.forEach(function (x, k) {
      if (k) { var s = document.createElement('span'); s.className = 'tk-s'; inner.appendChild(s); }
      inner.appendChild(noeud(x));
    });
  }

  function lancer() {
    try { var c = localStorage.getItem(CLE); if (c) poser(JSON.parse(c)); } catch (e) {}
    if (typeof window.VESPRA_DONNEES !== 'function') return;
    window.VESPRA_DONNEES('bandeau').then(function (b) {
      if (!b || !Object.keys(b).length) { try { localStorage.removeItem(CLE); } catch (e) {} return; }
      try { localStorage.setItem(CLE, JSON.stringify(b)); } catch (e) {}
      poser(b);
    }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lancer); else lancer();
})();
