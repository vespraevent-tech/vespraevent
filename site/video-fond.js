/* Vidéo en fond d'un bandeau (data-video="/videos/xxx.mp4", data-poster facultatif) et lecteur « film » (data-film).
   Fichiers MP4 hébergés sur le site : aucun lecteur externe.
   La photo reste affichée tant que la vidéo ne joue pas (fichier absent, mode économie d'énergie…). */
(function(){
  var css='.vf{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;opacity:0;transition:opacity 1.2s ease}'+
  '.vf.on{opacity:1}'+
  '.vf-lien{position:absolute;right:14px;bottom:10px;z-index:3;display:inline-flex;align-items:center;gap:5px;font:400 10.5px/1 Inter,system-ui,sans-serif;letter-spacing:.04em;color:rgba(255,255,255,.6);text-decoration:none;padding:4px 2px;opacity:0;transition:opacity .6s,color .2s}'+
  '.vf-lien.on{opacity:1}.vf-lien:hover{color:#fff}.vf-lien svg{width:6px;height:7px;fill:currentColor}'+
  '.vfilm{position:relative;aspect-ratio:16/9;border-radius:14px;overflow:hidden;background:#0c0f14;margin:0 0 22px}'+
  '.vfilm video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#0c0f14}'+
  '.vfilm.lit video{object-fit:contain}'+
  '.vfilm .vj{position:absolute;inset:0;z-index:2;border:0;background:linear-gradient(180deg,rgba(12,15,20,0) 45%,rgba(12,15,20,.7));cursor:pointer}'+
  '.vfilm .vj i{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:74px;height:74px;border-radius:50%;border:1.5px solid rgba(255,255,255,.85);background:rgba(10,16,26,.45);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;transition:transform .2s,background .2s}'+
  '.vfilm .vj:hover i{transform:translate(-50%,-50%) scale(1.06);background:rgba(10,16,26,.65)}.vfilm .vj svg{width:22px;height:22px;fill:#fff;margin-left:4px}'+
  '.vfilm .vj span{position:absolute;left:18px;bottom:14px;color:#fff;font:500 13px/1.3 Inter,system-ui,sans-serif;letter-spacing:.04em;text-align:left}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  var JOUER='<svg viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0l10 6-10 6z"/></svg>';
  function sobre(){try{return matchMedia('(prefers-reduced-motion: reduce)').matches||(navigator.connection&&navigator.connection.saveData)}catch(e){return false}}
  function fond(el){
    var src=el.getAttribute('data-video');if(!src||sobre())return;
    /* grand écran : version haute qualité ; téléphone : version légère (la différence ne se voit pas sur un petit écran) */
    try{var hd=el.getAttribute('data-video-hd');if(hd&&window.innerWidth>900&&!(navigator.connection&&/(^|-)2g|3g/.test(navigator.connection.effectiveType||'')))src=hd;}catch(e){}
    var v=document.createElement('video');v.className='vf';v.muted=true;v.defaultMuted=true;v.loop=true;v.autoplay=true;v.playsInline=true;
    v.setAttribute('muted','');v.setAttribute('playsinline','');v.setAttribute('aria-hidden','true');v.preload='auto';v.disablePictureInPicture=true;
    var ph=el.querySelector('.ev-hero-img');if(ph&&ph.currentSrc)v.poster=ph.currentSrc;else if(ph&&ph.src)v.poster=ph.src;
    v.src=src;
    /* connexion trop lente : si la vidéo ne démarre pas en 8 s, on garde la photo */
    var delai=setTimeout(function(){if(!v.classList.contains('on')){v.pause();v.remove();if(lien)lien.remove();}},8000);
    v.addEventListener('playing',function(){clearTimeout(delai)});
    var img=el.querySelector('picture,.ev-hero-img');if(img&&img.parentNode===el)img.after(v);else el.insertBefore(v,el.firstChild);
    var lien=null;
    if(el.getAttribute('data-video-lien')){lien=document.createElement('a');lien.className='vf-lien';lien.href=el.getAttribute('data-video-lien');lien.innerHTML=JOUER+'Film de notre vidéaste';el.appendChild(lien);
      lien.addEventListener('click',function(e){var t=[].slice.call(document.querySelectorAll('.pr-tab')).filter(function(b){return /vid[ée]aste/i.test(b.textContent)})[0];if(!t)return;e.preventDefault();t.click();var h=document.getElementById('prHero')||t;h.scrollIntoView({behavior:'smooth',block:'start'});});}
    v.addEventListener('playing',function(){v.classList.add('on');if(lien)lien.classList.add('on');});
    v.addEventListener('error',function(){v.remove();if(lien)lien.remove();});
    /* pas de lecture tant que le bandeau n'est pas visible, pause quand il sort de l'écran */
    try{new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){var p=v.play();if(p&&p.catch)p.catch(function(){})}else v.pause()})}).observe(el)}catch(e){v.play&&v.play()}
  }
  window.vespraFilm=function(boite,src,poster,legende){
    boite.classList.add('vfilm');
    boite.innerHTML='<video preload="metadata" playsinline'+(poster?' poster="'+poster+'"':'')+' src="'+src+'"></video><button type="button" class="vj" aria-label="Lire le film"><i>'+JOUER+'</i>'+(legende?'<span>'+legende+'</span>':'')+'</button>';
    var v=boite.querySelector('video'),b=boite.querySelector('.vj');
    /* le bloc n'apparaît qu'une fois la vidéo trouvée : jamais de bloc qui s'affiche puis disparaît */
    boite.style.display='none';
    v.addEventListener('loadedmetadata',function(){boite.style.display=''});
    v.addEventListener('error',function(){boite.remove()});
    b.addEventListener('click',function(){b.remove();boite.classList.add('lit');v.controls=true;v.play().catch(function(){})});
  };
  function init(){document.querySelectorAll('[data-video]').forEach(fond);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
