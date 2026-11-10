/* ═══════════════════════════════════════════════════════════════════
   AVIS PRODUITS — publication en un clic depuis l'e-mail
   ───────────────────────────────────────────────────────────────────
   Deux points d'entrée, tous deux servis par cette même fonction :

   GET /api/avis                  → renvoie les avis publiés (JSON)
   GET /api/avis/valider?...      → publie l'avis, lien signé de l'e-mail

   Les avis publiés sont stockés dans un formulaire Netlify nommé
   « avis-valides » : aucun service externe, aucun tableur.
   ═══════════════════════════════════════════════════════════════════ */

import { createHmac, timingSafeEqual, createHash, randomUUID } from 'node:crypto';
/* La bibliothèque Netlify Blobs est incluse dans le dossier (_blobs.mjs)
   plutôt qu'installée : le site se déploie par simple dépôt du dossier,
   sans installation de paquets. Importée par son nom, elle serait
   introuvable au moment de l'exécution et TOUTE modification depuis le
   back-office échouerait. */
import { getStore } from './_stockage.mjs';
import { limiteBlobs } from './_limite.mjs';

const FORM_NAME = 'avis-valides';
const STORE_NAME = 'vespra-reviews';
const PUBLIC_PREFIX = 'published/';
const PENDING_PREFIX = 'pending/';
function store(){ return getStore(STORE_NAME); }
function clean(v,max=900){ return String(v||'').replace(/\s+/g,' ').trim().slice(0,max); }
function norm(t){ return (t||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }

/* Cabines : l'ancien nom « Cabine téléphonique en bois blanc » (avis déposés
   avant la séparation en deux fiches) s'affiche sur les deux fiches cabine. */
function keys(name){
  const n=norm(name);
  if(n.startsWith('cabine telephonique')){
    if(n.includes('bois blanc')) return ['cab','cabav'];
    if(n.includes('audio')||n.includes('video')) return ['cabav'];
    return ['cab'];
  }
  return [n];
}
function same(a,b){ const kb=keys(b); return keys(a).some(k=>kb.includes(k)); }

/* ── signature des liens : personne ne peut publier un faux avis ── */
export function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);
}
function validSig(payload, sig, secret) {
  if (!sig) return false;
  const good = Buffer.from(sign(payload, secret));
  const given = Buffer.from(String(sig));
  return good.length === given.length && timingSafeEqual(good, given);
}
export function pack(data) {
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
}
function unpack(s) {
  return JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
}

/* ── lien « Publier cet avis » à insérer dans l'e-mail ── */
export function validationLink(data, { siteUrl, secret }) {
  const mois = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const clean = v => (v || '').toString().replace(/\s+/g, ' ').trim().slice(0, 900);
  const p = pack({
    p: clean(data.produit),
    n: clean(data.nom || data.prenom),
    s: Math.max(1, Math.min(5, parseInt(data.note, 10) || 5)),
    t: clean(data.avis || data.message),
    d: mois.charAt(0).toUpperCase() + mois.slice(1),
  });
  return `${siteUrl}/api/avis/valider?d=${p}&sig=${sign(p, secret)}`;
}

/* ── stockage Blobs ─────────────────────────────────────────────── */
async function publishedReviews() {
  const s = store();
  const { blobs } = await s.list({ prefix: PUBLIC_PREFIX });
  const rows = [];
  for (const b of blobs) {
    const d = await s.get(b.key, { type: 'json', consistency: 'strong' });
    if (d && d.p && d.t) rows.push({ p:d.p, n:d.n, s:parseInt(d.s,10)||5, t:d.t, d:d.d });
  }
  return rows.reverse();
}

async function publishReview(review) {
  const base = {
    p: clean(review.p,200), n: clean(review.n,200),
    s: String(Math.max(1,Math.min(5,parseInt(review.s,10)||5))),
    t: clean(review.t,900), d: clean(review.d,80),
    _created: review._created || new Date().toISOString(),
  };
  const hash=createHash('sha256').update(`${base.p}|${base.n}|${base.t}`).digest('hex').slice(0,24);
  await store().set(`${PUBLIC_PREFIX}${hash}`, JSON.stringify(base));
}

async function savePending(review){
  const id=randomUUID();
  const data={
    id, produit:clean(review.produit,200), nom:clean(review.nom||review.prenom,200),
    note:Math.max(1,Math.min(5,parseInt(review.note,10)||5)),
    avis:clean(review.avis||review.message,900), email:clean(review.email,240),
    _created:new Date().toISOString(), status:'pending'
  };
  await store().set(`${PENDING_PREFIX}${id}`, JSON.stringify(data));
  return data;
}

async function sendValidationEmail(review){
  const key=process.env.RESEND_API_KEY, secret=process.env.AVIS_SECRET;
  if(!key || !secret){ console.error('AVIS_SECRET ou RESEND_API_KEY absent'); return false; }
  const siteUrl=process.env.URL||'https://www.vespraevent.fr';
  const link=validationLink(review,{siteUrl,secret});
  const to=(process.env.NOTIFY_TO||'vespraevent@gmail.com').split(',').map(s=>s.trim()).filter(Boolean);
  const esc=v=>String(v||'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  const html=`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:28px">
    <h2>Nouvel avis client</h2><p><strong>Produit :</strong> ${esc(review.produit)}</p>
    <p><strong>Nom :</strong> ${esc(review.nom)}</p><p><strong>Note :</strong> ${'★'.repeat(review.note)}${'☆'.repeat(5-review.note)}</p>
    <blockquote style="padding:16px;background:#f5f5f5;border-radius:10px">${esc(review.avis)}</blockquote>
    <p><a href="${link}" style="display:inline-block;background:#2B4A6B;color:#fff;padding:13px 20px;border-radius:999px;text-decoration:none;font-weight:700">Publier cet avis</a></p></div>`;
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({from:process.env.NOTIFY_FROM||'Vespra Event <onboarding@resend.dev>',to,subject:`Nouvel avis à valider — ${review.produit}`,html,...(review.email?{reply_to:review.email}:{})})});
  if(!r.ok){ console.error('Resend avis a refusé :',r.status,await r.text()); return false; }
  return true;
}
/* ── page de confirmation affichée après le clic ── */
function page(title, message, tone) {
  const E = v => String(v == null ? '' : v).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  title = E(title); message = E(message);
  const c = tone === 'ok' ? '#15803d' : tone === 'warn' ? '#92400e' : '#b91c1c';
  const bg = tone === 'ok' ? '#e8f5ee' : tone === 'warn' ? '#fdf3e3' : '#fdeaea';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Vespra Event</title>
<meta name="robots" content="noindex"></head>
<body style="margin:0;background:#eef0f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px">
<div style="background:#fff;border-radius:16px;max-width:460px;width:100%;padding:40px 34px;text-align:center;box-shadow:0 8px 30px rgba(12,15,20,.1)">
  <div style="width:74px;height:74px;border-radius:50%;background:${bg};color:${c};display:flex;align-items:center;justify-content:center;font-size:36px;margin:0 auto 22px">${tone === 'ok' ? '✓' : '!'}</div>
  <h1 style="margin:0 0 12px;font-size:23px;color:#0C0F14">${title}</h1>
  <p style="margin:0 0 26px;font-size:15px;line-height:1.7;color:#3D4452">${message}</p>
  <a href="/" style="display:inline-block;background:#2B4A6B;color:#fff;padding:13px 26px;border-radius:999px;font-size:14px;font-weight:700;text-decoration:none">Retour au site</a>
</div></body></html>`;
}

const html = (body, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

export default async (request) => {
  const url = new URL(request.url);
  const secret = process.env.AVIS_SECRET;
  const siteUrl = process.env.URL || url.origin;

  /* ── 1. publication depuis l'e-mail ── */
  if (url.pathname.endsWith('/valider')) {
    if (!secret) return html(page('Configuration incomplète', "La variable AVIS_SECRET n'est pas définie dans Netlify. L'avis n'a pas été publié.", 'err'), 500);
    const d = url.searchParams.get('d');
    const sig = url.searchParams.get('sig');
    if (!d || !validSig(d, sig, secret)) return html(page('Lien invalide', "Ce lien de validation n'est pas valide ou a été modifié. Aucun avis n'a été publié.", 'err'), 400);

    let review;
    try { review = unpack(d); } catch { return html(page('Lien illisible', "Le contenu de ce lien n'a pas pu être lu. Aucun avis n'a été publié.", 'err'), 400); }

    // doublon : le même avis a déjà été publié
    try {
      const existing = await publishedReviews();
      if (existing.some(r => r.t === review.t && r.n === review.n)) {
        return html(page('Avis déjà publié', `L'avis de ${review.n} sur « ${review.p} » est déjà en ligne. Vous n'avez rien à faire.`, 'warn'));
      }
    } catch { /* si la lecture échoue, on tente quand même la publication */ }

    try {
      await publishReview(review);
      return html(page('Avis publié', `L'avis de ${review.n} sur « ${review.p} » est maintenant visible sur la fiche produit.`, 'ok'));
    } catch (e) {
      console.error('Publication avis impossible :', e.message);
      return html(page('Erreur', "L'avis n'a pas pu être publié. Réessayez.", 'err'), 500);
    }
  }

  /* Nouveau dépôt d'avis depuis une fiche produit. */
  if (url.pathname.endsWith('/demande') && request.method === 'POST') {
    try {
      if (await limiteBlobs(request, 'avis', 8, 60 * 60 * 1000)) return new Response(JSON.stringify({error:'Trop de demandes. Réessayez plus tard.'}), {status:429,headers:{'content-type':'application/json'}});
      const body = await request.json();
      if (body.website) return new Response(JSON.stringify({ok:true}), {headers:{'content-type':'application/json'}});
      if (!body.produit || !body.nom || !body.avis) return new Response(JSON.stringify({error:'Produit, nom et avis sont obligatoires.'}), {status:400,headers:{'content-type':'application/json'}});
      const review = await savePending(body);
      const emailSent = await sendValidationEmail(review);
      return new Response(JSON.stringify({ok:true,emailSent}), {headers:{'content-type':'application/json'}});
    } catch(e) {
      console.error('Demande avis impossible :',e.message);
      return new Response(JSON.stringify({error:'Impossible d’enregistrer votre avis pour le moment.'}), {status:500,headers:{'content-type':'application/json'}});
    }
  }

  /* ── 2. diagnostic interne désactivé en production ── */
  if (url.searchParams.has('debug')) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }

  /* ── 3. lecture des avis par les fiches produit ── */
  try {
    const all = await publishedReviews();
    const produit = url.searchParams.get('produit');
    const list = produit ? all.filter(r => same(r.p, produit)) : all;
    return new Response(JSON.stringify(list), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60' },
    });
  } catch (e) {
    console.error('Lecture des avis impossible :', e.message);
    return new Response('[]', { headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
};
