/* ════════════════════════════════════════════════════
   PHOTOBOOTH — données (événements, mises en page, images)
   ────────────────────────────────────────────────────
   Un événement = tous ses réglages (mises en page, écran d'accueil, compte à rebours,
   partage, impression, galerie). Les images (cadres PNG, fonds, logos, couverture)
   sont rangées à part : leur emplacement de stockage pourra changer (Cloudflare R2)
   sans toucher au reste.
   ════════════════════════════════════════════════════ */
import { randomBytes } from 'node:crypto';
import { getStore } from './_blobs.mjs';
import { binLire, binSupprimer, r2Actif, r2SupprimerPrefixe } from './_r2.mjs';

/* lectures « fortes » : un enregistrement fait dans le back-office est lu tel quel, tout de suite, par les bornes (sans le délai de propagation d'environ une minute des lectures habituelles).
   Si l'environnement ne permet pas la lecture forte, on retombe sur la lecture habituelle. */
export const pbStore = () => {
  const fort = getStore({ name: 'photobooth', consistency: 'strong' }); let faible = null;
  return new Proxy(fort, { get(cible, nom) {
    const v = cible[nom];
    if (nom === 'get' || nom === 'list' || nom === 'getWithMetadata' || nom === 'getMetadata') return async (...a) => { try { return await v.apply(cible, a); } catch (e) { if (!/strong consistency|uncachedEdgeURL/i.test(String(e && e.message))) throw e; faible = faible || getStore('photobooth'); return faible[nom](...a); } };
    return typeof v === 'function' ? v.bind(cible) : v;
  } });
};
const nouvelId = (p) => p + randomBytes(6).toString('hex');
const txt = (v, n = 120) => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim().slice(0, n);
const nb = (v, min, max, def) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : def; };
const oui = (v, def) => (v === true || v === false ? v : def);
const hex = (v, def) => (/^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v).toUpperCase() : def);
const idOk = (v, p) => (new RegExp('^' + p + '[0-9a-f]{12}$').test(String(v || '')) ? String(v) : '');

/* formats d'impression (pixels à 300 dpi) */
export const FORMATS = {
  '2x6': { w: 600, h: 1800, nom: 'Bandelette 5×15' },
  '4x6p': { w: 1200, h: 1800, nom: '10×15 portrait' },
  '4x6l': { w: 1800, h: 1200, nom: '10×15 paysage' },
  carre: { w: 1800, h: 1800, nom: 'Carré 15×15' },
};

/* cases d'une mise en page : position en pixels du format, rotation en degrés, numéro de pose */
function casesPropres(cases, f) {
  return (Array.isArray(cases) ? cases : []).slice(0, 8).map((c) => {
    const w = nb(c && c.w, 20, f.w, 300), h = nb(c && c.h, 20, f.h, 200);
    return { n: nb(c && c.n, 1, 4, 1), x: nb(c && c.x, -f.w, f.w * 2, 0), y: nb(c && c.y, -f.h, f.h * 2, 0), w, h, r: nb(c && c.r, -45, 45, 0) };
  });
}
/* ── écran de partage (1920 × 1080), entièrement personnalisable : positions du centre de chaque élément, avec ou sans bouton d'impression ── */
const ECRAN_DEF = {
  styles: { titre: { couleur: '#1F3B5A', police: 'elegante', taille: 62 }, legende: { couleur: '#6B665F', taille: 28 },
    imprimer: { fond: '#FFFFFF', texte: '#1F3B5A', bord: '#D9D4CA', taille: 34 }, terminer: { fond: '#1F3B5A', texte: '#FFFFFF', taille: 32 },
    recommencer: { fond: '#FFFFFF', texte: '#1F3B5A', taille: 32 }, suivant: { fond: '#1F3B5A', texte: '#FFFFFF', taille: 32 } },
  /* écran « Cette photo vous plaît ? » : la photo qui vient d'être prise (hauteur plafonnée à 640 px), Recommencer / Suivant */
  valid: { photo: { x: 960, y: 480, w: 1000 }, titre: { x: 960, y: 100 }, recommencer: { x: 690, y: 940, w: 400, h: 100 }, suivant: { x: 1230, y: 940, w: 400, h: 100 } },
  /* écran « Votre photo est prête ! » : QR code à gauche, bouton Imprimer carré à droite (même taille), Terminer en bas */
  avec: { titre: { x: 960, y: 150 }, qr: { x: 620, y: 520, taille: 400 }, legende: { x: 620, y: 770 }, imprimer: { x: 1300, y: 520, taille: 400 }, terminer: { x: 960, y: 930, w: 380, h: 100 } },
  sans: { titre: { x: 960, y: 150 }, qr: { x: 960, y: 520, taille: 440 }, legende: { x: 960, y: 800 }, imprimer: { x: 1300, y: 520, taille: 400 }, terminer: { x: 960, y: 930, w: 380, h: 100 } },
};
const POLICES_OK = ['elegante', 'manuscrite', 'moderne', 'festive'];
export const ICONES_OK = ['imprimante', 'camera', 'telecharger', 'telephone', 'scan', 'coeur', 'etoile', 'fleche', 'sourire', 'fete'];
/* textes et icônes ajoutés librement sur un écran */
const EXTRAS_DEF = { avec: [{ id: 'ex0a0b0c01', type: 'texte', x: 960, y: 520, texte: '&', taille: 64, couleur: '#6B665F', police: 'elegante', icone: 'coeur' }] };
function extrasPropres(l, def) {
  if (!Array.isArray(l)) l = def || [];
  return l.slice(0, 14).map((x) => (x && typeof x === 'object' ? {
    id: /^ex[0-9a-f]{8}$/.test(String(x.id || '')) ? String(x.id) : 'ex' + randomBytes(4).toString('hex'),
    type: x.type === 'icone' ? 'icone' : 'texte', x: nb(x.x, -400, 2320, 960), y: nb(x.y, -400, 1480, 540), texte: txt(x.texte, 120), taille: nb(x.taille, 10, 700, 50),
    couleur: hex(x.couleur, '#1F3B5A'), police: POLICES_OK.includes(x.police) ? x.police : 'elegante', icone: ICONES_OK.includes(x.icone) ? x.icone : 'coeur' } : null)).filter(Boolean);
}
function ecranPropre(o) {
  o = o && typeof o === 'object' ? o : {};
  if (o.v !== 3 && o.v !== 4 && o.v !== 5) o = { fond: o.fond, couleur: o.couleur };                      /* anciennes dispositions (écran unique) : on repart des nouvelles */
  const v3 = o.v === 3, v4 = o.v === 4;                                                                       /* v3 : pas encore de textes ajoutés → on met le « ou » d'origine */
  const out = { v: 5, fond: idOk(o.fond, 'im'), couleur: hex(o.couleur, '#FFFFFF'), styles: {}, valid: {}, avec: {}, sans: {} };
  for (const k of Object.keys(ECRAN_DEF.styles)) {
    const d = ECRAN_DEF.styles[k], s = (o.styles && o.styles[k]) || {}, r = {};
    for (const f of Object.keys(d)) r[f] = f === 'police' ? (POLICES_OK.includes(s[f]) ? s[f] : d[f]) : (typeof d[f] === 'string' ? hex(s[f], d[f]) : nb(s[f], 8, 300, d[f]));
    out.styles[k] = r;
  }
  out.styles.imprimer.icone = ICONES_OK.includes((o.styles && o.styles.imprimer && o.styles.imprimer.icone)) || (o.styles && o.styles.imprimer && o.styles.imprimer.icone === 'aucune') ? o.styles.imprimer.icone : 'imprimante';
  for (const v of ['valid', 'avec', 'sans']) {
    const src = o[v] && typeof o[v] === 'object' ? o[v] : {};
    out[v].extras = extrasPropres(v3 ? undefined : src.extras, EXTRAS_DEF[v]);
    if (v4) out[v].extras.forEach((x) => { if (x.id === 'ex0a0b0c01' && x.texte === 'ou' && x.taille === 54) { x.texte = '&'; x.taille = 64; } });   /* « ou » d'origine → « & » : on peut faire les deux */
  }
  for (const v of ['valid', 'avec', 'sans']) for (const k of Object.keys(ECRAN_DEF[v])) {
    const d = ECRAN_DEF[v][k], s = (o[v] && o[v][k]) || {}, r = {};
    for (const f of Object.keys(d)) r[f] = f === 'x' ? nb(s[f], -400, 2320, d[f]) : (f === 'y' ? nb(s[f], -400, 1480, d[f]) : nb(s[f], 20, 2400, d[f]));
    out[v][k] = r;
  }
  return out;
}
function miseEnPagePropre(m) {
  const format = FORMATS[m && m.format] ? m.format : '4x6p', f = FORMATS[format];
  return { id: idOk(m && m.id, 'mp') || nouvelId('mp'), nom: txt(m && m.nom, 60) || f.nom, format, w: f.w, h: f.h, cadre: idOk(m && m.cadre, 'im'), calque: { z: nb(m && m.calque && m.calque.z, 20, 400, 100), x: nb(m && m.calque && m.calque.x, -3000, 3000, 0), y: nb(m && m.calque && m.calque.y, -3000, 3000, 0) }, fond: hex(m && m.fond, '#FFFFFF'), cases: casesPropres(m && m.cases, f) };
}

/* nettoyage complet d'un événement : on ne garde que les réglages connus, avec des valeurs par défaut */
export function evenementPropre(e, ancien) {
  e = e && typeof e === 'object' ? e : {};
  const a = ancien || {};
  const ac = e.accueil || {}, cap = e.capture || {}, pa = e.partage || {}, im = e.impression || {}, ga = e.galerie || {};
  const lim = im.limites || {};
  return {
    id: idOk(e.id, 'pb') || a.id || nouvelId('pb'),
    nom: txt(e.nom, 80) || 'Nouvel événement',
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(e.date || '')) ? e.date : '',
    fin: /^\d{4}-\d{2}-\d{2}$/.test(String(e.fin || '')) ? e.fin : '',
    actif: oui(e.actif, true),
    auto: (ancien && ancien.auto) || null,                      /* anciens événements créés automatiquement (supprimables en un clic) */
    resa: txt(e.resa || a.resa, 80),                           /* réservation du planning choisie à la création */
    mdp: txt(e.mdp, 40),
    cree: a.cree || new Date().toISOString(),
    maj: new Date().toISOString(),
    /* un événement est soit en 10×15, soit en bandelettes 5×15 : on garde la famille de la première mise en page */
    misesEnPage: (Array.isArray(e.misesEnPage) ? e.misesEnPage : []).slice(0, 20).map(miseEnPagePropre).filter((m, i, l) => (m.format === '2x6') === (l[0].format === '2x6')),
    accueil: {
      fond: idOk(ac.fond, 'im'), couleur: hex(ac.couleur, '#FFFFFF'),
      bouton: { x: nb(ac.bouton && ac.bouton.x, 0, 1920, 960), y: nb(ac.bouton && ac.bouton.y, 0, 1080, 540), taille: nb(ac.bouton && ac.bouton.taille, 80, 600, 230), couleur: hex(ac.bouton && ac.bouton.couleur, '#1F3B5A'), icone: hex(ac.bouton && ac.bouton.icone, '#FFFFFF') },
      galerie: oui(ac.galerie, true),
      texte: { contenu: txt(ac.texte && ac.texte.contenu, 80), police: ['elegante', 'manuscrite', 'moderne', 'festive'].includes(ac.texte && ac.texte.police) ? ac.texte.police : 'elegante', couleur: hex(ac.texte && ac.texte.couleur, '#231F1C'), taille: nb(ac.texte && ac.texte.taille, 24, 260, 110), x: nb(ac.texte && ac.texte.x, 0, 1920, 960), y: nb(ac.texte && ac.texte.y, 0, 1080, 200) },
      logo: { image: idOk(ac.logo && ac.logo.image, 'im'), x: nb(ac.logo && ac.logo.x, 0, 1920, 960), y: nb(ac.logo && ac.logo.y, 0, 1080, 900), largeur: nb(ac.logo && ac.logo.largeur, 40, 1920, 360) },
    },
    capture: { premier: nb(cap.premier, 1, 30, 7), suivants: nb(cap.suivants, 1, 30, 3), texteAvant: txt(cap.texteAvant, 80) },
    partage: { qr: oui(pa.qr, true), bruts: oui(pa.bruts, true), duree: nb(pa.duree, 10, 600, 45), titre: txt(pa.titre, 120), recommencer: txt(pa.recommencer, 40), terminer: txt(pa.terminer, 40), legende: txt(pa.legende, 80), titreValid: txt(pa.titreValid, 120), suivant: txt(pa.suivant, 40), ecran: ecranPropre(pa.ecran) },
    impression: {
      auto: oui(im.auto, false), bouton: oui(im.bouton, true), decoupe: (im.decoupe === true || im.decoupe === false) ? im.decoupe : null, copiesMax: nb(im.copiesMax, 1, 10, 2),
      txtImprimer: txt(im.txtImprimer, 40), txtImpression: txt(im.txtImpression, 40), txtCopies: txt(im.txtCopies, 60),
      limites: { on: oui(lim.on, true), parEvenement: nb(lim.parEvenement, 1, 100000, 200), parSession: nb(lim.parSession, 1, 50, 1) },
    },
    galerie: { couverture: idOk(ga.couverture, 'im'), ouverte: oui(ga.ouverte, true), lien: oui(ga.lien, false), invites: oui(ga.invites, true), toutTelecharger: oui(ga.toutTelecharger, false), mdp: txt(ga.mdp, 40),
      /* apparence de la page des invités (QR code, galerie) : aux couleurs du thème de l'événement */
      theme: { titre: txt(ga.theme && ga.theme.titre, 80), fond: hex(ga.theme && ga.theme.fond, '#FFFFFF'), accent: hex(ga.theme && ga.theme.accent, '#B8893B'), image: idOk(ga.theme && ga.theme.image, 'im'), police: ['elegante', 'manuscrite', 'moderne', 'festive'].includes(ga.theme && ga.theme.police) ? ga.theme.police : 'elegante' } },
  };
}

export async function evenementLire(id) {
  if (!idOk(id, 'pb')) return null;
  const e = await pbStore().get('evt/' + id, { type: 'json' }).catch(() => null);
  if (e && e.partage && (!e.partage.ecran || e.partage.ecran.v !== 5)) e.partage.ecran = ecranPropre(e.partage.ecran);   /* écrans enregistrés avant la v4 */
  return e;
}
export async function evenementEcrire(e) {
  const ancien = e && e.id ? await evenementLire(e.id) : null;
  const propre = evenementPropre(e, ancien);
  await pbStore().setJSON('evt/' + propre.id, propre);
  return propre;
}
/* ce que la borne a vu en dernier (version de l'événement + heure), pour que le back-office sache si elle est à jour */
export async function vuLire(evt) { return idOk(evt, 'pb') ? pbStore().get('vu/' + evt, { type: 'json' }).catch(() => null) : null; }
export async function vuEcrire(evt, maj, serveur) {
  if (!idOk(evt, 'pb')) return; const st = pbStore(), prec = await st.get('vu/' + evt, { type: 'json' }).catch(() => null);
  if (!prec || prec.maj !== maj || Date.now() - prec.t > 15000) await st.setJSON('vu/' + evt, { maj: String(maj || ''), serveur: String(serveur || ''), t: Date.now() });   /* au plus toutes les 15 s */
}
export async function evenementsLister() {
  const st = pbStore();
  const { blobs } = await st.list({ prefix: 'evt/' });
  const l = await Promise.all(blobs.map((b) => st.get(b.key, { type: 'json' }).catch(() => null)));
  return l.filter(Boolean).sort((x, y) => String(y.date || y.cree).localeCompare(String(x.date || x.cree)));
}
export async function evenementSupprimer(id) {
  if (!idOk(id, 'pb')) return false;
  const st = pbStore();
  for (const pre of ['img/' + id + '/', 'imginfo/' + id + '/', 'photo/' + id + '/', 'prise/' + id + '/']) {
    const { blobs } = await st.list({ prefix: pre });
    for (const b of blobs) await st.delete(b.key).catch(() => {});
  }
  if (r2Actif()) await r2SupprimerPrefixe('photo/' + id + '/').catch((e) => console.error('R2 :', e.message));
  await st.delete('evt/' + id);
  return true;
}

/* ── images (cadres PNG, fonds, logos, couverture) ── */
const TYPES_IMG = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const IMG_MAX = 5.5 * 1024 * 1024;
export async function imageAjouter(evt, mime, octets, nom) {
  if (!idOk(evt, 'pb') || !TYPES_IMG[mime]) throw new Error('Image refusée : PNG, JPEG ou WebP uniquement');
  if (!octets || !octets.byteLength || octets.byteLength > IMG_MAX) throw new Error('Image trop lourde (5,5 Mo au maximum)');
  const id = nouvelId('im'), st = pbStore();
  await st.set('img/' + evt + '/' + id, octets);
  await st.setJSON('imginfo/' + evt + '/' + id, { id, evt, mime, nom: txt(nom, 80), octets: octets.byteLength, cree: new Date().toISOString() });
  return { id, mime, octets: octets.byteLength };
}
export async function imageLire(evt, id) {
  if (!idOk(evt, 'pb') || !idOk(id, 'im')) return null;
  const st = pbStore();
  const info = await st.get('imginfo/' + evt + '/' + id, { type: 'json' }).catch(() => null);
  if (!info) return null;
  const octets = await st.get('img/' + evt + '/' + id, { type: 'arrayBuffer' }).catch(() => null);
  return octets ? { info, octets } : null;
}

/* ── prises de vue : un dossier par événement (photo encadrée, vignette, photos brutes) ──
   meta  : prise/<événement>/<prise>     fichiers : photo/<événement>/<prise>/<nom>
   index : priseevt/<prise> → événement (pour retrouver le dossier depuis le QR code) */
export const NOMS_FICHIERS = ['final', 'mini', 'brut-1', 'brut-2', 'brut-3', 'brut-4'];
export const priseOk = (v) => /^pr[0-9a-f]{16}$/.test(String(v || ''));
export async function priseEvenement(prise) {
  if (!priseOk(prise)) return '';
  const x = await pbStore().get('priseevt/' + prise, { type: 'json' }).catch(() => null);
  return x && x.evt ? x.evt : '';
}
export async function priseLire(evt, prise) {
  if (!idOk(evt, 'pb') || !priseOk(prise)) return null;
  return pbStore().get('prise/' + evt + '/' + prise, { type: 'json' }).catch(() => null);
}
export async function priseEcrire(m) { await pbStore().setJSON('prise/' + m.evt + '/' + m.id, m); }
export async function prisesLister(evt) {
  if (!idOk(evt, 'pb')) return [];
  const st = pbStore(); const { blobs } = await st.list({ prefix: 'prise/' + evt + '/' });
  const out = [];
  for (let i = 0; i < blobs.length; i += 25) {
    const lot = await Promise.all(blobs.slice(i, i + 25).map((b) => st.get(b.key, { type: 'json' }).catch(() => null)));
    lot.forEach((x) => { if (x) out.push(x); });
  }
  return out.sort((a, b) => String(b.cree).localeCompare(String(a.cree)));
}
export async function photoLire(evt, prise, nom) {
  if (!idOk(evt, 'pb') || !priseOk(prise) || !NOMS_FICHIERS.includes(nom)) return null;
  return binLire(pbStore(), 'photo/' + evt + '/' + prise + '/' + nom);
}
export async function priseSupprimer(evt, prise) {
  if (!idOk(evt, 'pb') || !priseOk(prise)) return false;
  const st = pbStore();
  for (const n of NOMS_FICHIERS) await binSupprimer(st, 'photo/' + evt + '/' + prise + '/' + n);
  await st.delete('prise/' + evt + '/' + prise).catch(() => {});
  await st.delete('priseevt/' + prise).catch(() => {});
  return true;
}
/* compteurs du tableau de bord : photos prises, imprimées, QR codes scannés */
export async function compteurs(evt) {
  const l = await prisesLister(evt);
  return { photos: l.filter((p) => p.fichiers && p.fichiers.final).length, imprimees: l.reduce((t, p) => t + (Number(p.imprimees) || 0), 0), scans: l.filter((p) => p.scanne).length };
}
