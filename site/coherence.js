/* Apparition douce des blocs au défilement. Sans effet si le visiteur réduit les animations. */
(function(){
  try{
    if(matchMedia('(prefers-reduced-motion:reduce)').matches||!('IntersectionObserver' in window))return;
    var sel='.sec-tag,.sec-h,.evs-head,.bests-head,.blog-head,.faq-list,.faq-q-cta,.rv-c,.rf-in,.cta-engage>*,.contact-grid>*,.proof-item,.rv-card,.reviews-wrap';
    var els=[].slice.call(document.querySelectorAll(sel)).filter(function(e){return e.getBoundingClientRect().top>innerHeight*1.7});
    if(!els.length)return;
    document.documentElement.classList.add('mv');
    var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{threshold:.12,rootMargin:'0px 0px -6% 0px'});
    els.forEach(function(e,i){e.setAttribute('data-mv','');e.style.setProperty('--d',(i%3)*.08+'s');io.observe(e)});
    setTimeout(function(){els.forEach(function(e){e.classList.add('in')})},6000); // filet de sécurité
  }catch(e){}
})();

/* Fenêtre (pop-up produit, panier, devis) ouverte : les défilements automatiques se mettent en pause. */
window.__vespraPopup=function(){return !!document.querySelector('.vm-ov.open,.c-overlay.open,.devis-popup.open');};

/* Onglets des prestataires : l'onglet choisi reste visible, le fondu de droite disparaît en fin de défilement */
(function(){
  function suivre(nav){
    function maj(){nav.classList.toggle('fin',nav.scrollLeft+nav.clientWidth>=nav.scrollWidth-4)}
    function centrer(){var t=nav.querySelector('.pr-tab[aria-selected="true"]');if(t&&nav.scrollWidth>nav.clientWidth){nav.scrollTo({left:Math.max(0,t.offsetLeft-16),behavior:'smooth'})}maj()}
    nav.addEventListener('scroll',maj,{passive:true});
    new MutationObserver(centrer).observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-selected']});
    centrer();
  }
  function init(){document.querySelectorAll('.pr-nav').forEach(suivre)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* Pages d'organisation : l'image du prestataire (et un double-clic sur son onglet) ouvre sa page complète */
(function(){
  var PAGES=[[/serveuse/i,'/serveuse-privee.html'],[/p[âa]tissier/i,'/chef-patissier.html'],[/photographe/i,'/photographe.html'],[/vid[ée]aste/i,'/videaste.html']];
  function page(t){t=String(t||'');for(var i=0;i<PAGES.length;i++)if(PAGES[i][0].test(t))return PAGES[i][1];return ''}
  function init(){
    var hero=document.getElementById('prHero');if(!hero||!document.querySelector('.pr-tab'))return;
    var lien=document.createElement('a');lien.className='pr-voir';lien.textContent='Voir la page complète';hero.appendChild(lien);
    function cible(){var t=document.querySelector('.pr-tab[aria-selected="true"]');return page(t&&t.textContent)}
    function maj(){var u=cible();lien.href=u||'#';lien.hidden=!u;hero.classList.toggle('pr-cliquable',!!u)}
    maj();new MutationObserver(maj).observe(document.getElementById('prNav')||hero,{subtree:true,attributes:true,attributeFilter:['aria-selected'],childList:true});
    hero.addEventListener('click',function(e){if(e.target.closest('.pr-tab,.pr-nav,a'))return;var u=cible();if(u)location.href=u});
    /* deux clics rapprochés sur le même onglet (l'onglet est redessiné au premier clic : l'événement dblclick ne suffit pas) */
    var dernier={t:'',h:0};
    document.addEventListener('click',function(e){var t=e.target.closest('.pr-tab');if(!t)return;var x=t.textContent,n=Date.now();if(x===dernier.t&&n-dernier.h<450){var u=page(x);if(u)location.href=u}dernier={t:x,h:n}},true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* Images affichées sans attente : celles qui vont entrer à l'écran (jusqu'à environ 2 écrans plus bas)
   commencent à se charger en avance, et celles des carrousels se chargent dès que la page est prête,
   au lieu d'attendre le dernier moment (sinon des carrés blancs apparaissent pendant le défilement). */
(function(){
  function avance(i){if(i.loading==='lazy'){i.loading='eager'}}
  function carrousels(){document.querySelectorAll('.bests-track img,.evs-track img,.blog-grid img,.blog-wrap img,.reviews-wrap img,.evc-ph img,.pr-cs img,[data-evcar] img,.ev-car img').forEach(avance)}
  function init(){
    if('IntersectionObserver' in window){
      var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){avance(e.target);io.unobserve(e.target)}})},{rootMargin:'1800px 1200px'});
      var vus=new WeakSet();
      var suivre=function(){document.querySelectorAll('img[loading="lazy"]').forEach(function(i){if(!vus.has(i)){vus.add(i);io.observe(i)}})};
      suivre();new MutationObserver(function(){suivre()}).observe(document.body,{childList:true,subtree:true});
    }
    var go=function(){carrousels()};
    if(document.readyState==='complete')setTimeout(go,300);else window.addEventListener('load',function(){setTimeout(go,300)});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
