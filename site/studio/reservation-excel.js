/* ─────────────────────────────────────────────────────────────
   Lecture du classeur « Planning location.xlsx » depuis le navigateur.

   Vous modifiez votre fichier Excel comme d'habitude, puis, sur le
   planning du back-office, vous cliquez sur « Mettre à jour via Excel »
   et vous choisissez le fichier. Le classeur est lu ici même, dans la
   page : il n'est envoyé sur aucun serveur, et le fichier d'origine
   n'est pas modifié.

   Ce fichier fait deux choses :
     1. lire un .xlsx (c'est une archive zip contenant du XML) sans
        bibliothèque extérieure — le navigateur sait décompresser ;
     2. transformer les lignes des feuilles « Planning 20xx » en
        réservations du planning, avec exactement les mêmes règles que la
        reprise d'origine : même identifiant par client et par date, même
        correspondance des produits, et surtout le total de la ligne du
        classeur fait toujours foi pour le montant.

   Le résultat est remis à reservation-import.js, qui l'applique au
   planning et à la liste des réservations.
   ───────────────────────────────────────────────────────────── */
(function () {
  /* ═══ 1. Lecture de l'archive .xlsx ═══════════════════════════ */

  /* Un .xlsx est une archive zip. On lit son sommaire (« central
     directory ») puis on décompresse les seuls fichiers utiles. */
  function fichiersDuZip(buffer) {
    var vue = new DataView(buffer);
    var oct = new Uint8Array(buffer);

    /* le sommaire est à la fin : on remonte jusqu'à sa signature */
    var fin = -1;
    for (var i = oct.length - 22; i >= 0 && i > oct.length - 66000; i--) {
      if (vue.getUint32(i, true) === 0x06054b50) { fin = i; break; }
    }
    if (fin < 0) throw new Error('Ce fichier n\'est pas un .xlsx');

    var nb = vue.getUint16(fin + 10, true);
    var pos = vue.getUint32(fin + 16, true);
    var entrees = [];
    for (var n = 0; n < nb; n++) {
      if (vue.getUint32(pos, true) !== 0x02014b50) break;
      var methode = vue.getUint16(pos + 10, true);
      var taille = vue.getUint32(pos + 20, true);
      var lnom = vue.getUint16(pos + 28, true);
      var lextra = vue.getUint16(pos + 30, true);
      var lcom = vue.getUint16(pos + 32, true);
      var local = vue.getUint32(pos + 42, true);
      var nom = new TextDecoder().decode(oct.subarray(pos + 46, pos + 46 + lnom));
      entrees.push({ nom: nom, methode: methode, taille: taille, local: local });
      pos += 46 + lnom + lextra + lcom;
    }

    /* le contenu commence après l'en-tête local, dont la longueur varie */
    function contenu(e) {
      var l1 = vue.getUint16(e.local + 26, true);
      var l2 = vue.getUint16(e.local + 28, true);
      var debut = e.local + 30 + l1 + l2;
      var brut = oct.subarray(debut, debut + e.taille);
      if (e.methode === 0) return Promise.resolve(new TextDecoder().decode(brut));
      if (e.methode !== 8) return Promise.reject(new Error('Compression du fichier non reconnue'));
      if (typeof DecompressionStream !== 'function') {
        return Promise.reject(new Error('Navigateur trop ancien pour lire le .xlsx'));
      }
      var flux = new Blob([brut]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(flux).text();
    }

    var par = {};
    entrees.forEach(function (e) { par[e.nom] = e; });
    return {
      existe: function (nom) { return !!par[nom]; },
      texte: function (nom) {
        if (!par[nom]) return Promise.resolve('');
        return contenu(par[nom]);
      },
    };
  }

  function xml(texte) {
    return new DOMParser().parseFromString(texte, 'application/xml');
  }

  /* colonne « BC12 » → index 54 */
  function colonne(ref) {
    var n = 0;
    for (var i = 0; i < ref.length; i++) {
      var c = ref.charCodeAt(i);
      if (c < 65 || c > 90) break;
      n = n * 26 + (c - 64);
    }
    return n - 1;
  }

  /* numéro de série Excel → date (le classeur part du 30/12/1899) */
  function dateExcel(n) {
    var ms = Math.round((n - 25569) * 86400000);
    var d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  /* Lit une feuille : rend un tableau de lignes, chaque ligne étant un
     tableau de valeurs (texte, nombre ou date). */
  function lireFeuille(doc, chaines) {
    var lignes = [];
    var rows = doc.getElementsByTagName('row');
    for (var i = 0; i < rows.length; i++) {
      var numero = parseInt(rows[i].getAttribute('r') || (i + 1), 10) - 1;
      var cells = rows[i].getElementsByTagName('c');
      var ligne = [];
      for (var j = 0; j < cells.length; j++) {
        var c = cells[j];
        var idx = colonne(c.getAttribute('r') || '');
        if (idx < 0) idx = j;
        var t = c.getAttribute('t');
        var valeur = null;
        if (t === 'inlineStr') {
          var is = c.getElementsByTagName('t');
          var s = '';
          for (var k = 0; k < is.length; k++) s += is[k].textContent;
          valeur = s;
        } else {
          var v = c.getElementsByTagName('v')[0];
          /* Une case qui contient une formule sans résultat enregistré :
             certains outils réenregistrent le classeur sans recalculer.
             On ne devine pas le montant — la case est marquée, et la
             réservation gardera le prix déjà inscrit au planning. */
          var brutV = v ? v.textContent : '';
          if (brutV === '' && c.getElementsByTagName('f').length) valeur = { formuleSansResultat: true };
          else if (v) {
            if (t === 's') valeur = chaines[parseInt(brutV, 10)] || '';
            else if (t === 'str') valeur = brutV;
            else if (t === 'b') valeur = brutV === '1';
            else {
              var nb = parseFloat(brutV);
              valeur = isNaN(nb) ? brutV : nb;
            }
          }
        }
        ligne[idx] = valeur;
      }
      lignes[numero] = ligne;
    }
    for (var m = 0; m < lignes.length; m++) if (!lignes[m]) lignes[m] = [];
    return lignes;
  }

  /* Ouvre le classeur et rend { nomDeFeuille: lignes } */
  function lireClasseur(buffer) {
    var zip = fichiersDuZip(buffer);
    var chaines = [];
    return zip.texte('xl/sharedStrings.xml')
      .then(function (txt) {
        if (txt) {
          var d = xml(txt);
          var sis = d.getElementsByTagName('si');
          for (var i = 0; i < sis.length; i++) {
            var ts = sis[i].getElementsByTagName('t');
            var s = '';
            for (var j = 0; j < ts.length; j++) s += ts[j].textContent;
            chaines.push(s);
          }
        }
        return Promise.all([zip.texte('xl/workbook.xml'), zip.texte('xl/_rels/workbook.xml.rels')]);
      })
      .then(function (deux) {
        var wb = xml(deux[0]);
        var rels = xml(deux[1]);
        var cibles = {};
        var rs = rels.getElementsByTagName('Relationship');
        for (var i = 0; i < rs.length; i++) {
          var cible = rs[i].getAttribute('Target') || '';
          cibles[rs[i].getAttribute('Id')] = cible.indexOf('/') === 0
            ? cible.slice(1)
            : 'xl/' + cible.replace(/^\.\//, '');
        }
        var feuilles = [];
        var sh = wb.getElementsByTagName('sheet');
        for (var j = 0; j < sh.length; j++) {
          var rid = sh[j].getAttribute('r:id') || sh[j].getAttributeNS
            && sh[j].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
          feuilles.push({ nom: sh[j].getAttribute('name') || '', chemin: cibles[rid] });
        }
        return Promise.all(feuilles.map(function (f) {
          if (!f.chemin || !zip.existe(f.chemin)) return Promise.resolve(null);
          return zip.texte(f.chemin).then(function (txt) {
            return { nom: f.nom, lignes: lireFeuille(xml(txt), chaines) };
          });
        }));
      })
      .then(function (liste) {
        var out = {};
        liste.forEach(function (f) { if (f) out[f.nom] = f.lignes; });
        return out;
      });
  }

  /* ═══ 2. Du classeur aux réservations ═════════════════════════ */

  var PB_VAR = {
    'Photobooth - 200 tirages': '200 tirages',
    'Photobooth - 300 tirages': '300 tirages',
    'Photobooth - 400 tirages': '400 tirages',
    'Photobooth - Digital': 'Numérique',
    'Photobooth - Illimitées': 'Illimité',
    'Photobooth - Personnalisé': 'Personnalisé',
  };
  var PBP = { '200 tirages': 190, '300 tirages': 235, '400 tirages': 290, 'Numérique': 130, 'Illimité': 420, 'Personnalisé': null };

  var MAP = {
    'Option cadre photo': ['Cadre photo', 'photobooth', 20, 'Standard', 'Cadre photo'],
    'Option déguisement': ['Déguisement', 'photobooth', 20, 'Standard', 'Déguisement'],
    'Pack Vespra 60 personnes': ['Pack Vespra 60 personnes', 'sono', 60, '60 personnes', 'Pack 60'],
    'Pack Vespra 100 personnes': ['Pack Vespra 100 personnes', 'sono', 70, '100 personnes', 'Pack 100'],
    'Pack Vespra 150 personnes': ['Pack Vespra 150 personnes', 'sono', 110, '150 personnes', 'Pack 150'],
    'Sono 40/60 personnes': ['Sono 40/60 personnes', 'sono', 30, '40 personnes', 'Sono 40/60'],
    'Sono 80/100 personnes': ['Sono 80/100 personnes', 'sono', 40, '80 personnes', 'Sono 80/100'],
    'Jeux de lumières Eurolite': ['Jeux de lumières Eurolite', 'lumieres', 30, 'Standard', 'Eurolite'],
    'Jeux de lumières Ibiza': ['Jeux de lumières Ibiza 4 spots', 'lumieres', 20, '4 spots', 'Ibiza 4 spots'],
    'Boules à facettes - 40CM': ['Boule à facettes', 'lumieres', 35, 'Standard', 'Boule facettes'],
    'Machine à fumée': ['Machine à fumée', 'lumieres', 10, 'Standard', 'Fumée'],
    'Barnum 6x10m': ['Barnum 6x10m', 'barnum', 165, '6x10m', 'Barnum 6x10'],
    'Tente étoile': ['Tente étoile 22m', 'barnum', 590, '22m', 'Tente étoile'],
    'Brasero': ['Brasero', 'restauration', 100, 'Standard', 'Brasero'],
    'Machine popcorn avec mais': ['Machine à pop-corn', 'restauration', 30, 'Avec maïs', 'Pop-corn'],
    'Machine popcorn sans mais': ['Machine à pop-corn', 'restauration', 20, 'Sans maïs', 'Pop-corn'],
    'Shampouineuse': ['Shampouineuse', 'animation', 15, 'Standard', 'Shampouineuse'],
    'Vidéoprojecteur': ['Vidéoprojecteur', 'sono', 10, 'Seul', 'Vidéoproj.'],
    'Vidéoprojecteur + Ecran': ['Vidéoprojecteur', 'sono', 20, 'Avec écran', 'Vidéoproj. + écran'],
    "Livre d'or audio": ["Livre d'or audio", 'animation', 35, 'Standard', "Livre d'or"],

    /* ── Anciens libellés du classeur ───────────────────────────
       Un produit peut changer de nom sans que le classeur Excel soit
       repris ligne par ligne : les réservations déjà signées gardent
       l'ancien libellé. On le reconnaît ici et on l'associe au produit
       actuel, MAIS AU PRIX DE L'ÉPOQUE.

       Les canons à poudre sont devenus « Feux d'artifice de jour » et
       la grille est passée de 120 € à 179 € pour 4 canons. Une
       réservation prise avant le changement reste facturée 120 €,
       même si l'événement a lieu dans un an : c'est le prix annoncé au
       client. Seules les réservations saisies à la main dans le
       back-office ou reçues par le site prennent la grille actuelle.
       ───────────────────────────────────────────────────────── */
    'Canons à poudre': ["Feux d'artifice de jour", 'animation', 120, '4 canons', 'Feux de jour'],
    'Canon à poudre': ["Feux d'artifice de jour", 'animation', 120, '4 canons', 'Feux de jour'],
    'Canons à poudre électriques': ["Feux d'artifice de jour", 'animation', 120, '4 canons', 'Feux de jour'],
    'Canons poudre': ["Feux d'artifice de jour", 'animation', 120, '4 canons', 'Feux de jour'],
  };

  /* Reconnaissance souple des anciens libellés : le classeur peut
     écrire « Canons à poudre », « canon a poudre » ou « Canons à
     poudre - 4 ». On compare sans accents ni majuscules, et on garde
     le prix d'origine. */
  var ANCIENS = [
    { motif: /canons?\s*(a|à)?\s*poudre/i,
      produit: ["Feux d'artifice de jour", 'animation', 120, '4 canons', 'Feux de jour'] },
  ];

  function ancienLibelle(lib) {
    for (var i = 0; i < ANCIENS.length; i++) {
      if (ANCIENS[i].motif.test(lib)) return ANCIENS[i].produit;
    }
    return null;
  }

  function slug(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function tel(v) {
    if (v === null || v === undefined || v === '') return '';
    var d = String(v).replace(/\D/g, '');
    if (d.length === 9) d = '0' + d;
    if (d.length === 11 && d.indexOf('33') === 0) d = '0' + d.slice(2);
    if (d.length === 10) return d.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
    return d.length < 6 ? '' : String(v).trim();
  }

  function texte(v) {
    if (v === null || v === undefined || typeof v === 'object') return '';
    return String(v).trim();
  }

  function nombre(v) {
    if (v === null || v === undefined || v === '' || typeof v === 'object') return null;
    if (typeof v === 'number') return v;
    var n = parseFloat(String(v).replace(',', '.').replace(/[^\d.\-]/g, ''));
    return isNaN(n) ? null : n;
  }

  function convertir(feuilles) {
    var resas = [];
    var annees = [];
    var inconnus = {};

    Object.keys(feuilles).forEach(function (nomFeuille) {
      if (!/^Planning\s+\d{4}$/.test(nomFeuille.trim())) return;
      var an = nomFeuille.trim().slice(-4);
      if (annees.indexOf(an) === -1) annees.push(an);

      var lignes = feuilles[nomFeuille];
      var entete = (lignes[0] || []).map(function (x) { return texte(x); });
      var ix = {};
      entete.forEach(function (h, i) { if (h && ix[h] === undefined) ix[h] = i; });
      var pcols = [], cdate = -1;
      entete.forEach(function (h, i) {
        if (h.indexOf('Produit') === 0) pcols.push(i);
        if (h.indexOf('Date') === 0 && cdate === -1) cdate = i;
      });
      if (cdate === -1) return;
      var cprix = ix['Prix'], cliv = ix['Livraison'], cplp = ix['Prix livraison'];
      var clieu = ix['Lieu de livraison'], cnot = ix['Notes'];

      for (var i = 1; i < lignes.length; i++) {
        var r = lignes[i] || [];
        var nom = texte(r[0]);
        if (!nom) continue;

        var brut = r[cdate];
        var d = null;
        if (typeof brut === 'number') d = dateExcel(brut);
        else if (brut) {
          var m = String(brut).match(/(\d{4})-(\d{2})-(\d{2})/);
          if (m) d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
          else {
            var f = String(brut).match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
            if (f) d = new Date(Date.UTC(+f[3], +f[2] - 1, +f[1]));
          }
        }
        if (!d) continue;
        var iso = d.getUTCFullYear() + '-' +
          ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);

        var libelles = [];
        pcols.forEach(function (c) { var t = texte(r[c]); if (t) libelles.push(t); });
        if (!libelles.length) continue;

        var prods = [];
        libelles.forEach(function (lib) {
          if (PB_VAR[lib]) {
            prods.push({ pb: true, variant: PB_VAR[lib], price: PBP[PB_VAR[lib]] });
          } else if (MAP[lib]) {
            var p = MAP[lib];
            prods.push({ name: p[0], cat: p[1], price: p[2], variant: p[3], short: p[4] });
          } else {
            /* un libellé d'avant un changement de nom : on le rattache au
               produit actuel, en conservant le prix de l'époque */
            var a = ancienLibelle(lib);
            if (a) {
              prods.push({ name: a[0], cat: a[1], price: a[2], variant: a[3], short: a[4],
                           ancienLibelle: lib, prixFige: true });
            } else {
              inconnus[lib] = true;
            }
          }
        });

        var livp = cplp === undefined ? 0 : (nombre(r[cplp]) || 0);
        var liv = cliv === undefined ? false : texte(r[cliv]).toUpperCase() === 'OUI';
        var lieu = clieu === undefined ? '' : texte(r[clieu]);
        var note = cnot === undefined ? '' : texte(r[cnot]);
        if (note.toUpperCase() === 'X') note = '';

        resas.push({
          id: 'xls-' + iso + '-' + slug(nom).slice(0, 24),
          client: nom, phone: tel(r[1]), email: '',
          dateStart: iso, dateEnd: iso,
          livraison: liv, livraisonPrice: livp,
          acompte: 0, source: '', place: lieu, notes: note,
          _prods: prods,
          _total: cprix === undefined ? null : nombre(r[cprix]),
          _totalInconnu: !!(cprix !== undefined && r[cprix] && r[cprix].formuleSansResultat),
          validatedBy: 'Thomas',
        });
      }
    });

    /* ── attribution des photobooths (1 à 4) : une unité libre ce jour-là */
    var parJour = {};
    resas.forEach(function (r) {
      var occ = parJour[r.dateStart] || (parJour[r.dateStart] = {});
      r._prods.forEach(function (p) {
        if (!p.pb) return;
        var unite = 0;
        for (var n = 1; n <= 4; n++) if (!occ[n]) { unite = n; break; }
        if (!unite) unite = 4;
        occ[unite] = true;
        p.name = 'Photobooth ' + unite;
        p.cat = 'photobooth';
        p.short = 'PB ' + unite;
      });
    });

    /* ── prix : le total de la ligne du classeur fait toujours foi */
    resas.forEach(function (r) {
      var ps = r._prods.map(function (p) {
        return {
          name: p.name, short: p.short || '', cat: p.cat,
          price: p.price === undefined ? null : p.price,
          variant: p.variant || 'Standard',
        };
      });
      if (r._total === 0 && ps.length) {
        ps.forEach(function (x) { x.price = 0; });
      } else if (r._total && ps.length) {
        var autres = 0;
        for (var i = 1; i < ps.length; i++) autres += ps[i].price || 0;
        var reste = Math.round((r._total - autres) * 100) / 100;
        if (reste >= 0) {
          ps[0].price = reste;
        } else {
          /* les tarifs du catalogue dépassent ce qui a été facturé :
             le montant de la ligne va sur le premier produit, les autres
             à zéro, pour que le chiffre d'affaires corresponde au fichier */
          for (var j = 1; j < ps.length; j++) ps[j].price = 0;
          ps[0].price = Math.round(r._total * 100) / 100;
        }
      }
      r.products = ps;
      /* le classeur ne donne pas de montant pour cette ligne : on ne
         touchera pas au prix déjà enregistré dans le planning */
      if (r._totalInconnu) r.garderPrix = true;
      delete r._prods;
      delete r._total;
      delete r._totalInconnu;
    });

    return { reservations: resas, annees: annees, inconnus: Object.keys(inconnus) };
  }

  /* ═══ 3. Point d'entrée ═══════════════════════════════════════ */
  window.VESPRA_LIRE_EXCEL = function (fichier) {
    return fichier.arrayBuffer()
      .then(lireClasseur)
      .then(function (feuilles) {
        var lu = convertir(feuilles);
        if (!lu.annees.length) {
          throw new Error('Aucune feuille « Planning 20xx » dans ce fichier');
        }
        if (lu.inconnus.length) {
          /* on n'interrompt pas la mise à jour : les autres produits de la
             ligne sont repris, et le total de la ligne fait foi */
          if (window.console) console.warn('Produits non reconnus :', lu.inconnus.join(', '));
        }
        return lu;
      });
  };

  /* permet de contrôler la lecture sans passer par le bouton */
  window.VESPRA_EXCEL_CONVERTIR = convertir;
  window.VESPRA_EXCEL_CLASSEUR = lireClasseur;
})();
