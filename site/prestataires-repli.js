/* Prestataires partenaires (pâtissier, serveuse privée…) : le formulaire de demande reste replié
   derrière un bouton. Seul le formulaire de contact principal, en bas de page, est ouvert d'office. */
(function () {
  var card = document.getElementById('prCard');
  if (!card) return;
  var css = document.createElement('style');
  css.textContent =
    '.pr-card:has(.pr-replie){grid-template-columns:1fr!important}' +
    '.pr-form.pr-replie{grid-template-columns:1fr auto;align-items:center;column-gap:32px;row-gap:4px;padding:24px 28px}' +
    '.pr-form.pr-replie h3{grid-column:1;margin:0}' +
    '.pr-form.pr-replie .pr-n0{grid-column:1;margin:0;max-width:640px}' +
    '.pr-form.pr-replie .pr-ouvrir{grid-column:2;grid-row:1/span 2}' +
    '@media(max-width:820px){.pr-form.pr-replie{grid-template-columns:1fr}.pr-form.pr-replie .pr-ouvrir{grid-column:1;grid-row:auto;margin-top:12px;justify-self:start}}' +
    '.pr-form.pr-replie>*:not(h3):not(.pr-n0):not(.pr-ouvrir){display:none!important}' +
    '.pr-ouvrir{display:inline-flex;align-items:center;gap:10px;height:44px;padding:0 24px;border-radius:999px;border:1px solid var(--navy,#2B4A6B);background:var(--navy,#2B4A6B);color:#fff;font:inherit;font-size:11.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:background .2s}' +
    '.pr-ouvrir:hover{background:var(--navy-h,#1e3650)}' +
    '.pr-ouvrir svg{width:14px;height:14px;transition:transform .2s}' +
    '.pr-form:not(.pr-replie) .pr-ouvrir{display:none}' +
    '.pr-form.pr-ouvert>*{animation:prApparait .35s ease both}' +
    '@keyframes prApparait{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}';
  document.head.appendChild(css);

  function preparer() {
    var f = document.getElementById('prForm');
    if (!f || f.dataset.repli) return;
    f.dataset.repli = '1';
    f.classList.add('pr-replie');
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pr-ouvrir';
    b.innerHTML = 'Demander cette prestation <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    b.setAttribute('aria-expanded', 'false');
    var n0 = f.querySelector('.pr-n0');
    (n0 ? n0.parentNode.insertBefore(b, n0.nextSibling) : f.appendChild(b));
    b.addEventListener('click', function () {
      f.classList.remove('pr-replie');
      f.classList.add('pr-ouvert');
      b.setAttribute('aria-expanded', 'true');
      var premier = f.querySelector('#prNom');
      if (premier) try { premier.focus({ preventScroll: true }); } catch (e) {}
    });
  }
  preparer();
  new MutationObserver(preparer).observe(card, { childList: true });
})();
