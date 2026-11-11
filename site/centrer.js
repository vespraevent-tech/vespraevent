/* Confort de navigation, sur tout le site.
   1) Quand on arrive sur une page (lien, retour, rechargement), on est en haut de page.
   2) Quand on touche un petit élément qui déroule quelque chose (question de FAQ,
      onglet, catégorie…), l'écran se recale en douceur pour mettre l'élément — et ce qui
      s'est ouvert — au milieu de l'écran. Rien ne bouge si c'est déjà bien placé. */
(function(){
  try{if('scrollRestoration' in history)history.scrollRestoration='manual';}catch(e){}
  function haut(){if(!location.hash)window.scrollTo(0,0);}
  haut();
  addEventListener('load',function(){haut();setTimeout(haut,60);});
  addEventListener('pageshow',function(e){if(e.persisted)haut();});

  var reduit=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
  var CIBLES='summary,.faq-q,[aria-expanded],[role="tab"],.cc-list button,.pr-tab,.pr-sub button,.px-faq button,[class*="accord"] button,[class*="-tab"],[class*="chip"],[class*="onglet"]';
  var EXCLUS='.va-btn,header,.nav,nav,.nav-links,.nav-toggle,.vm-ov,.vsaj,#vsAjout,.c-drawer,.drawer,.cart,[role="dialog"],.bests-arrow,.bests-dot,.bc-add,.btn-add,select,input,textarea,.theme-toggle,#themeToggle,.dock,[class*="catalogue-flottant"]';

  function enteteH(){
    var h=document.querySelector('.nav,header');
    if(h){var cs=getComputedStyle(h);if(cs.position==='sticky'||cs.position==='fixed')return h.getBoundingClientRect().height;}
    return 0;
  }
  function fixe(el){
    for(var n=el;n&&n!==document.body;n=n.parentElement){if(getComputedStyle(n).position==='fixed')return true;}
    return false;
  }
  function zone(t){
    /* l'élément touché + ce qu'il vient d'ouvrir */
    var r=t.getBoundingClientRect(),haut=r.top,bas=r.bottom;
    var cible=null,id=t.getAttribute('aria-controls');
    if(id)cible=document.getElementById(id);
    if(!cible){var it=t.closest('details,.faq-item,li');if(it&&it.getBoundingClientRect().height<innerHeight*1.4)cible=it;}
    if(!cible&&t.nextElementSibling)cible=t.nextElementSibling;
    if(t.closest('.cc-list')){var s=document.getElementById('ccInfo')||document.getElementById('ccSide');if(s&&s.offsetParent)cible=s;}
    if(cible&&cible.offsetParent!==null){var c=cible.getBoundingClientRect();if(c.height>0&&c.top<r.top+innerHeight){haut=Math.min(haut,c.top);bas=Math.max(bas,c.bottom);}}
    return {t:haut,b:bas,r:r};
  }
  function recaler(t){
    var z=zone(t),H=innerHeight,e=enteteH(),h=z.b-z.t;
    var centre=(z.t+z.b)/2,milieu=(H+e)/2;
    var ok=(z.t>=e+8&&z.b<=H-8&&Math.abs(centre-milieu)<H*.14);
    if(ok)return;
    var dy;
    if(h>H-e-24)dy=z.r.top-(e+16);          /* trop grand : on cale l'élément touché sous l'en-tête */
    else dy=centre-milieu;
    if(Math.abs(dy)<12)return;
    window.scrollTo({top:Math.max(0,scrollY+dy),behavior:reduit?'auto':'smooth'});
  }
  document.addEventListener('click',function(ev){
    var t=ev.target&&ev.target.closest?ev.target.closest(CIBLES):null;
    if(!t||t.closest(EXCLUS)||t.matches('a[href]')&&!t.matches('[role="tab"]')||fixe(t))return;
    if(t.disabled)return;
    setTimeout(function(){if(t.isConnected)recaler(t);},340);
  });
})();
