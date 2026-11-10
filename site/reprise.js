/* Panier : « reprise du matériel » (oui / non) et reconnaissance du montage / démontage.
   Ajouté après le tiroir du panier (panier.js ou copie intégrée à la page) : il ne remplace rien,
   il complète « Livraison et installation » et corrige la détection du montage.

   - localStorage « vespra_reprise » : 'oui' | 'non' | '' (pas encore choisi)
   - Montage et démontage sont deux options séparées : « Montage (sur devis) » et « Démontage (sur devis) ».
     Les anciens devis en cours (« installation & démontage ») restent reconnus. */
(function () {
  var RE_MONTAGE = /(installation|montage)\s*(?:et|&|&amp;|\+|\/)?\s*d[ée]montage|montage\s*\(sur devis\)|lancement\s*par\s*nos\s*soins/i;
  var RE_DEMONTAGE = /d[ée]montage/i;

  function panier() { try { return JSON.parse(localStorage.getItem('vespra_cart') || '[]'); } catch (e) { return []; } }
  function textes() { return panier().map(function (i) { return (i.label || '') + ' ' + (i.name || ''); }); }

  window.vcMontageDejaPris = function () { return textes().some(function (t) { return RE_MONTAGE.test(t); }); };
  window.vcDemontagePris = function () { return textes().some(function (t) { return (RE_DEMONTAGE.test(t) && RE_MONTAGE.test(t)) || /lancement\s*par\s*nos\s*soins/i.test(t); }); };
  window.vcReprise = function () { try { return localStorage.getItem('vespra_reprise') || ''; } catch (e) { return ''; } };
  window.vcSetReprise = function (v) {
    try { localStorage.setItem('vespra_reprise', v); } catch (e) {}
    majReprise();
  };

  function assurer() {
    var after = document.getElementById('vc-livr-row');
    if (!after) return null;
    var r = document.getElementById('vc-rep-row');
    if (r) return r;
    r = document.createElement('label'); r.className = 'vc-livr'; r.id = 'vc-rep-row'; r.setAttribute('for', 'vc-rep');
    r.style.marginTop = '-6px';
    r.innerHTML =
      '<input type="checkbox" id="vc-rep">' +
      '<span class="vc-livr-txt"><strong>Reprise du matériel</strong><br><span>Nous revenons chercher le matériel après l\u2019événement.</span>' +
      '<span class="vc-livr-note" id="vc-rep-note"></span></span>' +
      '<span class="vc-livr-price">sur devis</span>';
    r.querySelector('input').addEventListener('change', function (e) { vcSetReprise(e.target.checked ? 'oui' : 'non'); });
    after.parentNode.insertBefore(r, after.nextSibling);
    return r;
  }

  function majReprise() {
    var r = assurer(); if (!r) return;
    var cb = document.getElementById('vc-livr');
    var livr = (cb && cb.checked) || window.vcMontageDejaPris();
    r.style.display = livr ? 'flex' : 'none';
    var dem = window.vcDemontagePris();
    var box = document.getElementById('vc-rep'), note = document.getElementById('vc-rep-note');
    if (dem) {
      box.checked = true; box.disabled = true; r.classList.add('on', 'locked'); r.removeAttribute('for');
      if (note) { note.textContent = 'Comprise avec le démontage ou le lancement.'; note.style.display = 'block'; }
    } else {
      box.disabled = false; r.classList.remove('locked'); r.setAttribute('for', 'vc-rep');
      box.checked = window.vcReprise() === 'oui'; r.classList.toggle('on', box.checked);
      if (note) note.style.display = 'none';
    }
  }

  /* on prolonge la synchronisation existante du tiroir, sans la remplacer */
  var _sync = window.vcSyncLivraison;
  window.vcSyncLivraison = function () {
    if (typeof _sync === 'function') _sync.apply(this, arguments);
    majReprise();
  };
  var _set = window.vcSetLivraison;
  window.vcSetLivraison = function () {
    if (typeof _set === 'function') _set.apply(this, arguments);
    majReprise();
  };

  /* la note « comprise avec… » du tiroir parle d'« Installation et démontage » : on la remet à jour */
  var _note = function () {
    var n = document.getElementById('vc-livr-note');
    if (n && n.style.display === 'block' && window.vcMontageDejaPris()) {
      n.textContent = 'Comprise avec l’option montage, démontage ou lancement de votre matériel.';
    }
  };
  var _sync2 = window.vcSyncLivraison;
  window.vcSyncLivraison = function () { _sync2.apply(this, arguments); _note(); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { majReprise(); });
  else majReprise();
  window.addEventListener('load', majReprise);
  window.addEventListener('storage', majReprise);
})();
