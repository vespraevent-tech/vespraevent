/* Gabarits des mails automatiques (réponse, relance, demande d'avis) :
   même cadre pour les trois — en-tête de marque, texte court, boutons d'action,
   puis la signature des mails de Vespra Event (les mails automatiques ne passent pas
   par Gmail : la signature doit donc être ajoutée ici). */
const esc = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const paras = (m) => String(m).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
const para = (m, style = 'margin:0 0 12px') => paras(m).map((x) => `<p style="${style}">${esc(x).replace(/\n/g, '<br>')}</p>`).join('\n');
const F = "font-family:Inter,-apple-system,'Segoe UI',Arial,sans-serif";

/* la signature garde sa mise en page sur téléphone : les noms ne se cassent plus, elle se fait glisser de côté si l'écran est étroit */
const signature = (site) => `<div style="max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch"><table cellpadding="0" cellspacing="0" border="0" style="font-size:15px;border-collapse:collapse;width:auto;min-width:440px;color:rgb(123,130,141)"><tbody><tr><td valign="top" style="padding:14px 14px 6px 0;border-right:2px solid rgb(201,162,75)"><img src="${site}/signature/logo-sig.png" width="44" height="44" alt="Vespra Event" style="display:block;border:0"></td><td valign="top" style="padding:14px 12px 6px 14px;border-left:1px solid rgb(154,160,168)"><div style="font-size:13px;font-weight:bold;color:rgb(94,134,181);white-space:nowrap">Thomas DEL'HOMMEAU</div><div style="font-size:10px;color:rgb(184,146,60);letter-spacing:.06em;text-transform:uppercase;padding:2px 0 6px;white-space:nowrap">Gérant · Vespra Event</div><div style="font-size:11.5px"><a href="tel:0650836828" style="color:rgb(123,130,141);text-decoration:none">06 50 83 68 28</a></div></td><td valign="top" style="padding:14px 0 6px 14px;border-left:1px solid rgb(154,160,168)"><div style="font-size:13px;font-weight:bold;color:rgb(94,134,181);white-space:nowrap">Damien MARION</div><div style="font-size:10px;color:rgb(184,146,60);letter-spacing:.06em;text-transform:uppercase;padding:2px 0 6px;white-space:nowrap">Gérant · Vespra Event</div><div style="font-size:11.5px"><a href="tel:0650836828" style="color:rgb(123,130,141);text-decoration:none">06 50 83 68 28</a></div></td></tr><tr><td colspan="3" style="padding:8px 0 0"><div style="border-top:1px solid rgb(154,160,168);font-size:10px;color:rgb(184,146,60);letter-spacing:.1em;text-transform:uppercase;padding:8px 0 0">Location de matériel événementiel · Vitré</div></td></tr><tr><td colspan="3" style="padding:6px 0 0;font-size:10px;color:rgb(138,143,152)"><a href="https://www.vespraevent.fr/" style="color:rgb(94,134,181);text-decoration:none">www.vespraevent.fr</a> · Vitré (35) · SARL au capital de 16 144 € · RCS Rennes 130 286 842</td></tr></tbody></table></div>`;

const cadre = (corps, site) => `<div style="background:#eef0f3;padding:18px 12px;-webkit-text-size-adjust:100%;text-size-adjust:100%;${F}"><div style="max-width:480px;margin:auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e3e5ea">
<div style="padding:16px 24px;border-bottom:2px solid #c9a24b;background:#fff"><table cellpadding="0" cellspacing="0"><tr><td><img src="${site}/signature/logo-sig.png" width="30" height="30" style="display:block;border-radius:6px" alt=""></td><td style="padding-left:10px;font-size:12px;letter-spacing:.22em;color:#2b4a6b;font-weight:600">VESPRA EVENT</td></tr></table></div>
<div style="padding:24px 24px 0;color:#2b303b;font-size:14.5px;line-height:1.65">${corps}</div>
<div style="margin:22px 14px 0;padding:8px 0 16px;border-top:1px solid #eceef2">${signature(site)}</div></div></div>`;

const btn = (href, t) => `<a href="${esc(href)}" style="display:inline-block;padding:7px 10px;border:1px solid #2b4a6b;background:#2b4a6b;color:#fff;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;white-space:nowrap">${esc(t)}</a>`;
const btn2 = (href, t) => `<a href="${esc(href)}" style="display:inline-block;padding:7px 10px;border:1px solid #2b4a6b;color:#2b4a6b;border-radius:6px;text-decoration:none;font-size:12px;white-space:nowrap">${esc(t)}</a>`;
/* deux boutons côte à côte, même sur petit écran : un tableau ne passe jamais à la ligne */
const boutons = (a, b, libre) => libre ? `<p style="margin:0 0 12px;line-height:2.3">${a}&nbsp; ${b || ''}</p>` : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px"><tr><td style="padding:0 8px 0 0;white-space:nowrap">${a}</td>${b ? `<td style="padding:0;white-space:nowrap">${b}</td>` : ''}</tr></table>`;
const mailtoRep = (emetteur) => `mailto:${emetteur.email}?subject=${encodeURIComponent('Ma demande Vespra Event')}`;

/* réponse automatique : intro (txt.message), récapitulatif de la demande, encart disponibilités (txt.dispo), boutons.
   recap = {date, items:[{nom, detail, prix}], livraison, adresse, reprise, total, surDevis} (facultatif) ;
   avecDevis = le devis est joint à ce mail. */
export function htmlAccuse({ txt, prenom, site, emetteur, recap, avecDevis }) {
  const lg = (l, v, fort = true) => `<tr><td style="padding:10px 0;border-bottom:1px solid #dfe5ee;color:#646D7C;font-size:13px;width:36%;vertical-align:top">${l}</td><td style="padding:10px 0;border-bottom:1px solid #dfe5ee;color:#0c0f14;font-size:13.5px;${fort ? 'font-weight:600;' : ''}text-align:right;vertical-align:top">${v}</td></tr>`;
  let bloc = '';
  if (recap && typeof recap === 'object') {
    const items = Array.isArray(recap.items) ? recap.items.slice(0, 20) : [];
    const lignes = [];
    if (recap.date) lignes.push(lg('Date souhaitée', esc(recap.date)));
    for (const it of items) {
      lignes.push(lg('Matériel', `${esc(it.nom)}${it.detail ? `<div style="font-weight:400;font-size:12px;color:#646D7C;margin-top:2px">${esc(it.detail)}</div>` : ''}${it.prix ? `<div style="font-weight:400;font-size:12px;color:#2b4a6b;margin-top:2px">${esc(it.prix)}</div>` : ''}`));
    }
    if (recap.livraison) {
      lignes.push(lg('Livraison et reprise', `Sur devis${recap.adresse ? `<div style="font-weight:400;font-size:12px;color:#646D7C;margin-top:2px">${esc(recap.adresse)}</div>` : ''}${recap.reprise ? `<div style="font-weight:400;font-size:12px;color:#646D7C;margin-top:2px">${esc(recap.reprise)}</div>` : ''}`));
    }
    if (lignes.length) {
      const total = recap.total > 0 || recap.surDevis || recap.livraison
        ? `<tr><td colspan="2" style="padding:14px 0 2px"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:13px;font-weight:700;color:#0c0f14">Total estimé</td><td style="text-align:right;font-size:18px;font-weight:700;color:#2b4a6b;white-space:nowrap">${recap.total > 0 ? esc(String(recap.total).replace('.', ',')) + ' €' : 'Sur devis'}</td></tr>${(recap.total > 0 && (recap.surDevis || recap.livraison)) ? `<tr><td colspan="2" style="text-align:right;font-size:11.5px;color:#646D7C;padding-top:3px">${recap.livraison ? 'hors livraison et reprise, sur devis' : 'hors éléments sur devis'}</td></tr>` : ''}</table></td></tr>`
        : '';
      bloc = `<div style="background:#eef2f8;border-radius:8px;padding:16px 18px;margin:18px 0"><div style="font-size:13px;font-weight:600;color:#2b4a6b;margin-bottom:4px">Récapitulatif de votre demande</div><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${lignes.join('')}${total}</table></div>`;
    }
  }
  const dispo = txt.dispo ? `<div style="background:#fff;border:1px solid #e3e5ea;border-left:3px solid #c9a24b;border-radius:6px;padding:12px 14px;margin:0 0 16px;font-size:13px;line-height:1.6;color:#3d4452">${esc(txt.dispo).replace(/\n/g, '<br>')}</div>` : '';
  const pj = avecDevis ? `<p style="margin:0 0 14px;font-size:13px;color:#2b4a6b">&#128206; Votre devis est joint à ce mail (PDF).</p>` : '';
  return cadre(`<div style="font-size:10.5px;letter-spacing:.18em;color:#8a93a3;font-weight:600;margin:0 0 8px">— DEMANDE DE RÉSERVATION</div>
<h1 style="margin:0 0 16px;font-size:21px;line-height:1.25;color:#0c0f14;font-weight:700">${esc(txt.titre || 'Nous avons bien reçu votre demande')}</h1>
<p style="margin:0 0 12px">Bonjour${prenom ? ' ' + esc(prenom) : ''},</p>
${para(txt.message)}
${bloc}${pj}${dispo}
${boutons(btn(mailtoRep(emetteur), 'Répondre'))}
<p style="margin:0 0 12px;font-size:12px;color:#646D7C">Un chèque de caution est demandé le jour de la remise du matériel. Ouvert sans rendez-vous le mercredi et le samedi, sur rendez-vous les autres jours.</p>
<p style="margin:14px 0 0">À très bientôt,</p>`, site);
}

export function htmlRelance({ txt, site, emetteur }) {
  return cadre(`${txt.titre ? `<h1 style="margin:0 0 16px;font-size:21px;line-height:1.25;color:#0c0f14;font-weight:700">${esc(txt.titre)}</h1>
` : ''}<p style="margin:0 0 12px">Bonjour,</p>
${para(txt.message)}
${boutons(btn(mailtoRep(emetteur), 'Répondre'), btn2(site + '/rendez-vous.html', 'Prendre rendez-vous'))}
<p style="margin:0 0 4px;font-size:12px;color:#646D7C">Adresse : ${esc(emetteur.adresse.join(', '))}</p>
<p style="margin:14px 0 0">À très vite,</p>`, site);
}

/* demande d'avis : txt.message = introduction (son dernier paragraphe, s'il y en a plusieurs, va dans l'espace « Votre avis ») ;
   txt.parrainage = espace « Parrainage » */
export function htmlAvis({ txt, lienGoogle, produits, emetteur, site }) {
  const ps = paras(txt.message);
  const phraseAvis = ps.length > 1 ? ps.pop() : '';
  const zone = (titre, inner) => `<div style="background:#f6f7f9;border-radius:8px;padding:14px 16px;margin:0 0 12px"><div style="font-size:10.5px;letter-spacing:.16em;color:#8a93a3;font-weight:600;margin-bottom:8px">${titre}</div>${inner}</div>`;
  const liste = (produits || []).length
    ? `<p style="margin:10px 0 0;font-size:12.5px;color:#646D7C">Un avis sur le matériel loué : ${produits.map((p) => `<a href="${esc(p.url)}" style="color:#2b4a6b">${esc(p.nom)}</a>`).join(' · ')}</p>` : '';
  return cadre(`${txt.titre ? `<h1 style="margin:0 0 16px;font-size:21px;line-height:1.25;color:#0c0f14;font-weight:700">${esc(txt.titre)}</h1>
` : ''}<p style="margin:0 0 12px">Bonjour,</p>
${ps.map((x) => `<p style="margin:0 0 16px">${esc(x)}</p>`).join('\n')}
${zone('VOTRE AVIS', `${phraseAvis ? `<p style="margin:0 0 12px;font-size:13.5px">${esc(phraseAvis)}</p>` : ''}<p style="margin:0">${btn(lienGoogle, 'Laisser un avis Google')}</p>${liste}`)}
${txt.parrainage ? zone('PARRAINAGE', `${para(txt.parrainage, 'margin:0 0 12px;font-size:13.5px')}<p style="margin:0">${btn2(site + '/espace-client#/parrainage', 'Voir mon code de parrainage')}</p>`) : ''}
<p style="margin:14px 0 0">Merci d’avance !</p>`, site);
}

const norm = (t) => String(t || '').replace(/×/g, 'x').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/* retrouve la page produit du site d'après le nom saisi dans la réservation */
export function pageProduit(nom, pages) {
  const a = norm(nom).split(' ').filter((w) => w.length > 2);
  if (!a.length) return '';
  let meilleur = '', score = 0;
  for (const [fichier, titre] of Object.entries(pages || {})) {
    const b = norm(titre).split(' ');
    const commun = a.filter((w) => b.includes(w) || b.some((x) => x.length > 3 && (x.startsWith(w) || w.startsWith(x)))).length;
    const s = commun / a.length;
    if (s > score) { score = s; meilleur = fichier; }
  }
  return score >= 0.6 ? meilleur : '';
}

/* E-mail envoyé à l'invité avec sa vidéo (Vidéobooth) : même cadre de marque que les autres mails. */
export function htmlVideo({ prenom, expediteur, destinataire, pour, evenement, lien, pj, jours, site }) {
  const sem = (jours || 7) === 7 ? '1 semaine' : `${jours} jours`;
  const autre = pour === 'autre';
  const intro = autre
    ? `<p style="margin:0 0 12px">Bonjour ${esc(destinataire || '')},</p>
<p style="margin:0 0 12px"><strong>${esc(expediteur || prenom)}</strong> a laissé un message vidéo pour vous${evenement ? ` lors de <strong>${esc(evenement)}</strong>` : ''} : un joli souvenir à garder.</p>`
    : `<p style="margin:0 0 12px">Bonjour ${esc(prenom)},</p>
<p style="margin:0 0 12px">Merci d'avoir laissé un message vidéo${evenement ? ` pour <strong>${esc(evenement)}</strong>` : ''} : un joli souvenir à garder.</p>`;
  const corps = `${intro}
<p style="margin:0 0 16px">${pj ? (autre ? 'La vidéo est <strong>jointe à ce message</strong> : vous pouvez l’enregistrer directement depuis cet e-mail. Vous pouvez aussi la télécharger avec le bouton ci-dessous.' : 'Votre vidéo est <strong>jointe à ce message</strong> : vous pouvez l’enregistrer directement depuis cet e-mail. Vous pouvez aussi la télécharger avec le bouton ci-dessous.') : (autre ? 'La vidéo est un peu lourde pour être jointe : téléchargez-la avec le bouton ci-dessous.' : 'Votre vidéo est un peu lourde pour être jointe : téléchargez-la avec le bouton ci-dessous.')}</p>
<p style="margin:0 0 18px"><a href="${esc(lien)}" style="display:inline-block;padding:11px 20px;background:#F59E0B;color:#1a1205;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700">Télécharger la vidéo</a></p>
<p style="margin:0 0 14px;padding:10px 14px;background:#fff7e6;border-left:3px solid #F59E0B;border-radius:6px;font-size:13px;color:#5b4a1e"><strong>Le lien de téléchargement est valable ${sem}.</strong> Passé ce délai, la vidéo est supprimée de nos serveurs et le lien ne fonctionne plus${pj ? ' : la vidéo jointe à ce message, elle, reste dans votre boîte mail. Pensez à l’enregistrer.' : ' : pensez à la télécharger avant.'}</p>
<p style="margin:0 0 14px;color:#8a8f98;font-size:12.5px">${autre ? `Vous recevez ce message car ${esc(expediteur || prenom)} a indiqué votre adresse e-mail. Vous ne recevrez aucun autre message de notre part. ` : ''}Ce message vidéo a aussi été remis aux organisateurs de l'événement.</p>
<p style="margin:0 0 4px">Cordialement,</p>
<p style="margin:0 0 2px;font-weight:600;color:#2b4a6b">L'équipe Vespra Event</p>
<p style="margin:0 0 6px;color:#6b7280;font-size:13px">Spécialiste de la location événementielle dans le Grand Ouest.</p>
`;
  return cadre(corps, site);
}
