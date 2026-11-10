/* ════════════════════════════════════════════════════
   LIVRE D'OR AUDIO — envoi du message vocal à l'invité
   ────────────────────────────────────────────────────
   POST /.netlify/functions/livredor   (appelé par le kiosque du livre d'or)

   Corps JSON : { evenement, prenoms, email, fichier, mime, audio (base64) }
   En-tête    : x-kiosque-cle = LIVREDOR_CLE (variable Netlify)

   Le message est joint à l'e-mail (Resend, déjà utilisé par le site).
   Limite : ~4,5 Mo de son par message (les fonctions Netlify acceptent
   6 Mo par requête). Un MP3 de 4 minutes tient très largement.
   ════════════════════════════════════════════════════ */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-kiosque-cle',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const rep = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MAX_OCTETS = 4.5 * 1024 * 1024;

export default async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return rep({ ok: false, erreur: 'Méthode non autorisée' }, 405);

  const cle = process.env.LIVREDOR_CLE;
  if (!cle) return rep({ ok: false, erreur: "LIVREDOR_CLE n'est pas définie dans Netlify" }, 500);
  if (request.headers.get('x-kiosque-cle') !== cle) return rep({ ok: false, erreur: 'Clé du kiosque refusée' }, 403);

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return rep({ ok: false, erreur: "RESEND_API_KEY n'est pas définie dans Netlify" }, 500);

  let d;
  try { d = await request.json(); } catch { return rep({ ok: false, erreur: 'Requête illisible' }, 400); }

  const email = String(d.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return rep({ ok: false, erreur: 'Adresse e-mail invalide' }, 400);
  const prenoms = String(d.prenoms || '').trim().slice(0, 120);
  const evenement = String(d.evenement || '').trim().slice(0, 160);
  const fichier = String(d.fichier || 'message.mp3').replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 150) || 'message.mp3';
  const b64 = String(d.audio || '');
  if (!b64) return rep({ ok: false, erreur: 'Aucun son reçu' }, 400);
  if (Math.floor(b64.length * 0.75) > MAX_OCTETS) return rep({ ok: false, erreur: 'Message trop lourd pour être envoyé par e-mail' }, 413);

  const titre = evenement ? esc(evenement) : 'votre événement';
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2933;max-width:520px;margin:0 auto;line-height:1.6">
    <p>Bonjour${prenoms ? ' ' + esc(prenoms) : ''},</p>
    <p>Merci d'avoir laissé un message pour <strong>${titre}</strong>. Vous trouverez votre enregistrement en pièce jointe.</p>
    <p style="color:#6b7280;font-size:13px">Votre message a aussi été conservé sur le livre d'or audio, remis aux organisateurs.</p>
    <p style="color:#6b7280;font-size:13px">Vespra Event</p></div>`;

  const body = {
    from: process.env.NOTIFY_FROM || 'Vespra Event <onboarding@resend.dev>',
    to: [email],
    subject: evenement ? `Votre message vocal — ${evenement}` : 'Votre message vocal',
    html,
    attachments: [{ filename: fichier, content: b64 }],
    headers: { 'X-Entity-Ref-ID': 'livredor-' + Date.now() },
  };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    console.error('Livre d’or : Resend a refusé', r.status, t);
    return rep({ ok: false, erreur: 'Envoi refusé par le service e-mail (' + r.status + ')' }, 502);
  }
  return rep({ ok: true });
};
