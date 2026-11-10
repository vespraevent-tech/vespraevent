/* ═══════════════════════════════════════════════════════════════════
   DEMANDES D'INSCRIPTION DE SALLES
   ───────────────────────────────────────────────────────────────────
   Une seule entrée : POST /api/salle/demande, appelée par le
   formulaire de la page « Nos recommandations ».

   Rien n'est publié automatiquement. La demande est enregistrée dans
   la même collection « salles » que les salles recommandées, mais
   avec statut « attente » : la fonction publique du site (site.mjs)
   écarte ces lignes, et le back-office les affiche à part, pour que
   Thomas publie ou refuse lui-même. C'est volontaire : une page qui
   dit « nous recommandons » ne peut pas se remplir toute seule.

   Un e-mail de notification part si RESEND_API_KEY est configurée ;
   s'il n'y a pas de clé, la demande est quand même enregistrée et
   attend dans le back-office.
   ═══════════════════════════════════════════════════════════════════ */
import { getStore } from './_stockage.mjs';
import { limiteBlobs } from './_limite.mjs';

const DATA_STORE = 'vespra-admin-data';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const propre = (v, max = 400) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);

function identifiant(nom) {
  const base = nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'salle';
  return 'demande-' + base + '-' + Date.now().toString(36);
}

async function prevenir(salle) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.error('RESEND_API_KEY absente : demande enregistrée sans e-mail'); return false; }
  const to = (process.env.NOTIFY_TO || 'vespraevent@gmail.com').split(',').map(s => s.trim()).filter(Boolean);
  const e = v => String(v || '—').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:28px">
    <h2 style="margin:0 0 6px">Une salle demande à figurer dans vos recommandations</h2>
    <p style="color:#646D7C;margin:0 0 20px">Rien n'est publié : la demande attend dans le back-office, onglet Recommandations.</p>
    <p><strong>Salle :</strong> ${e(salle.nom)}</p>
    <p><strong>Type :</strong> ${e(salle.type)}</p>
    <p><strong>Commune :</strong> ${e(salle.commune)}${salle.secteur ? ' &middot; secteur ' + e(salle.secteur) : ''}</p>
    <p><strong>Capacité :</strong> ${e(salle.capacite)}</p>
    <p><strong>Site :</strong> ${e(salle.site)}</p>
    <p><strong>Contact :</strong> ${e(salle.contact)} &middot; ${e(salle.email)} &middot; ${e(salle.tel)}</p>
    <blockquote style="padding:16px;background:#f5f5f5;border-radius:10px;margin:18px 0">${e(salle.mot)}</blockquote>
    <p><a href="${process.env.URL || 'https://www.vespraevent.fr'}/studio/" style="display:inline-block;background:#2B4A6B;color:#fff;padding:13px 20px;border-radius:999px;text-decoration:none;font-weight:700">Ouvrir le back-office</a></p>
  </div>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || 'Vespra Event <onboarding@resend.dev>',
        to,
        subject: `Demande d'inscription — ${salle.nom}`,
        html,
        ...(salle.email ? { reply_to: salle.email } : {}),
      }),
    });
    if (!r.ok) { console.error('Resend a refusé la notification :', r.status); return false; }
    return true;
  } catch (err) {
    console.error('Notification impossible :', err.message);
    return false;
  }
}

export default async (request) => {
  const url = new URL(request.url);
  if (!url.pathname.endsWith('/demande') || request.method !== 'POST') {
    return json({ error: 'Not found' }, 404);
  }

  let corps;
  try { corps = await request.json(); } catch { return json({ error: 'Requête illisible.' }, 400); }

  if (await limiteBlobs(request, 'salle', 5, 60 * 60 * 1000)) return json({ error: 'Trop de demandes. Réessayez plus tard.' }, 429);
  /* champ piège : un robot le remplit, un humain ne le voit pas */
  if (corps.website) return json({ ok: true });

  const nom = propre(corps.nom, 120);
  const commune = propre(corps.commune, 120);
  const contact = propre(corps.contact, 120);
  const email = propre(corps.email, 160);
  if (!nom || !commune || !email) {
    return json({ error: 'Le nom de la salle, la commune et votre e-mail sont obligatoires.' }, 400);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'Cette adresse e-mail ne semble pas valide.' }, 400);
  }
  const site = propre(corps.site, 300);
  if (site && !/^https?:\/\//i.test(site)) {
    return json({ error: "L'adresse du site doit commencer par https://" }, 400);
  }

  const salle = {
    id: identifiant(nom),
    statut: 'attente',
    nom,
    /* le rattachement à une page de ville est décidé au back-office :
       une demande ne choisit pas elle-même où elle s'affiche */
    cle: '',
    secteur: propre(corps.secteur, 120),
    type: propre(corps.type, 60),
    commune,
    capacite: propre(corps.capacite, 60),
    mot: propre(corps.mot, 900),
    site,
    tel: propre(corps.tel, 40),
    contact,
    email,
    ordre: Date.now(),
    recuLe: new Date().toISOString(),
  };

  /* on prévient d'abord, pour enregistrer le résultat avec la demande */
  const emailEnvoye = await prevenir(salle);
  salle.emailEnvoye = emailEnvoye;

  try {
    const store = getStore(DATA_STORE);
    await store.set(`salles/${encodeURIComponent(salle.id)}`, JSON.stringify(salle), {
      metadata: { updatedAt: salle.recuLe, collection: 'salles', id: salle.id },
    });
  } catch (err) {
    console.error('Enregistrement de la demande impossible :', err.message);
    return json({ error: 'Impossible d’enregistrer votre demande pour le moment.' }, 500);
  }

  return json({ ok: true, emailEnvoye });
};
