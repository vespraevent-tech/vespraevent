/* ────────────────────────────────────────────────────
   Mode Halloween — bouton discret en bas à gauche.

   Un clic habille le site : palette aubergine et or orangé, toiles
   d'araignée fines qui surplombent les coins de l'écran, une
   araignée qui monte et descend au bout de son fil, une petite
   lanterne citrouille suspendue, des braises qui s'élèvent et, de
   temps en temps, une chauve-souris. Un second clic remet le site
   normal. Le choix est gardé dans le navigateur du visiteur.
   Rien à appeler : le script se branche tout seul sur chaque page.
   ──────────────────────────────────────────────────── */
(function () {
  var CLE = 'vespraHalloween', CLASSE = 'hw-on';
  var racine = document.documentElement, calque = null, minuterieChauve = null, minuterieSorciere = null;
  /* actif par défaut : seul un refus explicite du visiteur (« 0 ») le désactive */
  function lire() { try { return localStorage.getItem(CLE) !== '0'; } catch (e) { return true; } }
  function ecrire(v) { try { localStorage.setItem(CLE, v ? '1' : '0'); } catch (e) {} }
  function reduit() { return window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches; }

  /* ── Toile d'angle dessinée à la volée : rayons irrégulières, fils en arc qui
        s'affaissent un peu vers le centre, quelques gouttes de rosée. ── */
  function alea(graine) { var s = graine; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function toile(taille, graine) {
    var r = alea(graine), L = taille, angles = [0], i, k;
    var n = 7;
    for (i = 1; i < n - 1; i++) angles.push(i * 90 / (n - 1) + (r() - .5) * 7);
    angles.push(90);
    var rayons = angles.map(function (a) { return L * (0.93 + r() * .07); });
    var d = '', gouttes = '';
    angles.forEach(function (a, j) {
      var x = Math.cos(a * Math.PI / 180) * rayons[j], y = Math.sin(a * Math.PI / 180) * rayons[j];
      d += 'M0 0L' + x.toFixed(1) + ' ' + y.toFixed(1);
    });
    var anneaux = [.12, .23, .36, .5, .66, .84];
    anneaux.forEach(function (fr, ai) {
      var pts = angles.map(function (a, j) {
        var rr = rayons[j] * fr * (0.96 + r() * .08);
        return [Math.cos(a * Math.PI / 180) * rr, Math.sin(a * Math.PI / 180) * rr];
      });
      for (j = 0; j < pts.length - 1; j++) {
        var p = pts[j], q = pts[j + 1];
        var mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
        var sag = .16 + r() * .06;          /* le fil se creuse vers le centre */
        d += 'M' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + 'Q' + (mx * (1 - sag)).toFixed(1) + ' ' + (my * (1 - sag)).toFixed(1) + ' ' + q[0].toFixed(1) + ' ' + q[1].toFixed(1);
      }
      if (ai > 1 && r() > .45) { k = 1 + Math.floor(r() * (pts.length - 2)); gouttes += '<circle cx="' + pts[k][0].toFixed(1) + '" cy="' + pts[k][1].toFixed(1) + '" r="1.5" fill="#fff" opacity=".8"/>'; }
    });
    return '<svg viewBox="-2 -2 ' + (L + 4) + ' ' + (L + 4) + '" width="' + L + '" height="' + L + '" fill="none" stroke-linecap="round">' +
      '<path d="' + d + '" stroke="rgba(20,10,35,.55)" stroke-width="1.8"/>' +
      '<path d="' + d + '" stroke="rgba(255,236,205,.88)" stroke-width=".8"/>' + gouttes + '</svg>';
  }

  var ARAIGNEE = '<svg viewBox="0 0 64 64" width="52" height="52" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    '<defs><radialGradient id="hwAb" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#6a4a8c"/><stop offset=".55" stop-color="#2c1648"/><stop offset="1" stop-color="#12081d"/></radialGradient></defs>' +
    '<g stroke="#1b1026" stroke-width="1.7">' +
    '<g class="hw-pat hw-pg1"><path d="M28 26C21 18 13 18 7 10"/><path d="M27 29C18 25 9 28 3 25"/><path d="M27 32C18 33 11 38 7 46"/><path d="M29 35C25 40 22 47 21 56"/></g>' +
    '<g class="hw-pat hw-pg2"><path d="M36 26C43 18 51 18 57 10"/><path d="M37 29C46 25 55 28 61 25"/><path d="M37 32C46 33 53 38 57 46"/><path d="M35 35C39 40 42 47 43 56"/></g></g>' +
    '<ellipse cx="32" cy="38" rx="10.5" ry="13" fill="url(#hwAb)" stroke="#12081d" stroke-width="1"/>' +
    '<path d="M32 28v20" stroke="#e8872a" stroke-width="1" opacity=".5"/>' +
    '<path d="M28.5 36c1.8-1 5.2-1 7 0M28 41c2.2-1.2 5.8-1.2 8 0" stroke="#e8872a" stroke-width="1.1" opacity=".75"/>' +
    '<ellipse cx="28.5" cy="32" rx="2.4" ry="3.6" fill="#fff" opacity=".13" stroke="none" transform="rotate(-18 28.5 32)"/>' +
    '<circle cx="32" cy="23.5" r="6.2" fill="url(#hwAb)" stroke="#12081d" stroke-width="1"/>' +
    '<circle cx="29.6" cy="22.4" r="1.5" fill="#ffc46b" stroke="none"/><circle cx="34.4" cy="22.4" r="1.5" fill="#ffc46b" stroke="none"/>' +
    '<circle cx="29.3" cy="22" r=".5" fill="#fff" stroke="none"/><circle cx="34.1" cy="22" r=".5" fill="#fff" stroke="none"/>' +
    '<path d="M29.5 27.5l-1.4 2.6M34.5 27.5l1.4 2.6" stroke="#12081d" stroke-width="1.3"/></svg>';
  var CHAUVE = '<svg viewBox="0 0 48 24" width="38" height="19" fill="#1b1026"><g class="hw-aile hw-ag"><path d="M24 12C20 5 12 2 2 4c3 2 4 5 3 8 3-1 6 0 8 3 2-2 5-2 7-1z"/></g><g class="hw-aile hw-ad"><path d="M24 12C28 5 36 2 46 4c-3 2-4 5-3 8-3-1-6 0-8 3-2-2-5-2-7-1z"/></g><ellipse cx="24" cy="13" rx="3" ry="5"/></svg>';
  var CITROUILLE = '<svg viewBox="0 -0.8 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5C8.5 4.5 3.5 6 3.5 12.2c0 4.3 3.3 7.3 8.5 7.3s8.5-3 8.5-7.3C20.5 6 15.5 4.5 12 6.5z"/><path d="M12 6.5c0-1.6.5-2.8 2-3.5"/><path d="M8.6 11.2l1.4 1.6-1.8.1zM15.4 11.2l-1.4 1.6 1.8.1zM8.8 15.4c1.8 1.4 4.6 1.4 6.4 0"/></svg>';

  var css = [
    /* bouton */
    '#hw-btn{position:fixed;left:14px;bottom:14px;z-index:99990;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#fff;color:#8a93a3;border:1px solid #dfe3ea;box-shadow:0 1px 6px rgba(0,0,0,.08);cursor:pointer;padding:0;transition:color .25s,background .25s,border-color .25s,transform .25s}',
    '#hw-btn:hover{color:#e8872a;transform:scale(1.06)}',
    '#hw-btn:focus-visible{outline:2px solid #e8872a;outline-offset:2px}',
    '.hw-on #hw-btn{background:#1b1026;color:#e8872a;border-color:#e8872a;box-shadow:0 0 0 3px rgba(232,135,42,.15),0 2px 10px rgba(27,16,38,.35)}',
    /* palette : le site utilise déjà ces variables pour ses couleurs */
    '.hw-on{--navy:#2c1648;--navy-h:#1b1026;--gold:#e8872a;--g4:#f4eff9}',
    '.hw-on ::selection{background:#e8872a;color:#fff}',
    '.hw-on body{background:#fcfaff}',
    '.hw-on .trust-marquee-img{mix-blend-mode:multiply}',
    /* calque général : au-dessus du site, jamais cliquable */
    '#hw-calque{position:fixed;inset:0;z-index:99970;pointer-events:none;overflow:hidden;opacity:0;transition:opacity .8s ease}',
    '.hw-on #hw-calque{opacity:1}',
    '#hw-calque .hw-voile{position:absolute;inset:0;background:radial-gradient(ellipse 60% 38% at 0 0,rgba(44,22,72,.2),transparent 70%),radial-gradient(ellipse 60% 38% at 100% 0,rgba(44,22,72,.2),transparent 70%)}',
    '#hw-calque .hw-toile{position:absolute;top:0;opacity:.62;filter:drop-shadow(0 1px 1px rgba(20,10,35,.25))}',
    '#hw-calque .hw-tg{left:0;transform-origin:0 0;animation:hwBrise 9s ease-in-out infinite}',
    '#hw-calque .hw-td{right:0;transform:scaleX(-1);transform-origin:50% 0;animation:hwBriseD 11s ease-in-out infinite}',
    '@keyframes hwBrise{0%,100%{transform:skewX(0) scale(1)}50%{transform:skewX(.8deg) scale(1.012)}}',
    '@keyframes hwBriseD{0%,100%{transform:scaleX(-1) skewX(0) scale(1)}50%{transform:scaleX(-1) skewX(.8deg) scale(1.012)}}',
    /* araignée : le fil est très long vers le haut, elle monte et descend */
    '.hw-pend{position:absolute;top:38px;transform-origin:50% 0;animation:hwBalance 5.5s ease-in-out infinite,hwBob 9s ease-in-out infinite}',
    '.hw-sp{left:26%}',
    '.hw-sp2{left:auto;right:7%;top:60px;animation-duration:6.4s,11s}',
    '.hw-sp3{left:3%;top:150px;animation-duration:7s,13s}',
    '.hw-sp2 svg,.hw-sp3 svg{width:36px;height:36px}.hw-sp2 .hw-corps,.hw-sp3 .hw-corps{margin-left:-18px}',
    '.hw-pend .hw-fil{position:absolute;left:50%;bottom:calc(100% - 10px);width:1px;height:700px;margin-left:-.5px;background:linear-gradient(rgba(27,16,38,.0),rgba(27,16,38,.55) 30%)}',
    '.hw-pend .hw-corps{position:relative;margin-left:-26px;will-change:transform}',
    '@keyframes hwBalance{0%,100%{transform:rotate(-3.2deg)}50%{transform:rotate(3.2deg)}}@keyframes hwBob{0%,12%{translate:0 0}38%,50%{translate:0 38px}56%{translate:0 33px}62%{translate:0 38px}88%,100%{translate:0 0}}',
    '.hw-pat{transform-box:fill-box;transform-origin:50% 50%}',
    '.hw-pg1{animation:hwPattes .7s ease-in-out infinite}.hw-pg2{animation:hwPattes .7s ease-in-out infinite reverse}',
    '@keyframes hwPattes{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}',
    '.hw-lueur{animation:hwLueur 2.4s ease-in-out infinite}',
    '@keyframes hwLueur{0%,100%{opacity:.75}40%{opacity:1}60%{opacity:.6}}',
    /* braises */
    '.hw-braise{position:absolute;border-radius:50%;background:#ffc46b;box-shadow:0 0 8px 2px rgba(255,170,70,.6);opacity:0;animation:hwErre ease-in-out infinite alternate,hwLum ease-in-out infinite}',
    '@keyframes hwErre{0%{transform:translate(0,0)}25%{transform:translate(var(--ax),var(--ay))}50%{transform:translate(var(--bx),var(--by))}75%{transform:translate(var(--cx),var(--cy))}100%{transform:translate(var(--dx),var(--dy))}}',
    '@keyframes hwLum{0%,100%{opacity:.05}20%{opacity:.95}45%{opacity:.35}70%{opacity:1}}',
    /* chauve-souris */
    '.hw-bat{position:absolute;top:120px;left:-60px;animation:hwVol 11s linear forwards;opacity:0}.hw-bat svg{display:block;transform:scale(var(--ech,1));animation:hwFlot 1.3s ease-in-out infinite alternate}@keyframes hwFlot{from{translate:0 -7px}to{translate:0 9px}}.hw-bat.hw-retour{left:auto;right:-60px;animation-name:hwVolR}',
    '@keyframes hwVol{0%{transform:translate(0,0);opacity:1}25%{transform:translate(28vw,44px)}50%{transform:translate(56vw,-12px)}75%{transform:translate(82vw,52px)}100%{transform:translate(114vw,6px);opacity:1}}@keyframes hwVolR{0%{transform:translate(0,0) scaleX(-1);opacity:1}25%{transform:translate(-28vw,-30px) scaleX(-1)}50%{transform:translate(-56vw,30px) scaleX(-1)}75%{transform:translate(-82vw,-18px) scaleX(-1)}100%{transform:translate(-114vw,10px) scaleX(-1);opacity:1}}',
    '.hw-aile{transform-box:fill-box;animation:hwBat .34s ease-in-out infinite alternate}',
    '.hw-ag{transform-origin:100% 50%}.hw-ad{transform-origin:0 50%;animation-direction:alternate-reverse}',
    '@keyframes hwBat{from{transform:scaleY(1) rotate(-6deg)}to{transform:scaleY(.45) rotate(8deg)}}',
    /* ── ajouts : sorcière, bonbons, citrouilles, brume ── */
    '.hw-sorc{pointer-events:none;position:absolute;left:0;top:90px;will-change:transform}',
    '.hw-sorc svg *{pointer-events:visiblePainted;cursor:pointer}',
    '.hw-pluie{position:absolute;pointer-events:none;opacity:0;animation:hwPluie 1.5s cubic-bezier(.2,.7,.4,1) forwards}',
    '@keyframes hwPluie{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--px),var(--py)) rotate(var(--pr));opacity:0}}',
    '.hw-sorc-in{will-change:transform}',
    '.hw-sorc svg{display:block;filter:drop-shadow(0 2px 4px rgba(20,10,35,.35))}',
    '.hw-sorc .hw-etinc{animation:hwEtinc .5s ease-in-out infinite alternate}',
    '@keyframes hwEtinc{from{opacity:.35}to{opacity:1}}',
    '@keyframes hwSorc{0%{transform:translate(0,0) rotate(-6deg);opacity:1}12%{transform:translate(14vw,-50px) rotate(-12deg)}25%{transform:translate(28vw,10px) rotate(-2deg)}37%{transform:translate(42vw,-60px) rotate(-12deg)}50%{transform:translate(56vw,30px) rotate(0deg)}62%{transform:translate(70vw,-45px) rotate(-10deg)}75%{transform:translate(84vw,15px) rotate(-3deg)}100%{transform:translate(122vw,-20px) rotate(-8deg);opacity:1}}',
    '.hw-bon{position:absolute;top:-30px;opacity:0;animation:hwChute linear infinite}',
    '.hw-bon svg{display:block;animation:hwTourne 3.2s linear infinite;filter:drop-shadow(0 1px 1px rgba(20,10,35,.25))}',
    '@keyframes hwChute{0%{transform:translate(0,-30px);opacity:0}6%{opacity:.95}25%{transform:translate(var(--dv),27vh)}50%{transform:translate(calc(var(--dv)*-.6),54vh)}75%{transform:translate(calc(var(--dv)*.8),81vh)}94%{opacity:.95}100%{transform:translate(0,108vh);opacity:0}}',
    '@keyframes hwTourne{to{transform:rotate(360deg)}}',
    '.hw-cit{position:absolute;bottom:2px;filter:drop-shadow(0 0 14px rgba(255,150,40,.55)) drop-shadow(0 3px 5px rgba(20,10,35,.4));animation:hwLueur 3.1s ease-in-out infinite}',
    '.hw-cg{left:62px}.hw-cd{right:6px}.hw-cit svg{width:104px;height:90px;display:block}',
    /* nuages bas gauche et droite : plusieurs voiles translucides qui dérivent lentement et se fondent vers le centre */
    '.hw-nuage{position:absolute;bottom:-4vh;width:58vw;height:54vh;pointer-events:none;contain:layout paint}',
    '.hw-nuage i:nth-child(3){display:none}',
    '.hw-ng{left:-8vw}',
    '.hw-nd{right:-8vw;transform:scaleX(-1)}',
    '.hw-nuage i{position:absolute;inset:0;background:radial-gradient(ellipse 34% 40% at 22% 70%,rgba(176,158,214,.7),transparent 70%),radial-gradient(ellipse 30% 34% at 48% 82%,rgba(214,202,240,.62),transparent 70%),radial-gradient(ellipse 38% 44% at 72% 66%,rgba(150,128,196,.6),transparent 72%),radial-gradient(ellipse 26% 30% at 35% 45%,rgba(200,186,230,.45),transparent 70%);will-change:transform,opacity}',
    '.hw-nuage i:nth-child(1){animation:hwNue1 19s ease-in-out infinite alternate}',
    '.hw-nuage i:nth-child(2){animation:hwNue2 27s ease-in-out infinite alternate;transform:scale(1.25) scaleX(-1);opacity:.8}',
    '.hw-nuage i:nth-child(3){animation:hwNue3 34s ease-in-out infinite alternate;transform:scale(.85) translateY(10%);opacity:.7}',
    '@keyframes hwNue1{from{transform:translate(-6%,0) scale(1);opacity:.65}to{transform:translate(8%,-4%) scale(1.12);opacity:1}}',
    '@keyframes hwNue2{from{transform:translate(7%,2%) scale(1.25) scaleX(-1);opacity:.5}to{transform:translate(-7%,-5%) scale(1.4) scaleX(-1);opacity:.9}}',
    '@keyframes hwNue3{from{transform:translate(0,8%) scale(.85);opacity:.45}to{transform:translate(10%,-6%) scale(1.05);opacity:.85}}',
    '.hw-cit2{position:absolute;bottom:4px;filter:drop-shadow(0 0 10px rgba(255,150,40,.5))}',
    '.hw-cg2{left:162px}.hw-cd2{right:112px}',
    '.hw-vis{animation:hwFlam 2.6s ease-in-out infinite}',
    '@keyframes hwFlam{0%,100%{opacity:1}35%{opacity:.82}55%{opacity:.95}78%{opacity:.75}}',
    '.hw-oeil{position:absolute;bottom:90px;left:12%;animation:hwOeil 9s ease-in-out infinite}',
    '@keyframes hwOeil{0%,100%{transform:translate(0,0)}50%{transform:translate(6px,-8px)}}',
    '@media(max-width:700px){.hw-cit svg{width:60px;height:52px}.hw-cg{left:58px}.hw-oeil{display:none}}',
    '@media(prefers-reduced-motion:reduce){.hw-sorc,.hw-bon{display:none}}',
    '@media(max-width:700px){.hw-sp{left:30%}.hw-sp svg{width:42px;height:42px}}',
    '@media(prefers-reduced-motion:reduce){#hw-calque *{animation:none!important}.hw-braise,.hw-bat{display:none}}'
  ].join('\n');

  function styleInjecte() {
    if (document.getElementById('hw-style')) return;
    var s = document.createElement('style'); s.id = 'hw-style'; s.textContent = css; document.head.appendChild(s);
  }

  function construireCalque() {
    if (calque) return;
    var petit = window.innerWidth < 700, T = petit ? 96 : 270;
    calque = document.createElement('div'); calque.id = 'hw-calque'; calque.setAttribute('aria-hidden', 'true');
    var h = '<div class="hw-voile"></div>' +
      '<div class="hw-toile hw-tg">' + toile(T, 17) + '</div><div class="hw-toile hw-td">' + toile(T, 91) + '</div>' +
      '<div class="hw-pend hw-sp"><div class="hw-corps" id="hw-araignee"><div class="hw-fil"></div>' + ARAIGNEE + '</div></div>' +
      (petit ? '' : '<div class="hw-pend hw-sp2"><div class="hw-corps"><div class="hw-fil"></div>' + ARAIGNEE.replace(/hwAb/g, 'hwAc') + '</div></div><div class="hw-pend hw-sp3"><div class="hw-corps"><div class="hw-fil"></div>' + ARAIGNEE.replace(/hwAb/g, 'hwAd') + '</div></div>');
    var nb = petit ? 24 : 44, r = alea(5), i, rd = function (a) { return Math.round((r() - .5) * a); };
    for (i = 0; i < nb; i++) {
      var t = 2 + Math.round(r() * 2);
      h += '<span class="hw-braise" style="left:' + Math.round(r() * 100) + '%;top:' + Math.round(r() * 100) + '%;width:' + t + 'px;height:' + t + 'px;' +
        '--ax:' + rd(90) + 'px;--ay:' + rd(90) + 'px;--bx:' + rd(160) + 'px;--by:' + rd(140) + 'px;--cx:' + rd(120) + 'px;--cy:' + rd(160) + 'px;--dx:' + rd(100) + 'px;--dy:' + rd(100) + 'px;' +
        'animation-duration:' + (12 + Math.round(r() * 14)) + 's,' + (1.8 + r() * 2.6).toFixed(1) + 's;animation-delay:-' + Math.round(r() * 20) + 's,-' + (r() * 3).toFixed(1) + 's"></span>';
    }
    h += '<div class="hw-nuage hw-ng"><i></i><i></i><i></i></div><div class="hw-nuage hw-nd"><i></i><i></i><i></i></div><div class="hw-cit2 hw-cg2">' + CIT_PETITE + '</div><div class="hw-cit2 hw-cd2">' + CIT_PETITE + '</div><div class="hw-cit hw-cg">' + CIT_GROSSE + '</div><div class="hw-cit hw-cd" style="transform:scaleX(-1)">' + CIT_GROSSE + '</div>';
    if (!petit) h += '<div class="hw-oeil">' + OEIL + '</div>';
    var nbo = petit ? 7 : 14, k;
    for (k = 0; k < nbo; k++) {
      var c = COULEURS[k % COULEURS.length];
      h += '<span class="hw-bon" style="left:' + Math.round(r() * 96) + '%;--dv:' + rd(160) + 'px;animation-duration:' + (11 + Math.round(r() * 10)) + 's;animation-delay:-' + Math.round(r() * 20) + 's">' + bonbonSvg(c[0], c[1]) + '</span>';
    }
    calque.innerHTML = h; document.body.appendChild(calque);
  }
  function uneChauve(delai, haut) {
    var b = document.createElement('div'); b.className = 'hw-bat';
    var ech = 0.7 + Math.random() * .7;
    b.style.top = Math.round(haut) + 'px';
    b.style.animationDelay = delai + 's'; b.style.animationDuration = (9 + Math.round(Math.random() * 6)) + 's';
    b.style.setProperty('--ech', ech.toFixed(2));
    if (Math.random() > .5) b.classList.add('hw-retour');
    b.innerHTML = CHAUVE; calque.appendChild(b);
    setTimeout(function () { b.remove(); }, (delai + 16) * 1000);
  }
  var SORCIERE = "<svg viewBox=\"0 -42 300 172\" width=\"230\" height=\"132\"><defs><linearGradient id=\"mn\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#8a4a22\"/><stop offset=\"1\" stop-color=\"#5a2d12\"/></linearGradient><linearGradient id=\"cape\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#7b3fc4\"/><stop offset=\"1\" stop-color=\"#3b1a6e\"/></linearGradient></defs><g><path d=\"M2 84C14 78 26 74 44 74L52 70 60 90 44 90C30 90 14 90 2 84z\" fill=\"#d8a23c\"/><path d=\"M6 83C18 79 30 77 46 76M6 86C18 85 30 85 46 86M10 80c10-3 22-4 36-4\" stroke=\"#a8741d\" stroke-width=\"1.2\" fill=\"none\"/><path d=\"M52 68l8 1 0 18-8 4z\" fill=\"#8a5a1a\"/><path d=\"M58 76L262 58\" stroke=\"url(#mn)\" stroke-width=\"5.5\" stroke-linecap=\"round\"/><path d=\"M60 74L260 56\" stroke=\"#b9743a\" stroke-width=\"1.2\" stroke-linecap=\"round\" opacity=\".7\"/></g><path d=\"M140 44C118 40 96 44 76 56c14 0 26 2 36 4-6 4-14 7-22 8 18 4 38 2 54-6z\" fill=\"url(#cape)\"/><path d=\"M146 42c10-4 22-2 28 4l-4 18c-2 8-6 12-12 14l-26-2 6-14c0-9 2-16 8-20z\" fill=\"#1d1030\"/><path d=\"M106 74l8 12 6-8 8 10 6-10 8 8 6-8 6 6c2-4 2-8 0-14z\" fill=\"#1d1030\"/><g transform=\"translate(84 0)\"><path d=\"M-4 74c-8-2-12-10-8-17\" stroke=\"#150b22\" stroke-width=\"3.2\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M-6 74c0-12 4-19 12-19 7 0 11 5 12 12l2 7z\" fill=\"#150b22\"/><circle cx=\"13\" cy=\"50\" r=\"7.5\" fill=\"#150b22\"/><path d=\"M7.5 45l1.5-9 5 6zM17 44l4-8 2 9z\" fill=\"#150b22\"/><circle cx=\"11\" cy=\"50\" r=\"1.6\" fill=\"#ffd34a\"/><circle cx=\"16.5\" cy=\"50\" r=\"1.6\" fill=\"#ffd34a\"/></g><g transform=\"rotate(-8 168 74)\"><path d=\"M160 70l10-2 8 28-10 3z\" fill=\"#1d1030\"/><path d=\"M161 72l9-2 2 6-9 2zM164 82l9-2 2 6-9 2zM167 92l9-2 1 5-9 2z\" fill=\"#f08a24\"/><path d=\"M165 96c-1 6 2 10 8 11 5 0 9-1 12-4-5-2-9-4-11-8z\" fill=\"#120a1c\"/></g><path d=\"M170 44c12 2 24 6 34 14l-3 6c-12-4-26-8-36-8z\" fill=\"#1d1030\"/><circle cx=\"205\" cy=\"60\" r=\"5\" fill=\"#8fd16a\"/><path d=\"M170 20c-14-6-30-4-44 4 10 0 18 2 24 6-8 2-16 6-22 12 12-4 24-4 34-2 6-6 10-12 8-20z\" fill=\"#f2782a\"/><path d=\"M150 24c-8 0-14 2-20 6M148 32c-6 2-12 5-16 9\" stroke=\"#c85a14\" stroke-width=\"1.5\" fill=\"none\"/><path d=\"M170 14c8-2 16 2 18 8l8 5-8 3c0 6-2 10-6 13-6 3-14 0-17-6-3-8-2-18 5-23z\" fill=\"#8fd16a\"/><path d=\"M186 29l-2 4 6-1\" stroke=\"#5aa03a\" stroke-width=\"1.2\" fill=\"none\"/><circle cx=\"184\" cy=\"22\" r=\"1.7\" fill=\"#120a1c\"/><path d=\"M180 36c3 1 7 1 9-1\" stroke=\"#3d7a22\" stroke-width=\"1.3\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M156 17c10-20 26-34 40-46-2 14-8 28-8 42z\" transform=\"translate(-6 8)\" fill=\"#150b22\"/><ellipse cx=\"172\" cy=\"16\" rx=\"26\" ry=\"5.5\" transform=\"rotate(-6 172 16)\" fill=\"#150b22\"/><path d=\"M160 11l26-1 -1 5-26 1z\" fill=\"#8b4cd8\" transform=\"rotate(-6 172 12)\"/><rect x=\"171\" y=\"8.5\" width=\"5\" height=\"5\" fill=\"#ffd34a\" transform=\"rotate(-6 172 12)\"/></svg>";
  function bonbonSvg(c1, c2) {
    return '<svg viewBox="0 0 28 14" width="26" height="13"><path d="M1 1l7 6-7 6z" fill="' + c2 + '"/><path d="M27 1l-7 6 7 6z" fill="' + c2 + '"/><ellipse cx="14" cy="7" rx="8" ry="6" fill="' + c1 + '"/><path d="M9 3c2 3 2 5 0 8M14 1c2 4 2 8 0 12M19 3c2 3 2 5 0 8" stroke="#fff" stroke-width="1.4" fill="none" opacity=".75"/></svg>';
  }
  var CIT_GROSSE = "<svg viewBox=\"0 0 120 104\" width=\"84\" height=\"73\"><defs><radialGradient id=\"rc\" cx=\"50%\" cy=\"42%\" r=\"62%\"><stop offset=\"0\" stop-color=\"#ffa545\"/><stop offset=\".55\" stop-color=\"#ec6d1c\"/><stop offset=\"1\" stop-color=\"#a8400e\"/></radialGradient><radialGradient id=\"rs\" cx=\"50%\" cy=\"40%\" r=\"65%\"><stop offset=\"0\" stop-color=\"#f98a2e\"/><stop offset=\".6\" stop-color=\"#d9570f\"/><stop offset=\"1\" stop-color=\"#8e3009\"/></radialGradient><radialGradient id=\"lu\" cx=\"50%\" cy=\"50%\" r=\"50%\"><stop offset=\"0\" stop-color=\"#fff2b0\" stop-opacity=\".95\"/><stop offset=\"1\" stop-color=\"#ffb43a\" stop-opacity=\"0\"/></radialGradient><linearGradient id=\"tg\" x1=\"0\" x2=\"1\"><stop offset=\"0\" stop-color=\"#2f5a18\"/><stop offset=\".5\" stop-color=\"#5f9a30\"/><stop offset=\"1\" stop-color=\"#2f5a18\"/></linearGradient><filter id=\"fl\" x=\"-30%\" y=\"-30%\" width=\"160%\" height=\"160%\"><feGaussianBlur stdDeviation=\"1.6\"/></filter></defs><ellipse cx=\"60\" cy=\"98\" rx=\"46\" ry=\"5\" fill=\"#000\" opacity=\".28\"/><ellipse cx=\"22\" cy=\"62\" rx=\"22\" ry=\"31\" fill=\"url(#rs)\"/><ellipse cx=\"98\" cy=\"62\" rx=\"22\" ry=\"31\" fill=\"url(#rs)\"/><ellipse cx=\"40\" cy=\"62\" rx=\"26\" ry=\"35\" fill=\"url(#rc)\" stroke=\"#9a3a0c\" stroke-opacity=\".5\" stroke-width=\"1\"/><ellipse cx=\"80\" cy=\"62\" rx=\"26\" ry=\"35\" fill=\"url(#rc)\" stroke=\"#9a3a0c\" stroke-opacity=\".5\" stroke-width=\"1\"/><ellipse cx=\"60\" cy=\"62\" rx=\"22\" ry=\"37\" fill=\"url(#rc)\" stroke=\"#9a3a0c\" stroke-opacity=\".45\" stroke-width=\"1\"/><path d=\"M22 40c-4 10-4 26 2 38M98 40c4 10 4 26-2 38\" stroke=\"#fff\" stroke-opacity=\".18\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M54 28c0-8 2-14 6-18 3-3 8-3 10 0-3 1-5 4-6 8 1 4 2 8 0 12z\" fill=\"url(#tg)\"/><path d=\"M54 27c-8-2-14 1-17 6 6 0 12 0 17-2zM66 26c8-3 14 0 17 4-6 1-12 1-17 0z\" fill=\"#3f7a22\"/><path d=\"M69 11c6-4 12-2 14 3\" stroke=\"#4a8a28\" stroke-width=\"1.6\" fill=\"none\" stroke-linecap=\"round\"/><ellipse cx=\"60\" cy=\"62\" rx=\"34\" ry=\"22\" fill=\"url(#lu)\" opacity=\".55\"/><g class=\"hw-vis\"><g filter=\"url(#fl)\" fill=\"#ffc94a\" opacity=\".85\"><path d=\"M30 52l16 7-18 5z\"/><path d=\"M90 52L74 59l18 5z\"/><path d=\"M60 64l-6 9h12z\"/><path d=\"M26 74c10 14 58 14 68 0l-8-2-6 6-8-6-8 6-8-6-8 6-6-6z\"/></g><g fill=\"#ffe99a\"><path d=\"M32 54l12 6-14 3z\"/><path d=\"M88 54L76 60l14 3z\"/><path d=\"M60 66l-4 6h8z\"/><path d=\"M29 74c9 11 53 11 62 0l-7-1-5 5-7-5-7 5-7-5-7 5-5-5z\"/></g></g></svg>";
  var CIT_PETITE = "<svg viewBox=\"0 0 120 104\" width=\"40\" height=\"35\"><defs><radialGradient id=\"rc\" cx=\"50%\" cy=\"42%\" r=\"62%\"><stop offset=\"0\" stop-color=\"#ffa545\"/><stop offset=\".55\" stop-color=\"#ec6d1c\"/><stop offset=\"1\" stop-color=\"#a8400e\"/></radialGradient><radialGradient id=\"rs\" cx=\"50%\" cy=\"40%\" r=\"65%\"><stop offset=\"0\" stop-color=\"#f98a2e\"/><stop offset=\".6\" stop-color=\"#d9570f\"/><stop offset=\"1\" stop-color=\"#8e3009\"/></radialGradient><radialGradient id=\"lu\" cx=\"50%\" cy=\"50%\" r=\"50%\"><stop offset=\"0\" stop-color=\"#fff2b0\" stop-opacity=\".95\"/><stop offset=\"1\" stop-color=\"#ffb43a\" stop-opacity=\"0\"/></radialGradient><linearGradient id=\"tg\" x1=\"0\" x2=\"1\"><stop offset=\"0\" stop-color=\"#2f5a18\"/><stop offset=\".5\" stop-color=\"#5f9a30\"/><stop offset=\"1\" stop-color=\"#2f5a18\"/></linearGradient><filter id=\"fl\" x=\"-30%\" y=\"-30%\" width=\"160%\" height=\"160%\"><feGaussianBlur stdDeviation=\"1.6\"/></filter></defs><ellipse cx=\"60\" cy=\"98\" rx=\"46\" ry=\"5\" fill=\"#000\" opacity=\".28\"/><ellipse cx=\"22\" cy=\"62\" rx=\"22\" ry=\"31\" fill=\"url(#rs)\"/><ellipse cx=\"98\" cy=\"62\" rx=\"22\" ry=\"31\" fill=\"url(#rs)\"/><ellipse cx=\"40\" cy=\"62\" rx=\"26\" ry=\"35\" fill=\"url(#rc)\" stroke=\"#9a3a0c\" stroke-opacity=\".5\" stroke-width=\"1\"/><ellipse cx=\"80\" cy=\"62\" rx=\"26\" ry=\"35\" fill=\"url(#rc)\" stroke=\"#9a3a0c\" stroke-opacity=\".5\" stroke-width=\"1\"/><ellipse cx=\"60\" cy=\"62\" rx=\"22\" ry=\"37\" fill=\"url(#rc)\" stroke=\"#9a3a0c\" stroke-opacity=\".45\" stroke-width=\"1\"/><path d=\"M22 40c-4 10-4 26 2 38M98 40c4 10 4 26-2 38\" stroke=\"#fff\" stroke-opacity=\".18\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M54 28c0-8 2-14 6-18 3-3 8-3 10 0-3 1-5 4-6 8 1 4 2 8 0 12z\" fill=\"url(#tg)\"/><path d=\"M54 27c-8-2-14 1-17 6 6 0 12 0 17-2zM66 26c8-3 14 0 17 4-6 1-12 1-17 0z\" fill=\"#3f7a22\"/><path d=\"M69 11c6-4 12-2 14 3\" stroke=\"#4a8a28\" stroke-width=\"1.6\" fill=\"none\" stroke-linecap=\"round\"/></svg>";
  var OEIL = '<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="11" fill="#fff" stroke="#c9c2d6"/><circle cx="12" cy="12" r="5.5" fill="#5da83a"/><circle cx="12" cy="12" r="2.6" fill="#12081d"/><circle cx="10.5" cy="10.5" r="1" fill="#fff"/></svg>';
  var COULEURS = [['#e8872a', '#ffc46b'], ['#8a5bd0', '#c9a8f5'], ['#e8472a', '#ff9a85'], ['#f2c230', '#fff0a8'], ['#4fb37a', '#a6e6c3']];
  function sorciere() {
    if (!calque || reduit() || document.hidden || !racine.classList.contains(CLASSE) || calque.querySelector('.hw-sorc')) return;   /* une seule sorcière à la fois */
    var w = document.createElement('div'); w.className = 'hw-sorc';
    var H = window.innerHeight, L = window.innerWidth, ech = L < 700 ? .6 : .85;
    var larg = 230 * ech, x = -larg - 20, dir = 1, vit = Math.max(340, L / 2.5);   /* px par seconde : une traversée en 2,5 s environ */
    var haut = Math.round(110 + Math.random() * Math.max(60, H * .4));
    w.style.top = haut + 'px';
    w.innerHTML = '<div class="hw-sorc-in" style="transform-origin:50% 50%">' + SORCIERE.replace('width="230" height="132"', 'width="' + larg + '" height="' + Math.round(132 * ech) + '"') + '</div>';
    calque.appendChild(w);
    var dernier = 0, vivante = true, demi = 0;
    function pas(t) {
      if (!vivante || !w.isConnected) return;
      if (!dernier) dernier = t;
      var dt = Math.min(.05, (t - dernier) / 1000); dernier = t;
      x += dir * vit * dt;
      /* demi-tour : la sorcière pivote autour d'elle-même en quelques dixièmes de seconde */
      if (demi > 0) { demi = Math.max(0, demi - dt); }
      w.firstChild.style.transform = 'scaleX(' + (demi > 0 ? dir * (1 - 2 * demi / .45) : dir) + ')';
      w.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
      if ((dir > 0 && x > L + 40) || (dir < 0 && x < -larg - 40)) { vivante = false; w.remove(); setTimeout(sorciere, 500); return; }
      requestAnimationFrame(pas);
    }
    requestAnimationFrame(pas);
    /* un clic sur la sorcière : une poignée de bonbons, puis elle fait demi-tour */
    w.addEventListener('click', function () {
      var rc = w.getBoundingClientRect(), x0 = rc.left + rc.width * .45, y0 = rc.top + rc.height * .6, i, c, b;
      for (i = 0; i < 16; i++) {
        c = COULEURS[i % COULEURS.length]; b = document.createElement('span'); b.className = 'hw-pluie';
        b.style.left = x0 + 'px'; b.style.top = y0 + 'px';
        b.style.setProperty('--px', Math.round((Math.random() - .5) * 260) + 'px');
        b.style.setProperty('--py', Math.round(60 + Math.random() * 280) + 'px');
        b.style.setProperty('--pr', Math.round((Math.random() - .5) * 720) + 'deg');
        b.innerHTML = bonbonSvg(c[0], c[1]); calque.appendChild(b);
        (function (e) { setTimeout(function () { e.remove(); }, 1700); })(b);
      }
      if (demi <= 0) { dir = -dir; demi = .45; }
    });
  }
  function chauveSouris() {
    if (!calque || reduit() || document.hidden) return;
    var petit = window.innerWidth < 700, n = petit ? 4 : 6, H = window.innerHeight, haut0 = 70, bande = Math.max(60, (H - 150) / n), ordre = [], i, j, t;
    for (i = 0; i < n; i++) ordre.push(i);
    for (i = n - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = ordre[i]; ordre[i] = ordre[j]; ordre[j] = t; }   /* une chauve-souris par bande de hauteur, dans le désordre */
    for (i = 0; i < n; i++) uneChauve(i * 2 + Math.random() * 1.5, haut0 + ordre[i] * bande + Math.random() * bande * .8);
  }
  function appliquer(on, animer) {
    racine.classList.toggle(CLASSE, on);
    var btn = document.getElementById('hw-btn');
    if (btn) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.title = on ? 'Désactiver le mode Halloween' : 'Mode Halloween'; }
    clearInterval(minuterieChauve); clearInterval(minuterieSorciere);
    if (on) {
      construireCalque();
      setTimeout(chauveSouris, animer ? 300 : 1500);
      minuterieChauve = setInterval(chauveSouris, 13000);
      setTimeout(sorciere, animer ? 1500 : 3500);
      minuterieSorciere = setInterval(sorciere, 9000);
    }
  }
  /* L'araignée réagit au défilement : elle est tirée vers le bas puis revient en rebondissant, et se balance. */
  var ressort = { y: 0, vy: 0, a: 0, va: 0, dernier: 0, enCours: false };
  function boucleRessort() {
    var el = document.getElementById('hw-araignee');
    if (!el) { ressort.enCours = false; return; }
    ressort.vy += (-ressort.y * .06) - ressort.vy * .09;           /* rappel élastique + frottement */
    ressort.va += (-ressort.a * .07) - ressort.va * .08;
    ressort.y += ressort.vy; ressort.a += ressort.va;
    el.style.transform = 'translateY(' + ressort.y.toFixed(2) + 'px) rotate(' + ressort.a.toFixed(2) + 'deg)';
    if (Math.abs(ressort.y) < .05 && Math.abs(ressort.vy) < .05 && Math.abs(ressort.a) < .03 && Math.abs(ressort.va) < .03) {
      el.style.transform = ''; ressort.enCours = false; return;
    }
    requestAnimationFrame(boucleRessort);
  }
  function surDefilement() {
    if (!racine.classList.contains(CLASSE) || reduit()) return;
    var y = window.pageYOffset || 0, d = y - ressort.dernier; ressort.dernier = y;
    if (!d) return;
    d = Math.max(-60, Math.min(60, d));
    ressort.vy += d * .16;                                          /* défiler vers le bas la fait descendre un peu */
    ressort.va += (Math.random() > .5 ? 1 : -1) * Math.abs(d) * .02;
    ressort.y = Math.max(-6, Math.min(26, ressort.y)); ressort.a = Math.max(-9, Math.min(9, ressort.a));
    if (!ressort.enCours) { ressort.enCours = true; requestAnimationFrame(boucleRessort); }
  }
  var ecouteurs = false;
  function demarrer() {
    styleInjecte();
    if (ecouteurs) return; ecouteurs = true;
    ressort.dernier = window.pageYOffset || 0;
    window.addEventListener('scroll', surDefilement, { passive: true });
    window.addEventListener('pointermove', function (e) {
      if (!racine.classList.contains(CLASSE) || reduit() || e.pointerType === 'touch') return;
      var el = document.getElementById('hw-araignee'); if (!el) return;
      var r = el.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      if (Math.abs(dx) < 140 && Math.abs(dy) < 140) {              /* la souris approche : l'araignée se balance */
        ressort.va += (dx > 0 ? -1 : 1) * .35;
        if (!ressort.enCours) { ressort.enCours = true; requestAnimationFrame(boucleRessort); }
      }
    }, { passive: true });
  }
  /* Le script ne décide plus seul : c'est ambiance.js qui l'allume ou l'éteint,
     selon le réglage du back-office, les dates et le choix du visiteur. */
  function quandPret(f) { if (document.body) f(); else document.addEventListener('DOMContentLoaded', f); }
  window.VESPRA_HALLOWEEN = {
    allumer: function (animer) { racine.classList.add(CLASSE); quandPret(function () { demarrer(); appliquer(true, !!animer); }); },
    eteindre: function () { racine.classList.remove(CLASSE); quandPret(function () { appliquer(false, false); }); }
  };
})();
