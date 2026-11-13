/* ─────────────────────────────────────────────────────────────
   Date de l'événement : format français + calendrier.

   Le champ « date » natif du navigateur affiche la date dans la langue
   du navigateur : un visiteur dont le téléphone est réglé en anglais
   voyait mm/dd/yyyy, ce qui prête à confusion pour une date d'événement
   (05/09 ou 09/05 ?).

   Le champ est donc un champ texte toujours au format JJ/MM/AAAA, et un
   petit calendrier en français s'ouvre au clic. On peut aussi taper la
   date directement : les barres obliques s'écrivent toutes seules et le
   clavier numérique s'ouvre sur téléphone.

   Le calendrier est dessiné ici, sans aucune bibliothèque extérieure :
   il ne dépend donc ni de la langue du navigateur ni d'un script tiers.

   S'applique à tous les champs portant l'attribut data-date-fr
   (formulaire de réservation et formulaire de la page d'accueil).
   ───────────────────────────────────────────────────────────── */
(function () {
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
              'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  function demarrer() {
    var champs = document.querySelectorAll('[data-date-fr]');
    if (!champs.length) return;

    styles();
    Array.prototype.forEach.call(champs, equiper);
  }

  /* ── apparence du calendrier ─────────────────────────────── */
  function styles() {
    if (document.getElementById('dateFrStyle')) return;
    var st = document.createElement('style');
    st.id = 'dateFrStyle';
    st.textContent = [
      '.dfr-wrap{position:relative;display:block}',
      '.dfr-wrap::after{content:"";position:absolute;right:14px;top:50%;width:19px;height:19px;margin-top:-9.5px;pointer-events:none;',
      '  background:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%232B4A6B\' stroke-width=\'1.7\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Crect x=\'3.5\' y=\'5\' width=\'17\' height=\'15\' rx=\'3\'/%3E%3Cpath d=\'M3.5 10h17M8 3v4M16 3v4\'/%3E%3C/svg%3E") center/contain no-repeat}',
      '.dfr-wrap input{cursor:pointer;padding-right:44px!important}',
      '.dfr-cal{z-index:3000;width:320px;max-width:100%;background:#fff;border:1px solid var(--g3,#C8CDD8);border-radius:22px;',
      '  box-shadow:0 22px 50px -18px rgba(20,37,58,.45);padding:0 0 4px;overflow:hidden;',
      '  font-family:inherit;color:var(--black,#0C0F14)}',
      '.dfr-cal[hidden]{display:none}',
      '.dfr-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;background:var(--navy,#2B4A6B);color:#fff;margin:0 0 8px}',
      '.dfr-mois{white-space:nowrap;font-family:"Bebas Neue",sans-serif;font-weight:400;font-size:26px;line-height:1;letter-spacing:.03em;text-transform:uppercase}',
      '.dfr-nav{background:rgba(255,255,255,.14);border:0;border-radius:50%;',
      '  width:32px;height:32px;line-height:1;cursor:pointer;color:#fff;',
      '  font-size:18px;font-family:inherit;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
      '.dfr-nav:hover:not(:disabled){background:rgba(255,255,255,.28)}',
      '.dfr-nav:disabled{opacity:.3;cursor:not-allowed}',
      '.dfr-grille{display:grid;grid-template-columns:repeat(7,1fr);gap:3px 0;padding:0 10px}',
      '.dfr-jour{font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--g2,#646D7C);text-align:center;padding:4px 0}',
      '.dfr-case{background:none;border:none;border-radius:50%;padding:0;height:40px;cursor:pointer;',
      '  font-family:inherit;font-size:14px;font-weight:500;color:var(--black,#0C0F14);font-variant-numeric:tabular-nums}',
      '.dfr-case:hover:not(:disabled){background:var(--g4,#F0F2F5)}',
      '.dfr-case:disabled{color:#C3C9D3;cursor:not-allowed}',
      '.dfr-case.vide{visibility:hidden}',
      '.dfr-case.aujourdhui{box-shadow:inset 0 0 0 2px var(--gold,#F59E0B)}',
      '.dfr-case.choisi{background:var(--navy,#2B4A6B)!important;color:#fff;font-weight:700}',
      '.dfr-pied{display:flex;justify-content:space-between;align-items:center;gap:8px;',
      '  margin:8px 0 0;padding:9px 14px 6px;border-top:1px solid var(--g4,#F0F2F5)}',
      '.dfr-lien{background:none;border:none;padding:0;font-family:inherit;font-size:13px;',
      '  font-weight:600;color:var(--navy,#2B4A6B);cursor:pointer}',
      '.dfr-lien:hover{text-decoration:underline}',
      '@media(max-width:400px){.dfr-case{height:38px}}',
    ].join('');
    document.head.appendChild(st);
  }

  /* ── outils de date ──────────────────────────────────────── */
  function auj() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function deux(n) { return (n < 10 ? '0' : '') + n; }
  function enTexte(d) { return deux(d.getDate()) + '/' + deux(d.getMonth() + 1) + '/' + d.getFullYear(); }

  function lire(v) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || ''));
    if (!m) return null;
    var j = +m[1], mo = +m[2], a = +m[3];
    var d = new Date(a, mo - 1, j);
    /* rejette 31/04, 30/02 et les mois impossibles */
    if (d.getFullYear() !== a || d.getMonth() !== mo - 1 || d.getDate() !== j) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /* ── un champ ────────────────────────────────────────────── */
  function equiper(champ) {
    if (champ.dfrPret) return;
    champ.dfrPret = true;

    /* le calendrier se positionne sous le champ : il lui faut un parent
       en position relative, sans changer la mise en page existante */
    var boite = document.createElement('span');
    boite.className = 'dfr-wrap';
    champ.parentNode.insertBefore(boite, champ);
    boite.appendChild(champ);

    var cal = document.createElement('div');
    cal.className = 'dfr-cal';
    cal.hidden = true;
    cal.setAttribute('role', 'dialog');
    cal.setAttribute('aria-label', 'Choisir une date');
    boite.appendChild(cal);

    var curseur = auj();         /* mois affiché */
    var min = auj();             /* pas de date passée pour un événement */

    /* ── saisie au clavier ── */
    champ.addEventListener('input', function () {
      var avant = champ.value;
      var n = avant.replace(/\D/g, '').slice(0, 8);
      var out = n.slice(0, 2);
      if (n.length > 2) out += '/' + n.slice(2, 4);
      if (n.length > 4) out += '/' + n.slice(4, 8);
      if (out !== avant) {
        var fin = champ.selectionStart === avant.length;
        champ.value = out;
        if (fin) { try { champ.setSelectionRange(out.length, out.length); } catch (e) {} }
      }
      controler();
      var d = lire(champ.value);
      if (d) { curseur = new Date(d.getFullYear(), d.getMonth(), 1); dessiner(); }
    });

    /* coller une date écrite autrement (2027-07-14, 14.07.2027…) */
    champ.addEventListener('paste', function (e) {
      var t = (e.clipboardData || window.clipboardData).getData('text') || '';
      var iso = t.match(/^(\d{4})[-\/.](\d{2})[-\/.](\d{2})$/);
      if (iso) { e.preventDefault(); champ.value = iso[3] + '/' + iso[2] + '/' + iso[1]; controler(); }
    });

    /* ── ouverture au clic ──────────────────────────────────────
       Le calendrier est sorti du formulaire et rattaché au bas de la
       page le temps qu'il est ouvert. C'est la seule façon sûre : tant
       qu'il restait à côté du champ, une section animée ou un cadre à
       défilement le coupait ou le renvoyait hors de l'écran — il
       s'ouvrait bel et bien, mais on ne le voyait pas. */
    function placer() {
      var cr = champ.getBoundingClientRect();
      var larg = Math.min(320, window.innerWidth - 16);
      cal.style.width = larg + 'px';
      cal.style.maxWidth = 'none';
      cal.style.maxHeight = Math.max(220, window.innerHeight - 16) + 'px';
      cal.style.overflowY = 'auto';

      /* Le calendrier reste toujours sous le champ. S'il manque de place,
         il devient défilable au lieu de passer au-dessus de la date. */
      var haut = Math.min(cal.offsetHeight || 320, Math.max(180, window.innerHeight - cr.bottom - 20));
      cal.style.maxHeight = haut + 'px';
      var y = Math.min(window.innerHeight - haut - 8, cr.bottom + 6);
      var x = Math.min(Math.max(8, cr.left), window.innerWidth - larg - 8);
      cal.style.left = Math.round(x) + 'px';
      cal.style.top = Math.round(y) + 'px';
      cal.style.right = 'auto';
      cal.style.bottom = 'auto';
    }

    function ouvrir() {
      if (!cal.hidden) return;
      var d = lire(champ.value);
      curseur = d ? new Date(d.getFullYear(), d.getMonth(), 1)
                  : new Date(min.getFullYear(), min.getMonth(), 1);
      dessiner();
      if (cal.parentNode !== document.body) document.body.appendChild(cal);
      cal.style.position = 'fixed';
      cal.hidden = false;
      cal.dfrT = Date.now();
      /* assez de place sous le champ : sinon on fait défiler la page d'abord */
      var cr0 = champ.getBoundingClientRect(), besoin = 340;
      if (!window.__vespraSansDefilementDate && window.innerHeight - cr0.bottom < besoin) {
        window.scrollBy({top: Math.min(besoin - (window.innerHeight - cr0.bottom) + 12, Math.max(0, cr0.top - 70)), behavior: 'instant'});
      }
      placer();
      suivre(true);
    }

    function fermer() {
      if (cal.hidden) return;
      cal.hidden = true;
      suivre(false);
      if (cal.parentNode !== boite) boite.appendChild(cal);
    }

    /* le champ bouge quand la page défile : le calendrier le suit */
    function replacer() { if (!cal.hidden) placer(); }
    function suivre(actif) {
      var m = actif ? 'addEventListener' : 'removeEventListener';
      window[m]('scroll', replacer, true);
      window[m]('resize', replacer);
    }

    /* pas de clavier : le calendrier suffit (inputmode none) */
    champ.setAttribute('inputmode','none');
    champ.setAttribute('autocomplete','off');
    if(!champ.placeholder) champ.placeholder='JJ/MM/AAAA';
    champ.addEventListener('click', function(e){ e.preventDefault(); ouvrir(); });
    champ.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){e.preventDefault();ouvrir();} });
    champ.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer(); });

    document.addEventListener('click', function (e) {
      /* Le calendrier se redessine à chaque changement de mois : l'élément
         cliqué n'est alors plus dans la page au moment où ce gestionnaire
         s'exécute, et le test « est-il dans le calendrier ? » répondrait
         non à tort, refermant le calendrier dès la première flèche. */
      if (!document.contains(e.target)) return;
      if (cal.dfrT && Date.now() - cal.dfrT < 500) return;
      /* le calendrier ouvert n'est plus dans la boîte du champ : il est
         rattaché au bas de la page, d'où le second test */
      if (!boite.contains(e.target) && !cal.contains(e.target)) fermer();
    });

    /* ── dessin du mois ── */
    function dessiner() {
      var a = curseur.getFullYear(), m = curseur.getMonth();
      var choisi = lire(champ.value);
      var premier = new Date(a, m, 1);
      var decalage = (premier.getDay() + 6) % 7;          /* semaine commençant lundi */
      var nb = new Date(a, m + 1, 0).getDate();
      var reculPossible = new Date(a, m, 1) > new Date(min.getFullYear(), min.getMonth(), 1);

      var h = '<div class="dfr-head">' +
        '<button type="button" class="dfr-nav" data-pas="-1" aria-label="Mois précédent"' +
        (reculPossible ? '' : ' disabled') + '>‹</button>' +
        '<span class="dfr-mois">' + MOIS[m] + ' ' + a + '</span>' +
        '<button type="button" class="dfr-nav" data-pas="1" aria-label="Mois suivant">›</button>' +
        '</div><div class="dfr-grille">';

      for (var j = 0; j < 7; j++) h += '<div class="dfr-jour">' + JOURS[j] + '</div>';
      for (var v = 0; v < decalage; v++) h += '<button type="button" class="dfr-case vide" disabled></button>';

      for (var n = 1; n <= nb; n++) {
        var d = new Date(a, m, n);
        var passe = d < min;
        var cls = 'dfr-case';
        if (+d === +auj()) cls += ' aujourdhui';
        if (choisi && +d === +choisi) cls += ' choisi';
        h += '<button type="button" class="' + cls + '" data-jour="' + n + '"' +
             (passe ? ' disabled' : '') + '>' + n + '</button>';
      }

      h += '</div><div class="dfr-pied">' +
           '<button type="button" class="dfr-lien" data-raccourci="aujourdhui">Aujourd\'hui</button>' +
           '<button type="button" class="dfr-lien" data-raccourci="effacer">Effacer</button>' +
           '</div>';
      cal.innerHTML = h;
    }

    cal.addEventListener('click', function (e) {
      var nav = e.target.closest('.dfr-nav');
      if (nav) {
        curseur = new Date(curseur.getFullYear(), curseur.getMonth() + (+nav.dataset.pas), 1);
        dessiner();
        return;
      }
      var r = e.target.closest('[data-raccourci]');
      if (r) {
        if (r.dataset.raccourci === 'effacer') { champ.value = ''; controler(); fermer(); }
        else { champ.value = enTexte(auj()); controler(); fermer(); }
        return;
      }
      var c = e.target.closest('.dfr-case[data-jour]');
      if (c && !c.disabled) {
        champ.value = enTexte(new Date(curseur.getFullYear(), curseur.getMonth(), +c.dataset.jour));
        controler();
        fermer();
        try { champ.dispatchEvent(new Event('change', { bubbles: true })); } catch (err) {}
      }
    });

    /* ── contrôle avant envoi ── */
    function controler() {
      if (!champ.setCustomValidity) return;
      var v = champ.value;
      if (!v) { champ.setCustomValidity(''); return; }
      if (v.length < 10) { champ.setCustomValidity('Indiquez la date au format JJ/MM/AAAA.'); return; }
      var d = lire(v);
      if (!d) { champ.setCustomValidity("Cette date n'existe pas. Format attendu : JJ/MM/AAAA."); return; }
      if (d < min) { champ.setCustomValidity('La date de votre événement doit être à venir.'); return; }
      champ.setCustomValidity('');
    }

    champ.addEventListener('blur', controler);
    controler();
  }

  window.__dfrInit = demarrer;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
