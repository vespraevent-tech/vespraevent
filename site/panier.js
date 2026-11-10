/* ================================================================
   cart.js — Vespra Event | panier partagé toutes pages
   ================================================================ */
(function(){
'use strict';
/* offre « Pack mariage » : calcul de la remise, partagé avec les autres pages */
if(!window.VESPRA_PACK){var _sp=document.createElement('script');_sp.src='/pack-mariage.js';document.head.appendChild(_sp);}

/* ─── Storage ─── */
const KEY='vespra_cart';
function getCart(){try{return JSON.parse(localStorage.getItem(KEY)||'[]');}catch(e){return[];}}
function saveCart(cart){try{localStorage.setItem(KEY,JSON.stringify(cart));}catch(e){}}

/* ─── Badge ─── */
window.updateBadge=updateBadge;
function updateBadge(){
  const n=getCart().reduce((s,i)=>s+(i.qty||1),0);
  document.querySelectorAll('.cart-n,.cart-badge').forEach(el=>el.textContent=n>0?n:'0');
}

/* ─── Add to cart ─── */
window.addToCart=function(item){
  const cart=getCart();
  const idx=cart.findIndex(i=>i.id===item.id&&i.label===item.label);
  if(idx>-1){cart[idx].qty=(cart[idx].qty||1)+1;}
  else{cart.push({...item,qty:1});}
  saveCart(cart);
  updateBadge();
  try{ openCart(); }catch(e){ console.error('[Vespra] ouverture panier:',e); }
  try{ flashBtn(item.id); }catch(e){}
};

function flashBtn(id){
  document.querySelectorAll('[data-product-id="'+id+'"]').forEach(btn=>{
    btn.textContent='✓ Ajouté au devis !';
    btn.style.background='#22c55e';
    setTimeout(()=>{btn.textContent='Ajouter au devis';btn.style.background='';},1800);
  });
}

/* ─── Remove / qty ─── */
function removeItem(id,label){
  const cart=getCart().filter(i=>!(i.id===id&&i.label===label));
  saveCart(cart);
  try{ renderDrawer(); }catch(e){ console.error('[Vespra] rendu panier:',e); }
  try{ updateBadge(); }catch(e){}
}

/* ─── Drawer HTML ─── */
function buildDrawerCSS(){
  if(document.getElementById('vespra-cart-css'))return;
  const s=document.createElement('style');
  s.id='vespra-cart-css';
  s.textContent=`
#vc-drawer .vc-livr.locked{cursor:not-allowed;opacity:.72;background:var(--g4);border-color:var(--g3)}
#vc-drawer .vc-livr.locked #vc-drawer .vc-livr-price{color:var(--g2)}
#vc-drawer .vc-livr-note{display:none;margin-top:7px;font-size:11.5px;line-height:1.5;color:var(--navy);font-weight:600}
#vc-drawer .vc-livr{display:flex;align-items:flex-start;gap:11px;padding:12px 14px;border:2px solid var(--g3);border-radius:12px;cursor:pointer;margin-bottom:14px;font-size:13.5px;line-height:1.5;transition:border-color .18s;background:#fff}
#vc-drawer .vc-livr.on{border-color:var(--navy);background:rgba(43,74,107,.04)}
#vc-drawer .vc-livr input{width:18px;height:18px;margin-top:2px;accent-color:var(--navy);flex-shrink:0}
#vc-drawer .vc-livr-txt span{color:var(--g2);font-size:12px}
#vc-drawer .vc-livr-price{margin-left:auto;font-weight:700;color:var(--navy);white-space:nowrap;font-size:13px}

#vc-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2000;opacity:0;transition:opacity .28s;pointer-events:none}
#vc-overlay.open{opacity:1;pointer-events:all}
#vc-drawer{position:fixed;top:0;right:0;bottom:0;width:min(400px,96vw);background:#fff;z-index:2001;transform:translateX(105%);transition:transform .3s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;box-shadow:-8px 0 40px rgba(0,0,0,.14)}
#vc-drawer.open{transform:translateX(0)}
.vc-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #e8eaed}
.vc-head h2{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:.06em;color:#0C0F14;margin:0}
.vc-close{background:none;border:none;font-size:24px;cursor:pointer;color:#646D7C;padding:6px;line-height:1}
.vc-body{flex:1;overflow-y:auto;padding:0}
.vc-empty{text-align:center;padding:60px 24px;color:#646D7C;font-size:15px}
.vc-item{display:flex;gap:14px;padding:16px 20px;border-bottom:1px solid #f0f2f5;align-items:flex-start}
.vc-item-img{width:64px;height:64px;border-radius:8px;object-fit:contain;object-position:center;padding:4px;border:1px solid var(--g4);flex-shrink:0;background:#f0f2f5}
.vc-item-info{flex:1;min-width:0}
.vc-item-name{font-size:14px;font-weight:700;color:#0C0F14;margin-bottom:2px;line-height:1.3}
.vc-item-label{font-size:12px;color:#646D7C;margin-bottom:6px}
.vc-item-row{display:flex;align-items:center;justify-content:space-between}
.vc-item-price{font-size:15px;font-weight:700;color:#2B4A6B}
.vc-item-del{background:none;border:none;color:#C8CDD8;font-size:18px;cursor:pointer;padding:2px 4px;transition:color .15s}
.vc-item-del:hover{color:#ef4444}
.vc-foot{padding:20px;border-top:1px solid #e8eaed}
.vc-total{display:flex;justify-content:space-between;font-size:15px;font-weight:700;margin-bottom:16px;color:#0C0F14}
.vc-total span:last-child{color:#2B4A6B;font-size:18px}
.vc-btn-primary{display:block;background:#2B4A6B;color:#fff;text-align:center;padding:14px;border-radius:999px;font-size:15px;font-weight:700;text-decoration:none;transition:background .2s;margin-bottom:10px}
.vc-btn-primary:hover{background:#1e3650}
.vc-btn-secondary{display:block;background:#fff;color:#2B4A6B;text-align:center;padding:13px;border-radius:999px;font-size:14px;font-weight:600;text-decoration:none;border:2px solid #2B4A6B;transition:background .2s,color .2s}
.vc-btn-secondary:hover{background:#2B4A6B;color:#fff}
.vc-note{font-size:11px;color:#646D7C;text-align:center;margin-top:10px;line-height:1.5}
`;
  document.head.appendChild(s);
}

function buildDrawerDOM(){
  if(document.getElementById('vc-overlay'))return;
  buildDrawerCSS();
  const overlay=document.createElement('div');overlay.id='vc-overlay';
  overlay.onclick=closeCart;
  const drawer=document.createElement('div');drawer.id='vc-drawer';
  drawer.innerHTML=`
<div class="vc-head">
  <h2>MON DEVIS</h2>
  <button class="vc-close" onclick="closeCart()" aria-label="Fermer">✕</button>
</div>
<div class="vc-body" id="vc-body"></div>
<div class="vc-foot" id="vc-foot" hidden>
  <label class="vc-livr" id="vc-livr-row" for="vc-livr">
    <input type="checkbox" id="vc-livr" onchange="vcSetLivraison(this.checked)">
    <span class="vc-livr-txt"><strong>Livraison et installation</strong><br><span>Nous livrons sur place et installons le matériel prêt à l'emploi.</span><span class="vc-livr-note" id="vc-livr-note"></span></span>
    <span class="vc-livr-price">sur devis</span>
  </label>
  <div class="vc-total"><span>Total (devis)</span><span id="vc-total-val">0 €</span></div>
  <a href="reservation.html" class="vc-btn-primary">Envoyer mon devis →</a>
  <a href="catalogue.html" class="vc-btn-secondary">Continuer à choisir</a>
  <p class="vc-note">Devis gratuit, sans engagement. Notre équipe vous recontacte sous 24h.</p>
</div>`;
  document.body.appendChild(overlay);
  document.body.appendChild(drawer);
}

function renderDrawer(){
  buildDrawerDOM();
  const cart=getCart();
  const body=document.getElementById('vc-body');
  const foot=document.getElementById('vc-foot');
  if(!body)return;
  if(!cart.length){
    body.innerHTML='<div class="vc-empty">Votre devis est vide.<br><br>Parcourez notre catalogue et ajoutez des produits pour obtenir un devis !</div>';
    if(foot)foot.hidden=true;
    return;
  }
  body.innerHTML=cart.map(function(item,idx){
    var labelHtml=item.label?'<div class="vc-item-label">'+String(item.label).replace(/^Photobooth Digital(?!\s*\()/i,'Digital (numérique)')+'</div>':'';
    var priceHtml=item.devis?'Sur devis':(item.price*(item.qty||1))+' €';
    return '<div class="vc-item">'
      +'<img class="vc-item-img" src="'+(item.img||'')+'" alt="" onerror="this.style.display=\'none\'" loading="lazy" decoding="async">'
      +'<div class="vc-item-info">'
      +'<div class="vc-item-name">'+item.name+(item.qty>1?' ×'+item.qty:'')+'</div>'
      +labelHtml
      +'<div class="vc-item-row">'
      +'<div class="vc-item-price">'+priceHtml+'</div>'
      +'<button class="vc-item-del" onclick="vcRemove('+idx+')">✕</button>'
      +'</div></div></div>';
  }).join('');
  var total=cart.reduce(function(s,i){return s+i.price*(i.qty||1);},0);
  var tv=document.getElementById('vc-total-val');
  if(window.VESPRA_PACK){
    var pk=VESPRA_PACK.info(cart);
    if(tv)tv.innerHTML=VESPRA_PACK.totalHTML?VESPRA_PACK.totalHTML(pk):pk.net+' €';
    VESPRA_PACK.afficher(document.querySelector('#vc-foot .vc-total'),pk);
  }else if(tv)tv.textContent=total+' €';
  if(foot)foot.hidden=false;
  if(window.vcSyncLivraison)vcSyncLivraison();
}


/* ── option unique « Livraison et installation » du devis ──
   Masquée dès qu'un produit du devis comporte déjà l'option
   « Installation et démontage » (barnum, tente étoile, buvette). */
window.vcLivraison = function(){
  try { return localStorage.getItem('vespra_livraison') === '1'; } catch(e) { return false; }
};
window.vcSetLivraison = function(on){
  try { localStorage.setItem('vespra_livraison', on ? '1' : '0'); } catch(e) {}
  var row = document.getElementById('vc-livr-row');
  if (row) row.classList.toggle('on', !!on);
};
window.vcMontageDejaPris = function(){
  return getCart().some(function(i){ return /Installation et démontage/i.test((i.label||'') + ' ' + (i.name||'')); });
};
window.vcSyncLivraison=function(){
  var row=document.getElementById('vc-livr-row'), cb=document.getElementById('vc-livr');
  if(!row||!cb)return;
  var note=document.getElementById('vc-livr-note');
  row.style.display='flex';
  if(vcMontageDejaPris()){
    // déjà comprise dans l'option « Installation et démontage » du produit :
    // cochée, verrouillée et grisée, mais toujours visible.
    cb.checked=true; cb.disabled=true;
    row.classList.add('on','locked');
    row.removeAttribute('for');
    if(note){note.textContent='Comprise avec l\'option « Installation et démontage » de votre matériel.';note.style.display='block'}
    return;
  }
  cb.disabled=false;
  row.classList.remove('locked');
  row.setAttribute('for','vc-livr');
  if(note)note.style.display='none';
  cb.checked=vcLivraison();
  row.classList.toggle('on',cb.checked);
};

window.vcRemove=function(idx){
  var cart=getCart();
  cart.splice(idx,1);
  saveCart(cart);
  renderDrawer();
  updateBadge();
};

window.openCart=function(){
  buildDrawerDOM();
  renderDrawer();
  document.getElementById('vc-overlay').classList.add('open');
  document.getElementById('vc-drawer').classList.add('open');
  document.body.style.overflow='hidden';
};

window.closeCart=function(){
  const ov=document.getElementById('vc-overlay');
  const dr=document.getElementById('vc-drawer');
  if(ov)ov.classList.remove('open');
  if(dr)dr.classList.remove('open');
  document.body.style.overflow='';
};

/* ─── Init on load ─── */
document.addEventListener('DOMContentLoaded',function(){
  updateBadge();
  // Fix cart button if it's not already wired
  document.querySelectorAll('.cart-btn,[data-action="open-cart"]').forEach(btn=>{
    btn.onclick=openCart;
  });
});

})();
/* ── Rend le bouton « Devis » de l'en-tête fonctionnel sur toutes les pages ──
   Les pages sans catalogue (articles, blog, FAQ, pages légales…) affichaient
   un compteur figé à 0 et un bouton qui renvoyait vers la réservation. */
(function(){
  function init(){
    window.updateBadge && window.updateBadge();
    document.querySelectorAll('.cart-btn').forEach(function(btn){
      if (btn.dataset.vcBound) return;
      btn.dataset.vcBound = '1';
      btn.setAttribute('onclick', '');
      btn.onclick = function(e){ e.preventDefault(); openCart(); };
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // le panier peut changer dans un autre onglet
  window.addEventListener('storage', function(e){ if (e.key === 'vespra_cart' && window.updateBadge) window.updateBadge(); });
  window.addEventListener('pageshow', function(){ window.updateBadge && window.updateBadge(); });
})();
