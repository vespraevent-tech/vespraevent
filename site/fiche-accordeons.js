/* Fiches produits : informations rangées en volets (Description / Tarifs / Livraison et retrait)
   et réassurance avec de vraies icônes. Les éléments d'origine sont déplacés, pas recopiés :
   les textes modifiés depuis le back-office et les prix mis à jour restent ceux affichés. */
(function () {
  var col = document.querySelector('.prod-info-col');
  if (!col || col.querySelector('.fa-volets')) return;

  var I = {
    desc: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    prix: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    livr: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    plus: '<path d="M6 9l6 6 6-6"/>',
    camion: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    outil: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z"/>',
    tel: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    paiement: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    bouclier: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>'
  };
  function ico(k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[k] + '</svg>'; }

  var css = document.createElement('style');
  css.textContent =
    '.fa-volets{margin:26px 0 0;border-top:1px solid rgba(12,15,20,.1)}' +
    '.fa-v{border-bottom:1px solid rgba(12,15,20,.1)}' +
    '.fa-t{all:unset;box-sizing:border-box;width:100%;display:flex;align-items:center;gap:14px;padding:18px 2px;cursor:pointer;font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--black,#0C0F14)}' +
    '.fa-t:focus-visible{outline:2px solid var(--navy,#2B4A6B);outline-offset:2px}' +
    '.fa-t>svg{width:20px;height:20px;color:var(--navy,#2B4A6B);flex:none}' +
    '.fa-t span{flex:1}' +
    '.fa-t i{display:flex;width:16px;height:16px;color:#8a94a3;transition:transform .25s}.fa-t i svg{width:16px;height:16px}' +
    '.fa-v.ouvert .fa-t i{transform:rotate(180deg)}' +
    '.fa-c{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s ease}' +
    '.fa-v.ouvert .fa-c{grid-template-rows:1fr}' +
    '.fa-c>div{overflow:hidden}' +
    '.fa-in{padding:0 2px 20px 34px;font-size:14px;line-height:1.7;color:var(--g1,#3D4452)}' +
    '.fa-in .prod-short-desc{margin:0 0 12px!important}.fa-in .prod-features{margin:0!important}' +
    '.fa-tarifs{list-style:none;margin:0;padding:0}' +
    '.fa-tarifs li{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px dashed rgba(12,15,20,.1)}' +
    '.fa-tarifs li:last-child{border-bottom:0}.fa-tarifs b{font-weight:600;color:var(--black,#0C0F14);white-space:nowrap}' +
    '.fa-tarifs .fa-sous{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8a94a3;border:0;padding:14px 0 4px}' +
    '.fa-note{margin:12px 0 0;font-size:12.5px;color:#646D7C}' +
    '.fa-in p{margin:0 0 10px}.fa-in p:last-child{margin:0}' +
    '.prod-trust.fa-rea{display:grid!important;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px!important;padding:0!important;border:0!important;background:none!important}' +
    '.fa-rea .prod-trust-item{display:flex!important;align-items:center;gap:12px;padding:14px 16px!important;border-radius:14px;background:var(--g4,#F0F2F5);font-size:13px!important;line-height:1.35;color:var(--g1,#3D4452)}' +
    '.fa-rea .prod-trust-icon{display:flex!important;flex:none;width:34px;height:34px;align-items:center;justify-content:center;border-radius:50%;background:#fff;color:var(--navy,#2B4A6B);font-size:0!important}' +
    '.fa-rea .prod-trust-icon svg{width:18px;height:18px}' +
    '@media(max-width:520px){.prod-trust.fa-rea{grid-template-columns:1fr}.fa-in{padding-left:0}}';
  document.head.appendChild(css);

  function volet(cle, titre, contenu, ouvert) {
    var v = document.createElement('div');
    v.className = 'fa-v' + (ouvert ? ' ouvert' : '');
    var id = 'fa-' + cle;
    v.innerHTML = '<button type="button" class="fa-t" aria-expanded="' + !!ouvert + '" aria-controls="' + id + '">' + ico(cle) +
      '<span>' + titre + '</span><i>' + ico('plus') + '</i></button><div class="fa-c" id="' + id + '"><div><div class="fa-in"></div></div></div>';
    var zone = v.querySelector('.fa-in');
    if (typeof contenu === 'string') zone.innerHTML = contenu; else contenu.forEach(function (n) { if (n) zone.appendChild(n); });
    v.querySelector('.fa-t').addEventListener('click', function () {
      var o = v.classList.toggle('ouvert');
      this.setAttribute('aria-expanded', String(o));
      if (o && cle === 'prix') remplirTarifs(zone);
    });
    return v;
  }

  function texte(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
  /* tarifs lus au moment de l'ouverture : les prix du back-office sont alors déjà appliqués */
  function remplirTarifs(zone) {
    var lignes = [];
    var formules = col.querySelectorAll('.prod-vbtn');
    if (formules.length) {
      formules.forEach(function (b) {
        var n = texte(b.querySelector('.prod-vbtn-name')) || texte(b), p = texte(b.querySelector('.prod-vbtn-price'));
        lignes.push('<li><span>' + n + '</span><b>' + (p || 'sur devis') + '</b></li>');
      });
    } else {
      var px = texte(document.getElementById('prodPriceDisplay'));
      if (px) lignes.push('<li><span>Location</span><b>' + px + '</b></li>');
    }
    var opts = col.querySelectorAll('.prod-option-check');
    if (opts.length) {
      lignes.push('<li class="fa-sous">Options</li>');
      opts.forEach(function (o) {
        var t = texte(o), m = /(\+?\s*\d[\d\s,.]*\s*€|sur devis|offert|inclus)/i.exec(t);
        var nom = texte(o.querySelector('strong')) || (m ? t.replace(m[0], '').trim() : t);
        var px = m ? m[0].replace(/^\+\s*/, '').trim() : '';
        if (/^\d/.test(px)) px = '+ ' + px; else if (px) px = px.charAt(0).toUpperCase() + px.slice(1).toLowerCase();
        lignes.push('<li><span>' + nom + '</span><b>' + px + '</b></li>');
      });
    }
    zone.innerHTML = '<ul class="fa-tarifs">' + lignes.join('') + '</ul>' +
      '<p class="fa-note">Prix TTC pour la durée de location indiquée. Livraison et installation en supplément, selon la distance.</p>';
  }

  var desc = col.querySelector('.prod-short-desc'), feats = col.querySelector('.prod-features'), trust = col.querySelector('.prod-trust');
  if (!desc && !feats) return;
  var ancre = trust || (feats || desc).nextSibling;
  var bloc = document.createElement('div');
  bloc.className = 'fa-volets';
  bloc.appendChild(volet('desc', 'Description', [desc, feats], true));
  bloc.appendChild(volet('prix', 'Tarifs', '', false));
  bloc.appendChild(volet('livr', 'Livraison et retrait',
    '<p><b>Livraison et installation</b> sur le lieu de votre événement, où qu’il se trouve. Tarif selon la distance, précisé sur votre devis.</p>' +
    '<p><b>Retrait au dépôt de Vitré</b> sur rendez-vous, avec une démonstration du matériel.</p>' +
    '<p><b>Reprise</b> : nous pouvons venir récupérer le matériel le lendemain de l’événement.</p>', false));
  col.insertBefore(bloc, ancre && ancre.parentNode === col ? ancre : null);

  if (trust) {
    trust.classList.add('fa-rea');
    var cles = ['camion', 'outil', 'tel', 'paiement'];
    trust.querySelectorAll('.prod-trust-icon').forEach(function (s, i) {
      var t = texte(s.parentNode).toLowerCase();
      var k = /livr/.test(t) ? 'camion' : /install|montage/.test(t) ? 'outil' : /service|client|7j/.test(t) ? 'tel' : /virement|carte|paie|esp[eè]ce/.test(t) ? 'paiement' : (cles[i] || 'bouclier');
      s.innerHTML = ico(k);
    });
  }
})();
