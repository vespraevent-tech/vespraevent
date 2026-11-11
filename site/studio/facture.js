/* ─────────────────────────────────────────────────────────────
   FACTURE ET DEVIS — les boutons du back-office

   Les deux documents sortent de la même fabrique : seuls le titre,
   la numérotation et les mentions changent. Avant de générer, on
   demande ce que la réservation ne contient pas toujours :

     • l'adresse du client, facultative ;
     • le type de client — les conditions de règlement et les
       mentions de retard diffèrent entre un particulier et une
       entreprise ;
     • l'acompte, qui n'est demandé qu'occasionnellement : on ne le
       déduit que si la case est cochée.

   Le numéro, lui, vient du serveur : la suite doit être continue, et
   un document regénéré garde le sien.
   ───────────────────────────────────────────────────────────── */
(function () {
  /* Enregistre sur le serveur ce qui a été saisi dans la fenêtre : montants chiffrés,
     adresse du client, type de client, acompte prévu. Une demande les garde dans son suivi,
     une réservation du planning dans sa fiche. */
  /* Base clients : on y reprend SIRET, TVA et adresse de facturation déjà connus, et on y reporte ce qui est saisi ici */
  var _baseClients = [];
  function clientsCharger() {
    try { if (typeof api === 'function') api('/clients').then(function (d) { _baseClients = (d && d.clients) || []; }).catch(function () {}); } catch (e) {}
  }
  function clefNomClient(n) {
    return String(n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function ficheClientDe(r, source) {
    var nom = clefNomClient(source === 'demande' ? r.nom : r.client);
    if (!nom) return null;
    var tel = String((source === 'demande' ? r.telephone : r.phone) || '').replace(/\D/g, '').slice(-9);
    var cand = _baseClients.filter(function (c) { return c && !c._deleted && clefNomClient(c.fullName) === nom; });
    if (!cand.length) return null;
    return cand.filter(function (c) { return tel && String(c.phone || '').replace(/\D/g, '').slice(-9) === tel; })[0] || cand[0];
  }
  function reporterSurClient(r, source, v) {
    try {
      if (typeof api !== 'function') return;
      var nom = String((source === 'demande' ? r.nom : r.client) || '').trim();
      if (!nom) return;
      var c = ficheClientDe(r, source);
      var maj = { pro: !!v.pro, siret: v.pro ? (v.siret || '') : '', tva: v.pro ? (v.tvaClient || '') : '', billAdresse: v.adresse || '', _maj: Date.now() };
      var change = !c || ['pro', 'siret', 'tva', 'billAdresse'].some(function (k) { return String(c[k] == null ? '' : c[k]) !== String(maj[k]); });
      if (!change) return;
      /* rien de saisi et pas de fiche : on ne crée pas une fiche vide */
      if (!c && !maj.pro && !maj.siret && !maj.tva && !maj.billAdresse) return;
      var mots = nom.split(/\s+/);
      var fiche = c ? Object.assign({ id: c.id, fullName: c.fullName }, maj)
        : Object.assign({ id: 'c' + Date.now(), fullName: nom, firstName: mots[0] || '', lastName: mots.slice(1).join(' '),
            phone: (source === 'demande' ? r.telephone : r.phone) || '', email: r.email || '', reservations: 0, notes: '' }, maj);
      api('/clients', { method: 'POST', body: JSON.stringify({ clients: [fiche] }) }).then(clientsCharger).catch(function () {});
    } catch (e) {}
  }
  clientsCharger();
  var _verrou = {};
  /* une option s'écrit court sur le document comme dans le back-office */
  function courtOption(x) {
    if (typeof window.nomCourtOption === 'function') { var c = window.nomCourtOption(x); return c || x; }
    return x;
  }
  /* champ vide = null (pas chiffré) ; 0 est un vrai montant */
  function nombreOuNul(el) {
    var t = String((el && el.value) == null ? '' : el.value).replace(',', '.').trim();
    if (t === '') return null;
    var n = parseFloat(t);
    return isFinite(n) ? Math.max(0, n) : null;
  }
  function sauvegarderSaisies(id, source, r, v) {
    try {
      reporterSurClient(r, source, v);
      if (source === 'demande') {
        if (typeof enregistrerSuivi !== 'function') return Promise.resolve();
        /* champ vide = pas chiffré (null) ; 0 = chiffré à 0 € et il reste sur le document */
        r.livraisonPrix = v.livraison === null ? null : v.livraison;
        r.montagePrix = v.montage === null ? null : v.montage;
        if (v.livraison !== null) r.livraisonRetour = !!v.retour;
        r.devisAdresse = v.adresse || '';
        r.devisPro = !!v.pro;
        r.devisSiret = v.siret || '';
        r.devisTva = v.tvaClient || '';
        r.devisAvecAcompte = !!v.avecAcompte;
        return Promise.resolve(enregistrerSuivi(r)).then(function () {
          /* une demande déjà au planning suit les mêmes montants */
          if (r.resaId && typeof cache !== 'undefined') {
            var rs = (cache.resas || []).filter(function (x) { return String(x.id) === String(r.resaId); })[0];
            if (rs && typeof api === 'function') {
              rs.livraisonPrice = v.livraison === null ? 0 : v.livraison;
              rs.montage = v.montage === null ? 0 : v.montage;
              return api('/data', { method: 'POST', body: JSON.stringify({ collection: 'reservations', item: { id: rs.id, d: JSON.stringify(rs) } }) });
            }
          }
        }).catch(function (e) {
          if (typeof showToast === 'function') showToast('Saisies non enregistrées : ' + e.message, true);
        });
      }
      r.factureClient = { adresse: v.adresse || '', pro: !!v.pro, siret: v.siret || '', tvaClient: v.tvaClient || '', avecAcompte: !!v.avecAcompte };
      if (typeof api === 'function') {
        return Promise.resolve(api('/data', { method: 'POST', body: JSON.stringify({ collection: 'reservations', item: { id: r.id, d: JSON.stringify(r) } }) }))
          .catch(function (e) { if (typeof showToast === 'function') showToast('Saisies non enregistrées : ' + e.message, true); });
      }
    } catch (e) {}
    return Promise.resolve();
  }

  function txt(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function resaDe(id) {
    return ((typeof cache !== 'undefined' && cache.resas) || [])
      .filter(function (x) { return String(x.id) === String(id); })[0];
  }
  function demandeDe(id) {
    return ((typeof cache !== 'undefined' && cache.demandes) || [])
      .filter(function (x) { return String(x.id) === String(id); })[0];
  }

  /* Les lignes d'un devis établi depuis une demande : le matériel que
     le client a choisi sur le site, ses options, et le prix de chacune.
     La livraison et le montage n'y figurent pas — ce sont eux que vous
     chiffrez au moment d'établir le devis. */
  /* Le montage retenu pour une demande : celui que vous avez saisi sur
     sa fiche, sinon celui que la grille des tarifs propose d'après le
     matériel loué — 250 € pour une tente étoile, 150 € pour un barnum
     6×10… Vous n'avez donc rien à retaper pour une structure connue. */
  function montageDeDemande(d) {
    /* uniquement ce que vous avez saisi : aucun montant automatique */
    return (d && d.montagePrix != null) ? (Number(d.montagePrix) || 0) : 0;
  }

  /* aucun devis ni facture à 0 € : tant qu'une prestation de prestataire n'a pas son prix (> 0), le document est bloqué */
  function prixPrestaManquant(r, lignes, depuisDemande) {
    if (depuisDemande) return (lignes || []).some(function (l) { return l && l.presta && !(Number(l.montantTTC) > 0); });
    return ((r && r.supplements) || []).some(function (x) { return x && x.tiers && !(Number(x.prix) > 0); });
  }

  function lignesDeDemande(d) {
    var l = lignesBrutes(d);
    try {
      var e = (typeof parrainEtat === 'function') ? parrainEtat(d) : null;
      if (e && e.statut === 'applique') l.push({ intitule: 'Remise parrainage (code ' + e.code + ')', detail: '', quantite: 1, montantTTC: -e.montant, remise: true });
    } catch (err) {}
    try {
      var om = (typeof offreMariageMontant === 'function') ? offreMariageMontant(d) : 0;
      if (om > 0) l.push({ intitule: 'Réduction de 10 % sur le matériel', detail: '', quantite: 1, montantTTC: -om, remise: true });
    } catch (err2) {}
    return l;
  }

  function lignesBrutes(d) {
    var items = (typeof materielListe === 'function') ? materielListe(d) : [];
    var sortie = [];
    items.forEach(function (it) {
      /* prestation d'un prestataire partenaire : part du prestataire (fonds de tiers) puis « Organisation et coordination » */
      if (it.presta === true) {
        var nomP = (typeof prestaNomLocal === 'function') ? prestaNomLocal(it.nom) : '';
        var base = String(it.nom || 'Prestation').replace(/\s*[—–-]\s*(sur devis|candice|emmanuel)\s*$/ig, '').trim() || 'Prestation';
        sortie.push({
          intitule: nomP ? base + ' — réalisée par ' + nomP + ' (facturée au nom et pour le compte de ' + nomP + ')' : base,
          detail: nomP ? 'Prestation réalisée par ' + nomP + ', prestataire partenaire. Vespra Event encaisse pour son compte et assure la coordination.' : (it.desc || ''),
          quantite: 1, montantTTC: Number(it.prix) || 0, ancienTTC: 0, presta: true, tiers: true });
        if (Number(it.orga) > 0) sortie.push({ intitule: 'Organisation et coordination', detail: '', quantite: 1, montantTTC: Number(it.orga), ancienTTC: 0 });
        return;
      }
      sortie.push(lignesBrutesUne(it));
    });
    return sortie;
  }
  function lignesBrutesUne(it) {
    {
      /* le prix d'une ligne du panier comprend déjà ses options (c'est le
         prix affiché sur la fiche et additionné dans son total) : on ne
         les ajoute pas une seconde fois, sinon le devis dépasse la fiche */
      var prix = Number(it.prix) || 0;
      var aff = null;
      try { if (typeof affichageMateriel === 'function') aff = affichageMateriel(it.nom || 'Matériel', it.formule, it.options || []); } catch (e2) {}
      return {
        intitule: (/^(serveuse|p[âa]tissier|chef p[âa]tissier)|—\s*sur devis\s*$/i.test(String(it.nom || '')) ? String(it.nom).replace(/\s*—\s*sur devis\s*$/i, '') : 'Location — ' + (aff ? aff.titre : (it.nom || 'Matériel'))),
        detail: aff ? [aff.sous, (aff.opts || []).map(courtOption).join(', ')].filter(Boolean).join(' · ') : [it.formule, (it.options || []).map(courtOption).join(', ')].filter(Boolean).join(' · '),
        quantite: Number(it.qte) || Number(it.quantite) || 1,
        montantTTC: prix,
        /* prix baissé directement sur la fiche : l'ancien prix du tarif figure barré sur le devis */
        ancienTTC: (it.manuel && Number(it.prixCatalogue) > prix) ? Number(it.prixCatalogue) : 0,
        presta: false,
      };
    }
  }


  /* Mêmes règles que le planning : une option « une seule fois » (cadre photo,
     déguisements) enregistrée en double sur un même produit n'est comptée
     qu'une fois, sur la fiche comme sur le devis et la facture. */
  function produitsNets(list) {
    var out = [], vus = {}, parent = -1;
    var net = function (v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^\s*(\+|option)\s*:?\s*/, '').replace(/[^a-z0-9]+/g, ' ').trim(); };
    (list || []).forEach(function (p, i) {
      if (!p) return;
      var n = net(p.name);
      var opt = p.estOption === true || p.variant === 'Option' ||
        (i > 0 && !/^photobooth/.test(n) && /^(cadre photo|deguisement|lot de deguisement|option|micro|eclairage|guirlande|sacs? de lestage|lestage|cabine|neon|mais a eclater|installation|canon (rose|bleu|blanc|rouge|jaune|orange|vert|violet))/.test(n));
      if (!opt) { parent = i; out.push(p); return; }
      var k = /^cadre photo/.test(n) ? 'cadre' : (/^(lot de )?deguisement/.test(n) ? 'deguis' : null);
      if (k) {
        var cle = (p.parent != null ? 'u' + p.parent : 'i' + parent) + '|' + k;
        if (vus[cle]) return; vus[cle] = 1;
      }
      out.push(p);
    });
    return out;
  }

  window.vespraProduitsNets = produitsNets;

  function totalDe(r) {
    return produitsNets(r.products).reduce(function (t, p) { return t + (Number(p.price) || 0); }, 0)
      + (Number(r.livraisonPrice) || 0) + (Number(r.montage) || 0)
      + (r.supplements || []).reduce(function (t, s) { return t + (Number(s && (s.price != null ? s.price : s.prix)) || 0); }, 0);
  }

  /* ── la fenêtre, pour l'un ou l'autre document ─────────────── */
  /* La demande d'origine d'un document : la demande elle-même, ou celle liée à la réservation. */
  function demandeLieeDe(r, source) {
    if (!r) return null;
    if (source === 'demande') return r;
    return (typeof cache !== 'undefined' && cache.demandes)
      ? (cache.demandes.filter(function (x) { return x && x.resaId && String(x.resaId) === String(r.id); })[0] || null) : null;
  }
  /* Le nom de la société, quand le client en a indiqué une : il remplace le nom de la personne sur le document. */
  function societeDe(r, source) {
    var d = demandeLieeDe(r, source);
    if (!d) return '';
    var estPro = /entreprise|association|mairie|collectivit/i.test(String(d.clientType || ''));
    return estPro ? String(d.societe || '').trim() : '';
  }

  function ouvrir(id, type, source) {
    /* Deux points de départ : une réservation du planning, dont les
       montants sont déjà arrêtés, ou une demande encore à chiffrer. */
    var depuisDemande = source === 'demande';
    var r = depuisDemande ? demandeDe(id) : resaDe(id);
    if (!r) {
      if (typeof showToast === 'function') showToast(depuisDemande ? 'Demande introuvable' : 'Réservation introuvable', true);
      return;
    }

    var devis = type === 'devis';
    /* Les saisies de cette fenêtre vivent sur le serveur (la demande ou la réservation),
       jamais seulement dans le navigateur : elles sont donc identiques sur tous les appareils. */
    /* Ce que le client a lui-même renseigné dans sa demande (entreprise, SIRET, TVA) :
       repris tant que rien n'a été enregistré dans cette fenêtre, pour ne pas le redemander. */
    var demandeLiee = depuisDemande ? r
      : ((typeof cache !== 'undefined' && cache.demandes) ? cache.demandes.filter(function (x) { return x && x.resaId && String(x.resaId) === String(r.id); })[0] : null);
    var depuisClient = function (d) {
      if (!d) return null;
      var pro = /entreprise|association|mairie|collectivit/i.test(String(d.clientType || ''));
      var siret = String(d.siret || '').trim(), tva = String(d.tva || '').trim();
      return (pro || siret || tva) ? { pro: pro || !!(siret || tva), siret: siret, tvaClient: tva } : null;
    };
    var societeClient = societeDe(r, source);
    var vu;
    if (depuisDemande) {
      var jamaisSaisi = r.devisPro === undefined && !r.devisSiret && !r.devisTva;
      var cl = jamaisSaisi ? depuisClient(r) : null;
      vu = { adresse: r.devisAdresse || undefined,
             pro: cl ? cl.pro : r.devisPro === true,
             siret: cl ? cl.siret : (r.devisSiret || ''),
             tvaClient: cl ? cl.tvaClient : (r.devisTva || ''),
             avecAcompte: r.devisAvecAcompte === true ? true : undefined };
    } else {
      vu = r.factureClient || {};
      var cl2 = (r.factureClient === undefined) ? depuisClient(demandeLiee) : null;
      if (cl2) vu = { pro: cl2.pro, siret: cl2.siret, tvaClient: cl2.tvaClient };
    }
    /* fiche de la base clients : reprise de ce qui est déjà connu */
    clientsCharger();
    var fclient = ficheClientDe(r, source);
    if (fclient) {
      vu = Object.assign({}, vu);
      if (vu.pro !== true && !vu.siret && !vu.tvaClient && (fclient.pro || fclient.siret || fclient.tva)) {
        vu.pro = true; vu.siret = fclient.siret || ''; vu.tvaClient = fclient.tva || '';
      }
      if (vu.adresse === undefined && fclient.billAdresse) vu.adresse = fclient.billAdresse;
    }
    var adresse = (vu.adresse !== undefined) ? vu.adresse : (depuisDemande ? (r.adresse || '') : (r.place || ''));
    var pro = vu.pro === true;
    /* Une réservation porte un booléen « acompte » : il signifie que
       l'acompte contractuel de 30 % est prévu/versé. Il ne faut surtout
       pas convertir true en 1 €. Le montant affiché est toujours calculé
       sur le total du document. */
    var acompteResa = !depuisDemande && r && r.acompte === true;
    var avecAcompte = vu.avecAcompte !== undefined ? vu.avecAcompte === true : acompteResa;
    var montantAcompte = avecAcompte ? Math.round(totalDe(r) * 0.30 * 100) / 100 : 0;
    if (depuisDemande) montantAcompte = 0;

    var retourCoche = (r && r.livraisonRetour != null) ? r.livraisonRetour === true : false;
    var lignes = depuisDemande ? lignesDeDemande(r) : [];
    var total = depuisDemande
      ? lignes.reduce(function (t, l) { return t + l.montantTTC; }, 0)
      : totalDe(r);
    var nomClient = depuisDemande ? (r.nom || 'Client') : (r.client || 'Client');
    var zone = document.getElementById('contenuFacture');

    zone.innerHTML =
      '<div class="fd-h"><span class="fd-nom">' + (devis ? 'Devis' : 'Facture') + '</span></div>' +
      '<div class="fd-recue">' + txt(nomClient) + (window.badgeNumero ? window.badgeNumero(r) : '') + ' — <span id="fcTotal">' +
        (total ? total + ' € TTC' : 'montant à compléter') + '</span></div>' +

      (depuisDemande ? '<div class="fc-champ">' +
        '<span class="fc-l">Montants que vous chiffrez</span>' +
        '<div class="fc-duo">' +
          '<label class="fc-duo-c"><span>Livraison</span>' +
            '<span class="fc-ligne"><input class="fc-input fc-input-court" id="fcLivraison" type="number" min="0" step="1" ' +
            'value="' + (r.livraisonPrix === null || r.livraisonPrix === undefined || r.livraisonPrix === '' ? '' : Number(r.livraisonPrix) || 0) + '" placeholder="vide = aucune"><span class="fc-unite">€</span></span>' +
            '<span style="display:flex;align-items:center;gap:6px;margin-top:5px;font:400 11px Inter,system-ui,sans-serif;color:#6b7280">' +
              '<input type="checkbox" id="fcRetour" style="width:13px;height:13px;margin:0"' + (retourCoche ? ' checked' : '') + '> Reprise du matériel comprise</span></label>' +
          '<label class="fc-duo-c"><span>Montage</span>' +
            '<span class="fc-ligne"><input class="fc-input fc-input-court" id="fcMontage" type="number" min="0" step="1" ' +
            'value="' + (r.montagePrix === null || r.montagePrix === undefined || r.montagePrix === '' ? '' : Number(r.montagePrix) || 0) + '" placeholder="vide = aucun"><span class="fc-unite">€</span></span></label>' +
        '</div>' +
        '<p class="fc-aide">Laissez vide si le client vient chercher le matériel. Saisissez 0 pour une livraison offerte : elle figurera à 0 € sur le document.</p>' +
      '</div>' : '') +

      '<div class="fc-champ">' +
        '<label class="fc-l" for="fcAdresse">Adresse ' + (devis ? 'du client' : 'de facturation du client') + '</label>' +
        '<textarea class="fc-zone" id="fcAdresse" rows="3" data-adresse-autocomplete ' +
          'placeholder="12 rue des Lilas&#10;35500 Vitré">' + txt(adresse) + '</textarea>' +
        '<p class="fc-aide">Facultative' + (devis ? '' : ' (pour une entreprise, c’est une mention légale sur la facture)') + '. Une ligne par ligne d’adresse.</p>' +
      '</div>' +

      '<div class="fc-champ">' +
        '<span class="fc-l">Type de client</span>' +
        '<div class="fc-choix">' +
          '<label><input type="radio" name="fcType" value="part"' + (pro ? '' : ' checked') + '> Particulier</label>' +
          '<label><input type="radio" name="fcType" value="pro"' + (pro ? ' checked' : '') + '> Entreprise, mairie, association</label>' +
        '</div>' +
        '<p class="fc-aide" id="fcAideType"></p>' +
      '</div>' +

      '<div class="fc-champ">' +
        '<label class="fc-case"><input type="checkbox" id="fcAvecAcompte"' + (avecAcompte ? ' checked' : '') + '> ' +
          '<span>' + (devis ? 'Prévoir un acompte' : 'Déduire un acompte déjà versé') + '</span></label>' +
        '<div class="fc-ligne" id="fcBlocAcompte" hidden>' +
          '<input class="fc-input fc-input-court" id="fcAcompte" type="number" min="0" step="0.01" ' +
            'value="' + (montantAcompte ? montantAcompte : '') + '" placeholder="30 % du total" readonly>' +
            '<span class="fc-unite">€</span>' +
        '</div>' +
        '<p class="fc-aide" id="fcAideAcompte"></p>' +
      '</div>' +

      '<div class="fc-champ" id="fcBlocPro" hidden>' +
        '<label class="fc-l" for="fcSiret">SIRET du client (facultatif)</label>' +
        '<input class="fc-input" id="fcSiret" type="text" value="' + txt(vu.siret || '') + '" placeholder="123 456 789 00012">' +
        '<label class="fc-l" for="fcTvaClient" style="margin-top:10px">N° de TVA du client (facultatif)</label>' +
        '<input class="fc-input" id="fcTvaClient" type="text" value="' + txt(vu.tvaClient || '') + '" placeholder="FR00123456789">' +
      '</div>' +

      (prixPrestaManquant(r, lignes, depuisDemande)
        ? '<p class="fc-aide" id="fcBlocPresta" style="color:#b03a2a;font-weight:600;margin:10px 0 0">Le prix de la prestation n’est pas encore saisi : le devis ne peut pas être envoyé tant qu’il n’est pas renseigné.</p>' : '') +
      '<div class="modal-actions compact">' +
        '<button class="btn btn-ghost" onclick="fermerFacture()">Annuler</button>' +
        '<button class="btn" id="fcGenerer"' + (prixPrestaManquant(r, lignes, depuisDemande) ? ' disabled title="Prix de la prestation non saisi"' : '') + '>Télécharger<span class="bo-long"> le ' + (devis ? 'devis' : 'la facture').replace(/^la /, '') + '</span></button>' +
      '</div>';

    function totalCourant() {
      if (!depuisDemande) return total;
      return total
        + (Number((zone.querySelector('#fcLivraison') || {}).value) || 0)
        + (Number((zone.querySelector('#fcMontage') || {}).value) || 0);
    }
    function majAcompteMontant() {
      var cb = zone.querySelector('#fcAvecAcompte');
      var input = zone.querySelector('#fcAcompte');
      if (!cb || !input) return;
      var montant = cb.checked ? Math.round(totalCourant() * 0.30 * 100) / 100 : 0;
      input.value = montant ? montant.toFixed(2) : '';
      var aide = zone.querySelector('#fcAideAcompte');
      if (aide) aide.textContent = cb.checked
        ? ((devis ? 'Acompte à verser : ' : 'Acompte déjà versé : ') + montant.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' € (30 % du total TTC).')
        : 'Aucun acompte sur ce document.';
    }
    function majTotal() {
      if (!depuisDemande) { majAcompteMontant(); return; }
      var courant = totalCourant();
      var t = zone.querySelector('#fcTotal');
      if (t) t.textContent = courant ? courant.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' € TTC' : 'montant à compléter';
      majAcompteMontant();
    }
    if (depuisDemande) {
      ['#fcLivraison', '#fcMontage'].forEach(function (sel) {
        var i = zone.querySelector(sel);
        if (i) i.addEventListener('input', majTotal);
      });
      majTotal();
    }

    function majType() {
      var estPro = zone.querySelector('input[name="fcType"][value="pro"]').checked;
      zone.querySelector('#fcBlocPro').hidden = !estPro;
      zone.querySelector('#fcAideType').textContent = devis
        ? (estPro ? 'Devis valable 30 jours, adressé à une structure.' : 'Devis valable 30 jours.')
        : (estPro
            ? 'Paiement à 30 jours ; les mentions de pénalités de retard et l’indemnité de 40 € seront ajoutées.'
            : 'Paiement comptant le jour de la mise à disposition ; pas de mention de pénalités.');
    }
    function majAcompte() {
      var coche = zone.querySelector('#fcAvecAcompte').checked;
      zone.querySelector('#fcBlocAcompte').hidden = !coche;
      majAcompteMontant();
    }
    zone.querySelectorAll('input[name="fcType"]').forEach(function (i) { i.addEventListener('change', majType); });
    zone.querySelector('#fcAvecAcompte').addEventListener('change', majAcompte);
    majType(); majAcompte();

    /* ce qui est saisi s'enregistre tout de suite : même sans télécharger, les autres appareils le voient */
    var _t = null;
    function valeursSaisies() {
      var q = function (s) { return zone.querySelector(s); };
      return {
        adresse: ((q('#fcAdresse') || {}).value || '').trim(),
        pro: !!(q('input[name="fcType"][value="pro"]') || {}).checked,
        siret: (q('#fcSiret') || {}).value || '', tvaClient: (q('#fcTvaClient') || {}).value || '',
        avecAcompte: !!(q('#fcAvecAcompte') || {}).checked,
        livraison: nombreOuNul(q('#fcLivraison')), montage: nombreOuNul(q('#fcMontage')),
        retour: !!(q('#fcRetour') || {}).checked,
      };
    }
    zone.onchange = function () {
      clearTimeout(_t);
      _t = setTimeout(function () {
        Promise.resolve(sauvegarderSaisies(id, source, r, valeursSaisies())).then(function () {
          if (source === 'demande' && typeof rafraichirFiche === 'function') { try { rafraichirFiche(id); } catch (e) {} }
        });
      }, 500);
    };
    zone.querySelector('#fcGenerer').addEventListener('click', function () { clearTimeout(_t); telecharger(id, type, source, r, lignes); });
    document.getElementById('modalFacture').classList.add('open');
  }

  window.ouvrirFacture = function (id, source) { ouvrir(id, 'facture', source); };
  window.ouvrirDevis = function (id, source) { ouvrir(id, 'devis', source); };

  window.fermerFacture = function () {
    document.getElementById('modalFacture').classList.remove('open');
  };

  /* « Voulez-vous l'envoyer par mail ? » : ouvre Gmail avec l'adresse du client et un message prêt.
     Gmail ne permet pas de joindre un fichier par lien : le PDF vient d'être téléchargé, il suffit de le glisser. */
  function proposerEnvoiMail(devis, nomFichier, email) {
    var ancien = document.getElementById('fcMailBox'); if (ancien) ancien.remove();
    var doc = devis ? 'devis' : 'facture';
    var lien = typeof window.urlGmail === 'function'
      ? window.urlGmail(email, 'Votre ' + doc + ' Vespra Event',
          'Bonjour,\n\nVeuillez trouver ci-joint votre ' + doc + '.\n\nN’hésitez pas à me contacter pour toute question.\n\n')
      : '#';
    var box = document.createElement('div');
    box.id = 'fcMailBox';
    box.style.cssText = 'position:fixed;inset:0;background:rgba(12,15,20,.45);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px';
    box.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:420px;width:100%;padding:24px;font:14px Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;color:#2A2D34;box-shadow:0 24px 70px rgba(12,15,20,.35)">'
      + '<div style="font-weight:700;font-size:17px;margin-bottom:8px">Envoyer par mail ?</div>'
      + '<div style="line-height:1.55;color:#565B63;margin-bottom:18px">Le ' + doc + ' vient d’être téléchargé. Voulez-vous l’envoyer au client'
      + (email ? ' (' + String(email).replace(/[<>&"]/g, '') + ')' : '') + ' ? Gmail s’ouvre avec le message prêt : il ne reste qu’à glisser le PDF téléchargé dans le mail.</div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end">'
      + '<button type="button" id="fcMailNon" style="border:1px solid #D8DDE5;background:#fff;border-radius:10px;padding:10px 16px;font:700 13px Inter,system-ui,sans-serif;cursor:pointer">Non merci</button>'
      + (email ? '<a id="fcMailOui" href="' + lien.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener" style="background:#2B4A6B;color:#fff;border-radius:10px;padding:10px 16px;font:700 13px Inter,system-ui,sans-serif;text-decoration:none">Oui, ouvrir Gmail</a>'
        : '<span style="align-self:center;color:#B91C1C;font-size:12px">Pas d’adresse e-mail pour ce client</span>')
      + '</div></div>';
    document.body.appendChild(box);
    var ferme = function () { box.remove(); };
    box.querySelector('#fcMailNon').onclick = ferme;
    var oui = box.querySelector('#fcMailOui'); if (oui) oui.onclick = function () { setTimeout(ferme, 100); };
    box.addEventListener('click', function (e) { if (e.target === box) ferme(); });
  }

  function telecharger(id, type, source, r, lignes) {
    var devis = type === 'devis';
    var depuisDemande = source === 'demande';
    var societeClient = societeDe(r, source);
    var zone = document.getElementById('contenuFacture');
    var bouton = zone.querySelector('#fcGenerer');
    var libelle = bouton.innerHTML;
    var adresse = (zone.querySelector('#fcAdresse').value || '').trim();
    var pro = zone.querySelector('input[name="fcType"][value="pro"]').checked;
    var siret = (zone.querySelector('#fcSiret') || {}).value || '';
    var tvaClient = (zone.querySelector('#fcTvaClient') || {}).value || '';
    var avecAcompte = zone.querySelector('#fcAvecAcompte').checked;
    var totalDocument = (function(){
      var base = 0;
      if (source === 'demande') {
        base = (lignes || []).reduce(function(s,l){ return s + (Number(l.montantTTC)||0); },0);
        base += Number((zone.querySelector('#fcLivraison') || {}).value) || 0;
        base += Number((zone.querySelector('#fcMontage') || {}).value) || 0;
      } else {
        base = totalDe(r);
      }
      return base;
    })();
    var acompte = avecAcompte ? Math.round(totalDocument * 0.30 * 100) / 100 : 0;

    var livraison = nombreOuNul(zone.querySelector('#fcLivraison'));
    var montage = nombreOuNul(zone.querySelector('#fcMontage'));
    var retour = !!(zone.querySelector('#fcRetour') || {}).checked;

    if (prixPrestaManquant(r, lignes, depuisDemande)) {
      alert('Le prix de la prestation n’est pas encore saisi : le devis ne peut pas être envoyé.');
      return;
    }
    sauvegarderSaisies(id, source, r, { adresse: adresse, pro: pro, siret: siret, tvaClient: tvaClient,
                  avecAcompte: avecAcompte, livraison: livraison, montage: montage, retour: retour });

    bouton.disabled = true;
    bouton.textContent = 'Génération…';

    var lignesAdr = adresse.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var chemin = '/api/admin/' + (devis ? 'devis' : 'facture');
    var appel;

    if (depuisDemande) {
      /* La demande n'est pas encore au planning : le back-office envoie
         lui-même les lignes, avec la livraison et le montage chiffrés
         à l'instant. */
      var toutes = (lignes || []).slice();
      if (livraison !== null) toutes.push({ intitule: retour ? 'Livraison et reprise du matériel' : 'Livraison du matériel', detail: '', quantite: 1, montantTTC: livraison });
      if (montage !== null) toutes.push({ intitule: 'Montage et démontage sur place', detail: '', quantite: 1, montantTTC: montage });
      /* la remise (parrainage) se lit en dernier, sous la livraison et le montage */
      toutes = toutes.filter(function (x) { return !x.remise; }).concat(toutes.filter(function (x) { return x.remise; }));
      if (!toutes.length) {
        bouton.disabled = false; bouton.innerHTML = libelle;
        if (typeof showToast === 'function') showToast('Aucun montant à faire figurer sur le devis', true);
        return;
      }
      appel = fetch(chemin, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ref: id,
          pro: pro,
          acompte: acompte,
          dateEvenement: (r && r.date) || '',
          dateFinEvenement: (r && (r.dateFin || r.datefin)) || '',
          client: {
            nom: societeClient || (r && r.nom) || 'Client',
            adresse: lignesAdr,
            tel: (r && r.telephone) || '',
            email: (r && r.email) || '',
            siret: siret,
            tvaClient: tvaClient,
          },
          lignes: toutes,
        }),
      });
    } else {
      appel = fetch(chemin + '?id=' + encodeURIComponent(id)
        + '&adresse=' + encodeURIComponent(lignesAdr.join('|'))
        + '&pro=' + (pro ? '1' : '0')
        + '&acompte=' + acompte
        + (societeClient ? '&societe=' + encodeURIComponent(societeClient) : '')
        + (siret ? '&siret=' + encodeURIComponent(siret) : '')
        + (tvaClient ? '&tvaclient=' + encodeURIComponent(tvaClient) : ''),
        { credentials: 'same-origin' });
    }

    appel
      .then(function (rep) {
        if (!rep.ok) return rep.json().then(function (d) { throw new Error((d && (d.message || d.error)) || 'Erreur ' + rep.status); });
        var nom = devis ? 'devis.pdf' : 'facture.pdf';
        var m = /filename="([^"]+)"/.exec(rep.headers.get('content-disposition') || '');
        if (m) nom = m[1];
        return rep.blob().then(function (b) { return { b: b, nom: nom }; });
      })
      .then(function (f) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(f.b);
        a.download = f.nom;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        bouton.disabled = false;
        bouton.innerHTML = libelle;
        if (typeof showToast === 'function') showToast(devis ? 'Devis généré' : 'Facture générée');
        /* le devis dit sur la fiche s'il demandait un acompte */
        if (devis && depuisDemande && typeof cache !== 'undefined') {
          var dd = (cache.demandes || []).filter(function (x) { return x.id === id; })[0];
          if (dd && typeof enregistrerSuivi === 'function') {
            dd.devisAcompte = acompte > 0 ? acompte : 0;
            Promise.resolve(enregistrerSuivi(dd)).catch(function () {}).then(function () {
              if (typeof rafraichirFiche === 'function') rafraichirFiche(id);
            });
          }
        }
        window.fermerFacture();
        if (window.chargerNumeros) Promise.resolve(window.chargerNumeros()).then(function () {
          ['contenuFicheDemande', 'contenuFicheResa'].forEach(function (cid) {
            var n = document.querySelector('#' + cid + ' .fd-nom');
            if (!n || !window.badgeNumero) return;
            var h = n.parentNode.querySelector('.dm-nums'); if (!h) n.insertAdjacentHTML('afterend', window.badgeNumero(r));
            if (window.majBadgesNumeros) window.majBadgesNumeros();
          });
        });
        proposerEnvoiMail(devis, f.nom, (r && r.email) || '');
      })
      .catch(function (e) {
        bouton.disabled = false;
        bouton.innerHTML = libelle;
        if (typeof showToast === 'function') showToast('Génération impossible : ' + e.message, true);
      });
  }
})();
