/* Bas du panier vide : « Envoyer une demande » et « Voir le catalogue », sans texte.
   Dès qu'un produit est ajouté, le bloc habituel (total, Réserver) reprend la place. */
(function () {
  var CSS = '#cContact{padding:20px 28px 26px;border-top:1px solid var(--g4,#e3e7ec);background:#fff;'
    + 'box-shadow:0 -14px 24px -18px rgba(20,37,58,.28)}'
    + '#cContact .cc-b{display:flex;align-items:center;justify-content:center;width:100%;padding:16px;background:var(--navy,#2B4A6B);'
    + 'color:#fff;border-radius:var(--pill,10px);font:700 15px/1 Inter,system-ui,sans-serif;text-decoration:none;transition:background .2s}'
    + '#cContact .cc-b:hover{background:#1f3a57}'
    + '#cContact .cc-c{display:flex;align-items:center;justify-content:center;width:100%;margin-top:10px;padding:14px;background:#fff;'
    + 'color:var(--navy,#2B4A6B);border:1.5px solid var(--navy,#2B4A6B);border-radius:var(--pill,10px);'
    + 'font:600 14px/1 Inter,system-ui,sans-serif;text-decoration:none;transition:background .2s,color .2s}'
    + '#cContact .cc-c:hover{background:var(--navy,#2B4A6B);color:#fff}';
  function installer() {
    var tiroir = document.getElementById('cDrawer');
    var pied = document.getElementById('cFoot');
    if (!tiroir || !pied || document.getElementById('cContact')) return;
    try {
      var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    } catch (e) {}
    var bloc = document.createElement('div');
    bloc.id = 'cContact';
    bloc.innerHTML =
        '<a class="cc-b" href="/reservation.html?demande=devis">Envoyer une demande</a>'
      + '<a class="cc-c" href="/catalogue.html">Voir le catalogue</a>';
    pied.parentNode.insertBefore(bloc, pied.nextSibling);
    function maj() {
      var vide = pied.style.display === 'none' || getComputedStyle(pied).display === 'none';
      bloc.style.display = vide ? 'block' : 'none';
    }
    maj();
    try { new MutationObserver(maj).observe(pied, { attributes: true, attributeFilter: ['style', 'class'] }); } catch (e) {}
    window.addEventListener('storage', maj);
    document.addEventListener('click', function () { setTimeout(maj, 350); }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installer);
  else installer();
})();
