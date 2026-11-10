/* ============================================================
   Vespra Event — notification e-mail sur soumission de formulaire
   Déclenchée par Netlify à chaque envoi de formulaire vérifié.
   Envoie un e-mail mis en forme via l'API Resend.

   Variables d'environnement à définir dans Netlify :
     RESEND_API_KEY   clé API Resend (commence par re_)
     NOTIFY_TO        adresse qui reçoit les notifications
     NOTIFY_FROM      expéditeur, ex. "Vespra Event <devis@vespraevent.fr>"
   ============================================================ */

const NAVY = '#2B4A6B', GOLD = '#F59E0B', DARK = '#0C0F14';
const G1 = '#3D4452', G2 = '#646D7C', G3 = '#C8CDD8', G4 = '#F0F2F5';

/* Met en forme les dates ISO (2026-07-18) en français */
const frDate = v => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v ?? '').trim());
  if (!m) return v;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
  return isNaN(d) ? v : d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
};

const esc = v => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* Libellés lisibles pour les noms de champs techniques */
const LABELS = {
  demande: 'Nature de la demande',
  nom: 'Nom', prenom: 'Prénom', email: 'E-mail', telephone: 'Téléphone',
  tel: 'Téléphone', type: "Type d'événement", 'type-evenement': "Type d'événement",
  date: 'Date de l’événement', heure: 'Heure souhaitée', convives: 'Nombre de convives',
  livraison: 'Livraison', adresse_livraison: 'Adresse de livraison',
  client_type: 'Vous êtes', societe: 'Société / association', siret: 'SIRET', tva: 'N° de TVA',
  source: 'Source', message: 'Message', produit: 'Produit', note: 'Note', avis: 'Avis',
  livraison_installation: 'Livraison et installation', reprise_materiel: 'Reprise du matériel', adresse_livraison: 'Adresse de livraison',
  /* cases cochées dans le formulaire de la page d'accueil */
  interets: 'Catégories choisies', materiel: 'Matériel souhaité',
};

/* Champs à ne jamais afficher tels quels */
const HIDDEN = new Set(['form-name', 'subject', 'bot-field', 'ref_espace', 'conditions_acceptees', 'donnees_acceptees', 'cartData', 'catsData', 'details_devis',
  /* le parrainage a son propre encadré, plus lisible qu'une ligne de tableau */
  'parrainage', 'parrainage_remise', 'pack_mariage', 'reprise',
  'ip', 'user_agent', 'referrer', 'user-agent', 'from', 'title', 'created_at', 'site_url']);

const row = (label, value, mono) => `
  <tr>
    <td style="padding:11px 0;border-bottom:1px solid ${G4};color:${G2};font-size:13px;width:38%;vertical-align:top">${esc(label)}</td>
    <td style="padding:11px 0;border-bottom:1px solid ${G4};color:${DARK};font-size:14px;font-weight:600${mono ? ';font-family:monospace' : ''}">${value}</td>
  </tr>`;

/* Prestations sur devis (serveuse, chef pâtissier) : le tableau des produits
   n'affiche que le nom ; le reste (arrivée, fin, allergies, rendez-vous,
   message) est présenté à part, proprement. Le type d'événement, la date
   et le nombre d'invités sont déjà dans « Détails » : on ne les répète pas. */
const videP = v => { v = String(v == null ? '' : v).trim(); return /^(\/|-|—|\.|non|aucune?|rien|ras|n\/a)$/i.test(v) ? '' : v; };
function extractPresta(it) {
  const d = it && it.details;
  if (d && typeof d === 'object') {
    return { rdv: videP(d.rdv), moment: videP(d.moment), arrivee: videP(d.arrivee), fin: videP(d.fin), allergies: videP(d.allergies), message: videP(d.message) };
  }
  if (!(it && (it.prestation === true || /sur devis\s*$/i.test(String(it.produit || it.baseName || it.name || ''))))) return null;
  const txt = [it.formule, it.variante, it.options, it.label].filter(Boolean).join(' · ');
  if (!/RDV souhait/i.test(txt)) return null;
  const r = { rdv: '', moment: '', arrivee: '', fin: '', allergies: '', message: '' }, rest = [];
  txt.split(/\s+·\s+|\s+—\s+/).forEach(b => {
    b = b.trim(); let m;
    if ((m = b.match(/^RDV souhaité\s*:\s*(\d{2}\/\d{2}\/\d{4})\s*(?:\(([^)]*)\))?/i))) { r.rdv = m[1]; r.moment = m[2] || ''; }
    else if ((m = b.match(/^Allergies\s*:\s*(.*)$/i))) r.allergies = videP(m[1]);
    else if ((m = b.match(/^Arrivée\s+(.*)$/i))) r.arrivee = m[1];
    else if ((m = b.match(/^Fin\s+(.*)$/i))) r.fin = m[1];
    else if (/^\d{2}\/\d{2}\/\d{4}$/.test(b) || /invités?$/i.test(b)) { /* déjà dans « Détails » */ }
    else rest.push(b);
  });
  /* le premier morceau restant est le type d'événement (déjà dans « Détails ») */
  if (rest.length) rest.shift();
  r.message = rest.join(' · ');
  return r;
}
function prestaBlock(...raws) {
  const out = [];
  raws.flatMap(parseList).forEach(it => {
    const x = extractPresta(it); if (!x) return;
    const nom = String(it.produit || it.baseName || it.name || '').replace(/\s*[—-]\s*sur devis\s*$/i, '');
    const rows = [
      x.arrivee && ['Arrivée sur place', x.arrivee],
      x.fin && ['Fin souhaitée', x.fin],
      x.allergies && ['Allergies / contraintes', x.allergies],
      x.rdv && ['Rendez-vous souhaité', frDate(x.rdv) + (x.moment ? ' · ' + x.moment.toLowerCase() : '')],
      x.message && ['Précisions', x.message],
    ].filter(Boolean).map(([k, v]) => row(k, esc(v))).join('');
    if (!rows) return;
    out.push(`
  <h2 style="margin:30px 0 4px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:${NAVY}">${esc(nom)} · détails</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows}</table>`);
  });
  return out.join('');
}

/* Tableau des produits demandés : panier + sélection par catégories */
const parseList = raw => {
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
};
function cartTable(...raws) {
  const seen = new Set();
  const items = raws.flatMap(parseList).filter(it => {
    const k = [
      it.produit || it.baseName || it.name || '',
      it.variante || it.variant || it.formule || '',
      it.options || it.option || it.optsLabel || it.label || ''
    ].join('|');
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
  /* Le formulaire de la page d'accueil ne propose pas de choisir des
     produits, seulement des catégories : afficher « aucun produit
     sélectionné » n'y apprenait rien et alourdissait le message. Sans
     panier, on n'affiche simplement pas ce bloc. */
  if (!items.length) return '';
  let total = 0, devis = false;
  const lines = items.map(it => {
    const p = Number(String(it.prix ?? it.price ?? '').replace(/[^\d.]/g, '')) || 0;
    if (/devis/i.test(String(it.prix ?? ''))) devis = true; else total += p;
    const det = [];
    let variante = it.variante || it.variant || it.formule || '';
    let options = it.options || it.option || it.optsLabel || '';
    if (Array.isArray(options)) options = options.map(o => typeof o === 'string' ? o : (o && (o.label || o.name)) || '').filter(Boolean).join(', ');
    // Pour les anciens paniers, le libellé contient directement la personnalisation
    // (ex. « 4 canons à poudre — Bleu, Rouge, Blanc, Violet »).
    /* Vieux paniers et formulaires anciens : tout est dans le libellé
       (« 12 canons — 5 Bleu, 7 Jaune »). On le coupe pour retrouver la
       formule d'un côté et le détail de l'autre. */
    const estPresta = !!extractPresta(it);
    if (estPresta) { variante = ''; options = ''; }
    else if (!variante && !options && it.label) {
      const bouts = String(it.label).split(/\s+—\s+|\s+·\s+/);
      variante = bouts.shift() || '';
      options = bouts.join(' · ');
    } else if (!options && it.label && !estPresta) {
      options = it.label;
    }
    const qte = Number(it.quantite ?? it.qty ?? 1) || 1;
    if (variante) det.push(`<span style="color:${G2}">Formule&nbsp;:</span> <strong>${esc(variante)}</strong>`);
    if (options) det.push(`<span style="color:${G2}">Détail du choix&nbsp;:</span> ${esc(options)}`);
    if (qte > 1) det.push(`<span style="color:${G2}">Quantité&nbsp;:</span> <strong>${qte}</strong>`);
    const opts = det.length
      ? `<div style="margin-top:4px;font-size:12.5px;font-weight:400;color:${G1};line-height:1.6">${det.join('<br>')}</div>`
      : '';
    return `<tr>
      <td style="padding:12px;border-bottom:1px solid ${G4};font-size:14px;color:${DARK};font-weight:600">${esc(it.produit || it.baseName || it.name || '')}${opts}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${G4};font-size:14px;color:${NAVY};font-weight:700;text-align:right;white-space:nowrap">${esc(it.prix ?? (p + ' €'))}</td>
    </tr>`;
  }).join('');
  return `
  <h2 style="margin:32px 0 12px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:${NAVY}">Produits demandés</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff;border:1px solid ${G4};border-radius:8px;overflow:hidden">
    ${lines}
    <tr>
      <td style="padding:14px 12px;font-size:14px;font-weight:700;color:${DARK};background:${G4}">Total estimé</td>
      <td style="padding:14px 12px;font-size:16px;font-weight:700;color:${NAVY};text-align:right;background:${G4};white-space:nowrap">${total ? total + ' €' + (devis ? ' + sur devis' : '') : (devis ? 'Sur devis' : '0 €')}</td>
    </tr>
  </table>`;
}

/* Récapitulatif joint à l'accusé de réception (date, matériel, livraison) */
function recapAccuse(data) {
  try {
    const items = parseList(data.cartData);
    let total = 0, surDevis = false;
    const lignes = items.slice(0, 20).map((it) => {
      const brut = String(it.prix ?? it.price ?? '');
      const p = Number(brut.replace(/[^\d.]/g, '')) || 0;
      if (/devis/i.test(brut)) surDevis = true; else total += p;
      let det = it.variante || it.variant || it.formule || '';
      let opt = it.options || it.option || it.optsLabel || '';
      if (Array.isArray(opt)) opt = opt.map((o) => typeof o === 'string' ? o : (o && (o.label || o.name)) || '').filter(Boolean).join(', ');
      if (!det && !opt && it.label) { const b = String(it.label).split(/\s+—\s+|\s+·\s+/); det = b.shift() || ''; opt = b.join(' · '); }
      if (extractPresta(it)) { det = ''; opt = ''; }
      const qte = Number(it.quantite ?? it.qty ?? 1) || 1;
      const detail = [det, opt, qte > 1 ? 'Quantité : ' + qte : ''].filter(Boolean).join(' · ');
      return { nom: String(it.produit || it.baseName || it.name || '').slice(0, 120), detail: detail.slice(0, 240), prix: /devis/i.test(brut) ? 'Sur devis' : (p ? p + ' €' : '') };
    }).filter((x) => x.nom);
    const livraison = String(data.livraison || '').toLowerCase() === 'oui';
    return { date: String(data.date || '').slice(0, 60), items: lignes, total, surDevis, livraison,
      adresse: livraison ? String(data.adresse_livraison || '').slice(0, 200) : '',
      reprise: livraison ? String(data.reprise_materiel || '').replace(/^Oui\s*[—-]\s*/i, '').slice(0, 120) : '' };
  } catch { return null; }
}

function buildHtml(kind, data) {
  const nom = [data.prenom, data.nom].filter(Boolean).join(' ') || 'Client';
  const mail = data.email || '';
  const tel = data.telephone || data.tel || '';

  const contact = `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${G4};border-radius:10px;margin:0 0 8px">
    <tr><td style="padding:20px 22px">
      <div style="font-size:19px;font-weight:700;color:${DARK};margin-bottom:10px">${esc(nom)}</div>
      ${mail ? `<div style="margin-bottom:5px"><a href="mailto:${esc(mail)}" style="color:${NAVY};font-size:15px;text-decoration:none;font-weight:600">${esc(mail)}</a></div>` : ''}
      ${tel ? `<div><a href="tel:${esc(tel.replace(/\s/g, ''))}" style="color:${NAVY};font-size:15px;text-decoration:none;font-weight:600">${esc(tel)}</a></div>` : ''}
    </td></tr>
  </table>`;

  /* Livraison : une seule ligne claire (livraison, installation, reprise), « Source » toujours en dernier. */
  const oui = (x) => /^(oui|yes|1|true)/i.test(String(x == null ? '' : x).trim());
  const livOui = oui(data.livraison) || oui(data.livraison_installation);
  const parts = ['livraison'];
  if (oui(data.livraison_installation)) parts.push('installation');
  if (oui(data.reprise_materiel)) parts.push('reprise');
  const livTxt = 'Oui — ' + (parts.length > 1 ? parts.slice(0, -1).join(', ') + ' et ' + parts[parts.length - 1] : parts[0]);
  const ordered = [];
  let livDone = false, srcEntry = null;
  Object.entries(data).forEach(([k, v]) => {
    if (k === 'source') { srcEntry = [k, v]; return; }
    if (k === 'reprise_materiel' || k === 'livraison_installation') return;
    if (k === 'livraison') { if (livOui) { ordered.push(['livraison', livTxt]); livDone = true; } return; }
    ordered.push([k, v]);
  });
  if (livOui && !livDone) ordered.unshift(['livraison', livTxt]);
  if (srcEntry) ordered.push(srcEntry);

  const details = ordered
    .filter(([k, v]) => {
      if (HIDDEN.has(k) || !v || ['nom','prenom','email','telephone','tel','message','avis'].includes(k)) return false;
      // Ne pas alourdir le mail avec « Livraison : Non ». On affiche la livraison
      // uniquement lorsqu'elle est réellement demandée, ainsi que son adresse.
      if (k === 'livraison' || k === 'livraison_installation') return /^(oui|yes|1|true)/i.test(String(v).trim());
      return true;
    })
    .map(([k, v]) => {
      if (k === 'note') {
        const n = Math.max(0, Math.min(5, parseInt(v, 10) || 0));
        return row('Note', `<span style="color:${GOLD};font-size:17px;letter-spacing:2px">${'★'.repeat(n)}<span style="color:#d4d8e0">${'★'.repeat(5 - n)}</span></span> <span style="color:${G2};font-size:13px;font-weight:400">${n}/5</span>`);
      }
      return row((k === 'date' && kind.badge === 'Rendez-vous') ? 'Jour souhaité' : (LABELS[k] || k), esc(/date/i.test(k) ? frDate(v) : v));
    })
    .join('');

  /* ── Parrainage ────────────────────────────────────────────────
     La remise n'est pas déduite du total affiché dans ce message :
     elle est signalée à part, pour que vous sachiez quoi retirer en
     établissant le devis. Le nom du parrain se retrouve dans le
     back-office, onglet Parrainage. */
  const codeParrain = String(data.parrainage || '').trim().toUpperCase();
  const parrainBlock = codeParrain ? `
  <h2 style="margin:30px 0 12px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#15803d">Parrainage</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f0f7f2;border-left:3px solid #15803d;border-radius:0 8px 8px 0">
    <tr><td style="padding:16px 20px;font-size:15px;line-height:1.7;color:${G1}">
      Code utilisé&nbsp;: <strong style="color:${DARK};font-family:Menlo,Consolas,monospace;letter-spacing:.06em">${esc(codeParrain)}</strong><br>
      <strong style="color:#15803d">Remise de 10 € à déduire de ce devis.</strong><br>
      <span style="font-size:13.5px;color:${G2}">Le parrain gagne 10 € une fois cette location passée — à retrouver dans le back-office, onglet Parrainage.</span>
    </td></tr>
  </table>` : '';

  /* ── Pack mariage ──────────────────────────────────────────────
     Remise de 10 % obtenue à partir de 5 produits choisis depuis la
     page « Pack mariage » : à déduire du total des locations. */
  const packInfo = String(data.pack_mariage || '').trim();
  const packBlock = packInfo ? `
  <h2 style="margin:30px 0 12px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#9a3412">Pack mariage</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff7ed;border-left:3px solid #ea580c;border-radius:0 8px 8px 0">
    <tr><td style="padding:16px 20px;font-size:15px;line-height:1.7;color:${G1}">
      <strong style="color:#9a3412">${esc(packInfo.replace(/^Oui\s*—\s*/, ''))}</strong><br>
      <span style="font-size:13.5px;color:${G2}">La remise porte sur le total des locations, livraison exclue. Elle est cumulable avec un code de parrainage.</span>
    </td></tr>
  </table>` : '';

  const msg = data.message || data.avis;
  const msgBlock = msg ? `
  <h2 style="margin:32px 0 12px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:${NAVY}">Message</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff;border-left:3px solid ${GOLD};border-radius:0 8px 8px 0">
    <tr><td style="padding:16px 20px;font-size:15px;line-height:1.7;color:${G1};white-space:pre-wrap">${esc(msg)}</td></tr>
  </table>` : '';

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(kind.title)}</title></head>
<body style="margin:0;padding:0;background:#eef0f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#eef0f4">
  <tr><td align="center" style="padding:28px 14px">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.07)">

      <tr><td style="background:${NAVY};padding:26px 30px">
        <div style="font-size:22px;font-weight:800;letter-spacing:.16em;color:#fff">VESPRA EVENT</div>
        <div style="font-size:12px;color:rgba(255,255,255,.62);margin-top:3px">Location de matériel événementiel — Vitré</div>
      </td></tr>

      <tr><td style="padding:26px 30px 0">
        <div style="display:inline-block;background:${kind.bg};color:${kind.fg};font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;padding:6px 13px;border-radius:999px">${esc(kind.badge)}</div>${kind.ref ? `<span style="float:right;font-size:11px;color:${G2};letter-spacing:.08em;padding-top:8px">RÉF. ${esc(kind.ref)}</span>` : ''}
        <h1 style="margin:16px 0 22px;font-size:23px;line-height:1.3;color:${DARK};font-weight:700">${esc(kind.title)}</h1>
        ${contact}
        ${details ? `<h2 style="margin:30px 0 4px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:${NAVY}">Détails</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${details}</table>` : ''}
        ${kind.review ? '' : cartTable(data.cartData, data.catsData)}
        ${kind.review ? '' : prestaBlock(data.cartData)}
        ${kind.review ? '' : packBlock}
        ${kind.review ? '' : parrainBlock}
        ${msgBlock}
      </td></tr>

      <tr><td style="padding:30px">
        ${kind.review
          ? (kind.link
              ? `<a href="${kind.link}" style="display:block;background:#15803d;color:#fff;text-align:center;padding:16px;border-radius:999px;font-size:16px;font-weight:700;text-decoration:none">Publier cet avis sur le site</a>
                 <div style="margin-top:14px;text-align:center;font-size:13.5px;line-height:1.7;color:${G2}">
                   Un seul clic suffit, l'avis apparaît sur la fiche produit dans la minute.<br>
                   <strong style="color:${G1}">Si l'avis ne vous convient pas, ne cliquez pas :</strong> rien ne sera publié.
                 </div>`
              : `<div style="background:#f0f7f2;border-left:3px solid #15803d;border-radius:0 8px 8px 0;padding:16px 20px;font-size:14px;line-height:1.7;color:${G1}">
                   <strong style="color:${DARK}">Publication en un clic non configurée</strong><br>
                   Ajoutez les variables <strong>NETLIFY_ACCESS_TOKEN</strong> et <strong>AVIS_SECRET</strong> dans Netlify pour obtenir un bouton ici. En attendant, collez la ligne ci-dessous dans le fichier <strong>avis.js</strong> du site.
                 </div>
                 <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:12px;background:#0C0F14;border-radius:8px">
                   <tr><td style="padding:16px 18px;font-family:Menlo,Consolas,'Courier New',monospace;font-size:13px;line-height:1.6;color:#e6e9ef;word-break:break-word">${esc(reviewLine(data))}</td></tr>
                 </table>`)
          : (mail ? `<a href="mailto:${esc(mail)}?subject=${encodeURIComponent('Votre demande — Vespra Event')}" style="display:block;background:${NAVY};color:#fff;text-align:center;padding:15px;border-radius:999px;font-size:15px;font-weight:700;text-decoration:none">Répondre au client</a>` : '')}
      </td></tr>

      <tr><td style="background:${DARK};padding:20px 30px;text-align:center">
        <div style="font-size:12px;color:rgba(255,255,255,.4)">Reçu via vespraevent.fr — ${new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

import { validationLink } from './avis.mjs';

/* Repli : ligne à coller si la validation en un clic n'est pas configurée */
function reviewLine(data) {
  const q = v => (v || '').toString().replace(/\\/g, '').replace(/"/g, "'").replace(/\s+/g, ' ').trim();
  const mois = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const note = Math.max(1, Math.min(5, parseInt(data.note, 10) || 5));
  return `{p:"${q(data.produit)}", n:"${q(data.nom || data.prenom)}", s:${note}, t:"${q(data.avis || data.message)}", d:"${mois.charAt(0).toUpperCase() + mois.slice(1)}"},`;
}

const KINDS = {
  devis:       { badge: 'Demande de devis', title: 'Nouvelle demande de devis', bg: 'rgba(43,74,107,.1)',  fg: NAVY },
  reservation: { badge: 'Réservation',      title: 'Nouvelle réservation à traiter', bg: 'rgba(245,158,11,.15)', fg: '#92400e' },
  'avis-produit': { badge: 'Avis client',   title: 'Nouvel avis client à valider', bg: 'rgba(34,197,94,.12)', fg: '#15803d', review: true },
  'rendez-vous': { badge: 'Rendez-vous', title: 'Demande de rendez-vous (visite du matériel)', bg: 'rgba(245,158,11,.15)', fg: '#92400e' },
  newsletter:  { badge: 'Newsletter',       title: 'Nouvelle inscription à la newsletter', bg: 'rgba(43,74,107,.1)', fg: NAVY },
  disponibilite: { badge: 'Disponibilité',  title: 'Demande de disponibilité', bg: 'rgba(245,158,11,.15)', fg: '#92400e' },
};

/* Netlify ne transmet pas toujours le champ form-name : on déduit alors
   le type de formulaire à partir des données elles-mêmes. */
function detectForm(formName, data) {
  // un avis se reconnaît à ses champs, quel que soit ce que Netlify transmet
  if (data.note || data.avis || /avis/i.test(data.subject || '')) return 'avis-produit';
  if (formName && KINDS[formName]) return formName;
  if (data.email && !data.message && !data.demande && Object.keys(data).length <= 3) return 'newsletter';
  if (data.demande || data.cartData) return 'reservation';
  return formName || 'devis';
}

import { getStore } from './_stockage.mjs';

/* ── Le numéro de la demande ───────────────────────────────────
   Une demande = un numéro, dans l'ordre d'arrivée : 0001, 0002…
   Il est rangé dans le magasin Netlify Blobs, à côté du reste des
   données du back-office, donc il survit aux déploiements.

   L'écriture est conditionnelle : si deux demandes arrivent dans la
   même seconde, la seconde voit que le compteur a bougé et reprend
   son tour plutôt que d'écraser. Si le magasin ne répond pas, on ne
   bloque pas l'envoi : on retombe sur un numéro horodaté, moins joli
   mais toujours unique.
   ───────────────────────────────────────────────────────────── */
const COMPTEUR_STORE = 'vespra-admin-data';
const COMPTEUR_CLE = 'compteurs/demandes';

async function numeroSuivant() {
  try {
    const store = getStore(COMPTEUR_STORE);
    for (let essai = 0; essai < 5; essai++) {
      const lu = await store.getWithMetadata(COMPTEUR_CLE, { type: 'json', consistency: 'strong' });
      const actuel = Number(lu && lu.data && lu.data.n) || 0;
      const suivant = actuel + 1;
      try {
        await store.setJSON(COMPTEUR_CLE, { n: suivant, maj: new Date().toISOString() },
          lu && lu.etag ? { onlyIfMatch: lu.etag } : { onlyIfNew: true });
        return String(suivant).padStart(4, '0');
      } catch (e) {
        /* quelqu'un est passé avant : on relit et on recommence */
        await new Promise(r => setTimeout(r, 40 + Math.random() * 80));
      }
    }
  } catch (e) {
    console.error('Compteur de demandes indisponible :', e.message);
  }
  /* repli : un numéro horodaté, jamais deux fois le même */
  return Date.now().toString(36).slice(-5).toUpperCase();
}

/* ── Une ligne de courriel par demande ─────────────────────────
   Gmail regroupe dans une même conversation les messages qui ont le
   même objet et le même expéditeur. Trois demandes reçues coup sur
   coup se retrouvaient donc empilées dans un seul fil, impossible à
   classer séparément : une répondue, l'autre pas, mais une seule
   ligne dans la boîte.

   Deux mesures, complémentaires :
     • l'objet porte le nom du client, sa date et une référence courte,
       donc il est différent à chaque fois ;
     • l'en-tête X-Entity-Ref-ID, différent lui aussi, que Gmail
       utilise pour ne pas rattacher deux messages entre eux.
   ───────────────────────────────────────────────────────────── */
/* L'objet doit tenir d'un coup d'œil dans la liste des messages :
   ce dont il s'agit, qui, quand, et le numéro. Rien d'autre — ni le
   nom de l'entreprise, ni « à traiter », qui n'apprennent rien. */
const OBJETS = {
  devis:        'Nouvelle demande de devis',
  reservation:  'Nouvelle demande de réservation',
  contact_devis: 'Nouvelle demande de devis',
  disponibilite: 'Demande de disponibilité',
  contact:      'Nouveau message',
  'rendez-vous': 'Demande de rendez-vous',
  'avis-produit': 'Nouvel avis à valider',
  newsletter:   'Inscription newsletter',
  salle:        'Demande d’inscription — lieu',
};

function sujet(formName, kind, data, ref) {
  const bouts = [OBJETS[formName] || kind.title || 'Nouveau message'];
  const nom = [data.prenom, data.nom].filter(Boolean).join(' ').trim();
  if (nom) bouts.push(nom);
  const d = data.date || data['date-evenement'] || '';
  if (d) bouts.push(frDateCourte(d));
  bouts.push('Réf. ' + ref);
  return bouts.join(' — ');
}

/* 2026-07-18 → 18/07/2026 ; laisse passer ce qui est déjà au format fr */
function frDateCourte(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v ?? '').trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v ?? '').trim();
}

async function notify(formName, data) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.error('RESEND_API_KEY absente — e-mail non envoyé'); return; }
  const detected = detectForm(formName, data);
  console.log('Formulaire reçu :', formName || '(absent)', '→ traité comme', detected, '| champs :', Object.keys(data).join(','));
  formName = detected;
  let kind = KINDS[formName] || { badge: formName, title: 'Nouveau message', bg: 'rgba(43,74,107,.1)', fg: NAVY };
  /* Le formulaire de réservation sert deux intentions. Celle que le
     client a cochée décide de la pastille ET de l'objet du courriel :
     « disponibilités pour réserver » est une demande de réservation,
     « devis ou informations » une demande de devis. */
  let cleObjet = formName;
  if (formName === 'reservation') {
    if (/disponibilit/i.test(data.demande || '')) { kind = KINDS.disponibilite; cleObjet = 'reservation'; }
    else if (data.demande) { kind = KINDS.devis; cleObjet = 'devis'; }
  }
  if (formName === 'avis-produit') {
    if (data.produit) kind = { ...kind, title: `Nouvel avis à valider — ${data.produit}` };
    const secret = process.env.AVIS_SECRET;
    if (secret && process.env.NETLIFY_ACCESS_TOKEN) {
      try {
        kind = { ...kind, link: validationLink(data, { siteUrl: process.env.URL || 'https://www.vespraevent.fr', secret }) };
      } catch (e) { console.error('Lien de validation non généré :', e.message); }
    }
  }
  const ref = await numeroSuivant();
  const body = {
    from: process.env.NOTIFY_FROM || 'Vespra Event <onboarding@resend.dev>',
    to: (process.env.NOTIFY_TO || 'vespraevent@gmail.com').split(',').map(s => s.trim()),
    subject: sujet(cleObjet, kind, data, ref) + ((formName === 'rendez-vous' && !/^(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})$/.test(String(data.date || '').trim())) ? ' — sans jour choisi' : ''),
    html: buildHtml({ ...kind, ref }, data),
    headers: {
      /* empêche le regroupement en conversation */
      'X-Entity-Ref-ID': ref,
    },
  };
  if (data.email) body.reply_to = data.email;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) console.error('Resend a refusé l’envoi :', r.status, await r.text());
  else console.log('Notification envoyée pour le formulaire', formName);
}

/* Syntaxe moderne : Netlify appelle formSubmitted à chaque soumission vérifiée */
export default {
  async formSubmitted(event) {
    const data = event.data || {};
    const name = data['form-name'] || event.form?.name || '';
    // « avis-valides » n'est pas un message de client : c'est le stockage
    // interne des avis publiés. Aucune notification pour celui-là.
    if (name === 'avis-valides' || (data.p && data.t && data.s && !data.avis && !data.message)) {
      console.log('Enregistrement interne d’un avis publié — pas de notification');
      return;
    }
    await notify(name, data);
    /* accusé de réception automatique (délai réglé dans le back-office) (demandes de devis / réservation seulement) */
    try {
      const type = detectForm(name, data);
      const email = String(data.email || '').trim().toLowerCase();
      const secret = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || '';
      if ((type === 'reservation' || type === 'devis') && email && secret && !/rendez-vous/i.test(String(name)) && process.env.ACCUSE_AUTO !== 'non') {
        const { createHmac } = await import('node:crypto');
        const sig = createHmac('sha256', secret).update('accuse.' + email).digest('hex');
        const base = (process.env.URL || 'https://www.vespraevent.fr').replace(/\/$/, '');
        await fetch(base + '/.netlify/functions/accuse-background', { method: 'POST',
          headers: { 'content-type': 'application/json', 'x-accuse': sig },
          body: JSON.stringify({ email, prenom: data.prenom || '', recap: recapAccuse(data) }) });
      }
    } catch (e) { console.error('Accusé de réception non programmé :', e.message); }
  },
};
