/* Surveillance du site : passe toutes les 30 minutes et vérifie que les pages
   et les services essentiels répondent. Envoie un e-mail à NOTIFY_TO
   (vespraevent@gmail.com par défaut) quand quelque chose ne va pas — après deux
   passages en échec de suite, pour éviter les fausses alertes — puis un e-mail
   quand tout est rétabli. Aucun e-mail tant que tout va bien. */
import { getStore } from './_stockage.mjs';

export const config = { schedule: '*/30 * * * *' };

const site = () => (process.env.URL || 'https://www.vespraevent.fr').replace(/\/$/, '');

/* [nom, chemin, contrôle du contenu (facultatif)] */
const CONTROLES = [
  ['Page d’accueil', '/', (t) => /Vespra Event/i.test(t) && t.length > 20000],
  ['Catalogue', '/catalogue', (t) => /<title>/i.test(t)],
  ['Réservation', '/reservation', (t) => /<title>/i.test(t)],
  ['Rendez-vous', '/rendez-vous', (t) => /<title>/i.test(t)],
  ['Plan du site', '/sitemap.xml', (t) => /<urlset/.test(t)],
  ['Avis produits (service)', '/api/avis', (t) => { try { return Array.isArray(JSON.parse(t)); } catch { return false; } }],
  ['Session client (service)', '/api/espace/session', (t) => { try { JSON.parse(t); return true; } catch { return false; } }],
];

async function tester([nom, chemin, ok]) {
  const t0 = Date.now();
  try {
    const r = await fetch(site() + chemin, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'VespraSurveillance/1.0' } });
    const texte = await r.text();
    const ms = Date.now() - t0;
    if (!r.ok) return { nom, chemin, ko: `erreur ${r.status}` };
    if (ok && !ok(texte)) return { nom, chemin, ko: 'réponse inattendue' };
    if (ms > 8000) return { nom, chemin, ko: `très lent (${Math.round(ms / 1000)} s)` };
    return { nom, chemin, ok: true };
  } catch (e) {
    return { nom, chemin, ko: e.name === 'TimeoutError' ? 'ne répond pas (plus de 15 s)' : 'inaccessible' };
  }
}

async function prevenir(sujet, lignes) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.error('Surveillance : RESEND_API_KEY absent'); return false; }
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2933;max-width:520px;line-height:1.6;font-size:14px">
    <p style="font-size:15px;margin:0 0 10px"><b>${sujet}</b></p>${lignes.map((l) => `<p style="margin:0 0 6px">${l}</p>`).join('')}
    <p style="color:#8a8f9b;font-size:12px;margin-top:16px">Surveillance automatique du site — ${site()}</p></div>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || 'Vespra Event <onboarding@resend.dev>',
        to: (process.env.NOTIFY_TO || 'vespraevent@gmail.com').split(',').map((s) => s.trim()),
        subject: sujet, html,
      }),
    });
    if (!r.ok) console.error('Surveillance : Resend a refusé', r.status);
    return r.ok;
  } catch (e) { console.error('Surveillance : envoi impossible', e.message); return false; }
}

export default async () => {
  const res = await Promise.all(CONTROLES.map(tester));
  const pannes = res.filter((r) => !r.ok);
  let st, etat = { echecs: 0, alerte: false };
  try { st = getStore('vespra-surveillance'); etat = (await st.get('etat', { type: 'json' })) || etat; } catch (e) { console.error('Surveillance : stockage', e.message); }

  if (pannes.length) {
    etat.echecs = (etat.echecs || 0) + 1;
    etat.derniere = pannes.map((p) => `${p.nom} (${p.chemin}) : ${p.ko}`);
    if (etat.echecs >= 2 && !etat.alerte) {
      const envoye = await prevenir('⚠ Problème détecté sur le site', [
        ...etat.derniere,
        'Constaté sur deux vérifications de suite (15 minutes d’écart). Je vous préviens dès que tout est rétabli.',
      ]);
      etat.alerte = envoye || false; etat.depuis = new Date().toISOString();
    }
  } else {
    if (etat.alerte) await prevenir('✓ Le site fonctionne de nouveau', ['Toutes les vérifications sont de nouveau correctes.']);
    etat = { echecs: 0, alerte: false };
  }
  try { if (st) await st.setJSON('etat', etat); } catch (e) {}
  console.log('Surveillance :', pannes.length ? JSON.stringify(etat.derniere) : 'tout va bien');
};
