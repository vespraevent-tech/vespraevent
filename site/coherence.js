/* Apparition douce des blocs au défilement. Sans effet si le visiteur réduit les animations. */
(function(){
  try{
    if(matchMedia('(prefers-reduced-motion:reduce)').matches||!('IntersectionObserver' in window))return;
    var sel='.sec-tag,.sec-h,.evs-head,.bests-head,.blog-head,.faq-list,.faq-q-cta,.rv-c,.rf-in,.cta-engage>*,.contact-grid>*,.proof-item,.rv-card,.reviews-wrap';
    var els=[].slice.call(document.querySelectorAll(sel)).filter(function(e){return e.getBoundingClientRect().top>innerHeight*0.9});
    if(!els.length)return;
    document.documentElement.classList.add('mv');
    var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{threshold:.12,rootMargin:'0px 0px -6% 0px'});
    els.forEach(function(e,i){e.setAttribute('data-mv','');e.style.setProperty('--d',(i%3)*.08+'s');io.observe(e)});
    setTimeout(function(){els.forEach(function(e){e.classList.add('in')})},6000); // filet de sécurité
  }catch(e){}
})();

/* Fenêtre (pop-up produit, panier, devis) ouverte : les défilements automatiques se mettent en pause. */
window.__vespraPopup=function(){return !!document.querySelector('.vm-ov.open,.c-overlay.open,.devis-popup.open');};
