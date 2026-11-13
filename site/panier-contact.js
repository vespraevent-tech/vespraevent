/* Bas du panier : un bouton pour nous écrire, même quand le devis est vide.
   Avec un devis vide, le visiteur n'avait aucune suite à donner. Un bloc « Envoyer une
   demande » reste donc affiché en bas du panier tant que le devis est vide ; dès qu'un
   produit est ajouté, le bloc habituel (total, Réserver) reprend la place. */
(function () {
  var CSS = '#cContact{padding:20px 28px 26px;border-top:1px solid var(--g4,#e3e7ec);background:#fff;'
    + 'box-shadow:0 -14px 24px -18px rgba(20,37,58,.28);text-align:center}'
    + '#cContact .cc-t{font:700 15px/1.3 Inter,system-ui,sans-serif;color:var(--black,#0c0f14);margin:0 0 6px}'
    + '#cContact .cc-s{font:400 13px/1.5 Inter,system-ui,sans-serif;color:var(--g2,#6b7685);margin:0 0 16px}'
    + '#cContact .cc-b{display:flex;align-items:center;justify-content:center;width:100%;padding:16px;background:var(--navy,#2B4A6B);'
    + 'color:#fff;border-radius:var(--pill,10px);font:700 15px/1 Inter,system-ui,sans-serif;text-decoration:none;transition:background .2s}'
    + '#cContact .cc-b:hover{background:#1f3a57}'
    + '#cContact .cc-l{display:inline-block;margin-top:14px;font:600 13px/1 Inter,system-ui,sans-serif;color:var(--navy,#2B4A6B);text-decoration:none}'
    + '#cContact .cc-l:hover{text-decoration:underline}';
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
        '<p class="cc-t">Une question, un projet ?</p>'
      + '<p class="cc-s">Décrivez-nous votre événement : nous vous répondons avec un devis sous 24 h.</p>'
      + '<a class="cc-b" href="/reservation.html?demande=devis">Envoyer une demande →</a>'
      + '<a class="cc-l" href="tel:+33650836828">ou nous appeler : 06 50 83 68 28</a>';
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
