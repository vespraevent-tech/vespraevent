/* Listes déroulantes Vespra : remplace l'affichage natif des <select>
   par une liste blanche qui s'ouvre juste sous le champ.
   Le <select> d'origine reste dans la page (valeur, formulaire, change). */
(function(){
  var css='.sj-wrap{position:relative;display:block;width:100%}'+
  '.sj-wrap>select.sj-nat{position:absolute;inset:0;width:100%;height:100%;opacity:0;pointer-events:none}'+
  '.sj-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;cursor:pointer;'+
  'font:inherit;color:inherit;background:#fff;border:1.5px solid var(--g3,#C8CDD8);border-radius:var(--r,10px);padding:13px 15px;min-height:48px;box-sizing:border-box}'+
  '.sj-btn:focus-visible,.sj-btn[aria-expanded=true]{outline:none;border-color:var(--navy,#2B4A6B);box-shadow:0 0 0 3px rgba(43,74,107,.15)}'+
  '.sj-btn.vide .sj-txt{color:var(--g2,#646D7C)}'+
  '.sj-txt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
  '.sj-btn svg{flex:none;width:16px;height:16px;transition:transform .15s;stroke:var(--navy,#2B4A6B)}'+
  '.sj-btn[aria-expanded=true] svg{transform:rotate(180deg)}'+
  '.sj-list{position:fixed;z-index:4000;background:#fff;border:1px solid var(--g3,#C8CDD8);border-radius:14px;'+
  'box-shadow:0 14px 40px rgba(12,15,20,.16);padding:6px;overflow-y:auto;overscroll-behavior:contain;font-family:inherit;color:var(--black,#0C0F14)}'+
  '.sj-list[hidden]{display:none}'+
  '.sj-opt{display:block;width:100%;text-align:left;background:none;border:none;font:inherit;font-size:14.5px;padding:11px 12px;border-radius:9px;cursor:pointer;color:inherit}'+
  '.sj-opt:hover,.sj-opt.cur{background:var(--g4,#F0F2F5)}'+
  '.sj-opt.sel{background:var(--navy,#2B4A6B);color:#fff;font-weight:600}'+
  '.sj-opt:disabled{color:var(--g3,#C8CDD8);cursor:default}'+
  '.filters .sj-wrap{width:auto;min-width:160px;flex:1 1 0}.filters .sj-btn{padding:9px 14px;min-height:0;font-size:14px;font-weight:600;border-width:2px;font-family:Inter,sans-serif}'+
  '@media(max-width:760px){.filters .sj-wrap{min-width:0}.filters .sj-btn{font-size:13px;padding:9px 12px}}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  var ouvert=null;
  var CH='<svg viewBox="0 0 16 16" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l5 5 5-5"/></svg>';
  function esc(t){return String(t).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
  function equiper(sel){
    if(sel.sjPret||sel.multiple||sel.hasAttribute('data-native')||sel.size>1)return;
    sel.sjPret=true;
    var w=document.createElement('span');w.className='sj-wrap';
    sel.parentNode.insertBefore(w,sel);w.appendChild(sel);
    sel.classList.add('sj-nat');sel.tabIndex=-1;sel.setAttribute('aria-hidden','true');
    var b=document.createElement('button');b.type='button';b.className='sj-btn';b.setAttribute('aria-haspopup','listbox');b.setAttribute('aria-expanded','false');
    var lab=sel.getAttribute('aria-label')||(sel.id&&document.querySelector('label[for="'+sel.id+'"]')&&document.querySelector('label[for="'+sel.id+'"]').textContent);
    if(lab)b.setAttribute('aria-label',lab);
    w.insertBefore(b,sel);
    var l=document.createElement('div');l.className='sj-list';l.hidden=true;l.setAttribute('role','listbox');
    function maj(){
      var o=sel.options[sel.selectedIndex];
      var vide=!o||o.value==='';
      b.className='sj-btn'+(vide?' vide':'');
      b.innerHTML='<span class="sj-txt">'+esc(o?o.text:'')+'</span>'+CH;
    }
    function dessiner(){
      var h='';
      Array.prototype.forEach.call(sel.options,function(o,i){
        h+='<button type="button" role="option" class="sj-opt'+(i===sel.selectedIndex?' sel':'')+'" data-i="'+i+'"'+(o.disabled?' disabled':'')+'>'+esc(o.text)+'</button>';
      });
      l.innerHTML=h;
    }
    function placer(){
      var r=b.getBoundingClientRect();
      var larg=Math.max(r.width,160);
      l.style.width=larg+'px';
      l.style.left=Math.round(Math.min(Math.max(8,r.left),window.innerWidth-larg-8))+'px';
      l.style.top=Math.round(r.bottom+6)+'px';
      l.style.maxHeight=Math.max(140,window.innerHeight-r.bottom-20)+'px';
    }
    function fermer(){
      if(l.hidden)return;l.hidden=true;b.setAttribute('aria-expanded','false');ouvert=null;
      window.removeEventListener('scroll',repl,true);window.removeEventListener('resize',repl);
      if(l.parentNode!==w)w.appendChild(l);
    }
    function repl(e){ if(e&&e.target&&l.contains(e.target))return; placer(); }
    function ouvrir(){
      if(ouvert&&ouvert!==fermer)ouvert();
      dessiner();document.body.appendChild(l);l.hidden=false;placer();
      b.setAttribute('aria-expanded','true');ouvert=fermer;
      var s=l.querySelector('.sel');if(s)s.scrollIntoView({block:'nearest'});
      window.addEventListener('scroll',repl,true);window.addEventListener('resize',repl);
    }
    b.addEventListener('click',function(e){e.preventDefault();l.hidden?ouvrir():fermer();});
    b.addEventListener('keydown',function(e){
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();
        var n=sel.selectedIndex+(e.key==='ArrowDown'?1:-1);
        if(n>=0&&n<sel.options.length&&!sel.options[n].disabled){sel.selectedIndex=n;sel.dispatchEvent(new Event('change',{bubbles:true}));maj();}
      }else if(e.key==='Escape')fermer();
    });
    l.addEventListener('click',function(e){
      var o=e.target.closest('.sj-opt');if(!o||o.disabled)return;
      sel.selectedIndex=+o.dataset.i;
      sel.dispatchEvent(new Event('input',{bubbles:true}));
      sel.dispatchEvent(new Event('change',{bubbles:true}));
      maj();fermer();b.focus();
    });
    document.addEventListener('click',function(e){
      if(l.hidden)return; if(!document.contains(e.target))return;
      if(!w.contains(e.target)&&!l.contains(e.target))fermer();
    });
    sel.addEventListener('change',maj);
    if(window.MutationObserver)new MutationObserver(maj).observe(sel,{childList:true,subtree:true,attributes:true});
    sel.sjMaj=maj;
    maj();
  }
  function tout(){Array.prototype.forEach.call(document.querySelectorAll('select'),equiper);}
  function sync(){Array.prototype.forEach.call(document.querySelectorAll('select.sj-nat'),function(s){s.sjMaj&&s.sjMaj();});}
  window.__sjInit=tout;
  function go(){tout();setInterval(function(){tout();sync();},700);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();
})();
