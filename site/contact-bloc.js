/* Bloc « Nous contacter » : téléphone, e-mail, horaires, adresse et plan, juste avant le pied de page. */
(function(){
 var f=document.querySelector('footer'); if(!f||document.getElementById('vcb'))return;
 var st=document.createElement('style');
 st.textContent='.vcb{background:var(--g4,#F0F2F5);padding:24px 24px 56px}.vcb-in{max-width:1080px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);background:#fff;border-radius:var(--rl,20px);box-shadow:0 1px 4px rgba(0,0,0,.06),0 10px 34px rgba(12,15,20,.08);border:1px solid rgba(12,15,20,.05);overflow:hidden}.vcb-tx{padding:30px 32px}.vcb h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--g2,#646D7C);font-weight:600;margin:0 0 18px}.vcb ul{list-style:none;margin:0;padding:0;display:grid;gap:14px}.vcb li{font-size:15px;line-height:1.5;color:var(--g1,#3D4452)}.vcb li small{display:block;font-size:12px;color:var(--g2,#646D7C)}.vcb a{color:var(--navy,#2B4A6B);text-decoration:none}.vcb a:hover{text-decoration:underline}.vcb-map{min-height:280px;background:#f0f2f5}.vcb-map iframe{width:100%;height:100%;min-height:280px;border:0;display:block}.vcb-lk{display:inline-block;margin-top:18px;font-size:13px}@media(max-width:760px){.vcb{padding:16px 16px 40px}.vcb-in{grid-template-columns:1fr}.vcb-tx{padding:24px 20px}.vcb-map,.vcb-map iframe{min-height:220px}}';
 document.head.appendChild(st);
 var s=document.createElement('section'); s.className='vcb'; s.id='vcb'; s.setAttribute('aria-label','Contact');
 s.innerHTML='<div class="vcb-in"><div class="vcb-tx"><h2>Nous contacter</h2><ul>'+
 '<li><a href="tel:+33650836828">06 50 83 68 28</a><small>Appel, SMS ou WhatsApp</small></li>'+
 '<li><a href="mailto:contact@vespraevent.com">contact@vespraevent.com</a></li>'+
 '<li>Tous les jours, de 9 h à 20 h</li>'+
 '<li>1 bis allée de la Haute Gasniais<br>35500 Vitré<small>Livraison dans tout le grand Ouest</small></li></ul>'+
 '<a class="vcb-lk" href="https://maps.app.goo.gl/Xx467HsxADjk95Tw8" target="_blank" rel="noopener">Voir notre fiche Google et nos avis</a></div>'+
 '<div class="vcb-map"><iframe src="https://maps.google.com/maps?q=1+bis+all%C3%A9e+de+la+Haute+Gasniais+35500+Vitr%C3%A9&t=&z=13&ie=UTF8&iwloc=&output=embed" loading="lazy" title="Vespra Event — Vitré" allowfullscreen></iframe></div></div>';
 f.parentNode.insertBefore(s,f);
})();
