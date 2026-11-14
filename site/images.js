/* Application des remplacements d’images gérés depuis le back-office.
   Une image peut être remplacée ou supprimée. Les galeries produit qui
   réaffichent leur chemin d'origine sont également resynchronisées afin
   qu'un clic sur une vignette ne fasse jamais réapparaître l'ancienne photo. */
(function(){
  var TRANSPARENT='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  function basename(src){
    try{return decodeURIComponent(String(src||'').split('?')[0].split('#')[0].split('/').pop()||'');}
    catch(e){return String(src||'').split('?')[0].split('#')[0].split('/').pop()||'';}
  }
  function cleanUrl(src){return String(src||'').trim().replace(/^url\(["']?/,'').replace(/["']?\)$/,'');}
  function replacement(src,map){return map[basename(src)]||null;}

  /* Photo principale de chaque produit, telle qu'écrite dans les pages :
     c'est ce que le back-office remplace. Quand une photo est changée dans
     la fiche d'un produit, elle l'est partout où ce produit apparaît. */
  var PHOTOS_ORIGINE = {"p3":["photobooth.webp"],"p24":["panneau-bienvenue.webp"],"p22":["canon-poudre-arc-en-ciel.webp"],"p8":["pack-vespra-200-v2.webp"],"p4":["barnum.webp"],"p36":["barnum.webp"],"p37":["barnum.webp"],"p44":["barnum-4x6.webp"],"p45":["mange-debout.webp"],"p9":["boite-nuit-vespra.webp"],"p12":["boule-facettes.webp"],"p6":["tente-etoile.webp"],"p38":["tente-etoile-star.webp"],"p39":["tente-etoile-star.webp"],"p10":["telephone-vintage-2.webp","cabine-telephonique-audio.webp"],"p31":["cabine-decor-blanche.webp","cabine-decor-rouge.webp"],"p46":["cabine-telephonique-rouge.webp","cabine-telephonique-audio.webp"],"p32":["neon-lumineux.webp","cabine-telephonique.webp"],"p35":["etincelles-froides-situation.webp"],"p40":["fumee-lourde-wgf-2000-situation.webp"],"p41":["fumee-lourde-nuage.webp"],"p34":["baby-foot-dessus.webp","baby-foot-ambiance.webp"],"p33":["guirlande-lumineuse.webp"],"p14":["karaoke.webp"],"p5":["buvette.webp"],"p13":["sono-180-250.webp"],"p20":["videoprojecteur.webp"],"p15":["spots-ibiza.webp","spots-eurolite.webp"],"p1":["brasero.webp"],"p19":["caisson-basse.webp"],"p42":["micro-shure-sm58.webp"],"p43":["spot-led-batterie-ambiance.webp"],"p11":["popcorn.webp"],"p2":["jeux-cornhole.webp"],"p21":["machine-fumee.webp"],"p58":["fumee-m-fog-1500.webp","fumee-m-fog-1500-2.webp","fumee-m-fog-1500-3.webp","fumee-m-fog-1500-4.webp"],"p23":["machine-bulles.webp"],"p7":["ventilateur.webp"],"p54":["chateau-mini-bounce-crocodile.webp", "chateau-mini-bounce-crocodile-2.webp", "chateau-mini-bounce-crocodile-3.webp", "chateau-mini-bounce-crocodile-4.webp", "chateau-mini-bounce-crocodile-5.webp"],"p55":["chateau-bouncedome-amazone-safari.webp", "chateau-bouncedome-amazone-safari-2.webp", "chateau-bouncedome-amazone-safari-3.webp", "chateau-bouncedome-amazone-safari-4.webp", "chateau-bouncedome-amazone-safari-5.webp", "chateau-bouncedome-amazone-safari-6.webp", "chateau-bouncedome-amazone-safari-7.webp", "chateau-bouncedome-amazone-safari-8.webp"],"p56":["chateau-dinoworld.webp", "chateau-dinoworld-2.webp", "chateau-dinoworld-3.webp", "chateau-dinoworld-4.webp", "chateau-dinoworld-5.webp", "chateau-dinoworld-6.webp", "chateau-dinoworld-7.webp", "chateau-dinoworld-8.webp", "chateau-dinoworld-9.webp", "chateau-dinoworld-10.webp"],"p57":["chateau-summer-party.webp", "chateau-summer-party-2.webp", "chateau-summer-party-3.webp", "chateau-summer-party-4.webp", "chateau-summer-party-5.webp", "chateau-summer-party-6.webp", "chateau-summer-party-7.webp"]};

  /* fiches produit modifiées dans le back-office → remplacements de fichiers
     (seulement pour les fichiers propres à un seul produit) et photo par produit */
  function fichesPhotos(produits){
    var parId={},usage={},avecListe={},carte={};
    Object.keys(PHOTOS_ORIGINE).forEach(function(id){
      PHOTOS_ORIGINE[id].forEach(function(n){usage[n]=(usage[n]||0)+1;});
    });
    var ANCIENNES={p3:1,p8:1,p13:1,p15:1,p38:1,p39:1,p44:1,p56:1,p58:1};
    (Array.isArray(produits)?produits:[]).forEach(function(it){
      if(it&&it.type==='produit'&&it.id&&it.imgcarte)carte[it.id]=cleanUrl(it.imgcarte);
      if(it&&it.type==='produit'&&ANCIENNES[it.id]&&String(it.vimg)!=='2'
         &&(String(it.image||'')+' '+String(it.photos||'')+' '+String(it.imgcarte||'')).indexOf('/api/media/')<0)return;
         /* ancienne liste d'avant le remaniement ; une photo envoyée depuis le back-office est toujours respectée */
      if(it&&it.type==='produit'&&it.id&&it.image)parId[it.id]=cleanUrl(it.image);
      /* un produit dont la galerie a été choisie photo par photo garde cette
         liste telle quelle : sa photo principale ne doit pas aussi remplacer
         l'ancien fichier, sinon une même photo apparaît deux fois */
      if(it&&it.type==='produit'&&it.id&&it.photos){
        try{var l=JSON.parse(it.photos);if(Array.isArray(l)&&l.length)avecListe[it.id]=true;}catch(e){}
      }
    });
    return {parId:parId,usage:usage,avecListe:avecListe,carte:carte};
  }
  function norm(t){return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}

  function installGallerySync(map,deleted){
    if(window.__VESPRA_GALLERY_SYNC_INSTALLED)return;
    if(typeof window.pgShow!=='function' && typeof window.pgSync!=='function')return;
    window.__VESPRA_GALLERY_SYNC_INSTALLED=true;

    function fixImg(img){
      if(!img)return;
      var key=basename(img.getAttribute('src')||'');
      if(deleted[key]){
        img.setAttribute('data-vespra-image-deleted','1');
        img.style.display='none';
        return;
      }
      img.removeAttribute('data-vespra-image-deleted');
      img.style.display='';
      var rep=map[key];
      if(rep)img.setAttribute('src',(window.VESPRA_IMG?window.VESPRA_IMG(rep,img.id==='prodMainImg'||img.id==='pgImg'?1400:900):rep));
    }
    /* garde-fou pour toutes les fiches produit : une même photo n'apparaît
       jamais deux fois dans la galerie, quelle qu'en soit la cause */
    function dedoublonne(){
      try{
        if(typeof PG_IMGS==='undefined'||!Array.isArray(PG_IMGS)||PG_IMGS.length<2)return;
        var vu={},garde=[];
        PG_IMGS.forEach(function(x){
          if(!x||!x.s)return;
          var k=basename(x.s),eff=basename(map[k]||x.s);
          if(vu[eff])return;
          vu[eff]=1;garde.push(x);
        });
        if(garde.length===PG_IMGS.length)return;
        PG_IMGS.splice.apply(PG_IMGS,[0,PG_IMGS.length].concat(garde));
        var v=document.getElementById('prodThumbs');if(v)v.innerHTML='';
        if(typeof pgThumbs==='function')pgThumbs();
      }catch(e){}
    }
    function fixGallery(){
      dedoublonne();
      var main=document.getElementById('prodMainImg');
      fixImg(main);
      fixImg(document.getElementById('pgImg'));
      document.querySelectorAll('#prodThumbs .prod-thumb').forEach(function(t){
        var im=t.querySelector('img');
        if(!im)return;
        var key=basename(im.getAttribute('src')||'');
        t.style.display=deleted[key]?'none':'';
      });
      if(main && deleted[basename(main.getAttribute('src')||'')]){
        var thumbs=[].slice.call(document.querySelectorAll('#prodThumbs .prod-thumb'));
        var idx=-1;
        for(var i=0;i<thumbs.length;i++){
          if(thumbs[i].style.display==='none')continue;
          idx=i;break;
        }
        if(idx>=0 && typeof window.pgShow==='function'){
          /* pgShow réapplique le chemin d'origine ; notre wrapper le
             remplace ensuite par la bonne photo ou la masque. */
          window.pgShow(idx);
        }
      }
    }
    ['pgShow','pgSync','pgOpen'].forEach(function(name){
      if(typeof window[name]!=='function')return;
      var original=window[name];
      window[name]=function(){
        var result=original.apply(this,arguments);
        fixGallery();
        return result;
      };
    });
    fixGallery();
  }

  function apply(items,produits){
    if(!Array.isArray(items))items=[];
    var map={};
    var deleted={};
    items.forEach(function(x){
      if(!x||!x.id)return;
      if(x.action==='supprimer')deleted[x.id]=true;
      else if(x.image)map[x.id]=x.image;
    });
    var fp=fichesPhotos(produits);
    Object.keys(fp.parId).forEach(function(id){
      if(fp.avecListe[id]||id==='p15')return; /* p15 : une photo par variante, jamais remplacées par la photo principale */
      (PHOTOS_ORIGINE[id]||[]).forEach(function(n){
        if(fp.usage[n]===1&&!map[n]&&fp.parId[id]!==n)map[n]=fp.parId[id];
      });
    });
    window.VESPRA_IMAGE_MAP=map;
    window.VESPRA_IMAGE_DELETED=deleted;

    document.querySelectorAll('img').forEach(function(img){
      var src=img.getAttribute('src')||'';
      var key=basename(src);
      if(deleted[key]){
        img.setAttribute('data-vespra-image-deleted','1');
        img.style.display='none';
      }else{
        img.removeAttribute('data-vespra-image-deleted');
        var rep=replacement(src,map);
        if(rep){img.setAttribute('src',(window.VESPRA_IMG?window.VESPRA_IMG(rep,900):rep));img.removeAttribute('srcset');}
      }
      var srcset=img.getAttribute('srcset');
      if(srcset&&!deleted[key]){
        var parts=srcset.split(',').map(function(part){
          var bits=part.trim().split(/\s+/);
          var rr=replacement(bits[0],map);
          if(rr)bits[0]=rr;
          return bits.join(' ');
        });
        img.setAttribute('srcset',parts.join(', '));
      }
    });

    document.querySelectorAll('[style*="background-image"],[style*="background:"]').forEach(function(el){
      var style=el.getAttribute('style')||'';
      Object.keys(deleted).forEach(function(key){
        if(style.indexOf(key)!==-1)style=style.replace(/background-image\s*:[^;]+;?/ig,'background-image:none;');
      });
      Object.keys(map).forEach(function(key){
        var rep=map[key];
        var re=new RegExp('(["\\\']?)([^"\\\'\\)\\s]*'+key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[^"\\\'\\)]*)(["\\\']?)','g');
        style=style.replace(re,function(_,q,url,end){return q+rep+end;});
      });
      el.setAttribute('style',style);
    });

    var css='';
    Object.keys(deleted).forEach(function(key){
      css += '[src$="/'+key+'"],[src="'+key+'"]{display:none!important}';
    });
    if(css){
      var st=document.getElementById('vespra-image-overrides');
      if(!st){st=document.createElement('style');st.id='vespra-image-overrides';document.head.appendChild(st);}
      st.textContent=css;
    }

    document.querySelectorAll('meta[property="og:image"],meta[name="twitter:image"]').forEach(function(meta){
      var key=basename(meta.getAttribute('content')||'');
      if(deleted[key])meta.setAttribute('content','');
      else {var rep=map[key];if(rep)meta.setAttribute('content',rep);}
    });

    /* tableaux PRODUCTS (accueil, catalogue, pages villes) : même photo partout,
       y compris pour la fenêtre produit, le panier et le devis */
    var produitsParNom={};
    try{
      (window.PRODUCTS||[]).forEach(function(p){
        if(!p||!p.id)return;
        var nouvelle=fp.carte[p.id]||fp.parId[p.id];
        if(!nouvelle&&p.img&&map[basename(p.img)])nouvelle=map[basename(p.img)];
        if(!nouvelle&&!p.img&&p.id==='p53')nouvelle='chauffage-fioul.webp';   /* chauffage fioul à cheminée, sans photo dans la liste d'origine */
        /* allégée dès maintenant : les cartes et les aperçus sont construits à partir de p.img */
        if(nouvelle)p.img=(window.VESPRA_IMG?window.VESPRA_IMG(nouvelle,900):nouvelle);
        if(nouvelle&&p.name)produitsParNom[norm(p.name)]=nouvelle;
      });
    }catch(e){}
    /* une carte construite par script ou ajoutée après coup (panier, fenêtre
       produit, carrousel) reçoit elle aussi la bonne photo */
    /* largeur utile selon l'endroit où la photo est affichée */
    function allege(src,img){
      if(typeof window.VESPRA_IMG!=='function')return src;
      /* si le service d'images ne répond pas, on n'y fait plus appel du tout */
      if(window.__VESPRA_IMG_HS||(img&&img.__sansCdn))return src;
      var w=800;
      try{
        var cl=' '+(img&&img.className||'')+' ';
        if(img&&(img.id==='prodMainImg'||img.id==='pgImg'))w=1400;
        else if(img&&img.closest&&img.closest('#prodThumbs'))w=300;
        else if(/ (prod-img|bc-img|pc-img|blog-thumb|c-item-img|vm-img|evc-img) /.test(cl))w=450;
        else{var r=img&&img.getBoundingClientRect?img.getBoundingClientRect().width:0;if(r>0)w=Math.max(300,Math.min(1400,Math.ceil(r/100)*100));}
      }catch(e){}
      return window.VESPRA_IMG(src,w);
    }
    /* si le service d'images ne répond pas, la photo d'origine reprend sa place */
    var echecs=0,parPage=null;
    /* service d'images injoignable : toutes les photos reprennent leur version d'origine */
    function toutRetablir(){
      try{
        document.querySelectorAll('img').forEach(function(i){
          if(!i.__orig)return;
          if((i.getAttribute('src')||'').indexOf('/.netlify/images')!==0)return;
          i.__sansCdn=1;i.removeAttribute('srcset');i.setAttribute('src',i.__orig);
        });
      }catch(e){}
    }
    function filet(img,origine){
      img.__orig=origine;
      if(!img||img.__filet)return;img.__filet=1;
      img.addEventListener('error',function(){
        try{
          if((img.getAttribute('src')||'').indexOf('/.netlify/images')!==0)return;
          img.__sansCdn=1;                       /* cette photo reprend sa version d'origine */
          img.removeAttribute('srcset');img.setAttribute('src',origine);
          if(++echecs>=3&&!window.__VESPRA_IMG_HS){window.__VESPRA_IMG_HS=1;toutRetablir();}
        }catch(e){}
      });
    }
    function corrige(img){
      if(!img||img.nodeName!=='IMG')return;
      var src=img.getAttribute('src')||'',key=basename(src);
      if(deleted[key])return;
      var rep=map[key];
      /* Dans la galerie d'une fiche, chaque photo a sa propre légende
         (« Photobooth — vue de face ») : on ne lui prête jamais la photo
         principale du produit d'après son nom, sinon la deuxième photo
         choisie dans le back-office redevenait identique à la première. */
      var galerie=img.id==='prodMainImg'||img.id==='pgImg'||(img.closest&&img.closest('#prodThumbs,#pgOv'));
      if(!rep&&!galerie){
        var alt=norm(img.getAttribute('alt'));
        if(alt){
          if(produitsParNom[alt])rep=produitsParNom[alt];
          else{
            var m=/^(.*?)\s+[\u2014\u2013-]\s+/.exec(alt);
            if(m&&produitsParNom[m[1]])rep=produitsParNom[m[1]];
          }
        }
      }
      /* une carte qui mène à la fiche d'un produit reçoit la photo choisie pour ce produit */
      if(!rep&&!galerie){
        try{
          var lien=img.closest&&img.closest('a[href]');
          if(lien){
            var pg=String(lien.getAttribute('href')||'').split(/[?#]/)[0].replace(/^.*\//,'').replace(/\.html$/,'');
            if(/^produit-/.test(pg)){
              if(!parPage){parPage={};(window.VESPRA_PRODUITS||[]).forEach(function(q){if(q&&q.id&&q.page)parPage[String(q.page).replace(/\.html$/,'')]=q.id;});}
              var idp=parPage[pg];
              if(idp)rep=fp.carte[idp]||fp.parId[idp]||null;
            }
          }
        }catch(e){}
      }
      /* la photo trouvée d'après le nom peut elle-même avoir été remplacée : on va jusqu'au bout,
         sinon deux règles se renvoient la balle à l'infini et la page se fige */
      if(rep&&map[basename(rep)])rep=map[basename(rep)];
      /* une photo envoyée depuis le back-office est servie redimensionnée :
         sinon la page chargerait la photo d'origine, souvent de plusieurs mégaoctets */
      /* photo déjà demandée au service d'images : on garde quand même son
         adresse d'origine sous la main, pour pouvoir y revenir en cas de panne */
      if(src.indexOf('/.netlify/images')===0){
        try{var o=decodeURIComponent((src.match(/[?&]url=([^&]+)/)||[])[1]||'');if(o)filet(img,o);}catch(e){}
      }
      var depart=rep||src;
      var final=allege(depart,img);
      if(final&&final!==src){
        filet(img,depart);
        var nb=+(img.getAttribute('data-vi')||0);if(nb>=3)return;   /* garde-fou anti-boucle */
        img.setAttribute('data-vi',String(nb+1));
        img.removeAttribute('srcset');img.setAttribute('src',final);
      }
    }
    /* la passe tourne toujours : même sans remplacement, les photos du
       back-office doivent être allégées avant d'être affichées */
    {
      document.querySelectorAll('img').forEach(corrige);
      try{
        new MutationObserver(function(muts){
          muts.forEach(function(m){
            if(m.type==='attributes'){corrige(m.target);return;}
            m.addedNodes.forEach(function(n){
              if(n.nodeType!==1)return;
              if(n.nodeName==='IMG')corrige(n);
              else if(n.querySelectorAll)n.querySelectorAll('img').forEach(corrige);
            });
          });
        }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
      }catch(e){}
    }

    installGallerySync(map,deleted);
    try{window.dispatchEvent(new CustomEvent('vespra-images-ready'));}catch(e){}
  }
  function start(){
    if(typeof window.VESPRA_DONNEES!=='function')return;
    Promise.all([window.VESPRA_DONNEES('images'),window.VESPRA_DONNEES('produits')]).then(function(r){apply(r[0],r[1]);}).catch(function(){});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
