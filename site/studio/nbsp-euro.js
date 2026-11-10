/* Un prix et son signe € restent toujours sur la même ligne (téléphone comme ordinateur) :
   l'espace entre le chiffre et « € » (et entre « € » et « TTC »/« HT ») devient une espace insécable. */
(function(){
  var RE=/(\d|\))[ \t ]+€/g,RE2=/€[ \t]+(TTC|HT)\b/g,SKIP={SCRIPT:1,STYLE:1,TEXTAREA:1,INPUT:1,NOSCRIPT:1};
  function fix(n){
    var v=n.nodeValue;if(!v||v.indexOf('€')<0)return;
    var w=v.replace(RE,'$1 €').replace(RE2,'€ $1');
    if(w!==v)n.nodeValue=w;
  }
  function walk(root){
    if(!root)return;
    if(root.nodeType===3){fix(root);return;}
    if(root.nodeType!==1||SKIP[root.tagName])return;
    var tw=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(n){var p=n.parentNode;return(p&&SKIP[p.tagName]||p&&p.isContentEditable)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});
    var n;while((n=tw.nextNode()))fix(n);
  }
  var queue=[],planned=false;
  function flush(){planned=false;var q=queue;queue=[];q.forEach(walk);}
  function plan(n){queue.push(n);if(!planned){planned=true;(window.requestAnimationFrame||setTimeout)(flush);}}
  function start(){
    walk(document.body);
    new MutationObserver(function(ms){ms.forEach(function(m){
      if(m.type==='characterData'){plan(m.target);}
      else m.addedNodes.forEach(function(a){plan(a);});
    });}).observe(document.body,{childList:true,subtree:true,characterData:true});
  }
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();
