/* ═══════════════════════════════════════════════════════════════
   Animations — Vespra Event
   ───────────────────────────────────────────────────────────────
   Apparition en douceur des sections au défilement.

   Rien ne s'exécute sans une vraie souris (donc rien sur mobile),
   ni si le visiteur a demandé moins d'animations.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  var calme = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var souris = window.matchMedia('(pointer:fine)').matches;

  var st = document.createElement('style');
  st.textContent = [
    '.hero .hero-overlay{z-index:2}',
    '.hero .hero-content{position:relative;z-index:3}',
    '.vs-rise{opacity:0;transform:translateY(18px);transition:opacity .65s cubic-bezier(.22,.61,.36,1),transform .65s cubic-bezier(.22,.61,.36,1)}',
    '.vs-rise.vs-in{opacity:1;transform:none}'
  ].join('');
  document.head.appendChild(st);

  /* ═════════ apparition au défilement ═════════ */
  function apparitions() {
    if (calme || !souris || !('IntersectionObserver' in window)) return;
    var cibles = [];
    ['section > h2', '.prod-card', '.pc-card', '.bc-card', '.faq-item', '.city-block', '.prod-article h2']
      .forEach(function (sel) {
        Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
          if (el.closest('.hero') || el.closest('footer') || cibles.indexOf(el) > -1) return;
          cibles.push(el);
        });
      });
    cibles = cibles.slice(0, 160);
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('vs-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    cibles.forEach(function (el) {
      if (el.getBoundingClientRect().top < innerHeight) return;
      el.classList.add('vs-rise');
      io.observe(el);
    });
  }

  function init() { apparitions(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
