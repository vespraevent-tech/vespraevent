/* ─────────────────────────────────────────────────────────────
   Ambiances du site — Halloween, Noël, Saint-Valentin, Pâques, sombre.

   Une seule ambiance est active à la fois. Elle vient du back-office
   (Personnalisation › Ambiance) : soit un choix manuel, soit le mode
   automatique qui suit le calendrier (hors des dates, le site reste
   standard). Le visiteur peut couper l'animation avec le petit bouton
   rond en bas à gauche ; son choix est gardé dans son navigateur.

   Pour prévisualiser : ajouter ?ambiance=noel à l'adresse d'une page.
   ───────────────────────────────────────────────────────────── */
(function () {
  var racine = document.documentElement;
  var CLE_CFG = 'vespra_ambiance_cfg', CLE_OFF = 'vespra_ambiance_off', CLE_ON = 'vespra_ambiance_on';
  /* démarrage d'office : réglé thème par thème dans le back-office (cfg.dem = {halloween:'0'} → éteint au départ, le visiteur peut l'allumer) */
  var cfgDem = {};
  function lireDem(cfg) { try { cfgDem = JSON.parse((cfg && cfg.dem) || '{}') || {}; } catch (e) { cfgDem = {}; } }
  function parDefautOff(t) { return cfgDem[t] === '0'; }
  function estCoupe(t) { if (/[?&]ambiance=/.test(location.search)) return false; return parDefautOff(t) ? lireLocal(CLE_ON) !== t : lireLocal(CLE_OFF) === t; }
  function basculerVisiteur(t) { var coupe = estCoupe(t); if (parDefautOff(t)) ecrireLocal(CLE_ON, coupe ? t : ''); else ecrireLocal(CLE_OFF, coupe ? '' : t); }
  var NOMS = { clair: 'Clair', sombre: 'Sombre', halloween: 'Halloween', noel: 'Noël', valentin: 'Saint-Valentin', paques: 'Pâques' };
  /* dates du mode automatique (mois-jour) ; Pâques suit le calendrier, il se calcule */
  var DATES = { halloween: ['10-15', '11-02'], noel: ['12-01', '01-05'], valentin: ['02-01', '02-14'] };

  function reduit() { return window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches; }
  function lireLocal(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ecrireLocal(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function alea(g) { var s = g; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  /* ── calendrier ── */
  function paquesDe(an) {                      /* algorithme de Meeus/Jones/Butcher */
    var a = an % 19, b = Math.floor(an / 100), c = an % 100, d = Math.floor(b / 4), e = b % 4,
        f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
        i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
        mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(an, mois - 1, jour);
  }
  function mj(txt, an) { var p = String(txt).split('-'); return new Date(an, +p[0] - 1, +p[1]); }
  function dans(date, deb, fin, an) {          /* une période peut chevaucher le 1er janvier */
    var d = mj(deb, an), f = mj(fin, an);
    f.setHours(23, 59, 59);
    if (f < d) { return date >= d || date <= f; }
    return date >= d && date <= f;
  }
  function themeAuto(date, dates) {
    var an = date.getFullYear(), t;
    dates = dates || {};
    for (t in DATES) {
      var p = dates[t] || DATES[t];
      if (dans(date, p[0], p[1], an)) return t;
    }
    var pq = paquesDe(an), deb = new Date(pq), fin = new Date(pq);
    deb.setDate(deb.getDate() - 10); fin.setDate(fin.getDate() + 1); fin.setHours(23, 59, 59);
    if (date >= deb && date <= fin) return 'paques';
    return '';
  }
  function cfgDates(cfg) {
    var r = {}; try { var d = JSON.parse(cfg.dates || '{}'); for (var t in DATES) if (d[t] && d[t].length === 2) r[t] = d[t]; } catch (e) {}
    return r;
  }
  function themeVoulu(cfg) {
    var m = /[?&]ambiance=(\w+)/.exec(location.search);
    if (m) return m[1] === 'clair' ? '' : m[1];
    cfg = cfg || {};
    if (cfg.mode === 'manuel') return cfg.choix && cfg.choix !== 'clair' && cfg.choix !== 'sombre' ? cfg.choix : '';
    return themeAuto(new Date(), cfgDates(cfg));
  }

  /* ── éléments communs : style, calque, bouton, traversée, jaillissement ── */
  var calque = null, actif = '', arret = [];   /* arret : fonctions qui nettoient l'ambiance en cours */
  var CSS_COMMUN = [
    '#am-btn,#am-btn2{position:fixed;left:14px;bottom:14px;z-index:99990;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#fff;color:#8a93a3;border:1px solid #e3e6ec;cursor:pointer;padding:0;box-shadow:0 1px 6px rgba(20,25,40,.14);transition:transform .2s,color .2s}',
    '#am-btn:hover,#am-btn2:hover{transform:scale(1.07)}#am-btn:focus-visible,#am-btn2:focus-visible{outline:2px solid #888;outline-offset:2px}',
    '#am-btn svg,#am-btn2 svg{width:22px;height:22px;display:block}',
    '#am-btn.am-on,#am-btn2.am-on{color:var(--am-c,#e8872a);border-color:var(--am-c,#e8872a)}',
    '#am-calque{position:fixed;inset:0;z-index:99970;pointer-events:none;overflow:hidden}',
    '#am-calque canvas{position:absolute;inset:0;width:100%;height:100%}',
    '.am-trav{position:absolute;left:0;top:90px;pointer-events:none;will-change:transform}',
    '.am-trav svg *{pointer-events:visiblePainted;cursor:pointer}',
    '.am-trav svg{display:block}',
    '.am-jail{position:absolute;pointer-events:none;opacity:0;animation:amJail 1.5s cubic-bezier(.2,.7,.4,1) forwards}',
    '@keyframes amJail{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--px),var(--py)) rotate(var(--pr));opacity:0}}',
    '.am-chute{position:absolute;top:-40px;opacity:0;animation:amChute linear infinite}',
    '.am-chute>svg{display:block;animation:amTourne 4s linear infinite}',
    '@keyframes amChute{0%{transform:translate(0,-40px);opacity:0}6%{opacity:.95}25%{transform:translate(var(--dv),27vh)}50%{transform:translate(calc(var(--dv)*-.6),54vh)}75%{transform:translate(calc(var(--dv)*.8),81vh)}94%{opacity:.95}100%{transform:translate(0,108vh);opacity:0}}',
    '@keyframes amTourne{to{transform:rotate(360deg)}}',
    '.am-mont{position:absolute;bottom:0;width:58vw;height:46vh;pointer-events:none;contain:layout paint}',
    '.am-mg{left:-8vw}.am-md{right:-8vw;transform:scaleX(-1)}',
    '.am-mont i{position:absolute;inset:0;will-change:transform,opacity}',
    '.am-mont i:nth-child(1){animation:amNue1 19s ease-in-out infinite alternate}',
    '.am-mont i:nth-child(2){animation:amNue2 27s ease-in-out infinite alternate;opacity:.8}',
    '@keyframes amNue1{from{transform:translate(-6%,0) scale(1);opacity:.65}to{transform:translate(8%,-4%) scale(1.12);opacity:1}}',
    '@keyframes amNue2{from{transform:translate(7%,2%) scale(1.25);opacity:.5}to{transform:translate(-7%,-5%) scale(1.4);opacity:.9}}',
    '.am-coin{position:absolute;bottom:0;pointer-events:none}',
    '.am-coin svg{display:block;width:120px;height:auto}',
    '.am-cg{left:60px}.am-cd{right:6px}',
    '@media(max-width:700px){.am-coin svg{width:64px}.am-cg{left:56px}}',
    '@media(prefers-reduced-motion:reduce){#am-calque *{animation:none!important}.am-chute,.am-trav{display:none}}'
  ].join('\n');
  function injecterStyle(id, css) {
    if (document.getElementById(id)) return;
    var s = document.createElement('style'); s.id = id; s.textContent = css; document.head.appendChild(s);
  }
  function fairecalque() {
    if (calque && calque.isConnected) return calque;
    injecterStyle('am-style', CSS_COMMUN);
    calque = document.createElement('div'); calque.id = 'am-calque'; calque.setAttribute('aria-hidden', 'true');
    document.body.appendChild(calque); return calque;
  }
  function viderCalque() { if (calque) { calque.remove(); calque = null; } }

  /* petits objets qui tombent (bonbons, œufs, pétales…) : fabrique(i) renvoie le code SVG */
  function chute(n, graine, fabrique) {
    var r = alea(graine), h = '', i, rd = function (a) { return Math.round((r() - .5) * a); };
    for (i = 0; i < n; i++) {
      h += '<span class="am-chute" style="left:' + Math.round(r() * 96) + '%;--dv:' + rd(160) + 'px;animation-duration:' + (11 + Math.round(r() * 10)) + 's;animation-delay:-' + Math.round(r() * 20) + 's">' + fabrique(i) + '</span>';
    }
    return h;
  }

  /* personnage qui traverse l'écran, de gauche à droite, sans s'arrêter.
     Un clic : il lâche une poignée d'objets et fait demi-tour. */
  function traversee(opt) {
    var c = fairecalque(), L = window.innerWidth, H = window.innerHeight, ech = L < 700 ? (opt.ech || .85) * .7 : opt.ech || .85;
    var larg = opt.larg * ech, x = -larg - 20, dir = 1, vit = opt.vit || Math.max(340, L / 2.5), vivant = true, demi = 0, dernier = 0;
    var base = Math.round(110 + Math.random() * Math.max(60, H * (opt.sol ? .1 : .4)));
    var w = document.createElement('div'); w.className = 'am-trav';
    var P = 0, parts = null;
    if (opt.sol) { w.style.top = 'auto'; w.style.bottom = '8px'; } else { w.style.top = base + 'px'; }
    w.innerHTML = '<div class="am-trav-in">' + opt.svg(larg, opt.haut * ech) + '</div>';
    c.appendChild(w);
    function pas(t) {
      if (!vivant || !w.isConnected) return;
      if (!dernier) dernier = t;
      var dt = Math.min(.05, (t - dernier) / 1000); dernier = t;
      x += dir * vit * dt; P += vit * dt;
      if (demi > 0) demi = Math.max(0, demi - dt);
      var sx = demi > 0 ? dir * (1 - 2 * demi / .45) : dir, sn = opt.saut ? Math.sin(x / opt.saut) : 0;
      /* le lapin s'étire en l'air et s'écrase à l'atterrissage */
      w.firstChild.style.transform = 'scaleX(' + sx + ')' + (opt.saut ? ' rotate(' + (-9 * Math.cos(x / opt.saut) * (sn < 0 ? -1 : 1)).toFixed(1) + 'deg) scaleY(' + (1 + .08 * Math.abs(sn) - .06 * (1 - Math.abs(sn))).toFixed(3) + ')' : '');
      var dy = opt.saut ? -Math.abs(sn) * (opt.amp || 34) : 0;
      if (opt.anim) {
        if (!parts) parts = [].map.call(w.querySelectorAll('.an'), function (e) { var q = e.getAttribute('data-p').split(' '); return { e: e, x: +q[0], y: +q[1], a: +e.getAttribute('data-a'), ph: +e.getAttribute('data-ph'), f: +e.getAttribute('data-f'), o: +e.getAttribute('data-o'), dy: +e.getAttribute('data-dy') }; });
        var T = opt.saut ? P / (Math.PI * opt.saut) : t / 1000;
        for (var k = 0; k < parts.length; k++) {
          var q = parts[k], sv = Math.sin(6.2832 * q.f * T + q.ph);
          q.e.setAttribute('transform', (q.dy ? 'translate(0 ' + (q.dy * sv).toFixed(2) + ') ' : '') + 'translate(' + q.x + ' ' + q.y + ') rotate(' + (q.o + q.a * sv).toFixed(2) + ') translate(' + -q.x + ' ' + -q.y + ')');
        }
        var om = w.querySelector('.lom');
        if (om) { var hh = Math.abs(Math.sin(x / opt.saut)); om.setAttribute('transform', 'translate(76 124) scale(' + (1 - .35 * hh).toFixed(2) + ' 1) translate(-76 -124)'); om.setAttribute('opacity', (.2 - .1 * hh).toFixed(2)); }
      }
      w.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0)';
      if ((dir > 0 && x > L + 40) || (dir < 0 && x < -larg - 40)) { vivant = false; w.remove(); setTimeout(function () { if (actif === opt.theme) traversee(opt); }, 500); return; }
      requestAnimationFrame(pas);
    }
    requestAnimationFrame(pas);
    w.addEventListener('click', function () {
      var rc = w.getBoundingClientRect();
      jaillir(c, rc.left + rc.width * .45, rc.top + rc.height * .6, opt.objets, 16);
      if (demi <= 0) { dir = -dir; demi = .45; }
    });
    arret.push(function () { vivant = false; });
  }
  function jaillir(c, x0, y0, fabrique, n) {
    for (var i = 0; i < n; i++) {
      var b = document.createElement('span'); b.className = 'am-jail';
      b.style.left = x0 + 'px'; b.style.top = y0 + 'px';
      b.style.setProperty('--px', Math.round((Math.random() - .5) * 260) + 'px');
      b.style.setProperty('--py', Math.round(60 + Math.random() * 280) + 'px');
      b.style.setProperty('--pr', Math.round((Math.random() - .5) * 720) + 'deg');
      b.innerHTML = fabrique(i); c.appendChild(b);
      (function (e) { setTimeout(function () { e.remove(); }, 1700); })(b);
    }
  }

  /* ═══════════════ NOËL ═══════════════ */
  var CSS_NOEL = [
    '.nl-guirl{position:absolute;left:0;top:0;width:100%;height:30px;pointer-events:none}',
    '.nl-ampoule{animation:nlClig 2.4s ease-in-out infinite}',
    '@keyframes nlClig{0%,100%{opacity:1}50%{opacity:.35}}',
    '.nl-pend{position:absolute;top:0;transform-origin:50% 0;animation:nlBal 5.5s ease-in-out infinite}',
    '@keyframes nlBal{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}',
    '.nl-pend .nl-fil{position:absolute;left:50%;bottom:100%;width:1px;height:600px;margin-left:-.5px;background:linear-gradient(rgba(60,60,70,0),rgba(150,150,160,.7) 35%)}',
    '.nl-sapin{filter:drop-shadow(0 3px 6px rgba(20,30,50,.35))}'
  ].join('\n');
  var SAPIN = '<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><defs>' +
    '<linearGradient id="nlv" x1="0" x2="1"><stop offset="0" stop-color="#2f8a4f"/><stop offset=".45" stop-color="#1f6d3d"/><stop offset="1" stop-color="#0d3a20"/></linearGradient>' +
    '<linearGradient id="nlv2" x1="0" x2="1"><stop offset="0" stop-color="#3da061"/><stop offset=".5" stop-color="#257a47"/><stop offset="1" stop-color="#103f24"/></linearGradient>' +
    '<linearGradient id="nlt" x1="0" x2="1"><stop offset="0" stop-color="#8a5a2c"/><stop offset=".5" stop-color="#5e3a18"/><stop offset="1" stop-color="#3a220d"/></linearGradient>' +
    '<radialGradient id="nlg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".35" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="nlb" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".3" stop-color="#fff" stop-opacity=".1"/><stop offset=".65" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>' +
    '<radialGradient id="nle" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6c2"/><stop offset=".45" stop-color="#ffd34a"/><stop offset="1" stop-color="#c88a10"/></radialGradient>' +
    '</defs>' +
    '<ellipse cx="60" cy="140" rx="46" ry="6" fill="#0b1c33" opacity=".28"/>' +
    '<rect x="53" y="118" width="14" height="20" rx="2" fill="url(#nlt)"/>' +
    '<path d="M60 60L8 122c20-8 34-10 52-10s32 2 52 10z" fill="url(#nlv)"/>' +
    '<path d="M60 42L16 98c16-7 30-9 44-9s28 2 44 9z" fill="url(#nlv2)"/>' +
    '<path d="M60 24L24 72c14-6 24-8 36-8s22 2 36 8z" fill="url(#nlv)"/>' +
    '<path d="M60 6L32 46c10-5 18-6 28-6s18 1 28 6z" fill="url(#nlv2)"/>' +
    '<path d="M60 6L32 46c10-5 18-6 28-6s18 1 28 6zM60 24L24 72c14-6 24-8 36-8s22 2 36 8zM60 42L16 98c16-7 30-9 44-9s28 2 44 9zM60 60L8 122c20-8 34-10 52-10s32 2 52 10z" fill="#000" opacity="0"/>' +
    '<path d="M60 8L44 30c5 4 11 5 16 3 6 2 12 1 17-3zM60 26L40 52c6 5 13 6 20 4 7 2 14 1 20-4zM60 44L34 76c8 6 17 7 26 5 9 2 18 1 26-5zM60 62L26 104c10 7 22 8 34 6 12 2 24 1 34-6z" fill="#fff" opacity=".93"/>' +
    '<path d="M16 100c14 10 30 14 44 12M30 66c8 5 18 7 30 6M40 42c6 4 12 5 20 4" stroke="#bcd7ee" stroke-width="1.400" fill="none" opacity=".7"/>' +
    '<path d="M24 62Q60 86 98 58M14 92Q58 122 106 90M34 36Q60 52 86 34" stroke="#f2c14e" stroke-width="2.200" fill="none" stroke-dasharray="1.500 5" stroke-linecap="round"/>' +
    '<g class="nl-ampoule"><circle cx="46" cy="50" r="9" fill="url(#nlg)"/><circle cx="46" cy="50" r="2.800" fill="#ff5a5a"/></g>' +
    '<g class="nl-ampoule" style="animation-delay:-.8s"><circle cx="72" cy="66" r="9" fill="url(#nlg)"/><circle cx="72" cy="66" r="2.800" fill="#5ab4ff"/></g>' +
    '<g class="nl-ampoule" style="animation-delay:-1.6s"><circle cx="40" cy="88" r="9" fill="url(#nlg)"/><circle cx="40" cy="88" r="2.800" fill="#ffe066"/></g>' +
    '<g class="nl-ampoule" style="animation-delay:-.4s"><circle cx="80" cy="92" r="9" fill="url(#nlg)"/><circle cx="80" cy="92" r="2.800" fill="#7dffb0"/></g>' +
    '<g class="nl-ampoule" style="animation-delay:-2s"><circle cx="58" cy="30" r="8" fill="url(#nlg)"/><circle cx="58" cy="30" r="2.400" fill="#ff8ad8"/></g>' +
    '<g class="nl-ampoule" style="animation-delay:-1.2s"><circle cx="60" cy="102" r="9" fill="url(#nlg)"/><circle cx="60" cy="102" r="2.800" fill="#ff5a5a"/></g>' +
    '<g><circle cx="30" cy="110" r="6.500" fill="#d52b32"/><circle cx="30" cy="110" r="6.500" fill="url(#nlb)"/><circle cx="90" cy="108" r="6.500" fill="#e8a31f"/><circle cx="90" cy="108" r="6.500" fill="url(#nlb)"/><circle cx="52" cy="74" r="5.500" fill="#3f7fd6"/><circle cx="52" cy="74" r="5.500" fill="url(#nlb)"/><circle cx="68" cy="46" r="4.800" fill="#d52b32"/><circle cx="68" cy="46" r="4.800" fill="url(#nlb)"/></g>' +
    '<circle cx="60" cy="4" r="17" fill="url(#nlg)" opacity=".8"/>' +
    '<path d="M60 -6l3.600 8.800 9.400.8-7.200 6.200 2.200 9.200L60 18l-8 5 2.200-9.200-7.200-6.200 9.400-.8z" transform="translate(0 4) scale(1)" fill="url(#nle)" stroke="#b9780c" stroke-width=".7"/>' +
    '</svg>';
  var BOULE = function (c, r) {
    r = r || 18;
    return '<svg viewBox="0 0 40 54" width="' + r * 1.6 + '" height="' + r * 2.16 + '"><defs><linearGradient id="nlcap" x1="0" x2="1"><stop offset="0" stop-color="#b9831c"/><stop offset=".4" stop-color="#ffe29a"/><stop offset="1" stop-color="#9a6a12"/></linearGradient><radialGradient id="nlbs" cx=".34" cy=".28" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".22" stop-color="#fff" stop-opacity=".18"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient></defs>' +
      '<path d="M20 1.500c3.500 0 4.500 3 1.500 4" stroke="#caa04a" stroke-width="1.200" fill="none"/>' +
      '<rect x="15.500" y="5" width="9" height="8" rx="2" fill="url(#nlcap)"/><rect x="15" y="10.500" width="10" height="2" rx="1" fill="#8a5c0e" opacity=".5"/>' +
      '<circle cx="20" cy="33" r="19" fill="' + c + '"/><circle cx="20" cy="33" r="19" fill="url(#nlbs)"/>' +
      '<path d="M2.500 31c5 6 11 8 17.500 8s12.500-2 17.500-8" stroke="#fff" stroke-opacity=".28" stroke-width="3" fill="none"/>' +
      '<path d="M5 36c3 8 9 12 15 12s12-4 15-12" stroke="#fff" stroke-opacity=".22" stroke-width="1.600" fill="none"/>' +
      '<ellipse cx="12.500" cy="24" rx="4.200" ry="7" fill="#fff" opacity=".6" transform="rotate(28 12.500 24)"/><circle cx="10" cy="19" r="1.600" fill="#fff"/>' +
      '<path d="M30 46c-3 3-7 4-10 4" stroke="#fff" stroke-opacity=".35" stroke-width="1.400" fill="none" stroke-linecap="round"/></svg>';
  };
  var CADEAU = function (i) {
    var c = [['#e8444a', '#a8161d'], ['#3aa564', '#1b6a3a'], ['#5b8ee6', '#2c56a8'], ['#f0b73a', '#b9780c']][i % 4], k = 'cd' + (i % 4);
    return '<svg viewBox="0 0 32 34" width="28" height="30"><defs><linearGradient id="' + k + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient></defs>' +
      '<ellipse cx="16" cy="32" rx="12" ry="1.800" fill="#000" opacity=".2"/>' +
      '<rect x="3" y="14" width="26" height="17" rx="2" fill="url(#' + k + ')"/><rect x="2" y="9.500" width="28" height="7" rx="2" fill="url(#' + k + ')"/>' +
      '<rect x="2" y="15" width="28" height="1.800" fill="#000" opacity=".18"/>' +
      '<rect x="13.500" y="9.500" width="5" height="21.500" fill="#fff7e0"/><rect x="13.500" y="9.500" width="2" height="21.500" fill="#fff" opacity=".6"/>' +
      '<path d="M16 9.500C9 0 3 6 11 9.500zM16 9.500C23 0 29 6 21 9.500z" fill="#fff7e0" stroke="#e5d7a8" stroke-width=".6"/><circle cx="16" cy="9.500" r="2.400" fill="#fff"/>' +
      '<rect x="4.500" y="16" width="3" height="12" rx="1.500" fill="#fff" opacity=".28"/></svg>';
  };
  /* pièce animée : tourne autour de (px,py) ; angle = off + amp·sin(2π·f·T + ph) ; dy = rebond vertical */
  function an(px, py, amp, ph, f, off, dy, inner) {
    return '<g class="an" data-p="' + px + ' ' + py + '" data-a="' + amp + '" data-ph="' + ph + '" data-f="' + f + '" data-o="' + off + '" data-dy="' + (dy || 0) + '">' + inner + '</g>';
  }
  /* ── renne (vu de profil, regarde vers la droite) ── */
  function renne(ox, oy, sc, rouge, ph) {
    var f = 2.1, fo = '#5a3418', br = 'url(#rbd)', pe = '#7a4a24';
    var patte = function (hx, hy, p, sombre) {
      var c = sombre ? '#4d2c14' : '#8a5530';
      return '<g transform="translate(' + hx + ' ' + hy + ')">' + an(0, 0, 36, p, f, 0, 0,
        '<path d="M0 0L0 23" stroke="' + c + '" stroke-width="8" stroke-linecap="round"/>' +
        an(0, 23, 30, p + 1.1, f, 26, 0,
          '<path d="M0 0L0 22" stroke="' + c + '" stroke-width="5" stroke-linecap="round"/><path d="M-3 21h6l1 7h-8z" fill="#241309"/>')) + '</g>';
    };
    var ram = function (c, w) {
      return '<g stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M102 15C95 4 100-8 93-19"/><path d="M99 4C105 1 108-4 109-11"/><path d="M96-6L89-9"/><path d="M94-13C99-16 101-21 100-27"/><path d="M98 9C92 8 88 10 86 14"/></g>';
    };
    var g = '<g transform="translate(' + ox + ' ' + oy + ') scale(' + sc + ')">';
    g += an(60, 55, 0, 0, f * 1, 0, 2.2, '');   /* repère de rebond non utilisé */
    var corps = '';
    corps += '<g opacity=".95">' + ram('#bfa57a', 2.4).replace(/<g /, '<g transform="translate(-5 2)" ') + '</g>';
    corps += patte(40, 62, ph + 3.14, true) + patte(86, 62, ph, true);
    corps += '<path d="M24 44c-6-2-10 0-12 4 5 0 8 1 12 3z" fill="#f4ead8"/>';                          /* queue */
    corps += '<ellipse cx="58" cy="52" rx="37" ry="18.500" fill="' + br + '"/>';
    corps += '<ellipse cx="60" cy="62" rx="30" ry="8" fill="#e8d2ae" opacity=".55"/>';
    corps += '<path d="M30 44c10-6 24-8 36-6" stroke="#fff" stroke-opacity=".22" stroke-width="3" fill="none" stroke-linecap="round"/>';
    corps += '<path d="M80 44C88 38 94 30 98 22L113 29C107 39 101 52 94 64C88 60 82 54 80 44z" fill="' + br + '"/>';
    corps += '<path d="M92 40c6 2 10 8 10 16-4 4-8 6-12 8-2-8-2-16 2-24z" fill="#f4e8d2"/>';                /* collerette */
    corps += patte(34, 62, ph, false) + patte(80, 62, ph + 3.14, false);
    /* harnais */
    corps += '<path d="M62 35C66 44 66 56 62 68" stroke="#c4232b" stroke-width="3.600" fill="none"/><path d="M84 42C88 50 90 58 90 66" stroke="#c4232b" stroke-width="4" fill="none"/>';
    corps += '<circle cx="90" cy="68" r="4" fill="#e9b73a"/><circle cx="89" cy="67" r="1.400" fill="#fff6c8"/><path d="M90 66v5" stroke="#9a6a12" stroke-width=".8"/>';
    corps += '<circle cx="62" cy="68" r="3" fill="#e9b73a"/>';
    /* tête */
    var tete = '';
    tete += ram(rouge ? '#e5d2a8' : '#e5d2a8', 3.200);
    tete += '<path d="M99 15c-6-7-12-5-12 1 2 5 8 6 12 3z" fill="#9a6a3a"/><path d="M97 14c-4-4-8-3-8 0 1 3 5 4 8 2z" fill="#e7a6a0"/>';
    tete += '<ellipse cx="106" cy="25" rx="12.500" ry="9.500" transform="rotate(22 106 25)" fill="' + br + '"/>';
    tete += '<ellipse cx="117" cy="31" rx="8.500" ry="6.200" transform="rotate(18 117 31)" fill="#d3a674"/>';
    tete += '<path d="M112 36c3 2 7 2 10 0" stroke="#5a3418" stroke-width="1" fill="none" stroke-linecap="round"/>';
    if (rouge) tete += '<circle cx="124" cy="31" r="11" fill="url(#rnz)" class="rl-nez"/><circle cx="124" cy="31" r="4" fill="#ff3b3b"/><circle cx="122.800" cy="29.800" r="1.300" fill="#fff"/>';
    else tete += '<circle cx="124" cy="31" r="3.400" fill="#2a1a14"/><circle cx="123" cy="30" r="1" fill="#fff" opacity=".7"/>';
    tete += '<ellipse cx="107" cy="21" rx="2.800" ry="3.200" fill="#1b100a"/><circle cx="108" cy="19.800" r="1.100" fill="#fff"/>';
    tete += '<path d="M104 17c2-2 5-2 7-1" stroke="#3a2210" stroke-width="1.100" fill="none" stroke-linecap="round"/>';
    g += corps + an(96, 36, 4.500, ph + .6, f, 0, 0, tete);
    return g + '</g>';
  }
  var TRAINEAU_SVG = (function () {
    var s = '<svg viewBox="0 0 660 200" width="WW" height="HH" xmlns="http://www.w3.org/2000/svg"><defs>' +
      '<linearGradient id="rbd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c58a52"/><stop offset=".55" stop-color="#9a6234"/><stop offset="1" stop-color="#6e4120"/></linearGradient>' +
      '<radialGradient id="rnz" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff4040" stop-opacity=".9"/><stop offset="1" stop-color="#ff4040" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="trg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ee4a4e"/><stop offset=".55" stop-color="#c3222a"/><stop offset="1" stop-color="#85101a"/></linearGradient>' +
      '<linearGradient id="tro" x1="0" x2="1"><stop offset="0" stop-color="#a97614"/><stop offset=".45" stop-color="#ffe08a"/><stop offset="1" stop-color="#b8861c"/></linearGradient>' +
      '<radialGradient id="tpe" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ffe3c8"/><stop offset="1" stop-color="#e8b28c"/></radialGradient>' +
      '<linearGradient id="tsa" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9a06a"/><stop offset="1" stop-color="#8a6034"/></linearGradient></defs>';
    /* rênes */
    s += '<path d="M176 98C260 80 330 70 380 78C420 72 470 70 520 80" stroke="#e0a82e" stroke-width="1.600" fill="none"/>';
    s += renne(200, 34, .86, false, 0) + renne(330, 30, .9, false, 1.6) + renne(470, 26, .96, true, 3.1);
    /* traîneau */
    var t = '';
    t += '<path d="M6 178C60 190 150 188 200 168C216 162 214 148 200 146C190 146 188 154 196 158" stroke="url(#tro)" stroke-width="6" fill="none" stroke-linecap="round"/>';
    t += '<path d="M40 170v-14M100 176v-16M160 170v-16" stroke="#b8861c" stroke-width="4" stroke-linecap="round"/>';
    t += '<path d="M20 160L14 104C70 124 140 124 192 98C194 128 184 152 160 160z" fill="url(#trg)"/>';
    t += '<path d="M14 104C70 124 140 124 192 98" stroke="url(#tro)" stroke-width="5" fill="none" stroke-linecap="round"/>';
    t += '<path d="M24 138C70 150 130 150 178 130" stroke="url(#tro)" stroke-width="2.600" fill="none"/>';
    t += '<path d="M30 126c3-8 10-8 14 0M52 132c3-8 10-8 14 0M74 135c3-8 10-8 14 0M96 136c3-8 10-8 14 0M118 134c3-8 10-8 14 0M140 130c3-8 10-8 14 0" stroke="#ffe08a" stroke-width="1.600" fill="none"/>';
    t += '<path d="M192 98c10-8 6-22-6-20" stroke="url(#tro)" stroke-width="4.500" fill="none" stroke-linecap="round"/>';
    t += '<ellipse cx="100" cy="120" rx="80" ry="5" fill="#fff" opacity=".12"/>';
    /* hotte de cadeaux */
    t += '<path d="M24 108C14 76 34 62 58 66C82 70 90 94 80 112z" fill="url(#tsa)"/><path d="M44 66c4-8 14-8 20-2" stroke="#6d4a26" stroke-width="3" fill="none"/><path d="M34 82c6 10 20 14 34 10" stroke="#fff" stroke-opacity=".25" stroke-width="2" fill="none"/>';
    t += '<rect x="40" y="52" width="16" height="14" rx="2" fill="#3aa564"/><rect x="46" y="52" width="4" height="14" fill="#fff7e0"/><rect x="60" y="56" width="14" height="12" rx="2" fill="#5b8ee6"/><rect x="65" y="56" width="4" height="12" fill="#fff7e0"/>';
    /* le Père Noël */
    var pn = '';
    pn += '<path d="M108 120C100 100 108 80 132 78C154 78 160 104 152 122z" fill="url(#trg)"/>';
    pn += '<path d="M108 118C124 124 142 124 154 118" stroke="#fff" stroke-width="6" fill="none"/><rect x="116" y="104" width="30" height="6" rx="3" fill="#2a1a14"/><rect x="127" y="103" width="8" height="8" rx="1.500" fill="url(#tro)"/>';
    pn += '<circle cx="136" cy="62" r="14" fill="url(#tpe)"/><circle cx="141" cy="62" r="2.200" fill="#1b100a"/><circle cx="141.800" cy="61.200" r=".8" fill="#fff"/><circle cx="143" cy="68" r="3.200" fill="#f0a08a"/><circle cx="148" cy="64" r="3.600" fill="#f7b3a0" opacity=".7"/>';
    pn += '<path d="M124 64c-2 14 4 26 16 28 10-1 16-10 14-22-4 6-10 8-16 8-6 0-12-4-14-14z" fill="#fff"/><path d="M136 70c6 0 10-2 14-4" stroke="#e5e0d8" stroke-width="1.600" fill="none"/><ellipse cx="146" cy="69" rx="5" ry="2.200" fill="#fff"/>';
    pn += an(136, 50, 5, 0, 1.1, 0, 0, '<path d="M120 54C122 36 134 26 148 30C152 38 152 46 152 54z" fill="url(#trg)"/><rect x="118" y="50" width="38" height="9" rx="4.500" fill="#fff"/><path d="M148 30C158 26 168 34 166 46" stroke="#c3222a" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="167" cy="48" r="6" fill="#fff"/>');
    pn += an(146, 90, 7, 1, 2.1, -8, 0, '<path d="M146 90C160 90 170 88 182 92" stroke="#b6161f" stroke-width="9" stroke-linecap="round"/><circle cx="184" cy="92" r="5" fill="#2a1a14"/>');
    t += pn;
    s += an(100, 168, 1.600, 0, 1.05, 0, 0, t);
    /* la lueur du nez est animée en CSS */
    return s + '</svg>';
  })();
  var TRAINEAU = function (w, h) { return TRAINEAU_SVG.replace('width="WW" height="HH"', 'width="' + w + '" height="' + h + '"'); };
  /* ── lapin (profil, regarde à droite) : les pièces bougent à chaque bond ── */
  var LAPIN_SVG = (function () {
    var s = '<svg viewBox="0 0 170 130" width="WW" height="HH" xmlns="http://www.w3.org/2000/svg"><defs>' +
      '<radialGradient id="lbo" cx=".4" cy=".3" r=".85"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#f4f0f7"/><stop offset="1" stop-color="#cfc6dc"/></radialGradient>' +
      '<radialGradient id="lbd" cx=".4" cy=".3" r=".9"><stop offset="0" stop-color="#ece6f2"/><stop offset="1" stop-color="#b9afc9"/></radialGradient>' +
      '<linearGradient id="lor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc9d9"/><stop offset="1" stop-color="#f08aab"/></linearGradient>' +
      '<radialGradient id="lnk" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb3c9" stop-opacity=".8"/><stop offset="1" stop-color="#ffb3c9" stop-opacity="0"/></radialGradient></defs>';
    s += '<ellipse class="lom" cx="76" cy="124" rx="56" ry="5" fill="#000" opacity=".2"/>';
    /* membres lointains */
    s += an(50, 90, 26, -1.57, 1, 24, 0, '<ellipse cx="50" cy="96" rx="17" ry="15" fill="url(#lbd)"/><path d="M52 104c-8 4-12 10-10 14 6 3 20 3 30 0 4-2 4-6 0-8-8-1-14-3-20-6z" fill="url(#lbd)"/>');
    s += an(100, 96, -20, -1.57, 1, -20, 0, '<path d="M98 96c-2 10-2 18 0 24 6 2 12 0 14-3-2-4-6-6-8-10z" fill="url(#lbd)"/>');
    /* queue */
    s += an(28, 84, 10, 1.2, 1, 0, 0, '<circle cx="24" cy="82" r="11" fill="url(#lbo)"/><path d="M16 78q3-5 8-4M17 86q6 4 11 0M22 72q4 1 6 4" stroke="#d8d0e4" stroke-width="1.400" fill="none" stroke-linecap="round"/>');
    /* corps */
    s += '<path d="M24 92C20 70 42 56 74 56C104 56 118 70 112 90C108 104 90 110 66 110C44 110 28 104 24 92z" fill="url(#lbo)"/>';
    s += '<path d="M34 98C50 108 82 110 104 98" stroke="#cfc6dc" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/>';
    s += '<path d="M44 64q10-4 22-4M58 70q8-2 16-1M78 62q10 0 18 5" stroke="#d9d1e5" stroke-width="1.400" fill="none" stroke-linecap="round" opacity=".8"/>';
    /* cuisse + patte arrière */
    s += an(50, 88, 28, -1.57, 1, 28, 0, '<ellipse cx="50" cy="94" rx="21" ry="18" fill="url(#lbo)"/><path d="M52 106c-8 4-14 8-12 12 6 4 24 4 36 0 4-2 4-7 0-9-9-1-17-2-24-3z" fill="url(#lbo)"/><path d="M42 118c10 1 22 1 32-1" stroke="#cfc6dc" stroke-width="1" fill="none"/><ellipse cx="62" cy="116" rx="12" ry="4" fill="url(#lor)" opacity=".55"/>');
    /* patte avant */
    s += an(98, 94, -20, -1.57, 1, -20, 0, '<path d="M94 94c-3 10-3 18-1 24 7 3 14 0 17-3-3-4-7-6-9-10l-2-12z" fill="url(#lbo)"/><path d="M96 118c4 1 9 1 13-1" stroke="#cfc6dc" stroke-width="1" fill="none"/>');
    /* nœud papillon */
    s += '<path d="M98 80l-10-5v12zM98 80l10-5v12z" fill="#f06292" transform="translate(4 4)"/><circle cx="102" cy="84" r="3" fill="#e0467c"/>';
    /* tête + oreilles */
    var oreille = function (ph, off, amp, fond) {
      return an(110, 46, amp, ph, 1, off, 0, '<path d="M108 46C94 22 96 -2 110 -2C124 0 122 26 118 48z" fill="' + fond + '"/><path d="M109 40C100 22 102 6 110 4C118 6 116 24 114 42z" fill="url(#lor)"/><path d="M104 14C106 8 108 6 110 6" stroke="#fff" stroke-opacity=".7" stroke-width="1.600" fill="none" stroke-linecap="round"/>');
    };
    var tete = oreille(-.2, -22, 14, 'url(#lbd)') + oreille(-.7, -6, 16, 'url(#lbo)');
    tete += '<circle cx="114" cy="66" r="21" fill="url(#lbo)"/><ellipse cx="132" cy="72" rx="14" ry="11" fill="url(#lbo)"/>';
    tete += '<circle cx="124" cy="76" r="9" fill="url(#lnk)"/><circle cx="100" cy="72" r="6" fill="url(#lnk)" opacity=".7"/>';
    tete += '<path d="M140 66l4 3-4 4-5-1z" fill="#f08aab"/><path d="M140 73c-2 3-6 4-9 2M140 73c2 3 6 4 8 2" stroke="#b9889b" stroke-width="1.100" fill="none" stroke-linecap="round"/>';
    tete += '<ellipse cx="121" cy="60" rx="4.200" ry="5" fill="#1b1224"/><circle cx="122.600" cy="58" r="1.700" fill="#fff"/><circle cx="120" cy="62" r=".8" fill="#fff" opacity=".7"/><path d="M116 54c2-2 6-2 9-1" stroke="#a79cb8" stroke-width="1.100" fill="none" stroke-linecap="round"/>';
    tete += '<path d="M134 71l14-4M134 73l16 1M134 75l13 6" stroke="#bdb2cc" stroke-width=".8" fill="none" stroke-linecap="round"/>';
    s += an(100, 78, 5, .3, 1, 0, 0, tete);
    return s + '</svg>';
  })();
  var LAPIN = function (w, h) { return LAPIN_SVG.replace('width="WW" height="HH"', 'width="' + w + '" height="' + h + '"'); };
  function guirlande() {
    var L = window.innerWidth, pas = L < 700 ? 96 : 150, n = Math.ceil(L / pas), cols = ['#ff4d4d', '#ffd34a', '#4aa3ff', '#5fd38a', '#ff8ad8'], d = '', i, k, h = '';
    for (i = 0; i < n; i++) {
      var x0 = i * pas, x1 = (i + 1) * pas, cx = (x0 + x1) / 2;
      d += (i ? '' : 'M' + x0 + ' 1') + 'Q' + cx + ' 20 ' + x1 + ' 1';
      for (k = 1; k <= 3; k++) {
        var t = k / 4, bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, by = 2 * (1 - t) * t * 20 + (1 - t) * (1 - t) + t * t;
        var c = cols[(i * 3 + k) % cols.length];
        h += '<g class="nl-ampoule" style="animation-delay:-' + (((i * 3 + k) % 5) * .5).toFixed(1) + 's"><circle cx="' + bx.toFixed(1) + '" cy="' + (by + 6).toFixed(1) + '" r="7" fill="' + c + '" opacity=".25"/><path d="M' + (bx - 2.2).toFixed(1) + ' ' + (by + 1).toFixed(1) + 'h4.400l1.200 7.500a3.400 3.400 0 0 1-6.800 0z" fill="' + c + '"/></g>';
      }
    }
    return '<svg class="nl-guirl" width="' + L + '" height="30" viewBox="0 0 ' + L + ' 30" xmlns="http://www.w3.org/2000/svg"><path d="' + d + '" stroke="#2b3a2e" stroke-width="1.400" fill="none"/>' + h + '</svg>';
  }
  /* la guirlande s'accroche sous la barre de navigation, qu'elle suive la page ou non */
  function poserGuirlande() {
    var g = calque && calque.querySelector('.nl-guirl'), nav = document.querySelector('nav.nav') || document.querySelector('header');
    if (!g) return;
    var bas = nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0;
    g.style.top = bas + 'px';
  }
  function flocons(c) {
    var cv = document.createElement('canvas'); c.appendChild(cv);
    var g = cv.getContext('2d'), W = 0, H = 0, fl = [], et = [], vivant = true, dpr = Math.min(2, window.devicePixelRatio || 1), t0 = 0, mx = 0, cible = 0;
    function taille() { W = window.innerWidth; H = window.innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
    taille(); window.addEventListener('resize', taille);
    var onm = function (e) { cible = (e.clientX / W - .5) * 2; };
    window.addEventListener('mousemove', onm, { passive: true });
    var n = W < 700 ? 50 : 110, i;
    /* z : 0 = fond (petit, lent, flou, pâle) … 1 = premier plan (gros, rapide, net, très mobile à la souris) */
    for (i = 0; i < n; i++) { var z = Math.pow(Math.random(), 1.6); fl.push({ x: Math.random() * W, y: Math.random() * H, z: z, r: 1 + z * 4.6, v: 18 + z * 70, p: Math.random() * 6.3, a: .35 + z * .6 }); }
    for (i = 0; i < (W < 700 ? 6 : 14); i++) et.push({ x: Math.random() * W, y: Math.random() * H * .8, p: Math.random() * 6.3, s: 2.5 + Math.random() * 3.5, v: .8 + Math.random() * 1.4 });
    var sprites = [];
    function spr(k) {
      if (sprites[k]) return sprites[k];
      var s = document.createElement('canvas'); s.width = s.height = 64; var q = s.getContext('2d'), gr = q.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(k ? .55 : .9, 'rgba(228,240,255,' + (k ? .55 : .45) + ')'); gr.addColorStop(1, 'rgba(228,240,255,0)');
      q.fillStyle = gr; q.fillRect(0, 0, 64, 64); return (sprites[k] = s);
    }
    function etoile(x, y, s, a) {
      g.save(); g.translate(x, y); g.globalAlpha = a; g.fillStyle = '#fff';
      g.drawImage(spr(1), -s * 3.2, -s * 3.2, s * 6.4, s * 6.4);
      g.beginPath(); g.moveTo(0, -s * 2.4); g.quadraticCurveTo(s * .25, -s * .25, s * 2.4, 0); g.quadraticCurveTo(s * .25, s * .25, 0, s * 2.4); g.quadraticCurveTo(-s * .25, s * .25, -s * 2.4, 0); g.quadraticCurveTo(-s * .25, -s * .25, 0, -s * 2.4); g.fill(); g.restore();
    }
    function boucle(t) {
      if (!vivant) return;
      var dt = Math.min(.05, (t - (t0 || t)) / 1000); t0 = t;
      mx += (cible - mx) * Math.min(1, dt * 2.5);
      g.clearRect(0, 0, W, H);
      for (var k = 0; k < fl.length; k++) {
        var f = fl[k]; f.y += f.v * dt; f.p += dt * (.5 + f.z * .7); f.x += Math.sin(f.p) * (8 + f.z * 12) * dt;
        if (f.y > H + 8) { f.y = -8; f.x = Math.random() * W; }
        var X = f.x - mx * f.z * 38, rr = f.r * (f.z < .25 ? 2.2 : 1.8), sp = spr(f.z < .25 ? 0 : 1);
        g.globalAlpha = f.a; g.drawImage(sp, X - rr, f.y - rr, rr * 2, rr * 2);
      }
      g.globalAlpha = 1;
      for (var j = 0; j < et.length; j++) { var e = et[j]; e.p += dt * e.v; var a = Math.max(0, Math.sin(e.p)); if (a > .02) etoile(e.x, e.y, e.s * (.5 + a * .5), a * .9); else if (Math.sin(e.p) < -.98) { e.x = Math.random() * W; e.y = Math.random() * H * .8; } }
      requestAnimationFrame(boucle);
    }
    if (!reduit()) requestAnimationFrame(boucle);
    arret.push(function () { vivant = false; window.removeEventListener('resize', taille); window.removeEventListener('mousemove', onm); });
  }
  function demarrerNoel() {
    injecterStyle('nl-style', CSS_NOEL);
    var c = fairecalque(), petit = window.innerWidth < 700, h = '';
    h += '<div class="am-mont am-mg"><i style="background:radial-gradient(ellipse 36% 38% at 24% 78%,rgba(255,255,255,.92),transparent 70%),radial-gradient(ellipse 30% 30% at 50% 88%,rgba(225,238,255,.85),transparent 70%)"></i><i style="background:radial-gradient(ellipse 40% 36% at 40% 84%,rgba(240,247,255,.8),transparent 70%)"></i></div>';
    h += '<div class="am-mont am-md"><i style="background:radial-gradient(ellipse 36% 38% at 24% 78%,rgba(255,255,255,.92),transparent 70%),radial-gradient(ellipse 30% 30% at 50% 88%,rgba(225,238,255,.85),transparent 70%)"></i><i style="background:radial-gradient(ellipse 40% 36% at 40% 84%,rgba(240,247,255,.8),transparent 70%)"></i></div>';
    h += '<div class="am-coin am-cg nl-sapin">' + SAPIN + '</div><div class="am-coin am-cd nl-sapin">' + SAPIN + '</div>';
    if (!petit) {
      var fil = function (hh) { return '<div style="position:absolute;left:50%;top:-4px;width:1px;height:' + hh + 'px;background:#8d93a0"></div>'; };
      h += '<div class="nl-pend" style="left:19%;top:70px;animation-delay:-1s">' + fil(58) + '<div style="margin:54px 0 0 -14px">' + BOULE('#d52b32', 17) + '</div></div>';
      h += '<div class="nl-pend" style="left:96%;animation-delay:-3s">' + fil(70) + '<div style="margin:66px 0 0 -12px">' + BOULE('#3f7fd6', 14) + '</div></div>';
    }
    h += guirlande();
    c.innerHTML = h;
    flocons(c);
    poserGuirlande();
    var onr = function () { var g = c.querySelector('.nl-guirl'); if (g) g.outerHTML = guirlande(); poserGuirlande(); };
    var ons = function () { poserGuirlande(); };
    window.addEventListener('resize', onr); window.addEventListener('scroll', ons, { passive: true });
    var tg = setTimeout(poserGuirlande, 800);
    arret.push(function () { clearTimeout(tg); window.removeEventListener('resize', onr); window.removeEventListener('scroll', ons); });
    if (!reduit()) traversee({ theme: 'noel', larg: 660, haut: 200, ech: .6, anim: true, svg: TRAINEAU, objets: CADEAU });
  }

  /* ═══════════════ SAINT-VALENTIN ═══════════════ */
  var CSS_VAL = [
    '.vl-monte{position:absolute;bottom:-50px;opacity:0;animation:vlMonte linear infinite}',
    '.vl-monte svg{display:block}',
    '@keyframes vlMonte{0%{transform:translate(0,0) scale(.7);opacity:0}8%{opacity:.85}25%{transform:translate(var(--dv),-28vh) scale(.9)}50%{transform:translate(calc(var(--dv)*-.7),-56vh) scale(1)}75%{transform:translate(calc(var(--dv)*.8),-84vh) scale(1.05)}92%{opacity:.85}100%{transform:translate(0,-112vh) scale(1.1);opacity:0}}',
    '.vl-pend{position:absolute;top:70px;transform-origin:50% 0;animation:vlBal 5s ease-in-out infinite}',
    '.vl-pend .vl-fil{position:absolute;left:50%;bottom:calc(100% - 4px);width:1px;height:600px;margin-left:-.5px;background:linear-gradient(rgba(150,60,90,0),rgba(190,90,120,.65) 40%)}',
    '@keyframes vlBal{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}',
    '.vl-ballon{animation:vlFlot 4.4s ease-in-out infinite alternate;transform-origin:50% 100%}',
    '@keyframes vlFlot{from{transform:rotate(-4deg) translateY(0)}to{transform:rotate(4deg) translateY(-7px)}}',
    '.vl-aile{transform-box:fill-box;animation:vlBat .3s ease-in-out infinite alternate}',
    '.vl-ag{transform-origin:100% 80%}.vl-ad{transform-origin:0 80%;animation-direction:alternate-reverse}',
    '@keyframes vlBat{from{transform:rotate(-14deg) scaleY(1)}to{transform:rotate(16deg) scaleY(.8)}}'
  ].join('\n');
  var CC = 'M12 21.5C5 16 1.5 12 1.5 7.8 1.5 4.7 3.9 2.5 6.8 2.5c2 0 3.8 1 5.2 3 1.4-2 3.2-3 5.2-3 2.9 0 5.3 2.200 5.300 5.300 0 4.200-3.500 8.200-10.500 13.700z';
  var COEUR = function (c, t, op) {
    return '<svg viewBox="0 0 24 24" width="' + t + '" height="' + t + '" opacity="' + (op || 1) + '"><defs><radialGradient id="vlhs" cx=".32" cy=".25" r=".95"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset=".25" stop-color="#fff" stop-opacity=".12"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#3a0016" stop-opacity=".55"/></radialGradient></defs>' +
      '<path d="' + CC + '" fill="' + c + '"/><path d="' + CC + '" fill="url(#vlhs)"/>' +
      '<path d="M5.800 5.400c-1.800.5-3 1.900-2.800 3.600" stroke="#fff" stroke-opacity=".85" stroke-width="1.500" fill="none" stroke-linecap="round"/>' +
      '<path d="M18.500 5.400c1.500.6 2.400 1.800 2.300 3.200" stroke="#fff" stroke-opacity=".3" stroke-width="1" fill="none" stroke-linecap="round"/></svg>';
  };
  var ROSES = ['#e8335f', '#ff6b8f', '#ff9db4', '#c9184a', '#f06292'];
  var COEURS_MONTE = function (i) { return COEUR(ROSES[i % ROSES.length], 14 + (i * 7) % 22, .85); };
  var COEUR_AILE = function (w, h) {
    return '<svg viewBox="0 0 220 130" width="' + w + '" height="' + h + '" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="vla" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#ffd9e3"/></linearGradient></defs>' +
    '<g class="vl-aile vl-ag"><path d="M92 60C70 20 34 14 6 28c10 4 14 10 14 18-8 0-14 4-18 10 14 0 22 4 26 12-6 2-10 6-12 12 16-2 28 0 40 6 10 4 22 2 36-6z" fill="url(#vla)" stroke="#f3a9bd" stroke-width="1.5"/></g>' +
    '<g class="vl-aile vl-ad"><path d="M128 60C150 20 186 14 214 28c-10 4-14 10-14 18 8 0 14 4 18 10-14 0-22 4-26 12 6 2 10 6 12 12-16-2-28 0-40 6-10 4-22 2-36-6z" fill="url(#vla)" stroke="#f3a9bd" stroke-width="1.5"/></g>' +
    '<g transform="translate(78 30) scale(2.8)"><path d="' + CC + '" fill="#e8335f"/><path d="M6.500 5.200c-1.700.3-3 1.700-3 3.300" stroke="#fff" stroke-opacity=".6" stroke-width="1.400" fill="none" stroke-linecap="round"/></g>' +
    '<path d="M60 118l100-6" stroke="#b07a4a" stroke-width="3" stroke-linecap="round" opacity="0"/></svg>';
  };
  function demarrerValentin() {
    injecterStyle('vl-style', CSS_VAL);
    var c = fairecalque(), petit = window.innerWidth < 700, h = '', i, r = alea(11);
    var nue = function (cl) { return '<i style="background:radial-gradient(ellipse 34% 40% at 22% 70%,' + cl[0] + ',transparent 70%),radial-gradient(ellipse 30% 34% at 48% 82%,' + cl[1] + ',transparent 70%),radial-gradient(ellipse 38% 44% at 72% 66%,' + cl[2] + ',transparent 72%)"></i>'; };
    var cl = ['rgba(255,170,195,.55)', 'rgba(255,205,220,.6)', 'rgba(240,130,165,.45)'];
    h += '<div class="am-mont am-mg">' + nue(cl) + nue(cl) + '</div><div class="am-mont am-md">' + nue(cl) + nue(cl) + '</div>';
    var ball = function (cx, cy, t, col) { return '<g class="vl-ballon"><path d="' + 'M' + cx + ' ' + cy + 'q-3 22 3 44' + '" stroke="#c98aa0" stroke-width="1" fill="none"/></g>'; };
    var grappe = '<svg viewBox="0 0 110 150" xmlns="http://www.w3.org/2000/svg" class="vl-ballon">' +
      '<path d="M55 150C55 120 38 98 32 74M55 150C56 118 56 92 56 66M55 150C56 124 74 100 80 78" stroke="#b9889b" stroke-width="1.3" fill="none"/>' +
      '<g transform="translate(8 32) scale(2.0)"><path d="' + CC + '" fill="#e8335f"/><path d="M6.500 5.200c-1.700.3-3 1.700-3 3.300" stroke="#fff" stroke-opacity=".6" stroke-width="1.200" fill="none" stroke-linecap="round"/></g>' +
      '<g transform="translate(34 6) scale(2.2)"><path d="' + CC + '" fill="#ff8fab"/><path d="M6.500 5.200c-1.700.3-3 1.700-3 3.300" stroke="#fff" stroke-opacity=".6" stroke-width="1.200" fill="none" stroke-linecap="round"/></g>' +
      '<g transform="translate(58 34) scale(1.9)"><path d="' + CC + '" fill="#c9184a"/><path d="M6.500 5.200c-1.700.3-3 1.700-3 3.300" stroke="#fff" stroke-opacity=".6" stroke-width="1.200" fill="none" stroke-linecap="round"/></g></svg>';
    h += '<div class="am-coin am-cg">' + grappe + '</div><div class="am-coin am-cd">' + grappe + '</div>';
    if (!petit) {
      h += '<div class="vl-pend" style="left:26%"><div class="vl-fil"></div><div style="margin-left:-17px">' + COEUR('#e8335f', 34) + '</div></div>';
      h += '<div class="vl-pend" style="right:8%;animation-delay:-2s"><div class="vl-fil"></div><div style="margin-left:-12px">' + COEUR('#ff8fab', 24) + '</div></div>';
      h += '<div class="vl-pend" style="left:4%;top:140px;animation-delay:-3s"><div class="vl-fil"></div><div style="margin-left:-11px">' + COEUR('#c9184a', 22) + '</div></div>';
    }
    var n = petit ? 12 : 22;
    for (i = 0; i < n; i++) {
      h += '<span class="vl-monte" style="left:' + Math.round(r() * 96) + '%;--dv:' + Math.round((r() - .5) * 120) + 'px;animation-duration:' + (12 + Math.round(r() * 10)) + 's;animation-delay:-' + Math.round(r() * 20) + 's">' + COEURS_MONTE(i) + '</span>';
    }
    c.innerHTML = h;
    if (!reduit()) traversee({ theme: 'valentin', larg: 220, haut: 130, ech: .95, svg: COEUR_AILE, objets: function (i) { return COEUR(ROSES[i % ROSES.length], 16 + (i * 5) % 14); } });
  }

  /* ═══════════════ PÂQUES ═══════════════ */
  var CSS_PQ = [
    '.pq-papillon{position:absolute;left:0;top:0;animation:pqVol 22s ease-in-out infinite;will-change:transform}',
    '.pq-papillon svg{display:block;animation:pqBat .26s ease-in-out infinite alternate;transform-origin:50% 50%}',
    '@keyframes pqBat{from{transform:scaleX(1)}to{transform:scaleX(.45)}}',
    '@keyframes pqVol{0%{transform:translate(8vw,62vh) rotate(8deg)}15%{transform:translate(24vw,46vh) rotate(-10deg)}30%{transform:translate(38vw,58vh) rotate(12deg)}45%{transform:translate(55vw,36vh) rotate(-8deg)}60%{transform:translate(70vw,52vh) rotate(10deg)}75%{transform:translate(84vw,34vh) rotate(-12deg)}90%{transform:translate(60vw,60vh) rotate(6deg)}100%{transform:translate(8vw,62vh) rotate(8deg)}}',
    '.pq-brin{transform-origin:50% 100%;animation:pqBrin 4s ease-in-out infinite alternate}',
    '@keyframes pqBrin{from{transform:rotate(-2.500deg)}to{transform:rotate(2.500deg)}}'
  ].join('\n');
  var OEUFS = [['#ffb3c7', '#ff6f9c', '#fff'], ['#b9e4ff', '#5aa9e6', '#fff'], ['#fff0a3', '#f2b705', '#fff'], ['#c7f0c2', '#58b368', '#fff'], ['#e2c9ff', '#9b6bd6', '#fff']];
  var OEUF = function (i, t) {
    var c = OEUFS[i % OEUFS.length], k = i % 3;
    t = t || 30;
    var motif = k === 0 ? '<path d="M3 24l5-5 5 5 5-5 5 5 5-5 5 5" stroke="' + c[2] + '" stroke-width="2.2" fill="none"/>' : k === 1 ? '<rect x="2" y="18" width="32" height="5" fill="' + c[1] + '"/><circle cx="10" cy="12" r="2" fill="' + c[2] + '"/><circle cx="24" cy="30" r="2" fill="' + c[2] + '"/>' : '<path d="M3 20q5-6 10 0t10 0 10 0" stroke="' + c[2] + '" stroke-width="2.4" fill="none"/><circle cx="18" cy="31" r="2.2" fill="' + c[1] + '"/>';
    return '<svg viewBox="0 0 36 46" width="' + t * .78 + '" height="' + t + '"><defs><clipPath id="pqo' + i + '"><path d="M18 2C9 2 3 17 3 28c0 10 7 16 15 16s15-6 15-16C33 17 27 2 18 2z"/></clipPath><radialGradient id="pqg' + i + '" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".4" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></radialGradient></defs><g clip-path="url(#pqo' + i + ')"><rect width="36" height="46" fill="url(#pqg' + i + ')"/>' + motif + '</g><path d="M18 2C9 2 3 17 3 28c0 10 7 16 15 16s15-6 15-16C33 17 27 2 18 2z" fill="none" stroke="#000" stroke-opacity=".12"/><ellipse cx="12" cy="15" rx="3" ry="6" fill="#fff" opacity=".75" transform="rotate(18 12 15)"/><ellipse cx="23" cy="39" rx="7" ry="3" fill="#000" opacity=".1"/></svg>';
  };
  var HERBE = function () {
    var tu = function (x, h, c) { return '<g class="pq-brin" style="animation-delay:-' + (x % 7) * .4 + 's"><path d="M' + x + ' 100V' + (100 - h) + '" stroke="#3f8f3a" stroke-width="3.200" stroke-linecap="round"/><path d="M' + (x - 8) + ' ' + (100 - h - 18) + 'q8-4 8 10 0-14 8-10 0 12-8 22 0 0-8-22z" fill="' + c + '"/></g>'; };
    var m = function (x, h, c) { return '<g class="pq-brin" style="animation-delay:-' + (x % 5) * .5 + 's"><path d="M' + x + ' 100V' + (100 - h) + '" stroke="#3f8f3a" stroke-width="2.600" stroke-linecap="round"/><g transform="translate(' + x + ' ' + (100 - h) + ')"><g fill="#fff">' + [0, 60, 120, 180, 240, 300].map(function (a) { return '<ellipse cx="0" cy="-8" rx="3.400" ry="6" transform="rotate(' + a + ')"/>'; }).join('') + '</g><circle r="4.200" fill="' + c + '"/></g></g>'; };
    var lames = ''; for (var i = 0; i < 26; i++) lames += '<path d="M' + (4 + i * 5) + ' 102q' + ((i % 2) ? 4 : -4) + ' -' + (20 + (i * 7) % 18) + ' ' + ((i % 3) - 1) * 5 + ' -' + (30 + (i * 11) % 26) + 'q5 ' + (16 + (i % 4) * 4) + ' 4 ' + (30 + (i * 11) % 26) + 'z" fill="' + (i % 2 ? '#4fa545' : '#3b8a35') + '"/>';
    return '<svg viewBox="0 0 140 110" xmlns="http://www.w3.org/2000/svg">' + lames + tu(26, 46, '#ff6f9c') + tu(70, 56, '#ffcf3a') + m(104, 40, '#ffcf3a') + m(46, 34, '#ffb3c7') + tu(120, 36, '#b07bff') + '<ellipse cx="86" cy="98" rx="9" ry="11" fill="#ffd34a"/><ellipse cx="60" cy="100" rx="8" ry="10" fill="#9ad0ff"/></svg>';
  };
  var PAPILLON = function (c1, c2) { return '<svg viewBox="0 0 40 30" width="34" height="26"><path d="M20 15C14 2 3 2 2 10c0 6 8 8 18 5zM20 15C26 2 37 2 38 10c0 6-8 8-18 5z" fill="' + c1 + '"/><path d="M20 15C12 20 4 26 8 29c4 2 10-4 12-14zM20 15c8 5 16 11 12 14-4 2-10-4-12-14z" fill="' + c2 + '"/><circle cx="10" cy="9" r="2.200" fill="#fff" opacity=".7"/><circle cx="30" cy="9" r="2.200" fill="#fff" opacity=".7"/><rect x="19" y="8" width="2" height="16" rx="1" fill="#3a2a22"/></svg>'; };
  function demarrerPaques() {
    injecterStyle('pq-style', CSS_PQ);
    var c = fairecalque(), petit = window.innerWidth < 700, h = '';
    var nue = function () { return '<i style="background:radial-gradient(ellipse 34% 40% at 22% 70%,rgba(255,236,150,.5),transparent 70%),radial-gradient(ellipse 30% 34% at 48% 82%,rgba(190,235,190,.55),transparent 70%),radial-gradient(ellipse 38% 44% at 72% 66%,rgba(255,200,220,.45),transparent 72%)"></i>'; };
    h += '<div class="am-mont am-mg">' + nue() + nue() + '</div><div class="am-mont am-md">' + nue() + nue() + '</div>';
    h += '<div class="am-coin am-cg" style="left:0"><div style="width:' + (petit ? 150 : 290) + 'px">' + HERBE() + '</div></div><div class="am-coin am-cd" style="right:0"><div style="width:' + (petit ? 150 : 290) + 'px;transform:scaleX(-1)">' + HERBE() + '</div></div>';
    h += chute(petit ? 6 : 12, 29, function (i) { return OEUF(i, 28); });
    if (!petit) {
      h += '<div class="pq-papillon">' + PAPILLON('#ff8fab', '#ffd1dc') + '</div><div class="pq-papillon" style="animation-delay:-8s;animation-duration:27s">' + PAPILLON('#ffcf3a', '#fff0a3') + '</div><div class="pq-papillon" style="animation-delay:-14s;animation-duration:31s">' + PAPILLON('#7bb8ff', '#d2e8ff') + '</div>';
    }
    c.innerHTML = h;
    if (!reduit()) traversee({ theme: 'paques', larg: 170, haut: 130, ech: .66, anim: true, sol: true, saut: 34, amp: 24, vit: Math.max(150, window.innerWidth / 8), svg: LAPIN, objets: function (i) { return OEUF(i, 26); } });
  }

  /* ═══════════════ SOMBRE ═══════════════ */
  var INV = 'invert(1) hue-rotate(180deg)';
  var CSS_SOMBRE = [
    'html.am-sombre{filter:' + INV + ';background:#fff;--navy:#0d0d0d!important;--navy-h:#000!important;--white:#fff!important;--g4:#eee!important}',
    'html.am-sombre body{background-color:#fff}',
    'html.am-sombre .am-surf{background-color:#eee!important;box-shadow:0 0 0 1px rgba(0,0,0,.12)}',
    'html.am-sombre .am-surf2{background-color:#e6e6e6!important}',
    'html.am-sombre img,html.am-sombre video,html.am-sombre picture,html.am-sombre iframe,html.am-sombre [style*="background-image"],html.am-sombre #am-btn,html.am-sombre #am-btn2,html.am-sombre #am-calque,html.am-sombre #hw-calque{filter:' + INV + '}',
    /* les zones déjà sombres du site (accueil, pied de page…) gardent leur aspect d'origine */
    'html.am-sombre .am-garde{filter:' + INV + '}',
    'html.am-sombre .am-garde img,html.am-sombre .am-garde video,html.am-sombre .am-garde picture,html.am-sombre .am-garde iframe,html.am-sombre .am-garde [style*="background-image"]{filter:none}',
    /* pas de bleu : les fonds bleu nuit passent au noir */
    'html.am-sombre .am-bleu{background-color:#050505!important}',
    /* photos produit sur fond blanc : la zone image reste blanche, arrondie par la carte */
    'html.am-sombre .prod-img-wrap{background:#000!important}',
    'html.am-sombre ::selection{background:#fff;color:#000}'
  ].join('\n');
  function luminance(css) {
    var m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?/.exec(css || '');
    if (!m) return null;
    var a = m[4] === undefined ? 1 : parseFloat(m[4]);
    if (a < .6) return null;
    return [(0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255, +m[3] - +m[1]];
  }
  function gardeSombres() {
    var els = document.body.querySelectorAll('header,section,footer,nav,main,aside,div,a,button'), W = window.innerWidth, i, el, r, cs, l, viaCouleur;
    for (i = 0; i < els.length; i++) {
      el = els[i];
      if (el.id === 'am-calque' || el.id === 'am-btn' || el.id === 'am-btn2' || el.closest('.am-garde, #am-calque')) continue;
      r = el.getBoundingClientRect();
      if (el.tagName === 'A' || el.tagName === 'BUTTON') continue;
      if (r.width < W * .45 || r.height < 28) continue;
      cs = getComputedStyle(el);
      l = luminance(cs.backgroundColor); viaCouleur = !!l;
      if (!l && cs.backgroundImage && cs.backgroundImage.indexOf('gradient') >= 0) l = luminance(cs.backgroundImage);
      if (l && l[0] < .3) { el.classList.add('am-garde'); if (viaCouleur) el.classList.add('am-bleu'); }
    }
  }
  /* surfaces blanches écrites en dur : on les passe à un gris anthracite doux plutôt qu'au noir pur */
  function surfaces() {
    var els = document.body.querySelectorAll('div,section,article,aside,header,footer,main,form,li,ul,table,details,label,span,p'), i, el, r, c;
    for (i = 0; i < els.length; i++) {
      el = els[i];
      if (el.classList.contains('am-surf') || el.classList.contains('am-surf2') || el.id === 'am-calque' || el.closest('.am-garde, #am-calque, #hw-calque')) continue;
      c = getComputedStyle(el).backgroundColor;
      if (c === 'rgb(255, 255, 255)') { r = el.getBoundingClientRect(); if (r.width > 40 && r.height > 24) el.classList.add('am-surf'); }
      else if (c === 'rgb(240, 242, 245)' || c === 'rgb(247, 249, 252)' || c === 'rgb(245, 248, 251)') { r = el.getBoundingClientRect(); if (r.width > 40 && r.height > 24) el.classList.add('am-surf2'); }
    }
  }
  var obs = null, tObs = 0;
  function surveiller() {
    if (obs) return;
    obs = new MutationObserver(function () { clearTimeout(tObs); tObs = setTimeout(function () { gardeSombres(); surfaces(); }, 250); });
    obs.observe(document.body, { childList: true, subtree: true });
  }
  var sombreMinuteurs = [];
  function demarrerSombre() {
    injecterStyle('am-sombre-style', CSS_SOMBRE);
    racine.classList.add('am-sombre');
    gardeSombres(); surfaces(); surveiller();
    sombreMinuteurs = [setTimeout(function () { gardeSombres(); surfaces(); }, 700), setTimeout(function () { gardeSombres(); surfaces(); }, 2500)];
    window.addEventListener('load', gardeSombres);
  }
  function arreterSombre() {
    sombreMinuteurs.forEach(clearTimeout); sombreMinuteurs = []; if (obs) { obs.disconnect(); obs = null; }
    window.removeEventListener('load', gardeSombres);
    racine.classList.remove('am-sombre');
    var g = document.querySelectorAll('.am-garde'); for (var i = 0; i < g.length; i++) g[i].classList.remove('am-garde', 'am-bleu');
    var f = document.querySelectorAll('.am-surf,.am-surf2'); for (i = 0; i < f.length; i++) f[i].classList.remove('am-surf', 'am-surf2');
  }

  /* ═══════════════ BOUTON ET ORCHESTRATION ═══════════════ */
  var ICONES = {
    halloween: '<svg viewBox="0 -0.8 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.500C8.500 4.500 3.500 6 3.500 12.500c0 4.500 3.500 8 8.500 8s8.500-3.500 8.500-8c0-6.500-5-8-8.500-6z"/><path d="M12 6.500c0-1.500.5-3 2-3.500M8.500 12.500l1.500 1.500M15.500 12.500L14 14M9 17c2 1.200 4 1.200 6 0"/></svg>',
    noel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2.500h4v3h-4z"/><circle cx="12" cy="14" r="7.500"/><path d="M5.500 12.500c4 3 9 3 13 0"/></svg>',
    valentin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="' + CC + '"/></svg>',
    paques: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.500C7.500 2.500 4.500 9 4.500 14c0 4.500 3.500 7.500 7.500 7.500s7.500-3 7.500-7.500c0-5-3-11.500-7.500-11.500z"/><path d="M5 13.500l3-2.500 3 2.500 3-2.500 3 2.500 1.500-1.200"/></svg>',
    sombre: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.500A8.500 8.500 0 1 1 9.500 4a7 7 0 0 0 10.500 10.500z"/></svg>'
  };
  var COULEURS = { halloween: '#e8872a', noel: '#c4232b', valentin: '#e8335f', paques: '#5aa9e6', sombre: '#5a6f95' };

  function arreter() {
    arret.forEach(function (f) { try { f(); } catch (e) {} }); arret = [];
    clearTimeout(ecoTimer); viderCalque();
    if (window.VESPRA_HALLOWEEN) window.VESPRA_HALLOWEEN.eteindre();
  }
  function bouton(theme, allume) {
    var b = document.getElementById('am-btn');
    if (!theme) { if (b) b.remove(); placerSombre(); return; }
    if (!b) {
      injecterStyle('am-style', CSS_COMMUN);
      b = document.createElement('button'); b.id = 'am-btn'; b.type = 'button';
      b.addEventListener('click', function () {
        basculerVisiteur(actif);
        appliquer(actif);
      });
      document.body.appendChild(b);
    }
    b.innerHTML = ICONES[theme] || '';
    b.style.setProperty('--am-c', COULEURS[theme] || '#e8872a');
    b.className = allume ? 'am-on' : '';
    b.setAttribute('aria-pressed', allume ? 'true' : 'false');
    b.title = (allume ? 'Désactiver' : 'Activer') + ' l’ambiance ' + (NOMS[theme] || '').toLowerCase();
    b.setAttribute('aria-label', b.title);
    placerSombre();
  }

  /* bouton « mode sombre » : toujours là, indépendant de l'ambiance de saison */
  var LUNE = ICONES.sombre, SOLEIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.200"/><path d="M12 2.500v2.300M12 19.200v2.300M2.500 12h2.300M19.200 12h2.300M5.300 5.300l1.600 1.600M17.100 17.100l1.600 1.600M5.300 18.700l1.600-1.600M17.100 6.900l1.600-1.600"/></svg>';
  var sombreDispo = true;
  function animationActive() { return !!actif && !estCoupe(actif); }
  function sombreVoulu() { return lireLocal('vespra_sombre') === '1' || /[?&]sombre=1/.test(location.search); }
  function placerSombre() {
    var b = document.getElementById('am-btn2');
    if (b) b.style.left = document.getElementById('am-btn') ? '60px' : '14px';
  }
  function boutonSombre() {
    var b = document.getElementById('am-btn2');
    /* pendant une ambiance de saison, le site est toujours clair : pas de bouton sombre */
    if (!sombreDispo || actif) { if (b) b.remove(); if (actif) ecrireLocal('vespra_sombre', '0'); arreterSombre(); return; }
    var on = sombreVoulu();
    if (!b) {
      injecterStyle('am-style', CSS_COMMUN);
      b = document.createElement('button'); b.id = 'am-btn2'; b.type = 'button';
      b.addEventListener('click', function () { ecrireLocal('vespra_sombre', sombreVoulu() ? '0' : '1'); boutonSombre(); });
      document.body.appendChild(b);
    }
    b.className = on ? 'am-on' : '';
    b.style.setProperty('--am-c', '#222');
    b.innerHTML = on ? SOLEIL : LUNE;
    b.title = on ? 'Revenir au mode clair' : 'Mode sombre'; b.setAttribute('aria-label', b.title); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    placerSombre();
    if (on) demarrerSombre(); else arreterSombre();
  }
  /* page du formulaire : on garde les animations légères (neige, bonbons, personnage) mais on retire
     les gros décors et voiles dans les coins pour ne rien masquer pendant la saisie */
  function pageFormulaire() {
    if (!document.getElementById('resForm')) return;
    racine.classList.add('am-form');
    injecterStyle('am-form-style', 'html.am-form .am-coin,html.am-form .am-mont,html.am-form .hw-cit,html.am-form .hw-cit2,html.am-form .hw-nuage,html.am-form .hw-voile,html.am-form .hw-toile,html.am-form .nl-pend,html.am-form .vl-pend,html.am-form .nl-guirl{display:none!important}');
  }
  /* appareil lent : si l'animation tourne sous ~26 images/s, on retire les voiles et brumes les plus lourds */
  var ecoTimer = 0;
  function surveillerFluidite() {
    clearTimeout(ecoTimer); racine.classList.remove('am-eco');
    ecoTimer = setTimeout(function () {
      var n = 0, t0 = 0, fin = 0;
      function f(t) {
        if (!t0) { t0 = t; fin = t + 2500; }
        n++;
        if (t < fin) { requestAnimationFrame(f); return; }
        if (n * 1000 / (t - t0) < 26 && actif) {
          injecterStyle('am-eco-style', 'html.am-eco .hw-nuage,html.am-eco .hw-voile,html.am-eco .hw-braise,html.am-eco .am-mont,html.am-eco .hw-toile{display:none!important}');
          racine.classList.add('am-eco');
        }
      }
      if (document.visibilityState === 'visible') requestAnimationFrame(f);
    }, 1800);
  }
  function appliquer(theme) {
    pageFormulaire();
    arreter();
    actif = theme || '';
    if (!theme) { bouton('', false); boutonSombre(); return; }
    var coupe = estCoupe(theme);
    bouton(theme, !coupe);
    boutonSombre();
    if (coupe) return;
    surveillerFluidite();
    if (theme === 'halloween') { if (window.VESPRA_HALLOWEEN) window.VESPRA_HALLOWEEN.allumer(true); }
    else if (theme === 'noel') demarrerNoel();
    else if (theme === 'valentin') demarrerValentin();
    else if (theme === 'paques') demarrerPaques();
  }

  function cfgLocale() { try { return JSON.parse(lireLocal(CLE_CFG) || '{}') || {}; } catch (e) { return {}; } }
  function demarrer() {
    var cache = cfgLocale(), signature = JSON.stringify(cache);
    sombreDispo = cache.sombre !== '0'; lireDem(cache);
    appliquer(themeVoulu(cache));
    if (typeof window.VESPRA_DONNEES !== 'function') return;
    window.VESPRA_DONNEES('ambiance').then(function (cfg) {
      if (!cfg || Array.isArray(cfg)) cfg = {};
      var nouv = JSON.stringify(cfg);
      ecrireLocal(CLE_CFG, nouv);
      if (nouv !== signature) { sombreDispo = cfg.sombre !== '0'; lireDem(cfg); appliquer(themeVoulu(cfg)); }
    }).catch(function () {});
  }
  window.VESPRA_AMBIANCE = { theme: function () { return actif; }, auto: themeAuto, noms: NOMS, dates: DATES, paques: paquesDe };
  if (document.body) demarrer(); else document.addEventListener('DOMContentLoaded', demarrer);
})();
