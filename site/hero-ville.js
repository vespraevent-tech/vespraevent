(function(){
  var hero=document.getElementById('hero');if(!hero)return;
  var sl=[].slice.call(hero.querySelectorAll('.hero-slide')),dots=[].slice.call(hero.querySelectorAll('.hd'));
  if(sl.length<2)return;
  var cur=0,busy=false,timer=null,pause=false;
  /* Quatre diapositives : l'accueil (« Votre spécialiste »), le pack mariage, une diapositive produit
     et « Vous hésitez ». L'ordre alterne de temps en temps (promo / guide / produit) et le produit
     change toutes les trois visites, parmi : fumée lourde, étincelles, feux d'artifice, photobooth, spot LED, tente étoile. */
  (function(){
    var n=0;
    try{n=parseInt(localStorage.getItem('vespra_hero_n'),10)||0;localStorage.setItem('vespra_hero_n',String(n+1));}
    catch(e){try{n=parseInt(sessionStorage.getItem('vespra_hero_n'),10)||0;sessionStorage.setItem('vespra_hero_n',String(n+1));}catch(e2){}}
    n=Math.abs(n);
    var produits=[4,3,2,1,5,6],P=produits[Math.floor(n/3)%produits.length];
    var T={A:0,B:7,C:P,D:8};
    var ordres=['ABCD','ABCD','ADCB','ABCD','ABCD','ABDC'];
    var ordre=ordres[n%ordres.length].split('').map(function(c){return T[c]});
    var tous=sl.slice(),pts=dots.slice();
    var gardes=ordre.map(function(k){return tous[k]});
    tous.forEach(function(x){if(gardes.indexOf(x)<0&&x.parentNode)x.parentNode.removeChild(x);});
    pts.forEach(function(d,k){if(k>=gardes.length&&d.parentNode)d.parentNode.removeChild(d);});
    sl=gardes;dots=pts.slice(0,gardes.length);
    tous[0].classList.remove('hs-on');tous[0].setAttribute('aria-hidden','true');
    sl[0].classList.add('hs-on');sl[0].removeAttribute('aria-hidden');
    dots.forEach(function(d,k){d.classList.toggle('hd-on',k===0);d.setAttribute('aria-label','Diapositive '+(k+1));});
    cur=0;
  })();
  /* Toutes les diapositives ont un bloc de même hauteur (celle de la plus haute), rangé depuis le haut :
     la pastille et le titre sont donc exactement au même endroit d'une diapositive à l'autre, et le
     texte puis les boutons suivent directement le titre, sans trou. */
  function egalise(){
    var cs=[].slice.call(hero.querySelectorAll('.hero-slide .hero-content'));
    cs.forEach(function(c){c.style.minHeight='';c.style.display='';c.style.flexDirection='';c.style.justifyContent='';
      [].slice.call(c.querySelectorAll('.hero-eye,.hs-t,.hs-sub')).forEach(function(e){e.style.removeProperty('min-height');if(e.classList.contains('hero-eye'))e.style.marginTop=''});});
    var h=0;cs.forEach(function(c){h=Math.max(h,c.offsetHeight)});
    cs.forEach(function(c){c.style.minHeight=h+'px';c.style.display='flex';c.style.flexDirection='column';c.style.justifyContent='flex-start';c.style.alignItems='flex-start'});
  }
  egalise();addEventListener('load',egalise);addEventListener('resize',egalise);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(egalise);
  var calme=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
  /* les photos des diapositives suivantes se chargent après la page */
  function charge(){sl.forEach(function(x){
    var b=x.querySelector('.hs-bg');if(b)b.style.backgroundImage="url('"+x.getAttribute('data-bg')+"')";
});}
  if(document.readyState==='complete')charge();else addEventListener('load',charge);
  function aller(n,dir){
    if(busy||n===cur)return;busy=true;clearTimeout(timer);barreRaz();
    dir=dir||(n>cur?1:-1);
    var a=sl[cur],b=sl[n];
    b.classList.remove('hs-go');b.style.transform='translateX('+(dir*100)+'%)';b.classList.add('hs-in');
    void b.offsetWidth;
    a.classList.add('hs-go','hs-out');b.classList.add('hs-go');
    a.classList.remove('hs-on');a.style.transform='translateX('+(-dir*100)+'%)';
    b.style.transform='translateX(0)';
    a.setAttribute('aria-hidden','true');b.removeAttribute('aria-hidden');
    dots[cur]&&dots[cur].classList.remove('hd-on');dots[n]&&dots[n].classList.add('hd-on');
    var fin=function(){
      a.classList.remove('hs-go','hs-out');b.classList.remove('hs-go','hs-in');
      b.classList.add('hs-on');b.style.transform='';
      a.style.transform='';
      cur=n;busy=false;planifie();
    };
    setTimeout(fin,reduit()?20:1500);
  }
  function reduit(){return calme}
  function suivant(){aller((cur+1)%sl.length,1)}
  var DUREE=3000,manuel=false,t0=0,reste=DUREE,barre=hero.querySelector('.hd-bar i'),bpp=hero.querySelector('.hd-pp');
  function barreRaz(){if(!barre)return;barre.style.animation='none';void barre.offsetWidth;}
  function barreLance(ms){if(!barre)return;barre.style.animation='hdfill '+DUREE+'ms linear '+(-(DUREE-ms))+'ms forwards';barre.style.animationPlayState=manuel?'paused':'running';}
  function planifie(){
    clearTimeout(timer);barreRaz();if(calme||!sl.length)return;
    reste=DUREE;depart(reste);
  }
  function depart(ms){
    clearTimeout(timer);t0=Date.now();barreLance(ms);
    if(manuel)return;
    timer=setTimeout(function(){if(pause||document.hidden)planifie();else suivant();},ms);
  }
  if(bpp){
    if(calme){bpp.style.display='none';var sp=hero.querySelector('.hd-sep'),bb=hero.querySelector('.hd-bar');if(sp)sp.style.display='none';if(bb)bb.style.display='none';}
    bpp.addEventListener('click',function(){
      manuel=!manuel;
      bpp.setAttribute('aria-pressed',manuel?'true':'false');
      bpp.setAttribute('aria-label',manuel?'Reprendre le défilement':'Mettre en pause le défilement');
      hero.classList.toggle('hd-paused',manuel);
      if(manuel){clearTimeout(timer);reste=Math.max(50,reste-(Date.now()-t0));if(barre)barre.style.animationPlayState='paused';}
      else if(!busy){depart(reste);}
    });
  }
  dots.forEach(function(d,k){d.addEventListener('click',function(){clearTimeout(timer);aller(k);});});
  var x0=null,y0=0;
  hero.addEventListener('touchstart',function(e){x0=e.touches[0].clientX;y0=e.touches[0].clientY;pause=true},{passive:true});
  hero.addEventListener('touchend',function(e){
    pause=false;if(x0===null)return;
    var dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0;x0=null;
    if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3){clearTimeout(timer);aller(dx<0?(cur+1)%sl.length:(cur-1+sl.length)%sl.length,dx<0?1:-1);}
  },{passive:true});
  planifie();
})();
