/* Sections de l'accueil réutilisées sur les pages villes :
   « Quel événement préparez-vous ? » (bandeau qui défile) et carrousels de cartes produit. */
(function(){
var PROD=[{"id":"p3","cat":"Photobooth et accessoires","name":"Photobooth","price":130,"desc":"Photobooth professionnel pour immortaliser tous les moments forts de votre soirée.","img":"photobooth.webp","link":"produit-photobooth.html","vdef":0},{"id":"p24","cat":"Photobooth et accessoires","name":"Panneau de bienvenue","price":190,"desc":"Panneau en bois blanc à paroi vitrée ruisselante : l'eau coule en continu derrière vos prénoms et votre date. Jardinières fleuries comprises.","img":"panneau-bienvenue.webp","link":"produit-panneau-bienvenue.html","vdef":0},{"id":"p31","cat":"Photobooth et accessoires","name":"Cabine téléphonique (décor seul)","price":60,"desc":"Cabine à portes vitrées, blanche ou rouge, en décor. Pour les messages vidéo et l'écran tactile : la cabine vidéo, 149 €.","img":"cabine-decor-blanche.webp","link":"produit-cabine-telephonique.html","vdef":1},{"id":"p46","cat":"Photobooth et accessoires","name":"Cabine téléphonique vidéo","price":149,"desc":"Cabine blanche ou rouge avec livre d'or vidéo et écran tactile : une caméra et un micro captent le message de chaque invité. 149 € l'événement.","img":"cabine-telephonique-rouge.webp","link":"produit-cabine-telephonique-audio-video.html","vdef":1},{"id":"p32","cat":"Photobooth et accessoires","name":"Néon lumineux","price":20,"desc":"Néon lumineux avec le message de votre choix, seul ou dans une cabine téléphonique.","img":"neon-lumineux.webp","link":"produit-neon-lumineux.html","vdef":0},{"id":"p8","cat":"Son, lumière et vidéo","name":"Pack Vespra","price":50,"desc":"Pack tout-en-un pensé pour accueillir vos invités dans les meilleures conditions.","img":"pack-vespra-200-v2.webp","link":"produit-pack-vespra.html","vdef":0},{"id":"p4","cat":"Mobilier, réception et barnums","name":"Barnum 3×3 m","price":60,"desc":"Barnum pliant 3×3 m, de 8 à 12 personnes assises : le stand d'appoint ou le coin buvette.","img":"barnum-situation.webp","link":"produit-barnum-3x3.html","vdef":1},{"id":"p44","cat":"Mobilier, réception et barnums","name":"Barnum 4×6 m","price":85,"desc":"Barnum auto-pliant 4×6 m, de 24 à 25 personnes assises (48 debout) : se monte sans outil, idéal pour un cocktail ou un buffet.","img":"barnum-4x6.webp","link":"produit-barnum-4x6.html","vdef":1},{"id":"p36","cat":"Mobilier, réception et barnums","name":"Barnum 4×8 m","price":125,"desc":"Barnum pliant 4×8 m, de 30 à 40 personnes assises : idéal pour un repas ou un vin d'honneur.","img":"barnum-situation.webp","link":"produit-barnum-4x8.html","vdef":1},{"id":"p37","cat":"Mobilier, réception et barnums","name":"Barnum 6×10 m","price":190,"desc":"Barnum pliant 6×10 m, de 60 à 80 personnes assises : la grande réception sous toile.","img":"barnum-situation.webp","link":"produit-barnum-6x10.html","vdef":1},{"id":"p9","cat":"Mobilier, réception et barnums","name":"Boîte de nuit gonflable","price":195,"desc":"Structure gonflable disco avec effets lumineux intégrés pour une ambiance unique.","img":"boite-nuit-situation.webp","link":"produit-boite-nuit.html","vdef":0},{"id":"p12","cat":"Son, lumière et vidéo","name":"Boule à facettes","price":35,"desc":"Boule à facettes avec motorisation et éclairage pour une ambiance disco garantie.","img":"boule-facettes-situation.webp","link":"produit-boule-facettes.html","vdef":0},{"id":"p33","cat":"Son, lumière et vidéo","name":"Guirlande lumineuse","price":9,"desc":"Guirlande lumineuse à grosses ampoules, en 10, 20 ou 40 m : l'ambiance guinguette pour vos soirées.","img":"guirlande-lumineuse.webp","link":"produit-guirlande-lumineuse.html","vdef":0},{"id":"p38","cat":"Mobilier, réception et barnums","name":"Tente étoile Ø 10 m","price":190,"desc":"Tente étoile blanche de 10 m de diamètre (13,65 × 8,65 m au sol), environ 50 à 60 personnes assises.","img":"tente-etoile-situation.webp","link":"produit-tente-etoile-10m.html","vdef":1},{"id":"p39","cat":"Mobilier, réception et barnums","name":"Tente étoile Ø 14 m","price":270,"desc":"Tente étoile blanche de 14 m de diamètre (19,10 × 12,10 m au sol), environ 80 personnes assises.","img":"tente-etoile-situation.webp","link":"produit-tente-etoile-14m.html","vdef":1},{"id":"p6","cat":"Barnums","name":"Tente étoile Ø 22 m","price":590,"desc":"Grande tente étoile blanche de 22 m de diamètre, pour mariages et événements d'envergure.","img":"tente-etoile-situation.webp","link":"produit-tente-etoile-22m.html","vdef":1},{"id":"p10","cat":"Photobooth et accessoires","name":"Livre d'or audio","price":35,"desc":"Téléphone vintage qui enregistre les messages vocaux de vos invités, jusqu'à 100 heures. Se loue seul.","img":"telephone-vintage-2.webp","link":"produit-livre-or-audio.html","vdef":0},{"id":"p1","cat":"Restauration","name":"Brasero","price":100,"desc":"Brasero pour réchauffer vos convives lors de vos soirées en extérieur.","img":"brasero-situation.webp","link":"produit-brasero.html","vdef":0},{"id":"p13","cat":"Son, lumière et vidéo","name":"Sonorisation","price":20,"desc":"Système de sonorisation complet pour animer vos soirées et événements, de 20 à 250 personnes.","img":"sono-180-250.webp","link":"produit-sonorisation.html","vdef":0},{"id":"p14","cat":"Son, lumière et vidéo","name":"Pack karaoké","price":20,"desc":"Pack karaoké sur batterie avec 2 micros — prêt à l'emploi, sans fil.","img":"karaoke.webp","link":"produit-karaoke.html","vdef":0},{"id":"p5","cat":"Mobilier, réception et barnums","name":"Buvette 4 comptoirs","price":265,"desc":"Buvette pliante 4×4m avec 4 comptoirs en bois — idéale pour vos manifestations.","img":"buvette.webp","link":"produit-buvette.html","vdef":0},{"id":"p15","cat":"Son, lumière et vidéo","name":"Jeux de lumières","price":20,"desc":"Pack de projecteurs LED et effets de lumières pour sublimer vos espaces.","img":"jeux-lumieres-situation.webp","link":"produit-jeux-lumieres.html","vdef":0},{"id":"p43","cat":"Son, lumière et vidéo","name":"Spot LED sur batterie","price":20,"desc":"Spot LED sur batterie Starville BEL4 (4 × 15 W) : 15 heures d'autonomie, changement de couleur, DMX, fonctionne même en plein jour. Fourni avec flycases et accessoires. 12 disponibles.","img":"spot-led-batterie-ambiance.webp","link":"produit-spot-led-batterie.html","vdef":0},{"id":"p45","cat":"Mobilier, réception et barnums","name":"Mange-debout housse blanche","price":13,"desc":"Mange-debout avec housse blanche : plateau de 90 cm, 110 cm de hauteur. 10 disponibles.","img":"mange-debout.webp","link":"produit-mange-debout.html","vdef":0},{"id":"p20","cat":"Son, lumière et vidéo","name":"Vidéoprojecteur","price":20,"desc":"Vidéoprojecteur HD pour diffuser vos contenus lors de mariages et soirées.","img":"videoprojecteur.webp","link":"produit-videoprojecteur.html","vdef":0},{"id":"p47","cat":"Son, lumière et vidéo","name":"Écran de projection","price":10,"desc":"Écran de projection sur pied, à associer au vidéoprojecteur pour une image nette et lumineuse.","img":"ecran-projection.webp","link":"produit-ecran-projection.html","vdef":0},{"id":"p19","cat":"Son, lumière et vidéo","name":"Caisson de basse","price":40,"desc":"Caisson de basse actif pour renforcer votre sonorisation. Compatible avec tous nos packs sono.","img":"caisson-basse.webp","link":"produit-caisson-basse.html","vdef":0},{"id":"p42","cat":"Son, lumière et vidéo","name":"Micro Shure SM58","price":10,"desc":"Le micro de scène de référence, à ajouter à votre sonorisation. Filaire 10 €, sans fil 20 €, 2 micros conseillés.","img":"micro-shure-sm58.webp","link":"produit-micro-shure-sm58.html","vdef":0},{"id":"p11","cat":"Restauration","name":"Machine à Pop Corn","price":20,"desc":"Machine à pop-corn professionnelle sur chariot avec vitrine chauffante. Maïs en option.","img":"popcorn-situation.webp","link":"produit-popcorn.html","vdef":0},{"id":"p34","cat":"Jeux en bois","name":"Baby-foot","price":90,"desc":"Baby-foot en bois, produit unique, loué pour l'événement.","img":"jeux-baby-foot.webp","link":"produit-baby-foot.html","vdef":0},{"id":"p21","cat":"Effets spéciaux et artifices","name":"Machine à fumée","price":10,"desc":"Une fumée légère pour révéler les faisceaux lumineux et renforcer l’ambiance.","img":"machine-fumee.webp","link":"produit-machines-effets.html?v=1","vdef":0},{"id":"p23","cat":"Effets spéciaux et artifices","name":"Machine à bulles","price":10,"desc":"Une animation de bulles pour créer un moment féerique lors de vos événements.","img":"machine-bulles-situation.webp","link":"produit-machines-effets.html","vdef":0},{"id":"p22","cat":"Effets spéciaux et artifices","name":"Feux d'artifice de jour","price":179,"desc":"Feux d'artifice de jour à la poudre colorée : 4, 6, 8 ou 12 canons, une couleur par canon.","img":"canon-poudre-arc-en-ciel.webp","link":"produit-canons-poudre.html","vdef":0},{"id":"p40","cat":"Effets spéciaux et artifices","name":"Machine à fumée lourde effet brouillard","price":60,"desc":"Une fumée lourde au sol, aspect de brouillard : environ 300 m³/min pour une piste de 50 à 60 m². Sans glaçons ni CO₂, liquide compris.","img":"fumee-lourde-wgf-2000-situation.webp","link":"produit-fumee-lourde-brouillard.html","vdef":0},{"id":"p41","cat":"Effets spéciaux et artifices","name":"Machine à fumée lourde effet nuage","price":150,"desc":"Un vrai nuage au sol, plus joli et plus qualitatif : débit bien plus rapide, 100 m² en moins d'une minute. Sans glaçons ni CO₂, liquide compris.","img":"fumee-lourde-nuage.webp","link":"produit-fumee-lourde-nuage.html","vdef":0},{"id":"p35","cat":"Effets spéciaux et artifices","name":"Machine à étincelles froides","price":85,"desc":"Machines à étincelles froides professionnelles : un show spectaculaire sans chaleur, en intérieur comme en extérieur. 1 ou 2 machines, télécommande et flight case.","img":"etincelles-froides-situation.webp","link":"produit-etincelles-froides.html","vdef":0},{"id":"p7","cat":"Mobilier, réception et barnums","name":"Méga ventilateur","price":10,"desc":"Ventilateur industriel grand diamètre pour garder la fraîcheur sous vos barnums et tentes de réception.","img":"ventilateur.webp","link":"produit-mega-ventilateur.html","vdef":0},{"id":"p50","cat":"Voitures de collection","name":"Citroën Traction","price":380,"desc":"Citroën Traction de collection avec chauffeur : 5 heures, 150 km inclus, carburant et assurance compris.","img":"citroen-traction.webp","link":"produit-citroen-traction.html","vdef":1},{"id":"p51","cat":"Voitures de collection","name":"Ford Mustang","price":470,"desc":"Ford Mustang de collection avec chauffeur : 5 heures, 150 km inclus, carburant et assurance compris.","img":"ford-mustang.webp","link":"produit-ford-mustang.html","vdef":1},{"id":"p48","cat":"Décoration","name":"Panneau de direction","price":40,"desc":"Panneau de direction en bois à 5 flèches personnalisées : cérémonie, cocktail, livre d'or, photobooth, toilettes.","img":"panneau-direction.webp","link":"produit-panneau-direction.html","vdef":0},{"id":"p49","cat":"Restauration","name":"Fontaine à cocktail","price":50,"desc":"Fontaine à cocktail blanche portant l'inscription « Fontaine cocktail », pour servir vos boissons.","img":"fontaine-cocktail.webp","link":"produit-fontaine-cocktail.html","vdef":0},{"id":"p54","cat":"Châteaux gonflables","name":"Mini bounce crocodile","price":80,"desc":"Mini château gonflable crocodile avec toboggan : compact, il se pose dans un jardin ou une cour. Idéal pour un anniversaire d'enfants à la maison.","img":"chateau-mini-bounce-crocodile.webp","link":"produit-mini-bounce-crocodile.html","vdef":0},{"id":"p55","cat":"Châteaux gonflables","name":"Bouncedome gonflable avec toboggan Amazone Safari","price":100,"desc":"Bouncedome gonflable sur le thème de la jungle, avec toboggan : un dôme couvert, des animaux et un explorateur, pour un anniversaire d'enfants qui sort de l'ordinaire.","img":"chateau-bouncedome-amazone-safari.webp","link":"produit-bouncedome-amazone-safari.html","vdef":0},{"id":"p56","cat":"Châteaux gonflables","name":"Multiplay château gonflable Dinoworld","price":150,"desc":"Grand château gonflable multi-activités sur le thème des dinosaures : toboggan en façade, obstacles et filets. Jusqu'à 12 enfants en même temps.","img":"chateau-dinoworld.webp","link":"produit-chateau-dinoworld.html","vdef":0},{"id":"p57","cat":"Châteaux gonflables","name":"Château gonflable Multiplay Summer Party","price":150,"desc":"Grand château gonflable multi-activités sur le thème de la fête d'été : toboggan et obstacles, couleurs vives. Jusqu'à 12 enfants en même temps.","img":"chateau-summer-party.webp","link":"produit-chateau-summer-party.html","vdef":0},{"id":"p2a","cat":"Jeux en bois","name":"Cornhole","price":15,"desc":"Cornhole : lancez les sacs dans le trou, un classique convivial.","img":"jeux-cornhole.webp","link":"produit-cornhole.html","vdef":0},{"id":"p2b","cat":"Jeux en bois","name":"Palet breton","price":10,"desc":"Palet breton : le jeu traditionnel de précision.","img":"jeux-palet-breton.webp","link":"produit-palet-breton.html","vdef":0},{"id":"p2c","cat":"Jeux en bois","name":"Puissance 4 géant","price":15,"desc":"Puissance 4 géant en bois, en duel ou en équipes.","img":"jeux-puissance4.webp","link":"produit-puissance-4-geant.html","vdef":0},{"id":"p2d","cat":"Jeux en bois","name":"Passe-trappe","price":15,"desc":"Passe-trappe : faites passer les palets par les trappes.","img":"jeux-passe-trappe.webp","link":"produit-passe-trappe.html","vdef":0}];
var BEST=['p3','p22','p24','p35','p8','p6','p34','p37','p9','p39','p1','p31'];
function esc(t){return String(t||'').replace(/"/g,'&quot;');}
/* Petite fenêtre d'ajout : choix de la formule et de la quantité, puis ajout au devis. */
function lignesRegistre(link){
  var R=window.VESPRA_PRIX_REGISTRE||[],out=[];
  R.forEach(function(v){
    var pgs=v.pgs||[v.pg];
    if(pgs.indexOf(link)<0||v.opt||v.p==null)return;
    out.push(v);
  });
  return out;
}
function fermerAjout(){var m=document.getElementById('vsAjout');if(m)m.remove();document.removeEventListener('keydown',echapAjout);}
function echapAjout(e){if(e.key==='Escape')fermerAjout();}
function popupAjout(p){
  fermerAjout();
  var lignes=lignesRegistre(p.link.split('?')[0]);
  if(!lignes.length){location.href=p.link;return;}
  var m=document.createElement('div');m.id='vsAjout';m.className='vsaj';
  m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-label','Ajouter '+p.name+' au devis');
  var opts=lignes.map(function(v,i){return '<option value="'+i+'">'+esc(v.v||v.n)+' — '+v.p+' €</option>';}).join('');
  m.innerHTML='<div class="vsaj-fond"></div><div class="vsaj-boite">'
   +'<button type="button" class="vsaj-x" aria-label="Fermer">&times;</button>'
   +'<div class="vsaj-haut"><img src="'+p.img+'" alt="" loading="lazy"><div><div class="vsaj-cat">'+esc(p.cat||'')+'</div><div class="vsaj-nom">'+esc(p.name)+'</div></div></div>'
   +(lignes.length>1?'<label class="vsaj-lab" for="vsajV">Formule</label><select class="vsaj-sel" id="vsajV">'+opts+'</select>':'')
   +'<label class="vsaj-lab" for="vsajQ">Quantité</label>'
   +'<div class="vsaj-qte"><button type="button" class="vsaj-b" data-d="-1" aria-label="Retirer un">&minus;</button>'
   +'<input id="vsajQ" class="vsaj-n" type="text" inputmode="numeric" value="1" aria-label="Quantité">'
   +'<button type="button" class="vsaj-b" data-d="1" aria-label="Ajouter un">+</button>'
   +'<span class="vsaj-tot" id="vsajT"></span></div>'
   +'<button type="button" class="vsaj-ok" id="vsajOk">Ajouter au devis</button>'
   +'<a class="vsaj-fiche" href="'+p.link+'">Voir la fiche du produit</a>'
   +'</div>';
  document.body.appendChild(m);
  var sel=m.querySelector('#vsajV'),qte=m.querySelector('#vsajQ'),tot=m.querySelector('#vsajT');
  function ligne(){return lignes[sel?+sel.value:0];}
  function n(){var v=parseInt(qte.value,10);return Math.max(1,Math.min(99,isNaN(v)?1:v));}
  function maj(){qte.value=n();tot.textContent=(ligne().p*n())+' €';}
  m.querySelectorAll('.vsaj-b').forEach(function(b){b.addEventListener('click',function(){qte.value=n()+(+b.dataset.d);maj();});});
  qte.addEventListener('input',function(){tot.textContent=(ligne().p*n())+' €';});
  qte.addEventListener('blur',maj);
  if(sel)sel.addEventListener('change',maj);
  maj();
  m.querySelector('.vsaj-x').addEventListener('click',fermerAjout);
  m.querySelector('.vsaj-fond').addEventListener('click',fermerAjout);
  document.addEventListener('keydown',echapAjout);
  m.querySelector('#vsajOk').addEventListener('click',function(){
    var v=ligne(),q=n();
    if(!window.addToCart){location.href=p.link;return;}
    for(var i=0;i<q;i++)window.addToCart({id:v.i,name:p.name,price:v.p,img:p.img,label:(lignes.length>1?v.v:'')});
    fermerAjout();
  });
  setTimeout(function(){(sel||qte).focus();},40);
}
window.popupAjout=function(p){ajout(p,true)};
function chargerVM(fin){
  if(window.vespraVM)return fin();
  var n=0,att=2;function ok(){if(++n>=att)fin();}
  var l=document.createElement('link');l.rel='stylesheet';l.href='/vm-popup.css?v=1';document.head.appendChild(l);
  function js(src,cb){var x=document.createElement('script');x.src=src;x.onload=cb;x.onerror=cb;document.head.appendChild(x);}
  if(window.VESPRA_CANONS)ok();else js('/canons.js',ok);
  js('/vm-popup.js?v=1',ok);
}
function ajout(p,add){
  if(add&&window.addToCart){
    chargerVM(function(){
      var id=window.vespraVM&&window.vespraVM.byPage(String(p.link||'').replace(/^\//,'').split('#')[0]);
      if(id)window.vespraVM.open(id);else popupAjout(p);
    });
    return;
  }
  location.href=p.link;
}
function carte(p,add){
  var c=document.createElement('div');c.className='bc';
  c.innerHTML='<div class="bc-img-wrap"><img class="bc-img" src="'+p.img+'" alt="'+esc(p.name)+'" loading="lazy" decoding="async"></div>'
   +'<div class="bc-body"><div class="bc-cat">'+p.cat+'</div><div class="bc-name">'+p.name+'</div><div class="bc-desc">'+p.desc+'</div><div class="bc-foot"><div class="bc-price">'+(p.vdef?'':'<span class="bc-from">À partir de</span>')+p.price+' €</div>'
   +'<span class="bc-add" aria-hidden="true">+</span></div></div>';
  var a=document.createElement('a');a.href=p.link;a.className='bc-lien';a.setAttribute('aria-label',p.name);
  a.style.cssText='position:absolute;inset:0;z-index:4';c.style.position='relative';c.appendChild(a);
  var bt=c.querySelector('.bc-add');bt.style.cssText='position:relative;z-index:5;display:flex;align-items:center;justify-content:center';bt.setAttribute('role','button');bt.setAttribute('tabindex','0');bt.setAttribute('aria-label',(add?'Ajouter ':'Voir ')+esc(p.name));bt.removeAttribute('aria-hidden');
  var go=function(e){e.preventDefault();e.stopPropagation();ajout(p,add);};bt.addEventListener('click',go);bt.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' ')go(e);});
  return c;
}
function carrousel(o){
  var wrap=document.getElementById(o.wrap),track=document.getElementById(o.track),dotsEl=document.getElementById(o.dots);
  var prev=document.getElementById(o.prev),next=document.getElementById(o.next);
  if(!wrap||!track)return;
  var ids=o.ids,cards=ids.map(function(id){return PROD.find(function(x){return x.id===id;});}).filter(Boolean);
  var N=cards.length;if(!N)return;
  function remplir(){track.innerHTML='';cards.forEach(function(p){track.appendChild(carte(p,o.add));});cards.forEach(function(p){var c=carte(p,o.add);c.setAttribute('aria-hidden','true');c.querySelector('a').tabIndex=-1;track.appendChild(c);});}
  remplir();track.style.width='max-content';
  function step(){var f=track.children[0];return (f?f.getBoundingClientRect().width:300)+(parseFloat(getComputedStyle(track).gap)||0);}
  function cur(){return Math.max(0,Math.min(N-1,Math.round(wrap.scrollLeft/step())));}
  function majDots(){if(!dotsEl)return;var k=cur();dotsEl.querySelectorAll('.bests-dot').forEach(function(d,i){d.classList.toggle('on',i===k);});}
  function pastilles(){if(!dotsEl)return;dotsEl.innerHTML='';for(var k=0;k<N;k++){(function(k){var d=document.createElement('button');d.className='bests-dot'+(k===0?' on':'');d.setAttribute('aria-label','Produit '+(k+1));d.addEventListener('click',function(){pause();wrap.scrollTo({left:k*step(),behavior:'smooth'});});dotsEl.appendChild(d);})(k);}}
  pastilles();
  if(o.bo){
    var der='';
    var charger=function(){
      if(typeof window.VESPRA_DONNEES!=='function')return;
      window.VESPRA_DONNEES('produits').then(function(items){
        if(!Array.isArray(items))return;
        var x=items.find(function(y){return y&&y.type==='ordre-accueil';});var l=x&&x.ordre;
        if(typeof l==='string'){try{l=JSON.parse(l);}catch(e){l=[];}}
        if(!Array.isArray(l)||!l.length)return;
        var nv=l.map(function(id){return PROD.find(function(y){return y.id===id;});}).filter(Boolean);
        if(!nv.length||nv.map(function(y){return y.id;}).join('|')===der)return;
        der=nv.map(function(y){return y.id;}).join('|');cards=nv;N=nv.length;remplir();pastilles();wrap.scrollLeft=0;
      }).catch(function(){});
    };
    window.addEventListener('vespra-produits-ready',charger);charger();
  }
  wrap.addEventListener('scroll',majDots,{passive:true});
  var VIT=30,rafId=null,dernier=0,enPause=false,visible=true,reste=0,rep=null,attendu=0;
  function pause(d){enPause=true;clearTimeout(rep);rep=setTimeout(function(){enPause=false;dernier=0;},d||500);}
  /* souris posée dessus ou doigt posé : le défilement s'arrête, il reprend peu après */
  wrap.addEventListener('pointerenter',function(e){if(e.pointerType==='mouse'){enPause=true;clearTimeout(rep);}});
  wrap.addEventListener('pointerleave',function(e){if(e.pointerType==='mouse')pause(350);});

  prev&&prev.addEventListener('click',function(){pause(1200);wrap.scrollBy({left:-Math.max(240,wrap.clientWidth*.82),behavior:'smooth'});});
  next&&next.addEventListener('click',function(){pause(1200);wrap.scrollBy({left:Math.max(240,wrap.clientWidth*.82),behavior:'smooth'});});
  var reduit=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
  function image(t){
    if(!wrap.isConnected){return;}
    if(enPause||!visible||document.hidden||(window.__vespraPopup&&window.__vespraPopup())){dernier=t;rafId=requestAnimationFrame(image);return;}
    if(!dernier)dernier=t;var dt=Math.min(100,t-dernier)/1000;dernier=t;reste+=VIT*dt;var pas=Math.floor(reste);
    if(pas>0){reste-=pas;wrap.scrollLeft+=pas;var m=track.scrollWidth/2;if(m>0&&wrap.scrollLeft>=m)wrap.scrollLeft-=m;attendu=wrap.scrollLeft;}
    rafId=requestAnimationFrame(image);
  }
  wrap.addEventListener('scroll',function(){if(Math.abs(wrap.scrollLeft-attendu)>2)pause(450);attendu=wrap.scrollLeft;},{passive:true});
  wrap.addEventListener('pointerdown',function(e){if(e.pointerType==='mouse')pause(450);},{passive:true});
  var tx=0,ty=0;
  wrap.addEventListener('touchstart',function(e){var t=e.touches[0];tx=t.clientX;ty=t.clientY;},{passive:true});
  wrap.addEventListener('touchmove',function(e){var t=e.touches[0];if(Math.abs(t.clientX-tx)>10&&Math.abs(t.clientX-tx)>Math.abs(t.clientY-ty))pause(450);},{passive:true});
  wrap.addEventListener('wheel',function(e){if(Math.abs(e.deltaX)>Math.abs(e.deltaY))pause(450);},{passive:true});
  document.addEventListener('visibilitychange',function(){dernier=0;});
  if(window.IntersectionObserver)new IntersectionObserver(function(es){es.forEach(function(e){visible=e.isIntersecting;dernier=0;});},{threshold:0}).observe(wrap);
  var gl=null,ign=false;
  wrap.addEventListener('pointerdown',function(e){if(e.pointerType!=='mouse'||e.button!==0)return;gl={x:e.clientX,d:wrap.scrollLeft,b:false};wrap.classList.add('dragging');});
  wrap.addEventListener('dragstart',function(e){e.preventDefault();});
  window.addEventListener('pointermove',function(e){if(!gl)return;var d=e.clientX-gl.x;if(Math.abs(d)>4)gl.b=true;if(gl.b){wrap.scrollLeft=gl.d-d;e.preventDefault();}});
  function finGl(){if(!gl)return;var b=gl.b;gl=null;wrap.classList.remove('dragging');if(b){ign=true;setTimeout(function(){ign=false;},150);}}
  window.addEventListener('pointerup',finGl);window.addEventListener('pointercancel',finGl);
  wrap.addEventListener('click',function(e){if(ign){e.preventDefault();e.stopImmediatePropagation();}},true);
  window.addEventListener('resize',majDots,{passive:true});
  majDots();
  if(!reduit)rafId=requestAnimationFrame(image);
}
/* bandeau « Quel événement préparez-vous ? » */
function defile(w,cards,copies,vit){
 if(!w||cards.length<copies*3)return;
 var P=0,lo=0,pos=0,pause=0,last=0,drag=null,bouge=false,pose=0,tient=false;
 var reduit=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
 function mesure(){var n=cards.length/copies;P=cards[n].offsetLeft-cards[0].offsetLeft;lo=P*.25;}
 function ecrire(x){w.scrollLeft=x;pose=w.scrollLeft;}
 function boucle(){if(!P)return;var x=w.scrollLeft;if(x<lo)x+=P;else if(x>=lo+P)x-=P;if(x!==w.scrollLeft){ecrire(x);pos=x;}}
 function arret(ms){pause=Date.now()+ms;}
 w.addEventListener('pointerenter',function(e){if(e.pointerType==='mouse')tient=true;});
 w.addEventListener('pointerleave',function(e){if(e.pointerType==='mouse'){tient=false;arret(350);}});

 var tx=0,ty=0;
 w.addEventListener('touchstart',function(e){var t=e.touches[0];tx=t.clientX;ty=t.clientY;},{passive:true});
 w.addEventListener('touchmove',function(e){var t=e.touches[0],dx=t.clientX-tx,dy=t.clientY-ty;if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy))arret(450);},{passive:true});
 w.addEventListener('wheel',function(e){if(Math.abs(e.deltaX)>Math.abs(e.deltaY))arret(450);},{passive:true});
 w.addEventListener('scroll',function(){if(Math.abs(w.scrollLeft-pose)>2)arret(450);pos=w.scrollLeft;pose=pos;boucle();},{passive:true});
 w.addEventListener('pointerdown',function(e){if(e.pointerType!=='mouse'||e.button!==0)return;drag={x:e.clientX,s:w.scrollLeft};bouge=false;arret(450);});
 window.addEventListener('pointermove',function(e){if(!drag)return;var dx=e.clientX-drag.x;if(Math.abs(dx)>5&&!bouge){bouge=true;w.classList.add('glisse');}if(bouge){w.scrollLeft=drag.s-dx;arret(450);}});
 function fin(){if(!drag)return;drag=null;w.classList.remove('glisse');arret(450);}
 window.addEventListener('pointerup',fin);window.addEventListener('pointercancel',fin);
 w.addEventListener('click',function(e){if(bouge){e.preventDefault();e.stopPropagation();bouge=false;}},true);
 w.addEventListener('dragstart',function(e){e.preventDefault();});
 function pas(t){var dt=Math.min(64,t-(last||t));last=t;
  if(P&&!reduit&&!document.hidden&&!drag&&!tient&&!(window.__vespraPopup&&window.__vespraPopup())&&Date.now()>=pause){var r=w.getBoundingClientRect();if(r.bottom>0&&r.top<innerHeight){pos+=dt*vit;ecrire(pos);boucle();}}
  requestAnimationFrame(pas);}
 function init(){mesure();if(!P)return;ecrire(P);pos=P;requestAnimationFrame(pas);}
 if(document.readyState==='complete')init();else addEventListener('load',init);
 addEventListener('resize',mesure);
}
function tirage(el,ids){
  /* data-shuffle : ordre différent à chaque visite ; data-exclusive : un seul produit du groupe ; data-pick : nombre gardé */
  if(!el.hasAttribute('data-shuffle'))return ids;
  var a=ids.slice();
  for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}
  var ex=(el.getAttribute('data-exclusive')||'').split(',').filter(Boolean);
  if(ex.length){var vu=false;a=a.filter(function(x){if(ex.indexOf(x)<0)return true;if(vu)return false;vu=true;return true;});}
  var n=parseInt(el.getAttribute('data-pick'),10);if(n>0)a=a.slice(0,n);
  return a;
}
function vc(){
  document.querySelectorAll('[data-vcar]').forEach(function(el){
    if(el.__vcar)return;el.__vcar=1;
    var id=el.getAttribute('data-vcar'),ids=tirage(el,(el.getAttribute('data-ids')||'').split(',').filter(Boolean));
    carrousel({wrap:id+'Wrap',track:id+'Track',dots:id+'Dots',prev:id+'Prev',next:id+'Next',ids:ids.length?ids:BEST,bo:el.hasAttribute('data-bo'),add:el.hasAttribute('data-add')});
  });
}
window.vespraCarrousels=vc;
function init(){
  defile(document.querySelector('.evs-wrap'),document.querySelectorAll('.evc'),3,0.016);
  document.querySelectorAll('.evc').forEach(function(c){var im=c.querySelectorAll('.evc-ph img');if(im.length<2)return;var k=0;
    setTimeout(function(){setInterval(function(){im[k].classList.remove('on');k=(k+1)%im.length;im[k].classList.add('on');},4200);},(parseInt(c.dataset.d,10)%5)*800);});
  document.querySelectorAll('[data-vcar]').forEach(function(el){
    if(el.__vcar)return;el.__vcar=1;
    var id=el.getAttribute('data-vcar'),ids=tirage(el,(el.getAttribute('data-ids')||'').split(',').filter(Boolean));
    carrousel({wrap:id+'Wrap',track:id+'Track',dots:id+'Dots',prev:id+'Prev',next:id+'Next',ids:ids.length?ids:BEST,bo:el.hasAttribute('data-bo'),add:el.hasAttribute('data-add')});
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
