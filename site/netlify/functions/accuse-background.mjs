/* ═══════════════════════════════════════════════════════════════════
   ACCUSÉ DE RÉCEPTION AUTOMATIQUE, APRÈS UNE DEMANDE (délai réglable)
   ───────────────────────────────────────────────────────────────────
   Fonction « background » de Netlify (le nom finit par -background) :
   elle répond tout de suite 202 puis peut tourner jusqu'à 15 minutes.
   Elle est lancée par vespra-notification.mjs à chaque demande de devis /
   réservation ; elle attend le délai réglé (30 s par défaut) puis envoie au client un message
   avec le lien vers son espace client. Aucun montant n'est promis.

   Sécurité : l'appel doit porter une signature HMAC de l'e-mail
   (ADMIN_SECRET), sinon n'importe qui pourrait déclencher des envois.
   Anti-doublon : un marqueur par adresse e-mail (30 minutes).
   ═══════════════════════════════════════════════════════════════════ */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getStore } from './_stockage.mjs';
import { lireReglage } from './_reponse-auto.mjs';
import { htmlAccuse } from './_mails-auto.mjs';

const esc = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const signature = (email, secret) => createHmac('sha256', secret).update('accuse.' + String(email).toLowerCase()).digest('hex');

export default async (request) => {
  const secret = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || '';
  if (!secret || request.method !== 'POST') return new Response('refusé', { status: 403 });
  let b; try { b = await request.json(); } catch { return new Response('requête invalide', { status: 400 }); }
  const email = String(b.email || '').trim().toLowerCase();
  const sig = request.headers.get('x-accuse') || '';
  const attendue = signature(email, secret);
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email) || sig.length !== attendue.length
      || !timingSafeEqual(Buffer.from(sig), Buffer.from(attendue))) return new Response('refusé', { status: 403 });

  /* réponse automatique coupée depuis le back-office : rien n'est programmé */
  const store = getStore('vespra-admin-data');
  if (!(await lireReglage(store)).actif) return new Response('désactivée', { status: 202 });

  /* un seul accusé par adresse et par tranche de 30 minutes */
  const cle = 'accuse/' + encodeURIComponent(email);
  try {
    const deja = await store.get(cle, { type: 'json', consistency: 'strong' });
    if (deja && Date.now() - Number(deja.t || 0) < 30 * 60 * 1000) return new Response('déjà prévu', { status: 202 });
    /* plafond : au plus 30 accusés par heure, même si quelqu'un inonde le formulaire d'adresses différentes */
    const hk = 'accuse-heure/' + new Date().toISOString().slice(0, 13);
    const h = await store.get(hk, { type: 'json', consistency: 'strong' });
    if (h && Number(h.n) >= 30) return new Response('plafond atteint', { status: 202 });
    await store.setJSON(hk, { n: (h ? Number(h.n) : 0) + 1 });
    await store.setJSON(cle, { t: Date.now() });
  } catch (e) { console.error('Marqueur accusé impossible :', e.message); }

  /* délai choisi dans le back-office (30 s par défaut) */
  const attente = Number(process.env.ACCUSE_DELAI_MS) || (await lireReglage(store)).delai * 1000;
  await new Promise((r) => setTimeout(r, attente));

  /* réglage relu après l'attente : couper l'option pendant l'attente annule l'envoi, et les textes sont ceux du moment */
  const reglage = await lireReglage(store);
  if (!reglage.actif) return new Response('désactivée', { status: 202 });
  const cleApi = process.env.RESEND_API_KEY;
  if (!cleApi) { console.error('RESEND_API_KEY absente — accusé non envoyé'); return new Response('sans clé', { status: 202 }); }
  const site = (process.env.URL || 'https://www.vespraevent.fr').replace(/\/$/, '');
  const prenom = String(b.prenom || '').trim().slice(0, 40);
  /* demande sans livraison ni montage, tout chiffré : le devis part tout de suite, en pièce jointe */
  let devis = null;
  try {
    const rd = await fetch(site + '/api/espace/accuse-devis', { method: 'POST', headers: { 'content-type': 'application/json', 'x-accuse': attendue }, body: JSON.stringify({ email }) });
    if (rd.ok) { const j = await rd.json(); if (j && j.ok && j.b64) devis = { filename: String(j.nom || 'Devis-Vespra-Event.pdf'), content: j.b64 }; }
  } catch (e) { console.error('Devis automatique indisponible :', e.message); }
  const txt = devis ? reglage.devis : reglage.sans;
  /* récapitulatif transmis par la notification : on ne garde que du texte court et des nombres */
  const t = (x, n) => String(x == null ? '' : x).slice(0, n);
  let recap = null;
  if (b.recap && typeof b.recap === 'object') {
    const r = b.recap;
    recap = { date: t(r.date, 60), livraison: r.livraison === true, adresse: t(r.adresse, 200), reprise: t(r.reprise, 120),
      total: Math.max(0, Number(r.total) || 0), surDevis: r.surDevis === true,
      items: (Array.isArray(r.items) ? r.items.slice(0, 20) : []).map((x) => ({ nom: t(x && x.nom, 120), detail: t(x && x.detail, 240), prix: t(x && x.prix, 40) })).filter((x) => x.nom) };
  }
  const html = htmlAccuse({ txt, prenom, site, emetteur: { email: 'contact@vespraevent.com' }, recap, avecDevis: !!devis });
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST',
      headers: { Authorization: `Bearer ${cleApi}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.NOTIFY_FROM || 'Vespra Event <onboarding@resend.dev>',
        reply_to: process.env.NOTIFY_REPLY_TO || 'vespraevent@gmail.com', to: [email],
        subject: txt.objet, html, ...(devis ? { attachments: [devis] } : {}) }) });
    if (!r.ok) console.error('Resend a refusé l’accusé :', r.status, await r.text());
    else { try { await store.setJSON(cle, { t: Date.now(), envoye: Date.now() }); } catch {} }
  } catch (e) { console.error('Accusé impossible :', e.message); }
  return new Response('ok', { status: 202 });
};
