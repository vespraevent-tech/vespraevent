/* ─────────────────────────────────────────────────────────────
   PARRAINAGE — l'onglet du back-office

   Les codes sont créés par les clients eux-mêmes depuis la page
   Parrainage du site ; cette page les montre, et surtout elle dit
   ce que vous devez à chaque parrain.

   L'état de chaque filleul n'est pas saisi à la main : il est
   déduit du planning.
     • en attente — la demande est arrivée, aucune réservation
       n'existe encore à ce nom ;
     • validée   — une réservation est au planning à ce nom ;
     • acquis    — cette réservation est passée : les 10 € sont dus.

   La seule chose que vous cochez, c'est « avoir déduit », le jour
   où vous retirez réellement les 10 € d'une location du parrain.
   ───────────────────────────────────────────────────────────── */
(function () {
  var fiches = [];      /* les codes, tels qu'ils sont enregistrés */
  var planning = [];    /* les réservations, pour connaître l'état */
  var charge = false;

  /* ── comparaison de noms, comme côté serveur ─────────────── */
  function sansAccents(t) {
    return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  }
  var PARTICULES = { LE: 1, LA: 1, DE: 1, DU: 1, DES: 1, DA: 1, D: 1, VAN: 1, VON: 1 };
  function mots(t) {
    return sansAccents(t).replace(/[^A-Z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  }
  function cle(nom) {
    return mots(nom).filter(function (m) { return !PARTICULES[m]; }).sort().join('');
  }
  /* même règle que côté serveur : « Le Campion » et « Lecampion »
     désignent la même personne */
  function empreinte(t) { return mots(t).join('').split('').sort().join(''); }
  function memePersonne(a, b) {
    var x = cle(a), y = cle(b);
    if (!x || !y) return false;
    if (x === y) return true;
    if (empreinte(a) !== empreinte(b)) return false;
    var longsA = mots(a).filter(function (m) { return m.length >= 4; });
    return mots(b).some(function (m) { return m.length >= 4 && longsA.indexOf(m) !== -1; });
  }

  function euros(n) { return (Math.round(Number(n) || 0)) + ' €'; }

  /* ce que rapporte une réservation du planning */
  function totalResa(r) {
    if (!r) return 0;
    var nets = typeof window.vespraProduitsNets === 'function' ? window.vespraProduitsNets(r.products) : (r.products || []);
    return nets.reduce(function (t, p) { return t + (Number(p.price) || 0); }, 0)
      + (Number(r.livraisonPrice) || 0) + (Number(r.montage) || 0)
      + (r.supplements || []).reduce(function (t, x) {
          return t + (Number(x && (x.price != null ? x.price : x.prix)) || 0); }, 0);
  }

  /* les réservations d'une personne, la plus récente d'abord */
  function resasDe(nom) {
    return planning.filter(function (r) { return memePersonne(r.client, nom); })
      .slice().sort(function (a, b) {
        return String(versISO(b.dateStart)).localeCompare(String(versISO(a.dateStart)));
      });
  }

  function jourFr(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    /* les dates saisies sur le site sont déjà au format jour/mois/année */
    return String(iso || '').slice(0, 10);
  }
  function versISO(v) {
    var s = String(v || '').trim();
    var a = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (a) return a[3] + '-' + a[2] + '-' + a[1];
    var b = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return b ? b[0] : '';
  }
  function aujourdhui() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ── l'état d'un filleul, déduit du planning ──────────────── */
  function etatDe(u) {
    var resa = null;
    for (var i = 0; i < planning.length; i++) {
      if (memePersonne(planning[i].client, u.filleul)) { resa = planning[i]; break; }
    }
    if (!resa) return { cle: 'attente', mot: 'Demande en cours', du: false, resa: null };
    var fin = versISO(resa.dateEnd || resa.dateStart);
    if (fin && fin < aujourdhui()) return { cle: 'acquis', mot: '10 € dus', du: true, resa: resa };
    return { cle: 'validee', mot: 'Réservé', du: false, resa: resa };
  }

  /* ── lecture ──────────────────────────────────────────────── */
  async function charger(force) {
    if (charge && !force) return;
    var zone = document.getElementById('pbListe');
    if (zone && force) zone.innerHTML = '<div class="empty">Chargement…</div>';
    try {
      /* Adresse dédiée : elle lit les codes par leur clé exacte, donc un
         code créé à l'instant y figure déjà. L'ancienne lecture générique
         reste en secours si cette adresse n'est pas encore déployée. */
      var resultats = await Promise.all([
        api('/parrainage').catch(function () { return null; }),
        api('/data?collection=reservations'),
      ]);
      if (resultats[0] && Array.isArray(resultats[0].codes)) {
        fiches = resultats[0].codes.map(normaliserFiche).filter(Boolean);
      } else {
        fiches = ((await api('/data?collection=parrainage')) || []).map(lireFiche).filter(Boolean);
      }
      planning = (resultats[1] || []).map(lireResa).filter(Boolean);
      charge = true;
      rendre();
    } catch (e) {
      if (zone) zone.innerHTML = '<div class="empty">Lecture impossible : ' + (e.message || 'erreur') + '</div>';
    }
  }

  /* une fiche complète, telle que la renvoie l'adresse dédiée */
  function normaliserFiche(o) {
    if (!o || !o.code) return null;
    o.utilisations = Array.isArray(o.utilisations) ? o.utilisations : [];
    o.deduits = Number(o.deduits) || 0;
    o.remise = Number(o.remise) || 10;
    return o;
  }

  function lireFiche(it) {
    var d = it && it.d;
    var o = null;
    if (typeof d === 'string') { try { o = JSON.parse(d); } catch (e) { o = null; } }
    else if (it && it.code) o = it;
    if (!o || !o.code) return null;
    o.utilisations = Array.isArray(o.utilisations) ? o.utilisations : [];
    o.deduits = Number(o.deduits) || 0;
    o.remise = Number(o.remise) || 10;
    return o;
  }
  function lireResa(it) {
    if (!it || it.id === 'cfg') return null;
    var d = it.d;
    var o = null;
    if (typeof d === 'string') { try { o = JSON.parse(d); } catch (e) { o = null; } }
    else if (it.client) o = it;
    return o && o.client ? o : null;
  }

  /* ── affichage ────────────────────────────────────────────── */
  function rendre() {
    var zone = document.getElementById('pbListe');
    if (!zone) return;

    /* chaque fiche est complétée par son solde */
    var calculees = fiches.map(function (f) {
      var acquis = 0;
      var lignes = (f.utilisations || []).map(function (u) {
        var e = etatDe(u);
        if (e.du) acquis += Number(u.montant) || f.remise;
        return { u: u, e: e };
      });
      return {
        f: f, lignes: lignes,
        acquis: acquis,
        deduits: f.deduits,
        reste: Math.max(0, acquis - f.deduits),
      };
    }).sort(function (a, b) {
      if (b.reste !== a.reste) return b.reste - a.reste;
      if (b.lignes.length !== a.lignes.length) return b.lignes.length - a.lignes.length;
      return String(a.f.parrain || '').localeCompare(String(b.f.parrain || ''), 'fr');
    });

    /* les trois chiffres du haut, sur l'ensemble des codes */
    /* Ce que le parrainage a coûté, des deux côtés :
         • au filleul, la remise de 10 € portée sur sa location ;
         • au parrain, les 10 € gagnés grâce à lui.
       Une remise ne compte que si la location a réellement eu lieu ; ce
       qui est encore en cours est annoncé à part, pour savoir ce qui
       arrive. */
    /* Ce que le parrainage vous coûte, et ce qu'il vous rapporte.

       Les réductions : celles déjà accordées aux filleuls (leur location
       a eu lieu) et celles déjà offertes aux parrains, dans un seul
       montant — c'est la même poche.

       Le chiffre d'affaires : le total des locations arrivées par ce
       chemin. Celle de chaque filleul venu avec un code, et celle du
       parrain sur laquelle vous avez retiré ses 10 €. Une même location
       n'est comptée qu'une fois. */
    var totalFilleuls = 0, totalReste = 0, totalDeduits = 0;
    var remisesFilleuls = 0, remisesAVenir = 0;
    var ca = 0;
    var comptees = {};
    var compter = function (r) {
      if (!r || comptees[r.id]) return;
      comptees[r.id] = true;
      ca += totalResa(r);
    };

    calculees.forEach(function (c) {
      totalFilleuls += c.lignes.length;
      totalReste += c.reste;
      totalDeduits += c.deduits;
      c.lignes.forEach(function (l) {
        var montant = Number(l.u.montant) || c.f.remise;
        if (l.e.cle === 'acquis') { remisesFilleuls += montant; compter(l.e.resa); }
        else if (l.e.cle === 'validee') { remisesAVenir += montant; compter(l.e.resa); }
      });
      /* les locations du parrain sur lesquelles un avoir a été retiré */
      (c.f.deductions || []).forEach(function (d) {
        if (!d || !d.resaId) return;
        compter(planning.filter(function (r) { return String(r.id) === String(d.resaId); })[0]);
      });
    });

    var reductions = remisesFilleuls + totalDeduits;

    var chiffres = document.getElementById('pbChiffres');
    if (chiffres) {
      chiffres.innerHTML =
        carte('Codes créés', String(calculees.length), 'clients qui ont leur code de parrainage') +
        carte('Filleuls', String(totalFilleuls), 'personnes ayant saisi un code dans leur demande') +
        carte('Réductions offertes', euros(reductions),
              'filleuls et parrains réunis'
                + (totalReste ? ' — ' + euros(totalReste) + ' encore à offrir aux parrains' : '')
                + (remisesAVenir ? ', ' + euros(remisesAVenir) + ' à venir sur les réservations en cours' : ''),
              totalReste > 0) +
        carte('Chiffre d\u2019affaires généré', euros(ca),
              ca ? 'locations venues par le parrainage, remises comprises'
                 : 'aucune location par le parrainage pour l\u2019instant');
    }

    /* filtre et recherche */
    var q = sansAccents((document.getElementById('pbRech') || {}).value || '').trim();
    var filtre = (document.getElementById('pbFiltre') || {}).value || 'tous';
    var vues = calculees.filter(function (c) {
      if (filtre === 'du' && c.reste <= 0) return false;
      if (filtre === 'actifs' && !c.lignes.length) return false;
      if (filtre === 'inactifs' && c.lignes.length) return false;
      if (!q) return true;
      var foin = sansAccents([c.f.code, c.f.parrain, c.f.reference,
        c.lignes.map(function (l) { return (l.u.filleul || '') + ' ' + (l.u.email || '') + ' ' + (l.u.tel || ''); }).join(' ')].join(' '));
      return foin.indexOf(q) !== -1;
    });

    var compte = document.getElementById('pbCompte');
    if (compte) compte.textContent = vues.length
      ? vues.length + (vues.length > 1 ? ' codes' : ' code')
      : '';

    if (!calculees.length) {
      zone.innerHTML = '<div class="empty">Aucun code pour l’instant.<br>'
        + 'Vos clients créent le leur depuis la page Parrainage du site : '
        + '<a href="/parrainage" target="_blank" style="color:var(--navy);font-weight:600">vespraevent.fr/parrainage</a>.</div>';
      return;
    }
    if (!vues.length) {
      zone.innerHTML = '<div class="empty">Aucun code ne correspond à cette recherche.</div>';
      return;
    }

    zone.innerHTML = vues.map(bloc).join('');
    zone.querySelectorAll('[data-pb-deduire]').forEach(function (b) {
      b.addEventListener('click', function () { choisirLocation(b.getAttribute('data-pb-deduire'), b); });
    });
    zone.querySelectorAll('[data-pb-annuler]').forEach(function (b) {
      b.addEventListener('click', function () { deduire(b.getAttribute('data-pb-annuler'), -1, b); });
    });
    zone.querySelectorAll('[data-pb-supprimer]').forEach(function (b) {
      b.addEventListener('click', function () { supprimer(b.getAttribute('data-pb-supprimer'), b); });
    });
  }

  function carte(label, valeur, note, du) {
    return '<div class="pb-chiffre' + (du ? ' pb-du' : '') + '">'
      + '<div class="pb-chiffre-l">' + txt(label) + '</div>'
      + '<div class="pb-chiffre-v">' + txt(valeur) + '</div>'
      + '<div class="pb-chiffre-n">' + txt(note) + '</div></div>';
  }

  function bloc(c) {
    var f = c.f;
    /* Les filleuls sont repliés : un parrain qui en a dix ne doit pas
       occuper tout l'écran. Le résumé dit l'essentiel, le détail
       s'ouvre d'un clic. */
    var lignesFilleuls = c.lignes.map(function (l) {
      var det = [];
      /* tant que la réservation n'existe pas, la seule date connue est
         celle annoncée dans la demande ; ensuite c'est celle du planning */
      var quand = l.e.resa ? versISO(l.e.resa.dateStart) : '';
      if (quand) det.push('location du ' + jourFr(quand));
      else if (l.u.dateEvenement) det.push('date annoncée : ' + jourFr(l.u.dateEvenement));
      if (l.u.demande) det.push('demande du ' + jourFr(l.u.demande));
      if (l.u.email) det.push(l.u.email);
      return '<div class="pb-f">'
        + '<span class="pb-f-nom">' + txt(l.u.filleul || 'Filleul') + '</span>'
        + '<span class="pb-f-det">' + txt(det.join(' · ')) + '</span>'
        + '<span class="pb-etat pb-etat-' + l.e.cle + '">' + txt(l.e.mot) + '</span>'
        + '</div>';
    }).join('');

    var parEtat = { attente: 0, validee: 0, acquis: 0 };
    c.lignes.forEach(function (l) { parEtat[l.e.cle] = (parEtat[l.e.cle] || 0) + 1; });
    var resume = [];
    if (parEtat.acquis) resume.push(parEtat.acquis + ' dont la location a eu lieu');
    if (parEtat.validee) resume.push(parEtat.validee + ' réservé' + (parEtat.validee > 1 ? 's' : ''));
    if (parEtat.attente) resume.push(parEtat.attente + ' en cours');

    var filleuls = c.lignes.length
      ? '<details class="pb-repli">'
        + '<summary>'
        +   '<span class="pb-repli-t">' + c.lignes.length + ' filleul' + (c.lignes.length > 1 ? 's' : '') + '</span>'
        +   (resume.length ? '<span class="pb-repli-n">' + txt(resume.join(' · ')) + '</span>' : '')
        +   '<span class="pb-repli-c" aria-hidden="true">›</span>'
        + '</summary>'
        + '<div class="pb-repli-d">' + lignesFilleuls + '</div>'
        + '</details>'
      : '<div class="pb-vide">Ce code n’a pas encore été utilisé.</div>';

    var meta = [];
    if (f.cree) meta.push('code créé le ' + jourFr(f.cree));
    if (f.reference) meta.push('client au planning : ' + f.reference);

    return '<div class="pb-bloc">'
      + '<div class="pb-tete">'
      +   '<div class="pb-qui">'
      +     '<div class="pb-nom">' + txt(f.parrain || '—') + '</div>'
      +     '<div class="pb-meta">' + txt(meta.join(' · ')) + '</div>'
      +   '</div>'
      +   '<span class="pb-code">' + txt(f.code) + '</span>'
      + '</div>'
      + '<div class="pb-filleuls">' + filleuls + '</div>'
      + '<div class="pb-solde">'
      +   soldeC('Filleuls', String(c.lignes.length))
      +   soldeC('A gagné', euros(c.acquis))
      +   soldeC('Déjà offert', euros(c.deduits))
      +   soldeC('Vous lui devez', euros(c.reste), c.reste > 0)
      +   '<div class="pb-solde-a">'
      +     (c.reste > 0
              ? '<button class="btn btn-sm" type="button" data-pb-deduire="' + txt(f.code) + '">J\u2019ai offert 10 €</button>'
              : '')
      +     (c.deduits > 0
              ? '<button class="btn btn-sm btn-ghost" type="button" data-pb-annuler="' + txt(f.code) + '">Annuler</button>'
              : '')
      +     '<button class="btn btn-sm btn-ghost pb-sup" type="button" data-pb-supprimer="' + txt(f.code) + '">Supprimer le code</button>'
      +   '</div>'
      + '</div>'
      + '</div>';
  }
  function soldeC(label, valeur, du) {
    return '<div class="pb-solde-c' + (du ? ' pb-du' : '') + '">'
      + '<div class="pb-solde-l">' + txt(label) + '</div>'
      + '<div class="pb-solde-v">' + txt(valeur) + '</div></div>';
  }
  function txt(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── cocher (ou décocher) un avoir déduit ─────────────────── */
  async function deduire(code, sens, bouton, resaId) {
    var f = fiches.filter(function (x) { return x.code === code; })[0];
    if (!f) return;
    var montant = Number(f.remise) || 10;
    var avant = f.deduits;
    var avantListe = Array.isArray(f.deductions) ? f.deductions.slice() : [];

    f.deduits = Math.max(0, avant + sens * montant);
    /* On retient SUR QUELLE location l'avoir a été déduit : c'est ce qui
       permet de compter cette location dans le chiffre d'affaires du
       parrainage. Sans rattachement, seul le montant est retenu. */
    if (sens > 0) {
      f.deductions = avantListe.concat([{ resaId: resaId || '', montant: montant, at: new Date().toISOString() }]);
    } else {
      f.deductions = avantListe.slice(0, Math.max(0, avantListe.length - 1));
    }
    if (bouton) { bouton.disabled = true; bouton.textContent = 'Enregistrement…'; }
    try {
      await api('/data', {
        method: 'POST',
        body: JSON.stringify({ collection: 'parrainage', item: { id: f.code, d: JSON.stringify(f) } }),
      });
      if (typeof showToast === 'function') {
        showToast(sens > 0 ? '10 € notés comme offerts au parrain' : 'Annulé');
      }
      rendre();
    } catch (e) {
      f.deduits = avant;
      f.deductions = avantListe;
      if (typeof showToast === 'function') showToast('Enregistrement impossible : ' + (e.message || 'erreur'), true);
      rendre();
    }
  }

  /* ── à quelle location rattacher l'avoir ? ─────────────────
     Une petite question, une seule fois : sur quelle location du
     parrain avez-vous retiré les 10 € ? La réponse sert à compter
     cette location dans le chiffre d'affaires du parrainage. */
  function choisirLocation(code, bouton) {
    var f = fiches.filter(function (x) { return x.code === code; })[0];
    if (!f) return;
    var deja = (f.deductions || []).map(function (d) { return d.resaId; }).filter(Boolean);
    var siennes = resasDe(f.parrain).filter(function (r) { return deja.indexOf(String(r.id)) === -1; });

    if (!siennes.length) { deduire(code, 1, bouton, ''); return; }

    var zone = document.getElementById('contenuAvoir');
    zone.innerHTML =
      '<div class="fd-h"><span class="fd-nom">10 € offerts</span></div>' +
      '<div class="fd-recue">' + txt(f.parrain) + ' — sur quelle location avez-vous retiré les 10 € ?</div>' +
      '<div class="pb-choix">' +
        siennes.map(function (r) {
          return '<button type="button" class="pb-choix-l" data-resa="' + txt(r.id) + '">' +
            '<span class="pb-choix-d">' + txt(jourFr(versISO(r.dateStart))) + '</span>' +
            '<span class="pb-choix-m">' + txt(euros(totalResa(r))) + '</span></button>';
        }).join('') +
        '<button type="button" class="pb-choix-l pb-choix-sans" data-resa="">' +
          '<span class="pb-choix-d">Sans la rattacher à une location</span>' +
          '<span class="pb-choix-m">—</span></button>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" onclick="pbFermerAvoir()">Annuler</button>' +
      '</div>';
    zone.querySelectorAll('[data-resa]').forEach(function (b) {
      b.addEventListener('click', function () {
        window.pbFermerAvoir();
        deduire(code, 1, bouton, b.getAttribute('data-resa'));
      });
    });
    document.getElementById('modalAvoir').classList.add('open');
  }
  window.pbFermerAvoir = function () {
    document.getElementById('modalAvoir').classList.remove('open');
  };

  /* ── supprimer un code ────────────────────────────────────
     Un code créé par erreur, ou un client qui ne souhaite plus
     parrainer. Le code cesse d'être reconnu sur le site ; le client
     peut en recréer un plus tard depuis la page Parrainage — ce sera
     le même libellé, et le compteur de filleuls repartira de zéro. */
  async function supprimer(code, bouton) {
    var f = fiches.filter(function (x) { return x.code === code; })[0];
    var nb = f ? (f.utilisations || []).length : 0;
    var message = 'Supprimer le code ' + code + ' ?\n\n'
      + (nb ? 'Il a déjà servi à ' + nb + ' filleul' + (nb > 1 ? 's' : '')
              + ' : leur historique disparaîtra de cette page, et les avoirs correspondants avec.\n\n'
            : 'Il n\u2019a jamais été utilisé.\n\n')
      + 'Le code ne sera plus accepté sur le site. Le client pourra en recréer un depuis la page Parrainage.';
    if (!confirm(message)) return;

    if (bouton) { bouton.disabled = true; bouton.textContent = 'Suppression…'; }
    try {
      await api('/parrainage?code=' + encodeURIComponent(code), { method: 'DELETE' });
      fiches = fiches.filter(function (x) { return x.code !== code; });
      if (typeof showToast === 'function') showToast('Code ' + code + ' supprimé');
      rendre();
    } catch (e) {
      if (bouton) { bouton.disabled = false; bouton.textContent = 'Supprimer le code'; }
      if (typeof showToast === 'function') showToast('Suppression impossible : ' + (e.message || 'erreur'), true);
    }
  }

  /* ── la liste des clients à prévenir ──────────────────────
     Un fichier CSV des personnes qui ont loué sur l'année choisie,
     avec leur téléphone : c'est ce qu'attend n'importe quel service
     d'envoi de SMS. Un client qui a loué plusieurs fois n'y figure
     qu'une seule fois, avec sa dernière location.

     Les clients qui ont déjà leur code de parrainage y sont marqués,
     et leur code figure dans une colonne : vous pouvez ainsi l'écrire
     directement dans le message. */
  function exporterClients(annee) {
    var parClient = {};
    planning.forEach(function (r) {
      var tel = String(r.phone || '').replace(/[^0-9+]/g, '');
      var iso = versISO(r.dateStart);
      if (!r.client || !tel || !iso || iso.slice(0, 4) !== String(annee)) return;
      var k = cle(r.client);
      if (!parClient[k] || versISO(parClient[k].dateStart) < iso) parClient[k] = r;
    });

    var lignes = Object.keys(parClient).map(function (k) {
      var r = parClient[k];
      var f = fiches.filter(function (x) { return memePersonne(x.parrain, r.client); })[0];
      return {
        client: r.client,
        telephone: String(r.phone || '').replace(/\s+/g, ' ').trim(),
        email: r.email || '',
        derniere: jourFr(versISO(r.dateStart)),
        code: f ? f.code : '',
      };
    }).sort(function (a, b) { return a.client.localeCompare(b.client, 'fr'); });

    if (!lignes.length) {
      if (typeof showToast === 'function') showToast('Aucune location avec un téléphone en ' + annee, true);
      return;
    }

    var csv = '\uFEFF' + ['Client', 'Telephone', 'Email', 'Derniere location', 'Code de parrainage']
      .join(';') + '\r\n'
      + lignes.map(function (l) {
          return [l.client, l.telephone, l.email, l.derniere, l.code]
            .map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';');
        }).join('\r\n');

    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'clients-' + annee + '-parrainage.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    if (typeof showToast === 'function') showToast(lignes.length + ' client' + (lignes.length > 1 ? 's' : '') + ' exporté' + (lignes.length > 1 ? 's' : ''));
  }
  window.paExporterClients = function () {
    var annee = (document.getElementById('pbAnnee') || {}).value || new Date().getFullYear();
    exporterClients(annee);
  };

  /* ── points d'entrée utilisés par le back-office ──────────── */
  window.paChargerBO = function (force) { charger(force === true); };
  window.paRendreBO = rendre;
})();
