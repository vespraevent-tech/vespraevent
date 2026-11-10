/* Demandes d'avis après la location : passe une fois par jour (10 h / 11 h, heure de Paris).
   Elle appelle la route signée du back-office, qui applique le réglage
   « Réponse automatique › Demande d'avis » (désactivée par défaut). */
import { createHmac } from 'node:crypto';

export const config = { schedule: '0 9 * * *' };

export default async () => {
  const secret = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || '';
  if (!secret) { console.error('Demandes d\u2019avis : secret absent'); return; }
  const site = (process.env.URL || 'https://www.vespraevent.fr').replace(/\/$/, '');
  const sig = createHmac('sha256', secret).update('avis-demandes').digest('hex');
  try {
    const r = await fetch(site + '/api/espace/avis-run', { method: 'POST', headers: { 'x-accuse': sig, 'content-type': 'application/json' }, body: '{}' });
    console.log('Demandes d\u2019avis :', r.status, await r.text());
  } catch (e) { console.error('Demandes d\u2019avis impossibles :', e.message); }
};
