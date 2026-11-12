/* ─────────────────────────────────────────────────────────────
   Page Réservation : parcours en trois écrans.

   Écran 1  « Votre sélection »   ce qui a été pris, avec les quantités
   Écran 2  « Rien oublié ? »     facultatif, 4 idées liées à la sélection
   Écran 3  « Vos coordonnées »   le formulaire

   Un panneau marine reste visible à gauche : total du devis et avancée.
   Panier vide : on arrive directement sur le formulaire.

   Le script réorganise la page existante, il ne remplace aucune de ses
   fonctions : panier (_cart), formulaire, envoi, parrainage, calendrier
   restent ceux de la page. S'il ne s'exécute pas, la page fonctionne
   comme avant.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function demarrer() {
    var corps = document.querySelector('.page-body');
    var cart = document.getElementById('cartZone');
    var form = document.getElementById('formZone');
    if (!corps || !cart || !form || typeof _cart === 'undefined') return;

    /* ── données ──────────────────────────────────────────────── */
    /* Idées : « option » = se greffe sur un produit déjà choisi et ne
       compte pas comme un produit ; « produit » = ligne du devis qui
       compte pour le −10 %. */
    var IDEES = {
      cadre:  { type: 'option',  nom: 'Cadre photo personnalisable', sous: 'À vos couleurs', prix: 20,
                img: 'cadre-3.webp', hote: /photobooth/i, texte: 'Cadre photo personnalisable' },
      deguis: { type: 'option',  nom: 'Lot de déguisements', sous: 'Accessoires pour les photos', prix: 20,
                img: 'photobooth-2-t.webp', hote: /photobooth/i, texte: 'Lot de déguisement' },
      guir:   { type: 'produit', nom: 'Guirlande lumineuse 10 m', sous: 'Ambiance guinguette', prix: 9,
                img: 'guirlande-lumineuse-t.webp', id: 'guir', max: 10 },
      mange:  { type: 'produit', nom: 'Mange-debout', sous: 'Housse blanche', prix: 13,
                img: 'mange-debout-t.webp', id: 'md', max: 10 }
    };

    function qmax(it) {
      var n = String((it && it.name) || '').toLowerCase();
      if (it && (it.prestation || /^presta_/.test(String(it.id || '')))) return 1;
      if (/guirlande|mange-debout/.test(n)) return 10;
      if (/fontaine/.test(n)) return 4;
      if (/photobooth|cabine/.test(n)) return 4;
      if (/barnum|tente/.test(n)) return 2;
      if (/sonorisation|pack vespra|fum[ée]e/.test(n)) return 1;
      return 5;
    }

    /* ── outils ───────────────────────────────────────────────── */
    function $(s, r) { return (r || document).querySelector(s); }
    function vide() { try { return !_cart.length; } catch (e) { return true; } }
    function eur(n) { return Number(n || 0).toLocaleString('fr-FR') + ' €'; }
    function info() {
      try { return VESPRA_PACK.info(_cart); }
      catch (e) { return { n: 0, seuil: 5, actif: false, restant: 5, brut: 0, remise: 0, net: 0 }; }
    }
    function pluriel(n) { return n + ' produit' + (n > 1 ? 's' : ''); }
    function echap(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    /* ── styles ───────────────────────────────────────────────── */
    var st = document.createElement('style');
    st.textContent = [
      '#emptyZone,#catZone,#totalBlock,.cart-more,#csNudge,#csPack,#csRemise,.cs-total,.cs-title,.intent-block,#recoBar{display:none!important}',
      '.pc{--pcn:#2B4A6B;--pcd:#2B4A6B;--pco:#F59E0B;--pcv:#2FBF71}',
      '.pc[hidden]{display:none!important}',
      '.pc[data-e="idees"] #cartZone,.pc[data-e="coord"] #cartZone,.pc[data-v="1"] #cartZone{display:none!important}',
      '.pc:not([data-e="idees"]) #pcIdees{display:none}',
      '.pc:not([data-e="coord"]) #formZone{display:none!important}',
      '.page-body{max-width:1180px}',

      /* fil des trois étapes */
      '.pc-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:0 0 26px}',
      '.pc-steps.un{grid-template-columns:minmax(0,34%) 1fr}',
      '.pc-st{border:0;background:none;padding:0;text-align:left;font:inherit;color:#8892A2;cursor:default}',
      '.pc-st i{display:block;height:3px;border-radius:3px;background:#DDE2EA;margin-bottom:9px}',
      '.pc-st span{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;line-height:1.2}',
      '.pc-st em{font-style:normal;flex:none;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;background:#DDE2EA;color:#fff;font-size:10px;font-weight:700}',
      '.pc-st.ok{cursor:pointer;color:#4a5565}.pc-st.ok i{background:var(--pcn)}.pc-st.ok em{background:var(--pcn)}',
      '.pc-st.on{color:var(--black)}.pc-st.on i{background:var(--pco)}.pc-st.on em{background:var(--pco);color:#14253A}',

      /* mise en page */
      '.pc-grid{display:grid;grid-template-columns:minmax(300px,400px) minmax(0,1fr);gap:28px;align-items:start}',
      '.pc-main{min-width:0}',
      '.pc-panel{position:sticky;top:calc(var(--re-haut,66px) + 18px);background:var(--pcd);color:#fff;border-radius:26px;padding:28px 26px 26px}',
      '.pc-k{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#C3D1E3;margin:0 0 10px}',
      '.pc-panel h3{font-family:"Bebas Neue",sans-serif;font-weight:400;font-size:34px;line-height:1;letter-spacing:.01em;margin:0 0 20px;color:#fff}',
      '.pc-ul{list-style:none;margin:0 0 22px;padding:0}',
      '.pc-li{position:relative;display:flex;gap:13px;padding-bottom:13px;font-size:14px;line-height:1.35}',
      '.pc-li:last-child{padding-bottom:0}',
      '.pc-li::before{content:"";position:absolute;left:11px;top:25px;bottom:3px;width:2px;background:#5576A0}',
      '.pc-li:last-child::before{display:none}',
      '.pc-d{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;position:relative;z-index:1;border:2px solid #6D8CB3;color:#C3D1E3;background:var(--pcd)}',
      '.pc-li.ok .pc-d{background:var(--pcv);border-color:var(--pcv);color:#fff}',
      '.pc-li.num .pc-d{background:#456A97;border-color:#456A97;color:#fff}',
      '.pc-li.cur .pc-d{background:var(--pco);border-color:var(--pco);box-shadow:0 0 0 4px rgba(245,158,11,.25)}',
      '.pc-li b{display:block;font-weight:600;color:#fff}',
      '.pc-li small{display:block;font-size:12.5px;color:#C3D1E3;margin-top:1px}',
      '.pc-li b em{font-style:normal;font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C3D1E3;margin-left:6px}',
      '.pc-tot{font-family:"Bebas Neue",sans-serif;font-size:64px;line-height:1;margin:4px 0 8px;color:#fff;display:flex;align-items:baseline;flex-wrap:wrap;gap:0 12px}',
      '.pc-tot s{font-size:26px;color:#9FB4CE;text-decoration:line-through}',
      '.pc-tot small{font-family:Inter,sans-serif;font-size:13px;color:#C3D1E3;width:100%}',
      '.pc-s{font-size:13px;color:#D0DCEA;margin:0 0 10px;line-height:1.55}',
      '.pc-ret{background:none;border:0;padding:0;font:inherit;font-size:13.5px;color:#fff;text-decoration:underline;text-underline-offset:3px;cursor:pointer;display:block;margin:14px auto 0}',
      '.pc-cat{display:inline-block;margin-top:6px;background:#fff;color:var(--pcd);border-radius:999px;padding:11px 22px;font-size:14px;font-weight:700;text-decoration:none}',
      '.pc-cat:hover{background:#E9EEF5}',
      '.pc-mini{display:none}',
      '#pcMiniBas{display:none}',
      '.pc-panel.vide h3{font-size:30px}',
      '.pc-voir{display:none}',

      /* titres */
      '.pc-main .sec-tag{color:var(--pcn)}',
      '.pc-main .sec-h{font-size:clamp(34px,5vw,56px);margin-bottom:22px}',
      '.pc-it{font-family:Fraunces,Georgia,serif;font-style:italic;font-weight:400;text-transform:none;color:#9A4A12;letter-spacing:0}',
      '.pc-lead{font-size:15px;line-height:1.6;color:var(--g2);margin:-6px 0 22px;max-width:520px}',

      /* écran 1 */
      '.cart-layout{display:block;margin:0}',
      '.cart-summary{background:none;padding:0}',
      '.cs-head{display:flex;justify-content:flex-end;margin:-10px 0 10px}',
      '.cs-items{gap:12px;margin-bottom:6px}',
      '.cs-item{border:1px solid #E3E7EE;border-radius:18px;padding:12px 14px;gap:14px;background:#fff}',
      '.cs-item-img{width:76px;height:57px;border-radius:12px}',
      '.cs-item-name{font-size:15px}',
      '.pc-qty{display:inline-flex;align-items:center;border:1px solid #DDE2EA;border-radius:999px;flex:none}',
      '.pc-qty b{min-width:26px;text-align:center;font-size:14px;font-weight:600}',
      '.pc-qty button{border:0;background:none;width:30px;height:30px;border-radius:50%;font-size:17px;line-height:1;color:var(--pcn);cursor:pointer}',
      '.pc-qty button:hover:not(:disabled){background:var(--g4)}',
      '.pc-qty button:disabled{opacity:.3;cursor:not-allowed}',
      '.voir-place{margin-top:18px}',
      '.pc-nav{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:26px 0 4px;flex-wrap:wrap}',
      '.pc-nav.fin{justify-content:flex-end}',
      '.pc-btn{background:var(--pcn);color:#fff;border:0;border-radius:999px;padding:14px 32px;font:inherit;font-size:15px;font-weight:700;cursor:pointer;transition:background .2s}',
      '.pc-btn:hover{background:#1e3650}',
      '.pc-ghost{background:none;border:0;padding:8px 2px;font:inherit;font-size:14px;font-weight:600;color:var(--g2);cursor:pointer}',
      '.pc-ghost:hover{color:var(--pcn);text-decoration:underline}',

      /* écran 2 */
      '.pc-sug{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}',
      '.pc-card{border:1px solid #E3E7EE;border-radius:20px;overflow:hidden;background:#fff;display:flex;flex-direction:column}',
      '.pc-card img{width:100%;height:150px;object-fit:cover;background:var(--g4);display:block}',
      '.pc-cb{padding:14px 16px 4px;flex:1}',
      '.pc-tag{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;border-radius:999px;padding:3px 9px;margin-bottom:8px;background:#EEF2F7;color:var(--pcn)}',
      '.pc-tag.opt{background:#FEF3DC;color:#9A5B06}',
      '.pc-cb h3{font-size:16px;font-weight:700;margin:0 0 3px;color:var(--black)}',
      '.pc-cb p{font-size:13px;color:var(--g2);margin:0;line-height:1.45}',
      '.pc-cf{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px 16px}',
      '.pc-cf b{font-size:16px;color:var(--pcn)}',
      '.pc-add{border:1.5px solid var(--pcn);background:none;color:var(--pcn);border-radius:999px;padding:7px 18px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;transition:background .2s,color .2s}',
      '.pc-add:hover{background:var(--pcn);color:#fff}',
      '.pc-add.fait{background:var(--pcv);border-color:var(--pcv);color:#fff}',
      '.pc-rien{border:1px dashed #CBD2DD;border-radius:18px;padding:22px;color:var(--g2);font-size:14px;text-align:center;grid-column:1/-1}',

      /* fenêtre quantité */
      '.pc-pop{position:fixed;inset:0;z-index:500;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(12,15,20,.55)}',
      '.pc-pop.on{display:flex}',
      '.pc-pb{background:#fff;border-radius:24px;padding:28px 26px 24px;width:100%;max-width:360px;text-align:center;box-shadow:0 24px 70px rgba(12,15,20,.3)}',
      '.pc-pb h3{font-family:"Bebas Neue",sans-serif;font-weight:400;font-size:30px;margin:0 0 4px}',
      '.pc-pb p{margin:0 0 18px;font-size:14px;color:var(--g2)}',
      '.pc-pb .pc-qty{margin:0 auto 18px;transform:scale(1.25);transform-origin:center}',
      '.pc-pb .pc-btn{width:100%}',

      /* formulaire allégé */
      '#formZone .form-section{border-top:0;padding-top:0}',
      '#formZone .form-section-head{margin-bottom:22px}',
      '#formZone .res-form{max-width:none}',
      '#formZone .form-input,#formZone .form-select,#formZone .form-textarea{border:1px solid #D5DBE5;padding:12px 15px;border-radius:14px}',
      '#formZone .form-input:focus,#formZone .form-select:focus,#formZone .form-textarea:focus{border-color:var(--pcn)}',
      '#formZone .form-label{font-size:11px;letter-spacing:.1em}',
      '#formZone .qui-seg{display:grid;grid-template-columns:1fr 1fr;gap:0;width:100%;max-width:340px;padding:2px;background:#F3F5F9;border:1px solid #E3E7EE;border-radius:999px}',
      '#formZone .qui-seg::before{display:none}',
      '#formZone .qui-seg label{display:block;margin:0}',
      '#formZone .qui-seg span{display:grid;place-items:center;text-align:center;min-height:28px;padding:5px 8px;font-size:12px;line-height:1.2;border-radius:999px;color:var(--g2)}',
      '#formZone .qui-seg span::before,#formZone .qui-seg span::after{display:none}',
      '#formZone .qui-seg input:checked + span{background:var(--pcn);color:#fff;font-weight:600}',
      '#formZone .radio-row{gap:6px 24px}',
      '#formZone .radio-row .radio-opt{font-size:14px;color:var(--black)}',
      '#formZone .pa-fin .pa-champ{max-width:340px}',
      '#formZone .pa-fin .form-input{padding:8px 13px;font-size:13px;border-radius:999px}',
      '#formZone .pa-fin .form-input::placeholder{font-size:12px;letter-spacing:.02em;color:#A0A9B7;font-weight:400}',
      '#formZone .pa-fin .pa-btn{border:1px solid #CBD2DD;padding:7px 15px;font-size:12px;font-weight:600;letter-spacing:.02em;color:var(--pcn)}',
      '#formZone .pa-fin .pa-btn:hover:not(:disabled){background:#F3F5F9;color:var(--pcn)}',
      '#formZone #dateEvenement{font-size:13px;padding:9px 40px 9px 13px;border-radius:12px}',
      '#formZone #dateEvenement::placeholder{font-size:12px;letter-spacing:.02em}',
      '.dfr-wrap::after{width:16px!important;height:16px!important;margin-top:-8px!important;right:13px!important}',
      '#formZone .btn-submit{white-space:nowrap;padding:15px 28px;font-size:14px}',
      '#formZone .btn-submit:disabled{opacity:.45;cursor:not-allowed}',

      /* téléphone : une page courte, un seul récapitulatif compact */
      '.pc-seg{display:flex;gap:3px;width:100%}',
      '.pc-seg i{flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,.28)}',
      '.pc-seg i.on{background:var(--pco)}',
      '.pc-seg.full i{background:var(--pcv)}',
      '@media(max-width:900px){.pc-grid{grid-template-columns:1fr;gap:16px}.pc-panel{position:static}}',
      '@media(max-width:640px){',
      '  .res-hero{padding:14px 16px!important;border-radius:0 0 18px 18px!important}',
      '  .res-hero .back-btn,.res-hero-tag,.rea-bar{display:none!important}',
      '  .res-hero-h{font-size:26px!important;line-height:1!important}',
      '  .res-hero-h br{display:none}.res-hero-h em{margin-left:.3em}',
      '  .cart-summary,.cart-layout{background:none!important;padding:0!important}',
      '  #formZone .qui-seg span{font-size:12px;padding:6px 6px}',
      '  .page-body{padding:12px 16px 44px!important}',
      '  .pc-steps{gap:6px;margin:0 0 14px}',
      '  .pc-st i{height:3px;margin-bottom:6px}',
      '  .pc-st span{font-size:10.5px;gap:4px;white-space:nowrap}',
      '  .pc-st em{width:15px;height:15px;font-size:9px}',
      '  .pc-panel{padding:14px 16px;border-radius:18px}',
      '  .pc-panel .pc-k,.pc-panel h3,.pc-panel .pc-ul,.pc-panel .pc-tot,.pc-panel>.pc-s,.pc-panel .pc-ret{display:none}',
      '  .pc-mini{display:block}',
      '  .pc[data-e="sel"] #pcPanel{display:none}',
      '  .pc[data-e="sel"] #pcMiniBas{display:block;background:var(--pcd);color:#fff;border-radius:18px;padding:14px 16px;margin-top:14px}',
      '  .pc-mt{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:8px}',
      '  .pc-mt span{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#D0DCEA}',
      '  .pc-mt b{font-family:"Bebas Neue",sans-serif;font-weight:400;font-size:34px;line-height:1;color:#fff}',
      '  .pc-mt small{font-family:Inter,sans-serif;font-size:11px;color:#D0DCEA}',
      '  .pc-mp small{display:block;font-size:12px;color:#D0DCEA;margin-bottom:7px}',
      '  .pc-panel.vide{padding:16px}',
      '  .pc-panel.vide h3{display:block}',
      '  .pc-panel.vide .pc-k{display:none}',
      '  .pc-main .sec-tag{font-size:10px;margin-bottom:8px}',
      '  .pc-main .sec-h{font-size:32px;margin-bottom:14px}',
      '  .pc-lead{font-size:14px;margin:-4px 0 16px}',
      '  .pc-sug{grid-template-columns:1fr;gap:10px}',
      '  .pc-card{flex-direction:row;flex-wrap:wrap;border-radius:16px}.pc-card img{width:96px;height:auto;min-height:96px;flex:none}',
      '  .pc-cb{flex:1;min-width:0;padding:10px 12px 2px}.pc-cb h3{font-size:15px}.pc-cf{width:100%;padding:4px 12px 12px}',
      '  .cs-item{flex-wrap:wrap;border-radius:16px;padding:10px 12px;gap:10px}.cs-item-img{width:60px;height:46px}',
      '  .voir-place,.pc-qty,.cs-item-opts{display:none!important}',
      '  .cs-item{flex-wrap:nowrap}.cs-item-name{font-size:14.5px}',
      '  .pc-voir{display:inline-block;background:none;border:0;padding:0;margin:0 16px 8px 0;font:inherit;font-size:12.5px;color:#fff;text-decoration:underline;text-underline-offset:3px;cursor:pointer}',
      '  .pc-panel.vide .pc-vp{display:none}.pc-panel.vide.open .pc-vp{display:block}',
      '  .pc-panel.vide .pc-s{font-size:12px;margin:0 0 6px}',
      '  .pc-panel.vide h3{font-size:22px;margin:0 0 6px}',
      '  .pc-cat{padding:7px 15px;font-size:12px;margin-top:2px}',
      '  #formZone .btn-submit{padding:13px;font-size:14px}',
      '  .pc-nav{margin-top:18px}.pc-btn{padding:13px 26px}',
      '  #formZone .form-section-head{margin-bottom:14px}',
      '}'
    ].join('');
    document.head.appendChild(st);

    /* hauteur réelle de l'en-tête pour le panneau collant */
    function haut() {
      var nav = document.querySelector('.nav');
      document.documentElement.style.setProperty('--re-haut', (nav ? Math.round(nav.getBoundingClientRect().height) : 66) + 'px');
    }
    haut(); window.addEventListener('resize', haut);

    /* ── structure ────────────────────────────────────────────── */
    var coque = document.createElement('div');
    coque.className = 'pc';
    coque.innerHTML =
      '<div class="pc-steps" id="pcSteps"></div>' +
      '<div class="pc-grid"><aside class="pc-panel" id="pcPanel" aria-label="Récapitulatif du devis"></aside><div class="pc-main" id="pcMain"></div></div>';
    corps.insertBefore(coque, cart);
    var principal = $('#pcMain', coque);

    var idees = document.createElement('div');
    idees.id = 'pcIdees';
    idees.innerHTML =
      '<div class="sec-tag">Étape 2 sur 3 · facultatif</div>' +
      '<h2 class="sec-h">RIEN <span class="pc-it">oublié ?</span></h2>' +
      '<p class="pc-lead">Quelques idées en lien avec ce que vous avez choisi. Rien d\'obligatoire : vous pouvez passer directement à la suite.</p>' +
      '<div class="pc-sug" id="pcSug"></div>' +
      '<div class="pc-nav"><button type="button" class="pc-ghost" data-go="sel">← Retour</button>' +
      '<button type="button" class="pc-btn" data-go="coord">Suivant →</button></div>';
    principal.appendChild(cart);
    principal.appendChild(idees);
    principal.appendChild(form);

    /* titres des écrans 1 et 3 */
    var tag1 = $('.sec-tag', cart), h1 = $('.sec-h', cart);
    if (tag1) tag1.textContent = 'Étape 1 sur 3';
    if (h1) h1.innerHTML = 'VOTRE <span class="pc-it">sélection</span>';
    var nav1 = document.createElement('div');
    nav1.className = 'pc-nav fin';
    nav1.innerHTML = '<button type="button" class="pc-btn" data-go="idees">Suivant →</button>';
    var bas = document.createElement('div');
    bas.id = 'pcMiniBas';
    cart.appendChild(bas);
    cart.appendChild(nav1);

    var tag3 = $('.form-section-head .sec-tag', form), h3 = $('.form-section-head .sec-h', form);
    if (h3) h3.innerHTML = 'COMPLÉTEZ LE <span class="pc-it">formulaire</span>';

    /* ── la demande est toujours un devis : plus de choix à faire ── */
    var rDevis = form.querySelector('input[name="demande"][value="Devis / informations"]');
    var rDispo = form.querySelector('input[name="demande"][value^="Disponibilit"]');
    if (rDevis) { rDevis.checked = true; if (rDispo) rDispo.checked = false; }
    function libelleDate() {
      var l = document.getElementById('dateLabel');
      if (l) l.textContent = "Date de l'événement *";
    }
    var mq = window.matchMedia('(max-width:640px)');
    function texteEnvoi() {
      var b = document.getElementById('submitBtn');
      if (!b || /cours|rification/i.test(b.textContent)) return;
      b.textContent = mq.matches ? 'Envoyer' : 'Envoyer ma demande de devis';
    }
    var setIntentOrig = window.setIntent;
    window.setIntent = function () {
      if (typeof setIntentOrig === 'function') setIntentOrig.apply(this, arguments);
      libelleDate(); texteEnvoi();
    };
    if (rDevis && typeof setIntentOrig === 'function') setIntentOrig(rDevis);
    libelleDate(); texteEnvoi();
    if (mq.addEventListener) mq.addEventListener('change', texteEnvoi);

    /* ── bouton d'envoi actif seulement quand les deux cases sont cochées ── */
    var c1 = document.getElementById('savoirOk'), c2 = document.getElementById('savoirOk2');
    var envoi = document.getElementById('submitBtn');
    function gererEnvoi() {
      if (!envoi || !c1) return;
      var ok = c1.checked && (!c2 || c2.checked);
      envoi.disabled = !ok;
    }
    [c1, c2].forEach(function (c) { if (c) c.addEventListener('change', gererEnvoi); });
    gererEnvoi();

    /* ── état ─────────────────────────────────────────────────── */
    var ecran = 'sel';
    var atteint = 1;
    var liste = [];
    var ids = { sel: 1, idees: 2, coord: 3 };

    function nbEcrans() { return vide() ? 1 : 3; }

    function dessinerFil() {
      var f = $('#pcSteps');
      if (vide()) {
        f.className = 'pc-steps un';
        f.innerHTML = '<div class="pc-st on"><i></i><span><em>1</em>Vos coordonnées</span></div>';
        return;
      }
      f.className = 'pc-steps';
      var noms = [['sel', 'Votre sélection'], ['idees', 'À ne pas oublier'], ['coord', 'Vos coordonnées']];
      f.innerHTML = noms.map(function (x, i) {
        var n = i + 1, c = ids[ecran], cl = n === c ? 'on' : (n < c || n <= atteint && n < c ? 'ok' : '');
        if (n < c) cl = 'ok';
        return '<' + (cl === 'ok' ? 'button type="button" data-go="' + x[0] + '"' : 'div') + ' class="pc-st ' + cl + '"><i></i><span><em>' +
          (cl === 'ok' ? '✓' : n) + '</em>' + x[1] + '</span></' + (cl === 'ok' ? 'button' : 'div') + '>';
      }).join('');
    }

    function etapeLi(cl, pastille, titre, sous, extra) {
      return '<li class="pc-li ' + cl + '"><span class="pc-d">' + pastille + '</span><span><b>' + titre + (extra ? '<em>' + extra + '</em>' : '') + '</b>' +
        (sous ? '<small>' + sous + '</small>' : '') + '</span></li>';
    }
    var COCHE = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.4 5 8.9l4.5-5.3"/></svg>';

    function dessinerPanneau() {
      var p = $('#pcPanel');
      if (vide()) {
        p.className = 'pc-panel vide';
        p.innerHTML = '<p class="pc-k">Total du devis</p><h3>Votre devis est vide</h3>' +
          '<ul class="pc-ul">' +
          etapeLi('cur', '', 'Remplir vos coordonnées', '') +
          etapeLi('', '', 'Envoi du devis', 'Réponse sous 24 h') + '</ul>' +
          '<div class="pc-vp"><p class="pc-s">Vous pouvez envoyer votre demande avec un devis vide. Précisez dans la case « Message » le matériel que vous souhaitez.</p>' +
          '<p class="pc-s">Vous souhaitez connaître les prix ? Rendez-vous sur notre catalogue et ajoutez le matériel qui vous plaît à votre devis.</p></div>' +
          '<button type="button" class="pc-voir" aria-expanded="false">Voir plus</button>' +
          '<a class="pc-cat" href="catalogue.html">Voir le catalogue</a>';
        return;
      }
      var e = ids[ecran], i = info(), devis = _cart.some(function (x) { return x.devis; });
      var remise = i.actif
        ? etapeLi('ok', COCHE, '−10 % obtenu', pluriel(i.n) + ' · remise de ' + eur(i.remise))
        : etapeLi('num', i.n, '−10 % dès ' + i.seuil + ' produits', pluriel(i.n) + ' sur ' + i.seuil + ' · encore ' + i.restant + ' pour −10 %');
      var seg = ''; for (var q = 0; q < i.seuil; q++) seg += '<i' + (q < i.n ? ' class="on"' : '') + '></i>';
      var mini = '<div class="pc-mini"><div class="pc-mt"><span>Total du devis</span><b>' + eur(i.net) + (devis ? ' <small>+ sur devis</small>' : '') + '</b></div>' +
        '<div class="pc-mp"><small>' + (i.actif ? '−10\u00a0% obtenu' : pluriel(i.n) + ' · encore ' + i.restant + ' pour −10\u00a0%') + '</small><span class="pc-seg' + (i.actif ? ' full' : '') + '">' + seg + '</span></div></div>';
      var bs = $('#pcMiniBas'); if (bs) bs.innerHTML = mini;
      p.className = 'pc-panel';
      p.innerHTML = mini + '<p class="pc-k">Total du devis</p><h3>Votre parcours</h3><ul class="pc-ul">' +
        etapeLi(e === 1 ? 'cur' : 'ok', e === 1 ? '' : COCHE, 'Sélection validée', e === 1 ? '' : 'Votre panier est prêt') +
        remise +
        etapeLi(e === 2 ? 'cur' : (e > 2 ? 'ok' : ''), e > 2 ? COCHE : '', 'Rien oublié ?', e > 2 ? 'Vérifié' : '', 'facultatif') +
        etapeLi(e === 3 ? 'cur' : '', '', 'Remplir vos coordonnées', '') +
        etapeLi('', '', 'Envoi du devis', 'Réponse sous 24 h') + '</ul>' +
        '<div class="pc-tot">' + (i.remise ? '<s>' + eur(i.brut) + '</s>' : '') + eur(i.net) +
        (devis ? '<small>+ éléments sur devis</small>' : '') + '</div>' +
        '<p class="pc-s">' + pluriel(i.n) + ' · devis gratuit, sans engagement</p>' +
        (e === 3 ? '<p class="pc-s">Le bouton d\'envoi se trouve en bas du formulaire.</p><button type="button" class="pc-ret" data-go="idees">← Retour</button>' : '');
    }

    function majTitres() {
      var v = vide();
      if (tag3) tag3.textContent = v ? 'Vos coordonnées' : 'Étape 3 sur 3';
    }

    function maj() {
      coque.setAttribute('data-v', vide() ? '1' : '0');
      if (vide() && ecran !== 'coord') ecran = 'coord';
      coque.setAttribute('data-e', ecran);
      majTitres();
      dessinerFil();
      dessinerPanneau();
    }

    function aller(cible, sansDefiler) {
      if (vide()) cible = 'coord';
      if (cible === 'idees') calculerIdees();
      ecran = cible;
      if (ids[cible] > atteint) atteint = ids[cible];
      maj();
      if (cible === 'idees') dessinerIdees();
      if (!sansDefiler) {
        var haute = coque.getBoundingClientRect().top + window.pageYOffset - ((parseInt(getComputedStyle(document.documentElement).getPropertyValue('--re-haut')) || 66) + 10);
        window.scrollTo({ top: Math.max(0, haute), behavior: 'smooth' });
      }
    }

    coque.addEventListener('click', function (ev) {
      var vp = ev.target.closest('.pc-voir');
      if (vp) {
        var ouvert = $('#pcPanel').classList.toggle('open');
        vp.textContent = ouvert ? 'Voir moins' : 'Voir plus';
        vp.setAttribute('aria-expanded', ouvert);
        return;
      }
      var b = ev.target.closest('[data-go]');
      if (b) { ev.preventDefault(); aller(b.getAttribute('data-go')); }
    });
    /* « Remplir directement le formulaire » et autres liens vers le formulaire */
    document.addEventListener('click', function (ev) {
      var a = ev.target.closest('a[href="#formZone"]');
      if (a) { ev.preventDefault(); aller('coord'); }
    });

    /* ── écran 1 : quantités ──────────────────────────────────── */
    function decorer() {
      var lignes = document.querySelectorAll('#csItems .cs-item');
      Array.prototype.forEach.call(lignes, function (el, i) {
        if (el.querySelector('.pc-qty') || !_cart[i]) return;
        var q = _cart[i].qty || 1, mx = qmax(_cart[i]);
        var box = document.createElement('div');
        box.className = 'pc-qty';
        box.innerHTML = '<button type="button" data-q="-1" data-i="' + i + '" aria-label="Moins"' + (q <= 1 ? ' disabled' : '') + '>−</button><b>' + q + '</b>' +
          '<button type="button" data-q="1" data-i="' + i + '" aria-label="Plus"' + (q >= mx ? ' disabled' : '') + '>+</button>';
        var prix = el.querySelector('.cs-item-price');
        el.insertBefore(box, prix);
      });
    }
    var zoneItems = document.getElementById('csItems');
    if (zoneItems) zoneItems.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-q]');
      if (!b) return;
      ev.preventDefault();
      var i = +b.getAttribute('data-i'), it = _cart[i];
      if (!it) return;
      var q = Math.max(1, Math.min(qmax(it), (it.qty || 1) + (+b.getAttribute('data-q'))));
      if (q === (it.qty || 1)) return;
      it.qty = q;
      persistCart();
      renderCartItems();
    });

    /* le panier se redessine à chaque changement : on suit */
    var rciOrig = window.renderCartItems;
    window.renderCartItems = function () {
      var r = rciOrig.apply(this, arguments);
      try { decorer(); maj(); if (ecran === 'idees') dessinerIdees(); } catch (e) { console.error('[parcours]', e); }
      return r;
    };

    /* ── écran 2 : idées ──────────────────────────────────────── */
    function aHote(re) { return _cart.some(function (x) { return re.test(String(x.name || '')); }); }
    function dansPanier(re) { return _cart.some(function (x) { return re.test(String(x.name || '') + ' ' + String(x.label || '') + ' ' + JSON.stringify(x.options || '')); }); }
    function optionPosee(k) {
      var d = IDEES[k], re = new RegExp(d.texte.replace(/[éè]/g, '[ée]'), 'i');
      return _cart.some(function (x) { return d.hote.test(String(x.name || '')) && re.test(String(x.label || '') + ' ' + JSON.stringify(x.options || '')); });
    }
    function produitPose(k) {
      var d = IDEES[k];
      return _cart.some(function (x) { return String(x.id || '').split('_')[0] === d.id; });
    }
    function pose(k) { return IDEES[k].type === 'option' ? optionPosee(k) : produitPose(k); }

    function calculerIdees() {
      var sortie = [];
      if (aHote(/photobooth/i)) { sortie.push('cadre', 'deguis'); }
      if (aHote(/barnum|tente/i)) { sortie.push('guir', 'mange'); }
      if (aHote(/cocktail|vin d'honneur/i)) { sortie.push('mange'); }
      /* complète avec des produits de la page (avec leurs variantes/options) */
      var base = sortie.filter(function (k, i) { return sortie.indexOf(k) === i; });
      var reste = [];
      try {
        reste = buildRecos().map(function (p) { return 'r:' + p.id; });
      } catch (e) {}
      if (base.indexOf('mange') < 0) base.push('mange');
      /* idées déjà posées avant l'écran : on ne les repropose pas */
      base = base.filter(function (k) { return !pose(k); });
      liste = base.concat(reste).slice(0, 4);
    }

    function carte(cle) {
      if (cle.indexOf('r:') === 0) {
        var id = cle.slice(2), p = null;
        try { p = recoProduits().find(function (x) { return x.id === id; }) || ALL_PRODUCTS.find(function (x) { return x.id === id; }); } catch (e) {}
        if (!p) return '';
        var pv = (p.variants || []).filter(function (v) { return !v.devis && typeof v.price === 'number'; }).map(function (v) { return v.price; });
        var de = pv.length ? Math.min.apply(null, pv) : p.price;
        var deja = _cart.some(function (x) { return String(x.id || '').split('_')[0] === p.id; }) ||
                   (p.membres && p.membres.some(function (m) { return _cart.some(function (x) { return String(x.id || '').split('_')[0] === m; }); }));
        return '<article class="pc-card"><img src="' + echap(p.img) + '" alt="" loading="lazy">' +
          '<div class="pc-cb"><span class="pc-tag">Produit en plus</span><h3>' + echap(String(p.name).split(' — ')[0]) + '</h3><p>' + echap(p.desc ? String(p.desc).slice(0, 70) : '') + '</p></div>' +
          '<div class="pc-cf"><b>' + (pv.length ? 'dès ' : '') + de + ' €</b>' +
          '<button type="button" class="pc-add' + (deja ? ' fait' : '') + '" data-reco="' + echap(p.id) + '">' + (deja ? '✓ Ajouté' : 'Ajouter') + '</button></div></article>';
      }
      var d = IDEES[cle], deja2 = pose(cle);
      return '<article class="pc-card"><img src="' + d.img + '" alt="" loading="lazy">' +
        '<div class="pc-cb"><span class="pc-tag' + (d.type === 'option' ? ' opt' : '') + '">' + (d.type === 'option' ? 'Option' : 'Produit en plus') + '</span><h3>' + d.nom + '</h3><p>' + d.sous + '</p></div>' +
        '<div class="pc-cf"><b>+ ' + d.prix + ' €</b><button type="button" class="pc-add' + (deja2 ? ' fait' : '') + '" data-idee="' + cle + '">' + (deja2 ? '✓ Ajouté' : 'Ajouter') + '</button></div></article>';
    }

    function dessinerIdees() {
      var z = $('#pcSug');
      if (!z) return;
      z.innerHTML = liste.length ? liste.map(carte).join('') :
        '<div class="pc-rien">Vous avez déjà pensé à tout. Passez à la suite pour envoyer votre demande.</div>';
    }

    /* option : se greffe sur le produit hôte, ne compte pas comme produit */
    function poserOption(k) {
      var d = IDEES[k], hote = null;
      _cart.forEach(function (x) { if (!hote && d.hote.test(String(x.name || ''))) hote = x; });
      if (!hote) return;
      var txt = '+ ' + d.texte + ' (+' + d.prix + ' €)';
      if (Array.isArray(hote.options)) hote.options.push(txt);
      else if (hote.options) hote.options = [String(hote.options), txt];
      else if (hote.label) hote.label = hote.label + ' ' + txt;
      else hote.options = [txt];
      hote.price = (Number(hote.price) || 0) + d.prix;
      persistCart();
      renderCartItems();
      try { showToast('✓ ' + d.nom + ' ajouté'); } catch (e) {}
    }
    function retirerOption(k) {
      var d = IDEES[k], txt = '+ ' + d.texte + ' (+' + d.prix + ' €)';
      _cart.forEach(function (x) {
        if (!d.hote.test(String(x.name || ''))) return;
        var avant = x.price;
        if (Array.isArray(x.options) && x.options.indexOf(txt) >= 0) {
          x.options = x.options.filter(function (o) { return o !== txt; });
          x.price = Math.max(0, (Number(x.price) || 0) - d.prix);
        } else if (x.label && x.label.indexOf(txt) >= 0) {
          x.label = x.label.replace(' ' + txt, '').replace(txt, '');
          x.price = Math.max(0, (Number(x.price) || 0) - d.prix);
        }
        if (x.price !== avant) return;
      });
      persistCart();
      renderCartItems();
    }
    function retirerProduit(k) {
      var d = IDEES[k];
      for (var i = _cart.length - 1; i >= 0; i--) {
        if (String(_cart[i].id || '').split('_')[0] === d.id) { removeCartItem(i); return; }
      }
    }

    /* fenêtre « vous en voulez combien ? » */
    var pop = document.createElement('div');
    pop.className = 'pc-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'true');
    document.body.appendChild(pop);
    var popQ = 1, popK = null;
    function dessinerPop() {
      var d = IDEES[popK];
      pop.innerHTML = '<div class="pc-pb"><h3>' + d.nom + '</h3><p>Vous en voulez combien ?</p>' +
        '<div class="pc-qty"><button type="button" data-pq="-1"' + (popQ <= 1 ? ' disabled' : '') + ' aria-label="Moins">−</button><b>' + popQ + '</b>' +
        '<button type="button" data-pq="1"' + (popQ >= d.max ? ' disabled' : '') + ' aria-label="Plus">+</button></div>' +
        '<button type="button" class="pc-btn" data-pok>Ajouter au devis · ' + eur(d.prix * popQ) + '</button>' +
        '<button type="button" class="pc-ghost" data-pno style="margin-top:6px">Annuler</button></div>';
    }
    function ouvrirPop(k) { popK = k; popQ = 1; dessinerPop(); pop.classList.add('on'); }
    function fermerPop() { pop.classList.remove('on'); popK = null; }
    pop.addEventListener('click', function (ev) {
      if (ev.target === pop || ev.target.closest('[data-pno]')) { fermerPop(); return; }
      var q = ev.target.closest('[data-pq]');
      if (q) { popQ = Math.max(1, Math.min(IDEES[popK].max, popQ + (+q.getAttribute('data-pq')))); dessinerPop(); return; }
      if (ev.target.closest('[data-pok]')) {
        var d = IDEES[popK], k = popK, n = popQ;
        fermerPop();
        var p = ALL_PRODUCTS.find(function (x) { return x.id === d.id; });
        if (!p) return;
        commitExtra(p, null, []);
        _cart[_cart.length - 1].qty = n;
        persistCart();
        renderCartItems();
      }
    });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') fermerPop(); });

    idees.addEventListener('click', function (ev) {
      var b = ev.target.closest('.pc-add');
      if (!b) return;
      ev.preventDefault();
      var k = b.getAttribute('data-idee'), r = b.getAttribute('data-reco');
      if (k) {
        var d = IDEES[k];
        if (pose(k)) { d.type === 'option' ? retirerOption(k) : retirerProduit(k); return; }
        if (d.type === 'option') poserOption(k);
        else if (d.max > 1) ouvrirPop(k);
        else { var p = ALL_PRODUCTS.find(function (x) { return x.id === d.id; }); if (p) { commitExtra(p, null, []); } }
      } else if (r) {
        if (b.classList.contains('fait')) return;
        addExtra(r);
      }
    });
    /* produit complété par la fenêtre d'options de la page : on redessine les cartes */
    var cb = window.commitExtra;
    if (typeof cb === 'function') {
      window.commitExtra = function () {
        var r = cb.apply(this, arguments);
        try { if (ecran === 'idees') dessinerIdees(); } catch (e) {}
        return r;
      };
    }

    /* ── envoi réussi : on ne garde que la confirmation ───────── */
    var succes = document.getElementById('successCard');
    if (succes) new MutationObserver(function () {
      if (succes.classList.contains('on')) coque.hidden = true;
    }).observe(succes, { attributes: true, attributeFilter: ['class'] });

    /* ── démarrage ────────────────────────────────────────────── */
    decorer();
    maj();
    /* le panier peut être lu après ce script : on se recale */
    window.addEventListener('load', function () { decorer(); maj(); });
    setTimeout(function () { decorer(); maj(); }, 900);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
