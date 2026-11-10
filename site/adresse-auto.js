/* Adresse du local : 1 bis allée de la Haute Gasniais (bascule appliquée aussi aux textes venant des Paramètres). */
(function(){
  var SEUIL=0;
  var now=(typeof window.VESPRA_NOW==='number')?window.VESPRA_NOW:Date.now();
  if(now<SEUIL)return;
  var LONG='1 bis allée de la Haute Gasniais', COURT='1 bis all. Haute Gasniais';
  var RULES=[
    [/183\s+(?:boulevard|bld|bd\.?)\s+de\s+Laval/gi,function(m){return /boulevard/i.test(m)?LONG:COURT;}],
    [/15\s*C?\s+avenue\s+Le\s+Gonidec\s+de\s+Traissan/gi,LONG],
    [/,\s+à la sortie est de la ville,/g,','],
    [/\s+—\s+à cent mètres de notre dépôt/g,'']
  ];
  var URLR=[
    [/183(?:\+|%20|\s)+(?:boulevard|bld|bd)(?:\+|%20|\s)+de(?:\+|%20|\s)+Laval/gi,'1+bis+all%C3%A9e+de+la+Haute+Gasniais']
  ];
  function fix(s,rules){
    if(!s)return s;
    for(var i=0;i<rules.length;i++)s=s.replace(rules[i][0],rules[i][1]);
    return s;
  }
  var ATTRS=['src','href','content','title','alt','value','placeholder','aria-label','data-adresse'];
  function el(e){
    if(e.nodeType!==1)return;
    var tn=e.tagName;
    if(tn==='SCRIPT'){
      if(/ld\+json/.test(e.type||'')){var t=fix(e.textContent,RULES);if(t!==e.textContent)e.textContent=t;}
      return;
    }
    if(tn==='STYLE')return;
    for(var i=0;i<ATTRS.length;i++){
      var a=ATTRS[i],v=e.getAttribute(a);
      if(v&&/183|Gonidec/i.test(v)){
        var n=fix(fix(v,URLR),RULES);
        if(n!==v)e.setAttribute(a,n);
      }
    }
  }
  function walk(root){
    if(!root)return;
    if(root.nodeType===3){
      var s=root.nodeValue;
      if(s&&/183|Gonidec|sortie est|cent mètres/i.test(s)){var n=fix(s,RULES);if(n!==s)root.nodeValue=n;}
      return;
    }
    if(root.nodeType!==1&&root.nodeType!==9&&root.nodeType!==11)return;
    if(root.nodeType===1)el(root);
    var k=root.firstChild;
    while(k){walk(k);k=k.nextSibling;}
  }
  function run(){walk(document.documentElement);}
  run();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);
  if(window.MutationObserver){
    new MutationObserver(function(ms){
      for(var i=0;i<ms.length;i++){
        var m=ms[i];
        if(m.type==='characterData')walk(m.target);
        else if(m.type==='attributes')el(m.target);
        else for(var j=0;j<m.addedNodes.length;j++)walk(m.addedNodes[j]);
      }
    }).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS});
  }
})();
