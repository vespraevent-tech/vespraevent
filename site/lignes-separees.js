/* ─────────────────────────────────────────────────────────────
   Une ligne de devis par produit.

   Certaines fiches proposent « en plus » un produit qui existe aussi
   tout seul sur le site (une guirlande avec un barnum, un cornhole avec
   le baby-foot, un caisson de basse avec une sono…). Dans le devis et
   dans le panier, chacun doit avoir SA ligne, avec son prix : le client
   peut alors retirer l'un sans l'autre, et le détail est clair.

   Les vraies options — installation et démontage, éclairage néon,
   sacs de lestage, cadre photo, déguisement, sachet, maïs, couleurs —
   restent sur la ligne du produit auquel elles se rattachent.

   Le script s'intercale devant l'ajout au devis de la page : la page
   continue d'écrire son texte habituel (« Barnum + guirlande 10 m
   (9 €) »), et il est découpé ici en lignes séparées.
   ───────────────────────────────────────────────────────────── */
(function () {
  var TABLE = [
    [/^guirlande( lumineuse)? 10 ?m$/i, { id: 'p33', name: 'Guirlande lumineuse', label: '10 m', img: 'guirlande-lumineuse.webp' }],
    [/^guirlande( lumineuse)? 20 ?m$/i, { id: 'p33', name: 'Guirlande lumineuse', label: '20 m', img: 'guirlande-lumineuse.webp' }],
    [/^guirlande( lumineuse)? 40 ?m$/i, { id: 'p33', name: 'Guirlande lumineuse', label: '40 m', img: 'guirlande-lumineuse.webp' }],
    [/^guirlande( lumineuse)? 30 ?m$/i, { id: 'p33', name: 'Guirlande lumineuse', label: '30 m', img: 'guirlande-lumineuse.webp' }],
    [/^cornhole$/i, { id: 'p2', name: 'Jeux en bois', label: 'Cornhole', img: 'jeux-cornhole.webp' }],
    [/^palet breton$/i, { id: 'p2', name: 'Jeux en bois', label: 'Palet breton', img: 'jeux-palet-breton.webp' }],
    [/^puissance 4 géant$/i, { id: 'p2', name: 'Jeux en bois', label: 'Puissance 4 géant', img: 'jeux-puissance4.webp' }],
    [/^passe-trappe$/i, { id: 'p2', name: 'Jeux en bois', label: 'Passe-trappe', img: 'jeux-passe-trappe.webp' }],
    [/^cabine téléphonique (audio|vidéo|video)/i, { id: 'p46', name: 'Cabine téléphonique vidéo', img: 'cabine-telephonique-rouge.webp' }],
    [/^cabine téléphonique/i, { id: 'p31', name: 'Cabine téléphonique', img: 'cabine-decor-blanche.webp' }],
    [/^néon lumineux$/i, { id: 'p32', name: 'Néon lumineux', img: 'neon-lumineux.webp' }],
    [/^livre d['’]or audio$/i, { id: 'p10', name: "Livre d'or audio", img: 'telephone-vintage-2.webp' }],
    [/^micro shure sm58$/i, { id: 'p42', name: 'Micro Shure SM58', img: 'micro-shure-sm58.webp' }],
    [/^mange-debout( housse blanche)?$/i, { id: 'p45', name: 'Mange-debout housse blanche', img: 'mange-debout.webp' }],
    [/^spot led sur batterie$/i, { id: 'p43', name: 'Spot LED sur batterie', img: 'spot-led-batterie-ambiance.webp' }],
    [/^machine à fumée$/i, { id: 'p21', name: 'Machine à fumée', img: 'machine-fumee.webp' }],
    [/^caisson de basse$/i, { id: 'p16', name: 'Caisson de basse', label: 'Caisson de basse', img: 'caisson-basse.webp' }],
    [/^barnum 3\s*[×x]\s*3 m$/i, { id: 'p4', name: 'Barnum', label: 'Barnum 3×3 m', img: 'barnum.webp' }],
    [/^barnum 4\s*[×x]\s*6 m$/i, { id: 'p44', name: 'Barnum', label: 'Barnum 4×6 m', img: 'barnum-4x6.webp' }],
    [/^barnum 4\s*[×x]\s*8 m$/i, { id: 'p36', name: 'Barnum', label: 'Barnum 4×8 m', img: 'barnum.webp' }],
    [/^barnum 6\s*[×x]\s*10 m$/i, { id: 'p37', name: 'Barnum', label: 'Barnum 6×10 m', img: 'barnum.webp' }],
    [/^tente étoile (Ø )?22 m$/i, { id: 'p6', name: 'Tente étoile', label: 'Tente étoile Ø 22 m', img: 'tente-etoile.webp' }],
    [/^buvette 4 comptoirs$/i, { id: 'p5', name: 'Buvette Événementielle', label: 'Buvette 4×4 m', img: 'buvette.webp' }]
  ];
  var TOKEN = /^(.*?)\s*\(\s*([\d.,]+)\s*€\s*\)\s*$/;

  function connu(nom) {
    for (var i = 0; i < TABLE.length; i++) if (TABLE[i][0].test(nom)) return TABLE[i][1];
    return null;
  }

  /* découpe un texte « base + a (9 €) + b (20 €) » : renvoie le texte restant et les lignes à part */
  function decouper(texte, extras) {
    if (typeof texte !== 'string' || texte.indexOf(' + ') === -1) return texte;
    var morceaux = texte.split(/\s+\+\s+/), garde = [morceaux[0]];
    for (var i = 1; i < morceaux.length; i++) {
      var m = TOKEN.exec(morceaux[i]), p = null, qte = 1, nom = '';
      if (m) {
        nom = m[1].trim();
        var mq = /^(.*?)\s*[×x]\s*(\d+)$/.exec(nom);
        if (mq) { nom = mq[1].trim(); qte = parseInt(mq[2], 10) || 1; }
        p = connu(nom);
      }
      if (p) {
        var total = parseFloat(m[2].replace(',', '.'));
        extras.push({ def: p, qte: qte, unit: total / qte, total: total });
      } else garde.push(morceaux[i]);
    }
    return garde.join(' + ');
  }

  function eclater(item) {
    var extras = [];
    var copie = Object.assign({}, item);
    copie.name = decouper(item.name, extras);
    copie.label = decouper(item.label, extras);
    if (!extras.length) return [item];
    var somme = extras.reduce(function (t, e) { return t + e.total; }, 0);
    if (typeof copie.price === 'number') copie.price = Math.max(0, copie.price - somme);
    var lignes = [copie];
    extras.forEach(function (e) {
      var l = Object.assign({}, e.def, { price: e.unit });
      for (var k = 0; k < e.qte; k++) lignes.push(l);
    });
    return lignes;
  }

  function installer() {
    var vrai = window.addToCart;
    if (typeof vrai !== 'function' || vrai.__lignesSeparees) return;
    var neuf = function (item) {
      var lignes = item ? eclater(item) : [item], r;
      lignes.forEach(function (l) { r = vrai.call(window, l); });
      return r;
    };
    neuf.__lignesSeparees = true;
    window.addToCart = neuf;
  }
  window.VESPRA_LIGNES = { eclater: eclater };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installer); else installer();
  window.addEventListener('load', installer);
})();
