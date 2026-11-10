/* ─────────────────────────────────────────────────────────────
   NOTES DE FRAIS — carburant des livraisons faites avec le
   véhicule personnel du gérant, à rembourser par l'entreprise.

   Deux façons de remplir, et chaque champ se recalcule :
     • estimation : kilomètres × consommation (L/100) × prix au litre ;
     • plein réel : on saisit le montant payé, et la consommation
       du véhicule est déduite (montant ÷ prix = litres, puis
       litres ÷ kilomètres × 100).
   Chaque note est enregistrée (collection « notes-frais ») et
   rangée par trimestre. Le PDF est fabriqué par le serveur.
   ───────────────────────────────────────────────────────────── */
(function () {
  var notes = [];
  var source = 'calc';                         /* 'calc' : montant calculé · 'reel' : montant saisi */
  var BENEF = 'Thomas DEL\'HOMMEAU';
  var BASE = [BENEF, 'Damien MARION'];
  var el = function (id) { return document.getElementById(id); };
  var lire = function (id) { var v = parseFloat(String(el(id).value).replace(',', '.')); return isFinite(v) ? v : 0; };
  var fmt = function (n, d) { return (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ','); };
  var eur = function (n) { return fmt(n, 2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €'; };
  var gardeLoc = function (k, v) { try { if (v === undefined) return localStorage.getItem('vsNF_' + k); localStorage.setItem('vsNF_' + k, v); } catch (e) {} };

  function trimestre(date) {
    var m = /^(\d{4})-(\d{2})/.exec(String(date || ''));
    if (!m) return { cle: '0000-0', nom: 'Sans date' };
    var t = Math.ceil(parseInt(m[2], 10) / 3);
    return { cle: m[1] + '-' + t, nom: 'T' + t + ' ' + m[1] };
  }
  function jour(date) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  function aujourdhui() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  /* ── bénéficiaires : deux par défaut + ceux qu'on ajoute ── */
  function extras() { try { return JSON.parse(gardeLoc('benefs') || '[]'); } catch (e) { return []; } }
  function remplirBenef(choisi) {
    var s = el('nfBenef'), liste = BASE.concat(extras().filter(function (x) { return BASE.indexOf(x) < 0; }));
    s.innerHTML = liste.map(function (b) { return '<option value="' + esc(b) + '">' + esc(b) + '</option>'; }).join('')
      + '<option value="__new__">+ Ajouter une personne…</option>';
    s.value = liste.indexOf(choisi) >= 0 ? choisi : liste[0];
  }
  window.nfBenefChoix = function () {
    var nv = el('nfBenefNouv');
    if (el('nfBenef').value === '__new__') { nv.style.display = ''; nv.value = ''; nv.focus(); } else nv.style.display = 'none';
  };
  window.nfBenefAjout = function () {
    var nv = el('nfBenefNouv'), nom = nv.value.trim();
    if (nv.style.display === 'none') return;
    nv.style.display = 'none';
    if (!nom) { remplirBenef(gardeLoc('benef')); return; }
    var l = extras(); if (l.indexOf(nom) < 0 && BASE.indexOf(nom) < 0) l.push(nom);
    gardeLoc('benefs', JSON.stringify(l)); remplirBenef(nom);
  };

  /* ── type : carburant (calculé) ou autre dépense (montant seul) ── */
  var CATS = ['Carburant', 'Péage', 'Restaurant', 'Parking', 'Matériel', 'Autre'];
  var extrasCat = function () { try { return JSON.parse(gardeLoc('cats') || '[]'); } catch (e) { return []; } };
  var autre = function () { return el('nfType') && el('nfType').value !== 'carburant'; };
  var catNom = function () { var v = el('nfType').value; return v === 'carburant' ? 'Carburant' : v; };
  function remplirCats(choisi) {
    var s = el('nfType'), liste = CATS.slice(1).concat(extrasCat().filter(function (x) { return CATS.indexOf(x) < 0; }));
    s.innerHTML = '<option value="carburant">Carburant</option>' + liste.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('')
      + '<option value="__new__">+ Ajouter une catégorie…</option>';
    s.value = (choisi && (choisi === 'carburant' || liste.indexOf(choisi) >= 0)) ? choisi : 'carburant';
  }
  window.nfCatAjout = function () {
    var nv = el('nfTypeNouv'), nom = nv.value.trim();
    if (nv.style.display === 'none') return;
    nv.style.display = 'none';
    if (!nom) { remplirCats('carburant'); window.nfType(); return; }
    var l = extrasCat(); if (l.indexOf(nom) < 0 && CATS.indexOf(nom) < 0) l.push(nom);
    gardeLoc('cats', JSON.stringify(l)); remplirCats(nom); window.nfType();
  };
  window.nfType = function () {
    var nv = el('nfTypeNouv');
    if (el('nfType').value === '__new__') { nv.style.display = ''; nv.value = ''; nv.focus(); return; }
    nv.style.display = 'none';
    var a = autre();
    document.querySelector('.nf-form').classList.toggle('nf-autre', a);
    el('nfMotifLib').textContent = a ? 'Détail (facultatif)' : 'Destination / motif';
    el('nfMotif').placeholder = a ? 'ex. A84 Rennes, déjeuner client' : 'ex. Livraison mariage, Fougères';
    if (a) { source = 'reel'; el('nfMontant').focus(); } else { source = String(el('nfMontant').value).trim() ? 'reel' : 'calc'; }
    window.nfCalc();
  };

  /* ── calcul en direct ───────────────────────────────────── */
  window.nfCalc = function (qui) {
    if (autre()) { var m0 = lire('nfMontant'); el('nfBilan').textContent = m0 > 0 ? eur(m0) : 'Renseignez le montant payé.'; return; }
    var km = lire('nfKm'), conso = lire('nfConso'), prix = lire('nfPrix');
    if (qui === 'montant') source = String(el('nfMontant').value).trim() ? 'reel' : 'calc';
    else if (qui === 'conso') source = 'calc';
    var litres = 0, montant = lire('nfMontant');
    if (source === 'reel') {
      litres = prix > 0 ? montant / prix : 0;
      if (km > 0 && litres > 0) { conso = litres / km * 100; el('nfConso').value = fmt(conso, 2); }
    } else {
      litres = km * conso / 100;
      montant = Math.round(litres * prix * 100) / 100;
      el('nfMontant').value = montant ? fmt(montant, 2) : '';
    }
    el('nfBilan').textContent = km > 0 && (litres > 0)
      ? fmt(litres, 2) + ' L · ' + fmt(conso, 2) + ' L/100 km · ' + eur(montant) + (source === 'reel' ? ' (montant réel du plein)' : '')
      : 'Renseignez les kilomètres, la consommation et le prix au litre.';
    gardeLoc('conso', source === 'calc' && conso ? String(conso) : gardeLoc('conso') || '');
    if (prix) gardeLoc('prix', String(prix));
  };

  /* ── liste ───────────────────────────────────────────────── */
  function lignes() {
    return notes.slice().sort(function (a, b) { return (b.date + b.cree).localeCompare(a.date + a.cree); });
  }
  function rendre() {
    var zone = el('nfListe'); if (!zone) return;
    if (!notes.length) { zone.innerHTML = '<div class="nf-vide">Aucune note de frais pour le moment.</div>'; return; }
    var groupes = {}, ordre = [];
    lignes().forEach(function (n) {
      var t = trimestre(n.date);
      if (!groupes[t.cle]) { groupes[t.cle] = { nom: t.nom, items: [] }; ordre.push(t.cle); }
      groupes[t.cle].items.push(n);
    });
    ordre.sort().reverse();
    zone.innerHTML = ordre.map(function (cle) {
      var g = groupes[cle];
      var tot = g.items.reduce(function (s, n) { return s + (+n.montant || 0); }, 0);
      var km = g.items.reduce(function (s, n) { return s + (+n.km || 0); }, 0);
      return '<section class="nf-trim"><header><div><b>' + esc(g.nom) + '</b> <span>' + g.items.length + ' note' + (g.items.length > 1 ? 's' : '') + ' · ' + fmt(km, km % 1 ? 1 : 0) + ' km</span></div>'
        + '<div class="nf-droite"><strong>' + eur(tot) + '</strong><button class="nf-lien" type="button" onclick="nfPdfTrimestre(\'' + cle + '\')">Télécharger le trimestre</button></div></header>'
        + g.items.map(function (n) {
          return '<div class="nf-ligne"><span class="nf-n">' + esc(n.numero || '') + '</span><span class="nf-d">' + jour(n.date) + '</span>'
            + '<span class="nf-m">' + esc(n.motif || '—') + '</span><span class="nf-k">' + ((+n.km) > 0 ? fmt(+n.km, (+n.km) % 1 ? 1 : 0) + ' km' : '') + '</span>'
            + '<span class="nf-e">' + eur(+n.montant || 0) + '</span>'
            + '<span class="nf-a"><button class="nf-lien" type="button" onclick="nfPdf(\'' + esc(n.id) + '\')">PDF</button>'
            + '<button class="nf-lien nf-sup" type="button" onclick="nfSupprimer(\'' + esc(n.id) + '\')" aria-label="Supprimer">×</button></span></div>';
        }).join('')
        + '</section>';
    }).join('');
  }

  window.nfCharger = async function () {
    if (!el('nfDate').value) {
      el('nfDate').value = aujourdhui();
      remplirBenef(gardeLoc('benef') || BENEF); remplirCats('carburant');
      window.nfCalc();
    }
    try {
      var l = await api('/data?collection=notes-frais');
      notes = (l || []).filter(function (x) { return x && x.id && x.date; });
      rendre();
    } catch (e) { el('nfListe').innerHTML = '<div class="nf-vide">' + esc(e.message) + '</div>'; }
  };

  /* ── PDF ─────────────────────────────────────────────────── */
  async function telecharger(corps, nom) {
    var rep = await fetch('/api/admin/note-frais', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) });
    if (!rep.ok) { var d = await rep.json().catch(function () { return {}; }); throw new Error(d.error || ('Erreur ' + rep.status)); }
    var b = await rep.blob();
    var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nom + '.pdf';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function dessin(n) { return { numero: n.numero, date: n.date, motif: n.motif, km: +n.km, conso: +n.conso, prix: +n.prix, litres: +n.litres, montant: +n.montant }; }
  window.nfPdf = async function (id) {
    var n = notes.filter(function (x) { return x.id === id; })[0]; if (!n) return;
    try { await telecharger({ notes: [dessin(n)], beneficiaire: n.benef || el('nfBenef').value, reference: n.numero, fichier: n.numero }, n.numero || 'note-de-frais'); }
    catch (e) { showToast(e.message, true); }
  };
  window.nfPdfTrimestre = async function (cle) {
    var items = lignes().filter(function (n) { return trimestre(n.date).cle === cle; }).reverse();
    if (!items.length) return;
    var nom = trimestre(items[0].date).nom;
    try { await telecharger({ notes: items.map(dessin), beneficiaire: (items[0] && items[0].benef) || BENEF, titre: 'Récapitulatif — ' + nom, reference: 'Récapitulatif ' + nom, fichier: 'notes-de-frais-' + nom.replace(' ', '-') }, 'notes-de-frais-' + nom.replace(' ', '-')); }
    catch (e) { showToast(e.message, true); }
  };

  /* ── générer / supprimer ──────────────────────────────── */
  window.nfGenerer = async function () {
    if (el('nfType').value === '__new__') { showToast('Choisissez une catégorie.', true); return; }
    var a = autre();
    var km = a ? 0 : lire('nfKm'), montant = lire('nfMontant'), prix = a ? 0 : lire('nfPrix'), conso = a ? 0 : lire('nfConso');
    var date = el('nfDate').value || aujourdhui();
    if (el('nfBenef').value === '__new__') { showToast('Choisissez un bénéficiaire.', true); return; }
    if (a && !(montant > 0)) { showToast('Renseignez le montant payé.', true); return; }
    if (!a && (!(km > 0) || !(montant > 0))) { showToast('Renseignez les kilomètres et le carburant (consommation et prix au litre, ou montant payé).', true); return; }
    var an = date.slice(0, 4);
    var max = 0;
    notes.forEach(function (n) { var m = new RegExp('^NF-' + an + '-(\\d+)$').exec(n.numero || ''); if (m) max = Math.max(max, +m[1]); });
    var litres = a ? 0 : (prix > 0 ? montant / prix : km * conso / 100);
    var n = {
      id: 'nf-' + Date.now(), numero: 'NF-' + an + '-' + String(max + 1).padStart(3, '0'), date: date,
      motif: a ? (catNom() + (el('nfMotif').value.trim() ? ' — ' + el('nfMotif').value.trim() : '')) : el('nfMotif').value.trim(), categorie: a ? catNom() : 'Carburant', type: a ? 'autre' : 'carburant', km: String(km), conso: String(Math.round(conso * 100) / 100), prix: String(prix),
      litres: String(Math.round(litres * 100) / 100), montant: String(Math.round(montant * 100) / 100), source: source,
      benef: el('nfBenef').value === '__new__' ? '' : el('nfBenef').value.trim(), cree: new Date().toISOString(),
    };
    var bouton = el('nfGo'); bouton.disabled = true;
    try {
      await api('/data', { method: 'POST', body: JSON.stringify({ collection: 'notes-frais', item: n }) });
      gardeLoc('benef', n.benef);
      notes.push(n); rendre();
      el('nfMotif').value = ''; el('nfKm').value = ''; el('nfMontant').value = ''; source = 'calc'; window.nfCalc();
      await telecharger({ notes: [dessin(n)], beneficiaire: n.benef, reference: n.numero, fichier: n.numero }, n.numero);
      showToast('Note de frais ' + n.numero + ' enregistrée');
    } catch (e) { showToast(e.message, true); }
    bouton.disabled = false;
  };
  window.nfSupprimer = async function (id) {
    if (!confirm('Supprimer cette note de frais ?')) return;
    try { await api('/data?collection=notes-frais&id=' + encodeURIComponent(id), { method: 'DELETE' }); notes = notes.filter(function (n) { return n.id !== id; }); rendre(); }
    catch (e) { showToast(e.message, true); }
  };
})();
