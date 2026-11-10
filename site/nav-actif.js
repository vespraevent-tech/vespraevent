/* Met en gras le lien de l'entête qui correspond à la page affichée. */
(function(){
 var nav=document.querySelector('.nav-links'); if(!nav)return;
 var p=(location.pathname||'/').replace(/\/+$/,'').replace(/^\//,'').replace(/\.html$/,'')||'index';
 var cible;
 if(p==='index')cible='index';
 else if(p==='catalogue'||p.indexOf('produit-')===0||p==='pack-mariage')cible='catalogue';
 else if(p==='prestations'||p==='nos-prestataires')cible='prestations';
 else if(p==='rendez-vous')cible='rendez-vous';
 else if(p==='blog'||p.indexOf('article-')===0)cible='blog';
 else if(p==='faq')cible='faq';
 else return;
 var st=document.createElement('style');
 st.textContent='.nav-links a.active{color:var(--navy,#2B4A6B);font-weight:700}';
 document.head.appendChild(st);
 nav.querySelectorAll('a').forEach(function(a){
  var h=(a.getAttribute('href')||'').replace(/^\//,'').replace(/\.html$/,'').split(/[?#]/)[0]||'index';
  var on=h===cible; a.classList.toggle('active',on);
  if(on)a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
 });
})();
