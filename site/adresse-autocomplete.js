/* VESPRA EVENT — saisie d'adresse avec suggestions
   Utilise la Base Adresse Nationale (data.gouv.fr), sans clé API.
   La sélection transforme l'adresse en deux lignes : rue / code postal ville.
*/
(function(){
  'use strict';
  const ENDPOINT='https://api-adresse.data.gouv.fr/search/';
  let seq=0;
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function format(p){
    const props=p&&p.properties?p.properties:{};
    const street=[props.housenumber,props.street].filter(Boolean).join(' ').trim();
    const city=[props.postcode,props.city].filter(Boolean).join(' ').trim();
    return [street,city].filter(Boolean).join('\n') || props.label || '';
  }
  function init(el){
    if(!el || el.dataset.addressReady==='1') return;
    el.dataset.addressReady='1';
    const wrap=document.createElement('div');
    wrap.className='ve-adr-wrap';
    el.parentNode.insertBefore(wrap,el);
    wrap.appendChild(el);
    const list=document.createElement('div');
    list.className='ve-adr-list';
    list.hidden=true;
    wrap.appendChild(list);
    let timer=0, current=++seq, muet=0;
    /* fermer annule aussi toute recherche en route : sinon la réponse arrive après le choix et rouvre la liste */
    function close(){clearTimeout(timer);current++;list.hidden=true;list.innerHTML='';}
    function search(){
      if(Date.now()<muet){return;}
      const q=String(el.value||'').replace(/\s+/g,' ').trim();
      if(q.length<3){close();return;}
      const token=++current;
      clearTimeout(timer);
      timer=setTimeout(function(){
        fetch(ENDPOINT+'?q='+encodeURIComponent(q)+'&limit=5&autocomplete=1')
          .then(r=>r.ok?r.json():Promise.reject(new Error('adresse')))
          .then(data=>{
            if(token!==current)return;
            const results=Array.isArray(data.features)?data.features:[];
            if(!results.length){close();return;}
            list.innerHTML=results.map(function(p,i){
              const pr=p.properties||{};
              const label=pr.label||'';
              const parts=[pr.housenumber&&pr.street?[pr.housenumber,pr.street].join(' '):pr.street, [pr.postcode,pr.city].filter(Boolean).join(' ')].filter(Boolean);
              return '<button type="button" class="ve-adr-item" data-i="'+i+'"><strong>'+esc(parts[0]||label)+'</strong>'+(parts[1]?'<small>'+esc(parts[1])+'</small>':'')+'</button>';
            }).join('');
            list.querySelectorAll('.ve-adr-item').forEach(function(btn){
              btn.addEventListener('click',function(){
                const p=results[Number(btn.dataset.i)];
                /* le choix est fait : pendant un instant, ni la saisie simulée ni le retour du focus ne relancent une recherche */
                muet=Date.now()+800;
                close();
                el.value=format(p);
                el.dispatchEvent(new Event('input',{bubbles:true}));
                close();
                el.focus();
              });
            });
            list.hidden=false;
          })
          .catch(function(){close();});
      },180);
    }
    el.addEventListener('input',search);
    el.addEventListener('focus',function(){if(String(el.value||'').trim().length>=3)search();});
    el.addEventListener('blur',function(){setTimeout(function(){if(!wrap.contains(document.activeElement))close();},200);});
    el.addEventListener('keydown',function(e){
      if(e.key==='Escape') close();
    });
    document.addEventListener('click',function(e){if(!wrap.contains(e.target))close();});
  }
  function scan(){document.querySelectorAll('[data-adresse-autocomplete]').forEach(init);}
  const style=document.createElement('style');
  style.textContent='.ve-adr-wrap{position:relative;width:100%}.ve-adr-list{position:absolute;z-index:5000;left:0;right:0;top:calc(100% + 4px);background:#fff;border:1px solid #c8cdd8;border-radius:10px;box-shadow:0 12px 28px rgba(12,15,20,.14);overflow:hidden}.ve-adr-list[hidden]{display:none}.ve-adr-item{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #eef0f3;background:#fff;padding:10px 12px;cursor:pointer;font:inherit;color:#0c0f14}.ve-adr-item:last-child{border-bottom:0}.ve-adr-item:hover,.ve-adr-item:focus{background:#f0f2f5;outline:none}.ve-adr-item strong{display:block;font-size:13px;font-weight:600}.ve-adr-item small{display:block;margin-top:2px;font-size:11.5px;color:#646d7c}.ve-adr-wrap textarea{display:block}';
  document.head.appendChild(style);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan);else scan();
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
})();
