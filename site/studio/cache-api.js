/* Cache de lecture du back-office : une page déjà demandée il y a moins de 60 s
   s'affiche tout de suite, sans rappeler le serveur. Toute écriture (POST, PUT,
   DELETE) vide le cache. Les lectures qui précèdent une sauvegarde (cache:'no-store')
   et la liste des clients ne passent jamais par ici. Partagé entre la page et le
   cadre « Réservation », et gardé pour la durée de l'onglet. */
(function(){
  if (window.__vsCacheOk) return; window.__vsCacheOk = true;
  var TTL = 60000, CLE = 'vsCacheApi1';
  var top_; try { top_ = window.top && window.top.location.origin === location.origin ? window.top : window; } catch (e) { top_ = window; }
  var M = top_.__vsCache || (top_.__vsCache = (function(){
    var m = {}; try { m = JSON.parse(sessionStorage.getItem(CLE) || '{}') || {}; } catch (e) {}
    return m;
  })());
  function sauver(){ try { sessionStorage.setItem(CLE, JSON.stringify(M)); } catch (e) { M = top_.__vsCache = {}; try { sessionStorage.removeItem(CLE); } catch (e2) {} } }
  function vider(){ for (var k in M) delete M[k]; try { sessionStorage.removeItem(CLE); } catch (e) {} }
  window.__vsCacheClear = vider; try { top_.__vsCacheClear = vider; } catch (e) {}
  var OK = /^\/api\/admin\/(data\?collection=|demandes|parrainage|espace-modifs|entreprise|storage-status)/;
  var F = window.fetch.bind(window);
  var encours = top_.__vsEnCours || (top_.__vsEnCours = {});
  window.fetch = function(url, init){
    var u; try { u = new URL(typeof url === 'string' ? url : url.url, location.href); } catch (e) { return F(url, init); }
    var chemin = u.pathname + u.search;
    if (u.origin !== location.origin || chemin.indexOf('/api/admin') !== 0) return F(url, init);
    var methode = ((init && init.method) || (typeof url !== 'string' && url.method) || 'GET').toUpperCase();
    if (methode !== 'GET') {
      vider();
      return F(url, init).then(function(r){ vider(); return r; }, function(e){ vider(); throw e; });
    }
    var frais = init && (init.cache === 'no-store' || init.cache === 'reload');
    if (frais || !OK.test(chemin)) return F(url, init);
    var c = M[chemin];
    if (c && Date.now() - c.t < TTL) return Promise.resolve(new Response(c.b, { status: c.s, headers: { 'content-type': c.c || 'application/json', 'x-cache': 'vs' } }));
    if (encours[chemin]) return encours[chemin].then(function(c2){ return new Response(c2.b, { status: c2.s, headers: { 'content-type': c2.c || 'application/json' } }); });
    var p = F(url, init).then(function(r){
      return r.clone().text().then(function(b){
        var e = { t: Date.now(), s: r.status, c: r.headers.get('content-type'), b: b };
        if (r.ok && b.length < 1500000) { M[chemin] = e; sauver(); }
        return e;
      }).then(function(e){ delete encours[chemin]; return e; }, function(er){ delete encours[chemin]; throw er; });
    });
    encours[chemin] = p;
    return p.then(function(e){ return new Response(e.b, { status: e.s, headers: { 'content-type': e.c || 'application/json' } }); });
  };
})();
