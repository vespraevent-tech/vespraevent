/* Back-office : vidéos du site, envoyées en morceaux de 5 Mo directement dans Cloudflare R2.
   Adresse publique : https://www.vespraevent.fr/videos/<nom> */
(function(){
  var st=document.createElement('style');
  st.textContent='.vs-envoi{border:1px solid #e3e7ed;border-radius:12px;padding:14px 16px;margin:0 0 16px;background:#fff}'+
  '.vs-nom{font:600 14px/1.3 inherit;color:#1f2a37}.vs-barre{height:6px;border-radius:6px;background:#eef1f5;margin:10px 0 6px;overflow:hidden}'+
  '.vs-barre i{display:block;height:100%;width:0;background:#2B4A6B;transition:width .3s}.vs-etat{font-size:12.5px;color:#8a929e}'+
  '.vs-l{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}'+
  '.vs-c{border:1px solid #e3e7ed;border-radius:12px;overflow:hidden;background:#fff}.vs-c video,.vs-c img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#0c0f14}'+
  '.vs-b{padding:10px 12px;display:flex;align-items:center;gap:8px}.vs-b b{flex:1;font-weight:500;font-size:13.5px;color:#1f2a37;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
  '.vs-b small{color:#8a929e;font-size:12px}.vs-b button{border:0;background:none;color:#8a929e;cursor:pointer;font-size:12.5px;padding:4px 6px;border-radius:6px}.vs-b button:hover{background:#f2f4f7;color:#1f2a37}';
  document.head.appendChild(st);
  var MORCEAU=5*1024*1024, BASE='/api/admin/medias';
  function mo(n){return n>=1048576?(n/1048576).toFixed(1).replace('.',',')+' Mo':Math.round(n/1024)+' Ko'}
  function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  async function req(chemin,opts){var r=await fetch(BASE+chemin,Object.assign({credentials:'same-origin'},opts||{}));var d=null;try{d=await r.json()}catch(e){}if(!r.ok)throw new Error((d&&d.error)||('Erreur '+r.status));return d}
  window.vsCharger=async function(){
    var z=document.getElementById('vsListe');if(!z)return;
    try{var d=await req('');var l=(d.medias||[]).sort(function(a,b){return a.nom<b.nom?-1:1});
      if(!l.length){z.innerHTML='<div class="empty">Aucune vidéo pour l’instant.</div>';return}
      z.innerHTML='<div class="vs-l">'+l.map(function(m){var u='/videos/'+encodeURIComponent(m.nom),v=/\.(mp4|webm|mov)$/.test(m.nom);
        return '<div class="vs-c">'+(v?'<video src="'+u+'#t=1" preload="metadata" muted playsinline controls></video>':'<img src="'+u+'" alt="">')+
        '<div class="vs-b"><b title="'+esc(m.nom)+'">'+esc(m.nom)+'</b><small>'+mo(m.taille)+'</small><button data-copie="'+esc(u)+'">Copier le lien</button><button data-suppr="'+esc(m.nom)+'">Supprimer</button></div></div>'}).join('')+'</div>';
    }catch(e){z.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}
  };
  document.addEventListener('click',async function(e){
    var c=e.target.closest('[data-copie]');if(c){try{await navigator.clipboard.writeText(location.origin+c.dataset.copie);c.textContent='Copié'}catch(x){}return}
    var s=e.target.closest('[data-suppr]');if(s&&confirm('Supprimer « '+s.dataset.suppr+' » ? Les pages qui l’utilisent afficheront leur photo à la place.')){try{await req('?nom='+encodeURIComponent(s.dataset.suppr),{method:'DELETE'});vsCharger()}catch(x){alert(x.message)}}
  });
  document.addEventListener('change',async function(e){
    if(!e.target||e.target.id!=='vsFichier'||!e.target.files[0])return;
    var f=e.target.files[0];e.target.value='';
    var bx=document.getElementById('vsEnvoi'),barre=document.getElementById('vsBarre'),etat=document.getElementById('vsEtat');
    bx.hidden=false;document.getElementById('vsNom').textContent=f.name+' · '+mo(f.size);barre.style.width='0';etat.textContent='Préparation…';
    try{
      var d=await req('/debut?nom='+encodeURIComponent(f.name),{method:'POST'}),nom=d.nom,id=d.id,n=Math.max(1,Math.ceil(f.size/MORCEAU)),parts=[],faits=0;
      var q='&nom='+encodeURIComponent(nom)+'&id='+encodeURIComponent(id);
      async function envoyer(i){for(var essai=0;essai<4;essai++){try{var r=await req('/morceau?n='+i+q,{method:'POST',headers:{'content-type':'application/octet-stream'},body:f.slice((i-1)*MORCEAU,Math.min(f.size,i*MORCEAU))});parts.push({n:i,etag:r.etag});faits++;barre.style.width=Math.round(faits/n*100)+'%';etat.textContent='Envoi : '+faits+' / '+n+' morceaux';return}catch(x){if(essai===3)throw x;await new Promise(function(ok){setTimeout(ok,1500*(essai+1))})}}}
      var file=[];for(var i=1;i<=n;i++)file.push(i);
      async function ouvrier(){while(file.length)await envoyer(file.shift())}
      await Promise.all([ouvrier(),ouvrier(),ouvrier()]);
      await req('/fin?nom='+encodeURIComponent(nom)+'&id='+encodeURIComponent(id),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({parts:parts})});
      etat.textContent='Vidéo enregistrée.';setTimeout(function(){bx.hidden=true},2500);vsCharger();
    }catch(x){etat.textContent='Échec de l’envoi : '+x.message}
  });
})();
