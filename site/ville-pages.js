/* Pages villes / professionnels : formules centrées sur « 300 tirages » (mobile), carrousel d'événements automatique. */
(function () {
  try {
    var rb = document.getElementById('vrb');
    if (rb && innerWidth <= 1000 && rb.children[2]) {
      var k = rb.children[2];
      rb.scrollTo({ left: k.offsetLeft - (rb.clientWidth - k.offsetWidth) / 2 });
    }
    var reduit = matchMedia('(prefers-reduced-motion:reduce)').matches;
    document.querySelectorAll('.v-car[data-auto]').forEach(function (c) {
      [].slice.call(c.children).forEach(function (n) { var q = n.cloneNode(true); q.setAttribute('aria-hidden', 'true'); q.tabIndex = -1; c.appendChild(q); });
      var hold = false, drag = null, rel = 0, last = 0, acc = 0, vis = true, sp = 28;
      var half = function () { return c.scrollWidth / 2; };
      c.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hold = true; });
      c.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hold = false; });
      c.addEventListener('mousedown', function (e) { drag = { x: e.clientX, s: c.scrollLeft, m: false }; });
      addEventListener('mousemove', function (e) { if (drag) { var d = e.clientX - drag.x; if (Math.abs(d) > 4) { drag.m = true; c.classList.add('v-dn'); } if (drag.m) c.scrollLeft = drag.s - d; } });
      addEventListener('mouseup', function () { setTimeout(function () { drag = null; c.classList.remove('v-dn'); }, 0); });
      c.addEventListener('click', function (e) { if (drag && drag.m) { e.preventDefault(); e.stopPropagation(); } }, true);
      if (window.IntersectionObserver) new IntersectionObserver(function (en) { vis = en[0].isIntersecting; }).observe(c);
      if (reduit) return;
      (function f(t) {
        if (!last) last = t; var dt = Math.min(64, t - last) / 1000; last = t;
        if (vis && !hold && !(drag && drag.m) && !document.hidden && !(window.__vespraPopup && window.__vespraPopup()) && half() > 0) {
          acc += sp * dt; var px = Math.floor(acc);
          if (px > 0) { acc -= px; c.scrollLeft += px; if (c.scrollLeft >= half()) c.scrollLeft -= half(); }
        }
        requestAnimationFrame(f);
      })(0);
    });
  } catch (e) {}
})();
