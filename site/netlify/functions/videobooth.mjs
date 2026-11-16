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
import { createHmac } from 'node:crypto';
import { getStore } from './_blobs.mjs';

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
const PJ_MAX = 18 * 1024 * 1024;
const idOk = (s) => /^[A-Za-z0-9_-]{6,60}$/.test(s || '');
const jeton = (id) => createHmac('sha256', process.env.VIDEOBOOTH_CLE || '').update('vb:' + id).digest('hex').slice(0, 32);
const store = () => getStore('videobooth');

async function nettoyer(st) {
  try {
    const { blobs } = await st.list({ prefix: 'meta/' });
    const limite = Date.now() - GARDE_JOURS * 86400000;
    for (const b of blobs) {
      const m = await st.get(b.key, { type: 'json' }).catch(() => null);
      if (m && Date.parse(m.cree) < limite) { await st.delete('video/' + m.id).catch(() => {}); await st.delete(b.key).catch(() => {}); }
    }
  } catch (e) { console.error('Videobooth : nettoyage impossible', e.message); }
}

async function envoyerMail(m, octets, site) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { ok: false, erreur: "RESEND_API_KEY n'est pas définie dans Netlify" };
  const lien = `${site}/api/videobooth/v/${m.id}?t=${jeton(m.id)}`;
  const titre = m.event ? esc(m.event) : 'votre événement';
  const pj = octets.byteLength <= PJ_MAX;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2933;max-width:520px;margin:0 auto;line-height:1.6">
    <p>Bonjour ${esc(m.prenom)},</p>
    <p>Merci d'avoir laissé un message vidéo pour <strong>${titre}</strong>. ${pj ? 'Votre vidéo est jointe à cet e-mail.' : 'Votre vidéo est trop volumineuse pour être jointe : vous pouvez la télécharger avec le lien ci-dessous.'}</p>
    <p><a href="${lien}" style="display:inline-block;background:#F59E0B;color:#1a1205;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">Télécharger ma vidéo</a></p>
    <p style="color:#6b7280;font-size:13px">Ce lien est valable ${GARDE_JOURS} jours. Votre message a aussi été remis aux organisateurs.</p>
    <p style="color:#6b7280;font-size:13px">Vespra Event</p></div>`;
  const body = {
    from: process.env.NOTIFY_FROM || 'Vespra Event <onboarding@resend.dev>',
    to: [m.email],
    subject: m.event ? `Votre message vidéo — ${m.event}` : 'Votre message vidéo',
    html,
    headers: { 'X-Entity-Ref-ID': 'videobooth-' + m.id },
  };
  if (pj) body.attachments = [{ filename: m.fichier, content: Buffer.from(octets).toString('base64') }];
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) { const t = await r.text(); console.error('Videobooth : Resend a refusé', r.status, t); return { ok: false, erreur: 'Service e-mail : ' + r.status }; }
  return { ok: true, pj };
}

export default async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  const cle = process.env.VIDEOBOOTH_CLE;

  /* ── téléchargement par lien ── */
  const mv = /\/api\/videobooth\/v\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
  if (request.method === 'GET' && mv) {
    const id = mv[1];
    if (!cle || url.searchParams.get('t') !== jeton(id)) return new Response('Lien invalide', { status: 403 });
    const st = store();
    const m = await st.get('meta/' + id, { type: 'json' }).catch(() => null);
    if (!m || Date.parse(m.cree) < Date.now() - GARDE_JOURS * 86400000) return new Response('Cette vidéo n’est plus disponible (conservée 30 jours).', { status: 410 });
    const buf = await st.get('video/' + id, { type: 'arrayBuffer' }).catch(() => null);
    if (!buf) return new Response('Vidéo introuvable', { status: 404 });
    return new Response(buf, { headers: { 'Content-Type': m.type || 'video/mp4', 'Content-Disposition': `attachment; filename="${String(m.fichier).replace(/"/g, '')}"`, 'Cache-Control': 'private, no-store' } });
  }

  /* ── réception d'un morceau ── */
  if (request.method === 'POST' && /\/api\/videobooth\/chunk$/.test(url.pathname)) {
    if (!cle) return rep({ ok: false, erreur: "VIDEOBOOTH_CLE n'est pas définie dans Netlify" }, 500);
    if (request.headers.get('x-appareil') !== cle) return rep({ ok: false, erreur: 'Clé de la tablette refusée' }, 403);
    const q = url.searchParams, id = q.get('id') || '';
    const i = Number(q.get('i')), n = Number(q.get('n'));
    if (!idOk(id) || !(n >= 1 && n <= 40) || !(i >= 0 && i < n)) return rep({ ok: false, erreur: 'Paramètres invalides' }, 400);
    const email = String(q.get('email') || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return rep({ ok: false, erreur: 'Adresse e-mail invalide' }, 400);
    const st = store();
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
      type: String(q.get('type') || 'video/mp4').slice(0, 40), duree: Number(q.get('duree')) || 0, octets: total, cree: new Date().toISOString(),
    };
    await st.set('video/' + id, tout.buffer);
    for (let k = 0; k < n; k++) await st.delete(`chunk/${id}/${k}`).catch(() => {});
    const site = (process.env.URL || `${url.protocol}//${url.host}`).replace(/\/$/, '');
    const mail = await envoyerMail(m, tout, site);
    m.mail = mail.ok ? 'envoye' : 'erreur'; m.mailErreur = mail.erreur || ''; m.pj = !!mail.pj;
    await st.setJSON('meta/' + id, m);
    nettoyer(st);
    return rep({ ok: true, termine: true, mail: mail.ok, mailErreur: mail.erreur || '' });
  }
  return rep({ ok: false, erreur: 'Route inconnue' }, 404);
};
