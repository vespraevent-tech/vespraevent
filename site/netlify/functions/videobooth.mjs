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
  })).filter((e) => e.nom);
  await st.setJSON('config/sessions', propre); return propre;
}
const labelSession = (e) => e.nom + (e.date ? ' — ' + e.date : '');
/* jour d'aujourd'hui à Paris (AAAA-MM-JJ) : une session « terminée » disparaît de la tablette le lendemain de sa date de fin */
const aujourdhuiParis = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const visible = (e) => e.actif !== false && (!e.fin || e.fin >= aujourdhuiParis());
const carte = (e) => ({ id: e.id, nom: e.nom, date: e.date, prot: !!e.mdp });
export { envoyerMail, jeton, jetonMail, jetonEvt, GARDE_JOURS, gardeJours, visible, galLire, galEcrire, genMdp, accesLire, accesEcrire, sessionsLire, sessionsEcrire, labelSession };

export default async (request) => {
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
    return rep({ ok: true, jeton: signer({ t: 'session', id: ses.id, exp }), exp, session: { id: ses.id, nom: ses.nom, date: ses.date, label: labelSession(ses), titre: ses.titre, sous: ses.sous, max: ses.max, format: ses.format, noel: ses.noel, cadrage: ses.cadrage, qui: ses.qui, quiSous: ses.quiSous, qualite: ses.qualite, garde: ses.garde, choixFormat: ses.choixFormat !== false } });
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
    await noter('tablette', { batt: d.batt == null ? null : n(d.batt, 0, 100), charge: !!d.charge, att: n(d.att, 0, 100000), tot: n(d.tot, 0, 100000), usage: n(d.usage, 0, 1e13), quota: n(d.quota, 0, 1e13), cam: mot(d.cam), mic: mot(d.mic), ver: n(d.ver, 0, 9999), enreg: !!d.enreg, reco: n(d.reco, 0, 100000), mut: n(d.mut, 0, 100000) });
    return rep({ ok: true });
  }

  /* ── ouverture de sa vidéo par QR code (écran de remerciement de la tablette) ──
     La vidéo peut ne pas être encore arrivée : la page patiente et se rafraîchit seule. Sans la bonne clé : rien. */
  if (request.method === 'GET' && /\/api\/videobooth\/mv\/[A-Za-z0-9_-]+$/.test(url.pathname)) {
    const id = url.pathname.split('/').pop(), k = String(url.searchParams.get('k') || '').replace(/[^A-Za-z0-9]/g, '');
    if (!cle || !idOk(id) || k.length < 12) return new Response('Lien invalide', { status: 404 });
    const st = store();
    const m = await st.get('meta/' + id, { type: 'json' }).catch(() => null);
    const entete = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
    if (!m) {
      const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="refresh" content="6"><title>Votre vidéo arrive</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f2237;font-family:Inter,Arial,sans-serif;color:#fff;text-align:center;padding:24px}main{max-width:380px}small{letter-spacing:.3em;font-size:11px;color:#9fb0c6}h1{font-size:22px;margin:12px 0 8px}p{color:#9fb0c6;font-size:14px;line-height:1.6;margin:0 0 10px}.r{width:34px;height:34px;border:4px solid #2c4766;border-top-color:#f59e0b;border-radius:50%;margin:18px auto;animation:t 1s linear infinite}@keyframes t{to{transform:rotate(360deg)}}</style></head><body><main><small>VESPRA EVENT</small><h1>Votre vidéo arrive</h1><div class="r"></div><p>Elle est en cours d’envoi depuis la tablette. Cette page se met à jour toute seule : quelques secondes à quelques minutes.</p><p>Vous la recevrez aussi par e-mail.</p><p>Toujours rien au bout de 72 heures ? Contactez notre support : <a href="mailto:contact@vespraevent.com" style="color:#f59e0b">contact@vespraevent.com</a></p></main></body></html>`;
      return new Response(html, { status: 202, headers: entete });
    }
    if (!m.rk || !egal(m.rk, k)) return new Response('Lien invalide', { status: 404 });
    /* l'invité a ouvert sa vidéo par QR code : on le note (première fois seulement). Le mail part quand même ; s'il n'est pas parti, ce n'est plus un souci. */
    if (!m.scanne) { m.scanne = new Date().toISOString(); await st.setJSON('meta/' + id, m).catch(() => {}); }
    return new Response(null, { status: 302, headers: { Location: `/api/videobooth/v/${id}?t=${jetonMail(id)}`, 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
  }

  /* ── relance douce des e-mails non partis : appelée par la tablette quand elle se rallume, jamais en boucle ──
     • au plus une passe toutes les 6 h ; au plus 25 e-mails par passe ; au plus 3 essais par vidéo ;
     • au premier refus du service d'e-mail, on s'arrête (pas d'insistance, pas de saturation). */
  if (request.method === 'POST' && /\/api\/videobooth\/relance$/.test(url.pathname)) {
    if (!cle || (request.headers.get('x-appareil') !== cle && !lireJeton(request.headers.get('x-appareil'), 'session'))) return rep({ ok: false }, 403);
    const st = store();
    const dernier = await st.get('etat/relance-mails', { type: 'json' }).catch(() => null);
    if (dernier && Date.now() - Date.parse(dernier.date) < 6 * 3600 * 1000) return rep({ ok: true, ignore: 'passe récente', envoyes: 0, restants: dernier.restants || 0 });
    const aEnvoyer = (await lireMetas(st, (m) => m.mail !== 'envoye' && !m.scanne && m.email && (Number(m.mailEssais) || 0) < 3 && !(m.mail === 'attente' && Date.now() - Date.parse(m.cree) < 15 * 60000) && !(m.mailEssaiLe && Date.now() - Date.parse(m.mailEssaiLe) < 6 * 3600 * 1000))).sort((a, b) => String(a.cree).localeCompare(String(b.cree)));
    const site = (process.env.URL || `${url.protocol}//${url.host}`).replace(/\/$/, '');
    let envoyes = 0, stop = false;
    for (const m of aEnvoyer.slice(0, 25)) {
      const buf = await st.get('video/' + m.id, { type: 'arrayBuffer' }).catch(() => null);
      m.mailEssais = (Number(m.mailEssais) || 0) + 1; m.mailEssaiLe = new Date().toISOString();
      if (!buf) { m.mailErreur = 'Fichier vidéo expiré'; await st.setJSON('meta/' + m.id, m); continue; }
      const r = await envoyerMail(m, buf, site);
      m.mail = r.ok ? 'envoye' : 'erreur'; m.mailErreur = r.erreur || ''; m.pj = !!r.pj; if (r.ok) m.renvoye = new Date().toISOString();
      await st.setJSON('meta/' + m.id, m);
      if (r.ok) envoyes++; else { stop = true; break; }
      await new Promise((ok) => setTimeout(ok, 700));
    }
    const restants = Math.max(0, aEnvoyer.length - envoyes);
    await st.setJSON('etat/relance-mails', { date: new Date().toISOString(), envoyes, restants, arret: stop });
    return rep({ ok: true, envoyes, restants, arret: stop });
  }

  /* ── page de partage d'un événement : toutes les vidéos, pour les mariés / organisateurs ── */
  if ((request.method === 'GET' || request.method === 'POST') && /\/api\/videobooth\/evenement$/.test(url.pathname)) {
    const label = String(url.searchParams.get('e') || '');
    if (!cle || !label || url.searchParams.get('t') !== jetonEvt(label)) return new Response('Lien invalide', { status: 403 });
    const st = store();
    const gal = await galLire(st, label);
    if (gal && gal.h) {
      const nomCookie = 'vbg_' + galCle(label).slice(0, 12);
      const ckOk = (request.headers.get('cookie') || '').split(/;\s*/).some((c) => c === nomCookie + '=' + cookieVal(label, gal.h));
      let erreur = '';
      if (!ckOk) {
        if (request.method === 'POST') {
          let mdp = ''; try { mdp = String((await request.formData()).get('mdp') || ''); } catch {}
          if (egal(mdpHash(label, mdp.trim()), gal.h)) {
            return new Response(null, { status: 303, headers: { Location: url.pathname + url.search, 'Set-Cookie': `${nomCookie}=${cookieVal(label, gal.h)}; Path=/api/videobooth; Max-Age=43200; HttpOnly; Secure; SameSite=Lax`, 'Cache-Control': 'no-store' } });
          }
          await new Promise((r) => setTimeout(r, 900));
          erreur = 'Mot de passe incorrect.';
        }
        const form = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Galerie protégée</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f2237;font-family:Inter,Arial,sans-serif;color:#fff;padding:16px}form{width:min(380px,100%);background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:26px;text-align:center}small{letter-spacing:.3em;font-size:11px;color:#9fb0c6}h1{font-size:20px;margin:10px 0 4px}p{color:#9fb0c6;font-size:13.5px;margin:0 0 16px}input{width:100%;padding:13px;border-radius:10px;border:1px solid rgba(255,255,255,.28);background:rgba(0,0,0,.25);color:#fff;font-size:17px;text-align:center;margin-bottom:12px}button{width:100%;padding:13px;border:0;border-radius:10px;background:#F59E0B;color:#1a1205;font:700 15px Arial,sans-serif;cursor:pointer}.e{color:#ffb4a8;font-size:13px;margin-bottom:10px}</style></head><body>
<form method="post"><small>VESPRA EVENT</small><h1>${esc(label)}</h1><p>Cette galerie est protégée. Saisissez le mot de passe que l’on vous a communiqué.</p>${erreur ? `<div class="e">${esc(erreur)}</div>` : ''}<input name="mdp" type="password" autocomplete="off" autofocus placeholder="Mot de passe" required><button type="submit">Accéder à la galerie</button></form></body></html>`;
        return new Response(form, { status: erreur ? 401 : 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
      }
    }
    if (request.method !== 'GET') return new Response('Méthode non autorisée', { status: 405 });
    const liste = await lireMetas(st, (m) => (m.event || SANS_NOM) === label && !perimee(m));
    liste.sort((a, b) => String(a.cree).localeCompare(String(b.cree)));
    const lignes = liste.map((m) => ({ nom: `${m.prenom} ${m.nom}`.trim(), fichier: m.fichier, date: m.cree, mo: Math.round((m.octets || 0) / 104857.6) / 10, href: `/api/videobooth/v/${m.id}?t=${jeton(m.id)}` }));
    const rows = lignes.map((l, i) => `<div class="c"><button class="pl" type="button" data-i="${i}" aria-label="Voir la vidéo de ${esc(l.nom)}"><svg viewBox="0 0 24 24" width="30" height="30" fill="#fff"><path d="M8 5v14l11-7z"/></svg></button><div class="n"><b>${esc(l.nom)}</b><span>${esc(new Date(l.date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}</span></div><a href="${esc(l.href)}&amp;dl=1" download>Télécharger</a></div>`).join('');
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Souvenirs — ${esc(label)}</title>
<style>*{box-sizing:border-box}body{margin:0;background:#0f2237;font-family:Inter,Arial,sans-serif;color:#fff}header{padding:34px 18px 18px;text-align:center;background:radial-gradient(700px 300px at 85% 0,rgba(245,158,11,.2),transparent 70%)}header small{letter-spacing:.3em;font-size:11px;color:#9fb0c6}h1{font-size:26px;margin:8px 0 4px}header p{margin:0;color:#9fb0c6;font-size:14px}main{max-width:760px;margin:0 auto;padding:6px 14px 60px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;margin-top:14px}.c{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px}.pl{height:92px;border:0;border-radius:10px;background:linear-gradient(135deg,#2B4A6B,#16365a);display:flex;align-items:center;justify-content:center;cursor:pointer}.n b{display:block;font-size:15px}.n span{font-size:12px;color:#9fb0c6}.c a{background:#F59E0B;color:#1a1205;border-radius:8px;padding:9px;text-align:center;text-decoration:none;font:700 13px Arial,sans-serif}#zip{display:block;width:100%;margin-top:6px;background:#F59E0B;color:#1a1205;border:0;border-radius:10px;padding:14px;font:700 15px Arial,sans-serif;cursor:pointer}#st{font-size:13px;color:#9fb0c6;text-align:center;margin-top:8px;min-height:16px}#m{position:fixed;inset:0;background:rgba(0,0,0,.88);display:none;align-items:center;justify-content:center;flex-direction:column;gap:12px;z-index:5;padding:14px}#m.on{display:flex}#m video{max-width:100%;max-height:78vh;border-radius:12px;background:#000}#m button{background:rgba(255,255,255,.14);color:#fff;border:0;border-radius:9px;padding:10px 22px;font:600 14px Arial,sans-serif}.note{text-align:center;color:#9fb0c6;font-size:12.5px;margin-top:22px}.vide{text-align:center;color:#9fb0c6;padding:40px 0}</style></head><body>
<header><small>VESPRA EVENT</small><h1>${esc(label)}</h1><p>${lignes.length} message${lignes.length > 1 ? 's' : ''} vidéo de vos invités</p></header>
<main>${lignes.length ? '<button id="zip" type="button">Tout télécharger (.zip)</button><div id="st"></div>' : ''}<div class="g">${rows || '<div class="vide">Aucune vidéo disponible.</div>'}</div>
<p class="note">Les vidéos restent disponibles plusieurs semaines après l’enregistrement : pensez à les télécharger pour les garder.<br>Vespra Event — spécialiste de la location événementielle dans le Grand Ouest.</p></main>
<div id="m"><video id="mv" controls playsinline></video><button id="mx" type="button">Fermer</button></div>
<script src="/videobooth/zip.js"></script><script>
var L=${JSON.stringify(lignes).replace(/</g, '\\u003c')};
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
  if (request.method === 'GET' && mv) {
    const id = mv[1];
    const tj = url.searchParams.get('t');
    const parMail = tj === jetonMail(id);
    if (!cle || (tj !== jeton(id) && !parMail)) return new Response('Lien invalide', { status: 403 });
    const st = store();
    const m = await st.get('meta/' + id, { type: 'json' }).catch(() => null);
    /* le lien de l'e-mail ne vaut qu'une semaine (à partir de l'envoi, ou du dernier renvoi) ; la galerie des organisateurs, elle, n'expire pas */
    if (parMail && m && Date.now() > Date.parse(m.renvoye || m.cree) + LIEN_MAIL_JOURS * 86400000) {
      return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Lien expiré</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f2237;font-family:Inter,Arial,sans-serif;color:#fff;padding:20px;text-align:center}main{max-width:420px}h1{font-size:22px}p{color:#b9c6d8;line-height:1.5}</style></head><body><main><small style="letter-spacing:.3em;font-size:11px;color:#9fb0c6">VESPRA EVENT</small><h1>Ce lien n’est plus valable</h1><p>Les liens de téléchargement restent actifs une semaine. Votre vidéo est <strong>jointe à l’e-mail</strong> que vous avez reçu : retrouvez-la dans votre boîte mail.</p></main></body></html>`, { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
    }
    if (!m || perimee(m)) return new Response('Cette vidéo n’est plus disponible.', { status: 410 });
    const buf = await st.get('video/' + id, { type: 'arrayBuffer' }).catch(() => null);
    if (!buf) return new Response('Vidéo introuvable', { status: 404 });
    const lecture = url.searchParams.get('lecture') === '1', dl = url.searchParams.get('dl') === '1';
    /* lien de l'e-mail sans option : une page avec le lecteur et le bouton de téléchargement */
    if (!lecture && !dl) {
      const q = `?t=${encodeURIComponent(url.searchParams.get('t'))}`;
      const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Votre vidéo — ${esc(m.event || 'Vespra Event')}</title>
<style>*{box-sizing:border-box}body{margin:0;background:#0f2237;font-family:Inter,Arial,sans-serif;color:#fff;text-align:center}main{max-width:480px;margin:0 auto;padding:30px 16px 50px}small{letter-spacing:.3em;font-size:11px;color:#9fb0c6}h1{font-size:22px;margin:10px 0 4px}p{color:#9fb0c6;font-size:14px;margin:0 0 16px}video{width:100%;max-height:70vh;border-radius:14px;background:#000}a{display:block;margin-top:16px;background:#F59E0B;color:#1a1205;border-radius:10px;padding:14px;text-decoration:none;font:700 15px Arial,sans-serif}.n{margin-top:20px;font-size:12.5px;color:#9fb0c6}</style></head><body><main>
<small>VESPRA EVENT</small><h1>${esc(m.prenom)}, voici votre message vidéo</h1><p>${esc(m.event || '')}</p>
<video controls playsinline preload="metadata" src="/api/videobooth/v/${esc(id)}${q}&amp;lecture=1"></video>
<a href="/api/videobooth/v/${esc(id)}${q}&amp;dl=1" download>Télécharger ma vidéo</a>
<div class="n">Ce lien est valable une semaine : pensez à télécharger votre vidéo pour la garder.<br>Vespra Event — spécialiste de la location événementielle dans le Grand Ouest.</div></main></body></html>`;
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
    const email = String(q.get('email') || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return rep({ ok: false, erreur: 'Adresse e-mail invalide' }, 400);
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
    const m = {
      id, event: String(q.get('event') || '').slice(0, 160), nom: String(q.get('nom') || '').slice(0, 80), prenom: String(q.get('prenom') || '').slice(0, 80), email,
      fichier: String(q.get('fichier') || 'video.mp4').replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 150) || 'video.mp4',
      type: String(q.get('type') || 'video/mp4').slice(0, 40), duree: Number(q.get('duree')) || 0, pour: q.get('pour') === 'autre' ? 'autre' : 'moi', dest: q.get('pour') === 'autre' ? String(q.get('dest') || '').replace(/[<>\r\n]+/g, ' ').trim().slice(0, 60) : '', son: q.get('son') === '' || q.get('son') == null ? null : Math.min(100, Math.max(0, Math.round(Number(q.get('son')) || 0))), octets: total, cree: new Date().toISOString(),
    };
    /* clé de récupération par QR code (aléatoire, générée sur la tablette) : permet à l'invité d'ouvrir sa propre vidéo depuis l'écran de remerciement */
    { const rk = String(q.get('rk') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40); if (rk.length >= 12) m.rk = rk; }
    /* durée de conservation propre à la session de cette vidéo */
    try { const ses = (await sessionsLire(st)).find((e) => labelSession(e) === m.event); if (ses) m.garde = ses.conserv || 0; } catch {}
    await st.set('video/' + id, tout.buffer);
    for (let k = 0; k < n; k++) await st.delete(`chunk/${id}/${k}`).catch(() => {});
    /* la fiche est écrite AVANT l'e-mail : si l'envoi est interrompu, la vidéo reste visible dans le back-office */
    m.mail = 'attente'; m.mailErreur = '';
    await st.setJSON('meta/' + id, m);
    const site = (process.env.URL || `${url.protocol}//${url.host}`).replace(/\/$/, '');
    const mail = await envoyerMail(m, tout, site);
    m.mail = mail.ok ? 'envoye' : 'erreur'; m.mailErreur = mail.erreur || ''; m.pj = !!mail.pj;
    await st.setJSON('meta/' + id, m);
    await nettoyer(st);
    return rep({ ok: true, termine: true, mail: mail.ok, mailErreur: mail.erreur || '' });
  }
  return rep({ ok: false, erreur: 'Route inconnue' }, 404);
};
