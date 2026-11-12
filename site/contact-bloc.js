/* Bloc « Nous contacter » : téléphone, e-mail, horaires, adresse et plan, juste avant le pied de page.
   Désactivable sur une page avec <meta name="no-contact-bloc">. */
(function(){
 var f=document.querySelector('footer'); if(!f||document.getElementById('vcb')||document.querySelector('meta[name="no-contact-bloc"]'))return;
 var st=document.createElement('style');
 st.textContent=[
 '.vcb{padding:clamp(28px,4vw,48px) 10px 14px;max-width:1500px;margin:0 auto}',
 '.vcb-in{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);background:#fff;border-radius:32px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05),0 24px 50px -30px rgba(20,37,58,.35);border:1px solid rgba(12,15,20,.05)}',
 '.vcb-tx{padding:clamp(26px,4vw,52px);display:flex;flex-direction:column;gap:22px}',
 '.vcb h2{font-family:"Bebas Neue",sans-serif;font-weight:400;font-size:clamp(34px,4.2vw,52px);line-height:.95;letter-spacing:.01em;color:var(--black,#0C0F14);margin:0}',
 '.vcb h2 em{display:block;font:italic 400 .8em Fraunces,Georgia,serif;color:#D97706;letter-spacing:0}',
 '.vcb ul{list-style:none;margin:0;padding:0;display:grid;gap:12px}',
 '.vcb li{display:grid;grid-template-columns:44px 1fr;column-gap:14px;align-items:center;font-size:15px;line-height:1.4;color:var(--black,#0C0F14);font-weight:600}',
 '.vcb li i{grid-row:span 2;width:44px;height:44px;border-radius:14px;background:var(--g4,#F0F2F5);color:var(--navy,#2B4A6B);display:grid;place-items:center;transition:background .3s,color .3s}',
 '.vcb li:hover i{background:var(--navy,#2B4A6B);color:#fff}',
 '.vcb li i svg{width:20px;height:20px}',
 '.vcb li small{display:block;font-size:12px;font-weight:500;color:var(--g2,#646D7C)}',
 '.vcb a{color:inherit;text-decoration:none}.vcb li a:hover{color:var(--navy,#2B4A6B)}',
 '.vcb-btns{display:flex;flex-wrap:nowrap;gap:10px}',
 '.vcb-b{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 20px;border-radius:10px;font-size:13px;font-weight:700;letter-spacing:.03em;white-space:nowrap;transition:transform .35s cubic-bezier(.2,.7,.2,1),box-shadow .35s,background .3s;min-width:0}',
 '.vcb-b1{background:var(--gold,#F59E0B);color:#0C0F14!important}.vcb-b2{background:var(--navy,#2B4A6B);color:#fff!important}',
 '.vcb-b:hover{transform:translateY(-3px);box-shadow:0 14px 24px -12px rgba(20,37,58,.6)}',
 '.vcb-lk{font-size:13px;font-weight:600;color:var(--navy,#2B4A6B)}',
 '.vcb-map{position:relative;min-height:340px;background:var(--g4,#F0F2F5);margin:14px 14px 14px 0;border-radius:22px;overflow:hidden}',
 '.vcb-map iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block}',
 '@media(max-width:800px){.vcb{padding:22px 8px 12px}.vcb-in{grid-template-columns:1fr;border-radius:24px}.vcb-map{margin:0 14px 14px;min-height:260px}.vcb-b{padding:12px 10px;font-size:12px;flex:1}}'
 ].join('');
 document.head.appendChild(st);
 var ic={tel:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
 mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
 clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
 pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'};
 var s=document.createElement('section'); s.className='vcb'; s.id='vcb'; s.setAttribute('aria-label','Contact');
 s.innerHTML='<div class="vcb-in"><div class="vcb-tx"><h2>Nous <em>contacter</em></h2><ul>'+
 '<li><i>'+ic.tel+'</i><a href="tel:+33650836828">06 50 83 68 28</a><small>Appel, SMS ou WhatsApp</small></li>'+
 '<li><i>'+ic.mail+'</i><a href="mailto:contact@vespraevent.com">contact@vespraevent.com</a><small>Réponse sous 24 h</small></li>'+
 '<li><i>'+ic.clock+'</i><span>Tous les jours, de 9 h à 20 h</span><small>Service client 7j/7</small></li>'+
 '<li><i>'+ic.pin+'</i><span>1 bis allée de la Haute Gasniais, 35500 Vitré</span><small>Livraison dans tout le grand Ouest</small></li></ul>'+
 '<div class="vcb-btns"><a class="vcb-b vcb-b1" href="tel:+33650836828">Appeler</a><a class="vcb-b vcb-b2" href="rendez-vous.html">Prendre rendez-vous</a></div>'+
 '<a class="vcb-lk" href="https://maps.app.goo.gl/Xx467HsxADjk95Tw8" target="_blank" rel="noopener">Voir notre fiche Google et nos avis →</a></div>'+
 '<div class="vcb-map"><iframe src="https://maps.google.com/maps?q=1+bis+all%C3%A9e+de+la+Haute+Gasniais+35500+Vitr%C3%A9&t=&z=13&ie=UTF8&iwloc=&output=embed" loading="lazy" title="Vespra Event — Vitré" allowfullscreen></iframe></div></div>';
 f.parentNode.insertBefore(s,f);
})();
