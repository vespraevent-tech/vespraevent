/* Vidéo YouTube en fond d'un bandeau (data-yt="ID") et lecteur « film » cliquable (window.vespraFilm).
   La photo reste affichée tant que la vidéo ne joue pas : si la lecture automatique est bloquée,
   rien ne change pour le visiteur. Lecteur sans cookies (youtube-nocookie). */
(function(){
  var css='.vf{position:absolute;inset:0;overflow:hidden;container-type:size;pointer-events:none;opacity:0;transition:opacity 1.2s ease}'+
  '.vf.on{opacity:1}.vf iframe{position:absolute;top:50%;left:50%;width:max(100cqw,177.78cqh);height:max(100cqh,56.25cqw);transform:translate(-50%,-50%) scale(1.18);border:0}'+
  '.vf-lien{position:absolute;right:18px;bottom:16px;z-index:3;display:inline-flex;align-items:center;gap:8px;font:500 12px/1 Inter,system-ui,sans-serif;letter-spacing:.06em;color:rgba(255,255,255,.82);text-decoration:none;padding:8px 12px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(10,16,26,.35);backdrop-filter:blur(4px);opacity:0;transition:opacity .6s}'+
  '.vf-lien.on{opacity:1}.vf-lien:hover{color:#fff;border-color:rgba(255,255,255,.6)}.vf-lien svg{width:9px;height:9px;fill:currentColor}'+
  '.vfilm{position:relative;aspect-ratio:16/9;border-radius:14px;overflow:hidden;background:#0c0f14 center/cover;cursor:pointer;margin:0 0 22px}'+
  '.vfilm::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(12,15,20,0) 40%,rgba(12,15,20,.7))}'+
  '.vfilm button{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2;width:74px;height:74px;border-radius:50%;border:1.5px solid rgba(255,255,255,.85);background:rgba(10,16,26,.45);backdrop-filter:blur(4px);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .2s,background .2s}'+
  '.vfilm:hover button{transform:translate(-50%,-50%) scale(1.06);background:rgba(10,16,26,.65)}.vfilm button svg{width:22px;height:22px;fill:#fff;margin-left:4px}'+
  '.vfilm span{position:absolute;left:18px;bottom:14px;z-index:2;color:#fff;font:500 13px/1.3 Inter,system-ui,sans-serif;letter-spacing:.04em}'+
  '.vfilm iframe{position:absolute;inset:0;width:100%;height:100%;border:0}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  var JOUER='<svg viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0l10 6-10 6z"/></svg>';
  function sobre(){try{return matchMedia('(prefers-reduced-motion: reduce)').matches||(navigator.connection&&navigator.connection.saveData)}catch(e){return false}}
  function fond(el){
    var id=el.getAttribute('data-yt');if(!id||sobre())return;
    var vf=document.createElement('div');vf.className='vf';vf.setAttribute('aria-hidden','true');
    var f=document.createElement('iframe');
    f.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&mute=1&loop=1&playlist='+id+'&controls=0&playsinline=1&rel=0&modestbranding=1&disablekb=1&iv_load_policy=3&enablejsapi=1&origin='+encodeURIComponent(location.origin);
    f.title='Vidéo d’ambiance';f.tabIndex=-1;f.allow='autoplay; encrypted-media';f.referrerPolicy='strict-origin-when-cross-origin';f.setAttribute('loading','eager');
    vf.appendChild(f);
    var img=el.querySelector('picture,.ev-hero-img');if(img&&img.parentNode===el)img.after(vf);else el.insertBefore(vf,el.firstChild);
    var lien=null;
    if(el.getAttribute('data-yt-lien')){lien=document.createElement('a');lien.className='vf-lien';lien.href=el.getAttribute('data-yt-lien');lien.innerHTML=JOUER+'Film de notre vidéaste partenaire';el.appendChild(lien);
      lien.addEventListener('click',function(e){var t=[].slice.call(document.querySelectorAll('.pr-tab')).filter(function(b){return /vid[ée]aste/i.test(b.textContent)})[0];if(!t)return;e.preventDefault();t.click();var h=document.getElementById('prHero')||t;h.scrollIntoView({behavior:'smooth',block:'start'});});}
    function ecoute(){try{f.contentWindow.postMessage(JSON.stringify({event:'listening',id:id}),'*')}catch(e){}}
    f.addEventListener('load',function(){ecoute();setTimeout(ecoute,800)});
    window.addEventListener('message',function(m){
      if(!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(m.origin))return;
      var d;try{d=typeof m.data==='string'?JSON.parse(m.data):m.data}catch(e){return}
      var etat=d&&d.info&&d.info.playerState;
      if(etat===1){vf.classList.add('on');if(lien)lien.classList.add('on');}
    });
  }
  window.vespraFilm=function(boite,id,legende){
    boite.classList.add('vfilm');boite.style.backgroundImage='url(https://i.ytimg.com/vi/'+id+'/maxresdefault.jpg)';
    boite.innerHTML='<button type="button" aria-label="Lire le film">'+JOUER+'</button>'+(legende?'<span>'+legende+'</span>':'');
    boite.addEventListener('click',function(){
      boite.innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="'+(legende||'Film')+'" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
    },{once:true});
  };
  function init(){document.querySelectorAll('[data-yt]').forEach(fond);document.querySelectorAll('[data-film]').forEach(function(b){window.vespraFilm(b,b.getAttribute('data-film'),b.getAttribute('data-legende')||'')});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
