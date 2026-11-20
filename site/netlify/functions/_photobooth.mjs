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

export const pbStore = () => getStore('photobooth');
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
function miseEnPagePropre(m) {
  const format = FORMATS[m && m.format] ? m.format : '4x6p', f = FORMATS[format];
  return { id: idOk(m && m.id, 'mp') || nouvelId('mp'), nom: txt(m && m.nom, 60) || f.nom, format, w: f.w, h: f.h, cadre: idOk(m && m.cadre, 'im'), fond: hex(m && m.fond, '#FFFFFF'), cases: casesPropres(m && m.cases, f) };
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
    mdp: txt(e.mdp, 40),
    cree: a.cree || new Date().toISOString(),
    maj: new Date().toISOString(),
    misesEnPage: (Array.isArray(e.misesEnPage) ? e.misesEnPage : []).slice(0, 20).map(miseEnPagePropre),
    accueil: {
      fond: idOk(ac.fond, 'im'), couleur: hex(ac.couleur, '#FFFFFF'),
      bouton: { x: nb(ac.bouton && ac.bouton.x, 0, 1920, 960), y: nb(ac.bouton && ac.bouton.y, 0, 1080, 540), taille: nb(ac.bouton && ac.bouton.taille, 80, 600, 230), couleur: hex(ac.bouton && ac.bouton.couleur, '#1F3B5A'), icone: hex(ac.bouton && ac.bouton.icone, '#FFFFFF') },
      galerie: oui(ac.galerie, true),
      texte: { contenu: txt(ac.texte && ac.texte.contenu, 80), police: ['elegante', 'manuscrite', 'moderne', 'festive'].includes(ac.texte && ac.texte.police) ? ac.texte.police : 'elegante', couleur: hex(ac.texte && ac.texte.couleur, '#231F1C'), taille: nb(ac.texte && ac.texte.taille, 24, 260, 110), x: nb(ac.texte && ac.texte.x, 0, 1920, 960), y: nb(ac.texte && ac.texte.y, 0, 1080, 200) },
      logo: { image: idOk(ac.logo && ac.logo.image, 'im'), x: nb(ac.logo && ac.logo.x, 0, 1920, 960), y: nb(ac.logo && ac.logo.y, 0, 1080, 900), largeur: nb(ac.logo && ac.logo.largeur, 40, 1920, 360) },
    },
    capture: { premier: nb(cap.premier, 1, 30, 7), suivants: nb(cap.suivants, 1, 30, 3) },
    partage: { qr: oui(pa.qr, true), bruts: oui(pa.bruts, true), duree: nb(pa.duree, 10, 600, 45), titre: txt(pa.titre, 120), recommencer: txt(pa.recommencer, 40), terminer: txt(pa.terminer, 40) },
    impression: {
      auto: oui(im.auto, false), bouton: oui(im.bouton, true), copiesMax: nb(im.copiesMax, 1, 10, 2),
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
  return pbStore().get('evt/' + id, { type: 'json' }).catch(() => null);
}
export async function evenementEcrire(e) {
  const ancien = e && e.id ? await evenementLire(e.id) : null;
  const propre = evenementPropre(e, ancien);
  await pbStore().setJSON('evt/' + propre.id, propre);
  return propre;
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
  for (const pre of ['img/' + id + '/', 'imginfo/' + id + '/']) {
    const { blobs } = await st.list({ prefix: pre });
    for (const b of blobs) await st.delete(b.key).catch(() => {});
  }
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
