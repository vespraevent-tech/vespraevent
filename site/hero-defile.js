/* En-tête défilant des pages (même principe que l'accueil) : défilement automatique, point de départ aléatoire,
   pause au survol / au toucher, points cliquables, glisser au doigt. */
(function(){
  var h=document.getElementById('hx');if(!h)return;
  var sl=[].slice.call(h.querySelectorAll('.hx-s')),dots=[].slice.call(h.querySelectorAll('.hx-d'));if(sl.length<2)return;
  var cur=0,hold=false,t=null,reduit=matchMedia('(prefers-reduced-motion:reduce)').matches;
  function go(i){i=(i+sl.length)%sl.length;if(i===cur)return;
    sl[cur].classList.remove('hx-on');sl[cur].setAttribute('aria-hidden','true');dots[cur].classList.remove('hx-don');
    cur=i;sl[cur].classList.add('hx-on');sl[cur].removeAttribute('aria-hidden');dots[cur].classList.add('hx-don');}
  dots.forEach(function(d,i){d.addEventListener('click',function(){go(i);arm();});});
  function arm(){clearInterval(t);if(reduit)return;t=setInterval(function(){if(!hold&&!document.hidden)go(cur+1);},6000);}
  h.addEventListener('pointerenter',function(e){if(e.pointerType==='mouse')hold=true;});
  h.addEventListener('pointerleave',function(e){if(e.pointerType==='mouse')hold=false;});
  var x0=null;
  h.addEventListener('touchstart',function(e){hold=true;x0=e.touches[0].clientX;},{passive:true});
  h.addEventListener('touchend',function(e){var dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>40){go(cur+(dx<0?1:-1));}setTimeout(function(){hold=false;},1500);arm();},{passive:true});
  go(Math.floor(Math.random()*sl.length));arm();
})();
