/* Back-office — sélecteur de dates en français pour le planning.
   Les champs restent des <input type="date"> (valeur AAAA-MM-JJ) : tout le code existant continue
   de lire .value. Ils sont simplement masqués derrière un bouton qui affiche la date en toutes lettres
   et ouvre un calendrier. La date de fin ne propose jamais un jour avant la date de début.
   Utilisation : <input type="date" id="dateStart" data-date-joli>  <input type="date" id="dateEnd" data-date-joli data-apres="dateStart"> */
(function () {
  'use strict';
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  var JOURS_L = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var CSS = '.dj{position:relative}.dj input[data-date-joli]{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important}' +
    '.dj-b{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:10px;width:100%;min-height:42px;padding:9px 12px;border:1px solid #d8dde4;border-radius:10px;background:#fff;cursor:pointer;font-family:inherit;font-weight:500;font-size:14px;line-height:1.3;color:#1f2a37}' +
    '.dj-b:hover{border-color:#b9c2ce}.dj-b:focus-visible,.dj.ouvert .dj-b{border-color:#14304f;box-shadow:0 0 0 3px rgba(20,48,79,.1)}' +
    '.dj-b svg{flex:none;width:17px;height:17px;stroke:#14304f;fill:none;stroke-width:1.7}.dj-b .vide{color:#9aa3af;font-weight:400}' +
    '.dj-p{font-size:14px;position:absolute;z-index:9000;top:calc(100% + 6px);left:0;width:300px;max-width:calc(100vw - 32px);background:#fff;border:1px solid #e3e7ed;border-radius:14px;box-shadow:0 18px 50px rgba(12,15,20,.16);padding:14px;display:none}' +
    '.dj.ouvert .dj-p{display:block}.dj.droite .dj-p{left:auto;right:0}' +
    '.dj-t{display:flex;align-items:center;justify-content:space-between;margin:0 0 10px}.dj-t b{font-family:inherit;font-weight:700;font-size:14.5px;line-height:1;color:#14304f;text-transform:capitalize}' +
    '.dj-t button{all:unset;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#14304f}.dj-t button:hover{background:#f2f4f7}.dj-t button svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2}' +
    '.dj-g{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}.dj-g i{font-family:inherit;font-weight:600;font-size:10.5px;line-height:1;font-style:normal;color:#9aa3af;text-align:center;padding:4px 0 8px;text-transform:uppercase;letter-spacing:.04em}' +
    '.dj-g button{all:unset;box-sizing:border-box;min-width:0;height:36px;border-radius:9px;text-align:center;font-family:inherit;font-weight:500;font-size:13.5px;line-height:36px;color:#1f2a37;cursor:pointer}' +
    '.dj-g button:hover:not(:disabled){background:#eef2f7}.dj-g button.auj{box-shadow:inset 0 0 0 1px #c9852b}' +
    '.dj-g button.plage{background:#e9eef5;border-radius:0}.dj-g button.debut{background:#c9d6e6;color:#14304f;font-weight:700}.dj-g button.choisi{background:#14304f;color:#fff;font-weight:700}' +
    '.dj-g button:disabled{color:#cfd5dc;cursor:default}.dj-g span{height:36px}' +
    '.dj-pied{display:flex;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid #eef0f3}.dj-pied button{all:unset;cursor:pointer;font-family:inherit;font-weight:600;font-size:12.5px;line-height:1;color:#14304f;padding:6px 8px;border-radius:7px}.dj-pied button:hover{background:#f2f4f7}';
  var ICO_CAL = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>';
  var ICO_G = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>', ICO_D = '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';

  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function lire(v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function texte(v) { var d = lire(v); return d ? JOURS_L[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear() : ''; }

  function equiper(inp) {
    if (inp.dataset.djPret) return; inp.dataset.djPret = '1';
    var w = document.createElement('div'); w.className = 'dj';
    inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
    var b = document.createElement('button'); b.type = 'button'; b.className = 'dj-b';
    var p = document.createElement('div'); p.className = 'dj-p'; p.setAttribute('role', 'dialog');
    w.appendChild(b); w.appendChild(p);
    var vu = null;
    var debut = function () { var id = inp.dataset.apres; return id ? document.getElementById(id) : null; };
    var fin = function () { return document.querySelector('[data-apres="' + inp.id + '"]'); };
    function maj() { var t = texte(inp.value); b.innerHTML = ICO_CAL + (t ? '<span>' + t.charAt(0).toUpperCase() + t.slice(1) + '</span>' : '<span class="vide">Choisir une date</span>'); }
    /* le code du planning écrit .value directement : on met l'affichage à jour à chaque écriture */
    var proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(inp, 'value', { configurable: true, get: function () { return proto.get.call(this); }, set: function (v) { proto.set.call(this, v); maj(); var f = fin(); if (f && f.value && v && f.value < v) f.value = v; } });
    function dessiner() {
      var min = debut() ? debut().value : '';
      var autreFin = fin(), a = min || inp.value, z = autreFin ? autreFin.value : inp.value;
      if (debut()) { a = min; z = inp.value; } else { a = inp.value; z = autreFin ? autreFin.value : ''; }
      var y = vu.getFullYear(), m = vu.getMonth();
      var premier = (new Date(y, m, 1).getDay() + 6) % 7, nb = new Date(y, m + 1, 0).getDate(), auj = iso(new Date());
      var h = '<div class="dj-t"><button type="button" data-nav="-1" aria-label="Mois précédent">' + ICO_G + '</button><b>' + MOIS[m] + ' ' + y + '</b><button type="button" data-nav="1" aria-label="Mois suivant">' + ICO_D + '</button></div><div class="dj-g">';
      JOURS.forEach(function (j) { h += '<i>' + j + '</i>'; });
      for (var k = 0; k < premier; k++) h += '<span></span>';
      for (var d = 1; d <= nb; d++) {
        var v = iso(new Date(y, m, d)), cl = [];
        if (v === auj) cl.push('auj');
        if (a && z && v > a && v < z) cl.push('plage');
        if (v === inp.value) cl.push('choisi'); else if (debut() && v === a) cl.push('debut');
        h += '<button type="button" data-v="' + v + '" class="' + cl.join(' ') + '"' + (min && v < min ? ' disabled' : '') + '>' + d + '</button>';
      }
      h += '</div><div class="dj-pied"><button type="button" data-auj>Aujourd’hui</button><button type="button" data-ferme>Fermer</button></div>';
      p.innerHTML = h;
    }
    function ouvrir() {
      document.querySelectorAll('.dj.ouvert').forEach(function (x) { if (x !== w) x.classList.remove('ouvert'); });
      var ref = inp.value || (debut() && debut().value) || iso(new Date());
      var r = lire(ref); vu = new Date(r.getFullYear(), r.getMonth(), 1);
      dessiner(); w.classList.add('ouvert');
      var bx = w.getBoundingClientRect(); w.classList.toggle('droite', bx.left + 300 > window.innerWidth - 12);
    }
    function choisir(v) {
      inp.value = v;
      inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
      var f = fin(); if (f) { f.dispatchEvent(new Event('change', { bubbles: true })); }
      w.classList.remove('ouvert');
      /* après la date de début, on enchaîne sur la date de fin */
      if (f && !f.dataset.djAuto) { f.dataset.djAuto = '1'; setTimeout(function () { var fb = f.parentNode.querySelector('.dj-b'); if (fb) fb.click(); delete f.dataset.djAuto; }, 60); }
    }
    b.addEventListener('click', function (e) { e.preventDefault(); w.classList.contains('ouvert') ? w.classList.remove('ouvert') : ouvrir(); });
    p.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var n = e.target.closest('[data-nav]'); if (n) { vu = new Date(vu.getFullYear(), vu.getMonth() + (+n.dataset.nav), 1); dessiner(); return; }
      var j = e.target.closest('[data-v]'); if (j && !j.disabled) { choisir(j.dataset.v); return; }
      if (e.target.closest('[data-auj]')) { var t = iso(new Date()), mn = debut() ? debut().value : ''; choisir(mn && t < mn ? mn : t); return; }
      if (e.target.closest('[data-ferme]')) w.classList.remove('ouvert');
    });
    maj();
  }
  function init() {
    if (!document.getElementById('djStyle')) { var s = document.createElement('style'); s.id = 'djStyle'; s.textContent = CSS; document.head.appendChild(s); }
    document.querySelectorAll('input[data-date-joli]').forEach(equiper);
  }
  document.addEventListener('click', function (e) { if (!e.target.closest('.dj')) document.querySelectorAll('.dj.ouvert').forEach(function (x) { x.classList.remove('ouvert'); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') document.querySelectorAll('.dj.ouvert').forEach(function (x) { x.classList.remove('ouvert'); }); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  /* fenêtres construites après coup (fiche de demande) */
  new MutationObserver(function () { if (document.querySelector('input[data-date-joli]:not([data-dj-pret])')) init(); }).observe(document.documentElement, { childList: true, subtree: true });
})();
