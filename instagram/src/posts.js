// Générateur des visuels Instagram (1080 × 1350). Textes : uniquement des informations déjà présentes sur le site.
const L=(h)=>h; // helper
const logo='<img class="logo" src="logo-vespra.svg" alt="">';
const foot=(n,t)=>`<div class="foot"><span>@vespraevent</span><span class="dots">${Array.from({length:t},(_,i)=>`<i class="${i+1===n?'on':''}"></i>`).join('')}</span><span>vespraevent.fr</span></div>`;
const S=(cls,inner,n,t,bg)=>`<section class="s ${cls}" ${bg?`style="--bg:url('${bg}')"`:''}>${inner}${foot(n,t)}</section>`;
const cta=(eye,t1,t2)=>(n,t)=>S('navy',`<div class="tx mid c"><span class="eye">${eye}</span><h2>${t1}<br><em>${t2}</em></h2><span class="btn">Prendre rendez-vous</span><span class="small">06 50 83 68 28 · vespraevent.fr</span></div>${logo}`,n,t);
const posts={
 '1-serveuse-privee':[
  (n,t)=>S('photo pos2',`<div class="shade b"></div><div class="tx bot"><span class="eye">Nos prestataires</span><h1>Serveuse privée<br><em>Candice</em></h1><p>Au service de vos invités, pour votre mariage ou votre réception.</p><span class="swipe">Faites défiler →</span></div>`,n,t,'prestation-serveuse.webp'),
  (n,t)=>S('navy',`<div class="tx mid"><span class="eye">Ce que fait Candice</span><h2>Une réception<br><em>sans souci</em></h2><ul><li>Présentation, service, mise en place</li><li>Vin d'honneur, cocktail et repas</li><li>Accueil des invités avec le sourire</li><li>Environ vingt ans d'expérience</li></ul></div>`,n,t),
  cta('Sur devis','On en parle','ensemble ?')],
 '2-chef-patissier':[
  (n,t)=>S('photo',`<div class="shade b"></div><div class="tx bot"><span class="eye">Nos prestataires</span><h1>Chef pâtissier<br><em>Emmanuel</em></h1><p>Création sur mesure : tout est possible en pâtisserie.</p><span class="swipe">Faites défiler →</span></div>`,n,t,'prestation-patissier.webp'),
  (n,t)=>S('photo',`<div class="shade l"></div><div class="tx mid"><span class="eye">Ce que crée Emmanuel</span><h2>Du gâteau<br><em>aux mignardises</em></h2><ul><li>Gâteau de mariage</li><li>Desserts et mignardises</li><li>Rendez-vous dégustation avant de choisir</li></ul></div>`,n,t,'prestation-patissier-2.webp'),
  cta('Sur devis','Un gâteau','sur mesure ?')],
 '3-organisation-a-z':[
  (n,t)=>S('top',`<div class="shade b"></div><div class="tx bot"><span class="eye">Organisation de A à Z</span><h1>Nous organisons<br><em>votre événement</em></h1><p>Vous profitez, nous nous occupons du reste.</p><span class="swipe">Faites défiler →</span></div>`,n,t,'nous-organisons.webp'),
  (n,t)=>S('navy',`<div class="tx mid"><span class="eye">Pas seulement du matériel</span><h2>Trois choses,<br><em>un seul interlocuteur</em></h2><div class="trio"><div><b>Matériel</b><span>photobooth, son, lumière, barnums…</span></div><div><b>Prestations</b><span>pour accompagner votre événement</span></div><div><b>Intervenants</b><span>serveuse privée, chef pâtissier…</span></div></div></div>`,n,t),
  (n,t)=>S('photo pos4',`<div class="shade l"></div><div class="tx mid"><span class="eye">Pour quels événements ?</span><h2>Mariages,<br>anniversaires,<br><em>entreprises</em></h2><p>Soirées privées, événements professionnels, associations et collectivités.</p></div>`,n,t,'pack-mariage.webp'),
  cta('Venez nous voir à Vitré','Nous organisons,','vous profitez !')]
};
const css=`
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Fraunces:ital,wght@1,400&family=Inter:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0}body{width:1080px;height:1350px;background:#14253A;font-family:Inter,sans-serif;color:#fff;overflow:hidden}
.s{position:relative;width:1080px;height:1350px;overflow:hidden;background:#14253A}
.s.photo{background:var(--bg) center/cover}.s.top{background:var(--bg) 54% top/auto 1010px no-repeat #14253A}.s.photo.pos2{background-position:30% center}.s.photo.pos3{background-position:60% center}.s.photo.pos4{background-position:center 62%}
.split{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;gap:6px}.split div{background:center/cover}
.shade{position:absolute;inset:0}.shade.b{background:linear-gradient(0deg,#0b1522 8%,rgba(11,21,34,.78) 38%,rgba(11,21,34,0) 72%)}.shade.l{background:linear-gradient(90deg,rgba(11,21,34,.94) 12%,rgba(11,21,34,.7) 52%,rgba(11,21,34,.15))}
.navy{background:radial-gradient(120% 90% at 50% 40%,#2B4A6B 0%,#1E3C5C 45%,#16293E 100%)}
.tx{position:absolute;left:80px;right:80px;display:flex;flex-direction:column;gap:28px;align-items:flex-start}.tx.bot{bottom:170px}.tx.mid{top:50%;transform:translateY(-50%)}.tx.c{align-items:center;text-align:center}
.eye{font:700 26px Inter;letter-spacing:.2em;text-transform:uppercase;color:#F59E0B}
h1{font:400 128px/.92 'Bebas Neue';letter-spacing:.01em}h2{font:400 112px/.94 'Bebas Neue';letter-spacing:.01em}
em{display:block;font:italic 400 .72em Fraunces,Georgia,serif;color:#F59E0B;letter-spacing:0;margin-top:10px}
p{font-size:38px;line-height:1.4;color:rgba(255,255,255,.9);max-width:820px}
ul{list-style:none;padding:0;display:grid;gap:18px;font-size:38px;color:rgba(255,255,255,.95)}ul li{padding-left:44px;position:relative}ul li:before{content:"";position:absolute;left:0;top:.45em;width:20px;height:20px;border-radius:50%;background:#F59E0B}
.swipe{font:600 28px Inter;color:rgba(255,255,255,.75);letter-spacing:.04em}
.btn{display:inline-block;background:#F59E0B;color:#0C0F14;font:700 36px Inter;padding:30px 54px;border-radius:999px;margin-top:12px}.small{font:500 32px Inter;color:rgba(255,255,255,.8)}
.trio{display:grid;gap:22px;width:100%}.trio div{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);border-radius:36px;padding:34px 40px}.trio b{display:block;font:400 64px/1 'Bebas Neue';color:#F59E0B;margin-bottom:8px}.trio span{font-size:34px;color:rgba(255,255,255,.9)}
.steps{display:grid;gap:30px;width:100%}.steps div{display:grid;grid-template-columns:110px 1fr;column-gap:30px;align-items:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);border-radius:40px;padding:36px}.steps i{grid-row:span 2;width:110px;height:110px;border-radius:50%;background:#F59E0B;color:#0C0F14;display:grid;place-items:center;font:400 70px 'Bebas Neue';font-style:normal}.steps b{font:400 70px/1 'Bebas Neue'}.steps span{font-size:32px;color:rgba(255,255,255,.88)}
.logo{position:absolute;top:70px;right:80px;height:70px;width:auto;filter:brightness(0) invert(1)}
.foot{position:absolute;left:80px;right:80px;bottom:60px;display:flex;justify-content:space-between;align-items:center;font:600 26px Inter;color:rgba(255,255,255,.75)}
.dots{display:flex;gap:10px}.dots i{width:12px;height:12px;border-radius:99px;background:rgba(255,255,255,.35)}.dots i.on{width:38px;background:#fff}`;
module.exports={posts,css};
