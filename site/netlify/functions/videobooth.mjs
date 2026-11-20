/* ════════════════════════════════════════════════════
   VIDÉOBOOTH — réception des vidéos de la tablette et envoi à l'invité
   ────────────────────────────────────────────────────
   POST /api/videobooth/chunk   morceau de vidéo (corps = octets bruts, ≤ ~3 Mo)
        en-têtes : x-appareil = VIDEOBOOTH_CLE (variable Netlify)
        paramètres : id, i (n° du morceau), n (nombre de morceaux), fichier, type,
                     nom, prenom, email, event, duree
        Au dernier morceau, la vidéo est assemblée, gardée 30 jours, puis envoyée par e-mail.
   GET  /api/videobooth/v/<id>?t=<jeton>   téléchargement de la vidéo (lien de l'e-mail)

   Les fonctions Netlify acceptent 6 Mo par requête : la tablette découpe donc chaque vidéo.
   E-mail : la vidéo est jointe si elle fait ≤ 18 Mo (limite Gmail 25 Mo), sinon le lien suffit.
   Le lien est toujours présent dans l'e-mail. Tout est supprimé au bout de 30 jours.
   ════════════════════════════════════════════════════ */
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getStore } from './_blobs.mjs';
import { htmlVideo } from './_mails-auto.mjs';

export const config = { path: '/api/videobooth/*' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-appareil',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const rep = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GARDE_JOURS = 30;
const SANS_NOM = '(sans nom d’événement)';   /* nom affiché dans le back-office pour une vidéo sans événement */
const PJ_MAX = 18 * 1024 * 1024;
const idOk = (s) => /^[A-Za-z0-9_-]{6,60}$/.test(s || '');
const jeton = (id) => createHmac('sha256', process.env.VIDEOBOOTH_CLE || '').update('vb:' + id).digest('hex').slice(0, 32);
/* lien envoyé à l'invité par e-mail : jeton distinct de celui de la galerie, valable une semaine seulement */
const LIEN_MAIL_JOURS = 7;
const jetonMail = (id) => createHmac('sha256', process.env.VIDEOBOOTH_CLE || '').update('mail:' + id).digest('hex').slice(0, 32);
const jetonQr = (id) => createHmac('sha256', process.env.VIDEOBOOTH_CLE || '').update('qr:' + id).digest('hex').slice(0, 32);
const jetonEvt = (label) => createHmac('sha256', process.env.VIDEOBOOTH_CLE || '').update('ev:' + label).digest('hex').slice(0, 32);
const store = () => getStore('videobooth');
export const videoStore = store;

/* trace du dernier contact de la tablette, visible dans le back-office */
async function noter(quoi, detail) {
  try { await store().setJSON('etat/' + quoi, { date: new Date().toISOString(), detail }); } catch (e) { console.error('Videobooth : trace impossible', e.message); }
}
export { noter };

/* durée de conservation propre à chaque vidéo (réglée sur la session au moment de l'enregistrement) */
/* durée de conservation : 0 = pas de suppression automatique (c'est vous qui supprimez depuis le back-office) */
const gardeJours = (m) => { const n = Math.round(Number(m && m.garde) || 0); return n > 0 ? Math.min(730, Math.max(7, n)) : 0; };
const perimee = (m) => gardeJours(m) > 0 && Date.parse(m.cree) < Date.now() - gardeJours(m) * 86400000;
/* lecture des fiches en parallèle, par paquets : des milliers de vidéos restent lisibles en quelques secondes */
export async function lireMetas(st, filtre) {
  const { blobs } = await st.list({ prefix: 'meta/' });
  const sortie = [];
  for (let i = 0; i < blobs.length; i += 25) {
    const lot = await Promise.all(blobs.slice(i, i + 25).map((b) => st.get(b.key, { type: 'json' }).catch(() => null)));
    for (const m of lot) if (m && (!filtre || filtre(m))) sortie.push(m);
  }
  return sortie;
}
/* nettoyage au plus toutes les 6 h (et non à chaque vidéo reçue) */
async function nettoyer(st) {
  try {
    const dern = await st.get('etat/nettoyage', { type: 'json' }).catch(() => null);
    if (dern && Date.now() - Date.parse(dern.date) < 6 * 3600e3) return;
    await st.setJSON('etat/nettoyage', { date: new Date().toISOString() });
    const vieilles = await lireMetas(st, perimee);
    for (const m of vieilles) { await st.delete('video/' + m.id).catch(() => {}); await st.delete('meta/' + m.id).catch(() => {}); }
  } catch (e) { console.error('Videobooth : nettoyage impossible', e.message); }
}

async function envoyerMail(m, octets, site) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { ok: false, erreur: "RESEND_API_KEY n'est pas définie dans Netlify" };
  const lien = `${site}/api/videobooth/v/${m.id}?t=${jetonMail(m.id)}`;
  const pj = octets.byteLength <= PJ_MAX;
  const html = htmlVideo({ prenom: m.prenom, expediteur: `${m.prenom} ${m.nom}`.trim(), destinataire: m.dest, pour: m.pour === 'autre' ? 'autre' : 'moi', evenement: m.event, lien, pj, jours: LIEN_MAIL_JOURS, site });
  const body = {
    from: process.env.NOTIFY_FROM || 'Vespra Event <onboarding@resend.dev>',
    to: [m.email],
    subject: m.pour === 'autre' ? `Un message vidéo de ${m.prenom} ${m.nom}`.trim() : 'Votre message vidéo',
    html,
    headers: { 'X-Entity-Ref-ID': 'videobooth-' + m.id },
  };
  if (pj) body.attachments = [{ filename: m.fichier, content: Buffer.from(octets).toString('base64') }];
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) { const t = await r.text(); console.error('Videobooth : Resend a refusé', r.status, t); return { ok: false, erreur: 'Service e-mail : ' + r.status }; }
  return { ok: true, pj };
}

/* ── une vidéo ne s'ouvre que sur les appareils de l'invité ──
   Le lien du QR code ou de l'e-mail ne suffit pas : à la première ouverture, l'invité touche « Ouvrir ma vidéo » et son appareil reçoit
   une clé (cookie) que rien d'autre ne connaît. Un lien transféré à quelqu'un d'autre ne montre alors plus rien.
   QR code : au plus 2 téléphones, dans le quart d'heure qui suit la première ouverture (appli de scan puis navigateur, par exemple).
   E-mail : au plus 2 appareils (téléphone puis ordinateur, par exemple). Un renvoi de l'e-mail depuis le back-office remet le compteur à zéro.
   L'ouverture passe par un bouton (et non par la simple visite du lien) : les robots qui analysent les liens des messageries ne prennent pas la place de l'invité. */
const APPAREILS = { qr: { champ: 'appQr', max: 2, fenetre: 15 * 60000 }, mail: { champ: 'appMail', max: 2, fenetre: 0 } };
const sha = (x) => createHash('sha256').update(String(x)).digest('hex');
const nomCookie = (id, type) => (type === 'qr' ? 'vbq_' : 'vbm_') + id;
function lireCookie(request, nom) {
  for (const c of (request.headers.get('cookie') || '').split(/;\s*/)) { const i = c.indexOf('='); if (i > 0 && c.slice(0, i) === nom) return c.slice(i + 1); }
  return '';
}
const appareilConnu = (request, m, type) => { const sec = lireCookie(request, nomCookie(m.id, type)); return !!sec && (m[APPAREILS[type].champ] || []).includes(sha(sec)); };
/* nouvel appareil : accepté s'il reste une place ; renvoie l'en-tête Set-Cookie à poser, ou null */
async function lierAppareil(st, m, type) {
  const a = APPAREILS[type], liste = Array.isArray(m[a.champ]) ? m[a.champ] : [];
  if (liste.length >= a.max) return null;
  if (liste.length && a.fenetre && Date.now() - Date.parse(m[a.champ + 'Le'] || 0) > a.fenetre) return null;
  const sec = randomBytes(24).toString('hex');
  m[a.champ] = liste.concat(sha(sec)); if (!liste.length) m[a.champ + 'Le'] = new Date().toISOString();
  await st.setJSON('meta/' + m.id, m);
  return `${nomCookie(m.id, type)}=${sec}; Path=/api/videobooth/; Max-Age=${(LIEN_MAIL_JOURS + 1) * 86400}; HttpOnly; Secure; SameSite=Lax`;
}
/* identité des pages web (invités, organisateurs) : la même que la tablette — fond blanc, boutons or, titres élégants */
/* pied des pages : signature sur une seule ligne, puis une invitation vers le site */
const PIED = '<footer class="pied"><div class="pied-l">Vespra Event · Agence événementielle dans le Grand Ouest</div><p class="pied-q">Vous aussi, vous organisez un événement ? <a href="/evenements">Découvrir Vespra Event</a></p></footer>';
const STYLE_PAGES = `<link rel="stylesheet" href="/polices.css?v=1"><style>.pied{width:100%;margin:80px auto 0;max-width:900px;padding:22px 0 30px;border-top:1px solid #E6DCCD;text-align:center}.pied-l{font:600 clamp(8px,2.65vw,12.5px) Inter,Arial,sans-serif;letter-spacing:0;color:#9a8f82;white-space:nowrap}.pied-q{margin:8px 0 0;font-size:11.5px;color:#a69b8f}.pied-q a{color:#a0804a;text-decoration:underline;text-underline-offset:2px}@font-face{font-family:'Playfair VB';font-weight:700;font-display:swap;src:url('/videobooth/polices/playfair-700.woff2') format('woff2')}*{box-sizing:border-box}body{margin:0;background:#fff;color:#231F1C;font-family:Inter,system-ui,Arial,sans-serif}h1{font-family:'Playfair VB',Georgia,serif;font-weight:700;letter-spacing:0}.filet{display:block;width:56px;height:2px;background:#B8893B;margin:12px auto 14px;border-radius:2px}.bt{display:block;background:#B8893B;color:#fff;border:0;border-radius:12px;padding:14px;text-align:center;text-decoration:none;font:700 15px Inter,Arial,sans-serif;cursor:pointer;box-shadow:0 12px 24px -14px rgba(60,45,25,.5)}</style>`;
const ENTETE_HTML = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const pageSimple = (titre, corps, status = 200) => new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(titre)}</title>${STYLE_PAGES}<style>body{min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:20px 16px 0;text-align:center}main{max-width:430px;margin:auto 0}h1{font-size:28px;margin:0 0 10px}p{color:#6F655C;line-height:1.55;margin:0 0 12px;font-size:15px}button{margin-top:10px;width:100%;padding:15px;border:0;border-radius:12px;background:#B8893B;color:#fff;font:700 16px Inter,Arial,sans-serif;cursor:pointer}a{color:#B8893B}</style></head><body><main><h1>${esc(titre)}</h1>${corps}</main>${PIED}</body></html>`, { status, headers: ENTETE_HTML });
const pageOuvrir = (m) => pageSimple('Votre vidéo est prête', `<p>${esc(m.prenom || '')}${m.prenom ? ', v' : 'V'}otre message vidéo vous attend.</p><p>Pour protéger votre vie privée, elle ne s’ouvrira que sur cet appareil.</p><form method="post"><button type="submit">Ouvrir ma vidéo</button></form>`);
const pageRefus = (type) => pageSimple('Vidéo protégée', `<p>Cette vidéo a déjà été ouverte sur ${type === 'qr' ? 'un autre téléphone' : 'd’autres appareils'}. Pour protéger la vie privée des invités, elle ne s’ouvre que sur les appareils de la personne qui l’a enregistrée.</p><p>C’est votre vidéo et vous avez changé d’appareil ? Écrivez-nous : <a href="mailto:contact@vespraevent.com">contact@vespraevent.com</a></p>`, 403);

/* ── mot de passe de la galerie d'un événement ── */
const galCle = (label) => createHash('sha256').update('gal:' + label).digest('hex').slice(0, 32);
const mdpHash = (label, mdp) => createHmac('sha256', process.env.VIDEOBOOTH_CLE || '').update('mdp:' + label + ':' + mdp).digest('hex');
const cookieVal = (label, h) => createHmac('sha256', process.env.VIDEOBOOTH_CLE || '').update('ck:' + label + ':' + h).digest('hex').slice(0, 40);
const egal = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
async function galLire(st, label) { return st.get('galerie/' + galCle(label), { type: 'json' }).catch(() => null); }
async function galEcrire(st, label, mdp) {
  if (!mdp) { await st.delete('galerie/' + galCle(label)).catch(() => {}); return null; }
  const g = { label, mdp, h: mdpHash(label, mdp), maj: new Date().toISOString() };
  await st.setJSON('galerie/' + galCle(label), g); return g;
}
/* mot de passe lisible : sans 0/O/1/l/I pour éviter les confusions */
const genMdp = () => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; const b = randomBytes(6); return Array.from(b, (x) => a[x % a.length]).join(''); };
/* ── accès à la tablette : mot de passe général, puis mot de passe de la session ── */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const signer = (o) => { const p = b64(o); return p + '.' + createHmac('sha256', process.env.VIDEOBOOTH_CLE || '').update('tok:' + p).digest('base64url'); };
function lireJeton(t, type) {
  const [p, sg] = String(t || '').split('.'); if (!p || !sg) return null;
  const att = createHmac('sha256', process.env.VIDEOBOOTH_CLE || '').update('tok:' + p).digest('base64url');
  if (!egal(att, sg)) return null;
  try { const o = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')); if (o.exp < Date.now() || (type && o.t !== type)) return null; return o; } catch { return null; }
}
const hMdp = (kind, v) => createHmac('sha256', process.env.VIDEOBOOTH_CLE || '').update(kind + ':' + v).digest('hex');
async function accesLire(st) { return st.get('config/acces', { type: 'json' }).catch(() => null); }
async function accesEcrire(st, mdp, libre) { if (!mdp && libre) { const a = { libre: true, maj: new Date().toISOString() }; await st.setJSON('config/acces', a); return a; } if (!mdp) { await st.delete('config/acces').catch(() => {}); return null; } const a = { mdp, h: hMdp('acces', mdp), maj: new Date().toISOString() }; await st.setJSON('config/acces', a); return a; }
async function sessionsLire(st) { const l = await st.get('config/sessions', { type: 'json' }).catch(() => null); return Array.isArray(l) ? l : []; }
/* liste de questions : au plus 8, une par ligne, 140 caractères chacune ; « | » interdit (séparateur interne) */
const AMBIANCES = ['blanc', 'ivoire', 'rose', 'sauge', 'perle', 'noir'];
const ORIENTATIONS = ['auto', 'paysage', 'portrait'];
const POLICES = ['elegante', 'manuscrite', 'moderne', 'festive'];
const hexOk = (x) => (/^#[0-9a-fA-F]{6}$/.test(String(x || '')) ? String(x).toUpperCase() : '');
const TEXTES_CLES = ['go', 'm1n', 'm1d', 'm2n', 'm2d', 'm3n', 'm3d', 'm3b', 'pretT', 'pretB', 'plaitT', 'plaitNon', 'plaitOui', 'quiB', 'livT', 'livQr', 'livQrT', 'livMail', 'livMailT', 'livAutreQ', 'livOui', 'livNon', 'livPrenom', 'livEmail2', 'livFin', 'merciT', 'merciD'];
const textesPropres = (t) => { const o = {}; const src = t && typeof t === 'object' ? t : {}; for (const k of TEXTES_CLES) { const v = String(src[k] == null ? '' : src[k]).replace(/[\r\n]+/g, ' ').trim().slice(0, 200); if (v) o[k] = v; } return o; };
const lignes = (a, n = 8, m = 140) => (Array.isArray(a) ? a : String(a || '').split(/\r?\n/)).map((x) => String(x == null ? '' : x).replace(/[\s|]+/g, ' ').trim().slice(0, m)).filter(Boolean).slice(0, n);
async function sessionsEcrire(st, liste) {
  const propre = liste.slice(0, 200).map((e) => ({
    id: String(e.id || ('s' + randomBytes(4).toString('hex'))).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40),
    nom: String(e.nom || '').slice(0, 80), date: String(e.date || '').slice(0, 40), mdp: String(e.mdp || '').slice(0, 40),
    titre: String(e.titre || '').slice(0, 80), sous: String(e.sous || '').slice(0, 160), max: Math.min(120, Math.max(5, Number(e.max) || 30)),
    format: ['auto', '16:9', '4:3', '9:16', '3:4'].includes(e.format) ? e.format : 'auto', noel: !!e.noel, cadrage: String(e.cadrage == null ? '' : e.cadrage).slice(0, 160),
    qui: String(e.qui || '').slice(0, 80), quiSous: String(e.quiSous == null ? '' : e.quiSous).slice(0, 160),
    actif: e.actif !== false, fin: /^\d{4}-\d{2}-\d{2}$/.test(String(e.fin || '')) ? String(e.fin) : '',
    conserv: (Number(e.conserv) > 0) ? Math.min(730, Math.max(7, Math.round(Number(e.conserv)))) : 0, garde: Math.min(365, Math.max(1, Math.round(Number(e.garde)) || 14)),
    qualite: ['haute', 'standard', 'eco'].includes(e.qualite) ? e.qualite : 'standard',
    choixFormat: e.choixFormat !== false,
    /* parcours de l'invité : type d'événement (texte de l'écran final), modes supplémentaires et leurs questions */
    type: ['mariage', 'entreprise', 'anniversaire', 'autre'].includes(e.type) ? e.type : 'autre',
    modeQ: !!e.modeQ, modeP: !!e.modeP,
    heureP: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(e.heureP || '')) ? String(e.heureP) : '23:00',
    qs: lignes(e.qs), qp: lignes(e.qp),
    secQ: Math.min(20, Math.max(0, Math.round(Number(e.secQ)) || 0)),
    merciOrga: String(e.merciOrga || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 300),
    /* phrase au-dessus des boutons de récupération : affichée ou non (non choisi = affichée, sauf pour un événement d'entreprise) */
    orgaOn: e.orgaOn === true || e.orgaOn === false ? e.orgaOn : null,
    /* apparence de l'écran des invités et textes de chaque bouton / écran (vide = texte par défaut de la tablette) */
    /* « nuit » (bleu) n'existe plus : il devient « noir » ; sans réglage, fond blanc. Fond et boutons peuvent aussi être choisis librement (#RRGGBB). */
    amb: AMBIANCES.includes(e.amb) ? e.amb : (e.amb === 'nuit' ? 'noir' : 'blanc'),
    fond: hexOk(e.fond), accent: hexOk(e.accent),
    /* disposition de l'écran (la tablette suit son orientation, ou on la force) et police du titre */
    ori: ORIENTATIONS.includes(e.ori) ? e.ori : 'auto', police: POLICES.includes(e.police) ? e.police : 'elegante',
    textes: textesPropres(e.textes),
  })).filter((e) => e.nom);
  await st.setJSON('config/sessions', propre); return propre;
}
const labelSession = (e) => e.nom + (e.date ? ' — ' + e.date : '');
/* jour d'aujourd'hui à Paris (AAAA-MM-JJ) : une session « terminée » disparaît de la tablette le lendemain de sa date de fin */
const aujourdhuiParis = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const visible = (e) => e.actif !== false && (!e.fin || e.fin >= aujourdhuiParis());
const carte = (e) => ({ id: e.id, nom: e.nom, date: e.date, prot: !!e.mdp });
/* ce que la tablette reçoit d'une session (à l'ouverture, puis régulièrement : une modification du back-office arrive seule sur la tablette) */
const vueSession = (ses) => ({ id: ses.id, nom: ses.nom, date: ses.date, label: labelSession(ses), titre: ses.titre, sous: ses.sous, max: ses.max, format: ses.format, noel: ses.noel, cadrage: ses.cadrage, qui: ses.qui, quiSous: ses.quiSous, qualite: ses.qualite, garde: ses.garde, choixFormat: ses.choixFormat !== false,
  type: ses.type || 'autre', modeQ: !!ses.modeQ, modeP: !!ses.modeP, heureP: ses.heureP || '23:00', qs: ses.qs || [], qp: ses.qp || [], secQ: ses.secQ || 0, merciOrga: ses.merciOrga || '', orgaOn: ses.orgaOn === true || ses.orgaOn === false ? ses.orgaOn : null, amb: AMBIANCES.includes(ses.amb) ? ses.amb : (ses.amb === 'nuit' ? 'noir' : 'blanc'), fond: ses.fond || '', accent: ses.accent || '', ori: ORIENTATIONS.includes(ses.ori) ? ses.ori : 'auto', police: POLICES.includes(ses.police) ? ses.police : 'elegante', textes: ses.textes || {} });
export { envoyerMail, jeton, jetonMail, jetonEvt, GARDE_JOURS, gardeJours, visible, galLire, galEcrire, genMdp, accesLire, accesEcrire, sessionsLire, sessionsEcrire, labelSession };

const SECURITE = {
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
};
export default async (request) => {
  const reponse = await traiter(request);
  try { for (const [k, v] of Object.entries(SECURITE)) if (!reponse.headers.has(k)) reponse.headers.set(k, v); } catch (e) { /* en-têtes figés : on renvoie tel quel */ }
  return reponse;
};

async function traiter(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  const cle = process.env.VIDEOBOOTH_CLE;

  /* ── accès à l'appli de la tablette : mot de passe général ── */
  if (request.method === 'POST' && /\/api\/videobooth\/(acces|sessions|session)$/.test(url.pathname)) {
    if (!cle) return rep({ ok: false, erreur: "VIDEOBOOTH_CLE n'est pas définie dans Netlify" }, 500);
    const st = store(); let d = {}; try { d = await request.json(); } catch {}
    const route = url.pathname.split('/').pop();
    if (route === 'acces') {
      const a = await accesLire(st);
      if (!a || (!a.h && !a.libre)) return rep({ ok: false, erreur: 'Aucun mot de passe d’accès n’est défini : créez-le dans le back-office (onglet Vidéobooth).' }, 409);
      /* accès libre (choisi dans le back-office) : pas de mot de passe général, la liste des sessions s'ouvre directement */
      if (!a.libre) {
        if (!String(d.mdp || '').trim()) return rep({ ok: false, erreur: 'Mot de passe requis.', requis: true }, 401);
        if (!egal(hMdp('acces', String(d.mdp || '').trim()), a.h)) { await new Promise((r) => setTimeout(r, 900)); await noter('refus', 'mot de passe d’accès incorrect'); return rep({ ok: false, erreur: 'Mot de passe incorrect.' }, 401); }
      }
      await noter('contact', 'accès tablette');
      const ses = await sessionsLire(st);
      return rep({ ok: true, libre: !!a.libre, acces: signer({ t: 'acces', exp: Date.now() + 12 * 3600e3 }), sessions: ses.filter(visible).map(carte) });
    }
    if (!lireJeton(d.acces, 'acces') && !lireJeton(d.acces, 'session')) return rep({ ok: false, erreur: 'Accès expiré : saisissez de nouveau le mot de passe.', expire: true }, 401);
    if (route === 'sessions') { const ses = await sessionsLire(st); return rep({ ok: true, sessions: ses.filter(visible).map(carte) }); }
    const ses = (await sessionsLire(st)).find((e) => e.id === String(d.id || ''));
    if (!ses || !visible(ses)) return rep({ ok: false, erreur: 'Session introuvable ou terminée.' }, 404);
    if (ses.mdp && !egal(hMdp('s', String(d.mdp || '').trim()), hMdp('s', ses.mdp))) { await new Promise((r) => setTimeout(r, 900)); return rep({ ok: false, erreur: 'Mot de passe de la session incorrect.' }, 401); }
    await noter('contact', 'session ouverte : ' + ses.nom);
    /* une tablette installée pour un événement de plusieurs semaines garde sa session 60 jours */
    const exp = Date.now() + 60 * 86400e3;
    return rep({ ok: true, jeton: signer({ t: 'session', id: ses.id, exp }), exp, session: vueSession(ses) });
  }

  /* ── réglages à jour de la session ouverte sur la tablette (modes, questions, textes…) : lue au démarrage puis toutes les 10 minutes ── */
  if (request.method === 'GET' && /\/api\/videobooth\/ma-session$/.test(url.pathname)) {
    const jt = lireJeton(request.headers.get('x-appareil'), 'session');
    if (!cle || !jt) return rep({ ok: false, erreur: 'Session expirée' }, 403);
    const ses = (await sessionsLire(store())).find((e) => e.id === jt.id);
    if (!ses || !visible(ses)) return rep({ ok: false, erreur: 'Session introuvable ou terminée.' }, 404);
    return rep({ ok: true, session: vueSession(ses) });
  }

  /* ── test de connexion depuis les réglages de la tablette ── */
  if (request.method === 'GET' && /\/api\/videobooth\/ping$/.test(url.pathname)) {
    if (!cle) return rep({ ok: false, erreur: "VIDEOBOOTH_CLE n'est pas définie dans Netlify (ou le site n'a pas été redéployé depuis)" });
    if (request.headers.get('x-appareil') !== cle && !lireJeton(request.headers.get('x-appareil'), 'session')) { await noter('refus', 'clé de la tablette incorrecte (test)'); return rep({ ok: false, erreur: 'La clé saisie sur la tablette ne correspond pas à celle de Netlify' }); }
    await noter('contact', 'test de connexion');
    return rep({ ok: true, resend: !!process.env.RESEND_API_KEY });
  }

  /* ── état de la tablette (batterie, vidéos en attente, caméra, micro) : affiché dans le back-office ── */
  if (request.method === 'POST' && /\/api\/videobooth\/etat$/.test(url.pathname)) {
    if (!cle || (request.headers.get('x-appareil') !== cle && !lireJeton(request.headers.get('x-appareil'), 'session'))) return rep({ ok: false }, 403);
    let d = {}; try { d = await request.json(); } catch {}
    const n = (x, a, b) => Math.min(b, Math.max(a, Math.round(Number(x) || 0)));
    const mot = (x) => String(x || '').replace(/[^a-z]/g, '').slice(0, 12);
    await noter('tablette', { batt: d.batt == null ? null : n(d.batt, 0, 100), charge: !!d.charge, att: n(d.att, 0, 100000), tot: n(d.tot, 0, 100000), usage: n(d.usage, 0, 1e13), quota: n(d.quota, 0, 1e13), cam: mot(d.cam), mic: mot(d.mic), ver: n(d.ver, 0, 9999), enreg: !!d.enreg, reco: n(d.reco, 0, 100000), mut: n(d.mut, 0, 100000), pinUsine: d.pinUsine === true });
    return rep({ ok: true });
  }

  /* ── ouverture de sa vidéo par QR code (écran de remerciement de la tablette) ──
     La vidéo peut ne pas être encore arrivée : la page patiente et se rafraîchit seule. Sans la bonne clé : rien. */
  if ((request.method === 'GET' || request.method === 'POST') && /\/api\/videobooth\/mv\/[A-Za-z0-9_-]+$/.test(url.pathname)) {
    const id = url.pathname.split('/').pop(), k = String(url.searchParams.get('k') || '').replace(/[^A-Za-z0-9]/g, '');
    if (!cle || !idOk(id) || k.length < 12) return new Response('Lien invalide', { status: 404 });
    const st = store();
    const m = await st.get('meta/' + id, { type: 'json' }).catch(() => null);
    const entete = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
    if (!m) {
      const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="refresh" content="6"><title>Votre vidéo arrive</title>${STYLE_PAGES}<style>body{min-height:100vh;display:flex;flex-direction:column;align-items:center;text-align:center;padding:24px 16px 0}main{max-width:380px;margin:auto 0}h1{font-size:28px;margin:0}p{color:#6F655C;font-size:14.5px;line-height:1.6;margin:0 0 10px}.r{width:34px;height:34px;border:4px solid #EFE6D6;border-top-color:#B8893B;border-radius:50%;margin:18px auto;animation:t 1s linear infinite}@keyframes t{to{transform:rotate(360deg)}}a{color:#B8893B}</style></head><body><main><h1>Votre vidéo arrive</h1><i class="filet"></i><div class="r"></div><p>Elle est en cours d’envoi depuis la tablette. Cette page se met à jour toute seule : quelques secondes à quelques minutes.</p><p>Si vous avez demandé l’envoi par e-mail, vous la recevrez aussi dans votre boîte.</p><p>Toujours rien au bout de 72 heures ? Contactez notre support : <a href="mailto:contact@vespraevent.com">contact@vespraevent.com</a></p></main>${PIED}</body></html>`;
      return new Response(html, { status: 202, headers: entete });
    }
    if (!m.rk || !egal(m.rk, k)) { await new Promise((r) => setTimeout(r, 900)); return new Response('Lien invalide', { status: 404 }); }
    /* même durée de validité que le lien de l'e-mail (7 jours), et rien si la vidéo a été supprimée */
    if (perimee(m) || Date.now() > Date.parse(m.renvoye || m.cree) + LIEN_MAIL_JOURS * 86400000) {
      return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Lien expiré</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff;font-family:Inter,Arial,sans-serif;color:#231F1C;padding:20px;text-align:center}main{max-width:420px}h1{font-size:22px}p{color:#6F655C;line-height:1.5}</style></head><body><main><h1>Ce lien n’est plus valable</h1><p>Les liens vers les vidéos restent actifs ${LIEN_MAIL_JOURS} jours. Si vous aviez demandé l’envoi par e-mail, votre vidéo est jointe à ce message.</p></main></body></html>`, { status: 410, headers: entete });
    }
    const vers = `/api/videobooth/v/${id}?t=${jetonQr(id)}`;
    /* appareil déjà reconnu : directement la vidéo */
    if (appareilConnu(request, m, 'qr')) return new Response(null, { status: 302, headers: { Location: vers, 'Cache-Control': 'private, no-store' } });
    /* simple visite du lien (ou robot d'aperçu) : on montre le bouton, sans rien lier */
    if (request.method !== 'POST') return (m.appQr || []).length >= APPAREILS.qr.max ? pageRefus('qr') : pageOuvrir(m);
    const ck = await lierAppareil(st, m, 'qr');
    if (!ck) return pageRefus('qr');
    /* l'invité a ouvert sa vidéo par QR code : on le note (première fois seulement). Le mail part quand même ; s'il n'est pas parti, ce n'est plus un souci. */
    if (!m.scanne) { m.scanne = new Date().toISOString(); await st.setJSON('meta/' + id, m).catch(() => {}); }
    return new Response(null, { status: 303, headers: { Location: vers, 'Set-Cookie': ck, 'Cache-Control': 'private, no-store' } });
  }

  /* ── relance douce des e-mails non partis : appelée par la tablette quand elle se rallume, jamais en boucle ──
     • au plus une passe toutes les 6 h ; au plus 25 e-mails par passe ; au plus 3 essais par vidéo ;
     • au premier refus du service d'e-mail, on s'arrête (pas d'insistance, pas de saturation). */
  if (request.method === 'POST' && /\/api\/videobooth\/relance$/.test(url.pathname)) {
    if (!cle || (request.headers.get('x-appareil') !== cle && !lireJeton(request.headers.get('x-appareil'), 'session'))) return rep({ ok: false }, 403);
    const st = store();
    const dernier = await st.get('etat/relance-mails', { type: 'json' }).catch(() => null);
    if (dernier && Date.now() - Date.parse(dernier.date) < 6 * 3600 * 1000) return rep({ ok: true, ignore: 'passe récente', envoyes: 0, restants: dernier.restants || 0 });
    /* chaque envoi à refaire est une « tâche » : l'e-mail principal de la vidéo, ou un destinataire en plus */
    const trop = (iso) => iso && Date.now() - Date.parse(iso) < 6 * 3600 * 1000;
    const metas = await lireMetas(st, (m) => (m.email && m.mail !== 'envoye' && !m.scanne && (Number(m.mailEssais) || 0) < 3 && !(m.mail === 'attente' && Date.now() - Date.parse(m.cree) < 15 * 60000) && !trop(m.mailEssaiLe))
      || (m.autres || []).some((a) => a.mail !== 'envoye' && (Number(a.essais) || 0) < 3 && !(a.mail === 'attente' && Date.now() - Date.parse(m.cree) < 15 * 60000) && !trop(a.essaiLe)));
    const taches = [];
    for (const m of metas) {
      if (m.email && m.mail !== 'envoye' && !m.scanne && (Number(m.mailEssais) || 0) < 3 && !(m.mail === 'attente' && Date.now() - Date.parse(m.cree) < 15 * 60000) && !trop(m.mailEssaiLe)) taches.push({ m, a: null });
      (m.autres || []).forEach((a) => { if (a.mail !== 'envoye' && (Number(a.essais) || 0) < 3 && !(a.mail === 'attente' && Date.now() - Date.parse(m.cree) < 15 * 60000) && !trop(a.essaiLe)) taches.push({ m, a }); });
    }
    taches.sort((x, y) => String(x.m.cree).localeCompare(String(y.m.cree)));
    const site = (process.env.URL || `${url.protocol}//${url.host}`).replace(/\/$/, '');
    let envoyes = 0, stop = false;
    for (const { m, a } of taches.slice(0, 25)) {
      const buf = await st.get('video/' + m.id, { type: 'arrayBuffer' }).catch(() => null);
      const maintenant = new Date().toISOString();
      if (a) { a.essais = (Number(a.essais) || 0) + 1; a.essaiLe = maintenant; } else { m.mailEssais = (Number(m.mailEssais) || 0) + 1; m.mailEssaiLe = maintenant; }
      if (!buf) { if (a) a.mailErreur = 'Fichier vidéo expiré'; else m.mailErreur = 'Fichier vidéo expiré'; await st.setJSON('meta/' + m.id, m); continue; }
      const r = await envoyerMail(a ? { ...m, email: a.email, pour: 'autre', dest: a.dest } : m, buf, site);
      if (a) { a.mail = r.ok ? 'envoye' : 'erreur'; a.mailErreur = r.erreur || ''; } else { m.mail = r.ok ? 'envoye' : 'erreur'; m.mailErreur = r.erreur || ''; m.pj = !!r.pj; if (r.ok) m.renvoye = new Date().toISOString(); }
      await st.setJSON('meta/' + m.id, m);
      if (r.ok) envoyes++; else { stop = true; break; }
      await new Promise((ok) => setTimeout(ok, 700));
    }
    const restants = Math.max(0, taches.length - envoyes);
    await st.setJSON('etat/relance-mails', { date: new Date().toISOString(), envoyes, restants, arret: stop });
    return rep({ ok: true, envoyes, restants, arret: stop });
  }

  /* ── page de partage d'un événement : toutes les vidéos, pour les mariés / organisateurs ── */
  if ((request.method === 'GET' || request.method === 'POST') && /\/api\/videobooth\/evenement$/.test(url.pathname)) {
    const label = String(url.searchParams.get('e') || '');
    if (!cle || !label || url.searchParams.get('t') !== jetonEvt(label)) return new Response('Lien invalide', { status: 403 });
    const st = store();
    const gal = await galLire(st, label);
    /* une galerie sans mot de passe ne s'ouvre pas (le mot de passe est créé au premier partage depuis le back-office) */
    if (!gal || !gal.h) return pageSimple('Galerie pas encore prête', '<p>Cette galerie n’a pas encore de mot de passe. Demandez à Vespra Event de vous transmettre son lien et son mot de passe.</p>', 403);
    {
      const nomCookie = 'vbg_' + galCle(label).slice(0, 12);
      const ckOk = (request.headers.get('cookie') || '').split(/;\s*/).some((c) => c === nomCookie + '=' + cookieVal(label, gal.h));
      let erreur = '';
      if (!ckOk) {
        /* au plus 8 essais de mot de passe par quart d'heure pour une galerie */
        const cleEssais = 'etat/galerie-essais/' + galCle(label);
        const essais = await st.get(cleEssais, { type: 'json' }).catch(() => null);
        const bloque = essais && essais.n >= 8 && Date.now() - Date.parse(essais.depuis) < 15 * 60000;
        if (request.method === 'POST' && bloque) { await new Promise((r) => setTimeout(r, 900)); erreur = 'Trop d’essais : réessayez dans un quart d’heure.'; }
        else if (request.method === 'POST') {
          let mdp = ''; try { mdp = String((await request.formData()).get('mdp') || ''); } catch {}
          if (egal(mdpHash(label, mdp.trim()), gal.h)) {
            await st.delete(cleEssais).catch(() => {});
            return new Response(null, { status: 303, headers: { Location: url.pathname + url.search, 'Set-Cookie': `${nomCookie}=${cookieVal(label, gal.h)}; Path=/api/videobooth; Max-Age=43200; HttpOnly; Secure; SameSite=Lax`, 'Cache-Control': 'no-store' } });
          }
          const neuf = !essais || Date.now() - Date.parse(essais.depuis) >= 15 * 60000;
          await st.setJSON(cleEssais, { n: neuf ? 1 : (essais.n || 0) + 1, depuis: neuf ? new Date().toISOString() : essais.depuis }).catch(() => {});
          await new Promise((r) => setTimeout(r, 900));
          erreur = 'Mot de passe incorrect.';
        }
        const form = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Galerie protégée</title>${STYLE_PAGES}<style>body{min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:16px 16px 0}form{margin:auto 0;width:min(400px,100%);background:#fff;border:1px solid #E6DCCD;border-radius:20px;padding:30px 26px;text-align:center;box-shadow:0 30px 60px -30px rgba(60,45,25,.35)}h1{font-size:30px;margin:0}p{color:#6F655C;font-size:14px;margin:0 0 18px;line-height:1.5}input{width:100%;padding:14px;border-radius:12px;border:1.5px solid #E6DCCD;background:#fff;color:#231F1C;font-size:18px;text-align:center;margin-bottom:12px}input:focus{outline:none;border-color:#B8893B}button.bt{width:100%}.e{color:#b3392b;font-size:13.5px;margin-bottom:10px;font-weight:600}</style></head><body>
<form method="post"><h1>${esc(label)}</h1><i class="filet"></i><p>Cette galerie est protégée. Saisissez le mot de passe que l’on vous a communiqué.</p>${erreur ? `<div class="e">${esc(erreur)}</div>` : ''}<input name="mdp" type="password" autocomplete="off" autofocus placeholder="Mot de passe" required><button class="bt" type="submit">Accéder à la galerie</button></form>${PIED}</body></html>`;
        return new Response(form, { status: erreur ? 401 : 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
      }
    }
    if (request.method !== 'GET') return new Response('Méthode non autorisée', { status: 405 });
    const liste = await lireMetas(st, (m) => (m.event || SANS_NOM) === label && !perimee(m));
    liste.sort((a, b) => String(a.cree).localeCompare(String(b.cree)));
    const lignesV = liste.map((m) => ({ nom: `${m.prenom} ${m.nom}`.trim(), mode: m.mode === 'piquantes' ? 'Questions piquantes' : (m.mode === 'questions' ? 'Boîte à questions' : ''), qs: Array.isArray(m.qs) ? m.qs : [], fichier: m.fichier, date: m.cree, mo: Math.round((m.octets || 0) / 104857.6) / 10, href: `/api/videobooth/v/${m.id}?t=${jeton(m.id)}` }));
    const play = '<svg viewBox="0 0 24 24" width="30" height="30" fill="#B8893B" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
    const rows = lignesV.map((l, i) => `<div class="c"><button class="pl" type="button" data-i="${i}" aria-label="Voir la vidéo de ${esc(l.nom)}">${play}</button><div class="n"><b>${esc(l.nom)}</b><span>${esc(new Date(l.date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}</span>${l.mode ? `<details class="qd"><summary>${esc(l.mode)}</summary><ol>${l.qs.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details>` : ''}</div><a class="bt" href="${esc(l.href)}&amp;dl=1" download>Télécharger</a></div>`).join('');
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Souvenirs — ${esc(label)}</title>${STYLE_PAGES}
<style>header{padding:44px 18px 10px;text-align:center}h1{font-size:clamp(30px,6vw,46px);margin:0;line-height:1.1}header p{margin:0;color:#6F655C;font-size:15px}main{max-width:900px;margin:0 auto;padding:6px 16px 60px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:18px;margin-top:20px}.c{background:#fff;border:1px solid #E6DCCD;border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:12px;box-shadow:0 24px 44px -30px rgba(60,45,25,.45)}.pl{height:110px;border:0;border-radius:12px;background:#F6F0E6;display:flex;align-items:center;justify-content:center;cursor:pointer}.pl:hover{background:#F0E6D5}.n b{display:block;font-size:16px}.n span{font-size:12.5px;color:#6F655C}.qd{margin-top:6px;font-size:12.5px;color:#6F655C}.qd summary{cursor:pointer;color:#B8893B;font-weight:600}.qd ol{margin:6px 0 0;padding-left:18px;line-height:1.45}.c .bt{padding:10px;font-size:13.5px}#zip{display:block;width:100%;max-width:420px;margin:8px auto 0}#st{font-size:13px;color:#6F655C;text-align:center;margin-top:8px;min-height:16px}#m{position:fixed;inset:0;background:rgba(20,16,12,.86);display:none;align-items:center;justify-content:center;flex-direction:column;gap:12px;z-index:5;padding:14px}#m.on{display:flex}#m video{max-width:100%;max-height:78vh;border-radius:12px;background:#000}#m button{background:#fff;color:#231F1C;border:0;border-radius:10px;padding:10px 24px;font:600 14px Inter,Arial,sans-serif;cursor:pointer}.note{text-align:center;color:#8a8076;font-size:12.5px;margin-top:28px;line-height:1.6}.vide{text-align:center;color:#6F655C;padding:40px 0;grid-column:1/-1}</style></head><body>
<header><h1>${esc(label)}</h1><i class="filet"></i><p>${lignesV.length} message${lignesV.length > 1 ? 's' : ''} vidéo de vos invités</p></header>
<main>${lignesV.length ? '<button id="zip" class="bt" type="button">Tout télécharger (.zip)</button><div id="st"></div>' : ''}<div class="g">${rows || '<div class="vide">Aucune vidéo pour l’instant.</div>'}</div>
<p class="note">Cette galerie est privée : ne partagez ni son lien ni son mot de passe. Pensez à télécharger les vidéos pour les garder.</p></main>${PIED}
<div id="m"><video id="mv" controls playsinline></video><button id="mx" type="button">Fermer</button></div>
<script src="/videobooth/zip.js"></script><script>
var L=${JSON.stringify(lignesV).replace(/</g, '\\u003c')};
var m=document.getElementById('m'),mv=document.getElementById('mv');
Array.prototype.forEach.call(document.querySelectorAll('.pl'),function(b){b.onclick=function(){mv.src=L[+b.dataset.i].href+'&lecture=1';m.classList.add('on');mv.play().catch(function(){});};});
document.getElementById('mx').onclick=function(){mv.pause();mv.removeAttribute('src');mv.load();m.classList.remove('on');};
var b=document.getElementById('zip');if(b)b.onclick=function(){b.disabled=true;var st=document.getElementById('st'),LOT=30,NB=Math.ceil(L.length/LOT),NOM=${JSON.stringify(label.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'videos')},p=0;
function lot(){if(p>=NB){st.textContent='Terminé.';b.disabled=false;return Promise.resolve();}
var part=L.slice(p*LOT,(p+1)*LOT),f=[],i=0;
function next(){if(i>=part.length)return vbZip(f).then(function(z){var a=document.createElement('a');a.href=URL.createObjectURL(z);a.download=NOM+(NB>1?' - partie '+(p+1)+' sur '+NB:'')+'.zip';document.body.appendChild(a);a.click();p++;return new Promise(function(r){setTimeout(r,1200)}).then(lot);});
st.textContent='Archive '+(p+1)+'/'+NB+' · vidéo '+(i+1)+'/'+part.length+'…';return fetch(part[i].href+'&dl=1').then(function(r){return r.blob()}).then(function(x){f.push({nom:part[i].fichier,blob:x});i++;return next()});}
return next();}
lot().catch(function(e){st.textContent='Échec : '+e.message+'. Téléchargez les vidéos une par une.';b.disabled=false;});};
</script></body></html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
  }

  /* ── téléchargement par lien ── */
  const mv = /\/api\/videobooth\/v\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
  if ((request.method === 'GET' || request.method === 'POST') && mv) {
    const id = mv[1];
    const tj = String(url.searchParams.get('t') || '');
    if (!cle || !idOk(id) || !tj) return new Response('Lien invalide', { status: 403 });
    const type = egal(tj, jeton(id)) ? 'galerie' : (egal(tj, jetonMail(id)) ? 'mail' : (egal(tj, jetonQr(id)) ? 'qr' : ''));
    if (!type) return new Response('Lien invalide', { status: 403 });
    const parMail = type === 'mail' || type === 'qr';
    const st = store();
    const m = await st.get('meta/' + id, { type: 'json' }).catch(() => null);
    if (!m) return new Response('Cette vidéo n’est plus disponible.', { status: 410 });
    /* galerie des organisateurs : uniquement dans un navigateur connecté à la galerie (mot de passe saisi) */
    if (type === 'galerie') {
      const label = m.event || SANS_NOM, gal = await galLire(st, label);
      if (!gal || !gal.h || lireCookie(request, 'vbg_' + galCle(label).slice(0, 12)) !== cookieVal(label, gal.h)) return pageSimple('Accès réservé', '<p>Cette vidéo fait partie d’une galerie protégée : ouvrez la galerie avec son lien et son mot de passe.</p>', 403);
    }
    /* le lien de l'e-mail ne vaut qu'une semaine (à partir de l'envoi, ou du dernier renvoi) ; la galerie des organisateurs, elle, n'expire pas */
    if (parMail && m && Date.now() > Date.parse(m.renvoye || m.cree) + LIEN_MAIL_JOURS * 86400000) {
      return pageSimple('Ce lien n’est plus valable', `<p>Les liens de téléchargement restent actifs ${LIEN_MAIL_JOURS} jours. Si la vidéo était jointe à votre e-mail, elle y est toujours : retrouvez-la dans votre boîte mail.</p><p>Besoin d’aide ? <a href="mailto:contact@vespraevent.com">contact@vespraevent.com</a></p>`, 410);
    }
    if (perimee(m)) return new Response('Cette vidéo n’est plus disponible.', { status: 410 });
    /* e-mail : ouverture par bouton sur un nouvel appareil (au plus 2) ; QR code : seul un téléphone déjà lié par le QR code */
    if (type === 'qr' && !appareilConnu(request, m, 'qr')) return pageRefus('qr');
    if (type === 'mail' && !appareilConnu(request, m, 'mail')) {
      if (request.method !== 'POST') return (m.appMail || []).length >= APPAREILS.mail.max ? pageRefus('mail') : pageOuvrir(m);
      const ck = await lierAppareil(st, m, 'mail');
      if (!ck) return pageRefus('mail');
      return new Response(null, { status: 303, headers: { Location: url.pathname + url.search, 'Set-Cookie': ck, 'Cache-Control': 'private, no-store' } });
    }
    if (request.method !== 'GET') return new Response('Méthode non autorisée', { status: 405 });
    const buf = await st.get('video/' + id, { type: 'arrayBuffer' }).catch(() => null);
    if (!buf) return new Response('Vidéo introuvable', { status: 404 });
    const lecture = url.searchParams.get('lecture') === '1', dl = url.searchParams.get('dl') === '1';
    /* lien de l'e-mail sans option : une page avec le lecteur et le bouton de téléchargement */
    if (!lecture && !dl) {
      const q = `?t=${encodeURIComponent(url.searchParams.get('t'))}`;
      const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Votre vidéo — ${esc(m.event || 'Vespra Event')}</title>${STYLE_PAGES}
<style>body{text-align:center}main{max-width:480px;margin:0 auto;padding:36px 16px 50px}h1{font-size:28px;margin:0;line-height:1.15}p{color:#6F655C;font-size:14px;margin:0 0 16px}video{width:100%;max-height:70vh;border-radius:16px;background:#000;box-shadow:0 24px 44px -28px rgba(0,0,0,.5)}.bt{margin-top:18px}.n{margin-top:22px;font-size:12.5px;color:#8a8076;line-height:1.6}.n a{color:#B8893B}</style></head><body><main>
<h1>${type === 'galerie' ? esc(`${m.prenom} ${m.nom}`.trim()) : `${esc(m.prenom)}, voici votre message vidéo`}</h1><i class="filet"></i><p>${esc(m.event || '')}</p>
<video controls playsinline preload="metadata" src="/api/videobooth/v/${esc(id)}${q}&amp;lecture=1"></video>
<a class="bt" href="/api/videobooth/v/${esc(id)}${q}&amp;dl=1" download>${type === 'galerie' ? 'Télécharger la vidéo' : 'Télécharger ma vidéo'}</a>
<div class="n">${type === 'galerie' ? '' : 'Cette vidéo ne s’ouvre que sur vos appareils, pendant une semaine : pensez à la télécharger pour la garder.<br>Un souci ? <a href="mailto:contact@vespraevent.com">contact@vespraevent.com</a>'}</div></main>${PIED}</body></html>`;
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
    }
    /* lecture par morceaux (Range) : indispensable pour que la vidéo se lance sur téléphone */
    const total = buf.byteLength, rg = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
    const hd = { 'Content-Type': m.type || 'video/mp4', 'Content-Disposition': `${dl ? 'attachment' : 'inline'}; filename="${String(m.fichier).replace(/"/g, '')}"`, 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Accept-Ranges': 'bytes' };
    if (rg && (rg[1] !== '' || rg[2] !== '')) {
      let d1 = rg[1] === '' ? Math.max(0, total - Number(rg[2])) : Number(rg[1]);
      let f1 = rg[1] === '' || rg[2] === '' ? total - 1 : Math.min(Number(rg[2]), total - 1);
      if (d1 > f1 || d1 >= total) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
      return new Response(buf.slice(d1, f1 + 1), { status: 206, headers: { ...hd, 'Content-Range': `bytes ${d1}-${f1}/${total}`, 'Content-Length': String(f1 - d1 + 1) } });
    }
    return new Response(buf, { headers: { ...hd, 'Content-Length': String(total) } });
  }

  /* ── réception d'un morceau ── */
  if (request.method === 'POST' && /\/api\/videobooth\/chunk$/.test(url.pathname)) {
    if (!cle) return rep({ ok: false, erreur: "VIDEOBOOTH_CLE n'est pas définie dans Netlify" }, 500);
    if (request.headers.get('x-appareil') !== cle && !lireJeton(request.headers.get('x-appareil'), 'session')) { await noter('refus', 'clé de la tablette incorrecte (envoi)'); return rep({ ok: false, erreur: 'Clé de la tablette refusée' }, 403); }
    await noter('contact', 'morceau ' + (Number(url.searchParams.get('i')) + 1) + '/' + url.searchParams.get('n'));
    const q = url.searchParams, id = q.get('id') || '';
    const i = Number(q.get('i')), n = Number(q.get('n'));
    if (!idOk(id) || !(n >= 1 && n <= 40) || !(i >= 0 && i < n)) return rep({ ok: false, erreur: 'Paramètres invalides' }, 400);
    /* l'adresse e-mail est facultative : l'invité peut ne vouloir que le QR code (les organisateurs reçoivent toutes les vidéos de toute façon) */
    const email = String(q.get('email') || '').trim(), plusEmail = String(q.get('plusEmail') || '').trim();
    const mailOk = (x) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x) && x.length <= 200;
    if ((email && !mailOk(email)) || (plusEmail && !mailOk(plusEmail))) return rep({ ok: false, erreur: 'Adresse e-mail invalide' }, 400);
    const st = store();
    /* déjà reçue (renvoi après une coupure de réseau) : on confirme, sans rien refaire ni renvoyer d'e-mail */
    const deja = await st.get('meta/' + id, { type: 'json' }).catch(() => null);
    if (deja) return rep({ ok: true, termine: true, mail: deja.mail === 'envoye', mailErreur: deja.mailErreur || '', deja: true });
    /* garde-fou : le site ne se remplit pas sans limite */
    if (i === 0) {
      try {
        const { blobs } = await st.list({ prefix: 'meta/' });
        if (blobs.length > 8000) return rep({ ok: false, erreur: 'Trop de vidéos stockées sur le site : supprimez les anciennes dans le back-office' }, 429);
      } catch (e) {}
    }
    const donnees = await request.arrayBuffer();
    if (!donnees.byteLength || donnees.byteLength > 5.5 * 1024 * 1024) return rep({ ok: false, erreur: 'Morceau vide ou trop gros' }, 413);
    await st.set(`chunk/${id}/${i}`, donnees);
    if (i < n - 1) return rep({ ok: true, recu: i });

    /* dernier morceau : on assemble */
    const parts = [];
    for (let k = 0; k < n; k++) {
      const b = await st.get(`chunk/${id}/${k}`, { type: 'arrayBuffer' }).catch(() => null);
      if (!b) return rep({ ok: false, erreur: 'Morceau manquant : ' + k, manquant: k }, 409);
      parts.push(new Uint8Array(b));
    }
    const total = parts.reduce((t, p) => t + p.length, 0);
    const tout = new Uint8Array(total); let o = 0; for (const p of parts) { tout.set(p, o); o += p.length; }
    const plusDest = String(q.get('plusDest') || '').replace(/[<>\r\n]+/g, ' ').trim().slice(0, 60);
    const m = {
      id, event: String(q.get('event') || '').slice(0, 160), nom: String(q.get('nom') || '').slice(0, 80), prenom: String(q.get('prenom') || '').slice(0, 80), email,
      fichier: String(q.get('fichier') || 'video.mp4').replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 150) || 'video.mp4',
      type: String(q.get('type') || 'video/mp4').slice(0, 40), duree: Number(q.get('duree')) || 0, pour: q.get('pour') === 'autre' ? 'autre' : 'moi', dest: q.get('pour') === 'autre' ? String(q.get('dest') || '').replace(/[<>\r\n]+/g, ' ').trim().slice(0, 60) : '', son: q.get('son') === '' || q.get('son') == null ? null : Math.min(100, Math.max(0, Math.round(Number(q.get('son')) || 0))), octets: total, cree: new Date().toISOString(),
    };
    /* un destinataire de plus (« voulez-vous l'envoyer à quelqu'un ? ») : l'e-mail principal reste celui de l'invité */
    if (plusEmail) m.autres = [{ email: plusEmail, dest: plusDest, mail: 'attente' }];
    /* mode choisi par l'invité (message vidéo, boîte à questions, questions piquantes) et questions posées pendant la vidéo */
    { const md = String(q.get('mode') || ''); if (md === 'questions' || md === 'piquantes') { m.mode = md; m.qs = lignes(String(q.get('qs') || '').split('|')); } }
    /* clé de récupération par QR code (aléatoire, générée sur la tablette) : permet à l'invité d'ouvrir sa propre vidéo depuis l'écran de remerciement */
    { const rk = String(q.get('rk') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40); if (rk.length >= 12) m.rk = rk; }
    /* durée de conservation propre à la session de cette vidéo */
    try { const ses = (await sessionsLire(st)).find((e) => labelSession(e) === m.event); if (ses) m.garde = ses.conserv || 0; } catch {}
    await st.set('video/' + id, tout.buffer);
    for (let k = 0; k < n; k++) await st.delete(`chunk/${id}/${k}`).catch(() => {});
    /* la fiche est écrite AVANT l'e-mail : si l'envoi est interrompu, la vidéo reste visible dans le back-office */
    m.mail = m.email ? 'attente' : 'aucun'; m.mailErreur = '';
    await st.setJSON('meta/' + id, m);
    const site = (process.env.URL || `${url.protocol}//${url.host}`).replace(/\/$/, '');
    let mailOkTout = true, mailErr = '';
    if (m.email) {
      const mail = await envoyerMail(m, tout, site);
      m.mail = mail.ok ? 'envoye' : 'erreur'; m.mailErreur = mail.erreur || ''; m.pj = !!mail.pj;
      if (!mail.ok) { mailOkTout = false; mailErr = mail.erreur || ''; }
    }
    for (const a of m.autres || []) {
      const r2 = await envoyerMail({ ...m, email: a.email, pour: 'autre', dest: a.dest }, tout, site);
      a.mail = r2.ok ? 'envoye' : 'erreur'; a.mailErreur = r2.erreur || ''; a.essais = 1;
      if (!r2.ok) { mailOkTout = false; mailErr = mailErr || r2.erreur || ''; }
    }
    await st.setJSON('meta/' + id, m);
    await nettoyer(st);
    return rep({ ok: true, termine: true, mail: mailOkTout, mailErreur: mailErr });
  }
  return rep({ ok: false, erreur: 'Route inconnue' }, 404);
}
