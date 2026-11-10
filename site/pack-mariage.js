/* ================================================================
   pack-mariage.js — Vespra Event | offre « Pack mariage »
   À partir de 5 produits différents ajoutés depuis la page
   « Pack mariage », une remise de 10 % s'applique automatiquement
   sur le total des locations (livraison exclue : elle est sur devis).
   Cumulable avec un code de parrainage.
   ================================================================ */
(function(){
  'use strict';
  var SEUIL = 5, TAUX = 0.10;

  function lire(){ try { return JSON.parse(localStorage.getItem('vespra_cart') || '[]'); } catch(e){ return []; } }
  /* « p4_1712345 » et « p4 » sont le même produit (formules, options, texte personnalisé) */
  function base(it){ return String((it && it.id) || '').split('_')[0]; }

  function info(cart){
    cart = cart || lire();
    var n = 0, brut = 0;
    /* Tous les produits comptent, d'où qu'ils aient été ajoutés (2 barnums = 2 produits) */
    cart.forEach(function(it){
      var q = it.qty || 1;
      brut += (Number(it.price) || 0) * q;
      n += q;
    });
    var actif = n >= SEUIL;
    var remise = actif ? Math.round(brut * TAUX) : 0;
    return { n: n, seuil: SEUIL, actif: actif, restant: Math.max(0, SEUIL - n),
             brut: brut, remise: remise, net: brut - remise, present: n > 0 };
  }

  /* Total à afficher : l'ancien prix barré, puis le nouveau */
  function totalHTML(inf){
    if (!inf || !inf.remise) return String((inf && inf.net != null) ? inf.net : 0) + ' €';
    style();
    return '<s class="vp-old">' + inf.brut + ' €</s>' + inf.net + ' €';
  }

  function pluriel(n){ return n + ' produit' + (n > 1 ? 's' : ''); }

  /* Ligne à insérer dans un panier : remise obtenue, ou barre de progression fine */
  function ligneHTML(inf){
    if (!inf.present) return '';
    var seg = '';
    for (var k = 0; k < inf.seuil; k++) seg += '<i' + (k < inf.n ? ' class="on"' : '') + '></i>';
    if (inf.actif) {
      return '<div class="vp-ligne vp-ok"><span>Remise 10 %</span><strong>− ' + inf.remise + ' €</strong></div><div class="vp-seg vp-full">' + seg + '</div>';
    }
    return '<div class="vp-nudge"><div class="vp-msg"><span>−10 % dès ' + inf.seuil + ' produits</span></div><div class="vp-seg">' + seg + '</div></div>';
  }

  /* Le style des lignes est injecté une fois, partout */
  function style(){
    if (document.getElementById('vp-css')) return;
    var s = document.createElement('style'); s.id = 'vp-css';
    s.textContent = '.vp-ligne{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin:0 0 10px;font-size:13px;font-weight:600;line-height:1.4}'
      + '.vp-old{text-decoration:line-through;color:#8a94a3;font-weight:400;font-size:.8em;margin-right:7px}.vp-ok{color:#15803D}.vp-ok strong{font-size:15px;white-space:nowrap}'
      + '.vp-nudge{margin:0 0 12px;color:#2B4A6B}'
      + '.vp-msg{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:12.5px;font-weight:600;line-height:1.4;margin-bottom:6px}'
      + '.vp-msg a{color:#2B4A6B;text-decoration:underline;white-space:nowrap;font-weight:700;font-size:12px}'
      + '.vp-bar{height:4px;border-radius:4px;background:rgba(43,74,107,.14);overflow:hidden;margin:0 0 12px}'
      + '.vp-bar i{display:block;height:100%;background:#2B4A6B;border-radius:4px;transition:width .4s}'
      + '.vp-ok+.vp-bar i{background:#15803D}';
    document.head.appendChild(s);
  }

  /* Insère ou met à jour la ligne juste avant l'élément « avant » (le total) */
  function afficher(avant, inf, zid){
    if (!avant) return;
    style();
    zid = zid || 'vp-ligne-zone';
    var ex = document.getElementById(zid);
    if (!ex) { ex = document.createElement('div'); ex.id = zid; avant.parentNode.insertBefore(ex, avant); }
    ex.innerHTML = ligneHTML(inf);
  }

  window.VESPRA_PACK = { SEUIL: SEUIL, TAUX: TAUX, info: info, base: base, ligneHTML: ligneHTML, totalHTML: totalHTML, afficher: afficher, style: style };
})();
