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
const jetonEvt = (label) => createHmac('sha256', process.env.VIDEOBOOTH_CLE || '').update('ev:' + label).digest('hex').slice(0, 32);
const store = () => getStore('videobooth');
export const videoStore = store;

/* trace du dernier contact de la tablette, visible dans le back-office */
async function noter(quoi, detail) {
  try { await store().setJSON('etat/' + quoi, { date: new Date().toISOString(), detail }); } catch (e) { console.error('Videobooth : trace impossible', e.message); }
}
export { noter };

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

export { envoyerMail, jeton, jetonEvt, GARDE_JOURS };

export default async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  const cle = process.env.VIDEOBOOTH_CLE;

  /* ── test de connexion depuis les réglages de la tablette ── */
  if (request.method === 'GET' && /\/api\/videobooth\/ping$/.test(url.pathname)) {
    if (!cle) return rep({ ok: false, erreur: "VIDEOBOOTH_CLE n'est pas définie dans Netlify (ou le site n'a pas été redéployé depuis)" });
    if (request.headers.get('x-appareil') !== cle) { await noter('refus', 'clé de la tablette incorrecte (test)'); return rep({ ok: false, erreur: 'La clé saisie sur la tablette ne correspond pas à celle de Netlify' }); }
    await noter('contact', 'test de connexion');
    return rep({ ok: true, resend: !!process.env.RESEND_API_KEY });
  }

  /* ── page de partage d'un événement : toutes les vidéos, pour les mariés / organisateurs ── */
  if (request.method === 'GET' && /\/api\/videobooth\/evenement$/.test(url.pathname)) {
    const label = String(url.searchParams.get('e') || '');
    if (!cle || !label || url.searchParams.get('t') !== jetonEvt(label)) return new Response('Lien invalide', { status: 403 });
    const st = store();
    const { blobs } = await st.list({ prefix: 'meta/' });
    const liste = [];
    for (const b of blobs) { const m = await st.get(b.key, { type: 'json' }).catch(() => null); if (m && m.event === label && Date.parse(m.cree) >= Date.now() - GARDE_JOURS * 86400000) liste.push(m); }
    liste.sort((a, b) => String(a.cree).localeCompare(String(b.cree)));
    const lignes = liste.map((m) => ({ nom: `${m.prenom} ${m.nom}`.trim(), fichier: m.fichier, date: m.cree, mo: Math.round((m.octets || 0) / 104857.6) / 10, href: `/api/videobooth/v/${m.id}?t=${jeton(m.id)}` }));
    const rows = lignes.map((l) => `<li><div><b>${esc(l.nom)}</b><span>${esc(new Date(l.date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))} · ${l.mo} Mo</span></div><a href="${esc(l.href)}" download>Télécharger</a></li>`).join('');
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Vidéos — ${esc(label)}</title>
<style>body{margin:0;background:#f4f6fa;font-family:Inter,Arial,sans-serif;color:#14304f}main{max-width:640px;margin:0 auto;padding:28px 16px 60px}h1{font-size:24px;margin:0 0 4px}p{color:#6b7280;font-size:14px;margin:0 0 18px}ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}li{background:#fff;border:1px solid #e3e7ee;border-radius:12px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px}li b{display:block;font-size:15px}li span{font-size:12.5px;color:#8a8f98}a,button{background:#F59E0B;color:#1a1205;border:0;border-radius:9px;padding:9px 14px;font:700 14px Arial,sans-serif;text-decoration:none;cursor:pointer;white-space:nowrap}button{width:100%;padding:13px;font-size:15px;margin-bottom:16px}#st{font-size:13px;color:#6b7280;margin:-8px 0 14px;min-height:16px}</style></head><body><main>
<h1>${esc(label)}</h1><p>${lignes.length} vidéo${lignes.length > 1 ? 's' : ''} · disponibles ${GARDE_JOURS} jours après l’enregistrement : pensez à les télécharger.</p>
${lignes.length ? '<button id="zip" type="button">Tout télécharger (.zip)</button><div id="st"></div>' : ''}<ul>${rows || '<li>Aucune vidéo disponible.</li>'}</ul></main>
<script src="/videobooth/zip.js"></script><script>
var L=${JSON.stringify(lignes).replace(/</g, '\\u003c')};
var b=document.getElementById('zip');if(b)b.onclick=function(){b.disabled=true;var st=document.getElementById('st'),f=[],i=0;
function next(){if(i>=L.length)return vbZip(f).then(function(z){var a=document.createElement('a');a.href=URL.createObjectURL(z);a.download=${JSON.stringify(label.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'videos')}+'.zip';document.body.appendChild(a);a.click();st.textContent='Terminé.';b.disabled=false;});
st.textContent='Préparation… '+(i+1)+' / '+L.length;return fetch(L[i].href).then(function(r){return r.blob()}).then(function(x){f.push({nom:L[i].fichier,blob:x});i++;return next()});}
next().catch(function(e){st.textContent='Échec : '+e.message+'. Téléchargez les vidéos une par une.';b.disabled=false;});};
</script></body></html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
  }

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
    return new Response(buf, { headers: { 'Content-Type': m.type || 'video/mp4', 'Content-Disposition': `attachment; filename="${String(m.fichier).replace(/"/g, '')}"`, 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
  }

  /* ── réception d'un morceau ── */
  if (request.method === 'POST' && /\/api\/videobooth\/chunk$/.test(url.pathname)) {
    if (!cle) return rep({ ok: false, erreur: "VIDEOBOOTH_CLE n'est pas définie dans Netlify" }, 500);
    if (request.headers.get('x-appareil') !== cle) { await noter('refus', 'clé de la tablette incorrecte (envoi)'); return rep({ ok: false, erreur: 'Clé de la tablette refusée' }, 403); }
    await noter('contact', 'morceau ' + (Number(url.searchParams.get('i')) + 1) + '/' + url.searchParams.get('n'));
    const q = url.searchParams, id = q.get('id') || '';
    const i = Number(q.get('i')), n = Number(q.get('n'));
    if (!idOk(id) || !(n >= 1 && n <= 40) || !(i >= 0 && i < n)) return rep({ ok: false, erreur: 'Paramètres invalides' }, 400);
    const email = String(q.get('email') || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return rep({ ok: false, erreur: 'Adresse e-mail invalide' }, 400);
    const st = store();
    /* garde-fou : pas plus de 400 vidéos par jour, même avec une clé valide */
    if (i === 0) {
      try {
        const { blobs } = await st.list({ prefix: 'meta/' });
        if (blobs.length > 2000) return rep({ ok: false, erreur: 'Trop de vidéos stockées sur le site : supprimez les anciennes dans le back-office' }, 429);
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
