/* Lecture automatique d'une facture d'achat (texte extrait d'un PDF) → date, fournisseur, n°, HT, TVA, TTC. */
(function(root){
  var MOIS={janvier:1,fevrier:2,février:2,mars:3,avril:4,mai:5,juin:6,juillet:7,aout:8,août:8,septembre:9,octobre:10,novembre:11,decembre:12,décembre:12};
  var AMT=/(-?\d{1,3}(?:[ .  ]\d{3})+[.,]\d{2}|-?\d+[.,]\d{2})(?![\d%]|\s?%)/g;
  function num(s){
    s=String(s).replace(/[\s  ]/g,'');var neg=s[0]==='-';s=s.replace('-','');
    var lc=s.lastIndexOf(','),ld=s.lastIndexOf('.');
    if(lc>=0&&ld>=0){var dec=Math.max(lc,ld);s=s.slice(0,dec).replace(/[.,]/g,'')+'.'+s.slice(dec+1);}
    else if(lc>=0){s=s.replace(',','.');}
    else if(ld>=0&&s.length-ld-1!==2){s=s.replace('.','');}
    var v=parseFloat(s);return neg?-v:v;
  }
  function amts(line){var o=[],m;AMT.lastIndex=0;while((m=AMT.exec(line)))o.push(num(m[1]));return o;}
  function r2(n){return Math.round(n*100)/100;}
  function pad(n){return (n<10?'0':'')+n;}
  function iso(d,m,y){y=+y;if(y<100)y+=2000;d=+d;m=+m;if(m>12&&d<=12){var t=d;d=m;m=t;}if(!(m>=1&&m<=12&&d>=1&&d<=31&&y>=2000&&y<=2100))return null;return y+'-'+pad(m)+'-'+pad(d);}
  function dateIn(line){
    var m=/(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/.exec(line);
    if(m){var r=iso(m[1],m[2],m[3]);if(r)return r;}
    m=/(\d{1,2})\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})/i.exec(line);
    if(m)return iso(m[1],MOIS[m[2].toLowerCase()],m[3]);
    return null;
  }
  function findDate(lines){
    var i,d;
    for(i=0;i<lines.length;i++){if(/date\s+(de\s+(la\s+)?)?(facture|facturation|invoice)|invoice date|^\s*date\b|date\s*:/i.test(lines[i])&&!/commande|order|limite|livraison\s*:?\s*$/i.test(lines[i])){d=dateIn(lines[i]);if(d)return d;}}
    for(i=0;i<lines.length;i++){if(/date/i.test(lines[i])&&!/commande|order|limite/i.test(lines[i])){d=dateIn(lines[i]);if(d)return d;}}
    for(i=0;i<lines.length;i++){d=dateIn(lines[i]);if(d)return d;}
    return '';
  }
  function findNum(text){
    var pats=[/Num[ée]ro de (?:la )?facture\s*:?\s*([A-Z0-9][\w\-\/]{3,})/i,/Invoice number\s*:?\s*([A-Z0-9][\w\-\/]{3,})/i,/Facture\s*-?\s*n[°o]\s*:?\s*([A-Z0-9][\w\-\/ ]{3,}?)(?:\s{2,}|\s+(?:Notre|Date|DATE)|$)/im,/FACTURE\s*:\s*([A-Z0-9][\w\-\/]{3,})/,/Facture\s*:\s*([A-Z0-9][\w\-\/]{3,})/i,/(?:Note de cr[ée]dit|Avoir)\s*n[°o]\s*:?\s*([A-Z0-9][\w\-\/]{3,})/i,/Facture N[°o]\s*([A-Z0-9][\w\-\/ ]{3,}?)\s*$/im,/Num[ée]ro de commande\s*:?\s*([\d\-]{8,})/i,/commande\s+n[°o]\s*([\d\-]{8,})/i];
    for(var i=0;i<pats.length;i++){var m=pats[i].exec(text);if(m){var v=m[1].trim().replace(/\s+/g,' ');if(/^[\d ]+$/.test(v))v=v.replace(/ /g,'');return v;}}
    return '';
  }
  var FOURN=[[/thomann/i,'Thomann'],[/sonovente/i,'Sonovente'],[/toolport/i,'Toolport'],[/mb\s?tech/i,'MB Tech'],[/vs\s+menuisier|vs\s*cr[ée]ation/i,'VS Création'],[/publi[\s-]?7/i,'Publi 7'],[/vevor|indepsale/i,'Vevor'],[/amazon/i,'Amazon'],[/leroy\s*merlin/i,'Leroy Merlin'],[/castorama/i,'Castorama'],[/bricomarch/i,'Bricomarché'],[/ikea/i,'IKEA'],[/action\b/i,'Action']];
  function findFourn(text,lines,fileName){
    for(var i=0;i<FOURN.length;i++)if(FOURN[i][0].test(text))return FOURN[i][1];
    var m=/Vendu par\s+(.+?)(?:\s{2,}|$)/i.exec(text);if(m)return m[1].trim().slice(0,40);
    for(i=0;i<lines.length;i++){var l=lines[i].trim();if(/[A-Za-zÀ-ÿ]{3,}/.test(l)&&!/facture|invoice|^\d/i.test(l))return l.slice(0,40);}
    return (fileName||'').replace(/\.pdf$/i,'').slice(0,40);
  }
  function labelAmt(lines,labels){
    for(var k=0;k<labels.length;k++){
      for(var i=0;i<lines.length;i++){
        if(labels[k].test(lines[i])&&!/d[ée]signation|quantit[ée]|prix/i.test(lines[i])){
          var a=amts(lines[i].replace(labels[k],' '));
          if(!a.length&&lines[i+1])a=amts(lines[i+1]);
          if(a.length)return a[0];
        }
      }
    }
    return null;
  }
  function parse(text,fileName){
    var lines=String(text||'').split(/\n/).map(function(l){return l.replace(/\s+/g,' ').trim();}).filter(Boolean);
    var res={d:findDate(lines),n:findNum(text),f:findFourn(text,lines,fileName),ht:null,tva:null,ttc:null,st:'verif',note:'',lu:false};
    var avoir=/note de cr[ée]dit|credit note|\bavoir\b/i.test(text);
    var ht=null,tva=null,ttc=null,i;
    /* 1. ligne « total » avec trois montants : HT + TVA = TTC */
    for(i=lines.length-1;i>=0;i--){
      if(/total/i.test(lines[i])){var a=amts(lines[i]);
        for(var j=0;j+2<a.length;j++){if(Math.abs(a[j]+a[j+1]-a[j+2])<=0.021&&a[j+2]!==0&&a[j+1]!==0){ht=a[j];tva=a[j+1];ttc=a[j+2];break;}}
        if(ttc!=null)break;}
    }
    /* 2. libellés */
    if(ttc==null){
      ttc=labelAmt(lines,[/Montant total TTC\s*:?/i,/Total\s*T\.?T\.?C\.?\s*:?/i,/NET [AÀ] PAYER\s*:?/i,/Facture Total\s*:?/i,/Total [àa] payer\s*:?/i,/Valeur marchandise\s*:?/i,/Montant total\s*:?/i,/Total Amount/i,/Total\s*:/i]);
      ht=labelAmt(lines,[/Total Net HT\s*:?/i,/Net HT\s*:?/i,/Montant net\s*:?/i,/Net total\s*:?/i,/Total hors TVA\s*:?/i,/Total HT\s*:?/i,/Montant Total HT\s*:?/i,/Total H\.T\.?\s*:?/i]);
      tva=labelAmt(lines,[/Total TVA(?:\s*[\d.,]+\s?%)?\s*:?/i,/TVA collect[ée]e(?:\s*[\d.,]+\s?%)?\s*:?/i,/(?:[\d.,]+\s?%\s*)TVA\s*:?/i,/Estimation de la TVA\s*:?/i,/Montant TVA\s*:?/i,/Total VAT/i]);
    }
    /* 3. cohérence / secours à 20 % */
    if(ttc==null&&ht!=null&&tva!=null)ttc=r2(ht+tva);
    if(ttc==null&&ht!=null)ttc=r2(ht*1.2);
    if(ttc!=null){
      var ok=(ht!=null&&tva!=null&&Math.abs(ht+tva-ttc)<=0.05);
      if(!ok){
        if(tva!=null&&tva>0&&tva<ttc&&Math.abs(tva-(ttc-ttc/1.2))<ttc*0.1){ht=r2(ttc-tva);}
        else if(ht!=null&&ht<ttc&&Math.abs(ttc-ht-(ttc-ttc/1.2))<ttc*0.1){tva=r2(ttc-ht);}
        else{ht=r2(ttc/1.2);tva=r2(ttc-ht);res.note='TVA estimée à 20 %';}
      }
      res.lu=true;
    }
    if(avoir&&ttc!=null){ttc=-Math.abs(ttc);ht=-Math.abs(ht);tva=-Math.abs(tva);}
    res.ht=ht;res.tva=tva;res.ttc=ttc;
    /* statut */
    var notes=[];
    if(/ceci n.est pas une facture de TVA/i.test(text)){notes.push('Récapitulatif de commande, pas une facture de TVA');}
    else if(/vespra/i.test(text)){res.st='ok';}
    else if(/del.?hommeau|delhommeau/i.test(text)){notes.push('Facturé à ton nom personnel');}
    else{notes.push('Destinataire non reconnu');}
    if(avoir)notes.push('Avoir');
    if(res.note)notes.push(res.note);
    res.note=notes.join(' · ');
    return res;
  }
  var api={parse:parse,num:num,amts:amts};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FactureLecture=api;
})(typeof window!=='undefined'?window:this);
